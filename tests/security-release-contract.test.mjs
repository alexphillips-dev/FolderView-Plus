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
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /queries: security-extended,security-and-quality/);
    assert.equal((workflow.match(/github\/codeql-action\/(?:init|autobuild|analyze)@[0-9a-f]{40}\s+# v4/g) || []).length, 3);
    assert.match(workflow, /^permissions:\s*\n  actions:\s*read\s*\n  contents:\s*read\s*$/m);
    const analyzeJob = workflow.match(/^  analyze:\s*$([\s\S]*?)(?=^  [A-Za-z0-9_-]+:\s*$|(?![\s\S]))/m)?.[1] || '';
    assert.match(analyzeJob, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*security-events:\s*write/);
});

test('write-capable workflows keep top-level permissions read-only and scope writes to jobs', () => {
    const contracts = [
        {
            file: 'backmerge-main-to-dev.yml',
            job: 'backmerge',
            permissionPattern: /permissions:\s*\n\s*contents:\s*write\s*\n\s*pull-requests:\s*write/
        },
        {
            file: 'release-on-main.yml',
            job: 'release',
            permissionPattern: /permissions:\s*\n\s*contents:\s*write\s*\n\s*id-token:\s*write\s*\n\s*attestations:\s*write/
        },
        {
            file: 'clone-traffic-badge.yml',
            job: 'publish',
            permissionPattern: /permissions:\s*\n\s*contents:\s*write/
        }
    ];
    for (const contract of contracts) {
        const workflow = read(path.join('.github', 'workflows', contract.file));
        assert.match(workflow, /^permissions:\s*\n  contents:\s*read\s*$/m, contract.file);
        const job = workflow.match(new RegExp(`^  ${contract.job}:\\s*$([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:\\s*$|(?![\\s\\S]))`, 'm'))?.[1] || '';
        assert.match(job, contract.permissionPattern, contract.file);
    }
});

test('clone traffic credential is isolated from metrics branch publication', () => {
    const workflow = read('.github/workflows/clone-traffic-badge.yml');
    const collectJob = workflow.match(/^  collect:\s*$([\s\S]*?)(?=^  [A-Za-z0-9_-]+:\s*$|(?![\s\S]))/m)?.[1] || '';
    const publishJob = workflow.match(/^  publish:\s*$([\s\S]*?)(?=^  [A-Za-z0-9_-]+:\s*$|(?![\s\S]))/m)?.[1] || '';
    assert.match(collectJob, /secrets\.FVPLUS_TRAFFIC_TOKEN/);
    assert.doesNotMatch(collectJob, /github\.token/);
    assert.match(publishJob, /github\.token/);
    assert.doesNotMatch(publishJob, /secrets\.FVPLUS_TRAFFIC_TOKEN/);
    assert.match(publishJob, /needs:\s*collect/);
});

test('security policy links directly to private vulnerability reporting', () => {
    const policy = read('.github/SECURITY.md');
    const policyLines = new Set(policy.split(/\r?\n/));
    assert.ok(policyLines.has('[Report a vulnerability](https://github.com/alexphillips-dev/FolderView-Plus/security/advisories/new):'));
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

test('browser and theme validation are deterministic and never accept live Unraid targets', () => {
    const browser = read('scripts/browser_smoke.sh');
    const themes = read('scripts/theme_matrix_smoke.sh');
    const validationSources = [browser, themes, ...workflows.map(({ source }) => source)].join('\n');
    assert.match(browser, /deterministic browser smoke fixtures \(no live Unraid target\)/);
    assert.match(themes, /deterministic local theme and responsive fixture matrix/);
    assert.match(browser, /bash scripts\/fixture_browser_tests\.sh/);
    assert.match(themes, /bash scripts\/fixture_browser_tests\.sh/);
    assert.doesNotMatch(validationSources, /FVPLUS_UNRAID_MATRIX/);
    assert.doesNotMatch(validationSources, /FVPLUS_BROWSER_SMOKE_URL/);
    assert.doesNotMatch(validationSources, /FVPLUS_THEME_MATRIX_URLS/);
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

test('SBOM inventories nested GitHub Actions by repository and pinned revision', () => {
    const sbom = JSON.parse(read('docs/sbom.cdx.json'));
    const expectedActions = workflows.flatMap(({ source }) =>
        [...source.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/[A-Za-z0-9_.-]+)*@([0-9a-f]{40})/g)]
            .map(([, name, revision]) => `${name}@${revision}`)
    );
    const inventoriedActions = new Set(
        sbom.components
            .filter((component) => component.properties?.some(
                (property) => property.name === 'folderview-plus:usage'
                    && property.value === 'build-only-github-action'
            ))
            .map((component) => `${component.name}@${component.version}`)
    );

    assert.ok(expectedActions.some((action) => action.startsWith('github/codeql-action@')));
    for (const action of expectedActions) assert.ok(inventoriedActions.has(action), `Missing GitHub Action from SBOM: ${action}`);
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
