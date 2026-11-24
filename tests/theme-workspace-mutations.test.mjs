import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.resolve('tests/fixtures/theme-workspace-mutations.php');
const temporaryRoot = path.resolve(os.tmpdir());
const fixturePrefix = 'fvplus-theme-state-';

function run(input) {
    const root = fs.mkdtempSync(path.join(temporaryRoot, fixturePrefix));
    try {
        const payload = Buffer.from(JSON.stringify(input)).toString('base64');
        const tempOption = `sys_temp_dir="${root.replaceAll('\\', '/')}"`;
        return JSON.parse(execFileSync('php', ['-d', tempOption, fixture, server, root, payload], {
            encoding: 'utf8', timeout: 30000
        }));
    } finally {
        assert.equal(path.dirname(path.resolve(root)), temporaryRoot);
        assert.ok(path.basename(root).startsWith(fixturePrefix));
        fs.rmSync(root, { recursive: true, force: true });
    }
}

for (const [scenario, name] of [
    ['fresh', 'Default profile'], ['missing', 'Mirror profile'],
    ['corrupt', 'Mirror profile'], ['healthy', 'Primary profile']
]) {
    test(`Appearance layer preview preserves ${scenario} workspace and generated CSS files`, () => {
        const result = run({ mode: 'endpoint', action: 'preview_profile', scenario });
        assert.equal(result.ok, true);
        assert.equal(result.name, name);
        assert.deepEqual(result.changedScopes, ['docker']);
        assert.equal(result.beforeAfterEqual, true);
        assert.equal(result.hasConfigDir, scenario !== 'fresh');
        assert.equal(result.hasRuntimeDir, false);
        assert.equal(result.hasLock, false);
        assert.equal(result.hasIconStorage, false);
    });
}

for (const scenario of ['missing', 'corrupt']) {
    test(`Managed theme update preview uses last-good when primary is ${scenario}`, () => {
        const result = run({ mode: 'endpoint', action: 'preview_theme_updates', scenario });
        assert.equal(result.ok, true);
        assert.deepEqual(result.themeIds, ['first']);
        assert.equal(result.beforeAfterEqual, true);
        assert.equal(result.hasRuntimeDir, false);
        assert.equal(result.hasLock, false);
        assert.equal(result.hasIconStorage, false);
    });

    test(`Repairing Appearance read restores last-good when primary is ${scenario}`, () => {
        const result = run({ mode: 'endpoint', action: 'read', scenario });
        assert.equal(result.ok, true);
        assert.equal(result.name, 'Mirror profile');
        assert.equal(result.primaryName, 'Mirror profile');
        assert.match(result.afterCss, /\.saved\s*\{/);
        assert.equal(result.beforeAfterEqual, false);
        assert.equal(result.hasRuntimeDir, false);
        assert.equal(result.hasIconStorage, false);
    });
}

test('Repairing Appearance read initializes defaults on first use', () => {
    const result = run({ mode: 'endpoint', action: 'read', scenario: 'fresh' });
    assert.equal(result.ok, true);
    assert.equal(result.name, 'Default profile');
    assert.equal(result.primaryName, 'Default profile');
    assert.equal(result.hasConfigDir, true);
    assert.equal(result.hasRuntimeDir, false);
    assert.equal(result.hasIconStorage, false);
});

for (const [mode, operation] of [['bootstrap', 'normal library startup'], ['repair', 'explicit path repair']]) {
    test(`${operation} initializes managed theme and icon storage`, () => {
        assert.deepEqual(run({ mode }), { workspace: true, iconStorage: true, runtimeIcons: true, iconLock: true });
    });
}

for (const action of ['import_github', 'check_updates', 'update_theme', 'update_themes']) {
    test(`Managed theme ${action} releases the configuration lock after the request guard`, () => {
        assert.deepEqual(run({ mode: 'remote', action }), {
            lockAvailable: true, guardAuthorized: true, nonceConsumed: true, protectedAction: action
        });
    });
}

for (const action of [
    'create', 'activate-profile', 'delete-profile', 'save-profile', 'save-customize',
    'activate-theme', 'deactivate-theme', 'delete-theme'
]) {
    test(`Local ${action} holds the configuration lock and rejects a stale GitHub write`, () => {
        assert.deepEqual(run({ mode: 'mutation', action }), {
            heldDuringRead: true,
            localPersisted: true,
            staleGithubRejected: true
        });
    });
}
