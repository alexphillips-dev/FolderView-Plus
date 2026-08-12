import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const scriptRoot = path.join(pluginRoot, 'scripts');
const libPath = path.join(pluginRoot, 'server/lib.php');
const endpointPath = path.join(pluginRoot, 'server/bulk_assign.php');
const bulkSharedPath = path.join(scriptRoot, 'folderviewplus.bulk-assignment.shared.js');
const settingsPath = path.join(scriptRoot, 'folderviewplus.js');
const starterPath = path.join(scriptRoot, 'folderviewplus.starter-templates.js');
const wizardPath = path.join(scriptRoot, 'folderviewplus.wizard.js');
const treeIntegrityPath = path.join(scriptRoot, 'folderviewplus.tree-integrity.js');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const lib = `${read(libPath)}\n${read(path.join(pluginRoot, 'server/lib.folder-rules.php'))}`;
const endpoint = read(endpointPath);
const settings = read(settingsPath);
const starter = read(starterPath);
const wizard = read(wizardPath);
const treeIntegrity = read(treeIntegrityPath);
const bulkShared = read(bulkSharedPath);
const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildAssignmentHarness = () => `<?php
function fvplus_assert_folder_payload_shape(array $payload): void {}
class Libvirt {
    public function connect(): bool { return false; }
    public function get_domains(): array { return []; }
}
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpSingleQuote(libPath)};

$initial = [
    'a' => ['name' => 'A', 'containers' => ['alpha'], 'createdAt' => '2026-01-01T00:00:00Z'],
    'b' => ['name' => 'B', 'containers' => ['beta'], 'createdAt' => '2026-01-02T00:00:00Z'],
    'c' => ['name' => 'C', 'containers' => ['gamma'], 'createdAt' => '2026-01-03T00:00:00Z']
];
writeRawFolderMap('vm', $initial);
$before = readConfigMetadata('vm', false);
$result = bulkAssignItemsToFolders('vm', [
    ['folderId' => 'a', 'items' => ['alpha', 'gamma']],
    ['folderId' => 'b', 'items' => ['beta']]
]);
$after = readConfigMetadata('vm', false);
$folders = readRawFolderMap('vm');

$beforeConflictJson = file_get_contents(getFolderFilePath('vm'));
$beforeConflictMetadata = readConfigMetadata('vm', false);
$conflictRejected = false;
try {
    bulkAssignItemsToFolders('vm', [
        ['folderId' => 'a', 'items' => ['alpha']],
        ['folderId' => 'b', 'items' => ['alpha']]
    ]);
} catch (RuntimeException $error) {
    $conflictRejected = true;
}
$afterConflictJson = file_get_contents(getFolderFilePath('vm'));
$afterConflictMetadata = readConfigMetadata('vm', false);

$missingTargetRejected = false;
try {
    bulkAssignItemsToFolders('vm', [
        ['folderId' => 'a', 'items' => ['alpha']],
        ['folderId' => 'missing', 'items' => ['beta']]
    ]);
} catch (RuntimeException $error) {
    $missingTargetRejected = true;
}
$afterMissingJson = file_get_contents(getFolderFilePath('vm'));
$afterMissingMetadata = readConfigMetadata('vm', false);

echo json_encode([
    'before' => $before,
    'after' => $after,
    'result' => $result,
    'folders' => $folders,
    'conflictRejected' => $conflictRejected,
    'conflictPreservedConfig' => $beforeConflictJson === $afterConflictJson,
    'conflictPreservedRevision' => $beforeConflictMetadata['folderRevision'] === $afterConflictMetadata['folderRevision'],
    'missingTargetRejected' => $missingTargetRejected,
    'missingTargetPreservedConfig' => $afterConflictJson === $afterMissingJson,
    'missingTargetPreservedRevision' => $afterConflictMetadata['folderRevision'] === $afterMissingMetadata['folderRevision']
], JSON_UNESCAPED_SLASHES);
`;

const runAssignmentHarness = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-atomic-assign-'));
    const harnessPath = path.join(tempDir, 'assignment.php');
    const documentRoot = path.join(tempDir, 'document-root');
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.writeFileSync(harnessPath, buildAssignmentHarness(), 'utf8');
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

