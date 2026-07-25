#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

DEFAULT_SOURCE_URL="https://raw.githubusercontent.com/unraid/api/main/api/src/unraid-api/unraid-file-modifier/modifications/docker-containers-page.modification.ts"
DEFAULT_SCHEMA_URL="https://raw.githubusercontent.com/unraid/api/main/api/generated-schema.graphql"
DEFAULT_API_RELEASE_URL="https://api.github.com/repos/unraid/api/releases/latest"
SOURCE_URL="${FVPLUS_UNRAID_DOCKER_SOURCE_URL:-${DEFAULT_SOURCE_URL}}"
SCHEMA_URL="${FVPLUS_UNRAID_DOCKER_SCHEMA_URL:-${DEFAULT_SCHEMA_URL}}"
API_RELEASE_URL="${FVPLUS_UNRAID_DOCKER_RELEASE_URL:-${DEFAULT_API_RELEASE_URL}}"
SOURCE_FILE=""
SCHEMA_FILE=""
API_RELEASE_FILE=""
BASELINE_FILE="${ROOT_DIR}/docs/unraid-docker-upstream-baseline.json"
RELEASE_NOTES_DIR=""
JSON_OUTPUT=0
GITHUB_OUTPUT_FILE=""
NODE_BIN=""

usage() {
  cat <<'EOF'
Usage: unraid_docker_upstream_monitor.sh [options]

Checks the official Unraid API Docker page replacement activation gate and,
the tracked Docker GraphQL schema/API release baseline. When supplied, it also
checks release-note content for an interface activation announcement.

Options:
  --source-file <path>         Inspect a local source file instead of downloading upstream.
  --source-url <url>           Override the official upstream source URL.
  --schema-file <path>         Inspect a local generated GraphQL schema.
  --schema-url <url>           Override the official generated schema URL.
  --api-release-file <path>    Inspect a local GitHub latest-release response.
  --api-release-url <url>      Override the official API latest-release URL.
  --baseline-file <path>       Override the reviewed schema/release baseline.
  --release-notes-dir <path>   Scan local Unraid release-note files for activation wording.
  --github-output <path>       Append status fields to a GitHub Actions output file.
  --json                       Emit a compact JSON result.
  -h, --help                   Show this help.

Exit codes:
  0   Replacement remains dormant and no release announcement was found.
  20  Activation or an upstream compatibility review signal was detected.
  21  Upstream state could not be classified safely.
EOF
}

while [[ $# -gt 0 ]]; do
  case "${1}" in
    --source-file)
      SOURCE_FILE="${2:-}"
      shift
      ;;
    --source-url)
      SOURCE_URL="${2:-}"
      shift
      ;;
    --schema-file)
      SCHEMA_FILE="${2:-}"
      shift
      ;;
    --schema-url)
      SCHEMA_URL="${2:-}"
      shift
      ;;
    --api-release-file)
      API_RELEASE_FILE="${2:-}"
      shift
      ;;
    --api-release-url)
      API_RELEASE_URL="${2:-}"
      shift
      ;;
    --baseline-file)
      BASELINE_FILE="${2:-}"
      shift
      ;;
    --release-notes-dir)
      RELEASE_NOTES_DIR="${2:-}"
      shift
      ;;
    --github-output)
      GITHUB_OUTPUT_FILE="${2:-}"
      shift
      ;;
    --json)
      JSON_OUTPUT=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fvplus::fail "Unknown argument: ${1}"
      ;;
  esac
  shift
done

fvplus::require_commands grep sed mktemp

