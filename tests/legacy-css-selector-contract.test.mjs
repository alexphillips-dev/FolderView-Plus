import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');

test('docker legacy CSS selector contract remains stable for folder rows', () => {
    assert.match(dockerJs, /<td class="ct-name folder-name">/);
    assert.match(dockerJs, /<div class="folder-name-sub">/);
    assert.match(dockerJs, /<button class="dropDown-\$\{id\} folder-dropdown"/);
    assert.match(dockerJs, /<td class="updatecolumn folder-update">/);
    assert.match(dockerJs, /<div class="folder-preview"><\/div>/);
    assert.match(dockerJs, /class="img folder-img"/);
    assert.match(dockerJs, /<span class="state folder-state(?: [^"]+)?">/);
});

test('docker legacy CSS selector contract remains stable for tooltip content', () => {
    assert.match(dockerJs, /class="preview-outbox preview-outbox-\$\{ct\.shortId\}"/);
    assert.match(dockerJs, /class="action-info"/);
    assert.match(dockerJs, /class="info-ct"/);
    assert.match(dockerJs, /theme: \['tooltipster-docker-folder'\]/);
});

test('vm legacy CSS selector contract remains stable for folder rows', () => {
    assert.match(vmJs, /<td class="vm-name folder-name"><div class="folder-name-sub">/);
    assert.match(vmJs, /<button class="dropDown-\$\{id\} folder-dropdown"/);
    assert.match(vmJs, /class="img folder-img"/);
    assert.match(vmJs, /<span class="state folder-state(?: [^"]+)?">/);
    assert.match(vmJs, /<div class="folder-preview"><\/div>/);
    assert.match(vmJs, /folder-preview-wrapper/);
    assert.match(vmJs, /folder-preview-divider/);
});

test('dashboard legacy CSS selector contract remains stable for folder cards', () => {
    assert.match(dashboardJs, /class="folder-showcase-outer-\$\{id\} folder-showcase-outer"/);
    assert.match(dashboardJs, /class="img folder-img-docker"/);
    assert.match(dashboardJs, /class="state folder-state-docker"/);
    assert.match(dashboardJs, /class="img folder-img-vm"/);
    assert.match(dashboardJs, /class="state folder-state-vm"/);
    assert.match(dashboardJs, /new CustomEvent\('docker-pre-folder-preview'/);
    assert.match(dashboardJs, /new CustomEvent\('vm-pre-folder-preview'/);
});
