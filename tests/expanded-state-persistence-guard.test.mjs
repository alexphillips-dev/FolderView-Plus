import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const utilsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('server prefs contract keeps expandedFolderState default and normalization', () => {
    assert.match(libPhp, /'expandedFolderState'\s*=>\s*\[\]/);
    assert.match(libPhp, /\$normalized\['expandedFolderState'\]\s*=\s*normalizeExpandedStateMap\(\$prefs\['expandedFolderState'\]\s*\?\?\s*\[\]\);/);
    assert.match(libPhp, /'dashboard'\s*=>\s*\[/);
    assert.match(libPhp, /'layout'\s*=>\s*'classic'/);
    assert.match(libPhp, /'expandToggle'\s*=>\s*true/);
    assert.match(libPhp, /'greyscale'\s*=>\s*false/);
    assert.match(libPhp, /'folderLabel'\s*=>\s*true/);
    assert.match(libPhp, /\$dashboardIncoming\s*=\s*is_array\(\$prefs\['dashboard'\]\s*\?\?\s*null\)\s*\?\s*\$prefs\['dashboard'\]\s*:\s*\[\];/);
    assert.match(libPhp, /\$normalized\['dashboard'\]\s*=\s*\[/);
    assert.match(libPhp, /'layout'\s*=>\s*normalizeDashboardLayout\(\$dashboardIncoming\['layout'\]\s*\?\?\s*'classic'\)/);
});

test('shared prefs normalizer keeps expandedFolderState map support', () => {
    assert.match(utilsJs, /const normalizeExpandedFolderStateMap = \(value\) =>/);
    assert.match(utilsJs, /const expandedFolderState = normalizeExpandedFolderStateMap\(incoming\.expandedFolderState\);/);
    assert.match(utilsJs, /expandedFolderState,\s*[\r\n]+\s*hideEmptyFolders,/);
});

test('docker runtime keeps server-backed expanded state sync contract', () => {
    assert.match(dockerJs, /const readDockerServerExpandedStateMap = \(\) =>/);
    assert.match(dockerJs, /const syncDockerExpandedStateToServer = async \(\) =>/);
    assert.match(dockerJs, /window\.FolderViewPlusRequest/);
    assert.match(dockerJs, /\/plugins\/folderview\.plus\/server\/prefs\.php/);
    assert.match(dockerJs, /type:\s*'docker'/);
    assert.match(dockerJs, /expandedFolderState:\s*payloadMap/);
    assert.match(dockerJs, /buildDockerExpandedStateMap\(\s*foldersDone,\s*previousFolders,\s*readDockerServerExpandedStateMap\(\)\s*\)/);
});

test('vm runtime keeps server-backed expanded state sync contract', () => {
    assert.match(vmJs, /const readVmServerExpandedStateMap = \(\) =>/);
    assert.match(vmJs, /const syncVmExpandedStateToServer = async \(\) =>/);
    assert.match(vmJs, /window\.FolderViewPlusRequest/);
    assert.match(vmJs, /\/plugins\/folderview\.plus\/server\/prefs\.php/);
    assert.match(vmJs, /type:\s*'vm'/);
    assert.match(vmJs, /expandedFolderState:\s*payloadMap/);
    assert.match(vmJs, /buildVmExpandedStateMap\(\s*foldersDone,\s*previousFolders,\s*readVmServerExpandedStateMap\(\)\s*\)/);
});
