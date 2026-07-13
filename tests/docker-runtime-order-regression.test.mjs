import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);
const libPhp = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'),
    'utf8'
);

const reorderFolderSlotsMatch = dockerJs.match(/const reorderFolderSlotsInBaseOrder = \(baseOrder, folders, prefs\) => \{([\s\S]*?)\n\};/);
const reconcileDockerOrderMatch = dockerJs.match(/const reconcileDockerOrderWithFolderSlots = \(liveOrder, savedOrder, folders\) => \{([\s\S]*?)\n\};/);

test('docker runtime places containers missing from saved preferences after every folder', () => {
    assert.ok(reconcileDockerOrderMatch, 'reconcileDockerOrderWithFolderSlots definition should exist');
    const reconcileDockerOrderWithFolderSlots = new Function(
        'liveOrder',
        'savedOrder',
        'folders',
        'folderRegex',
        `${reconcileDockerOrderMatch[1]}`
    );

    const result = reconcileDockerOrderWithFolderSlots(
        ['new-container', 'existing-one', 'existing-two'],
        ['existing-one', 'existing-two', 'folder-a', 'folder-b'],
        {
            a: { name: 'Apps' },
            b: { name: 'Services' }
        },
        /^folder-/
    );

    assert.deepEqual(result.newOnes, ['new-container']);
    assert.deepEqual(result.order, [
        'existing-one',
        'existing-two',
        'folder-a',
        'folder-b',
        'new-container'
    ]);
});

