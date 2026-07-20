#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"
FIXTURE_SCRIPT="$(fvplus::path_for_command "${NODE_BIN}" "${ROOT_DIR}/scripts/fixture_browser_tests.mjs")"

if [[ ! -d node_modules/playwright || ! -d node_modules/jquery ]]; then
  echo "ERROR: Browser fixture dependencies are not installed. Run npm ci first." >&2
  exit 1
fi

"${NODE_BIN}" "${FIXTURE_SCRIPT}"
