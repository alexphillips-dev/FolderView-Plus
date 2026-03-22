import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');

test('folder editor exposes preview row limit control and persists the setting', () => {
    assert.match(folderPage, /<select name="preview_rows">/);
    assert.match(folderPage, /<option value="0">Unlimited<\/option>/);
    assert.match(folderJs, /const normalizePreviewRowLimit = \(value\) =>/);
    assert.match(folderJs, /preview_rows: normalizePreviewRowLimit\(settings\.preview_rows\)/);
    assert.match(folderJs, /form\.preview_rows\.value = String\(normalizePreviewRowLimit\(currFolder\.settings\.preview_rows\)\)/);
    assert.match(folderJs, /preview_rows: normalizePreviewRowLimit\(e\.preview_rows\?\.value\)/);
});

test('docker runtime applies preview row layout limits and enhanced member action menus', () => {
    assert.match(dockerJs, /const normalizeFolderPreviewRowLimit = \(settings = \{\}\) =>/);
    assert.match(dockerJs, /const getFolderPreviewItemsPerRow = \(settings = \{\}\) =>/);
    assert.match(dockerJs, /const getFolderPreviewVisibleItemLimit = \(settings = \{\}\) =>/);
    assert.match(dockerJs, /const applyFolderPreviewLayout = \(\$preview, settings = \{\}\) =>/);
    assert.match(dockerJs, /const layoutFolderPreviewRows = \(\$preview, settings = \{\}\) =>/);
    assert.match(dockerJs, /previewNode\.dataset\.previewVisibleLimit = Number\.isFinite\(visibleLimit\) \? String\(visibleLimit\) : 'unlimited'/);
    assert.match(dockerJs, /const previewVisibleLimit = getFolderPreviewVisibleItemLimit\(folder\?\.settings \|\| \{\}\);/);
    assert.match(dockerJs, /if \(renderedPreviewItems < previewVisibleLimit\) \{/);
    assert.match(dockerJs, /if \(index >= previewVisibleLimit\) \{/);
    assert.match(dockerJs, /layoutFolderPreviewRows\(\$\(`tr\.folder-id-\$\{id\} div\.folder-preview`\), folder\.settings\);/);
    assert.match(dockerJs, /layoutFolderPreviewRows\(\$preview, folder\?\.settings \|\| \{\}\);/);
    assert.match(dockerJs, /decorateDockerFolderMemberRow\(\$containerTR, id, ct\.info\.Name \|\| container_name_in_folder\)/);
    assert.match(dockerJs, /decorateDockerPreviewMemberTriggers\(/);
    assert.match(dockerJs, /const showDockerPreviewMemberMenu = \(entry\) =>/);
    assert.match(dockerJs, /\.on\('click\.fvDockerMemberMenuTrigger', '\.fv-docker-member-menu-trigger'/);
});

test('docker styles support multi-row previews and member action sheet styling', () => {
    assert.match(dockerCss, /--fvplus-preview-row-limit:/);
    assert.match(dockerCss, /\.folder-preview\.fv-preview-unlimited-rows/);
    assert.match(dockerCss, /\.folder-preview-row \{/);
    assert.match(dockerCss, /\.fv-docker-member-menu-trigger/);
    assert.match(dockerCss, /\.fv-docker-member-menu-actions/);
    assert.match(dockerCss, /\.fv-docker-member-menu-action/);
});
