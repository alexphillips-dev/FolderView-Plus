#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"
GUARD_PATH="$(fvplus::path_for_command "${NODE_BIN}" "${ROOT_DIR}/scripts/api_contract_guard.mjs")"
"${NODE_BIN}" "${GUARD_PATH}"
