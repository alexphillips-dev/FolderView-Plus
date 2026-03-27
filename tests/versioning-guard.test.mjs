import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pkgBuildPath = path.join(repoRoot, 'pkg_build.sh');
const stableTemplatePath = path.join(repoRoot, 'folderview.plus.xml');
const releaseGuardPath = path.join(repoRoot, 'scripts/release_guard.sh');
const releasePreparePath = path.join(repoRoot, 'scripts/release_prepare.sh');
const ciWorkflowPath = path.join(repoRoot, '.github/workflows/ci.yml');
const backmergeWorkflowPath = path.join(repoRoot, '.github/workflows/backmerge-main-to-dev.yml');
const releaseMainWorkflowPath = path.join(repoRoot, '.github/workflows/release-main.yml');
const releaseOnMainWorkflowPath = path.join(repoRoot, '.github/workflows/release-on-main.yml');
const setupCiEnvActionPath = path.join(repoRoot, '.github/actions/setup-ci-env/action.yml');
const browserSmokeShellPath = path.join(repoRoot, 'scripts/browser_smoke.sh');
const browserSmokeNodePath = path.join(repoRoot, 'scripts/browser_smoke.mjs');
const applyBranchProtectionPath = path.join(repoRoot, 'scripts/apply_branch_protection.sh');
const buildReleaseNotesPath = path.join(repoRoot, 'scripts/build_release_notes.sh');
const docsMetadataGuardPath = path.join(repoRoot, 'scripts/docs_metadata_guard.sh');
const remotePublishGuardPath = path.join(repoRoot, 'scripts/remote_publish_guard.sh');
const releaseNotesConsistencyGuardPath = path.join(repoRoot, 'scripts/release_notes_consistency_guard.sh');
const runCiSuitePath = path.join(repoRoot, 'scripts/run_ci_suite.sh');
const themeMatrixSmokeShellPath = path.join(repoRoot, 'scripts/theme_matrix_smoke.sh');
const themeMatrixSmokeNodePath = path.join(repoRoot, 'scripts/theme_matrix_smoke.mjs');
const installSmokePath = path.join(repoRoot, 'scripts/install_smoke.sh');
const apiContractGuardPath = path.join(repoRoot, 'scripts/api_contract_guard.sh');
const legacySupportGuardPath = path.join(repoRoot, 'scripts/legacy_support_guard.sh');
const i18nGuardPath = path.join(repoRoot, 'scripts/i18n_guard.sh');
const langUsageGuardPath = path.join(repoRoot, 'scripts/lang_usage_guard.sh');
const themeScopeGuardPath = path.join(repoRoot, 'scripts/theme_scope_guard.sh');
const themeRuntimeGuardPath = path.join(repoRoot, 'scripts/theme_runtime_guard.sh');
const perfBudgetGuardPath = path.join(repoRoot, 'scripts/perf_budget_guard.sh');
const reproBuildGuardPath = path.join(repoRoot, 'scripts/repro_build_guard.sh');
const mainBranchHistoryGuardPath = path.join(repoRoot, 'scripts/main_branch_history_guard.sh');
const pruneArchivesPath = path.join(repoRoot, 'scripts/prune_archives.sh');
const unraidMatrixSmokePath = path.join(repoRoot, 'scripts/unraid_matrix_smoke.sh');
const ensureChangesPath = path.join(repoRoot, 'scripts/ensure_plg_changes_entry.sh');
const doctorPath = path.join(repoRoot, 'scripts/doctor.sh');
const sharedLibPath = path.join(repoRoot, 'scripts/lib.sh');
const perfBaselinePath = path.join(repoRoot, 'scripts/perf_baseline.json');
const pkgBuild = fs.readFileSync(pkgBuildPath, 'utf8');
const stableTemplate = fs.readFileSync(stableTemplatePath, 'utf8');
const releaseGuard = fs.readFileSync(releaseGuardPath, 'utf8');
const releasePrepare = fs.readFileSync(releasePreparePath, 'utf8');
const ciWorkflow = fs.readFileSync(ciWorkflowPath, 'utf8');
const backmergeWorkflow = fs.readFileSync(backmergeWorkflowPath, 'utf8');
const releaseMainWorkflow = fs.readFileSync(releaseMainWorkflowPath, 'utf8');
const releaseOnMainWorkflow = fs.readFileSync(releaseOnMainWorkflowPath, 'utf8');
const browserSmokeShell = fs.readFileSync(browserSmokeShellPath, 'utf8');
const browserSmokeNode = fs.readFileSync(browserSmokeNodePath, 'utf8');
const buildReleaseNotes = fs.readFileSync(buildReleaseNotesPath, 'utf8');
const setupCiEnvAction = fs.readFileSync(setupCiEnvActionPath, 'utf8');
const applyBranchProtection = fs.readFileSync(applyBranchProtectionPath, 'utf8');
const docsMetadataGuard = fs.readFileSync(docsMetadataGuardPath, 'utf8');
const remotePublishGuard = fs.readFileSync(remotePublishGuardPath, 'utf8');
const releaseNotesConsistencyGuard = fs.readFileSync(releaseNotesConsistencyGuardPath, 'utf8');
const runCiSuite = fs.readFileSync(runCiSuitePath, 'utf8');
const workflowSelfCheck = fs.readFileSync(path.join(repoRoot, 'scripts/workflow_self_check.sh'), 'utf8');
const themeMatrixSmokeShell = fs.readFileSync(themeMatrixSmokeShellPath, 'utf8');
const themeMatrixSmokeNode = fs.readFileSync(themeMatrixSmokeNodePath, 'utf8');
const installSmoke = fs.readFileSync(installSmokePath, 'utf8');
const apiContractGuard = fs.readFileSync(apiContractGuardPath, 'utf8');
const legacySupportGuard = fs.readFileSync(legacySupportGuardPath, 'utf8');
const i18nGuard = fs.readFileSync(i18nGuardPath, 'utf8');
const langUsageGuard = fs.readFileSync(langUsageGuardPath, 'utf8');
const themeScopeGuard = fs.readFileSync(themeScopeGuardPath, 'utf8');
const themeRuntimeGuard = fs.readFileSync(themeRuntimeGuardPath, 'utf8');
const perfBudgetGuard = fs.readFileSync(perfBudgetGuardPath, 'utf8');
const reproBuildGuard = fs.readFileSync(reproBuildGuardPath, 'utf8');
const mainBranchHistoryGuard = fs.readFileSync(mainBranchHistoryGuardPath, 'utf8');
const pruneArchives = fs.readFileSync(pruneArchivesPath, 'utf8');
const unraidMatrixSmoke = fs.readFileSync(unraidMatrixSmokePath, 'utf8');
const ensureChanges = fs.readFileSync(ensureChangesPath, 'utf8');
const doctorScript = fs.readFileSync(doctorPath, 'utf8');
const sharedLib = fs.readFileSync(sharedLibPath, 'utf8');
const perfBaseline = JSON.parse(fs.readFileSync(perfBaselinePath, 'utf8'));