test('multi-target assignment commits once and rejects the complete invalid batch', () => {
    const output = runAssignmentHarness();
    assert.equal(output.after.folderRevision, output.before.folderRevision + 1, 'one multi-folder assignment must advance one folder revision');
    assert.equal(output.result.assignedCount, 3);
    assert.equal(output.result.results.length, 2);
    assert.deepEqual(output.result.changedFolderIds, ['a', 'c']);
    assert.deepEqual(output.folders.a.containers, ['alpha', 'gamma']);
    assert.deepEqual(output.folders.b.containers, ['beta']);
    assert.deepEqual(output.folders.c.containers, []);
    assert.equal(output.conflictRejected, true);
    assert.equal(output.conflictPreservedConfig, true, 'conflicting destinations must not partially move an item');
    assert.equal(output.conflictPreservedRevision, true, 'rejected conflicts must not advance metadata');
    assert.equal(output.missingTargetRejected, true);
    assert.equal(output.missingTargetPreservedConfig, true, 'a missing target must reject every assignment');
    assert.equal(output.missingTargetPreservedRevision, true, 'a missing target must not advance metadata');
});

test('large shared bulk moves use exactly one server assignment request', async () => {
    const require = createRequire(import.meta.url);
    delete require.cache[require.resolve(bulkSharedPath)];
    const sharedModule = require(bulkSharedPath);
    const requests = [];
    const names = Array.from({ length: 125 }, (_, index) => `item-${index + 1}`);
    const api = sharedModule.createApi({
        requestBulkAssign: async (type, folderId, items) => {
            requests.push({ type, folderId, items: items.slice() });
            return { assigned: items.slice(), skippedInvalid: [] };
        },
        createBackup: async () => ({ name: 'atomic-test-backup' }),
        refreshType: async () => {},
        refreshBackups: async () => {},
        offerUndoAction: async () => {},
        trackDiagnosticsEvent: async () => {}
    });
    const result = await api.executeBulkAssignmentPlan('docker', {
        targetFolderId: 'target',
        targetFolderName: 'Target',
        selectedNames: names,
        actionableNames: names,
        invalidNames: [],
        alreadyAssignedNames: [],
        duplicateNames: []
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].items.length, 125);
    assert.equal(result.assignedCount, 125);
    assert.deepEqual(result.failedNames, []);
});

test('remaining multi-folder workflows route through atomic batch helpers', () => {
    assert.match(settings, /const requestFolderBatchMutation = async \(type, operations, options = \{\}\) =>/);
    assert.match(settings, /apiPostJson\('\/plugins\/folderview\.plus\/server\/batch\.php'/);
    assert.match(starter, /await requestFolderBatchMutation\(resolvedType, \{ deletes: \[\], upserts: \[\], creates \}\)/);
    assert.doesNotMatch(starter.slice(starter.indexOf('const quickCreateStarterTemplates ='), starter.indexOf('Object.assign(window')), /await apiPostText\([^\n]*server\/create\.php/);
    assert.match(wizard, /await requestFolderBatchMutation\(resolvedType, \{[\s\S]*upserts: changedFolderIds\.map/);
    assert.match(wizard, /await requestFolderBatchMutation\(resolvedType, \{ deletes: \[\], upserts: \[\], creates \}\)/);
    assert.match(treeIntegrity, /upserts: toRepair\.map\(\(id\) =>/);
    assert.match(treeIntegrity, /await requestFolderBatchMutation\(resolvedType,/);
    assert.match(settings, /assignments: JSON\.stringify\(Array\.from\(byFolder\.entries\(\)\)/);
    assert.match(endpoint, /bulkAssignItemsToFolders\(\$type, \$assignments\)/);
    assert.match(endpoint, /bulkAssignItemsToFolder\(\$type, \$folderId, \$itemsDecoded\)/);
    assert.match(lib, /const FVPLUS_MAX_BULK_ASSIGN_BATCH_ITEMS = 5000;/);
    assert.match(lib, /appendDiagnosticsHistoryEvent\('folder_batch_assignment'/);
    assert.doesNotMatch(bulkShared, /DEFAULT_BULK_ASSIGN_CHUNK/);
});
