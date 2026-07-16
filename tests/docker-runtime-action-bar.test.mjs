import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');

test('Docker page mounts one responsive FolderView action bar instead of a standalone add button', () => {
    assert.match(dockerPage, /id=\"fvplus-docker-action-bar\"/);
    assert.doesNotMatch(dockerPage, /id=\"fvplus-docker-add-folder-btn\"/);
    assert.match(dockerJs, /const ensureDockerRuntimeActionBarHost = \(\) => \{/);
    assert.match(dockerJs, /renderDockerRuntimeActionBar\(normalizeDockerPageViewMode\(mode\)\)/);
    assert.match(dockerCss, /\.fvplus-docker-action-bar \{[\s\S]*flex-wrap: wrap/);
    assert.match(dockerCss, /@media \(max-width: 700px\)/);
});

test('FolderView action bar exposes the complete folder and troubleshooting control set', () => {
    for (const label of [
        'Add Folder',
        'Expand All',
        'Collapse All',
        'Unassigned',
        'Updates',
        'Empty',
        'Health Issues',
        'Manage Folders',
        'View',
        'Tools'
    ]) {
        assert.match(dockerJs, new RegExp(`label: '${label}'|<span>${label}</span>`));
    }
    for (const tool of [
        'Show empty folders',
        'Hide empty folders',
        'Clear folder focus',
        'Refresh folder state',
        'Bulk assignment',
        'Rules workspace',
        'Reset view'
    ]) {
        assert.match(dockerJs, new RegExp(tool));
    }
});

test('runtime filters use live hierarchy and container state without replacing saved folder order', () => {
    assert.match(dockerJs, /const summarizeDockerRuntimeToolbarState = \(\) => \{/);
    assert.match(dockerJs, /getScopedRuntimeContainersForFolder\(id, true\)/);
    assert.match(dockerJs, /status\.upToDate === false/);
    assert.match(dockerJs, /getFolderAncestors\(id\)\.forEach/);
    assert.match(dockerJs, /getFolderDescendants\(id\)\.forEach/);
    assert.match(dockerJs, /getFolderAncestors\(ownerId\)\.some/);
    assert.match(dockerJs, /row\.classList\.toggle\('fv-toolbar-filter-hidden', !visible\)/);
    assert.match(dockerJs, /dockerRuntimeFolderFilterMode !== 'all' && dockerFocusedFolderId/);
    assert.match(dockerCss, /#docker_list > tr\.fv-toolbar-filter-hidden \{[\s\S]*display: none !important/);
    assert.doesNotMatch(dockerJs, /dockerRuntimeFolderFilterMode[\s\S]{0,100}(localStorage|sessionStorage)/);
});

test('view and empty-folder preference changes use the immediate conflict-safe save path', () => {
    assert.match(dockerJs, /const saveDockerRuntimeToolbarPrefs = async \(patch, currentPrefs\) => \{/);
    assert.match(dockerJs, /dockerPrefsCoordinator\.save\('docker', patch, \{[\s\S]*currentPrefs,[\s\S]*immediate: true/);
    assert.match(dockerJs, /saveDockerRuntimeToolbarPrefs\(\{ pageViewMode: normalizedMode \}, nextPrefs\)/);
    assert.match(dockerJs, /saveDockerRuntimeToolbarPrefs\(\{ hideEmptyFolders \}, nextPrefs\)/);
    assert.match(dockerJs, /return Promise\.resolve\(\)[\s\S]*ensureDockerBootstrapPrefs\(\{ forceRefresh: true \}\)/);
});

test('view menu covers every supported mode and workspace routes remain targeted', () => {
    for (const mode of ['folderview', 'host', 'command', 'tree-explorer', 'orbit']) {
        assert.match(dockerJs, new RegExp(`value: '${mode}'`));
    }
    assert.match(dockerJs, /fvMode=basic&fvSection=docker/);
    assert.match(dockerJs, /fvAdvancedTab=automation&fvSection=bulk-assignment/);
    assert.match(dockerJs, /fvAdvancedTab=rules&fvSection=auto-assignment&fvRulesType=docker/);
});

test('action menus open upward and support dismissal plus keyboard navigation', () => {
    assert.match(dockerCss, /\.fvplus-docker-action-menu \{[\s\S]*bottom: calc\(100% \+ 0\.45rem\)/);
    assert.match(dockerJs, /event\.key === 'Escape' && dockerRuntimeActionMenuOpen/);
    assert.match(dockerJs, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
    assert.match(dockerJs, /aria-haspopup=\"menu\"/);
    assert.match(dockerJs, /role=\"menuitemradio\" aria-checked=/);
});
