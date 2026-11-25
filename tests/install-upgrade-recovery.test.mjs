import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const fixture = 'tests/fixtures/unraid-install-recovery.php';
const manifest = 'folderview.plus.plg';
const run = (...args) => {
    const command = process.platform === 'win32' ? 'wsl.exe' : 'php';
    const prefix = process.platform === 'win32' ? ['--exec', 'php'] : [];
    return JSON.parse(execFileSync(command, [...prefix, fixture, manifest, ...args], {
        encoding: 'utf8',
        timeout: 45000
    }));
};

test('install hook retains registered core and icon archives through failures and staging', () => {
    assert.deepEqual(run(), [
        'hook-core', 'hook-icon', 'hook-scheduler', 'hook-report', 'hook-damaged-report', 'hook-legacy-damaged-report',
        'hook-version', 'hook-corrupt', 'hook-fresh-report', 'hook-success', 'hook-reinstall-success', 'hook-unknown'
    ]);
});

const pinnedCli = process.env.FVPLUS_TEST_UNRAID_PLUGIN_CLI;
test('Unraid 7.4.0 installs, updates, and reinstalls boot assets offline', { skip: !pinnedCli }, () => {
    assert.deepEqual(run(pinnedCli), [
        'update-core', 'update-icon', 'update-scheduler', 'update-report', 'update-version', 'update-overlap-version',
        'update-registration-version', 'update-corrupt',
        'install-icon', 'install-scheduler', 'install-report', 'install-damaged-report', 'install-fresh-report',
        'update-success', 'install-success', 'install-reinstall-success',
        'install-native-remove-failure', 'install-boot-contention-success', 'update-staged-peer-success'
    ]);
});