test('docker runtime preserves live folder placeholder order from host order on refresh', () => {
    assert.ok(reorderFolderSlotsMatch, 'reorderFolderSlotsInBaseOrder definition should exist');
    const reorderFolderSlotsInBaseOrder = new Function(
        'baseOrder',
        'folders',
        'prefs',
        'folderRegex',
        'getPrefsOrderedFolderMap',
        `${reorderFolderSlotsMatch[1]}`
    );

    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const prefs = {
        sortMode: 'created',
        manualOrder: []
    };
    const getPrefsOrderedFolderMap = () => ({
        a: folders.a,
        b: folders.b,
        c: folders.c
    });

    const baseOrder = ['folder-a', 'folder-c', 'folder-b'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-a', 'folder-c', 'folder-b']);
});

test('docker runtime reapplies saved alpha folder order even when host placeholders are stale', () => {
    assert.ok(reorderFolderSlotsMatch, 'reorderFolderSlotsInBaseOrder definition should exist');
    const reorderFolderSlotsInBaseOrder = new Function(
        'baseOrder',
        'folders',
        'prefs',
        'folderRegex',
        'getPrefsOrderedFolderMap',
        `${reorderFolderSlotsMatch[1]}`
    );

    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const getPrefsOrderedFolderMap = () => ({
        a: folders.a,
        b: folders.b,
        c: folders.c
    });

    const baseOrder = ['folder-c', 'folder-a', 'folder-b'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, { sortMode: 'alpha' }, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-a', 'folder-b', 'folder-c']);
});

test('docker runtime reapplies saved created-newest folder order even when host placeholders are stale', () => {
    assert.ok(reorderFolderSlotsMatch, 'reorderFolderSlotsInBaseOrder definition should exist');
    const reorderFolderSlotsInBaseOrder = new Function(
        'baseOrder',
        'folders',
        'prefs',
        'folderRegex',
        'getPrefsOrderedFolderMap',
        `${reorderFolderSlotsMatch[1]}`
    );

    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const getPrefsOrderedFolderMap = () => ({
        b: folders.b,
        a: folders.a,
        c: folders.c
    });

    const baseOrder = ['folder-c', 'folder-a', 'folder-b'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, { sortMode: 'created_newest' }, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-b', 'folder-a', 'folder-c']);
});

test('docker runtime promotes pinned folders before stale manual host placeholders', () => {
    assert.ok(reorderFolderSlotsMatch, 'reorderFolderSlotsInBaseOrder definition should exist');
    const reorderFolderSlotsInBaseOrder = new Function(
        'baseOrder',
        'folders',
        'prefs',
        'folderRegex',
        'getPrefsOrderedFolderMap',
        `${reorderFolderSlotsMatch[1]}`
    );

    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const prefs = {
        sortMode: 'manual',
        manualOrder: ['a', 'b', 'c'],
        pinnedFolderIds: ['c']
    };
    const getPrefsOrderedFolderMap = () => ({
        c: folders.c,
        a: folders.a,
        b: folders.b
    });

    const baseOrder = ['folder-a', 'folder-b', 'folder-c'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-c', 'folder-a', 'folder-b']);
});

test('docker runtime only backfills missing folder placeholders when sort mode remains created', () => {
    assert.ok(reorderFolderSlotsMatch, 'reorderFolderSlotsInBaseOrder definition should exist');
    const reorderFolderSlotsInBaseOrder = new Function(
        'baseOrder',
        'folders',
        'prefs',
        'folderRegex',
        'getPrefsOrderedFolderMap',
        `${reorderFolderSlotsMatch[1]}`
    );

    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const getPrefsOrderedFolderMap = () => ({
        a: folders.a,
        b: folders.b,
        c: folders.c
    });

    const baseOrder = ['folder-stale', 'folder-c', 'folder-a'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, { sortMode: 'created' }, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-b', 'folder-c', 'folder-a']);
});

test('docker order sync always rebuilds folder placeholders from prefs-ordered folder map', () => {
    assert.match(
        libPhp,
        /function buildDockerPageStartOrder\(array \$context\): array/
    );
    assert.match(libPhp, /\$folderPlaceholders = array_keys\(\$folderContainers\);/);
    assert.match(libPhp, /foreach \(\$folderPlaceholders as \$placeholder\) \{/);
    assert.doesNotMatch(libPhp, /\$preserveCurrentPlaceholderOrder =/);
});

test('docker order sync uses prefs-ordered folders when explicit sort or pinning is active', () => {
    assert.match(libPhp, /\$orderedFolders = reorderFolderMapByPrefs\('docker', \$folders\);/);
    assert.match(libPhp, /foreach \(\$orderedFolders as \$folderId => \$folder\) \{/);
});

test('docker read order response replaces stale userprefs folder placeholders with prefs order', () => {
    const readUserPrefsMatch = libPhp.match(/function readUserPrefs\(string \$type\) : string \{([\s\S]*?)\n    \}\n\n    function normalizeFolderMembers/);
    assert.ok(readUserPrefsMatch, 'readUserPrefs body should be present');
    const body = readUserPrefsMatch[1];
    assert.match(body, /\$orderedFolders = reorderFolderMapByPrefs\('docker', \$folders\);/);
    assert.match(body, /\$folderPlaceholders = array_map/);
    assert.match(body, /strpos\(\$value, 'folder-'\) !== 0/);
    assert.match(body, /return !in_array\(\$folderId, \$folderIds, true\);/);
    assert.match(body, /foreach \(\$folderPlaceholders as \$placeholder\) \{/);
    assert.match(body, /\$order\[\] = \$placeholder;/);
});

test('docker order sync reads but does not write Docker userprefs', () => {
    const contextMatch = libPhp.match(/function buildDockerStartOrderContext\(\): array \{([\s\S]*?)\n    \}\n\n    function buildDockerPageStartOrder/);
    assert.ok(contextMatch, 'buildDockerStartOrderContext body should be present');
    const body = contextMatch[1];
    assert.match(body, /userprefs\.cfg is not written here; Unraid owns drag-order persistence\./);
    assert.match(body, /\$currentPrefs = file_exists\(\$prefsFile\) \? @parse_ini_file\(\$prefsFile\) : false;/);
    assert.doesNotMatch(body, /file_put_contents\(\$prefsFile/);
    assert.doesNotMatch(body, /wrote userprefs\.cfg/);
});
