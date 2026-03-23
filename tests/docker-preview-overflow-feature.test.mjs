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
    assert.match(folderJs, /if \(!Number\.isFinite\(parsed\)\) \{\s*return 1;\s*\}/);
    assert.match(folderJs, /preview_rows: normalizePreviewRowLimit\(settings\.preview_rows\)/);
    assert.match(folderJs, /form\.preview_rows\.value = String\(normalizePreviewRowLimit\(currFolder\.settings\.preview_rows\)\)/);
    assert.match(folderJs, /preview_rows: normalizePreviewRowLimit\(e\.preview_rows\?\.value\)/);
});

test('docker runtime applies preview row layout limits and enhanced member action menus', () => {
    assert.match(dockerJs, /const normalizeFolderPreviewRowLimit = \(settings = \{\}\) =>/);
    assert.match(dockerJs, /const getFolderPreviewItemsPerRow = \(settings = \{\}\) =>/);
    assert.match(dockerJs, /const buildDockerPreviewItem = \(\{ entry = \{\}, settings = \{\}, autostart = false \}\) =>/);
    assert.match(dockerJs, /const applyFolderPreviewLayout = \(\$preview, settings = \{\}\) =>/);
    assert.match(dockerJs, /const layoutFolderPreviewRows = \(\$preview, settings = \{\}\) =>/);
    assert.match(dockerJs, /let clone = \$\(`tr\.folder-id-\$\{folderTrId\} div\.folder-storage > tr > td\.ct-name > span\.outer:last`\)\.clone\(\)/);
    assert.match(dockerJs, /\$previewElementTarget\.children\('span\.inner'\)\.last\(\)/);
    assert.match(dockerJs, /layoutFolderPreviewRows\(\$\(`tr\.folder-id-\$\{id\} div\.folder-preview`\), folder\.settings\)/);
    assert.match(dockerJs, /layoutFolderPreviewRows\(\$preview, folder\?\.settings \|\| \{\}\)/);
    assert.match(dockerJs, /decorateDockerFolderMemberRow\(\$containerTR, id, ct\.info\.Name \|\| container_name_in_folder\)/);
    assert.match(dockerJs, /decorateDockerPreviewMemberTriggers\(/);
    assert.match(dockerJs, /const showDockerPreviewMemberMenu = \(entry\) =>/);
    assert.match(dockerJs, /\.on\('click\.fvDockerMemberMenuTrigger', '\.fv-docker-member-menu-trigger'/);
});

test('docker styles support multi-row previews and member action sheet styling', () => {
    assert.match(dockerCss, /\.folder-preview \{/);
    assert.match(dockerCss, /\.folder-preview-row \{/);
    assert.match(dockerCss, /\.folder-preview\.fv-preview-multirow \{/);
    assert.match(dockerCss, /\.folder-preview\.fv-preview-multirow \.folder-preview-row \{/);
    assert.match(dockerCss, /\.folder-preview\.fv-preview-multirow \.folder-preview-wrapper \{/);
    assert.match(dockerCss, /\.fv-docker-preview-card \{/);
    assert.match(dockerCss, /\.fv-docker-preview-mode-1 \{/);
    assert.match(dockerCss, /\.fv-docker-member-menu-trigger/);
    assert.match(dockerCss, /\.fv-docker-member-menu-actions/);
    assert.match(dockerCss, /\.fv-docker-member-menu-action/);
    assert.doesNotMatch(dockerCss, /tr\.folder > td\[colspan\]/);
});
