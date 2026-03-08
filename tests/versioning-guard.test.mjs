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
const browserSmokeShellPath = path.join(repoRoot, 'scripts/browser_smoke.sh');
const browserSmokeNodePath = path.join(repoRoot, 'scripts/browser_smoke.mjs');
const pkgBuild = fs.readFileSync(pkgBuildPath, 'utf8');
const releaseGuard = fs.readFileSync(releaseGuardPath, 'utf8');
const releasePrepare = fs.readFileSync(releasePreparePath, 'utf8');
const ciWorkflow = fs.readFileSync(ciWorkflowPath, 'utf8');
const releaseMainWorkflow = fs.readFileSync(releaseMainWorkflowPath, 'utf8');
const releaseStableWorkflow = fs.readFileSync(releaseStableWorkflowPath, 'utf8');
const releaseBetaWorkflow = fs.readFileSync(releaseBetaWorkflowPath, 'utf8');
const browserSmokeShell = fs.readFileSync(browserSmokeShellPath, 'utf8');
const browserSmokeNode = fs.readFileSync(browserSmokeNodePath, 'utf8');

test('pkg_build computes stable versions per current date only', () => {
    assert.match(pkgBuild, /next_stable_version_for_date/);
    assert.match(pkgBuild, /highest_stable_archive_version_for_date/);
    assert.match(pkgBuild, /version="\$\(next_stable_version_for_date \"\$today_version\"\)"/);
});

test('pkg_build blocks stable override dates that are not today', () => {
    assert.match(pkgBuild, /FVPLUS_VERSION_OVERRIDE for stable releases must use today's date/);
    assert.match(pkgBuild, /override_date="\$\(stable_date_part \"\$version_override\"\)"/);
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
    for (const workflow of [ciWorkflow, releaseMainWorkflow, releaseStableWorkflow, releaseBetaWorkflow]) {
        assert.match(workflow, /Optional browser smoke checks/);
        assert.match(workflow, /FVPLUS_BROWSER_SMOKE_URL/);
        assert.match(workflow, /bash scripts\/browser_smoke\.sh/);
    }
    assert.match(releasePrepare, /bash scripts\/browser_smoke\.sh/);
});
