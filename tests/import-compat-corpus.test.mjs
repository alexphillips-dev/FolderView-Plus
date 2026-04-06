import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

const repoRoot = path.resolve(process.cwd());
const fixturesDir = path.join(repoRoot, 'tests/fixtures/imports');

const loadFixture = (filename) => {
    const raw = fs.readFileSync(path.join(fixturesDir, filename), 'utf8');
    return JSON.parse(raw);
};

test('import corpus: rejects schema payload with invalid type marker', () => {
    const parsed = utils.parseImportPayload(loadFixture('schema-invalid-type.json'), 'docker');
    assert.equal(parsed.ok, false);
    assert.match(parsed.error || '', /type .* invalid/i);
});

test('import corpus: rejects schema payload missing required type metadata', () => {
    const parsed = utils.parseImportPayload(loadFixture('schema-missing-type.json'), 'docker');
    assert.equal(parsed.ok, false);
    assert.match(parsed.error || '', /missing required type metadata/i);
});

test('import corpus: rejects schema payload when declared type mismatches expected type', () => {
    const parsed = utils.parseImportPayload(loadFixture('schema-type-mismatch.json'), 'docker');
    assert.equal(parsed.ok, false);
    assert.match(parsed.error || '', /does not match/i);
});

test('import corpus: rejects malformed single-folder schema payload', () => {
    const parsed = utils.parseImportPayload(loadFixture('schema-single-invalid-folder.json'), 'docker');
    assert.equal(parsed.ok, false);
    assert.match(parsed.error || '', /missing a valid folder object/i);
});

test('import corpus: legacy empty-object payload stays non-throwing and deterministic', () => {
    const parsed = utils.parseImportPayload(loadFixture('legacy-empty-object.json'), 'docker');
    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, true);
    assert.equal(parsed.mode, 'full');
    assert.deepEqual(parsed.folders, {});
});
