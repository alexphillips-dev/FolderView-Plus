import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pkgBuildPath = path.join(repoRoot, 'pkg_build.sh');
const releaseGuardPath = path.join(repoRoot, 'scripts/release_guard.sh');
const releasePreparePath = path.join(repoRoot, 'scripts/release_prepare.sh');
const ciWorkflowPath = path.join(repoRoot, '.github/workflows/ci.yml');
const releaseMainWorkflowPath = path.join(repoRoot, '.github/workflows/release-main.yml');
const releaseStableWorkflowPath = path.join(repoRoot, '.github/workflows/release-stable.yml');
const releaseBetaWorkflowPath = path.join(repoRoot, '.github/workflows/release-beta.yml');
const releaseOnMainWorkflowPath = path.join(repoRoot, '.github/workflows/release-on-main.yml');
const browserSmokeShellPath = path.join(repoRoot, 'scripts/browser_smoke.sh');
const browserSmokeNodePath = path.join(repoRoot, 'scripts/browser_smoke.mjs');
const installSmokePath = path.join(repoRoot, 'scripts/install_smoke.sh');
const apiContractGuardPath = path.join(repoRoot, 'scripts/api_contract_guard.sh');
const i18nGuardPath = path.join(repoRoot, 'scripts/i18n_guard.sh');
const langUsageGuardPath = path.join(repoRoot, 'scripts/lang_usage_guard.sh');
const themeScopeGuardPath = path.join(repoRoot, 'scripts/theme_scope_guard.sh');
const perfBudgetGuardPath = path.join(repoRoot, 'scripts/perf_budget_guard.sh');
const unraidMatrixSmokePath = path.join(repoRoot, 'scripts/unraid_matrix_smoke.sh');
const ensureChangesPath = path.join(repoRoot, 'scripts/ensure_plg_changes_entry.sh');
const doctorPath = path.join(repoRoot, 'scripts/doctor.sh');
const sharedLibPath = path.join(repoRoot, 'scripts/lib.sh');
const pkgBuild = fs.readFileSync(pkgBuildPath, 'utf8');
const releaseGuard = fs.readFileSync(releaseGuardPath, 'utf8');
const releasePrepare = fs.readFileSync(releasePreparePath, 'utf8');
const ciWorkflow = fs.readFileSync(ciWorkflowPath, 'utf8');
const releaseMainWorkflow = fs.readFileSync(releaseMainWorkflowPath, 'utf8');
const releaseStableWorkflow = fs.readFileSync(releaseStableWorkflowPath, 'utf8');
const releaseBetaWorkflow = fs.readFileSync(releaseBetaWorkflowPath, 'utf8');
const releaseOnMainWorkflow = fs.readFileSync(releaseOnMainWorkflowPath, 'utf8');
const browserSmokeShell = fs.readFileSync(browserSmokeShellPath, 'utf8');
const browserSmokeNode = fs.readFileSync(browserSmokeNodePath, 'utf8');
const installSmoke = fs.readFileSync(installSmokePath, 'utf8');
const apiContractGuard = fs.readFileSync(apiContractGuardPath, 'utf8');
const i18nGuard = fs.readFileSync(i18nGuardPath, 'utf8');
const langUsageGuard = fs.readFileSync(langUsageGuardPath, 'utf8');
const themeScopeGuard = fs.readFileSync(themeScopeGuardPath, 'utf8');
const perfBudgetGuard = fs.readFileSync(perfBudgetGuardPath, 'utf8');
const unraidMatrixSmoke = fs.readFileSync(unraidMatrixSmokePath, 'utf8');
const ensureChanges = fs.readFileSync(ensureChangesPath, 'utf8');
const doctorScript = fs.readFileSync(doctorPath, 'utf8');
const sharedLib = fs.readFileSync(sharedLibPath, 'utf8');

