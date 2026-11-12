import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
function run(mode) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-theme-css-persistence-'));
    try {
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/theme-css-persistence.php'), server, root, mode], {
            encoding: 'utf8', timeout: 30000
        }));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

for (const mode of ['profile', 'customize']) test(`${mode} save rejects escaped unsafe CSS without changing workspace or assets`, () => {
    const result = run(mode);
    assert.match(result.error, /external network URL/);
    assert.deepEqual(result.after, result.before);
    assert.ok(Object.values(result.before.assets).every(css => css.includes(result.safeCss)));
    assert.equal(result.storedCss, result.safeCss);
});

for (const mode of ['legacy-profile', 'legacy-import']) test(`managed assets omit escaped unsafe ${mode} CSS while preserving recoverable stored source`, () => {
    const result = run(mode);
    assert.equal(result.storedUnsafe, result.unsafeCss);
    assert.ok(Object.values(result.assets).every(css => css.includes('--fixture-safe: #123456;')));
    assert.ok(Object.values(result.assets).every(css => !css.includes('synthetic.invalid') && !css.includes(result.unsafeCss)));
    if (mode === 'legacy-import') assert.ok(Object.values(result.assets).every(css => css.includes(result.safeCss)));
});
