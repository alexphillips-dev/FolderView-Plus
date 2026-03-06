import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const backupPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/backup.php');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const dashboardPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page');

test('lib.php keeps token rollout controls and secure API headers', () => {
    assert.match(libPhp, /const FVPLUS_REQUEST_TOKEN_ENFORCEMENT = 'compat';/);
    assert.match(libPhp, /function getRequestTokenEnforcementMode\s*\(/);
    assert.match(libPhp, /function ensureConfiguredRequestTokenFile\s*\(/);
    assert.match(libPhp, /function emitRequestTokenMetaTag\s*\(/);
    assert.match(libPhp, /X-Content-Type-Options: nosniff/);
});

test('backup endpoint supports guarded POST download and legacy fallback', () => {
    assert.match(backupPhp, /\$guardedReadActions\s*=\s*\['download_post'\]/);
    assert.match(backupPhp, /if \(\$action === 'download_post'\)/);
    assert.match(backupPhp, /if \(\$action === 'download'\)/);
    assert.match(backupPhp, /X-FV-Download-Mode: legacy-get/);
    assert.match(backupPhp, /X-Content-Type-Options: nosniff/);
});

test('plugin pages emit request token meta tag', () => {
    for (const source of [folderPage, settingsPage, dockerPage, vmPage, dashboardPage]) {
        assert.match(source, /emitRequestTokenMetaTag\(\)/);
    }
});

test('folder display scripts sanitize folder icon and name in HTML templates', () => {
    for (const source of [dockerJs, vmJs, dashboardJs]) {
        assert.match(source, /const sanitizeImageSrc\s*=/);
        assert.match(source, /const safeFolderIcon = sanitizeImageSrc\(folder\.icon\)/);
        assert.match(source, /const safeFolderName = escapeHtml\(folder\.name\)/);
    }
});

test('folder editor escapes custom action labels when rendering HTML', () => {
    assert.match(folderJs, /const safeActionName = escapeHtml\(e\?\.name \|\| ''\)/);
    assert.match(folderJs, /const safeCfgName = escapeHtml\(cfg\.name \|\| ''\)/);
});
