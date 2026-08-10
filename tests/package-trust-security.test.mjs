import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const plg = read('folderview.plus.plg');
const pkgBuild = read('pkg_build.sh');
const releaseGuard = read('scripts/release_guard.sh');
const workflow = read('.github/workflows/release-on-main.yml');
const trustDoc = read('docs/security/PACKAGE_TRUST.md');
const entity = (name) => plg.match(new RegExp(`<!ENTITY ${name} "([^"]+)">`))?.[1] || '';

test('manifest and sidecar bind the current core package with SHA-256', () => {
    const version = entity('version');
    const expected = entity('sha256');
    const archiveName = `folderview.plus-${version}.txz`;
    const archive = fs.readFileSync(path.join(repoRoot, 'archive', archiveName));
    const actual = crypto.createHash('sha256').update(archive).digest('hex');
    assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(expected, actual);
    assert.equal(read(`archive/${archiveName}.sha256`), `${actual}  ${archiveName}\n`);
    assert.match(plg, /<SHA256>&sha256;<\/SHA256>/);
    assert.match(plg, /<SHA256>&iconPackSha256;<\/SHA256>/);
    assert.match(pkgBuild, /<!ENTITY sha256/);
    assert.match(releaseGuard, /package checksum sidecar does not exactly match/);
});

test('stable release publishes pinned provenance and SBOM attestations', () => {
    assert.match(workflow, /permissions:\s*\n\s*contents:\s*write\s*\n\s*id-token:\s*write\s*\n\s*attestations:\s*write/);
    const attestUses = workflow.match(/uses:\s*actions\/attest@[0-9a-f]{40}\s+# v4\.2\.0/g) || [];
    assert.equal(attestUses.length, 2);
    assert.match(workflow, /Attest release archive provenance[\s\S]*subject-path:[\s\S]*archive[\s\S]*checksum/);
    assert.match(workflow, /Attest release archive SBOM[\s\S]*sbom-path:\s*docs\/sbom\.cdx\.json/);
    assert.match(trustDoc, /gh attestation verify/);
    assert.match(trustDoc, /does not require the GitHub CLI/);
});
