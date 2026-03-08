#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_URL="${FVPLUS_BROWSER_SMOKE_URL:-}"

if [[ -z "${SMOKE_URL}" ]]; then
  echo "Skipping browser smoke checks (FVPLUS_BROWSER_SMOKE_URL not set)."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required for browser smoke checks." >&2
  exit 1
fi

echo "Running browser smoke checks against: ${SMOKE_URL}"
node "${ROOT_DIR}/scripts/browser_smoke.mjs"
