#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(rootDir, 'scripts/test_runner_contracts.json'), 'utf8'));
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const lineCount = (source) => String(source).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
const count = (source, pattern) => [...String(source).matchAll(pattern)].length;

assert.equal(contract.schemaVersion, 1, 'Unsupported test-runner contract schema.');
for (const entry of [...contract.entrypoints, ...contract.modules]) {
    const source = read(entry.file);
    assert.ok(lineCount(source) <= entry.limit, `${entry.file} exceeds its ${entry.limit}-line budget.`);
    if (Array.isArray(entry.history)) {
        assert.equal(entry.history.at(-1), entry.limit, `${entry.file} history must end at its current limit.`);
        assert.equal(entry.history.every((value, index, values) => index === 0 || value <= values[index - 1]), true,
            `${entry.file} history must be non-increasing.`);
    }
    for (const dependency of entry.requiredImports || []) {
        assert.match(source, new RegExp(`from ['\"]${dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]`),
            `${entry.file} must import ${dependency}.`);
    }
}

const fixture = contract.intent.fixture;
const fixtureCaseSource = fixture.files.map(read).join('\n');
const fixtureAllSource = [...fixture.supportFiles, ...fixture.files].map(read).join('\n');
const titles = [...fixtureCaseSource.matchAll(/^test\('([^']+)/gm)].map((match) => match[1]);
assert.equal(titles.length, fixture.testCount, 'Fixture test count changed.');
assert.equal(count(fixtureAllSource, /\bassert\./g), fixture.assertionCount, 'Fixture assertion count changed.');
assert.equal(count(fixtureAllSource, /\bpage\.evaluate/g), fixture.pageEvaluateCount, 'Fixture page-evaluate count changed.');
assert.equal(crypto.createHash('sha256').update(titles.join('\n')).digest('hex'), fixture.orderedTitleSha256,
    'Fixture test titles or execution order changed.');

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.scripts['test:browser-fixtures'], 'node scripts/fixture_browser_tests.mjs',
    'Fixture-browser package command changed.');
assert.match(read('scripts/fixture_browser_tests.sh'), /scripts\/fixture_browser_tests\.mjs/);
assert.match(read('scripts/browser_smoke.sh'), /scripts\/fixture_browser_tests\.sh/);
assert.match(read('scripts/theme_matrix_smoke.sh'), /scripts\/fixture_browser_tests\.sh/);

console.log(`Test runner contract guard passed: ${contract.entrypoints.length} entrypoints, ${contract.modules.length} modules, ${titles.length} ordered fixture cases.`);
