#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

export FVPLUS_FIXTURE_BROWSERS="${FVPLUS_BROWSER_SMOKE_BROWSERS:-chromium}"
export FVPLUS_FIXTURE_COLOR_SCHEMES="${FVPLUS_BROWSER_SMOKE_COLOR_SCHEMES:-dark}"
export FVPLUS_FIXTURE_VIEWPORTS="${FVPLUS_BROWSER_SMOKE_VIEWPORTS:-1180x720}"
export FVPLUS_FIXTURE_BROWSER_ARTIFACT_DIR="${FVPLUS_BROWSER_SMOKE_ARTIFACT_DIR:-${ROOT_DIR}/tmp/browser-smoke-artifacts}"

echo "Running deterministic browser smoke fixtures (no live Unraid target)."
bash scripts/fixture_browser_tests.sh
