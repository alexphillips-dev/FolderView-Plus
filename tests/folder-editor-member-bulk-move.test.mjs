import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderMembersJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.members.js');
const bulkSharedJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js');
const folderCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css');

test('folder editor members module exposes bulk move scope helpers with regex-safe skipping', () => {
    assert.match(folderMembersJs, /const MEMBER_BULK_SCOPE_VALUES = Object\.freeze\(new Set\(\['shown', 'included_shown', 'excluded_shown', 'all_included'\]\)\);/);
    assert.match(folderMembersJs, /const collectBulkMoveScope = \(scope = 'shown'\) =>/);
    assert.match(folderMembersJs, /if \(membership === 'regex'\) \{\s*skippedRegexNames\.push\(name\);/);
    assert.match(folderMembersJs, /movableCount: names\.length/);
});

test('shared bulk assignment module provides plan building and atomic execution helpers', () => {
    assert.match(bulkSharedJs, /FolderViewPlusBulkAssignmentSharedModuleLoaded = true/);
    assert.match(bulkSharedJs, /const buildBulkAssignmentPlan = \(type,\s*folderId,\s*namesInput = null\) =>/);
    assert.match(bulkSharedJs, /const buildBulkAssignmentPreludeLines = \(plan,\s*options = \{\}\) =>/);
    assert.match(bulkSharedJs, /const executeBulkAssignmentPlan = async \(type,\s*planInput,\s*options = \{\}\) =>/);
    assert.match(bulkSharedJs, /const result = await requestBulkAssign\(resolvedType, targetFolderId, actionableNames, options\.expectedRevision, createSafetyBackup\);/);
    assert.doesNotMatch(bulkSharedJs, /DEFAULT_BULK_ASSIGN_CHUNK/);
});

test('editor bulk move requests the checkpoint within the revision-guarded assignment', async () => {
    const start = folderJs.indexOf('const getFolderBulkAssignmentSharedApi =');
    const end = folderJs.indexOf('const updateUnsavedIndicator', start);
    const shared = createRequire(import.meta.url)(path.resolve(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js'));
    const requests = [];
    let rejectRevision = false;
    const checkpoint = { name: 'fixture-editor-checkpoint.json' };
    const mount = new Function('bulkAssignmentSharedModule', 'window', 'requestClient', `
        const utils = {};
        const allFoldersById = { source: { containers: ['fixture'] }, target: { containers: [] } };
        let folderBulkAssignmentSharedApi;
        ${folderJs.slice(start, end)}
        return getFolderBulkAssignmentSharedApi();
    `);
    const api = mount(shared, {}, {
        postJson: async (url, data) => {
            requests.push({ url, data });
            if (rejectRevision) throw new Error('Stale folder revision');
            return { ok: true, result: { assigned: ['fixture'], backup: checkpoint, metadata: { folderRevision: 8 } } };
        }
    });
    const plan = api.buildBulkAssignmentPlan('vm', 'target', ['fixture']);
    const options = { expectedRevision: 7, createSafetyBackup: true };
    assert.match(folderJs, /operationScope: 'editor-bulk-move',[\s\S]{0,250}createSafetyBackup: true/);
    const applied = await api.executeBulkAssignmentPlan('vm', plan, options);
    assert.deepEqual(applied.backup, checkpoint);
    assert.equal(applied.metadata.folderRevision, 8);
    assert.equal(applied.assignedCount, 1);
    rejectRevision = true;
    const rejected = await api.executeBulkAssignmentPlan('vm', plan, options);
    assert.equal(rejected.backup, null);
    assert.equal(rejected.assignedCount, 0);
    assert.deepEqual(rejected.failedNames, ['fixture']);
    assert.deepEqual(requests, Array(2).fill({
        url: '/plugins/folderview.plus/server/bulk_assign.php',
        data: { type: 'vm', folderId: 'target', items: '["fixture"]', expectedRevision: 7, createSafetyBackup: 1 }
    }));
});

test('folder editor members tab renders compact bulk move controls and blocks unsafe local member drift', () => {
    assert.match(folderJs, /const MEMBER_BULK_SCOPE_OPTIONS = Object\.freeze\(\[/);
    assert.match(folderJs, /id="fvMemberBulkScope"/);
    assert.match(folderJs, /id="fvMemberBulkTarget"/);
    assert.match(folderJs, /id="fvMemberBulkMove"/);
    assert.match(folderJs, /id="fvMemberBulkSummary"/);
    assert.match(folderJs, /if \(getSectionChangeItems\('members'\)\.length > 0\) \{/);
    assert.match(folderJs, /Save member edits first/);
    assert.match(folderJs, /renderMemberBulkMoveTargets\(\);/);
    assert.match(folderJs, /applyMemberBulkMoveResultLocally\(plan\.targetFolderId/);
    assert.match(folderJs, /syncMemberSnapshotBaseline\(\);/);
    assert.match(folderJs, /baseline\.fields\['containers\[\]'\] = current\.fields\['containers\[\]'\];/);
    assert.match(folderJs, /selected = selected\.filter\(\(member\) => \{/);
    assert.match(folderJs, /choose = choose\.filter\(\(member\) => \{/);
    assert.match(folderJs, /memberBulkMoveUndoState = \{/);
    assert.match(folderJs, /id="fvMemberBulkUndo"/);
    assert.match(folderJs, /void undoEditorMemberBulkMove\(\);/);
    assert.doesNotMatch(folderJs, /choose = mergeMembersByName\(choose, movedSelectedMembers\);/);
    assert.doesNotMatch(folderJs, /title: 'Bulk move complete'/);
});

test('folder editor styles include dedicated member bulk move layout hooks', () => {
    assert.match(folderCss, /\.fv-member-bulk-row\s*\{/);
    assert.match(folderCss, /\.fv-member-bulk-controls\s*\{/);
    assert.match(folderCss, /\.fv-member-bulk-summary\s*\{/);
    assert.match(folderCss, /\.fv-member-bulk-inline-action\s*\{/);
});

test('editor only publishes a mutation revision alongside its matching folder map', async () => {
    const start = folderJs.indexOf('const reconcileEditorFolderMutation =');
    const end = folderJs.indexOf('async function applyEditorMemberBulkMove()', start);
    const load = new Function('requestClient', 'utils', 'type', `
        let folderEditorExpectedFolderRevision = 3;
        let allFoldersById = { original: { name: 'Original' } };
        ${folderJs.slice(start, end)}
        return { reconcile: reconcileEditorFolderMutation, state: () => ({ folderEditorExpectedFolderRevision, allFoldersById }) };
    `);
    const folders = { updated: { name: 'Updated' } };
    for (const revision of [4, 5]) {
        const runtime = load({
            getJson: async (_endpoint, options) => {
                assert.equal(options.data.includeMetadata, 1);
                return { folders, metadata: { folderRevision: revision } };
            }
        }, { normalizeFolderMap: value => value }, 'vm');
        await runtime.reconcile(3, 4);
        assert.deepEqual(runtime.state(), revision === 4
            ? { folderEditorExpectedFolderRevision: 4, allFoldersById: folders }
            : { folderEditorExpectedFolderRevision: 3, allFoldersById: { original: { name: 'Original' } } });
    }
});

test('bulk move undo sends the committed folder revision and respects the editor draft guard', async () => {
    const start = folderJs.indexOf('const restoreEditorBulkMoveBackup =');
    const end = folderJs.indexOf('const reconcileEditorFolderMutation =', start);
    let dirty = true;
    let reloaded = false;
    const requests = [];
    const run = new Function('location', 'getAllChangedItems', 'requestClient', 'swal', `
        const type = 'vm';
        let suppressUnloadPrompt = false;
        let memberBulkMoveInFlight = false;
        let memberBulkMoveUndoInFlight = false;
        let memberBulkMoveUndoState = { backupName: 'fixture.json', expectedFolderRevision: 7 };
        const surfaceT = (_key, fallback) => fallback;
        const updateMemberBulkMoveUi = () => {};
        const clearMemberBulkMoveUndoState = () => { memberBulkMoveUndoState = null; memberBulkMoveUndoInFlight = false; };
        ${folderJs.slice(start, end)}
        return { undo: undoEditorMemberBulkMove, isPromptSuppressed: () => suppressUnloadPrompt };
    `)({ reload() { reloaded = true; } }, () => dirty ? ['draft'] : [], {
        async postJson(url, post) { requests.push({ url, post }); return { ok: true }; }
    }, () => {});
    assert.equal(await run.undo(), false);
    assert.deepEqual(requests, []);
    assert.equal(reloaded, false);
    dirty = false;
    assert.equal(await run.undo(), true);
    assert.deepEqual(requests, [{
        url: '/plugins/folderview.plus/server/backup.php',
        post: { type: 'vm', action: 'restore', name: 'fixture.json', expectedFolderRevision: 7 }
    }]);
    assert.equal(run.isPromptSuppressed(), false);
    assert.equal(reloaded, true);
});

test('folder-only editor Undo restores mixed member positions, preserves prefs, and rejects stale revisions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-editor-undo-'));
    const config = path.join(root, 'config');
    const documentRoot = path.join(root, 'document-root');
    fs.mkdirSync(config);
    fs.mkdirSync(documentRoot);
    const libraryPath = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php').replaceAll('\\', '/');
    const fixture = `<?php
class Libvirt {
    public function connect(): bool { return false; }
    public function get_domains(): array { return []; }
}
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require ${JSON.stringify(libraryPath)};
$type = 'vm';
$start = normalizeFolderMapPayload([
    'src-a' => ['name' => 'A', 'containers' => ['one']],
    'src-b' => ['name' => 'B', 'containers' => ['two']],
    'target' => ['name' => 'Target', 'containers' => ['existing']]
]);
writeRawFolderMap($type, $start);
writeTypePrefs($type, normalizeTypePrefs(['groupUnassignedItems' => false]));
$base = readConfigMetadata($type, true)['folderRevision'];
$move = bulkAssignItemsToFolder($type, 'target', ['one', 'two', 'unassigned'], $base, true);
$backup = $move['backup'];
$moved = readRawFolderMap($type);
writeTypePrefs($type, normalizeTypePrefs(['groupUnassignedItems' => true]));
$prefsBeforeUndo = readTypePrefs($type);
$revision = $move['metadata']['folderRevision'];
$restore = restoreBackupSnapshot($type, $backup['name'], ['expectedFolderRevision' => $revision]);
$restored = readRawFolderMap($type);
$safety = readBackupSnapshot($type, $restore['backup']['name']);
$preservesPrefs = $prefsBeforeUndo === readTypePrefs($type) && !$restore['prefsRestored'];
$move = bulkAssignItemsToFolder($type, 'target', ['one'], readConfigMetadata($type, true)['folderRevision'], true);
$newBackup = $move['backup'];
$later = readRawFolderMap($type);
$later['src-b']['icon'] = 'later.png';
writeRawFolderMap($type, $later);
$later = readRawFolderMap($type);
$count = count(listBackupSnapshots($type));
$rejected = false;
try { restoreBackupSnapshot($type, $newBackup['name'], ['expectedFolderRevision' => $move['metadata']['folderRevision']]); }
catch (FVPlusConfigConflictException $error) { $rejected = true; }
echo json_encode([
    'restored' => $restored === $start, 'preservesPrefs' => $preservesPrefs,
    'safetySnapshot' => $safety['folders'] === $moved && $safety['prefs'] === $prefsBeforeUndo,
    'staleRejected' => $rejected && $later === readRawFolderMap($type) && $count === count(listBackupSnapshots($type)),
    'movedMembers' => $moved['target']['containers']
]);
`;
    const filename = path.join(root, 'fixture.php');
    fs.writeFileSync(filename, fixture);
    try {
        const result = JSON.parse(execFileSync('php', [filename], { encoding: 'utf8', env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: config, FVPLUS_TEST_STORAGE_DIR: config,
            FVPLUS_TEST_SOURCE_DIR: root, FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
        } }));
        assert.deepEqual(result, {
            restored: true, preservesPrefs: true, safetySnapshot: true, staleRejected: true,
            movedMembers: ['existing', 'one', 'two', 'unassigned']
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
