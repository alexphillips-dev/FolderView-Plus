import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const libPath = path.join(pluginRoot, 'server/lib.php');
const endpointPath = path.join(pluginRoot, 'server/batch.php');
const settingsPath = path.join(pluginRoot, 'scripts/folderviewplus.js');
const importPath = path.join(pluginRoot, 'scripts/folderviewplus.import.js');
const endpoint = fs.readFileSync(endpointPath, 'utf8');
const settings = fs.readFileSync(settingsPath, 'utf8');
const importRuntime = fs.readFileSync(importPath, 'utf8');
const lib = `${fs.readFileSync(libPath, 'utf8')}\n${fs.readFileSync(path.join(pluginRoot, 'server/lib.folder-mutations.php'), 'utf8')}\n${fs.readFileSync(path.join(pluginRoot, 'server/lib.folder-batch-order.php'), 'utf8')}`;

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildHarness = () => `<?php
function fvplus_assert_folder_payload_shape(array $payload): void {}
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpSingleQuote(libPath)};

$initial = [
    'parent' => [
        'name' => 'Parent',
        'containers' => [],
        'createdAt' => '2026-01-01T00:00:00Z'
    ],
    'child' => [
        'name' => 'Child',
        'containers' => ['alpha'],
        'parentId' => 'parent',
        'createdAt' => '2026-01-02T00:00:00Z'
    ],
    'keep' => [
        'name' => 'Keep',
        'containers' => ['beta'],
        'createdAt' => '2026-01-03T00:00:00Z'
    ]
];
writeRawFolderMap('vm', $initial);
$prefs = defaultTypePrefs();
$prefs['sortMode'] = 'manual';
$prefs['manualOrder'] = ['parent', 'child', 'keep'];
writeTypePrefs('vm', $prefs);
$before = readConfigMetadata('vm', false);

$result = applyFolderBatchOperations('vm', [
    'deletes' => ['parent'],
    'upserts' => [[
        'id' => 'keep',
        'folder' => [
            'name' => 'Keep updated',
            'containers' => ['beta', 'gamma'],
            'createdAt' => '2030-01-01T00:00:00Z'
        ]
    ]],
    'creates' => [[
        'folder' => [
            'name' => 'Created',
            'containers' => []
        ]
    ]]
]);

$after = readConfigMetadata('vm', false);
$folders = readRawFolderMap('vm');
$savedPrefs = readTypePrefs('vm');
$primary = json_decode(file_get_contents(getFolderFilePath('vm')), true);
$lastGood = json_decode(file_get_contents(getFolderFilePath('vm') . '.lastgood'), true);
$beforeInvalid = file_get_contents(getFolderFilePath('vm'));
$beforeInvalidMetadata = readConfigMetadata('vm', false);
$invalidRejected = false;
try {
    applyFolderBatchOperations('vm', [
        'deletes' => ['child'],
        'upserts' => [['id' => 'keep', 'folder' => 'invalid']],
        'creates' => []
    ]);
} catch (RuntimeException $error) {
    $invalidRejected = true;
}
$afterInvalid = file_get_contents(getFolderFilePath('vm'));
$afterInvalidMetadata = readConfigMetadata('vm', false);
$beforeStale = file_get_contents(getFolderFilePath('vm'));
$beforeStaleMetadata = readConfigMetadata('vm', false);
$staleRejected = false;
try {
    applyFolderBatchOperations('vm', [
        'deletes' => [],
        'upserts' => [[
            'id' => 'keep',
            'folder' => [
                'name' => 'Stale overwrite',
                'containers' => []
            ]
        ]],
        'creates' => []
    ], max(0, (int)$beforeStaleMetadata['folderRevision'] - 1));
} catch (RuntimeException $error) {
    $staleRejected = str_contains($error->getMessage(), 'changed in another page or browser tab');
}
$afterStale = file_get_contents(getFolderFilePath('vm'));
$afterStaleMetadata = readConfigMetadata('vm', false);
$moveBefore = readConfigMetadata('vm', false);
$moveFolders = readRawFolderMap('vm');
$moveChild = $moveFolders['child'];
$moveResult = applyFolderBatchOperations('vm', [
    'deletes' => [],
    'upserts' => [['id' => 'child', 'folder' => array_merge($moveChild, ['parentId' => 'keep'])]],
    'creates' => [],
    'manualOrder' => ['keep', 'child'],
    'expectedPrefsRevision' => $moveBefore['prefsRevision']
], $moveBefore['folderRevision']);
$moveAfter = readConfigMetadata('vm', false);
$movedFolders = readRawFolderMap('vm');
$movedPrefs = readTypePrefs('vm');
$beforeStaleMoveFolders = file_get_contents(getFolderFilePath('vm'));
$beforeStaleMovePrefs = file_get_contents(getTypePrefsPath('vm'));
$stalePrefsRejected = false;
try {
    applyFolderBatchOperations('vm', [
        'deletes' => [],
        'upserts' => [['id' => 'child', 'folder' => array_merge($moveChild, ['parentId' => ''])]],
        'creates' => [],
        'manualOrder' => ['child', 'keep'],
        'expectedPrefsRevision' => $moveBefore['prefsRevision']
    ], $moveAfter['folderRevision']);
} catch (RuntimeException $error) {
    $stalePrefsRejected = str_contains($error->getMessage(), 'changed in another page or browser tab');
}

echo json_encode([
    'result' => $result,
    'before' => $before,
    'after' => $after,
    'folders' => $folders,
    'manualOrder' => $savedPrefs['manualOrder'],
    'primaryMatchesLastGood' => $primary === $lastGood,
    'invalidRejected' => $invalidRejected,
    'invalidPreservedFolders' => $beforeInvalid === $afterInvalid,
    'invalidPreservedRevision' => $beforeInvalidMetadata['folderRevision'] === $afterInvalidMetadata['folderRevision'],
    'staleRejected' => $staleRejected,
    'stalePreservedFolders' => $beforeStale === $afterStale,
    'stalePreservedRevision' => $beforeStaleMetadata['folderRevision'] === $afterStaleMetadata['folderRevision'],
    'moveResult' => $moveResult,
    'moveBefore' => $moveBefore,
    'moveAfter' => $moveAfter,
    'movedParentId' => $movedFolders['child']['parentId'],
    'movedManualOrder' => $movedPrefs['manualOrder'],
    'stalePrefsRejected' => $stalePrefsRejected,
    'stalePrefsPreservedFolders' => $beforeStaleMoveFolders === file_get_contents(getFolderFilePath('vm')),
    'stalePrefsPreservedPrefs' => $beforeStaleMovePrefs === file_get_contents(getTypePrefsPath('vm'))
], JSON_UNESCAPED_SLASHES);
`;

