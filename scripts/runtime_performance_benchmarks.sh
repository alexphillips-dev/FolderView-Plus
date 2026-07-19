#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -d node_modules/playwright ]]; then
  echo "ERROR: Runtime benchmark dependencies are not installed. Run npm ci first." >&2
  exit 1
fi

node scripts/runtime_performance_benchmarks.mjs "$@"
