#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"

fvplus::require_commands node
NODE_BIN="$(fvplus::resolve_platform_command node)"

"${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "${ROOT_DIR}/scripts/include_order_guard.mjs")"
