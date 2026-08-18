#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

export FVPLUS_FIXTURE_BROWSERS="${FVPLUS_THEME_SMOKE_BROWSERS:-chromium,firefox,webkit}"
export FVPLUS_FIXTURE_COLOR_SCHEMES="${FVPLUS_THEME_COLOR_SCHEMES:-light,dark}"
export FVPLUS_FIXTURE_VIEWPORTS="${FVPLUS_THEME_VIEWPORTS:-1180x720,390x844}"
export FVPLUS_FIXTURE_BROWSER_ARTIFACT_DIR="${FVPLUS_THEME_SMOKE_ARTIFACT_DIR:-${ROOT_DIR}/tmp/browser-smoke-artifacts/theme-matrix}"

echo "Running deterministic local theme and responsive fixture matrix."
bash scripts/fixture_browser_tests.sh
