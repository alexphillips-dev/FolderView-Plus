#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node

if [[ -z "${FVPLUS_THEME_MATRIX_URLS:-}" ]]; then
  echo "Skipping theme matrix smoke checks (FVPLUS_THEME_MATRIX_URLS not configured)."
  exit 0
fi

node "${ROOT_DIR}/scripts/theme_matrix_smoke.mjs"
