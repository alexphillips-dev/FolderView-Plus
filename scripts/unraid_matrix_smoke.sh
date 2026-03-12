#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MATRIX="${FVPLUS_UNRAID_MATRIX:-}"
REQUIRED_RAW="${FVPLUS_UNRAID_MATRIX_REQUIRED:-0}"
REQUIRED_VERSIONS_RAW="${FVPLUS_UNRAID_REQUIRED_VERSIONS:-}"
REQUIRED_THEMES_RAW="${FVPLUS_UNRAID_REQUIRED_THEMES:-}"
SMOKE_SCRIPT="${ROOT_DIR}/scripts/browser_smoke.sh"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands bash sed tr

if [[ ! -x "${SMOKE_SCRIPT}" ]]; then
  chmod +x "${SMOKE_SCRIPT}"
fi

case "$(printf '%s' "${REQUIRED_RAW}" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on)
    MATRIX_REQUIRED=1
    ;;
  *)
    MATRIX_REQUIRED=0
    ;;
esac

if [[ -z "${MATRIX}" ]]; then
  if [[ "${MATRIX_REQUIRED}" -eq 1 ]]; then
    fvplus::fail "FVPLUS_UNRAID_MATRIX is required but not set."
  fi
  echo "Skipping Unraid matrix smoke checks (FVPLUS_UNRAID_MATRIX not set)."
  exit 0
fi

mapfile -t entries < <(printf '%s\n' "${MATRIX}" | tr ',;' '\n' | sed '/^[[:space:]]*$/d')
if [[ ${#entries[@]} -eq 0 ]]; then
  if [[ "${MATRIX_REQUIRED}" -eq 1 ]]; then
    fvplus::fail "FVPLUS_UNRAID_MATRIX is required but no usable entries were parsed."
  fi
  echo "Skipping Unraid matrix smoke checks (no usable entries parsed)."
  exit 0
fi

normalize_token() {
  printf '%s' "${1:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]'
}

parse_required_list() {
  local raw="${1:-}"
  printf '%s\n' "${raw}" | tr ',;' '\n' | sed '/^[[:space:]]*$/d'
}

failures=0
index=0
declare -A seen_versions=()
declare -A seen_themes=()

is_version_requirement_covered() {
  local requirement normalized_requirement candidate
  requirement="$(normalize_token "${1:-}")"
  normalized_requirement="${requirement%.x}"
  normalized_requirement="${normalized_requirement%.}"
  if [[ -z "${normalized_requirement}" ]]; then
    return 0
  fi
  for candidate in "${!seen_versions[@]}"; do
    if [[ "${candidate}" == "${normalized_requirement}"* ]]; then
      return 0
    fi
  done
  return 1
}

for raw_entry in "${entries[@]}"; do
  index=$((index + 1))
  entry="$(printf '%s' "${raw_entry}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "${entry}" ]]; then
    continue
  fi

  label=""
  url=""
  version=""
  theme=""

  # Extended matrix format:
  #   <version>|<theme>|<url>
  # Example:
  #   7.2|black|https://server/Settings/FolderViewPlus
  if [[ "${entry}" == *"|"* ]]; then
    IFS='|' read -r part_a part_b part_c <<< "${entry}"
    part_a="$(printf '%s' "${part_a:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    part_b="$(printf '%s' "${part_b:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    part_c="$(printf '%s' "${part_c:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [[ -n "${part_a}" && -n "${part_b}" && -n "${part_c}" && "${part_c}" =~ ^https?:// ]]; then
      version="${part_a}"
      theme="${part_b}"
      url="${part_c}"
      label="${version}-${theme}"
    fi
  fi

  # Backward compatible matrix formats:
  #   <label>=<url>
  #   <label>|<url>
  #   <url>
  if [[ -z "${url}" && "${entry}" == *"="* ]]; then
    label="${entry%%=*}"
    url="${entry#*=}"
  elif [[ -z "${url}" && "${entry}" == *"|"* ]]; then
    label="${entry%%|*}"
    url="${entry#*|}"
  elif [[ -z "${url}" ]]; then
    label="target-${index}"
    url="${entry}"
  fi

  label="$(printf '%s' "${label}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  url="$(printf '%s' "${url}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  # Alternate metadata format:
  #   <version>@<theme>=<url>
  if [[ -z "${version}" && "${label}" == *"@"* ]]; then
    version="$(printf '%s' "${label%%@*}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    theme="$(printf '%s' "${label#*@}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [[ -n "${version}" && -n "${theme}" ]]; then
      label="${version}-${theme}"
    fi
  fi

  if [[ -n "${version}" ]]; then
    seen_versions["$(normalize_token "${version}")"]=1
  fi
  if [[ -n "${theme}" ]]; then
    seen_themes["$(normalize_token "${theme}")"]=1
  fi

  if [[ -z "${url}" ]]; then
    echo "WARN: Skipping empty URL entry: ${entry}"
    continue
  fi
  if [[ -z "${label}" ]]; then
    label="target-${index}"
  fi

  echo "[${label}] Smoke check: ${url}"
  if FVPLUS_BROWSER_SMOKE_URL="${url}" FVPLUS_BROWSER_SMOKE_LABEL="${label}" FVPLUS_UNRAID_VERSION_HINT="${version}" FVPLUS_THEME_HINT="${theme}" bash "${SMOKE_SCRIPT}"; then
    echo "[${label}] PASS"
  else
    echo "[${label}] FAIL"
    failures=$((failures + 1))
  fi
done

if [[ "${failures}" -gt 0 ]]; then
  fvplus::fail "Unraid matrix smoke checks failed for ${failures} target(s)."
fi

if [[ -n "${REQUIRED_VERSIONS_RAW}" ]]; then
  while IFS= read -r required_version; do
    required_version="$(normalize_token "${required_version}")"
    [[ -z "${required_version}" ]] && continue
    if ! is_version_requirement_covered "${required_version}"; then
      fvplus::fail "Unraid matrix coverage is missing required version family: ${required_version}"
    fi
  done < <(parse_required_list "${REQUIRED_VERSIONS_RAW}")
fi

if [[ -n "${REQUIRED_THEMES_RAW}" ]]; then
  while IFS= read -r required_theme; do
    required_theme="$(normalize_token "${required_theme}")"
    [[ -z "${required_theme}" ]] && continue
    if [[ -z "${seen_themes[${required_theme}]:-}" ]]; then
      fvplus::fail "Unraid matrix coverage is missing required theme: ${required_theme}"
    fi
  done < <(parse_required_list "${REQUIRED_THEMES_RAW}")
fi

echo "Unraid matrix smoke checks passed for all targets."
