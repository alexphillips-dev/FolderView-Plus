import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const runtimeStateObserversJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.runtime.state-observers.js');
const dockerMemberMenuJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.member-menu.js');
const folderIconApiJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icon-api.js');
const folderEditorStateJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.state.js');
const folderEditorMembersJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.members.js');
const settingsActionSupportJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js');

test('extracted helper modules use a safe global fallback instead of out-of-scope root references', () => {
    for (const source of [
        runtimeStateObserversJs,
        dockerMemberMenuJs,
        folderIconApiJs,
        folderEditorStateJs,
        folderEditorMembersJs,
        settingsActionSupportJs
    ]) {
        assert.match(source, /const fallbackWindow = typeof globalThis !== 'undefined'/);
        assert.doesNotMatch(source, /deps\.window \|\| root/);
        assert.doesNotMatch(source, /root\.location/);
    }
});

test('runtime state observers can expose normalization helpers without requiring window deps at construction time', () => {
    assert.match(runtimeStateObserversJs, /const normalizeExpandedStateMap = \(value\) =>/);
    assert.match(runtimeStateObserversJs, /const createExpandedStateController = \(deps = \{\}\) =>/);
    assert.match(runtimeStateObserversJs, /const win = deps\.window \|\| fallbackWindow;/);
    assert.match(runtimeStateObserversJs, /const createThemeReflowController = \(deps = \{\}\) =>/);
});
