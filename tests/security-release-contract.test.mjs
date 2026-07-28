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
