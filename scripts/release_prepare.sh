#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node
chmod +x \
  pkg_build.sh \
  scripts/build_release_notes.sh \
  scripts/doctor.sh \
  scripts/docs_metadata_guard.sh \
  scripts/ensure_plg_changes_entry.sh \
  scripts/release_guard.sh \
  scripts/install_smoke.sh \
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

bash pkg_build.sh --no-validate

bash scripts/ensure_plg_changes_entry.sh
FVPLUS_I18N_STRICT=1 \
FVPLUS_DEAD_CODE_STRICT=1 \
FVPLUS_REQUIRE_PERF_BASELINE=1 \
FVPLUS_UNRAID_MATRIX_REQUIRED="${FVPLUS_UNRAID_MATRIX_REQUIRED:-0}" \
bash scripts/run_ci_suite.sh

VERSION="$(sed -n 's/^<!ENTITY version "\([^"]*\)".*/\1/p' folderview.plus.plg | head -n 1 || true)"
echo "Release prepared successfully: ${VERSION}"
