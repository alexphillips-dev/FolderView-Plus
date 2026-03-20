import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);
const readInfoPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/read_info.php'
);
const thirdPartyIconsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/third_party_icons.php'
);
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);
const dashboardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
);
const dashboardCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css'
);
const dockerCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'
);
const vmCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css'
);
const dockerModulesPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.modules.js'
);
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const settingsImportJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js'
);
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);

const libPhp = fs.readFileSync(libPath, 'utf8');
const readInfoPhp = fs.readFileSync(readInfoPath, 'utf8');
const thirdPartyIconsPhp = fs.readFileSync(thirdPartyIconsPath, 'utf8');
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');
const dashboardJs = fs.readFileSync(dashboardJsPath, 'utf8');
const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf8');
const dockerCss = fs.readFileSync(dockerCssPath, 'utf8');
const vmCss = fs.readFileSync(vmCssPath, 'utf8');
const dockerModulesJs = fs.readFileSync(dockerModulesPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const settingsImportJs = fs.readFileSync(settingsImportJsPath, 'utf8');
const settingsRuntime = `${settingsJs}\n${settingsImportJs}`;
const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');

test('read_info supports cached full/state payload retrieval', () => {
    assert.match(libPhp, /const FVPLUS_INFO_CACHE_TTL_FULL\s*=\s*\d+/);
    assert.match(libPhp, /const FVPLUS_INFO_CACHE_TTL_STATE\s*=\s*\d+/);
    assert.match(libPhp, /function normalizeReadInfoMode\s*\(/);
    assert.match(libPhp, /function readInfoState\s*\(/);
    assert.match(libPhp, /function readInfoCached\s*\(/);
    assert.match(readInfoPhp, /readInfoCached\(\$type,\s*\$mode,\s*\$ttl,\s*\$forceRefresh\)/);
    assert.match(readInfoPhp, /\$_GET\['mode'\]|\$_REQUEST\['mode'\]/);
});

test('runtime refresh uses lightweight state mode checks before re-rendering', () => {
    assert.match(dockerJs, /read_info\.php\?type=docker&mode=state/);
    assert.match(vmJs, /read_info\.php\?type=vm&mode=state/);
    assert.match(dashboardJs, /read_info\.php\?type=\$\{type\}&mode=state/);
    assert.match(dockerJs, /queueLoadlistRefresh/);
    assert.match(vmJs, /queueLoadlistRefresh/);
    assert.match(dashboardJs, /queueLoadlistRefresh/);
    assert.match(dockerJs, /LOADLIST_REFRESH_MIN_GAP_MS/);
    assert.match(vmJs, /LOADLIST_REFRESH_MIN_GAP_MS/);
    assert.match(dashboardJs, /LOADLIST_REFRESH_MIN_GAP_MS/);
    assert.match(dockerJs, /queuedLoadlistRequestedAt/);
    assert.match(vmJs, /queuedLoadlistRequestedAt/);
    assert.match(dashboardJs, /queuedLoadlistRequestedAt/);
    assert.match(dockerJs, /const queueCreateFoldersRender = \(\) =>/);
    assert.match(vmJs, /const queueCreateFoldersRender = \(\) =>/);
    assert.match(dashboardJs, /const queueCreateFoldersRender = \(\) =>/);
});

test('performance mode applies stricter refresh cadence and reduced motion guards', () => {
    assert.match(dockerJs, /PERFORMANCE_MODE_MIN_REFRESH_SECONDS/);
    assert.match(vmJs, /PERFORMANCE_MODE_MIN_REFRESH_SECONDS/);
    assert.match(dashboardJs, /PERFORMANCE_MODE_MIN_REFRESH_SECONDS/);
    assert.match(dockerJs, /strictMinSeconds/);
    assert.match(vmJs, /strictMinSeconds/);
    assert.match(dockerJs, /Math\.max\(PERFORMANCE_MODE_MIN_REFRESH_SECONDS,\s*strictMinSeconds \|\| PERFORMANCE_MODE_MIN_REFRESH_SECONDS\)/);
    assert.match(vmJs, /Math\.max\(PERFORMANCE_MODE_MIN_REFRESH_SECONDS,\s*strictMinSeconds \|\| PERFORMANCE_MODE_MIN_REFRESH_SECONDS\)/);
    assert.match(dashboardJs, /Math\.max\(PERFORMANCE_MODE_MIN_REFRESH_SECONDS,\s*dockerRequestedSeconds\)/);
    assert.match(dashboardJs, /Math\.max\(PERFORMANCE_MODE_MIN_REFRESH_SECONDS,\s*vmRequestedSeconds\)/);
    assert.match(dockerCss, /body\.fvplus-performance-mode \.folder-preview/);
    assert.match(vmCss, /body\.fvplus-performance-mode \.folder-preview/);
    assert.match(dashboardCss, /body\.fvplus-performance-mode \.folder-showcase/);
});

test('performance mode limits auto-restored expanded branches on runtime views', () => {
    assert.match(dockerJs, /PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT/);
    assert.match(vmJs, /PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT/);
    assert.match(dockerJs, /restoredExpansionCount/);
    assert.match(vmJs, /restoredExpansionCount/);
    assert.match(dockerJs, /expandedStateById\[id\] = false/);
    assert.match(vmJs, /expandedStateById\[id\] = false/);
});

test('dashboard widget renders root-level folders only when nested folders exist', () => {
    assert.match(dashboardJs, /const filterDashboardToRootFolders = \(folders\) =>/);
    assert.match(dashboardJs, /const dockerRootFolders = filterDashboardToRootFolders\(allDockerFolders\);/);
    assert.match(dashboardJs, /const vmRootFolders = filterDashboardToRootFolders\(allVmFolders\);/);
    assert.match(dashboardJs, /const parentId = normalizeFolderParentId\(folder\?\.parentId \|\| folder\?\.parent_id \|\| ''\);/);
    assert.match(dashboardJs, /Object\.keys\(rootOnly\)\.length/);
    assert.match(dashboardJs, /Object\.keys\(source\)\.length/);
    assert.match(dashboardJs, /const aggregateRootMatchCache = \(fullFolders,\s*rootFolders,\s*fullCache\) =>/);
    assert.match(dashboardJs, /const dockerMatchCache = aggregateRootMatchCache\(allDockerFolders,\s*folders,\s*dockerFullMatchCache\);/);
});

test('dashboard widget supports nested child folders and constrains expanded trays', () => {
    assert.match(dashboardJs, /const sortFolderIdsByPrefs = \(ids,\s*folders,\s*prefs\) =>/);
    assert.match(dashboardJs, /const renderDockerChildren = \(parentId\) =>/);
    assert.match(dashboardJs, /const renderVmChildren = \(parentId\) =>/);
    assert.match(dashboardJs, /appendTo: `\.folder-showcase-outer-\$\{parentKey\} > \.folder-showcase-\$\{parentKey\}`/);
    assert.match(dashboardJs, /const getDashboardCard = \(type, id\) =>/);
    assert.match(dashboardJs, /const card = getDashboardCard\(meta\.type,\s*safeId\);/);
    assert.match(dashboardCss, /\.folder-showcase\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;/);
    assert.match(dashboardCss, /\.folder-showcase-outer\[expanded="true"\] \.folder-showcase\s*\{[\s\S]*?display:\s*grid;/);
});

test('docker and vm render paths support precomputed membership caches', () => {
    assert.match(dockerJs, /buildDockerFolderMatchCache/);
    assert.match(dockerJs, /matchCacheEntry = null/);
    assert.match(vmJs, /buildVmFolderMatchCache/);
    assert.match(vmJs, /matchCacheEntry = null/);
});

test('third-party icon endpoint caches folder and icon scans', () => {
    assert.match(thirdPartyIconsPhp, /FVPLUS_THIRD_PARTY_ICON_CACHE_TTL/);
    assert.match(thirdPartyIconsPhp, /function readThirdPartyIconCache\s*\(/);
    assert.match(thirdPartyIconsPhp, /function writeThirdPartyIconCache\s*\(/);
    assert.match(thirdPartyIconsPhp, /thirdPartyFolderListSignature/);
    assert.match(thirdPartyIconsPhp, /thirdPartyFolderIconsSignature/);
});

test('row-centering observer scopes to docker containers instead of full document body by default', () => {
    assert.match(dockerModulesJs, /document\.querySelector\('#docker_list'\)/);
    assert.match(dockerModulesJs, /folderRowCenterObserver\.observe\(observerRoot/);
});

test('full readInfo docker template metadata uses cached signature index', () => {
    assert.match(libPhp, /FVPLUS_DOCKER_TEMPLATE_CACHE_TTL/);
    assert.match(libPhp, /function buildDockerTemplateSignature\s*\(/);
    assert.match(libPhp, /function getDockerTemplateIndexCached\s*\(/);
    assert.match(libPhp, /getDockerTemplateIndexCached\(\$dockerTemplates\)/);
});

test('tailscale helper calls support cache and running-state guard', () => {
    assert.match(libPhp, /FVPLUS_TAILSCALE_EXEC_CACHE_TTL/);
    assert.match(libPhp, /function fv3_read_tailscale_cache\s*\(/);
    assert.match(libPhp, /fv3_get_tailscale_fqdn_from_container\(string \$containerName,\s*bool \$containerRunning/);
    assert.match(libPhp, /fv3_get_tailscale_ip_from_container\(string \$containerName,\s*bool \$containerRunning/);
    assert.match(libPhp, /Skipping exec for stopped container/);
});

test('docker tooltip payload is lazy-built on first open', () => {
    assert.match(dockerJs, /const buildDockerTooltipContent\s*=\s*\(ct\)\s*=>/);
    assert.match(dockerJs, /fvTooltipLazyBuilt/);
    assert.match(dockerJs, /Loading preview\.\.\./);
});

test('docker runtime app column auto-sizes based on folder names and rebinds after render', () => {
    assert.match(dockerJs, /const estimateDockerRuntimeAutoAppWidth = \(\) =>/);
    assert.match(dockerJs, /const adjustDockerRuntimeAppWidthForRenderedOverflow = \(baseWidth = null\) =>/);
    assert.match(dockerJs, /const buildDockerRuntimeWidthDecision = \(\) =>/);
    assert.match(dockerJs, /const runDockerRuntimeWidthReflow = \(reason = 'direct'\) =>/);
    assert.match(dockerJs, /const scheduleDockerRuntimeWidthReflow = \(reason = 'event', delayMs = DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS\) =>/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_WIDTH_PHASES = Object\.freeze\(/);
    assert.match(dockerJs, /phase:\s*DOCKER_RUNTIME_WIDTH_PHASES\.idle/);
    assert.match(dockerJs, /let dockerRuntimeAutoAppWidthFloor = null;/);
    assert.match(dockerJs, /let dockerRuntimeAutoAppWidthFloorMode = null;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN = 36;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX = 56;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM = 56;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_MIN = 8;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_MAX = 26;/);
    assert.match(dockerJs, /const applyDockerRuntimeGapContract = \(widthPx, metrics = null\) =>/);
    assert.match(dockerJs, /label\.scrollWidth/);
    assert.match(dockerJs, /label\.clientWidth/);
    assert.match(dockerJs, /Math\.min\(rawOverflow, DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX\)/);
    assert.match(dockerJs, /const floorLimit = clampDockerRuntimeColumnWidth\(\s*estimatedAppWidth \+ DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,\s*1\s*\) \|\| estimatedAppWidth;/);
    assert.match(dockerJs, /boundedFloor = Math\.min\(dockerRuntimeAutoAppWidthFloor, floorLimit\)/);
    assert.match(dockerJs, /appliedWidth = Math\.max\(appliedWidth, boundedFloor\)/);
    assert.match(dockerJs, /dockerRuntimeAutoAppWidthFloor = decision\.nextFloor;/);
    assert.match(dockerJs, /const ensureDockerRuntimeWidthDebugPanel = \(\) =>/);
    assert.match(dockerJs, /window\.toggleDockerRuntimeWidthDebug = \(enabled = true\) =>/);
    assert.match(dockerJs, /const applyDockerRuntimeColumnWidths = \(_widthMap = null\) =>/);
    assert.match(dockerJs, /auto-sizes from folder names/);
    assert.match(dockerJs, /tbody#docker_list tr\.folder,\s*tbody#docker_view tr\.folder/);
    assert.match(dockerJs, /tbody#docker_list > tr > td:nth-child\(\$\{index\}\),\s*tbody#docker_view > tr > td:nth-child\(\$\{index\}\)/);
    assert.match(dockerJs, /bindDockerRuntimeAppColumnResizer\(\);/);
    assert.match(dockerJs, /queueDockerRuntimeResizerBind\(\);/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('render-complete', 0\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('folder-toggle', 24\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('prefs-change', 0\)/);
});

test('import apply uses chunked execution and performance diagnostics panel exists', () => {
    assert.match(settingsRuntime, /IMPORT_APPLY_CHUNK_SIZE/);
    assert.match(settingsRuntime, /runImportChunked/);
    assert.match(settingsRuntime, /performanceDiagnosticsState/);
    assert.match(settingsRuntime, /renderPerformanceDiagnostics/);
    assert.match(settingsPage, /performance-diagnostics-output/);
});
