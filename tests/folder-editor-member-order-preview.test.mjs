import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderPreviewJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview.js');
const folderMembersJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.members.js');
const folderCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css');

test('folder editor live preview renders members in current checked-table order', () => {
    assert.match(folderPreviewJs, /const memberNames = getIncludedMemberNames\(\);/);
    assert.match(folderPreviewJs, /const selectedMembers = memberNames\.map\(\(name\) => memberMap\.get\(name\)\)\.filter\(Boolean\);/);
});

test('folder editor live preview shows nested-folder sample when nested previews are hidden', () => {
    assert.match(folderPreviewJs, /const hideNestedPreviewItems = form\.preview_hide_nested_items\?\.checked === true;/);
    assert.match(folderPreviewJs, /const getNestedPreviewSample = typeof deps\.getNestedPreviewSample === 'function'/);
    assert.match(folderPreviewJs, /const nestedPreviewSample = getNestedPreviewSample\(\) \|\| \{\};/);
    assert.match(folderPreviewJs, /const nestedPreviewName = escapeHtml\(nestedPreviewSample\.name \|\| 'Child folder'\);/);
    assert.match(folderPreviewJs, /const nestedPreviewIcon = escapeHtml\(nestedPreviewSample\.icon \|\| icon \|\| deps\.defaultFolderIconPath \|\| ''\);/);
    assert.match(folderPreviewJs, /const nestedPreviewStatus = nestedPreviewCount === null/);
    assert.match(folderPreviewJs, /if \(hideNestedPreviewItems && previewMode !== 0\) \{/);
    assert.match(folderPreviewJs, /fv-live-member-child-folder/);
    assert.match(folderCss, /\.fv-live-member-child-folder \{/);
    assert.match(folderCss, /\.fv-live-member-child-folder \.fv-live-member-status \{/);
});

test('modern folder editor reordering resyncs member arrays and refreshes live preview', () => {
    assert.match(folderJs, /const getFolderEditorMembersApi = \(\) =>/);
    assert.match(folderJs, /const moveMemberRow = \(button, direction\) => \{\s*getFolderEditorMembersApi\(\)\?\.moveMemberRow\(button, direction\);\s*\};/);
    const moveBlockMatch = folderMembersJs.match(/const moveMemberRow = \(button, direction\) => \{([\s\S]*?)\n        \};/);
    assert.ok(moveBlockMatch, 'Expected extracted moveMemberRow block to exist.');
    const moveBlock = moveBlockMatch?.[1] || '';
    assert.match(moveBlock, /let moved = false;/);
    assert.match(moveBlock, /moved = true;/);
    assert.match(moveBlock, /if \(!moved\) \{\s*return;\s*\}/);
    assert.match(moveBlock, /syncMemberArraysFromTable\(\);/);
    assert.match(moveBlock, /updateLiveSummary\(\);/);
});
