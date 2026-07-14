import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const settingsScript = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const rowDetailsScript = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.row-details.js');
const folderEditorScript = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');

test('settings no longer exposes Status Details launchers or popup implementation', () => {
    for (const source of [settingsScript, rowDetailsScript, folderEditorScript]) {
        assert.doesNotMatch(source, /showFolderStatusBreakdown|getFolderStatusBreakdown/);
        assert.doesNotMatch(source, /Status breakdown|Status details|Open status breakdown|Open status details/);
    }
    assert.doesNotMatch(settingsScript, /status-breakdown-btn|fa-bar-chart/);
    assert.doesNotMatch(rowDetailsScript, /fv-status-modal|fv-status-breakdown-modal|Refresh status/);
    assert.doesNotMatch(folderEditorScript, /id:\s*'status'|\['status'/);
    assert.doesNotMatch(settingsCss, /\.status-breakdown-btn|\.fv-status-modal|\.fv-status-breakdown-modal/);
    assert.doesNotMatch(settingsScript, /const sourceStatus\s*=/);
    assert.match(settingsScript, /statusFilterByType\[resolvedType\] = 'all';/);
});

test('inline status summaries and Docker health details remain available', () => {
    assert.match(settingsScript, /statusSummaryChipHtml/);
    assert.match(settingsScript, /statusBreakdownHtml/);
    assert.match(settingsScript, /toggleStatusFilter/);
    assert.match(rowDetailsScript, /showFolderHealthBreakdown/);
    assert.match(settingsScript, /health-breakdown-btn/);
});
