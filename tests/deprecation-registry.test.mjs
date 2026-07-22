import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd());
const registryPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/schemas/deprecations.schema.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

test('deprecation registry enforces compatibility and removed-token contracts', () => {
    assert.ok(registry.minimumStableReleasesBeforeRemoval >= 2);
    assert.ok(registry.entries.some((entry) => entry.id === 'prefs.performanceMode' && entry.status === 'compatibility'));
    assert.ok(registry.entries.some((entry) => entry.id === 'folder.regex' && entry.status === 'deprecated'));
    assert.ok(registry.entries.some((entry) => entry.id === 'health.compact' && entry.status === 'removed'));
    const result = spawnSync(process.execPath, ['scripts/deprecation_guard.mjs'], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
});
