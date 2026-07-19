#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node awk sed grep mktemp

PUSH_MAIN=0
NOTES_OUTPUT=""

usage() {
  cat <<'EOF'
Usage: release_prepare.sh [options]
  --push-main          Commit and push the prepared stable release to main
  --notes-output FILE  Render release notes for the prepared version to FILE
  -h, --help           Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    --push-main)
      PUSH_MAIN=1
      ;;
    --notes-output)
      NOTES_OUTPUT="${2:-}"
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

chmod +x \
  pkg_build.sh \
  scripts/build_release_notes.sh \
  scripts/doctor.sh \
  scripts/docs_metadata_guard.sh \
  scripts/ensure_plg_changes_entry.sh \
  scripts/release_guard.sh \
  scripts/install_smoke.sh \
  scripts/fixture_browser_tests.sh \
  scripts/browser_smoke.sh \
  scripts/run_ci_suite.sh \
  scripts/api_contract_guard.sh \
  scripts/legacy_support_guard.sh \
  scripts/i18n_guard.sh \
  scripts/lang_usage_guard.sh \
  scripts/include_order_guard.sh \
  scripts/theme_scope_guard.sh \
  scripts/theme_runtime_guard.sh \
  scripts/dead_code_guard.sh \
  scripts/perf_baseline_refresh.sh \
  scripts/perf_budget_guard.sh \
  scripts/repro_build_guard.sh \
  scripts/prune_archives.sh \
  scripts/unraid_matrix_smoke.sh \
  scripts/theme_matrix_smoke.sh

bash scripts/doctor.sh

DRY_RUN_OUTPUT="$(bash pkg_build.sh --branch main --dry-run)"
RELEASE_VERSION="$(printf '%s\n' "${DRY_RUN_OUTPUT}" | sed -n 's/^Version: //p' | head -n 1 || true)"
if [[ -z "${RELEASE_VERSION}" ]]; then
  fvplus::fail "Could not resolve the next stable release version from pkg_build.sh --dry-run."
fi

FVPLUS_TARGET_RELEASE_VERSION="${RELEASE_VERSION}" \
FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES=1 \
bash scripts/ensure_plg_changes_entry.sh --check-only --require-explicit --version "${RELEASE_VERSION}"

FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES=1 \
bash pkg_build.sh --branch main --no-validate

FVPLUS_I18N_STRICT=1 \
FVPLUS_DEAD_CODE_STRICT=1 \
FVPLUS_REQUIRE_PERF_BASELINE=1 \
FVPLUS_REQUIRE_EXPLICIT_RELEASE_NOTES=1 \
FVPLUS_UNRAID_MATRIX_REQUIRED="${FVPLUS_UNRAID_MATRIX_REQUIRED:-0}" \
bash scripts/run_ci_suite.sh --release

FINAL_VERSION="$(fvplus::read_plg_version "${ROOT_DIR}/folderview.plus.plg")"

if [[ -n "${NOTES_OUTPUT}" ]]; then
  bash scripts/build_release_notes.sh --version "${FINAL_VERSION}" --output "${NOTES_OUTPUT}"
fi

if [[ "${PUSH_MAIN}" == "1" ]]; then
  git add -A
  if git diff --cached --quiet; then
    echo "No release file changes to commit."
  else
    git commit -m "Stable release ${FINAL_VERSION}"
  fi
  git push origin main
fi

echo "Release prepared successfully: ${FINAL_VERSION}"
