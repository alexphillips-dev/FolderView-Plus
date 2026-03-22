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

test('folder editor keeps dedicated preview action-sheet plumbing', () => {
    assert.doesNotMatch(folderPage, /<select name="preview_rows">/);
    assert.doesNotMatch(folderJs, /const normalizePreviewRowLimit = \(value\) =>/);
});

test('docker runtime applies preview row layout limits and enhanced member action menus', () => {
    assert.match(dockerJs, /const normalizeFolderPreviewRowLimit = \(settings = \{\}\) =>/);
    assert.match(dockerJs, /const applyFolderPreviewLayout = \(\$preview, settings = \{\}\) =>/);
    assert.doesNotMatch(dockerJs, /const getFolderPreviewItemsPerRow = \(settings = \{\}\) =>/);
    assert.doesNotMatch(dockerJs, /const layoutFolderPreviewRows = \(\$preview, settings = \{\}\) =>/);
    assert.match(dockerJs, /decorateDockerFolderMemberRow\(\$containerTR, id, ct\.info\.Name \|\| container_name_in_folder\)/);
    assert.match(dockerJs, /decorateDockerPreviewMemberTriggers\(/);
    assert.match(dockerJs, /const showDockerPreviewMemberMenu = \(entry\) =>/);
    assert.match(dockerJs, /\.on\('click\.fvDockerMemberMenuTrigger', '\.fv-docker-member-menu-trigger'/);
});

test('docker styles support multi-row previews and member action sheet styling', () => {
    assert.match(dockerCss, /\.folder-preview \{/);
    assert.doesNotMatch(dockerCss, /\.folder-preview-row \{/);
    assert.match(dockerCss, /\.fv-docker-member-menu-trigger/);
    assert.match(dockerCss, /\.fv-docker-member-menu-actions/);
    assert.match(dockerCss, /\.fv-docker-member-menu-action/);
});