normalize_local_path() {
  local value="${1:-}"
  if [[ "${value}" =~ ^[A-Za-z]:[\\/].* ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -u "${value}"
    return
  fi
  printf '%s\n' "${value}"
}

SOURCE_FILE="$(normalize_local_path "${SOURCE_FILE}")"
SCHEMA_FILE="$(normalize_local_path "${SCHEMA_FILE}")"
API_RELEASE_FILE="$(normalize_local_path "${API_RELEASE_FILE}")"
BASELINE_FILE="$(normalize_local_path "${BASELINE_FILE}")"
RELEASE_NOTES_DIR="$(normalize_local_path "${RELEASE_NOTES_DIR}")"
GITHUB_OUTPUT_FILE="$(normalize_local_path "${GITHUB_OUTPUT_FILE}")"

TEMP_DIR=""
# shellcheck disable=SC2317,SC2329 # Invoked indirectly by the EXIT trap.
cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf -- "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

if [[ -z "${SOURCE_FILE}" ]]; then
  fvplus::require_commands curl node
  NODE_BIN="$(fvplus::resolve_platform_command node)"
  TEMP_DIR="$(mktemp -d)"
  SOURCE_FILE="${TEMP_DIR}/docker-containers-page.modification.ts"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 "${SOURCE_URL}" -o "${SOURCE_FILE}"; then
    STATUS="unknown"
    REASON="upstream-source-unavailable"
  fi
  SCHEMA_FILE="${TEMP_DIR}/generated-schema.graphql"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 "${SCHEMA_URL}" -o "${SCHEMA_FILE}"; then
    rm -f -- "${SCHEMA_FILE}"
  fi
  API_RELEASE_FILE="${TEMP_DIR}/api-latest-release.json"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 "${API_RELEASE_URL}" -o "${API_RELEASE_FILE}"; then
    rm -f -- "${API_RELEASE_FILE}"
  fi
fi

STATUS="${STATUS:-unknown}"
REASON="${REASON:-unclassified-source}"
SOURCE_GATE="unknown"
RELEASE_ANNOUNCEMENT="not-scanned"
SCHEMA_STATUS="not-scanned"
SCHEMA_SIGNATURE="not-scanned"
LATEST_API_RELEASE="not-scanned"
API_RELEASE_STATUS="not-scanned"

if [[ -f "${SOURCE_FILE}" ]]; then
  if ! grep -Eq 'unraid-docker-container-overview' "${SOURCE_FILE}"; then
    STATUS="unknown"
    REASON="native-component-marker-missing"
  elif grep -Eq 'shouldApply[[:space:]]*:[[:space:]]*false' "${SOURCE_FILE}"; then
    STATUS="dormant"
    REASON="upstream-shouldApply-false"
    SOURCE_GATE="false"
  elif grep -Eq 'shouldApply[[:space:]]*:[[:space:]]*true' "${SOURCE_FILE}"; then
    STATUS="active"
    REASON="upstream-shouldApply-true"
    SOURCE_GATE="true"
  else
    STATUS="unknown"
    REASON="upstream-activation-gate-changed"
  fi
fi

json_field() {
  local payload="${1:-}"
  local field="${2:-}"
  if [[ -z "${NODE_BIN}" ]]; then
    NODE_BIN="$(fvplus::resolve_platform_command node)"
  fi
  printf '%s' "${payload}" | "${NODE_BIN}" -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      try {
        const value = JSON.parse(input)[process.argv[1]];
        process.stdout.write(value === null || typeof value === "undefined" ? "" : String(value));
      } catch {
        process.exit(2);
      }
    });
  ' "${field}"
}

