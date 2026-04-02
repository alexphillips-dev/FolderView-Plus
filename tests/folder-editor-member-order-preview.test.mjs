import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderPreviewJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview.js');

test('folder editor live preview renders members in current checked-table order', () => {
    assert.match(folderPreviewJs, /const memberNames = getIncludedMemberNames\(\);/);
    assert.match(folderPreviewJs, /const selectedMembers = memberNames\.map\(\(name\) => memberMap\.get\(name\)\)\.filter\(Boolean\);/);
});

test('modern folder editor reordering resyncs member arrays and refreshes live preview', () => {
    const moveBlockMatch = folderJs.match(/const moveMemberRow = \(button, direction\) => \{([\s\S]*?)\n\};/);
    assert.ok(moveBlockMatch, 'Expected modern moveMemberRow block to exist.');
    const moveBlock = moveBlockMatch?.[1] || '';
    assert.match(moveBlock, /let moved = false;/);
    assert.match(moveBlock, /moved = true;/);
    assert.match(moveBlock, /if \(!moved\) \{\s*return;\s*\}/);
    assert.match(moveBlock, /syncMemberArraysFromTable\(\);/);
    assert.match(moveBlock, /updateLiveSummary\(\);/);
});
