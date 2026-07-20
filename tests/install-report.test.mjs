import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const reportPath = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/install_report.sh');
const iconInstallerPath = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/install_icon_asset_pack.sh');
const slackDescPath = path.join(root, 'src/folderview.plus/install/slack-desc');
const manifestPath = path.join(root, 'folderview.plus.plg');
const reportSource = fs.readFileSync(reportPath, 'utf8');
const iconInstallerSource = fs.readFileSync(iconInstallerPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');

const toBashPath = (value) => {
    const normalized = path.resolve(value).replace(/\\/g, '/');
    const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
    return match ? `/mnt/${match[1].toLowerCase()}/${match[2]}` : normalized;
};
const bashExecutable = process.platform === 'win32' ? 'wsl.exe' : 'bash';
const bashArgs = (args) => process.platform === 'win32' ? ['--exec', 'bash', ...args] : args;

const runReport = ({ action = 'complete', current = '2026.07.19.16', previous = '2026.07.19.15', state = 'reused', scheduler = 'registered', stage = '', exitCode = '1', error = '' } = {}) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-install-report-'));
    const contextPath = path.join(tempDir, 'context');
    const statusPath = path.join(tempDir, 'icon-status');
    fs.writeFileSync(contextPath, [
        `started_at=${Math.floor(Date.now() / 1000) - 2}`,
        `previous_version=${previous}`,
        `had_config=${previous ? 1 : 0}`,
        `backup_count=${previous ? 3 : 0}`,
        `custom_icon_count=${previous ? 2 : 0}`,
        `override_count=${previous ? 1 : 0}`,
        ''
    ].join('\n'));
    fs.writeFileSync(statusPath, [
        `state=${state}`,
        'version=1.0.0',
        'file_count=1982',
        error ? `error=${error}` : '',
        ''
    ].filter(Boolean).join('\n'));
    try {
        const command = action === 'failure'
            ? 'FVPLUS_INSTALL_CONTEXT_FILE="$1" /bin/bash "$2" failure "$3" 1.0.0 "$4" "$5" "$6"'
            : 'FVPLUS_INSTALL_CONTEXT_FILE="$1" /bin/bash "$2" complete "$3" 1.0.0 "$4" "$5"';
        return execFileSync(bashExecutable, bashArgs([
            '-c', command, '_',
            toBashPath(contextPath),
            toBashPath(reportPath),
            current,
            toBashPath(statusPath),
            action === 'failure' ? stage : scheduler,
            exitCode
        ]), { cwd: root, encoding: 'utf8' });
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('Slackware package description is complete and useful', () => {
    const lines = fs.readFileSync(slackDescPath, 'utf8').trimEnd().split(/\r?\n/);
    assert.equal(lines.length, 11);
    assert.ok(lines.every((line) => line.startsWith('folderview.plus:')));
    assert.equal(lines[0], 'folderview.plus: FolderView Plus for Unraid');
    assert.ok(lines.some((line) => line.includes('Organizes Docker containers and VMs')));
});

test('upgrade report distinguishes versions and preserved data', () => {
    const output = runReport();
    assert.match(output, /FolderView Plus - Upgrade complete/);
    assert.match(output, /2026\.07\.19\.15 -> 2026\.07\.19\.16/);
    assert.match(output, /Core package\s+Installed/);
    assert.match(output, /Icon pack\s+1\.0\.0 verified and reused from cache \(1982 icons\)/);
    assert.match(output, /Configuration\s+Preserved/);
    assert.match(output, /Backups\s+Preserved \(3 snapshots\)/);
    assert.match(output, /Custom data\s+Preserved \(2 icons, 1 overrides\)/);
    assert.match(output, /Scheduler\s+Registered/);
    assert.match(output, /Next step: reload the Docker, VM, Dashboard, or Settings page/);
});

test('fresh install, reinstall, and downgrade reports use truthful operation labels', () => {
    assert.match(runReport({ previous: '' }), /FolderView Plus - Installation complete/);
    assert.match(runReport({ previous: '2026.07.19.16' }), /2026\.07\.19\.16 \(reinstalled\)/);
    const downgrade = runReport({ current: '2026.07.19.14', previous: '2026.07.19.16', state: 'activated' });
    assert.match(downgrade, /FolderView Plus - Downgrade complete/);
    assert.match(downgrade, /Icon pack\s+1\.0\.0 verified and activated/);
    assert.match(downgrade, /Warning\s+Verify configuration compatibility/);
});

test('failure report names the failed stage and keeps the prior version visible', () => {
    const output = runReport({
        action: 'failure',
        stage: 'icon pack activation',
        exitCode: '7',
        error: 'FolderView Plus icon asset-pack checksum verification failed.'
    });
    assert.match(output, /FolderView Plus - Upgrade failed/);
    assert.match(output, /Stage\s+icon pack activation/);
    assert.match(output, /Exit code\s+7/);
    assert.match(output, /checksum verification failed/);
    assert.match(output, /Previous\s+2026\.07\.19\.15/);
    assert.match(output, /previous configuration was not intentionally removed/);
});

test('manifest captures pre-install state and reports post-install completion or failure', () => {
    assert.match(manifest, /started_at=%s/);
    assert.match(manifest, /previous_version=%s/);
    assert.match(manifest, /backup_count=%s/);
    assert.match(manifest, /custom_icon_count=%s/);
    assert.match(manifest, /override_count=%s/);
    assert.match(manifest, /trap install_failure EXIT/);
    assert.match(manifest, /install_report\}" failure/);
    assert.match(manifest, /install_report\}" complete/);
    assert.match(manifest, /scheduler_status="registered-restart-warning"/);
    assert.match(manifest, /echo "&version;" > \/boot\/config\/plugins\/&name;\/version/);
    assert.doesNotMatch(manifest, /&name; has been installed/);
    assert.match(reportSource, /detect_operation/);
    assert.match(iconInstallerSource, /ICON_PACK_INSTALL_STATE="reused"/);
    assert.match(iconInstallerSource, /ICON_PACK_INSTALL_STATE="activated"/);
});
