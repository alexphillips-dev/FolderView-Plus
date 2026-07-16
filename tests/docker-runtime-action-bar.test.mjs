import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const actionBarJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.action-bar.js');
const require = createRequire(import.meta.url);
const actionBarModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.action-bar.js'
));
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');

test('Docker page mounts one responsive FolderView action bar instead of a standalone add button', () => {
    assert.match(dockerPage, /id=\"fvplus-docker-action-bar\"/);
    assert.doesNotMatch(dockerPage, /id=\"fvplus-docker-add-folder-btn\"/);
    assert.match(dockerPage, /scripts\/docker\.runtime\.action-bar\.js/);
    assert.match(actionBarJs, /const ensureHost = \(\) => \{/);
    assert.match(dockerJs, /FolderViewPlusDockerRuntimeActionBar/);
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
        assert.match(actionBarJs, new RegExp(`label: '${label}'|<span>${label}</span>`));
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
        assert.match(actionBarJs, new RegExp(tool));
    }
});

test('runtime filters use live hierarchy and container state without replacing saved folder order', () => {
    assert.match(actionBarJs, /const summarize = \(\) => \{/);
    assert.match(dockerJs, /getScopedContainers: \(id\) => getScopedRuntimeContainersForFolder\(id, true\)/);
    assert.match(actionBarJs, /status\.upToDate === false/);
    assert.match(actionBarJs, /getFolderAncestors\(id\)\.forEach/);
    assert.match(actionBarJs, /getFolderDescendants\(id\)\.forEach/);
    assert.match(actionBarJs, /getFolderAncestors\(ownerId\)\.some/);
    assert.match(actionBarJs, /row\.classList\?\.toggle\('fv-toolbar-filter-hidden', !visible\)/);
    assert.match(actionBarJs, /folderFilterMode !== 'all' && getFocusedFolderId\(\)/);
    assert.match(dockerCss, /#docker_list > tr\.fv-toolbar-filter-hidden \{[\s\S]*display: none !important/);
    assert.doesNotMatch(actionBarJs, /folderFilterMode[\s\S]{0,100}(localStorage|sessionStorage)/);
});

test('view and empty-folder preference changes use the immediate conflict-safe save path', () => {
    assert.match(dockerJs, /const saveDockerRuntimeToolbarPrefs = async \(patch, currentPrefs\) => \{/);
    assert.match(dockerJs, /dockerPrefsCoordinator\.save\('docker', patch, \{[\s\S]*currentPrefs,[\s\S]*immediate: true/);
    assert.match(actionBarJs, /savePrefs\(\{ pageViewMode: normalizedMode \}, nextPrefs\)/);
    assert.match(actionBarJs, /savePrefs\(\{ hideEmptyFolders \}, nextPrefs\)/);
    assert.match(dockerJs, /return Promise\.resolve\(\)[\s\S]*ensureDockerBootstrapPrefs\(\{ forceRefresh: true \}\)/);
});

test('view menu covers every supported mode and workspace routes remain targeted', () => {
    for (const mode of ['folderview', 'host', 'command', 'tree-explorer', 'orbit']) {
        assert.match(actionBarJs, new RegExp(`value: '${mode}'`));
    }
    assert.match(actionBarJs, /fvMode=basic&fvSection=docker/);
    assert.match(actionBarJs, /fvAdvancedTab=automation&fvSection=bulk-assignment/);
    assert.match(actionBarJs, /fvAdvancedTab=rules&fvSection=auto-assignment&fvRulesType=docker/);
});

test('action menus use viewport-aware fixed positioning and support dismissal plus keyboard navigation', () => {
    assert.match(dockerCss, /\.fvplus-docker-action-menu \{[\s\S]*position: fixed/);
    assert.match(dockerCss, /\.fvplus-docker-action-menu\.is-open\.is-positioned \{[\s\S]*visibility: visible/);
    assert.match(actionBarJs, /const positionOpenMenu = \(\) => \{/);
    assert.match(actionBarJs, /const opensUp = menuHeight > spaceBelow && spaceAbove > spaceBelow/);
    assert.match(actionBarJs, /win\?\.addEventListener\?\.\('scroll', queueOpenMenuPosition, true\)/);
    assert.match(actionBarJs, /event\.key === 'Escape' && actionMenuOpen/);
    assert.match(actionBarJs, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
    assert.match(actionBarJs, /aria-haspopup=\"menu\"/);
    assert.match(actionBarJs, /role=\"menuitemradio\" aria-checked=/);
});

test('extracted action bar computes live counters and hierarchy-aware row visibility', () => {
    const makeClassList = () => {
        const values = new Set();
        return {
            contains: (value) => values.has(value),
            add: (value) => values.add(value),
            remove: (value) => values.delete(value),
            toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value),
            has: (value) => values.has(value)
        };
    };
    const makeRow = (kind, id = '') => ({
        kind,
        id,
        classList: makeClassList(),
        querySelector: (selector) => kind === 'unassigned' && selector.includes('.ct-name') ? {} : null
    });
    const rows = [
        makeRow('folder', 'root'),
        makeRow('folder', 'updates'),
        makeRow('member', 'root'),
        makeRow('member', 'updates'),
        makeRow('unassigned', 'loose')
    ];
    const document = {
        addEventListener() {},
        querySelectorAll: (selector) => selector === '#docker_list > tr' ? rows : [],
        getElementById: () => null,
        querySelector: () => null
    };
    const folders = {
        root: { status: { started: 1, paused: 0, stopped: 0, upToDate: true } },
        updates: { status: { started: 1, paused: 0, stopped: 0, upToDate: false } },
        empty: { status: { started: 0, paused: 0, stopped: 0, upToDate: true } }
    };
    const api = actionBarModule.createApi({
        window: { Element: null, HTMLElement: null, location: {} },
        document,
        utils: { normalizePrefs: (value) => value || {} },
        getPrefs: () => ({ health: { warnStoppedPercent: 60 } }),
        getFolders: () => folders,
        getScopedContainers: (id) => id === 'empty' ? {} : { [`${id}-member`]: {} },
        readFolderIdFromRow: (row) => row.kind === 'folder' ? row.id : '',
        readFolderOwnerFromRow: (row) => row.kind === 'member' ? row.id : '',
        getFolderAncestors: (id) => id === 'updates' ? ['root'] : [],
        getFolderDescendants: (id) => id === 'root' ? ['updates'] : []
    });
    assert.deepEqual(
        Object.fromEntries(Object.entries(api.summarize()).filter(([key]) => key !== 'summaries')),
        { folders: 3, unassigned: 1, updates: 1, empty: 1, health: 0 }
    );
    api.setFilterMode('updates');
    assert.equal(rows[0].classList.has('fv-toolbar-filter-hidden'), false, 'ancestor folder remains visible as context');
    assert.equal(rows[1].classList.has('fv-toolbar-filter-hidden'), false, 'matching folder remains visible');
    assert.equal(rows[2].classList.has('fv-toolbar-filter-hidden'), true, 'unrelated ancestor members stay hidden');
    assert.equal(rows[3].classList.has('fv-toolbar-filter-hidden'), false, 'matching folder members remain visible');
    assert.equal(rows[4].classList.has('fv-toolbar-filter-hidden'), true, 'unassigned rows stay out of folder filters');
    api.resetView();
    assert.equal(api.getFilterMode(), 'all', 'reset returns to the unfiltered view');
    assert.equal(rows.every((row) => !row.classList.has('fv-toolbar-filter-hidden')), true, 'reset restores every runtime row');
});

test('hiding empty folders reconciles an active empty-only filter before rendering', () => {
    assert.match(actionBarJs, /const reconcileFilterWithPrefs = \(\) => \{/);
    assert.match(actionBarJs, /if \(!hideEmptyFolders \|\| folderFilterMode !== 'empty'\) return false/);
    assert.match(actionBarJs, /if \(reconcileFilterWithPrefs\(\)\) applyFilterState\(\)/);
    assert.match(actionBarJs, /actionMenuOpen = '';[\s\S]{0,500}if \(tool === 'reset'\) resetView\(\)/);
});
