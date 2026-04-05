import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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

test('shared bulk assignment module provides plan building and chunked execution helpers', () => {
    assert.match(bulkSharedJs, /FolderViewPlusBulkAssignmentSharedModuleLoaded = true/);
    assert.match(bulkSharedJs, /const buildBulkAssignmentPlan = \(type,\s*folderId,\s*namesInput = null\) =>/);
    assert.match(bulkSharedJs, /const buildBulkAssignmentPreludeLines = \(plan,\s*options = \{\}\) =>/);
    assert.match(bulkSharedJs, /const executeBulkAssignmentPlan = async \(type,\s*planInput,\s*options = \{\}\) =>/);
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
