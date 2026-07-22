import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const runtimeStateObserversJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.runtime.state-observers.js');
const folderIconApiJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icon-api.js');
const folderEditorPreviewRuntimeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview-runtime.js');
const folderEditorStateJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.state.js');
const folderEditorMembersJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.members.js');
const folderEditorIconsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icons.js');
const folderSettingsTransferJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js');
const bulkAssignmentSharedJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js');
const settingsActionSupportJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js');
const bulkAssignmentJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js');
const settingsRuntimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js');
const dockerRuntimeInfoJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.info.js');
const dockerPreviewActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.preview-actions.js');
const dockerRuntimeHierarchyJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js');
const dockerRuntimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');
const dockerRuntimeHostGuardsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.host-guards.js');
const dockerRuntimeDiagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.diagnostics.js');
const dockerRuntimeReconcileJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.reconcile.js');

test('extracted helper modules use a safe global fallback instead of out-of-scope root references', () => {
    for (const source of [
        runtimeStateObserversJs,
        folderIconApiJs,
        folderEditorPreviewRuntimeJs,
        folderEditorStateJs,
        folderEditorMembersJs,
        folderEditorIconsJs,
        folderSettingsTransferJs,
        bulkAssignmentSharedJs,
        settingsActionSupportJs,
        bulkAssignmentJs,
        settingsRuntimeActionsJs,
        dockerRuntimeInfoJs,
        dockerPreviewActionsJs,
        dockerRuntimeHierarchyJs,
        dockerRuntimeActionsJs,
        dockerRuntimeHostGuardsJs,
        dockerRuntimeDiagnosticsJs,
        dockerRuntimeReconcileJs
    ]) {
        assert.ok(
            /const fallbackWindow = typeof globalThis !== 'undefined'/.test(source)
                || !/(?:deps\.window|window\.)/.test(source),
            'modules that access a browser window must define a safe global fallback'
        );
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