test('pkg_build computes stable versions per current date only', () => {
    assert.match(pkgBuild, /next_stable_version_for_date/);
    assert.match(pkgBuild, /highest_stable_archive_version_for_date/);
    assert.match(pkgBuild, /version="\$\(next_stable_version_for_date \"\$today_version\"\)"/);
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
    assert.doesNotMatch(pkgBuild, /rm -R "\$CWD\/tmp"/);
});

test('release_guard blocks future-dated versions', () => {
    assert.match(releaseGuard, /Version date \(\$\{VERSION_DATE\}\) is in the future/);
    assert.match(releaseGuard, /TODAY_DATE="\$\(date \+\"%Y\.%m\.%d\"\)"/);
});

test('release_guard enforces category-signaling changelog content for current version', () => {
    assert.match(releaseGuard, /CURRENT_CHANGES_BLOCK="\$\(awk -v version="\$\{VERSION\}"/);
    assert.match(releaseGuard, /CHANGES entry for \$\{VERSION\} is empty/);
    assert.match(releaseGuard, /lacks category-signaling keywords/);
    assert.match(releaseGuard, /feature\/fix\/security\/performance\/ui\/maintenance/);
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
});

test('browser smoke scripts are optional, URL-gated, and include core UI checks', () => {
    assert.match(browserSmokeShell, /FVPLUS_BROWSER_SMOKE_URL/);
    assert.match(browserSmokeShell, /Skipping browser smoke checks/);
    assert.match(browserSmokeShell, /node "\$\{ROOT_DIR\}\/scripts\/browser_smoke\.mjs"/);
    assert.match(browserSmokeNode, /playwright/);
    assert.match(browserSmokeNode, /#fv-settings-topbar/);
    assert.match(browserSmokeNode, /#fv-settings-action-bar/);
    assert.match(browserSmokeNode, /#import-preview-dialog/);
    assert.match(browserSmokeNode, /runBrowserSmoke\('chromium'/);
    assert.match(browserSmokeNode, /runBrowserSmoke\('firefox'/);
});

test('validation workflows include optional browser smoke integration', () => {
    for (const workflow of [ciWorkflow, releaseMainWorkflow, releaseStableWorkflow, releaseBetaWorkflow, releaseOnMainWorkflow]) {
        assert.match(workflow, /Standards guard checks/);
        assert.match(workflow, /bash scripts\/api_contract_guard\.sh/);
        assert.match(workflow, /bash scripts\/i18n_guard\.sh/);
        assert.match(workflow, /bash scripts\/lang_usage_guard\.sh/);
        assert.match(workflow, /bash scripts\/theme_scope_guard\.sh/);
        assert.match(workflow, /bash scripts\/perf_budget_guard\.sh/);
        assert.match(workflow, /bash scripts\/unraid_matrix_smoke\.sh/);
        assert.match(workflow, /Optional browser smoke checks/);
        assert.match(workflow, /FVPLUS_BROWSER_SMOKE_URL/);
        assert.match(workflow, /bash scripts\/browser_smoke\.sh/);
        assert.match(workflow, /actions\/upload-artifact@v4/);
    }
    assert.match(releasePrepare, /bash scripts\/api_contract_guard\.sh/);
    assert.match(releasePrepare, /bash scripts\/i18n_guard\.sh/);
    assert.match(releasePrepare, /bash scripts\/lang_usage_guard\.sh/);
    assert.match(releasePrepare, /bash scripts\/theme_scope_guard\.sh/);
    assert.match(releasePrepare, /bash scripts\/perf_budget_guard\.sh/);
    assert.match(releasePrepare, /bash scripts\/unraid_matrix_smoke\.sh/);
    assert.match(releasePrepare, /bash scripts\/browser_smoke\.sh/);
    assert.match(releasePrepare, /bash scripts\/doctor\.sh/);
    assert.match(releasePrepare, /bash pkg_build\.sh --no-validate/);
    assert.match(releasePrepare, /bash pkg_build\.sh --beta .* --no-validate/);
});

test('release workflows serialize concurrent runs with shared release concurrency group', () => {
    for (const workflow of [releaseMainWorkflow, releaseStableWorkflow, releaseBetaWorkflow, releaseOnMainWorkflow]) {
        assert.match(workflow, /concurrency:/);
        assert.match(workflow, /group:\s*folderview-plus-release/);
        assert.match(workflow, /cancel-in-progress:\s*false/);
    }
});

test('release-on-main workflow auto-publishes validated releases from current plg version', () => {
    assert.match(releaseOnMainWorkflow, /name:\s*Release On Main/);
    assert.match(releaseOnMainWorkflow, /push:\s*\n\s*branches:\s*\n\s*-\s*main/);
    assert.match(releaseOnMainWorkflow, /bash scripts\/release_guard\.sh/);
    assert.match(releaseOnMainWorkflow, /bash scripts\/install_smoke\.sh/);
    assert.match(releaseOnMainWorkflow, /node --test tests\/\*\.mjs/);
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

test('install smoke supports configurable archive directory override', () => {
    assert.match(installSmoke, /source "\$\{ROOT_DIR\}\/scripts\/lib\.sh"/);
    assert.match(installSmoke, /VERSION="\$\(fvplus::read_plg_version "\$\{PLG_FILE\}"\)"/);
    assert.match(installSmoke, /fvplus::require_commands php node tar sed grep find/);
    assert.match(installSmoke, /ARCHIVE_DIR="\$\{FVPLUS_ARCHIVE_DIR:-\$\{ROOT_DIR\}\/archive\}"/);
    assert.match(installSmoke, /ARCHIVE_FILE="\$\{ARCHIVE_DIR\}\/folderview\.plus-\$\{VERSION\}\.txz"/);
});

test('ensure changes entry seeds category-signaling release note text', () => {
    assert.match(ensureChanges, /source "\$\{ROOT_DIR\}\/scripts\/lib\.sh"/);
    assert.match(ensureChanges, /VERSION="\$\(fvplus::read_plg_version "\$\{PLG_FILE\}"\)"/);
    assert.match(ensureChanges, /Maintenance: automated release metadata update/);
});

test('release workflows keep checksum assets and metadata changes', () => {
    assert.match(releaseBetaWorkflow, /CHECKSUM="\$\{FILENAME\}\.sha256"/);
    assert.match(releaseBetaWorkflow, /git add archive\/ folderview\.plus\.plg folderview\.plus\.xml/);
    assert.match(releaseStableWorkflow, /CHECKSUM_FILENAME="\$\{FILENAME\}\.sha256"/);
    assert.match(releaseStableWorkflow, /archive\/\$\{\{ steps\.version\.outputs\.checksum_filename \}\}/);
});

test('CI includes shellcheck linting for repository shell scripts', () => {
    assert.match(ciWorkflow, /Install shellcheck/);
    assert.match(ciWorkflow, /Lint shell scripts/);
    assert.match(ciWorkflow, /shellcheck -x --source-path=SCRIPTDIR "\$f"/);
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

test('standards guard scripts exist with expected core checks', () => {
    assert.match(apiContractGuard, /API contract guard passed/);
    assert.match(apiContractGuard, /requireMutationRequestGuard/);
    assert.match(i18nGuard, /i18n guard passed/);
    assert.match(i18nGuard, /Missing base locale file/);
    assert.match(langUsageGuard, /Language usage guard passed/);
    assert.match(langUsageGuard, /data-i18n/);
    assert.match(themeScopeGuard, /Theme scope guard passed/);
    assert.match(themeScopeGuard, /#fv-settings-root/);
    assert.match(perfBudgetGuard, /Performance budget guard passed/);
    assert.match(perfBudgetGuard, /FVPLUS_MAX_FOLDERVIEWPLUS_JS_BYTES/);
    assert.match(unraidMatrixSmoke, /FVPLUS_UNRAID_MATRIX/);
    assert.match(unraidMatrixSmoke, /Skipping Unraid matrix smoke checks/);
});
