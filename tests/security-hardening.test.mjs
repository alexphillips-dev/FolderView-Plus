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
const folderViewPlusJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const dashboardPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page');

test('lib.php keeps token rollout controls and secure API headers', () => {
    assert.match(libPhp, /const FVPLUS_REQUEST_TOKEN_ENFORCEMENT = 'strict';/);
    assert.match(libPhp, /function getRequestTokenEnforcementMode\s*\(/);
    assert.match(libPhp, /function ensureConfiguredRequestTokenFile\s*\(/);
    assert.match(libPhp, /function emitRequestTokenMetaTag\s*\(/);
    assert.match(libPhp, /function normalizeIsoTimestamp\s*\(/);
    assert.match(libPhp, /'updatedAt'\s*=>\s*gmdate\('c'\)/);
    assert.match(libPhp, /'vcpus'\s*=>\s*\$vcpus/);
    assert.match(libPhp, /'memoryKiB'\s*=>\s*\$memoryKiB/);
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

test('runtime pages halt safely when conflicting folder view plugins are detected', () => {
    for (const source of [dockerPage, vmPage, dashboardPage]) {
        assert.match(source, /\$fvplusRuntimeConflicts\s*=\s*fvplus_detect_runtime_plugin_conflicts\(\);/);
        assert.match(source, /if\s*\(!empty\(\$fvplusRuntimeConflicts\)\)\s*\{[\s\S]*fvplus_render_runtime_conflict_notice\('[^']+'\);[\s\S]*return;[\s\S]*\}/);
    }
    assert.match(settingsPage, /\$fvplusRuntimeConflicts\s*=\s*fvplus_detect_runtime_plugin_conflicts\(\);/);
    assert.match(settingsPage, /fvplus_render_runtime_conflict_notice\('[^']+'\)/);
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

test('folder editor supports unicode names and secure guarded create/update posts', () => {
    assert.doesNotMatch(folderPage, /<input[^>]*name="name"[^>]*pattern=/);
    assert.match(folderJs, /const INVALID_FOLDER_NAME_CHAR_REGEX =/);
    assert.match(folderJs, /Name cannot contain control characters or <>:"\/\\\\\|\?\*\./);
    assert.match(folderJs, /const securePost = async \(url, data = \{\}\) =>/);
    assert.match(folderJs, /payload\._fv_request = '1';/);
    assert.match(folderJs, /'X-FV-Request': '1'/);
    assert.match(folderJs, /await securePost\('\/plugins\/folderview\.plus\/server\/create\.php'/);
    assert.match(folderJs, /await securePost\('\/plugins\/folderview\.plus\/server\/update\.php'/);
});

test('request guard allows explicit mutation header fallback when token bypass is valid', () => {
    assert.match(libPhp, /function hasExplicitMutationRequestHeader\(\): bool/);
    assert.match(libPhp, /\$_POST\['_fv_request'\] \?\? \$_GET\['_fv_request'\] \?\? ''/);
    assert.match(libPhp, /\$tokenRequiredForBypass = \$tokenMode !== 'off' && getConfiguredRequestToken\(\) !== '';/);
    assert.match(libPhp, /hasExplicitMutationRequestHeader\(\) && \(\$tokenValidated \|\| !\$tokenRequiredForBypass\)/);
    assert.match(folderViewPlusJs, /const buildMutationRequestPayload = \(data = \{\}\) =>/);
    assert.match(folderViewPlusJs, /payload\._fv_request = '1';/);
    assert.match(folderViewPlusJs, /\$\.post\(url, buildMutationRequestPayload\(data\)\)/);
});

test('external links and popup actions enforce noopener protections', () => {
    assert.match(folderPage, /target="_blank" rel="noopener noreferrer"/);
    assert.match(dockerJs, /target="_blank" rel="noopener noreferrer"/);
    assert.match(dockerJs, /window\.open\(folderData\.settings\.folder_webui_url, '_blank', 'noopener,noreferrer'\)/);
    assert.match(dashboardJs, /window\.open\(globalFolders\.docker\[id\]\.settings\.folder_webui_url, '_blank', 'noopener,noreferrer'\)/);
    assert.match(folderViewPlusJs, /window\.open\(UPDATE_NOTES_CHANGELOG_URL, '_blank', 'noopener,noreferrer'\)/);
    assert.match(folderViewPlusJs, /popup\.opener = null;/);
});

test('dashboard script is wrapped in a private scope to avoid global symbol collisions', () => {
    assert.match(dashboardJs, /^\(function fvplusDashboardScope\(window, \$\) \{/);
    assert.match(dashboardJs, /\}\)\(window, window\.jQuery \|\| window\.\$\);\s*$/);
});

test('dashboard folder cards are click-to-expand for docker and vm widgets', () => {
    assert.match(dashboardJs, /onclick='expandFolderDocker\("\$\{id\}"\)'/);
    assert.match(dashboardJs, /onclick='expandFolderVM\("\$\{id\}"\)'/);
});
