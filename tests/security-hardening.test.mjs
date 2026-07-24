import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const pluginPageDir = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const pluginPageFiles = fs.readdirSync(pluginPageDir)
    .filter((entry) => entry.endsWith('.page'))
    .sort();
const pluginPageSources = pluginPageFiles.map((entry) => ({
    file: entry,
    source: fs.readFileSync(path.join(pluginPageDir, entry), 'utf8')
}));

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const libDiagnosticsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php');
const backupPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/backup.php');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderEditorSchemaJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.schema.js');
const folderIconApiJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icon-api.js');
const folderViewPlusJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const requestClientJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.request.js');
const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const dashboardPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page');
const langScriptPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/script.php');
const versionPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/version.php');
const cpuPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/cpu.php');
const readOrderPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/read_order.php');
const readUnraidOrderPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/read_unraid_order.php');

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

test('docker preview graph listeners and dashboard cpu fallback are guarded', () => {
    assert.match(dockerJs, /let CPU = \[\]; let MEM = \[\]; let charts = \[\]; let tootltipObserver; let attachedTooltipStatsListener = null;/);
    assert.match(dockerJs, /!chart \|\| !chart\.canvas \|\| !document\.body\.contains\(chart\.canvas\)/);
    assert.match(dockerJs, /window\.dockerload && typeof window\.dockerload\.addEventListener === 'function'/);
    assert.match(dockerJs, /attachedTooltipStatsListener === 'sse' && window\.dockerload && typeof window\.dockerload\.removeEventListener === 'function'/);
    assert.match(dashboardJs, /refreshDashboardDockerCpuCores\(\);/);
    assert.match(dashboardJs, /window\.fvplusCpuCores = dashboardDockerCpuCores;/);
});

test('plugin pages emit request token meta tag', () => {
    for (const { source } of pluginPageSources) {
        assert.match(source, /emitRequestTokenMetaTag\(\)/);
    }
});