const runHarness = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-batch-transaction-'));
    const harnessPath = path.join(tempDir, 'batch.php');
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

test('server batch mutation validates first and commits one atomic folder revision', () => {
    const output = runHarness();
    assert.equal(output.result.requestedCount, 3);
    assert.deepEqual(output.result.deletedIds, ['parent']);
    assert.deepEqual(output.result.updatedIds, ['keep']);
    assert.equal(output.result.createdIds.length, 1);
    assert.equal(output.after.folderRevision, output.before.folderRevision + 1, 'the entire batch must write the folder map once');
    assert.equal(output.folders.child.parentId, '', 'children of a deleted folder must be safely reparented');
    assert.equal(output.folders.keep.name, 'Keep updated');
    assert.equal(output.folders.keep.createdAt, '2026-01-03T00:00:00+00:00', 'updates must preserve the normalized original creation time');
    assert.equal(output.folders[output.result.createdIds[0]].name, 'Created');
    assert.deepEqual(output.manualOrder, ['child', 'keep', output.result.createdIds[0]]);
    assert.equal(output.primaryMatchesLastGood, true);
    assert.equal(output.invalidRejected, true);
    assert.equal(output.invalidPreservedFolders, true, 'invalid batches must not partially mutate the folder map');
    assert.equal(output.invalidPreservedRevision, true, 'invalid batches must not advance metadata');
    assert.equal(output.staleRejected, true, 'stale batches must be rejected with a revision conflict');
    assert.equal(output.stalePreservedFolders, true, 'stale batches must not overwrite newer folder data');
    assert.equal(output.stalePreservedRevision, true, 'stale batches must not advance metadata');
    assert.equal(output.moveResult.updatedIds[0], 'child');
    assert.equal(output.moveAfter.folderRevision, output.moveBefore.folderRevision + 1);
    assert.equal(output.moveAfter.prefsRevision, output.moveBefore.prefsRevision + 1);
    assert.equal(output.movedParentId, 'keep');
    assert.deepEqual(output.movedManualOrder.slice(0, 2), ['keep', 'child']);
    assert.equal(output.stalePrefsRejected, true);
    assert.equal(output.stalePrefsPreservedFolders, true);
    assert.equal(output.stalePrefsPreservedPrefs, true);
});

