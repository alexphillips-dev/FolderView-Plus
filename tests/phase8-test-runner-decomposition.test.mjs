import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const contract = JSON.parse(read('scripts/test_runner_contracts.json'));

test('Phase 8 keeps public test commands behind thin runner entrypoints', () => {
    const packageJson = JSON.parse(read('package.json'));
    assert.equal(packageJson.scripts['test:browser-fixtures'], 'node scripts/fixture_browser_tests.mjs');
    assert.deepEqual(contract.entrypoints.map((entry) => entry.file), ['scripts/fixture_browser_tests.mjs']);
    assert.ok(contract.entrypoints.every((entry) => entry.limit < 500));
});

test('Phase 8 runner contract preserves deterministic fixture intent inventory', () => {
    const output = execFileSync(process.execPath, ['scripts/test_runner_contract_guard.mjs'], {
        cwd: rootDir,
        encoding: 'utf8'
    });
    assert.match(output, /50 ordered fixture cases/);
    assert.equal(contract.intent.fixture.assertionCount, 619);
});

test('Phase 8 change classification covers every extracted runner family', async () => {
    const { classifyPaths } = await import('../scripts/classify_ci_changes.mjs');
    assert.equal(classifyPaths(['scripts/lib/fixture-browser-runner.mjs']).outputs.needs_browser, true);
    assert.equal(classifyPaths(['tests/browser/cases/docker.mjs']).outputs.needs_browser, true);
    assert.equal(classifyPaths(['tests/browser/cases/settings.mjs']).outputs.needs_theme, true);
    const contractChange = classifyPaths(['scripts/test_runner_contracts.json']);
    assert.equal(contractChange.outputs.needs_browser, true);
    assert.equal(contractChange.outputs.needs_theme, true);
});

test('Phase 8 test harnesses keep runtime cleanup inside temporary directories', () => {
    const securityHarness = read('tests/security-update-3.test.mjs');
    assert.doesNotMatch(securityHarness, /FVPLUS_TEST_SOURCE_DIR: pluginRoot/);
    assert.equal((securityHarness.match(/FVPLUS_TEST_SOURCE_DIR: path\.join\(temp, 'runtime'\)/g) || []).length, 3);
});
