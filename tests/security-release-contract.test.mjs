import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const workflows = fs.readdirSync(path.join(root, '.github', 'workflows'))
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => ({ name, source: read(path.join('.github', 'workflows', name)) }));

test('CodeQL scans dev and main for pushes and pull requests', () => {
    const workflow = read('.github/workflows/codeql.yml');
    assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*- main/);
    assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*- main/);
    assert.match(workflow, /queries: security-extended,security-and-quality/);
    assert.equal((workflow.match(/github\/codeql-action\/(?:init|autobuild|analyze)@[0-9a-f]{40}\s+# v4/g) || []).length, 3);
});

test('dependency review blocks vulnerable or unapproved dependency changes', () => {
    const workflow = read('.github/workflows/dependency-review.yml');
    assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*- main/);
    assert.match(workflow, /actions\/dependency-review-action@[0-9a-f]{40}\s+# v5/);
    assert.match(workflow, /fail-on-severity: high/);
    assert.match(workflow, /license-check: true/);
    assert.match(workflow, /allow-licenses: Apache-2\.0, BSD-3-Clause, BlueOak-1\.0\.0, ISC, MIT, MPL-2\.0/);
    assert.match(workflow, /warn-only: false/);
});

test('OpenSSF Scorecard publishes pinned SARIF results on a schedule', () => {
    const workflow = read('.github/workflows/scorecard.yml');
    assert.match(workflow, /schedule:/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /ossf\/scorecard-action@[0-9a-f]{40}\s+# v2\.4\.4/);
    assert.match(workflow, /github\/codeql-action\/upload-sarif@[0-9a-f]{40}\s+# v4/);
    assert.match(workflow, /publish_results: true/);
    assert.match(workflow, /security-events: write/);
    assert.match(workflow, /id-token: write/);
});

test('workflows never upload live Unraid browser evidence', () => {
    for (const workflow of workflows) {
        const uploadBlocks = workflow.source.split(/\n(?=\s{6}- name:|\s{4}- name:)/)
            .filter((block) => block.includes('actions/upload-artifact@'));
        for (const block of uploadBlocks) {
            assert.doesNotMatch(block, /browser-smoke-artifacts|scheduled-live-unraid|ci-browser-smoke|ci-theme-matrix/, workflow.name);
        }
    }
});

test('live browser evidence is opt-in and reports are not written by default', () => {
    const browser = read('scripts/browser_smoke.mjs');
    const themes = read('scripts/theme_matrix_smoke.mjs');
    assert.match(browser, /FVPLUS_BROWSER_SMOKE_CAPTURE_LIVE_ARTIFACTS/);
    assert.match(browser, /if \(captureLiveArtifacts\) \{\s*const reportPath/);
    assert.match(browser, /Runtime visual target configured:/);
    assert.doesNotMatch(browser, /Runtime visual target: \$\{entry\.type\} -> \$\{entry\.url\}/);
    assert.match(themes, /FVPLUS_THEME_SMOKE_CAPTURE_LIVE_ARTIFACTS/);
    assert.match(themes, /if \(!captureLiveArtifacts\) \{\s*return '';/);
});

test('runtime component inventory covers every shipped include file', () => {
    const inventory = JSON.parse(read('scripts/runtime_components.json'));
    const includeRoot = path.join(
        root,
        'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/include'
    );
    const expected = fs.readdirSync(includeRoot)
        .filter((name) => fs.statSync(path.join(includeRoot, name)).isFile())
        .map((name) => path.relative(root, path.join(includeRoot, name)).replaceAll('\\', '/'))
        .sort();
    const classified = [
        ...inventory.firstPartyFiles,
        ...inventory.components.flatMap((component) => component.files)
    ];
    assert.deepEqual([...new Set(classified)].sort(), expected);
    assert.ok(inventory.components.every((component) => component.license && component.source && component.files.length > 0));
    assert.ok(inventory.hostProvidedComponents.length >= 4);
});

test('SBOM purl normalization replaces every encoded scope marker', () => {
    const generator = read('scripts/generate_sbom.mjs');
    assert.match(generator, /encodeURIComponent\(name\)\.replaceAll\('%40', '@'\)/);
    assert.doesNotMatch(generator, /encodeURIComponent\(name\)\.replace\('%40', '@'\)/);
});

test('CycloneDX SBOM has a deterministic SHA-256 UUIDv8 serial accepted by the attestation action', () => {
    const sbom = JSON.parse(read('docs/sbom.cdx.json'));
    assert.equal(sbom.bomFormat, 'CycloneDX');
    assert.match(sbom.specVersion, /^1\.[0-9]+$/);
    assert.match(
        sbom.serialNumber,
        /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    assert.match(read('scripts/generate_sbom.mjs'), /folderview-plus:\$\{version\}/);
});
