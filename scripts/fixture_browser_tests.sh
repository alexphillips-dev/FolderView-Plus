#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -d node_modules/playwright || ! -d node_modules/jquery ]]; then
  echo "ERROR: Browser fixture dependencies are not installed. Run npm ci first." >&2
  exit 1
fi

node scripts/fixture_browser_tests.mjs
