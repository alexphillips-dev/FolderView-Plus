import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const libPrefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php');
const utilsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const runtimeStateObserverJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.runtime.state-observers.js');

test('server prefs contract keeps expandedFolderState default and normalization', () => {
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.prefs\.php'\);/);
    assert.match(libPrefsPhp, /'expandedFolderState'\s*=>\s*\[\]/);
    assert.match(libPrefsPhp, /\$normalized\['expandedFolderState'\]\s*=\s*normalizeExpandedStateMap\(\$prefs\['expandedFolderState'\]\s*\?\?\s*\[\]\);/);
    assert.match(libPrefsPhp, /'dashboard'\s*=>\s*\[/);
    assert.match(libPrefsPhp, /'layout'\s*=>\s*'classic'/);
    assert.match(libPrefsPhp, /'expandToggle'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'greyscale'\s*=>\s*false/);
    assert.match(libPrefsPhp, /'folderLabel'\s*=>\s*true/);
    assert.match(libPrefsPhp, /\$dashboardIncoming\s*=\s*is_array\(\$prefs\['dashboard'\]\s*\?\?\s*null\)\s*\?\s*\$prefs\['dashboard'\]\s*:\s*\[\];/);
    assert.match(libPrefsPhp, /\$normalized\['dashboard'\]\s*=\s*\[/);
    assert.match(libPrefsPhp, /'layout'\s*=>\s*normalizeDashboardLayout\(\$dashboardIncoming\['layout'\]\s*\?\?\s*'classic'\)/);
});

test('shared prefs normalizer keeps expandedFolderState map support', () => {
    assert.match(utilsJs, /const normalizeExpandedFolderStateMap = \(value\) =>/);
    assert.match(utilsJs, /const expandedFolderState = normalizeExpandedFolderStateMap\(incoming\.expandedFolderState\);/);
    assert.match(utilsJs, /expandedFolderState,\s*[\r\n]+\s*hideEmptyFolders,/);
});

test('docker runtime keeps server-backed expanded state sync contract', () => {
    assert.match(dockerJs, /const readDockerServerExpandedStateMap = \(\) =>/);
    assert.match(dockerJs, /createExpandedStateController\(/);
    assert.match(dockerJs, /type:\s*'docker'/);
    assert.match(dockerJs, /syncDelayMs:\s*DOCKER_EXPANDED_STATE_SYNC_DELAY_MS,/);
    assert.match(dockerJs, /readServerMap:\s*\(\) => folderTypePrefs\?\.expandedFolderState \|\| \{\},/);
    assert.match(dockerJs, /writeServerMap:\s*\(map\) => \{/);
    assert.match(runtimeStateObserverJs, /win\.FolderViewPlusRequest/);
    assert.match(runtimeStateObserverJs, /\/plugins\/folderview\.plus\/server\/prefs\.php/);
    assert.match(runtimeStateObserverJs, /expandedFolderState:\s*payloadMap/);
    assert.match(dockerJs, /buildDockerExpandedStateMap\(\s*foldersDone,\s*previousFolders,\s*readDockerServerExpandedStateMap\(\)\s*\)/);
});

test('vm runtime keeps server-backed expanded state sync contract', () => {
    assert.match(vmJs, /const readVmServerExpandedStateMap = \(\) =>/);
    assert.match(vmJs, /const syncVmExpandedStateToServer = async \(\) =>/);
    assert.match(vmJs, /createExpandedStateController\(/);
    assert.match(vmJs, /type:\s*'vm'/);
    assert.match(runtimeStateObserverJs, /win\.FolderViewPlusRequest/);
    assert.match(runtimeStateObserverJs, /\/plugins\/folderview\.plus\/server\/prefs\.php/);
    assert.match(runtimeStateObserverJs, /expandedFolderState:\s*payloadMap/);
    assert.match(vmJs, /buildVmExpandedStateMap\(\s*foldersDone,\s*previousFolders,\s*readVmServerExpandedStateMap\(\)\s*\)/);
});

test('dashboard runtime keeps local expanded-state memory for docker and vm widgets', () => {
    assert.match(dashboardJs, /const DASHBOARD_EXPANDED_STATE_STORAGE_KEYS = Object\.freeze\(/);
    assert.match(dashboardJs, /fvplus\.runtime\.expand\.dashboard\.docker\.v1/);
    assert.match(dashboardJs, /fvplus\.runtime\.expand\.dashboard\.vm\.v1/);
    assert.match(dashboardJs, /const readDashboardExpandedStateMap = \(type\) =>/);
    assert.match(dashboardJs, /const applyDashboardExpandedStateChanges = \(type,\s*changes\) =>/);
    assert.match(dashboardJs, /persistExpandedState:\s*false/);
});
