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

test('docker runtime only backfills missing folder placeholders instead of reordering valid ones', () => {
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

test('docker order sync preserves current folder placeholder sequence before appending missing placeholders', () => {
    assert.match(
        libPhp,
        /\$orderedFolderPlaceholders = \[\];[\s\S]*?foreach \(\$currentOrder as \$item\) \{[\s\S]*?if \(in_array\(\$item, \$folderPlaceholders, true\)\) \{[\s\S]*?\$orderedFolderPlaceholders\[\] = \$item;[\s\S]*?continue;[\s\S]*?\}/
    );
    assert.match(
        libPhp,
        /foreach \(\$folderPlaceholders as \$placeholder\) \{[\s\S]*?if \(!in_array\(\$placeholder, \$orderedFolderPlaceholders, true\)\) \{[\s\S]*?\$orderedFolderPlaceholders\[\] = \$placeholder;[\s\S]*?\}[\s\S]*?\}/
    );
    assert.match(libPhp, /foreach \(\$orderedFolderPlaceholders as \$placeholder\) \{/);
});
