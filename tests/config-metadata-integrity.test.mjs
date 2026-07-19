import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus'
);
const libPath = path.join(pluginRoot, 'server/lib.php');
const prefsEndpoint = fs.readFileSync(path.join(pluginRoot, 'server/prefs.php'), 'utf8');
const readEndpoint = fs.readFileSync(path.join(pluginRoot, 'server/read.php'), 'utf8');
const folderEditor = fs.readFileSync(path.join(pluginRoot, 'scripts/folder.js'), 'utf8');
const folderEditorRules = fs.readFileSync(path.join(pluginRoot, 'scripts/folder.editor.rules.js'), 'utf8');
const settingsRuntime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.activity-diagnostics.js'), 'utf8');
const diagnosticsLib = fs.readFileSync(path.join(pluginRoot, 'server/lib.diagnostics.php'), 'utf8');
const supportBundleLib = fs.readFileSync(path.join(pluginRoot, 'server/lib.diagnostics.php'), 'utf8');
const iconEndpoint = fs.readFileSync(path.join(pluginRoot, 'server/upload_custom_icon.php'), 'utf8');

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildHarness = () => `<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
$_SERVER['HTTP_X_FV_TRACE'] = 'fv-metadata-test';
$_SERVER['HTTP_X_FV_TRANSACTION'] = 'tx-metadata-test';
require_once ${phpSingleQuote(libPath)};

$folderOne = [
    'one' => [
        'name' => 'One',
        'containers' => ['alpha']
    ]
];
writeRawFolderMap('docker', $folderOne);
$afterFolderWrite = readConfigMetadata('docker', true);

$prefs = defaultTypePrefs();
$prefs['sortMode'] = 'manual';
writeTypePrefs('docker', $prefs);
$afterPrefsWrite = readConfigMetadata('docker', true);

$originalFolderRevision = (int)$afterPrefsWrite['folderRevision'];
assertExpectedConfigRevision('docker', 'folder', (string)$originalFolderRevision);
writeRawFolderMap('docker', [
    'one' => [
        'name' => 'One updated',
        'containers' => ['alpha']
    ]
]);
$afterSecondFolderWrite = readConfigMetadata('docker', true);

$staleSaveRejected = false;
try {
    assertExpectedConfigRevision('docker', 'folder', (string)$originalFolderRevision);
} catch (FVPlusConfigConflictException $error) {
    $staleSaveRejected = true;
}

$folderPath = getFolderFilePath('docker');
file_put_contents($folderPath, json_encode([
    'one' => [
        'name' => 'Externally edited',
        'containers' => ['alpha']
    ]
], JSON_UNESCAPED_SLASHES));
$afterExternalEdit = readConfigMetadata('docker', true);

$metadataPath = getConfigMetadataPath('docker');
file_put_contents($metadataPath, '{broken');
$afterRecovery = readConfigMetadata('docker', true);
$storedFolders = json_decode(file_get_contents($folderPath), true);

echo json_encode([
    'afterFolderWrite' => $afterFolderWrite,
    'afterPrefsWrite' => $afterPrefsWrite,
    'afterSecondFolderWrite' => $afterSecondFolderWrite,
    'afterExternalEdit' => $afterExternalEdit,
    'afterRecovery' => $afterRecovery,
    'staleSaveRejected' => $staleSaveRejected,
    'storedFolders' => $storedFolders,
    'metadataPrimaryValid' => is_array(json_decode(file_get_contents($metadataPath), true)),
    'metadataLastGoodExists' => is_file($metadataPath . '.lastgood')
], JSON_UNESCAPED_SLASHES);
`;

