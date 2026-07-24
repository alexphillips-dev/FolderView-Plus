#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

DEFAULT_SOURCE_URL="https://raw.githubusercontent.com/unraid/api/main/api/src/unraid-api/unraid-file-modifier/modifications/docker-containers-page.modification.ts"
SOURCE_URL="${FVPLUS_UNRAID_DOCKER_SOURCE_URL:-${DEFAULT_SOURCE_URL}}"
SOURCE_FILE=""
RELEASE_NOTES_DIR=""
JSON_OUTPUT=0
GITHUB_OUTPUT_FILE=""

usage() {
  cat <<'EOF'
Usage: unraid_docker_upstream_monitor.sh [options]

Checks the official Unraid API Docker page replacement activation gate and,
when supplied, release-note content for an interface activation announcement.

Options:
  --source-file <path>         Inspect a local source file instead of downloading upstream.
  --source-url <url>           Override the official upstream source URL.
  --release-notes-dir <path>   Scan local Unraid release-note files for activation wording.
  --github-output <path>       Append status fields to a GitHub Actions output file.
  --json                       Emit a compact JSON result.
  -h, --help                   Show this help.

Exit codes:
  0   Replacement remains dormant and no release announcement was found.
  20  Activation was detected.
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
RELEASE_NOTES_DIR="$(normalize_local_path "${RELEASE_NOTES_DIR}")"
GITHUB_OUTPUT_FILE="$(normalize_local_path "${GITHUB_OUTPUT_FILE}")"

TEMP_DIR=""
# shellcheck disable=SC2329 # Invoked indirectly by the EXIT trap.
cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf -- "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

if [[ -z "${SOURCE_FILE}" ]]; then
  fvplus::require_commands curl
  TEMP_DIR="$(mktemp -d)"
  SOURCE_FILE="${TEMP_DIR}/docker-containers-page.modification.ts"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 "${SOURCE_URL}" -o "${SOURCE_FILE}"; then
    STATUS="unknown"
    REASON="upstream-source-unavailable"
  fi
fi

STATUS="${STATUS:-unknown}"
REASON="${REASON:-unclassified-source}"
SOURCE_GATE="unknown"
RELEASE_ANNOUNCEMENT="not-scanned"

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
  } >> "${GITHUB_OUTPUT_FILE}"
fi

if [[ "${JSON_OUTPUT}" -eq 1 ]]; then
  printf '{"status":"%s","reason":"%s","sourceGate":"%s","releaseAnnouncement":"%s"}\n' \
    "${STATUS}" "${REASON}" "${SOURCE_GATE}" "${RELEASE_ANNOUNCEMENT}"
else
  printf 'Unraid Docker upstream monitor: status=%s reason=%s sourceGate=%s releaseAnnouncement=%s\n' \
    "${STATUS}" "${REASON}" "${SOURCE_GATE}" "${RELEASE_ANNOUNCEMENT}"
fi

case "${STATUS}" in
  dormant)
    exit 0
    ;;
  active)
    exit 20
    ;;
  *)
    exit 21
    ;;
esac
