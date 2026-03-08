#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MATRIX="${FVPLUS_UNRAID_MATRIX:-}"
REQUIRED_RAW="${FVPLUS_UNRAID_MATRIX_REQUIRED:-0}"
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

failures=0
index=0

for raw_entry in "${entries[@]}"; do
  index=$((index + 1))
  entry="$(printf '%s' "${raw_entry}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "${entry}" ]]; then
    continue
  fi

  label=""
  url=""
  if [[ "${entry}" == *"="* ]]; then
    label="${entry%%=*}"
    url="${entry#*=}"
  elif [[ "${entry}" == *"|"* ]]; then
    label="${entry%%|*}"
    url="${entry#*|}"
  else
    label="target-${index}"
    url="${entry}"
  fi

  label="$(printf '%s' "${label}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  url="$(printf '%s' "${url}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  if [[ -z "${url}" ]]; then
    echo "WARN: Skipping empty URL entry: ${entry}"
    continue
  fi
  if [[ -z "${label}" ]]; then
    label="target-${index}"
  fi

  echo "[${label}] Smoke check: ${url}"
  if FVPLUS_BROWSER_SMOKE_URL="${url}" bash "${SMOKE_SCRIPT}"; then
    echo "[${label}] PASS"
  else
    echo "[${label}] FAIL"
    failures=$((failures + 1))
  fi
done

if [[ "${failures}" -gt 0 ]]; then
  fvplus::fail "Unraid matrix smoke checks failed for ${failures} target(s)."
fi

echo "Unraid matrix smoke checks passed for all targets."