const runHarness = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-config-metadata-'));
    const harnessPath = path.join(tempDir, 'metadata.php');
    const runtimeDir = path.join(tempDir, 'runtime');
    const documentRoot = path.join(tempDir, 'document-root');
    fs.mkdirSync(runtimeDir, { recursive: true });
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
                FVPLUS_TEST_SOURCE_DIR: runtimeDir,
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        }));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('configuration metadata revisions track writes, reject stale saves, and recover atomically', () => {
    const result = runHarness();

    assert.equal(result.afterFolderWrite.schemaVersion, 1);
    assert.equal(result.afterFolderWrite.type, 'docker');
    assert.equal(result.afterFolderWrite.folderRevision, 1);
    assert.equal(result.afterFolderWrite.prefsRevision, 0);
    assert.equal(result.afterFolderWrite.lastTraceId, 'fv-metadata-test');
    assert.equal(result.afterFolderWrite.lastTransactionId, 'tx-metadata-test');
    assert.match(result.afterFolderWrite.lastMutationAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(result.afterFolderWrite.folderSha256, /^[a-f0-9]{64}$/);

    assert.equal(result.afterPrefsWrite.folderRevision, 1);
    assert.equal(result.afterPrefsWrite.prefsRevision, 1);
    assert.match(result.afterPrefsWrite.prefsSha256, /^[a-f0-9]{64}$/);

    assert.equal(result.afterSecondFolderWrite.folderRevision, 2);
    assert.equal(result.staleSaveRejected, true);
    assert.equal(result.afterExternalEdit.folderRevision, 3);
    assert.equal(result.afterExternalEdit.externalChangeCount, 1);
    assert.match(result.afterExternalEdit.lastExternalChangeAt, /^\d{4}-\d{2}-\d{2}T/);

    assert.equal(result.afterRecovery.folderRevision, 3);
    assert.equal(result.afterRecovery.folderSha256, result.afterExternalEdit.folderSha256);
    assert.equal(result.metadataPrimaryValid, true);
    assert.equal(result.metadataLastGoodExists, true);
    assert.deepEqual(Object.keys(result.storedFolders), ['one']);
    assert.equal(result.storedFolders.one.name, 'Externally edited');
    assert.equal(Object.hasOwn(result.storedFolders, 'metadata'), false, 'legacy folder map format must remain unchanged');
});

test('API and editor contracts expose revisions without breaking the legacy folder response', () => {
    assert.match(prefsEndpoint, /'metadata'\s*=>\s*readConfigMetadata\(\$type, true\)/);
    assert.match(prefsEndpoint, /assertExpectedConfigRevision\(\$type, 'prefs', \$_POST\['expectedRevision'\] \?\? ''\)/);
    assert.match(prefsEndpoint, /syncManualOrderWithFolders[\s\S]*\$saved = readTypePrefs\(\$type\);[\s\S]*\$metadata = readConfigMetadata\(\$type, false\);/);
    assert.match(readEndpoint, /\$_GET\['includeMetadata'\]/);
    assert.match(readEndpoint, /header\('X-FV-Folder-Revision: '/);
    assert.match(folderEditor, /folderEditorExpectedFolderRevision/);
    assert.match(folderEditor, /expectedRevision:\s*folderEditorExpectedFolderRevision/);
    assert.match(folderEditorRules, /filter\(\(\[key\]\) => key !== '_metadata'\)/);
    assert.match(settingsRuntime, /filter\(\(\[key\]\) => key !== '_metadata'\)/);
});

test('metadata integrity is visible in diagnostics and the sanitized support bundle', () => {
    assert.match(diagnosticsLib, /function diagnosticsBuildConfigMetadataIntegrity\(string \$type\): array/);
    assert.match(diagnosticsLib, /'configurationMetadata'\s*=>\s*\$configMetadataIntegrity/);
    assert.match(supportBundleLib, /'configurationMetadata'\s*=>\s*\[/);
    assert.match(supportBundleLib, /'externalChangeCount'\s*=>/);
    assert.match(supportBundleLib, /'lastTransactionId'\s*=>/);
    assert.match(supportBundleLib, /'transactionId'\s*=>\s*diagnosticsCurrentTransactionId\(\)/);
});

test('custom icon metadata uses atomic primary and last-good writes', () => {
    assert.match(iconEndpoint, /writeJsonObjectWithLastGood\(\$path, \$payload\)/);
    assert.match(iconEndpoint, /recoverJsonObjectFromLastGood\(\$path\)/);
});
