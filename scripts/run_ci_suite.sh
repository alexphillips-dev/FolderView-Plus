#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

RELEASE_MODE=0
PLAYWRIGHT_READY=0

usage() {
  cat <<'EOF'
Usage: run_ci_suite.sh [--release]

Runs the shared lint/test/guard suite used by CI, release, and back-merge workflows.

Options:
  --release   Enforce required browser and theme smoke configuration.
EOF
}

parse_truthy() {
  case "$(printf '%s' "${1:-0}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "${1}" in
    --release)
      RELEASE_MODE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fvplus::fail "Unknown argument: ${1}"
      ;;
  esac
  shift
done

fvplus::require_commands bash node php git find shellcheck

chmod +x \
  scripts/api_contract_guard.sh \
  scripts/browser_smoke.sh \
  scripts/dead_code_guard.sh \
  scripts/docs_metadata_guard.sh \
  scripts/i18n_guard.sh \
  scripts/include_order_guard.sh \
  scripts/install_smoke.sh \
  scripts/lang_usage_guard.sh \
  scripts/legacy_support_guard.sh \
  scripts/main_branch_history_guard.sh \
  scripts/perf_budget_guard.sh \
  scripts/release_guard.sh \
  scripts/repro_build_guard.sh \
  scripts/theme_matrix_smoke.sh \
  scripts/theme_runtime_guard.sh \
  scripts/theme_scope_guard.sh \
  scripts/unraid_matrix_smoke.sh

prepare_playwright() {
  if [[ "${PLAYWRIGHT_READY}" -eq 1 ]]; then
    return
  fi
  fvplus::require_commands npm npx
  npm install --no-save playwright
  if parse_truthy "${FVPLUS_PLAYWRIGHT_INSTALL_WITH_DEPS:-1}"; then
    npx playwright install --with-deps chromium firefox webkit
  else
    npx playwright install chromium firefox webkit
  fi
  PLAYWRIGHT_READY=1
}

lint_shell_scripts() {
  mapfile -d '' files < <(find . -type f \( -name "*.sh" -o -path "./.githooks/pre-push" \) -print0)
  local file=""
  for file in "${files[@]}"; do
    shellcheck -x --source-path=SCRIPTDIR "${file}"
  done
}

lint_javascript_syntax() {
  mapfile -d '' files < <(find src -type f -name "*.js" ! -path "*/scripts/include/*" -print0)
  local file=""
  for file in "${files[@]}"; do
    node --check "${file}"
  done
}

lint_php_syntax() {
  mapfile -d '' files < <(find src -type f -name "*.php" -print0)
  local file=""
  for file in "${files[@]}"; do
    php -l "${file}"
  done
}

run_browser_smoke_if_needed() {
  local default_required="0"
  if [[ "${RELEASE_MODE}" -eq 1 ]]; then
    default_required="1"
  fi
  export FVPLUS_BROWSER_SMOKE_REQUIRED="${FVPLUS_BROWSER_SMOKE_REQUIRED:-${default_required}}"
  if [[ -n "${FVPLUS_BROWSER_SMOKE_URL:-}" ]] || parse_truthy "${FVPLUS_BROWSER_SMOKE_REQUIRED}"; then
    prepare_playwright
  fi
  bash scripts/browser_smoke.sh
}

run_theme_matrix_if_needed() {
  local default_required="0"
  if [[ "${RELEASE_MODE}" -eq 1 ]]; then
    default_required="1"
  fi
  export FVPLUS_THEME_MATRIX_REQUIRED="${FVPLUS_THEME_MATRIX_REQUIRED:-${default_required}}"
  if [[ -n "${FVPLUS_THEME_MATRIX_URLS:-}" ]] || parse_truthy "${FVPLUS_THEME_MATRIX_REQUIRED}"; then
    prepare_playwright
  fi
  bash scripts/theme_matrix_smoke.sh
}

lint_shell_scripts
lint_javascript_syntax
lint_php_syntax

node --test tests/mobile-touch-support.test.mjs tests/mobile-regression-guard.test.mjs
node --test tests/*.mjs

bash scripts/release_guard.sh
bash scripts/install_smoke.sh

bash scripts/main_branch_history_guard.sh
bash scripts/api_contract_guard.sh
bash scripts/legacy_support_guard.sh
bash scripts/i18n_guard.sh
bash scripts/lang_usage_guard.sh
bash scripts/include_order_guard.sh
bash scripts/theme_scope_guard.sh
bash scripts/theme_runtime_guard.sh
bash scripts/dead_code_guard.sh
bash scripts/perf_budget_guard.sh
bash scripts/repro_build_guard.sh
bash scripts/unraid_matrix_smoke.sh
bash scripts/docs_metadata_guard.sh

run_browser_smoke_if_needed
run_theme_matrix_if_needed

echo "Shared CI suite passed."
