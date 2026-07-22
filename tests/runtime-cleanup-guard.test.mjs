import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const dockerModulesJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.modules.js');
const runtimeSharedJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderTypeVmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-vm.js');
const memberIdentityJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.member-identity.js');
const previewModelJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.preview-model.js');
const settingsTransferJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js');
const activityDiagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const nativeOrganizerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.native-organizer.js');
const runtimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js');
const settingsHealthJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');

test('docker sortable refresh is guarded without an empty catch block', () => {
    assert.match(dockerJs, /const \$dockerList = \$\('#docker_list'\)/);
    assert.match(dockerJs, /const sortableInstance = \$dockerList\.data\('ui-sortable'\) \|\| \$dockerList\.data\('sortable'\)/);
    assert.match(dockerJs, /if \(sortableInstance\) \{\s*\$dockerList\.sortable\('refresh'\);/);
    assert.doesNotMatch(
        dockerJs,
        /try\s*\{\s*\$\('#docker_list'\)\.sortable\('refresh'\);\s*\}\s*catch\s*\(e\)\s*\{\s*\}/
    );
});

test('custom action handlers support legacy and corrected container key names', () => {
    for (const source of [dockerJs, vmJs]) {
        assert.match(source, /Array\.isArray\(act\.conatiners\)/);
        assert.match(source, /Array\.isArray\(act\.containers\)/);
    }
    assert.doesNotMatch(dashboardJs, /Array\.isArray\(act\.conatiners\)/);
    assert.doesNotMatch(dashboardJs, /Array\.isArray\(act\.containers\)/);
});

test('custom action handlers do not silently no-op on unsupported action modes', () => {
    for (const source of [dockerJs, vmJs]) {
        assert.doesNotMatch(source, /let ctAction = \(e\) => \{\s*\}/);
        assert.match(source, /let ctAction = null;/);
        assert.match(source, /if \(typeof ctAction === 'function'\)/);
        assert.match(source, /console\.warn\(`folderview\.plus: Unsupported/);
    }
    assert.doesNotMatch(dashboardJs, /let ctAction = null;/);
    assert.doesNotMatch(dashboardJs, /console\.warn\(`folderview\.plus: Unsupported/);
});

test('runtime helper APIs omit audited no-op and unconsumed surfaces', () => {
    for (const symbol of [
        'shouldSyncAfterSave',
        'flushPostSaveSync',
        'collectSectionRows',
        'applySectionTags',
        'getPreviewSignals',
        'buildSmartDefaultSuggestions'
    ]) {
        assert.doesNotMatch(folderTypeVmJs, new RegExp(`\\b${symbol}\\b`));
    }
    assert.doesNotMatch(folderJs, /createNoopFolderEditorTypeApi/);
    assert.doesNotMatch(dockerModulesJs, /\bsummarizeRuntimeState\b|\bstamp\b|enabled:\s*on/);
    assert.doesNotMatch(dockerJs, /stamp:\s*\(\)\s*=>/);
    assert.doesNotMatch(runtimeSharedJs, /return \{\s*enhance,\s*queueEnhance|\{ defer, hydrate, flush, snapshot, disconnect \}/);
    assert.doesNotMatch(memberIdentityJs, /\bbuildIdentityMapForMembers\b/);
    assert.doesNotMatch(previewModelJs, /\bcreatePreviewModel\b/);
    assert.doesNotMatch(settingsTransferJs, /\bclearClipboardEntry\b/);
    assert.doesNotMatch(activityDiagnosticsJs, /\bsyncDockerOrder\b/);
    assert.doesNotMatch(nativeOrganizerJs, /\bresetDockerOrganizerSync\b/);
    assert.doesNotMatch(runtimeActionsJs, /\bscanFolderTreeIntegrity\b/);
});

test('settings health metrics do not retain unused aggregate state', () => {
    assert.doesNotMatch(settingsJs, /\bhealthMetricsByType\b/);
    assert.doesNotMatch(settingsHealthJs, /\bhealthScoreTotals\b|\baverageHealthScore\b/);
    assert.doesNotMatch(settingsHealthJs, /\binvalidRuleRegexCount\b|\bconflictItemCount\b|\bmemberTotals\b/);
    assert.doesNotMatch(settingsJs, /\bhealthFilterByType\b|\bsetHealthFolderFilter\b|\bnormalizeHealthFilterMode\b/);
    assert.doesNotMatch(settingsHealthJs, /\bfolderMatchesHealthFilter\b|\bgetHealthFilterLabel\b/);
});