test('batch endpoint is guarded, bounded, and delegates one transaction', () => {
    assert.match(endpoint, /requireMutationRequestGuard\(\)/);
    assert.match(endpoint, /FVPLUS_MAX_FOLDER_BATCH_RAW_BYTES/);
    assert.match(endpoint, /applyFolderBatchOperations\(\$type, \$operations, \$_POST\['expectedRevision'\] \?\? ''\)/);
    assert.match(lib, /function applyFolderBatchOperations\(string \$type, array \$operations, \$expectedRevision = ''\): array/);
    assert.match(lib, /withConfigMutationLock\(static function/);
    assert.match(lib, /assertExpectedConfigRevision\(\$type, 'folder', \$expectedRevision\)/);
    assert.match(lib, /assertExpectedConfigRevision\(\$type, 'prefs', \$expectedPrefsRevision\)/);
    assert.match(lib, /writeRawFolderMap\(\$type, \$nextFolders\)/);
    assert.match(lib, /reconcileManualOrderPrefs\(\$originalPrefs, \$nextFolders\)/);
    assert.match(lib, /appendDiagnosticsHistoryEvent\('folder_batch_mutation'/);
});

test('imports and deletes use one batch request instead of per-folder endpoints', () => {
    const clearFlow = settings.slice(settings.indexOf('const clearType ='), settings.indexOf('const updatePrefsPartial ='));
    assert.match(settings, /const requestFolderBatchMutation = async \(type, operations, options = \{\}\) =>/);
    assert.match(settings, /apiPostJson\('\/plugins\/folderview\.plus\/server\/batch\.php'/);
    assert.match(fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.folder-editor.js'), 'utf8'), /await requestFolderBatchMutation\(resolvedType, \{/);
    assert.match(importRuntime, /requestFolderBatchMutation\(resolvedType, \{ deletes, upserts, creates \}\)/);
    assert.doesNotMatch(importRuntime, /server\/(?:create|update|delete)\.php/);
    assert.doesNotMatch(importRuntime, /runImportChunked/);
    assert.match(clearFlow, /requestFolderBatchMutation\(resolvedType, \{\s*deletes: deleteIds,\s*upserts: \[\],\s*creates: \[\]\s*\}\)/);
    assert.doesNotMatch(clearFlow, /await new Promise\(\(resolve\) => setTimeout\(resolve, (?:180|650)\)\)/);
});

test('parent-only tree moves keep the current sort mode and positional moves save manual order atomically', () => {
    const editor = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.folder-editor.js'), 'utf8');
    const move = editor.slice(editor.indexOf('const applyFolderTreeMove ='), editor.indexOf('const openFolderTreeMoveDialog ='));
    const root = editor.slice(editor.indexOf('const moveFolderToRootQuick ='), editor.indexOf('Object.assign(window, {'));
    assert.match(move, /const positionalMove = mode === 'before' \|\| mode === 'after'/);
    assert.match(move, /await persistOptimisticTreeMove\(resolvedType/);
    assert.match(editor, /\.\.\.\(positionalMove \? \{ manualOrder: nextOrder, expectedPrefsRevision \} : \{\}\)/);
    assert.doesNotMatch(move, /ensureFolderSortModeManual/);
    assert.match(root, /await requestFolderBatchMutation\(resolvedType/);
    assert.doesNotMatch(root, /ensureFolderSortModeManual|saveFolderRecord/);
});
