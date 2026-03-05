#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

chmod +x pkg_build.sh scripts/ensure_plg_changes_entry.sh scripts/release_guard.sh scripts/install_smoke.sh

if [[ "${1:-}" == "--beta" ]]; then
  if [[ -n "${2:-}" ]]; then
    bash pkg_build.sh --beta "${2}"
  else
    bash pkg_build.sh --beta
  fi
else
  bash pkg_build.sh
fi

bash scripts/ensure_plg_changes_entry.sh
bash scripts/release_guard.sh
bash scripts/install_smoke.sh
node --test tests/*.mjs

VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' folderview.plus.plg | head -n 1 || true)"
echo "Release prepared successfully: ${VERSION}"