if [[ -n "${SCHEMA_FILE}" ]]; then
  fvplus::require_commands node
  NODE_BIN="${NODE_BIN:-$(fvplus::resolve_platform_command node)}"
  if [[ ! -f "${SCHEMA_FILE}" || ! -f "${BASELINE_FILE}" ]]; then
    SCHEMA_STATUS="unavailable"
  else
    SCHEMA_RESULT="$(
      "${NODE_BIN}" \
        "$(fvplus::path_for_command "${NODE_BIN}" "${ROOT_DIR}/scripts/unraid_docker_schema_signature.mjs")" \
        "$(fvplus::path_for_command "${NODE_BIN}" "${SCHEMA_FILE}")" \
        "$(fvplus::path_for_command "${NODE_BIN}" "${BASELINE_FILE}")" \
        "$(fvplus::path_for_command "${NODE_BIN}" "${API_RELEASE_FILE}")"
    )"
    SCHEMA_STATUS="$(json_field "${SCHEMA_RESULT}" schemaStatus)"
    SCHEMA_SIGNATURE="$(json_field "${SCHEMA_RESULT}" schemaSignature)"
    LATEST_API_RELEASE="$(json_field "${SCHEMA_RESULT}" latestApiRelease)"
    API_RELEASE_STATUS="$(json_field "${SCHEMA_RESULT}" releaseStatus)"
    if [[ -n "${API_RELEASE_FILE}" && ! -f "${API_RELEASE_FILE}" ]]; then
      LATEST_API_RELEASE="unavailable"
      API_RELEASE_STATUS="unavailable"
    fi
    if [[ "${STATUS}" == "dormant" && "${SCHEMA_STATUS}" != "matched" ]]; then
      STATUS="review"
      REASON="docker-schema-${SCHEMA_STATUS}"
    elif [[ "${STATUS}" == "dormant" && "${API_RELEASE_STATUS}" == "changed" ]]; then
      STATUS="review"
      REASON="new-unraid-api-release"
    elif [[ "${STATUS}" == "dormant" && "${API_RELEASE_STATUS}" == "unavailable" ]]; then
      STATUS="unknown"
      REASON="unraid-api-release-unavailable"
    fi
  fi
fi
if [[ "${STATUS}" == "dormant" && "${SCHEMA_STATUS}" == "unavailable" ]]; then
  STATUS="unknown"
  REASON="docker-schema-unavailable"
fi

if [[ -n "${RELEASE_NOTES_DIR}" ]]; then
  if [[ ! -d "${RELEASE_NOTES_DIR}" ]]; then
    RELEASE_ANNOUNCEMENT="unavailable"
  elif grep -ERiq \
    'native[[:space:]]+Docker[[:space:]]+(page|interface|organizer)|new[[:space:]]+Docker[[:space:]]+(page|interface|webGUI)|Docker[^[:cntrl:]]{0,80}(Vue|GraphQL)[^[:cntrl:]]{0,40}(page|interface)' \
    "${RELEASE_NOTES_DIR}"; then
    RELEASE_ANNOUNCEMENT="detected"
    STATUS="active"
    REASON="release-note-activation-announcement"
  else
    RELEASE_ANNOUNCEMENT="not-detected"
  fi
fi

if [[ -n "${GITHUB_OUTPUT_FILE}" ]]; then
  {
    printf 'status=%s\n' "${STATUS}"
    printf 'reason=%s\n' "${REASON}"
    printf 'source_gate=%s\n' "${SOURCE_GATE}"
    printf 'release_announcement=%s\n' "${RELEASE_ANNOUNCEMENT}"
    printf 'schema_status=%s\n' "${SCHEMA_STATUS}"
    printf 'schema_signature=%s\n' "${SCHEMA_SIGNATURE}"
    printf 'latest_api_release=%s\n' "${LATEST_API_RELEASE}"
    printf 'api_release_status=%s\n' "${API_RELEASE_STATUS}"
  } >> "${GITHUB_OUTPUT_FILE}"
fi

if [[ "${JSON_OUTPUT}" -eq 1 ]]; then
  printf '{"status":"%s","reason":"%s","sourceGate":"%s","releaseAnnouncement":"%s","schemaStatus":"%s","schemaSignature":"%s","latestApiRelease":"%s","apiReleaseStatus":"%s"}\n' \
    "${STATUS}" "${REASON}" "${SOURCE_GATE}" "${RELEASE_ANNOUNCEMENT}" \
    "${SCHEMA_STATUS}" "${SCHEMA_SIGNATURE}" "${LATEST_API_RELEASE}" "${API_RELEASE_STATUS}"
else
  printf 'Unraid Docker upstream monitor: status=%s reason=%s sourceGate=%s releaseAnnouncement=%s schemaStatus=%s latestApiRelease=%s\n' \
    "${STATUS}" "${REASON}" "${SOURCE_GATE}" "${RELEASE_ANNOUNCEMENT}" \
    "${SCHEMA_STATUS}" "${LATEST_API_RELEASE}"
fi

case "${STATUS}" in
  dormant)
    exit 0
    ;;
  active|review)
    exit 20
    ;;
  *)
    exit 21
    ;;
esac
