import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const hiddenFoldersJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hidden-folders.js');
const require = createRequire(import.meta.url);
const hiddenFoldersModule = require(path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hidden-folders.js'));
const prefsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-prefs.js');
const libPrefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php');
const validationPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php');
const diagnosticsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics-support-bundle.php');
const pageDiagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.page-diagnostics.js');

test('hidden folder ids use normalized conflict-safe server preferences', () => {
    assert.match(libPrefsPhp, /'hiddenFolderIds'\s*=>\s*\[\]/);
    assert.match(libPrefsPhp, /\$normalized\['hiddenFolderIds'\]\s*=\s*normalizeStringIdList/);
    assert.match(validationPhp, /fvplus_validation_assert_list_of_scalarish\(\$payload\['hiddenFolderIds'\], 'hiddenFolderIds'/);
    assert.match(prefsJs, /const hiddenFolderIds = normalizeStringIdList\(incoming\.hiddenFolderIds\)/);
    assert.match(hiddenFoldersJs, /savePrefs\(\{ hiddenFolderIds \}/);
    assert.match(hiddenFoldersJs, /safeActionRunner\.run\('docker-hidden-folders'/);
    assert.match(hiddenFoldersJs, /queueIfBusy:\s*true/);
    assert.match(hiddenFoldersJs, /if \(!intent\.isLatest\(\)\) return/);
    assert.match(hiddenFoldersJs, /pendingIdsOverride = \{ ids: normalizeIds\(nextIds\), expiresAt:/);
    assert.match(dockerJs, /dockerHiddenFoldersApi\.reconcilePrefs\(applyDockerPinnedFolderPrefsOverride/);
});

test('hidden parent folders suppress their complete visual branch without changing membership', () => {
    assert.match(hiddenFoldersJs, /cursor = normalizeParentId\(folder\?\.parentId \|\| folder\?\.parent_id \|\| ''\)/);
    assert.match(hiddenFoldersJs, /const ownerId = folderId \|\| readFolderOwnerFromRow\(row\)/);
    assert.match(hiddenFoldersJs, /\$row\.toggleClass\('fv-folder-user-hidden', hidden\)/);
    assert.match(hiddenFoldersJs, /if \(hidden && getOwnerId\(getFocusedFolderId\(\)\)\) clearFocusedFolder\(\)/);
});

test('hidden-folder hierarchy resolves explicit ancestors without exposing identities', () => {
    const prefs = { hiddenFolderIds: ['root', 'root', ''] };
    const api = hiddenFoldersModule.createApi({
        getPrefs: () => prefs,
        getFolders: () => ({ root: {}, child: { parentId: 'root' }, other: {} }),
        normalizeParentId: (value) => String(value || '')
    });
    assert.deepEqual(api.normalizeIds(prefs.hiddenFolderIds), ['root']);
    assert.equal(api.getOwnerId('child'), 'root');
    assert.equal(api.getOwnerId('other'), '');
    assert.deepEqual(api.getSummary().effectiveIds.sort(), ['child', 'root']);
});

test('newer optimistic hidden-folder intent survives an older preference broadcast', () => {
    let prefs = { hiddenFolderIds: [] };
    const emptyCollection = { toggleClass: () => emptyCollection, each: () => emptyCollection };
    const api = hiddenFoldersModule.createApi({
        $: () => emptyCollection,
        getPrefs: () => prefs,
        setPrefs: (value) => { prefs = value; },
        normalizePrefs: (value) => ({ ...value, hiddenFolderIds: Array.isArray(value.hiddenFolderIds) ? value.hiddenFolderIds : [] }),
        getFolders: () => ({ root: {} }),
        runtimeStateStore: { set: () => {} },
        safeActionRunner: {
            run: (_key, _action, settings) => {
                settings.onIntent({ isLatest: () => true });
                return new Promise(() => {});
            }
        }
    });
    void api.hideFolder('root');
    assert.deepEqual(api.reconcilePrefs({ hiddenFolderIds: [] }).hiddenFolderIds, ['root']);
});

test('hidden-folder diagnostics retain counts and hash folder identities', () => {
    assert.match(diagnosticsPhp, /prefs\.hiddenFolders\.\*/);
    assert.match(diagnosticsPhp, /diagnosticsSupportBundleRedactFolderIdList/);
    assert.match(pageDiagnosticsJs, /hiddenFolderSelections/);
    assert.match(pageDiagnosticsJs, /effectivelyHiddenFolders/);
    assert.match(pageDiagnosticsJs, /revealHiddenFolders/);
});
