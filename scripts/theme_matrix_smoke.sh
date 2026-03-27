#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node

REQUIRED_RAW="${FVPLUS_THEME_MATRIX_REQUIRED:-0}"

case "$(printf '%s' "${REQUIRED_RAW}" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on)
    THEME_REQUIRED=1
    ;;
  *)
    THEME_REQUIRED=0
    ;;
esac

if [[ -z "${FVPLUS_THEME_MATRIX_URLS:-}" ]]; then
  if [[ "${THEME_REQUIRED}" -eq 1 ]]; then
    echo "ERROR: Theme matrix smoke checks are required but FVPLUS_THEME_MATRIX_URLS is not set." >&2
    exit 1
  fi
  echo "Skipping theme matrix smoke checks (FVPLUS_THEME_MATRIX_URLS not configured)."
  exit 0
fi

node "${ROOT_DIR}/scripts/theme_matrix_smoke.mjs"
