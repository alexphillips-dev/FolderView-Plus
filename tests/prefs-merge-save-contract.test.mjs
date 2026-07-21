import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const libPath = path.join(pluginRoot, 'server/lib.php');
const prefsEndpoint = fs.readFileSync(path.join(pluginRoot, 'server/prefs.php'), 'utf8');
const phpQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildHarness = () => `<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpQuote(libPath)};

$current = defaultTypePrefs();
$current['dashboard']['privacyMaskNames'] = true;
$current['dashboard']['privacyMaskPorts'] = true;
$current['pinnedFolderIds'] = ['one', 'two'];
$merged = mergeTypePrefsPatch($current, [
    'dashboard' => ['privacyMaskPorts' => false],
    'pinnedFolderIds' => ['three']
]);

writeRawFolderMap('docker', [
    'folder-one' => ['name' => 'One', 'containers' => ['alpha']]
]);
writeTypePrefs('docker', $current);
$first = createCoalescedPrefsBackupSnapshot('docker', 5);
$second = createCoalescedPrefsBackupSnapshot('docker', 5);

echo json_encode([
    'dashboard' => $merged['dashboard'],
    'pinnedFolderIds' => $merged['pinnedFolderIds'],
    'first' => $first,
    'second' => $second,
    'displayPatchRequiresBackup' => prefsPatchRequiresSafetyBackup(['dashboard' => ['privacyMode' => true]]),
    'rulePatchRequiresBackup' => prefsPatchRequiresSafetyBackup(['autoRules' => [['pattern' => 'media']]]),
    'unchangedBroadPatchRequiresBackup' => prefsPatchRequiresSafetyBackup($current, $current, $current),
    'backupCount' => count(listBackupSnapshots('docker'))
], JSON_UNESCAPED_SLASHES);
`;

const runHarness = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-prefs-save-'));
    const harnessPath = path.join(tempDir, 'prefs-save.php');
    const documentRoot = path.join(tempDir, 'document-root');
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.writeFileSync(harnessPath, buildHarness(), 'utf8');
    try {
        return JSON.parse(execFileSync('php', [harnessPath], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000,
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: path.join(tempDir, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(tempDir, 'runtime'),
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        }));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('server preference merge preserves nested siblings and replaces list values', () => {
    const result = runHarness();
    assert.equal(result.dashboard.privacyMaskNames, true);
    assert.equal(result.dashboard.privacyMaskPorts, false);
    assert.deepEqual(result.pinnedFolderIds, ['three']);
    assert.equal(result.first.coalesced, false);
    assert.equal(result.second.coalesced, true);
    assert.equal(result.second.name, result.first.name);
    assert.equal(result.displayPatchRequiresBackup, false);
    assert.equal(result.rulePatchRequiresBackup, true);
    assert.equal(result.unchangedBroadPatchRequiresBackup, false);
    assert.equal(result.backupCount, 1);
});

test('preference endpoint exposes revision-safe merge and mutation diagnostics', () => {
    assert.match(prefsEndpoint, /mergeTypePrefsPatch\(\$current, \$decoded\)/);
    assert.match(prefsEndpoint, /clientMutationId/);
    assert.match(prefsEndpoint, /createCoalescedPrefsBackupSnapshot\(\$type\)/);
    assert.match(prefsEndpoint, /prefsPatchRequiresSafetyBackup\(\$decoded, \$current, \$next\)/);
    assert.match(prefsEndpoint, /'backupRequired'/);
    assert.match(prefsEndpoint, /'backupCoalesced'/);
});
