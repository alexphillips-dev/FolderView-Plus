import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');

test('docker legacy CSS selector contract remains stable for folder rows', () => {
    assert.match(dockerJs, /<td class="ct-name folder-name">/);
    assert.match(dockerJs, /<div class="folder-name-sub">/);
    assert.match(dockerJs, /<button class="dropDown-\$\{id\} folder-dropdown"/);
    assert.match(dockerJs, /<td class="updatecolumn folder-update">/);
    assert.match(dockerJs, /<div class="folder-preview"><\/div>/);
    assert.match(dockerJs, /class="img folder-img"/);
    assert.match(dockerJs, /<span class="state folder-state">/);
});

test('docker legacy CSS selector contract remains stable for tooltip content', () => {
    assert.match(dockerJs, /class="preview-outbox preview-outbox-\$\{ct\.shortId\}"/);
    assert.match(dockerJs, /class="action-info"/);
    assert.match(dockerJs, /class="info-ct"/);
    assert.match(dockerJs, /theme: \['tooltipster-docker-folder'\]/);
});
