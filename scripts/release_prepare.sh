#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node
chmod +x pkg_build.sh scripts/doctor.sh scripts/ensure_plg_changes_entry.sh scripts/release_guard.sh scripts/install_smoke.sh scripts/browser_smoke.sh
bash scripts/doctor.sh

if [[ "${1:-}" == "--beta" ]]; then
  if [[ -n "${2:-}" ]]; then
    bash pkg_build.sh --beta "${2}" --no-validate
  else
    bash pkg_build.sh --beta --no-validate
  fi
else
  bash pkg_build.sh --no-validate
fi

bash scripts/ensure_plg_changes_entry.sh
bash scripts/release_guard.sh
bash scripts/install_smoke.sh
bash scripts/browser_smoke.sh
node --test tests/*.mjs

VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' folderview.plus.plg | head -n 1 || true)"
echo "Release prepared successfully: ${VERSION}"
