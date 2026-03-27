#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

RELEASE_MODE=0
PLAYWRIGHT_READY=0
declare -a REQUESTED_LANES=()
declare -a TIMING_ROWS=()

usage() {
  cat <<'EOF'
Usage: run_ci_suite.sh [--release] [--lane <name>]...

Runs the shared lint/test/guard suite used by CI, release, and back-merge workflows.

Options:
  --release       Enforce required browser and theme smoke configuration.
  --lane <name>   Run only a specific lane. Supported lanes:
                  lint, tests, workflow-tests, guards, workflow-guards,
                  docs-guards, browser-smoke, theme-matrix
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
    --lane)
      REQUESTED_LANES+=("${2:-}")
      shift
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
  scripts/release_notes_consistency_guard.sh \
  scripts/repro_build_guard.sh \
  scripts/theme_matrix_smoke.sh \
  scripts/theme_runtime_guard.sh \
  scripts/theme_scope_guard.sh \
  scripts/unraid_matrix_smoke.sh \
  scripts/workflow_self_check.sh

run_timed_step() {
  local label="$1"
  shift
  local started_at
  started_at="$(date +%s)"
  "$@"
  local duration
  duration="$(( $(date +%s) - started_at ))"
  TIMING_ROWS+=("${label}|${duration}")
  printf '[ci-suite] %s completed in %ss\n' "${label}" "${duration}"
}

emit_timing_report() {
  local target_path="${FVPLUS_CI_TIMINGS_PATH:-}"
  local row=""
  if [[ -n "${target_path}" ]]; then
    mkdir -p "$(dirname "${target_path}")"
    {
      printf 'lane,duration_seconds\n'
      for row in "${TIMING_ROWS[@]}"; do
        printf '%s,%s\n' "${row%%|*}" "${row##*|}"
      done
    } > "${target_path}"
  fi
}

prepare_playwright() {
  if [[ "${PLAYWRIGHT_READY}" -eq 1 ]]; then
    return
  fi
  fvplus::require_commands npm npx
  npm install --no-save playwright

  local browsers_dir="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
  local browsers_cached=0
  if [[ -d "${browsers_dir}" ]] && find "${browsers_dir}" -mindepth 1 -maxdepth 1 -type d | read -r _; then
    browsers_cached=1
  fi

  if [[ "${browsers_cached}" -eq 1 ]] && parse_truthy "${FVPLUS_PLAYWRIGHT_SKIP_BROWSER_INSTALL_IF_CACHED:-1}"; then
    printf '[ci-suite] Playwright browsers already cached in %s, skipping browser install.\n' "${browsers_dir}"
  elif parse_truthy "${FVPLUS_PLAYWRIGHT_INSTALL_WITH_DEPS:-1}"; then
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

run_lane() {
  local lane="$1"
  case "${lane}" in
    lint)
      run_timed_step shellcheck lint_shell_scripts
      run_timed_step javascript-syntax lint_javascript_syntax
      run_timed_step php-syntax lint_php_syntax
      ;;
    tests)
      run_timed_step node-mobile-tests node --test tests/mobile-touch-support.test.mjs tests/mobile-regression-guard.test.mjs
      run_timed_step node-test-suite node --test tests/*.mjs
      ;;
    workflow-tests)
      run_timed_step versioning-guard-tests node --test tests/versioning-guard.test.mjs tests/support-policy-contract.test.mjs
      ;;
    workflow-guards)
      run_timed_step docs-metadata bash scripts/docs_metadata_guard.sh
      run_timed_step release-notes-consistency bash scripts/release_notes_consistency_guard.sh
      run_timed_step workflow-self-check bash scripts/workflow_self_check.sh
      ;;
    docs-guards)
      run_timed_step docs-metadata bash scripts/docs_metadata_guard.sh
      run_timed_step release-notes-consistency bash scripts/release_notes_consistency_guard.sh
      ;;
    guards)
      run_timed_step release-guard bash scripts/release_guard.sh
      run_timed_step install-smoke bash scripts/install_smoke.sh
      run_timed_step main-branch-history bash scripts/main_branch_history_guard.sh
      run_timed_step api-contract bash scripts/api_contract_guard.sh
      run_timed_step legacy-support bash scripts/legacy_support_guard.sh
      run_timed_step i18n-guard bash scripts/i18n_guard.sh
      run_timed_step lang-usage bash scripts/lang_usage_guard.sh
      run_timed_step include-order bash scripts/include_order_guard.sh
      run_timed_step theme-scope bash scripts/theme_scope_guard.sh
      run_timed_step theme-runtime bash scripts/theme_runtime_guard.sh
      run_timed_step dead-code bash scripts/dead_code_guard.sh
      run_timed_step perf-budget bash scripts/perf_budget_guard.sh
      run_timed_step repro-build bash scripts/repro_build_guard.sh
      run_timed_step unraid-matrix bash scripts/unraid_matrix_smoke.sh
      run_timed_step docs-metadata bash scripts/docs_metadata_guard.sh
      run_timed_step release-notes-consistency bash scripts/release_notes_consistency_guard.sh
      run_timed_step workflow-self-check bash scripts/workflow_self_check.sh
      ;;
    browser-smoke)
      run_timed_step browser-smoke run_browser_smoke_if_needed
      ;;
    theme-matrix)
      run_timed_step theme-matrix run_theme_matrix_if_needed
      ;;
    *)
      fvplus::fail "Unknown CI lane: ${lane}"
      ;;
  esac
}

if [[ "${#REQUESTED_LANES[@]}" -eq 0 ]]; then
  REQUESTED_LANES=(lint tests guards browser-smoke theme-matrix)
fi

for lane in "${REQUESTED_LANES[@]}"; do
  run_lane "${lane}"
done

emit_timing_report
echo "Shared CI suite passed."
