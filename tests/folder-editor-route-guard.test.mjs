import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderLegacyJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.legacy.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');

test('folder editor runtimes accept query and hash bootstrap identity fallbacks', () => {
    assert.match(folderJs, /const folderEditorHashParams = new URLSearchParams/);
    assert.match(folderJs, /folderEditorHashParams\.get\('type'\)/);
    assert.match(folderJs, /folderEditorHashParams\.get\('id'\)/);
    assert.match(folderJs, /folderThemeSurfaceBinding\?\.runApply\('chrome-ready'\)/);
    assert.match(folderJs, /sampleRoot:\s*'body'/);
    assert.match(folderLegacyJs, /const folderEditorHashParams = new URLSearchParams/);
    assert.match(folderLegacyJs, /folderEditorHashParams\.get\('type'\)/);
    assert.match(folderLegacyJs, /folderEditorHashParams\.get\('id'\)/);
    assert.match(folderLegacyJs, /sampleRoot:\s*'body'/);
});

test('folder editor URLs duplicate folder identity into the hash for navigation-safe fallback', () => {
    assert.match(dockerJs, /return `\/Docker\/Folder\?\$\{params\.toString\(\)\}#\$\{hashParams\.toString\(\)\}`;/);
    assert.match(vmJs, /return `\/VMs\/Folder\?\$\{params\.toString\(\)\}#\$\{hashParams\.toString\(\)\}`;/);
    assert.match(dashboardJs, /return `\$\{location\.pathname\}\/Folder\?\$\{params\.toString\(\)\}#\$\{hashParams\.toString\(\)\}`;/);
});