test('pkg_build computes stable versions per current date only', () => {
    assert.match(pkgBuild, /next_stable_version_for_date/);
    assert.match(pkgBuild, /highest_stable_archive_version_for_date/);
    assert.match(pkgBuild, /version="\$\(next_stable_version_for_date \"\$today_version\"\)"/);
    assert.match(pkgBuild, /sync_ca_template_metadata/);
});

test('channel metadata remains main/dev only', () => {
    assert.match(stableTemplate, /<PluginURL>https:\/\/raw\.githubusercontent\.com\/alexphillips-dev\/FolderView-Plus\/(main|dev)\/folderview\.plus\.plg<\/PluginURL>/);
    assert.match(stableTemplate, /<Beta>False<\/Beta>/);
    assert.doesNotMatch(pkgBuild, /folderview\.plus\.beta\.xml/);
    assert.doesNotMatch(releaseGuard, /BETA_CA_TEMPLATE_FILE/);
    assert.doesNotMatch(releaseGuard, /Beta CA template/);
});

test('pkg_build blocks stable override dates that are not today', () => {
    assert.match(pkgBuild, /FVPLUS_VERSION_OVERRIDE for stable releases must use today's date/);
    assert.match(pkgBuild, /override_date="\$\(stable_date_part \"\$version_override\"\)"/);
});

test('pkg_build includes dependency preflight, safe temp cleanup, dry-run, and checksum outputs', () => {
    assert.match(pkgBuild, /require_commands tar sha256sum md5sum sed find date awk grep cp chmod mkdir rm mktemp sort tail/);
    assert.match(pkgBuild, /tmpdir="\$\(mktemp -d \"\$CWD\/tmp\/build\.XXXXXX\"\)"/);
    assert.match(pkgBuild, /trap cleanup_tmpdir EXIT/);
    assert.match(pkgBuild, /ensure_repo_layout/);
    assert.match(pkgBuild, /acquire_build_lock/);
    assert.match(pkgBuild, /flock -n 9/);
    assert.match(pkgBuild, /--output-dir D/);
    assert.match(pkgBuild, /--keep-archives N/);
    assert.match(pkgBuild, /--no-prune-archives/);
    assert.match(pkgBuild, /archive_prune_keep_raw="\$\{FVPLUS_ARCHIVE_PRUNE_KEEP:-24\}"/);
    assert.match(pkgBuild, /Archive retention keep count: \$archive_prune_keep/);
    assert.match(pkgBuild, /bash "\$prune_archives_script" --archive-dir "\$archive_dir" --keep "\$archive_prune_keep" --current-version "\$version"/);
    assert.match(pkgBuild, /--install-smoke/);
    assert.match(pkgBuild, /--dry-run/);
    assert.match(pkgBuild, /Post-build validation: \$validate_after_build/);
    assert.match(pkgBuild, /Install smoke: \$run_install_smoke/);
    assert.match(pkgBuild, /--sort=name/);
    assert.match(pkgBuild, /--mtime='UTC 1970-01-01'/);
    assert.match(pkgBuild, /FVPLUS_ARCHIVE_DIR="\$archive_dir" bash "\$release_guard_script"/);
    assert.match(pkgBuild, /bash "\$install_smoke_script"/);
    assert.match(pkgBuild, /sha256=\$\(sha256sum "\$filename" \| awk '\{print \$1\}'\)/);
    assert.match(pkgBuild, /printf '%s  %s\\n' "\$sha256" "\$\(basename "\$filename"\)" > "\$sha256_file"/);
    assert.match(pkgBuild, /\^<!ENTITY pluginURL ".*">/);
    assert.match(pkgBuild, /<URL>https:\/\/raw\.githubusercontent\.com\/\.\*\?\/archive\/\.\*<\/URL>/);
    assert.match(pkgBuild, /rewrite_manifest_branch_metadata/);
    assert.match(pkgBuild, /validate_manifest_branch_matrix/);
    assert.match(pkgBuild, /expected_entity_url="https:\/\/raw\.githubusercontent\.com\/&github;\/\$\{branch_name\}\/folderview\.plus\.plg"/);
    assert.match(pkgBuild, /expected_archive_url="https:\/\/raw\.githubusercontent\.com\/&github;\/\$\{branch_name\}\/archive\/&name;-&version;\.txz"/);
    assert.match(pkgBuild, /canonical entity form/);
    assert.doesNotMatch(pkgBuild, /rm -R "\$CWD\/tmp"/);
});

test('archive pruning script keeps newest versions and preserves current release artifacts', () => {
    assert.match(pruneArchives, /Usage: prune_archives\.sh/);
    assert.match(pruneArchives, /--keep N/);
    assert.match(pruneArchives, /--current-version VER/);
    assert.match(pruneArchives, /FVPLUS_ARCHIVE_PRUNE_KEEP:-24/);
    assert.match(pruneArchives, /CURRENT_VERSION="\$\(fvplus::read_plg_version "\$\{ROOT_DIR\}\/folderview\.plus\.plg"\)"/);
    assert.match(pruneArchives, /folderview\.plus-\*\.txz/);
    assert.match(pruneArchives, /sort -Vu/);
    assert.match(pruneArchives, /Archive prune complete:/);
});

test('release_guard blocks future-dated versions', () => {
    assert.match(releaseGuard, /Version date \(\$\{VERSION_DATE\}\) is in the future/);
    assert.match(releaseGuard, /TODAY_DATE="\$\(date \+\"%Y\.%m\.%d\"\)"/);
});

test('release_guard enforces explicit changelog category contract for current version', () => {
    assert.match(releaseGuard, /CURRENT_CHANGES_BLOCK="\$\(awk -v version="\$\{VERSION\}"/);
    assert.match(releaseGuard, /CHANGES entry for \$\{VERSION\} is empty/);
    assert.match(releaseGuard, /CURRENT_CHANGES_CATEGORIES/);
    assert.match(releaseGuard, /must include at least one category-formatted bullet/);
    assert.match(releaseGuard, /is_allowed_changes_category/);
    assert.match(releaseGuard, /is_metadata_only_changes_line/);
    assert.match(releaseGuard, /METADATA_DRIFT_LINES/);
    assert.match(releaseGuard, /contains release-metadata boilerplate lines/);
    assert.match(releaseGuard, /duplicates the previous release notes block/);
    assert.match(releaseGuard, /contains only release-metadata boilerplate notes/);
    assert.match(releaseGuard, /Allowed categories: Feature, Fix, Security, Performance, UX, UI\/UX, Maintenance, Docs, Test, Quality, Regression guard, Compatibility, Refactor/);
});

test('release_guard enforces archive size, file-count, and extension policy', () => {
    assert.match(releaseGuard, /ARCHIVE_DIR="\$\{FVPLUS_ARCHIVE_DIR:-\$\{ROOT_DIR\}\/archive\}"/);
    assert.match(releaseGuard, /MAX_ARCHIVE_BYTES="\$\{FVPLUS_MAX_ARCHIVE_BYTES:-52428800\}"/);
    assert.match(releaseGuard, /MAX_ARCHIVE_FILE_COUNT="\$\{FVPLUS_MAX_ARCHIVE_FILE_COUNT:-10000\}"/);
    assert.match(releaseGuard, /Archive exceeds size budget/);
    assert.match(releaseGuard, /Archive file count exceeds budget/);
    assert.match(releaseGuard, /DANGEROUS_ARCHIVE_EXTENSIONS='exe\|dll\|bat\|cmd/);
    assert.match(releaseGuard, /ALLOWED_ARCHIVE_EXTENSIONS='page\|php\|js\|css/);
    assert.match(releaseGuard, /contains blocked executable\/binary artifacts/);
    assert.match(releaseGuard, /contains files with unexpected extensions/);
});

test('release_guard checks debug flags and mutation endpoint guards', () => {
    assert.match(releaseGuard, /FV3_DEBUG_MODE must be false for release builds/);
    assert.match(releaseGuard, /FOLDER_VIEW_DEBUG_MODE is enabled in docker\.js/);
    assert.match(releaseGuard, /VM_DEBUG_MODE is enabled in vm\.js/);
    assert.match(releaseGuard, /DASHBOARD_DEBUG_MODE is enabled in dashboard\.js/);
    assert.match(releaseGuard, /READ_ONLY_ENDPOINTS=\(/);
    assert.match(releaseGuard, /requireMutationRequestGuard\(\)/);
    assert.match(releaseGuard, /Mutating endpoint is missing requireMutationRequestGuard/);
});

test('release_guard checks target blank and update-notes release contract', () => {
    assert.match(releaseGuard, /target=\\"_blank\\" without rel=\\"noopener noreferrer\\"/);
    assert.match(releaseGuard, /window\.open\(\.\.\., '_blank', \.\.\.\) calls without noopener/);
    assert.match(releaseGuard, /update_notes\.php must use readCurrentVersionChangeSummary/);
    assert.match(releaseGuard, /update_notes\.php must return lines payload/);
    assert.match(releaseGuard, /update_notes\.php must return category payload/);
    assert.match(releaseGuard, /update_notes\.php must return headline payload/);
    assert.match(releaseGuard, /lib\.php must define classifyChangesCategory/);
    assert.match(releaseGuard, /lib\.php must define readCurrentVersionChangeSummary/);
    assert.match(releaseGuard, /must disable fallback so \\\"What Changed\\\" only shows current-version notes/);
});

test('remote publish guard validates raw manifest, archive, and checksum after push', () => {
    assert.match(remotePublishGuard, /FVPLUS_REMOTE_PUBLISH_ATTEMPTS/);
    assert.match(remotePublishGuard, /FVPLUS_REMOTE_PUBLISH_DELAY_SEC/);
    assert.match(remotePublishGuard, /mkdir -p "\$\{TMP_BASE_DIR\}"/);
    assert.match(remotePublishGuard, /TMP_DIR="\$\(mktemp -d "\$\{TMP_BASE_DIR\}\/remote-publish\.XXXXXX"\)"/);
    assert.match(remotePublishGuard, /expand_manifest_url/);
    assert.match(remotePublishGuard, /plugin manifest/);
    assert.match(remotePublishGuard, /archive checksum/);
    assert.match(remotePublishGuard, /curl -fsSL/);
    assert.match(remotePublishGuard, /curl -fsSI -L/);
    assert.match(remotePublishGuard, /Remote manifest version mismatch/);
    assert.match(remotePublishGuard, /Remote checksum mismatch/);
    assert.match(remotePublishGuard, /remote raw manifest, archive, and checksum match/);
});

test('browser smoke scripts require folder editor coverage and include real editor interaction smoke', () => {
    assert.match(browserSmokeShell, /FVPLUS_BROWSER_SMOKE_URL/);
    assert.match(browserSmokeShell, /FVPLUS_BROWSER_SMOKE_REQUIRED/);
    assert.match(browserSmokeShell, /SMOKE_REQUIRED=1/);
    assert.match(browserSmokeShell, /Browser smoke checks are required but FVPLUS_BROWSER_SMOKE_URL is not set/);
    assert.match(browserSmokeShell, /Skipping browser smoke checks/);
    assert.match(browserSmokeShell, /node "\$\{ROOT_DIR\}\/scripts\/browser_smoke\.mjs"/);
    assert.match(browserSmokeNode, /playwright/);
    assert.match(browserSmokeNode, /#fv-settings-topbar/);
    assert.match(browserSmokeNode, /#fv-settings-search/);
    assert.match(browserSmokeNode, /#import-preview-dialog/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_REQUIRE_FOLDER_EDITOR/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_DOCKER_URL/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_VM_URL/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_DASHBOARD_URL/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_ARTIFACT_DIR/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_REQUIRE_RUNTIME_ROWS/);
    assert.match(browserSmokeNode, /FVPLUS_BROWSER_SMOKE_RUNTIME_GAP_MAX/);
    assert.match(browserSmokeNode, /resolveDashboardUrl/);
    assert.match(browserSmokeNode, /runRuntimeLayoutSmoke/);
    assert.match(browserSmokeNode, /runDashboardQuickRailSmoke/);
    assert.match(browserSmokeNode, /waitForFolderEditorReady/);
    assert.match(browserSmokeNode, /cleanupSmokeFolder/);
    assert.match(browserSmokeNode, /runFolderEditorInteractionSmoke/);
    assert.match(browserSmokeNode, /selectedMembers/);
    assert.match(browserSmokeNode, /previewOrder/);
    assert.match(browserSmokeNode, /savedActionName/);
    assert.match(browserSmokeNode, /Folder editor interaction smoke failed/);
    assert.match(browserSmokeNode, /Cleanup:/);
    assert.match(browserSmokeNode, /interactionReport/);
    assert.match(browserSmokeNode, /Browser smoke dialog accepted/);
    assert.match(browserSmokeNode, /page\.screenshot\(\{ path: screenshotPath, fullPage: true \}\)/);
    assert.match(browserSmokeNode, /runBrowserSmoke\('chromium'/);
    assert.match(browserSmokeNode, /runBrowserSmoke\('firefox'/);
    assert.match(browserSmokeNode, /runBrowserSmoke\('webkit'/);
});

test('theme matrix smoke scripts are optional, URL-gated, and include wizard/theme checks', () => {
    assert.match(themeMatrixSmokeShell, /FVPLUS_THEME_MATRIX_URLS/);
    assert.match(themeMatrixSmokeShell, /FVPLUS_THEME_MATRIX_REQUIRED/);
    assert.match(themeMatrixSmokeShell, /Theme matrix smoke checks are required but FVPLUS_THEME_MATRIX_URLS is not set/);
    assert.match(themeMatrixSmokeShell, /Skipping theme matrix smoke checks/);
    assert.match(themeMatrixSmokeShell, /node "\$\{ROOT_DIR\}\/scripts\/theme_matrix_smoke\.mjs"/);
    assert.match(themeMatrixSmokeNode, /playwright/);
    assert.match(themeMatrixSmokeNode, /FVPLUS_THEME_REQUIRED_LABELS/);
    assert.match(themeMatrixSmokeNode, /Theme matrix is missing required label\(s\)/);
    assert.match(themeMatrixSmokeNode, /FVPLUS_THEME_SMOKE_BROWSERS/);
    assert.match(themeMatrixSmokeNode, /FVPLUS_THEME_SMOKE_ZOOMS/);
    assert.match(themeMatrixSmokeNode, /FVPLUS_THEME_SMOKE_ARTIFACT_DIR/);
    assert.match(themeMatrixSmokeNode, /resolveRuntimeUrl/);
    assert.match(themeMatrixSmokeNode, /resolveDashboardUrl/);
    assert.match(themeMatrixSmokeNode, /runSettingsSurfaceChecks/);
    assert.match(themeMatrixSmokeNode, /runRuntimeThemeChecks/);
    assert.match(themeMatrixSmokeNode, /captureScenarioScreenshot/);
    assert.match(themeMatrixSmokeNode, /page\.screenshot\(\{ path: screenshotPath, fullPage: true \}\)/);
    assert.match(themeMatrixSmokeNode, /h2\[data-fv-section="docker"\]/);
    assert.match(themeMatrixSmokeNode, /h2\[data-fv-section="vms"\]/);
    assert.match(themeMatrixSmokeNode, /tbody#docker/);
    assert.match(themeMatrixSmokeNode, /tbody#vms/);
    assert.match(themeMatrixSmokeNode, /tbody#docker_view/);
    assert.match(themeMatrixSmokeNode, /tbody#vm_view/);
    assert.match(themeMatrixSmokeNode, /#fv-run-wizard/);
    assert.match(themeMatrixSmokeNode, /#fv-setup-assistant-dialog/);
    assert.match(themeMatrixSmokeNode, /button\.folder-dropdown/);
    assert.match(themeMatrixSmokeNode, /fv-dashboard-layout-inline-host/);
    assert.match(themeMatrixSmokeNode, /stage: `\$\{target\.type\}-runtime`/);
    assert.match(themeMatrixSmokeNode, /Focus-visible ring is not present/);
    assert.match(themeMatrixSmokeNode, /horizontal overflow/);
    assert.match(themeMatrixSmokeNode, /screenshot=/);
});

test('shared ci suite centralizes linting, tests, guards, docs metadata, and smoke flows', () => {
    assert.match(runCiSuite, /Usage: run_ci_suite\.sh/);
    assert.match(runCiSuite, /--release/);
    assert.match(runCiSuite, /--lane <name>/);
    assert.match(runCiSuite, /workflow-tests/);
    assert.match(runCiSuite, /workflow-guards/);
    assert.match(runCiSuite, /docs-guards/);
    assert.match(runCiSuite, /shellcheck -x --source-path=SCRIPTDIR/);
    assert.match(runCiSuite, /node --check/);
    assert.match(runCiSuite, /php -l/);
    assert.match(runCiSuite, /node --test tests\/mobile-touch-support\.test\.mjs tests\/mobile-regression-guard\.test\.mjs/);
    assert.match(runCiSuite, /node --test tests\/\*\.mjs/);
    assert.match(runCiSuite, /node --test tests\/versioning-guard\.test\.mjs tests\/support-policy-contract\.test\.mjs/);
    assert.match(runCiSuite, /bash scripts\/release_guard\.sh/);
    assert.match(runCiSuite, /bash scripts\/install_smoke\.sh/);
    assert.match(runCiSuite, /bash scripts\/main_branch_history_guard\.sh/);
    assert.match(runCiSuite, /bash scripts\/docs_metadata_guard\.sh/);
    assert.match(runCiSuite, /bash scripts\/release_notes_consistency_guard\.sh/);
    assert.match(runCiSuite, /bash scripts\/workflow_self_check\.sh/);
    assert.match(runCiSuite, /bash scripts\/browser_smoke\.sh/);
    assert.match(runCiSuite, /bash scripts\/theme_matrix_smoke\.sh/);
    assert.match(runCiSuite, /npm install --no-save playwright/);
    assert.match(runCiSuite, /FVPLUS_PLAYWRIGHT_SKIP_BROWSER_INSTALL_IF_CACHED/);
    assert.match(runCiSuite, /Playwright browsers already cached/);
    assert.match(runCiSuite, /npx playwright install --with-deps chromium firefox webkit/);
    assert.match(runCiSuite, /FVPLUS_BROWSER_SMOKE_REQUIRED/);
    assert.match(runCiSuite, /FVPLUS_THEME_MATRIX_REQUIRED/);
    assert.match(runCiSuite, /FVPLUS_CI_TIMINGS_PATH/);
});

test('validation workflows delegate to the shared ci suite with dev coverage, fast lanes, caches, and release smoke enforcement', () => {
    assert.match(ciWorkflow, /push:\s*\n\s*branches:\s*\n\s*-\s*main\s*\n\s*-\s*dev\s*\n\s*-\s*reset-main/);
    assert.match(ciWorkflow, /detect-changes:/);
    assert.match(ciWorkflow, /dorny\/paths-filter@v3/);
    assert.match(ciWorkflow, /workflow_only/);
    assert.match(ciWorkflow, /docs_only/);
    assert.match(ciWorkflow, /needs_browser/);
    assert.match(ciWorkflow, /needs_theme/);
    assert.match(ciWorkflow, /lint-and-syntax:/);
    assert.match(ciWorkflow, /node-tests:/);
    assert.match(ciWorkflow, /guard-suite:/);
    assert.match(ciWorkflow, /browser-smoke:/);
    assert.match(ciWorkflow, /theme-matrix:/);
    assert.match(ciWorkflow, /release-preview:/);
    assert.match(ciWorkflow, /quality:/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane lint/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane tests/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane workflow-tests/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane guards/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane workflow-guards/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane docs-guards/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane browser-smoke/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane theme-matrix/);
    assert.match(ciWorkflow, /dev-release-preview/);
    assert.match(ciWorkflow, /ci-duration-report/);
    assert.match(ciWorkflow, /actions\/upload-artifact@v4/);
    assert.match(ciWorkflow, /tmp\/browser-smoke-artifacts/);
    assert.match(ciWorkflow, /uses:\s*\.\/\.github\/actions\/setup-ci-env/);

    for (const workflow of [releaseMainWorkflow, releaseOnMainWorkflow]) {
        assert.match(workflow, /Setup CI environment/);
        assert.match(workflow, /uses:\s*\.\/\.github\/actions\/setup-ci-env/);
        assert.match(workflow, /Run release validation suite/);
        assert.match(workflow, /bash scripts\/run_ci_suite\.sh --release/);
        assert.match(workflow, /FVPLUS_BROWSER_SMOKE_REQUIRED:\s*'1'/);
        assert.match(workflow, /FVPLUS_THEME_MATRIX_REQUIRED:\s*'1'/);
        assert.match(workflow, /FVPLUS_BROWSER_SMOKE_REQUIRE_FOLDER_EDITOR:\s*'1'/);
        assert.match(workflow, /FVPLUS_THEME_REQUIRED_LABELS:\s*'black,white'/);
    }

    assert.match(backmergeWorkflow, /Validate merged dev state before push/);
    assert.match(backmergeWorkflow, /bash scripts\/run_ci_suite\.sh/);
    assert.match(backmergeWorkflow, /Setup CI environment/);
    assert.match(backmergeWorkflow, /uses:\s*\.\/\.github\/actions\/setup-ci-env/);
    assert.match(backmergeWorkflow, /FVPLUS_BROWSER_SMOKE_REQUIRED:\s*'0'/);
    assert.match(backmergeWorkflow, /FVPLUS_THEME_MATRIX_REQUIRED:\s*'0'/);
    assert.match(backmergeWorkflow, /Upload back-merge debug artifacts on failure/);

    assert.match(releasePrepare, /bash scripts\/doctor\.sh/);
    assert.match(releasePrepare, /bash pkg_build\.sh --no-validate/);
    assert.match(releasePrepare, /bash scripts\/run_ci_suite\.sh/);
    assert.doesNotMatch(releasePrepare, /--beta/);
});

test('release-on-main validates remote raw publish artifacts before publishing releases', () => {
    assert.match(releaseOnMainWorkflow, /Detect release artifact changes/);
    assert.match(releaseOnMainWorkflow, /should_publish/);
    assert.match(releaseOnMainWorkflow, /Skip release publish for non-release main pushes/);
    assert.match(releaseOnMainWorkflow, /Validate remote raw publish artifacts/);
    assert.match(releaseOnMainWorkflow, /FVPLUS_REMOTE_PUBLISH_ATTEMPTS:\s*'30'/);
    assert.match(releaseOnMainWorkflow, /FVPLUS_REMOTE_PUBLISH_DELAY_SEC:\s*'10'/);
    assert.match(releaseOnMainWorkflow, /bash scripts\/remote_publish_guard\.sh/);
    assert.doesNotMatch(releaseMainWorkflow, /bash scripts\/remote_publish_guard\.sh/);
});

test('release workflows serialize concurrent runs with shared release concurrency group', () => {
    for (const workflow of [releaseMainWorkflow, releaseOnMainWorkflow]) {
        assert.match(workflow, /concurrency:/);
        assert.match(workflow, /group:\s*folderview-plus-release/);
        assert.match(workflow, /cancel-in-progress:\s*false/);
        assert.match(workflow, /FVPLUS_UNRAID_MATRIX_REQUIRED:\s*(?:'1'|\$\{\{[^}]+\}\})/);
        assert.match(workflow, /FVPLUS_UNRAID_REQUIRED_VERSIONS:\s*'7\.0\.x,7\.1\.x,7\.2\.x'/);
        assert.match(workflow, /FVPLUS_UNRAID_REQUIRED_THEMES:\s*'black,white'/);
    }
});

test('release workflows avoid failing when no files changed for commit step', () => {
    for (const workflow of [releaseMainWorkflow]) {
        assert.match(workflow, /git diff --cached --quiet/);
        assert.match(workflow, /No release file changes to commit/);
    }
});

test('release-main builds and pushes main while release-on-main owns publishing and notes generation', () => {
    assert.match(releaseMainWorkflow, /Push main/);
    assert.doesNotMatch(releaseMainWorkflow, /softprops\/action-gh-release/);
    assert.doesNotMatch(releaseMainWorkflow, /Create GitHub Release/);
    assert.match(releaseOnMainWorkflow, /Create or update GitHub release/);
    assert.match(releaseOnMainWorkflow, /bash scripts\/build_release_notes\.sh --version "\$\{VERSION\}" --output release_notes\.md/);
});

test('release-on-main workflow auto-publishes validated releases from current plg version', () => {
    assert.match(releaseOnMainWorkflow, /name:\s*Release On Main/);
    assert.match(releaseOnMainWorkflow, /push:\s*\n\s*branches:\s*\n\s*-\s*main/);
    assert.match(releaseOnMainWorkflow, /bash scripts\/run_ci_suite\.sh --release/);
    assert.match(releaseOnMainWorkflow, /release_notes\.md/);
    assert.match(releaseOnMainWorkflow, /folderview\.plus\.plg/);
    assert.match(releaseOnMainWorkflow, /archive\/folderview\.plus-\$\{VERSION\}\.txz/);
    assert.match(releaseOnMainWorkflow, /CHECKSUM="\$\{ARCHIVE\}\.sha256"/);
    assert.match(releaseOnMainWorkflow, /sha256sum "\$\{ARCHIVE\}"/);
    assert.match(releaseOnMainWorkflow, /Generated missing checksum/);
    assert.match(releaseOnMainWorkflow, /gh release create/);
    assert.match(releaseOnMainWorkflow, /gh release edit/);
    assert.match(releaseOnMainWorkflow, /gh release upload "\$\{TAG\}" "\$\{ARCHIVE\}" "\$\{CHECKSUM\}" --clobber/);
    assert.match(releaseOnMainWorkflow, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
});

test('back-merge workflow validates merged dev state before pushing', () => {
    assert.match(backmergeWorkflow, /name:\s*Back-Merge Main To Dev/);
    assert.match(backmergeWorkflow, /Setup CI environment/);
    assert.match(backmergeWorkflow, /Sync main into dev/);
    assert.match(backmergeWorkflow, /Validate merged dev state before push/);
    assert.match(backmergeWorkflow, /Push dev when updated/);
    assert.match(backmergeWorkflow, /Collect back-merge debug artifacts on failure/);
    assert.match(backmergeWorkflow, /Upload back-merge debug artifacts on failure/);
});

test('install smoke supports configurable archive directory override', () => {
    assert.match(installSmoke, /source "\$\{ROOT_DIR\}\/scripts\/lib\.sh"/);
    assert.match(installSmoke, /VERSION="\$\(fvplus::read_plg_version "\$\{PLG_FILE\}"\)"/);
    assert.match(installSmoke, /fvplus::require_commands php node tar sed grep find/);
    assert.match(installSmoke, /ARCHIVE_DIR="\$\{FVPLUS_ARCHIVE_DIR:-\$\{ROOT_DIR\}\/archive\}"/);
    assert.match(installSmoke, /ARCHIVE_FILE="\$\{ARCHIVE_DIR\}\/folderview\.plus-\$\{VERSION\}\.txz"/);
    assert.match(installSmoke, /scripts\/folderviewplus\.dirty\.js/);
});

test('ensure changes entry seeds category-signaling release note text', () => {
    assert.match(ensureChanges, /source "\$\{ROOT_DIR\}\/scripts\/lib\.sh"/);
    assert.match(ensureChanges, /VERSION="\$\(fvplus::read_plg_version "\$\{PLG_FILE\}"\)"/);
    assert.match(ensureChanges, /guess_category_from_subject/);
    assert.match(ensureChanges, /is_subject_metadata_only/);
    assert.match(ensureChanges, /build_diff_based_notes/);
    assert.match(ensureChanges, /git -C "\$\{ROOT_DIR\}" diff --name-only --relative HEAD -- \./);
    assert.match(ensureChanges, /log --no-merges --format=%H -S "###\$\{previous_version\}" -- "\$\{PLG_FILE\}"/);
    assert.match(ensureChanges, /range="\$\{anchor_ref\}\.\.HEAD"/);
    assert.match(ensureChanges, /AUTO_FALLBACK_NOTE='Maintenance: Release metadata and packaging sync\.'/);
});

test('release workflows keep checksum assets and metadata changes', () => {
    assert.match(releaseOnMainWorkflow, /CHECKSUM="\$\{ARCHIVE\}\.sha256"/);
    assert.match(releaseOnMainWorkflow, /gh release upload "\$\{TAG\}" "\$\{ARCHIVE\}" "\$\{CHECKSUM\}" --clobber/);
});

test('CI includes shellcheck linting for repository shell scripts', () => {
    assert.match(setupCiEnvAction, /Restore npm cache/);
    assert.match(setupCiEnvAction, /Restore Playwright browser cache/);
    assert.match(setupCiEnvAction, /Install shellcheck/);
    assert.match(ciWorkflow, /bash scripts\/run_ci_suite\.sh --lane lint/);
    assert.match(runCiSuite, /shellcheck -x --source-path=SCRIPTDIR "\$\{file\}"/);
});

test('shared script library and doctor preflight exist with required helpers', () => {
    assert.match(sharedLib, /fvplus::require_commands/);
    assert.match(sharedLib, /fvplus::read_plg_version/);
    assert.match(sharedLib, /fvplus::archive_file/);
    assert.match(doctorScript, /source "\$\{ROOT_DIR\}\/scripts\/lib\.sh"/);
    assert.match(doctorScript, /REQUIRED_COMMANDS=\(/);
    assert.match(doctorScript, /gh/);
    assert.match(doctorScript, /Tooling doctor passed/);
});

test('docs metadata guard keeps readme and packaged descriptions aligned', () => {
    assert.match(docsMetadataGuard, /Packaged README fallback text must match langs\/en\.json folderviewplus-desc/);
    assert.match(docsMetadataGuard, /README\.md is missing required current-state phrase/);
    assert.match(docsMetadataGuard, /folderview\.plus\.xml description is missing expected phrase/);
    assert.match(docsMetadataGuard, /Docs metadata guard passed/);
    assert.match(buildReleaseNotes, /Missing CHANGES block for version/);
    assert.match(buildReleaseNotes, /Install URL: \\`https:\/\/raw\.githubusercontent\.com\/alexphillips-dev\/FolderView-Plus\/\$\{INSTALL_BRANCH\}\/folderview\.plus\.plg\\`/);
    assert.match(buildReleaseNotes, /### Changes/);
    assert.match(releaseNotesConsistencyGuard, /Release notes consistency guard passed/);
    assert.match(releaseNotesConsistencyGuard, /build_release_notes\.sh --version/);
    assert.match(releaseNotesConsistencyGuard, /Release On Main workflow is not using scripts\/build_release_notes\.sh/);
    assert.match(workflowSelfCheck, /Workflow self-check passed/);
    assert.match(workflowSelfCheck, /change-aware fast lanes/);
    assert.match(workflowSelfCheck, /dev release preview artifact/);
    assert.match(workflowSelfCheck, /CI duration report artifact/);
});

test('standards guard scripts exist with expected core checks', () => {
    assert.match(apiContractGuard, /API contract guard passed/);
    assert.match(apiContractGuard, /requireMutationRequestGuard/);
    assert.match(legacySupportGuard, /Legacy support guard passed/);
    assert.match(legacySupportGuard, /folder\.view2/);
    assert.match(legacySupportGuard, /folder\.view3/);
    assert.match(i18nGuard, /i18n guard passed/);
    assert.match(i18nGuard, /Missing base locale file/);
    assert.match(langUsageGuard, /Language usage guard passed/);
    assert.match(langUsageGuard, /data-i18n/);
    assert.match(themeScopeGuard, /Theme scope guard passed/);
    assert.match(themeScopeGuard, /#fv-settings-root/);
    assert.match(themeRuntimeGuard, /Theme runtime guard passed/);
    assert.match(themeRuntimeGuard, /docker inline status color painting/);
    assert.match(themeRuntimeGuard, /scripts loader path boundary check/);
    assert.match(perfBudgetGuard, /Performance budget guard passed/);
    assert.match(perfBudgetGuard, /FVPLUS_MAX_FOLDERVIEWPLUS_JS_BYTES/);
    assert.match(perfBudgetGuard, /FVPLUS_PERF_BASELINE_FILE/);
    assert.match(perfBudgetGuard, /FVPLUS_MAX_BUDGET_GROWTH_PCT/);
    assert.match(perfBudgetGuard, /FVPLUS_REQUIRE_PERF_BASELINE/);
    assert.match(reproBuildGuard, /Deterministic build guard passed/);
    assert.match(reproBuildGuard, /FVPLUS_REPRO_VERSION_OVERRIDE/);
    assert.match(reproBuildGuard, /FVPLUS_REPRO_ALLOW_STALE_STABLE/);
    assert.match(mainBranchHistoryGuard, /Main branch history guard skipped/);
    assert.match(mainBranchHistoryGuard, /FVPLUS_MAIN_HISTORY_BASE_REF/);
    assert.match(mainBranchHistoryGuard, /@\{upstream\}\.\.HEAD/);
    assert.match(mainBranchHistoryGuard, /merge_commit_allowed/);
    assert.match(mainBranchHistoryGuard, /Merge\\ pull\\ request\\ #\[0-9\]\+/);
    assert.match(mainBranchHistoryGuard, /main-branch merge commits must promote only dev history/);
    assert.match(mainBranchHistoryGuard, /Main branch history guard passed/);
    assert.match(unraidMatrixSmoke, /FVPLUS_UNRAID_MATRIX/);
    assert.match(unraidMatrixSmoke, /Skipping Unraid matrix smoke checks/);
    assert.match(unraidMatrixSmoke, /FVPLUS_UNRAID_MATRIX_REQUIRED/);
    assert.match(unraidMatrixSmoke, /FVPLUS_UNRAID_REQUIRED_VERSIONS/);
    assert.match(unraidMatrixSmoke, /FVPLUS_UNRAID_REQUIRED_THEMES/);
    assert.match(unraidMatrixSmoke, /<version>\\|<theme>\\|<url>/);
    assert.match(unraidMatrixSmoke, /FVPLUS_UNRAID_VERSION_HINT/);
    assert.match(unraidMatrixSmoke, /FVPLUS_THEME_HINT/);
    assert.match(docsMetadataGuard, /folderviewplus-desc/);
    assert.match(setupCiEnvAction, /Setup CI Environment/);
    assert.match(setupCiEnvAction, /actions\/cache@v4/);
    assert.match(applyBranchProtection, /branches\/main\/protection/);
    assert.match(applyBranchProtection, /branches\/dev\/protection/);
    assert.match(applyBranchProtection, /Analyze \(JavaScript\)/);
    assert.match(applyBranchProtection, /"quality"/);
    assert.match(applyBranchProtection, /Applied branch protection for main and dev/);
});

test('performance baseline contract file exists and includes tracked asset metrics', () => {
    assert.equal(typeof perfBaseline, 'object');
    assert.equal(perfBaseline.version, 1);
    assert.equal(typeof perfBaseline.assets, 'object');
    assert.equal(typeof perfBaseline.totals, 'object');
    for (const key of [
        'scripts/folderviewplus.js',
        'styles/folderviewplus.css',
        'scripts/docker.js',
        'scripts/vm.js',
        'scripts/folder.js'
    ]) {
        assert.equal(typeof perfBaseline.assets[key], 'object');
        assert.equal(typeof perfBaseline.assets[key].bytes, 'number');
        assert.equal(typeof perfBaseline.assets[key].gzipBytes, 'number');
    }
});