test('all plugin page entrypoints emit no-cache document guards', () => {
    assert.ok(pluginPageFiles.length >= 5);
    for (const { file, source } of pluginPageSources) {
        assert.match(source, /emitNoCachePageHeaders\(\)/);
        assert.match(source, /emitNoCacheMetaTags\(\)/);
        assert.match(source, /emitRequestTokenMetaTag\(\)/, `missing request token meta in ${file}`);
        assert.match(source, /emitPluginPageVersionSentinelScript\(/, `missing page version sentinel in ${file}`);
    }
    assert.match(libPhp, /function emitNoCachePageHeaders\(\): void/);
    assert.match(libPhp, /function emitNoCacheMetaTags\(\): void/);
    assert.match(libPhp, /function emitPluginPageVersionSentinelScript\(string \$pageKey\): void/);
    assert.match(libPhp, /function fvplus_versioned_plugin_asset_path\(string \$path\): string/);
    assert.match(libPhp, /function fvplus_asset_url\(string \$path\): string/);
    assert.match(libPhp, /function fvplus_asset\(string \$path\): void/);
    assert.match(libPhp, /fvplus\.page-version:/);
    assert.match(libPhp, /win\.location\.reload\(\);/);
});

test('plugin pages use versioned asset helper for shipped plugin assets', () => {
    for (const { file, source } of pluginPageSources) {
        assert.doesNotMatch(source, /autov\(['"]\/plugins\/folderview\.plus\//, `stale plugin autov helper remained in ${file}`);
        assert.doesNotMatch(source, /<(?:script|link)[^>]+(?:src|href)="\/plugins\/folderview\.plus\/[^"?]+\.(?:js|css)(?:")/, `direct plugin asset include remained in ${file}`);
    }
});

test('folder editor page uses explicit php versioned tags for editor assets', () => {
    assert.doesNotMatch(folderPage, /<\?autov\(/);
    assert.match(folderPage, /<script src="<\?php fvplus_asset\('\/plugins\/folderview\.plus\/scripts\/folderviewplus\.utils\.js'\)\?>"><\/script>/);
    assert.match(folderPage, /<script src="<\?php fvplus_asset\('\/plugins\/folderview\.plus\/scripts\/folderviewplus\.request\.js'\)\?>"><\/script>/);
    assert.match(folderPage, /<script src="<\?php fvplus_asset\('\/plugins\/folderview\.plus\/scripts\/folderviewplus\.theme-resolver\.js'\)\?>"><\/script>/);
});

test('language bootstrap version-tags plugin translation assets', () => {
    assert.match(langScriptPhp, /require_once\('\/usr\/local\/emhttp\/plugins\/folderview\.plus\/server\/lib\.php'\);/);
    assert.match(langScriptPhp, /fvplus_asset\('\/plugins\/folderview\.plus\/scripts\/include\/jquery\.i18n\.js'\)/);
    assert.match(langScriptPhp, /fvplus_versioned_plugin_asset_path\('\/plugins\/folderview\.plus\/langs\/en\.json'\)/);
});

test('live GET endpoints that drive page freshness emit no-cache headers', () => {
    assert.match(versionPhp, /header\('Content-Type: text\/plain'\);/);
    assert.match(versionPhp, /emitNoCachePageHeaders\(\);/);
    assert.match(readOrderPhp, /header\('Content-Type: text\/plain'\);/);
    assert.match(readOrderPhp, /emitNoCachePageHeaders\(\);/);
    assert.match(readUnraidOrderPhp, /header\('Content-Type: text\/plain'\);/);
    assert.match(readUnraidOrderPhp, /emitNoCachePageHeaders\(\);/);
    assert.match(cpuPhp, /header\('Cache-Control: no-store, no-cache, must-revalidate, max-age=0'\);/);
    assert.match(cpuPhp, /header\('Pragma: no-cache'\);/);
    assert.match(cpuPhp, /header\('Expires: 0'\);/);
});

test('dashboard page loads quick-rail controller before dashboard runtime', () => {
    assert.match(dashboardPage, /dashboard\.layout-quickrail\.js/);
    assert.match(dashboardPage, /dashboard\.layout-quickrail\.js[\s\S]*dashboard\.js/);
});

test('settings and folder pages load extracted support modules before their main runtimes', () => {
    assert.match(settingsPage, /folderviewplus\.settings-tree\.js/);
    assert.match(settingsPage, /folderviewplus\.row-details\.js/);
    assert.match(settingsPage, /folderviewplus\.bulk-assignment\.js/);
    assert.match(settingsPage, /folderviewplus\.runtime-actions\.js/);
    assert.match(settingsPage, /folderviewplus\.wizard-smart-detect\.js/);
    assert.match(settingsPage, /folderviewplus\.actions-support\.js/);
    assert.match(settingsPage, /folderviewplus\.settings-tree\.js[\s\S]*folderviewplus\.folder-editor\.js[\s\S]*folderviewplus\.row-details\.js/);
    assert.match(settingsPage, /folderviewplus\.settings-workspaces\.js[\s\S]*folderviewplus\.bulk-assignment\.js[\s\S]*folderviewplus\.runtime-actions\.js[\s\S]*folderviewplus\.wizard-smart-detect\.js/);
    assert.match(settingsPage, /folderviewplus\.row-details\.js[\s\S]*folderviewplus\.wizard-smart-detect\.js[\s\S]*folderviewplus\.wizard\.js/);
    assert.match(settingsPage, /folderviewplus\.actions-support\.js[\s\S]*folderviewplus\.js/);
    assert.match(folderPage, /folder\.editor\.hierarchy\.js/);
    assert.match(folderPage, /folder\.editor\.chrome\.js/);
    assert.match(folderPage, /folder\.editor\.type-docker\.js/);
    assert.match(folderPage, /folder\.editor\.type-vm\.js/);
    assert.match(folderPage, /folder\.js/);
    assert.doesNotMatch(folderPage, /folder\.legacy\.js/);
    assert.match(folderPage, /const scriptQueue = \[[\s\S]*folder\.editor\.hierarchy\.js[\s\S]*folder\.editor\.chrome\.js[\s\S]*folder\.editor\.type-docker\.js[\s\S]*folder\.editor\.type-vm\.js[\s\S]*folder\.js/);
    assert.match(dashboardPage, /dashboard\.folder-match-cache\.js/);
    assert.match(dashboardPage, /dashboard\.layout-quickrail\.js[\s\S]*dashboard\.folder-match-cache\.js[\s\S]*dashboard\.js/);
    assert.match(dockerPage, /folder\.runtime\.state-observers\.js/);
    assert.doesNotMatch(dockerPage, /docker\.member-menu\.js/);
    assert.match(dockerPage, /folder\.runtime\.state-observers\.js[\s\S]*docker\.js/);
    assert.match(vmPage, /folder\.runtime\.state-observers\.js[\s\S]*vm\.js/);
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
        assert.match(source, /const safeFolderName = escapeHtml\(folder\.name\)/);
    }
    assert.match(dockerJs, /const safeFolderIcon = sanitizeImageSrc\(folder\.icon\)/);
    assert.match(vmJs, /const DEFAULT_FOLDER_ICON_PATH = '\/plugins\/folderview\.plus\/images\/folder-icon\.png';/);
    assert.match(vmJs, /const safeFolderIcon = sanitizeImageSrc\(folder\.icon, DEFAULT_FOLDER_ICON_PATH\)/);
    assert.match(dashboardJs, /const DEFAULT_FOLDER_ICON_PATH = '\/plugins\/folderview\.plus\/images\/folder-icon\.png';/);
    assert.match(dashboardJs, /const safeFolderIcon = sanitizeImageSrc\(folder\.icon, DEFAULT_FOLDER_ICON_PATH\)/);
});

test('folder editor escapes custom action labels when rendering HTML', () => {
    assert.match(folderJs, /const safeActionName = escapeHtml\(entry\?\.name \|\| ''\)/);
    assert.match(folderJs, /const safeCfgName = escapeHtml\(cfg\.name \|\| ''\)/);
});

test('folder editor supports unicode names and secure guarded create/update posts', () => {
    assert.doesNotMatch(folderPage, /<input[^>]*name="name"[^>]*pattern=/);
    assert.match(folderEditorSchemaJs, /const INVALID_FOLDER_NAME_CHAR_REGEX = \/\[\\u0000-\\u001f\\u007f\]\//);
    assert.match(folderJs, /const INVALID_FOLDER_NAME_CHAR_REGEX =/);
    assert.match(folderJs, /Folder name cannot contain control characters\./);
    assert.doesNotMatch(folderJs, /Name cannot contain control characters or <>:"\/\\\\\|\?\*\./);
    assert.doesNotMatch(folderEditorSchemaJs, /<>:"\/\\\\\|\?\*/);
    const folderNameControlCharRegex = /[\u0000-\u001f\u007f]/;
    for (const name of ['Starr*Apps', 'Arr=Apps', 'Media+Tools', 'Label/Derived?Name']) {
        assert.equal(folderNameControlCharRegex.test(name), false, `${name} should be allowed`);
    }
    assert.equal(folderNameControlCharRegex.test("Bad\u0000Name"), true);
    assert.match(folderJs, /const securePost = async \(url, data = \{\}\) =>/);
    assert.match(folderIconApiJs, /requestClient\.postJson\(url, data, \{ retries: 0 \}\)/);
    assert.match(requestClientJs, /'X-FV-Request': '1'/);
    assert.match(requestClientJs, /payload\._fv_request = '1';/);
    assert.match(folderJs, /await securePost\('\/plugins\/folderview\.plus\/server\/create\.php'/);
    assert.match(folderJs, /await securePost\('\/plugins\/folderview\.plus\/server\/update\.php'/);
});

test('request guard allows explicit mutation header fallback when token bypass is valid', () => {
    assert.match(libPhp, /function hasExplicitMutationRequestHeader\(\): bool/);
    assert.match(libPhp, /\$_POST\['_fv_request'\] \?\? \$_GET\['_fv_request'\] \?\? ''/);
    assert.match(libPhp, /\$tokenRequiredForBypass = \$tokenMode !== 'off' && getConfiguredRequestToken\(\) !== '';/);
    assert.match(libPhp, /hasExplicitMutationRequestHeader\(\) && \(\$tokenValidated \|\| !\$tokenRequiredForBypass\)/);
    assert.match(requestClientJs, /const addMutationPayloadMarkers = \(method, data, token, traceId = ''\) =>/);
    assert.match(requestClientJs, /payload\._fv_request = '1';/);
    assert.match(folderViewPlusJs, /requestClient\.postJson\(url, data, options\)/);
});

test('external links and popup actions enforce noopener protections', () => {
    assert.match(folderPage, /target="_blank" rel="noopener noreferrer"/);
    assert.match(dockerJs, /const WEBUI_LINK_REL = 'noopener noreferrer';/);
    assert.match(dockerJs, /const openWebuiInNewTab = \(url\) =>/);
    assert.match(dockerJs, /openWebuiInNewTab\(folderData\.settings\.folder_webui_url\)/);
    assert.match(dashboardJs, /const openWebUiInNewTab = \(url\) =>/);
    assert.match(dashboardJs, /target="_blank" rel="noopener noreferrer" title="WebUI" aria-label="WebUI"/);
    assert.match(dashboardJs, /openWebUiInNewTab\(webUiUrl\)/);
    assert.match(folderViewPlusJs, /window\.open\(UPDATE_NOTES_CHANGELOG_URL, '_blank', 'noopener,noreferrer'\)/);
    assert.match(folderViewPlusJs, /popup\.opener = null;/);
});

test('docker advanced popup sanitizes runtime metadata before rendering', () => {
    assert.match(dockerJs, /const getSafeExternalUrl = \(value\) => \{/);
    assert.match(dockerJs, /const safeIcon = sanitizeImageSrc\(labels\['net\.unraid\.docker\.icon'\] \|\| ''\);/);
    assert.match(dockerJs, /const safeContainerName = escapeHtml\(containerName\);/);
    assert.match(dockerJs, /data-container-name="\$\{safeContainerName\}"/);
    assert.match(dockerJs, /const buildDockerBindMountMappingsHtml = \(mounts = \[\]\) => \{/);
    assert.match(dockerJs, /const destination = escapeHtml\(String\(entry\?\.Destination \|\| ''\)\.trim\(\) \|\| 'unknown'\);/);
    assert.match(dockerJs, /href="\$\{safeReadMeUrl\}"/);
    assert.match(dockerJs, /title="\$\{safeImage\}"/);
    assert.doesNotMatch(dockerJs, /src="\$\{labels\['net\.unraid\.docker\.icon'\] \|\| ''\}"/);
    assert.doesNotMatch(dockerJs, /\$\{runtimeEntry\.info\.Name\}<\/span>/);
    assert.doesNotMatch(dockerJs, /runtimeEntry\.Mounts\?\.filter\(e => e\.Type==='bind'\)\.map\(e=>`\$\{e\.Destination\}/);
    assert.doesNotMatch(dockerJs, /href="\$\{runtimeEntry\.info\.(?:ReadMe|Project|Support|registry|DonateLink)\}"/);
});

test('docker advanced popup uses delegated actions instead of inline handlers', () => {
    assert.match(dockerJs, /class="fv-runtime-action" data-action="console"/);
    assert.match(dockerJs, /\$content\.on\('click', '\.fv-runtime-action'/);
    assert.match(dockerJs, /const actionMap = new Set\(\['start', 'resume', 'stop', 'pause', 'restart'\]\);/);
    assert.match(dockerJs, /const refreshTarget = getDockerRuntimeReconcileApi\(\)\?\.getLifecycleRefreshCallbackName\?\.\(\) \|\| 'loadlist';\s*eventControl\(\{ action, container: containerId \}, refreshTarget\);/);
    assert.match(dockerJs, /openTerminal\('docker', actionContainerName, String\(\$link\.attr\('data-shell-value'\)/);
    assert.match(dockerJs, /class="fv-runtime-toggle-info-list" data-show="\.info-ports-more"/);
    assert.match(dockerJs, /\$content\.on\('click', '\.fv-runtime-toggle-info-list'/);
    assert.doesNotMatch(dockerJs, /onclick="event\.preventDefault\(\); openTerminal\('docker'/);
    assert.doesNotMatch(dockerJs, /onclick="event\.preventDefault\(\); eventControl\(\{action:'(?:start|resume|stop|pause|restart)'/);
    assert.doesNotMatch(dockerJs, /onclick="event\.preventDefault\(\); editContainer\(/);
    assert.doesNotMatch(dockerJs, /onclick="event\.preventDefault\(\); rmContainer\(/);
});

test('dashboard script is wrapped in a private scope to avoid global symbol collisions', () => {
    assert.match(dashboardJs, /^\(function fvplusDashboardScope\(window, \$\) \{/);
    assert.match(dashboardJs, /\}\)\(window, window\.jQuery \|\| window\.\$\);\s*$/);
});

test('docker runtime script is wrapped in a private scope to avoid host-page plugin collisions', () => {
    assert.match(dockerJs, /^\/\/ @ts-check\s*\n\(function fvplusDockerRuntimeScope\(window, \$\) \{/);
    assert.match(dockerJs, /\}\)\(window, window\.jQuery \|\| window\.\$\);\s*$/);
});

test('dashboard folder cards expose delegated mouse and keyboard expansion controls', () => {
    assert.match(dashboardJs, /data-fv-dashboard-folder-toggle data-fv-dashboard-type="docker" aria-expanded="false"/);
    assert.match(dashboardJs, /data-fv-dashboard-folder-toggle data-fv-dashboard-type="vm" aria-expanded="false"/);
    assert.match(dashboardJs, /role="button" tabindex="0"/);
    assert.match(dashboardJs, /keydown\.fvDashboardFolderToggle/);
    assert.match(dashboardJs, /event\.key !== 'Enter' && event\.key !== ' '/);
    assert.doesNotMatch(dashboardJs, /onclick='expandFolder(?:Docker|VM)\(/);
    assert.match(dashboardJs, /window\.expandFolderDocker = expandFolderDocker;/);
    assert.match(dashboardJs, /window\.expandFolderVM = expandFolderVM;/);
});

test('dashboard expanded docker members include guarded quick actions', () => {
    assert.match(dashboardJs, /const appendDashboardDockerMemberQuickActions = \(\$containerEl,\s*ct,\s*settings = \{\}\) =>/);
    assert.match(dashboardJs, /const resolveDashboardPreviewActionPrefs = \(settings = \{\}\) =>/);
    assert.match(dashboardJs, /utils\.resolvePreviewActionPrefs\(settings\)/);
    assert.match(dashboardJs, /const allowWebUiAction = actionPrefs\.preview_webui === true;/);
    assert.match(dashboardJs, /const allowConsoleAction = actionPrefs\.preview_console === true;/);
    assert.match(dashboardJs, /const allowLogsAction = actionPrefs\.preview_logs === true;/);
    assert.match(dashboardJs, /fv-dashboard-member-actions/);
    assert.match(dashboardJs, /target="_blank" rel="noopener noreferrer"/);
    assert.match(dashboardJs, /if \(allowWebUiAction && webUiUrl\) \{/);
    assert.match(dashboardJs, /if \(allowConsoleAction\) \{/);
    assert.match(dashboardJs, /if \(allowLogsAction\) \{/);
    assert.match(dashboardJs, /window\.openTerminal\('docker', containerName, containerShell\)/);
    assert.match(dashboardJs, /window\.openTerminal\('docker', containerName, '\.log'\)/);
    assert.match(dashboardJs, /appendDashboardDockerMemberQuickActions\(\$containerEl,\s*ct,\s*folder\.settings \|\| \{\}\);/);
});
