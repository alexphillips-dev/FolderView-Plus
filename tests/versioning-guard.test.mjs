import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pkgBuildPath = path.join(repoRoot, 'pkg_build.sh');
const releaseGuardPath = path.join(repoRoot, 'scripts/release_guard.sh');
const pkgBuild = fs.readFileSync(pkgBuildPath, 'utf8');
const releaseGuard = fs.readFileSync(releaseGuardPath, 'utf8');

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
