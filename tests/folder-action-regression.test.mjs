import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('dashboard docker folder action keeps restart distinct from resume', () => {
    assert.doesNotMatch(dashboardJs, /actionFolderDocker\(/);
    assert.doesNotMatch(dashboardJs, /case "resume":/);
    assert.doesNotMatch(dashboardJs, /case "restart":/);
});

test('dashboard folder action errors do not trigger an immediate second reload', () => {
    assert.match(dashboardJs, /window\.loadlist_original = loadlist;/);
    assert.match(dashboardJs, /\$\.ajaxPrefilter\(\(options,\s*originalOptions,\s*jqXHR\) => \{/);
    assert.match(dashboardJs, /jqXHR\.promise\(\)\.then\(\(\) => \{\s*queueCreateFoldersRender\(\)\s*\.then\(\(rendered\) => \{\s*loadedFolder = rendered !== false;/s);
    assert.match(dashboardJs, /\.catch\(\(\) => \{\s*loadedFolder = false;\s*\}\)\s*\.finally\(\(\) => \{\s*\$\('div\.spinner\.fixed'\)\.hide\(\);/s);
    assert.doesNotMatch(dashboardJs, /loadedFolder = !loadedFolder/);
    assert.doesNotMatch(dashboardJs, /if\(errors\.length > 0\) \{\s*swal\(\{/);
    assert.doesNotMatch(dashboardJs, /}, loadlist\);\s*}\s*loadlist\(\);\s*\$\('div\.spinner\.fixed'\)\.hide\('slow'\);/s);
});

test('vm pin persistence and folder action error handling avoid stale reloads', () => {
    assert.match(vmJs, /applyVmPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*refreshVmFolderQuickActionStates\(\);/s);
    assert.doesNotMatch(vmJs, /applyVmPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*refreshVmFolderQuickActionStates\(\);\s*queueLoadlistRefresh\(/s);
    assert.match(vmJs, /const assertVmPrefsSaveResponse = \(response, fallbackMessage = 'Failed to save VM preferences\.'\) => \{/);
    assert.match(vmJs, /const fetchVmPinnedFolderPrefs = async \(\) => \{/);
    assert.match(vmJs, /const confirmedPrefs = await fetchVmPinnedFolderPrefs\(\);/);
    assert.match(vmJs, /throw new Error\('VM pinned folders did not persist\.'\);/);
    assert.match(vmJs, /rememberVmPinnedFolderIdsOverride\(nextPinned\);/);
    assert.match(vmJs, /folderTypePrefs = applyVmPinnedFolderPrefsOverride\(normalizeVmPrefsResponse\(prefsResponse\)\);/);
    assert.match(vmJs, /const cacheBust = Date\.now\(\);\s*const safePrefsReq = createVmRuntimeRequest\(`\/plugins\/folderview\.plus\/server\/prefs\.php\?type=vm&_=\$\{cacheBust\}`/s);
    assert.match(vmJs, /if \(errors\.length > 0\) \{\s*swal\(\{[\s\S]*?\}, queueLoadlistRefresh\);\s*\} else \{\s*queueLoadlistRefresh\(\);\s*\}\s*\} finally \{/s);
    assert.doesNotMatch(vmJs, /}, queueLoadlistRefresh\);\s*}\s*queueLoadlistRefresh\(\);\s*} finally \{/s);
});

test('vm page reloads when settings changes vm pinned folders', () => {
    assert.match(vmJs, /const PINNED_FOLDER_CHANGE_STORAGE_KEY = 'fv\.folderviewplus\.pinnedFolders\.changed\.v1';/);
    assert.match(vmJs, /const PINNED_FOLDER_CHANGE_EVENT = 'fvplus:pinned-folders-changed';/);
    assert.match(vmJs, /const applyVmSettingsPinSyncPayload = \(payload\) => \{/);
    assert.match(vmJs, /const bindVmSettingsPinSyncListener = \(\) => \{/);
    assert.match(vmJs, /window\.addEventListener\('storage', \(event\) => \{/);
    assert.match(vmJs, /window\.addEventListener\(PINNED_FOLDER_CHANGE_EVENT, \(event\) => \{/);
    assert.match(vmJs, /payload\.type !== 'vm'/);
    assert.match(vmJs, /clearVmPinnedFolderIdsOverride\(\);\s*queueLoadlistRefresh\(\);/s);
    assert.match(vmJs, /queueLoadlistRefresh\(\);/);
});
