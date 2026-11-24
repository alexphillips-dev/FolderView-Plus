import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);
const prefsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php'
);
const libPhp = `${fs.readFileSync(libPath, 'utf8')}\n${fs.readFileSync(path.join(path.dirname(libPath), 'lib.storage.php'), 'utf8')}`;
const libPrefsPhp = fs.readFileSync(prefsPath, 'utf8');

const runLegacyProbe = (body) => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-legacy-adoption-'));
    const harness = path.join(root, 'legacy.php');
    const quote = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
    try {
        for (const dir of ['config', 'source', 'host', 'folder.view2']) fs.mkdirSync(path.join(root, dir));
        fs.writeFileSync(harness, `<?php
    $legacy = ${quote(path.join(root, 'folder.view2'))};
    define('FVPLUS_LEGACY_CONFIG_DIRS', [$legacy]);
    $_SERVER['DOCUMENT_ROOT'] = ${quote(path.join(root, 'host'))};
    set_error_handler(static fn(int $level, string $message): bool =>
        $level === E_WARNING && str_contains($message, 'Constant FVPLUS_LEGACY_CONFIG_DIRS already defined'));
    require ${quote(libPath)};
    restore_error_handler();
    ${body}
    `);
        return JSON.parse(execFileSync('php', [harness], { encoding: 'utf8', timeout: 30000,
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_STORAGE_DIR: root }
        }));
    } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), base);
        fs.rmSync(root, { recursive: true, force: true });
    }
};

test('legacy labels and legacy config directories remain supported', () => {
    assert.match(
        libPhp,
        /const FVPLUS_DOCKER_FOLDER_LABEL_KEYS = \[[\s\S]*'folderview\.plus'[\s\S]*'folder\.view3'[\s\S]*'folder\.view2'[\s\S]*'folder\.view'[\s\S]*\];/
    );
    assert.match(
        libPhp,
        /const FVPLUS_LEGACY_CONFIG_DIRS = \[[\s\S]*'\/boot\/config\/plugins\/folder\.view3'[\s\S]*'\/boot\/config\/plugins\/folder\.view2'[\s\S]*'\/boot\/config\/plugins\/folder\.view'[\s\S]*\];/
    );
});

test('self-heal JSON helpers exist and are used in folder/prefs readers', () => {
    assert.match(libPhp, /function getLastGoodJsonPath\(string \$path\): string/);
    assert.match(libPhp, /function writeJsonObjectWithLastGood\(string \$path, array \$payload\): void/);
    assert.match(libPhp, /function recoverJsonObjectFromLastGood\(string \$path, \?callable \$verify = null\): \?array/);
    assert.match(libPhp, /function normalizeFolderMapPayload\(\$value\): array/);
    assert.match(libPhp, /function readRawFolderMap\(string \$type, bool \$requireVerified = false\): array[\s\S]*recoverJsonObjectFromLastGood\(\$path, \$verify\)/);
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.prefs\.php'\);/);
    assert.match(libPrefsPhp, /function readTypePrefs\(string \$type\): array[\s\S]*readJsonObjectFile\(getLastGoodJsonPath\(\$path\)\)[\s\S]*writeTypePrefs\(\$type, \$lastGood\)[\s\S]*migrateLegacyTypeDataIfNeeded/);
    assert.match(libPhp, /function writeRawFolderMap\(string \$type, array \$folders\): void[\s\S]*fvplusWriteConfigPayload\(\$type, 'folder', getFolderFilePath\(\$type\), normalizeFolderMapPayload\(\$folders\)\)/);
    assert.match(libPrefsPhp, /fvplusWriteConfigPayload\(\$type, 'prefs', getTypePrefsPath\(\$type\), \$normalized, \$mutationReceipt, \$authoritative\)/);
});

test('legacy migrations keep normalized folder payloads and last-good snapshots', () => {
    assert.match(
        libPhp,
        /function migrateLegacyTypeDataIfNeeded\([\s\S]*?normalizeFolderMapPayload\(\$legacyData\)[\s\S]*?writeJsonObjectWithLastGood\(\$targetPath, \$legacyData\)/
    );
});

test('authoritative empty folders and valid last-good data take precedence over legacy adoption', () => {
    const result = runLegacyProbe(`
foreach (['docker', 'vm'] as $type) file_put_contents("$legacy/$type.json", json_encode(['legacy' => ['name' => 'Old']]));
// Use the pre-upgrade storage shape, without an authoritative marker in metadata.
writeJsonObjectWithLastGood(getFolderFilePath('vm'), ['current' => ['name' => 'Current']]);
file_put_contents(getFolderFilePath('vm'), '{broken');
$recovered = array_keys(readRawFolderMap('vm'));
$mirror = array_keys(readJsonObjectFile(getLastGoodJsonPath(getFolderFilePath('vm'))));
deleteFolder('vm', 'current');
$afterDelete = array_keys(readRawFolderMap('vm'));
$rebuilt = rebuildConfigMetadata('vm');
$afterRebuild = array_keys(readRawFolderMap('vm'));
$fresh = array_keys(readRawFolderMap('docker'));
echo json_encode(compact('recovered', 'mirror', 'afterDelete', 'rebuilt', 'afterRebuild', 'fresh'));
`);
    assert.deepEqual(result.recovered, ['current']);
    assert.deepEqual(result.mirror, ['current']);
    assert.deepEqual(result.afterDelete, []);
    assert.equal(result.rebuilt.folderLegacyMigrationClosed, true);
    assert.deepEqual(result.afterRebuild, []);
    assert.deepEqual(result.fresh, ['legacy']);
});

test('legacy preferences adopt only over genuine bootstrap defaults', () => {
    const result = runLegacyProbe(`
$before = readTypePrefs('vm')['sortMode']; // Canonical defaults written by first read.
writeTypePrefs('docker', ['sortMode' => 'alpha']);
writeTypePrefs('docker', defaultTypePrefs()); // An explicit reset owns the resulting default.
foreach (['docker', 'vm'] as $type) file_put_contents("$legacy/$type.prefs.json", json_encode(['sortMode' => 'manual']));
$bootstrap = readTypePrefs('vm')['sortMode'];
$explicit = readTypePrefs('docker')['sortMode'];
echo json_encode(compact('before', 'bootstrap', 'explicit'));
`);
    assert.deepEqual(result, { before: 'created', bootstrap: 'manual', explicit: 'created' });
});

test('pre-upgrade empty writes still own folders and preferences without new migration markers', () => {
    const result = runLegacyProbe(`
readRawFolderMap('docker'); // Initial empty file remains eligible for adoption.
writeRawFolderMap('vm', ['current' => ['name' => 'Current']]);
deleteFolder('vm', 'current');
writeTypePrefs('vm', defaultTypePrefs(), str_repeat('a', 64));
$metadata = readConfigMetadata('vm');
unset($metadata['folderLegacyMigrationClosed'], $metadata['prefsLegacyMigrationClosed']);
writeConfigMetadata('vm', $metadata);
foreach (['docker', 'vm'] as $type) file_put_contents("$legacy/$type.json", json_encode(['legacy' => ['name' => 'Old']]));
file_put_contents("$legacy/vm.prefs.json", json_encode(['sortMode' => 'manual']));
$bootstrapped = array_keys(readRawFolderMap('docker'));
$ownedFolders = array_keys(readRawFolderMap('vm'));
$ownedPrefs = readTypePrefs('vm')['sortMode'];
echo json_encode(compact('bootstrapped', 'ownedFolders', 'ownedPrefs'));
`);
    assert.deepEqual(result, { bootstrapped: ['legacy'], ownedFolders: [], ownedPrefs: 'created' });
});
