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
                  docs-guards, fixture-browser, browser-smoke, theme-matrix
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

fvplus::require_commands bash node php git find shellcheck npm npx
export FVPLUS_RELEASE_MODE="${RELEASE_MODE}"
export FVPLUS_UNRAID_MATRIX_REQUIRED="${FVPLUS_UNRAID_MATRIX_REQUIRED:-${RELEASE_MODE}}"
export FVPLUS_BROWSER_SMOKE_REQUIRED="${FVPLUS_BROWSER_SMOKE_REQUIRED:-${RELEASE_MODE}}"
export FVPLUS_THEME_MATRIX_REQUIRED="${FVPLUS_THEME_MATRIX_REQUIRED:-${RELEASE_MODE}}"
NODE_BIN="$(fvplus::resolve_platform_command node)"
PHP_BIN="$(fvplus::resolve_platform_command php)"
NPM_BIN="$(fvplus::resolve_platform_command npm)"
NPX_BIN="$(fvplus::resolve_platform_command npx)"

chmod +x \
  scripts/api_contract_guard.sh \
  scripts/browser_smoke.sh \
  scripts/dead_code_guard.sh \
  scripts/docs_metadata_guard.sh \
  scripts/fixture_browser_tests.sh \
  scripts/i18n_guard.sh \
  scripts/include_order_guard.sh \
  scripts/install_smoke.sh \
  scripts/lang_usage_guard.sh \
  scripts/legacy_support_guard.sh \
  scripts/main_branch_history_guard.sh \
  scripts/perf_budget_guard.sh \
  scripts/release_guard.sh \
  scripts/release_notes_consistency_guard.sh \
  scripts/runtime_performance_benchmarks.sh \
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
  "${NPM_BIN}" ci --ignore-scripts

  local browsers_dir="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
  local browser_cache_ready=0
  if [[ -d "${browsers_dir}" ]] && "${NODE_BIN}" -e "const fs=require('node:fs');const p=require('playwright');process.exit(['chromium','firefox','webkit'].every((name)=>fs.existsSync(p[name].executablePath()))?0:1)"; then
    browser_cache_ready=1
  fi

  if [[ "${browser_cache_ready}" -eq 1 ]] && parse_truthy "${FVPLUS_PLAYWRIGHT_SKIP_BROWSER_INSTALL_IF_CACHED:-1}"; then
    if [[ "${NODE_BIN}" != *.exe ]] && parse_truthy "${FVPLUS_PLAYWRIGHT_INSTALL_WITH_DEPS:-1}"; then
      "${NPX_BIN}" playwright install-deps chromium firefox webkit
    fi
    printf '[ci-suite] Matching Playwright browsers already cached in %s, skipping browser install.\n' "${browsers_dir}"
  elif parse_truthy "${FVPLUS_PLAYWRIGHT_INSTALL_WITH_DEPS:-1}"; then
    "${NPX_BIN}" playwright install --with-deps chromium firefox webkit
  else
    "${NPX_BIN}" playwright install chromium firefox webkit
  fi
  PLAYWRIGHT_READY=1
}

run_fixture_browser_tests() {
  prepare_playwright
  bash scripts/fixture_browser_tests.sh
  bash scripts/runtime_performance_benchmarks.sh
}

lint_shell_scripts() {
  mapfile -d '' files < <(git ls-files -z -- '*.sh' '.githooks/pre-push')
  local file=""
  for file in "${files[@]}"; do
    shellcheck -x --source-path=SCRIPTDIR "${file}"
  done
}

lint_javascript_syntax() {
  mapfile -d '' files < <(find src -type f -name "*.js" ! -path "*/scripts/include/*" -print0)
  local file=""
  local target=""
  for file in "${files[@]}"; do
    target="$(fvplus::path_for_command "${NODE_BIN}" "${file}")"
    "${NODE_BIN}" --check "${target}"
  done
}

lint_php_syntax() {
  mapfile -d '' files < <(find src -type f -name "*.php" -print0)
  local file=""
  local target=""
  for file in "${files[@]}"; do
    target="$(fvplus::path_for_command "${PHP_BIN}" "${file}")"
    "${PHP_BIN}" -l "${target}"
  done
}

run_browser_smoke_if_needed() {
  if parse_truthy "${FVPLUS_BROWSER_SMOKE_REQUIRED}" && [[ -z "${FVPLUS_BROWSER_SMOKE_URL:-}" ]]; then
    fvplus::fail "Browser smoke checks are required but FVPLUS_BROWSER_SMOKE_URL is not set."
  fi
  if [[ -n "${FVPLUS_BROWSER_SMOKE_URL:-}" ]] || parse_truthy "${FVPLUS_BROWSER_SMOKE_REQUIRED}"; then
    prepare_playwright
  fi
  bash scripts/browser_smoke.sh
}

run_theme_matrix_if_needed() {
  if parse_truthy "${FVPLUS_THEME_MATRIX_REQUIRED}" && [[ -z "${FVPLUS_THEME_MATRIX_URLS:-}" ]]; then
    fvplus::fail "Theme matrix smoke checks are required but FVPLUS_THEME_MATRIX_URLS is not set."
  fi
  if [[ -n "${FVPLUS_THEME_MATRIX_URLS:-}" ]] || parse_truthy "${FVPLUS_THEME_MATRIX_REQUIRED}"; then
    prepare_playwright
  fi
  bash scripts/theme_matrix_smoke.sh
}

run_lane() {
  local lane="$1"
  case "${lane}" in
    lint)
      run_timed_step settings-metadata-schema "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/generate_settings_metadata.mjs")" --check
      run_timed_step filter-view-settings-schema "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/generate_filter_view_registry.mjs")" --check
      run_timed_step filter-view-settings-contract "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/filter_view_settings_guard.mjs")"
      run_timed_step deprecation-contract "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/deprecation_guard.mjs")"
      run_timed_step architecture-contracts "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/architecture_contract_guard.mjs")"
      run_timed_step sbom "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/generate_sbom.mjs")" --check
      run_timed_step action-pins "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/action_pin_guard.mjs")"
      run_timed_step shellcheck lint_shell_scripts
      run_timed_step javascript-syntax lint_javascript_syntax
      run_timed_step php-syntax lint_php_syntax
      run_timed_step javascript-unused-symbols "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/js_unused_symbols_guard.mjs")"
      run_timed_step php-static-analysis "${PHP_BIN}" "$(fvplus::path_for_command "${PHP_BIN}" "scripts/php_unused_helpers_guard.php")"
      run_timed_step phpstan bash scripts/phpstan_guard.sh
      ;;
    tests)
      run_timed_step node-mobile-tests "${NODE_BIN}" --test tests/mobile-touch-support.test.mjs tests/mobile-regression-guard.test.mjs
      run_timed_step node-test-suite "${NODE_BIN}" --test tests/*.mjs
      run_timed_step javascript-coverage "${NPM_BIN}" run test:coverage
      ;;
    workflow-tests)
      run_timed_step versioning-guard-tests "${NODE_BIN}" --test tests/versioning-guard.test.mjs tests/support-policy-contract.test.mjs
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
      run_timed_step i18n-migration-budget "${NODE_BIN}" "$(fvplus::path_for_command "${NODE_BIN}" "scripts/i18n_migration_budget_guard.mjs")"
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
    fixture-browser)
      run_timed_step fixture-browser run_fixture_browser_tests
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
  REQUESTED_LANES=(lint tests guards fixture-browser browser-smoke theme-matrix)
fi

for lane in "${REQUESTED_LANES[@]}"; do
  run_lane "${lane}"
done

emit_timing_report
echo "Shared CI suite passed."
