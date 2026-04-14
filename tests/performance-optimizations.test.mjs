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
const dockerRuntimeHierarchyJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);
const dashboardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
);
const dashboardFolderMatchCachePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.folder-match-cache.js'
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
const diagnosticsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js'
);
const folderEditorJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const settingsImportJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js'
);
const utilsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js'
);
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);

const libPhp = fs.readFileSync(libPath, 'utf8');
const readInfoPhp = fs.readFileSync(readInfoPath, 'utf8');
const thirdPartyIconsPhp = fs.readFileSync(thirdPartyIconsPath, 'utf8');
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const dockerRuntimeHierarchyJs = fs.readFileSync(dockerRuntimeHierarchyJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');
const dashboardJs = fs.readFileSync(dashboardJsPath, 'utf8');
const dashboardFolderMatchCacheJs = fs.readFileSync(dashboardFolderMatchCachePath, 'utf8');
const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf8');
const dockerCss = fs.readFileSync(dockerCssPath, 'utf8');
const vmCss = fs.readFileSync(vmCssPath, 'utf8');
const dockerModulesJs = fs.readFileSync(dockerModulesPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const diagnosticsJs = fs.readFileSync(diagnosticsJsPath, 'utf8');
const folderEditorJs = fs.readFileSync(folderEditorJsPath, 'utf8');
const utilsJs = fs.readFileSync(utilsJsPath, 'utf8');
const settingsImportJs = fs.readFileSync(settingsImportJsPath, 'utf8');
const settingsRuntime = `${settingsJs}\n${settingsImportJs}\n${diagnosticsJs}`;
const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');

test('read_info supports cached full/state payload retrieval', () => {
    assert.match(libPhp, /const FVPLUS_INFO_CACHE_TTL_FULL\s*=\s*\d+/);
    assert.match(libPhp, /const FVPLUS_INFO_CACHE_TTL_STATE\s*=\s*\d+/);
    assert.match(libPhp, /function normalizeReadInfoMode\s*\(/);
    assert.match(libPhp, /function readInfoState\s*\(/);
    assert.match(libPhp, /function readInfoCached\s*\(/);
    assert.match(readInfoPhp, /\$preferLiveUpdateStatus = \$mode === 'state'/);
    assert.match(readInfoPhp, /if \(\$preferLiveUpdateStatus\) \{\s*echo json_encode\(readInfoState\(\$type,\s*true\)\);\s*return;\s*\}/);
    assert.match(readInfoPhp, /readInfoCached\(\$type,\s*\$mode,\s*\$ttl,\s*\$forceRefresh\)/);
    assert.match(readInfoPhp, /\$_GET\['mode'\]|\$_REQUEST\['mode'\]/);
});

test('runtime refresh uses lightweight state mode checks before re-rendering', () => {
    assert.match(dockerJs, /buildDockerRuntimeInfoUrl\('state'/);
    assert.match(vmJs, /read_info\.php\?type=vm&mode=state/);
    assert.match(dashboardJs, /read_info\.php\?type=\$\{type\}&mode=state/);
    assert.match(dockerJs, /const buildDockerRuntimeInfoUrl = \(mode = 'full', cacheBust = Date\.now\(\), options = \{\}\) =>/);
    assert.match(dockerJs, /const liveUpdateQuery = mode === 'state' && options\?\.liveUpdateStatus === true/);
    assert.match(dockerJs, /mode === 'state' \? '&mode=state' : ''\}\$\{liveUpdateQuery\}&nocache=1&_=\$\{cacheBust \|\| Date\.now\(\)\}/);
    assert.match(dockerJs, /const fetchDockerStateSignature = async \(options = \{\}\) => \{[\s\S]*buildDockerRuntimeInfoUrl\('state', Date\.now\(\), \{\s*liveUpdateStatus\s*\}\)/);
    assert.match(dockerJs, /createDockerRuntimeRequest\(`\/plugins\/folderview\.plus\/server\/prefs\.php\?type=docker&_=\$\{cacheBust\}`,/);
    assert.match(dockerJs, /const queueLoadlistRefresh = \(options = \{\}\) =>/);
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
    assert.match(dockerJs, /if \(createFoldersQueued\) \{\s*createFoldersQueued = false;[\s\S]*?nextDockerRenderSuppressLoadingUi = true;\s*queueCreateFoldersRender\(\);\s*\}/s);
    assert.doesNotMatch(dockerJs, /if \(createFoldersQueued\) \{\s*createFoldersQueued = false;\s*queueLoadlistRefresh\(\);\s*\}/s);
    assert.match(dockerJs, /const readDockerHostOrderFromDom = \(\) =>/);
    assert.match(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) =>/);
    assert.match(dockerJs, /let dockerHostLoadOwnsLoadingUi = false;/);
    assert.match(dockerJs, /const shouldSuppressDockerRuntimeLoadingUi = \(\) => dockerHostLoadOwnsLoadingUi \|\| nextDockerRenderSuppressLoadingUi \|\| activeDockerRenderSuppressLoadingUi;/);
    assert.match(dockerJs, /dockerRuntimeInfoByName = normalizeDockerRuntimeInfoMap\(parsed,\s*dockerRuntimeInfoByName\);[\s\S]*syncDockerVisibleFoldersFromRuntimeCache\(\);/);
    assert.doesNotMatch(dockerJs, /const buildDockerWebuiSignature = \(source\) =>/);
    assert.doesNotMatch(dockerJs, /if \(previousWebuiSignature !== nextWebuiSignature\) \{\s*queueLoadlistRefresh\(\);\s*return;\s*\}/s);
    assert.doesNotMatch(dockerJs, /applyDockerPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*syncDockerPinnedFolderUi\(\);\s*queueLoadlistRefresh\(/s);
    assert.match(dockerJs, /const yieldDockerRenderLoop = async \(processedCount,\s*totalCount\) =>/);
    assert.match(dockerJs, /dockerHostLoadOwnsLoadingUi = true;\s*if \(FOLDER_VIEW_DEBUG_MODE\) console\.log\('\[FV3_DEBUG\] Patched listview: loadedFolder is false\. Queueing createFolders render\.'/);
    assert.match(dockerJs, /loadedFolder = false;\s*dockerHostLoadOwnsLoadingUi = true;/);
    assert.match(dockerJs, /dockerHostLoadOwnsLoadingUi = false;\s*activeDockerRenderSuppressLoadingUi = false;/);
    assert.match(dockerJs, /function buildDockerFolderReq\(options = \{\}\) \{[\s\S]*const liveUpdateStatus = options\?\.liveUpdateStatus === true \|\| isDockerHostUpdateSyncSuspended\(\);/);
    assert.match(dockerJs, /render:\s*\[[\s\S]*createDockerRuntimeRequest\(buildDockerRuntimeInfoUrl\('state', cacheBust, \{\s*liveUpdateStatus\s*\}\),/);
    assert.match(dockerJs, /fullInfo:\s*createDockerRuntimeRequest\(buildDockerRuntimeInfoUrl\('full', cacheBust\),/);
    assert.match(dockerJs, /const normalizeUpdatedToken = \(value\) => \(value === false \? 'u0' : \(value === true \? 'u1' : 'ux'\)\);/);
    assert.match(dockerJs, /const updated = normalizeUpdatedToken\(entry\.Updated\);/);
    assert.match(dockerJs, /const updated = normalizeUpdatedToken\(state\.Updated\);/);
    assert.match(dockerJs, /return `\$\{status\}:\$\{autostart\}:\$\{manager\}:\$\{updated\}:\$\{label\}`;/);
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
    assert.match(dashboardFolderMatchCacheJs, /const filterDashboardToRootFolders = \(folders\) =>/);
    assert.match(dashboardFolderMatchCacheJs, /const normalizeFolderParentId = \(value\) =>/);
    assert.match(dashboardFolderMatchCacheJs, /Object\.keys\(rootOnly\)\.length/);
    assert.match(dashboardFolderMatchCacheJs, /Object\.keys\(source\)\.length/);
    assert.match(dashboardFolderMatchCacheJs, /const aggregateRootMatchCache = \(fullFolders,\s*rootFolders,\s*fullCache\) =>/);
    assert.match(dashboardJs, /const dockerRootFolders = filterDashboardToRootFolders\(allDockerFolders\);/);
    assert.match(dashboardJs, /const vmRootFolders = filterDashboardToRootFolders\(allVmFolders\);/);
    assert.match(dashboardJs, /const dockerMatchCache = aggregateRootMatchCache\(allDockerFolders,\s*folders,\s*dockerFullMatchCache\);/);
});

test('dashboard widget supports nested child folders and constrains expanded trays', () => {
    assert.match(dashboardFolderMatchCacheJs, /const sortFolderIdsByPrefs = \(ids,\s*folders,\s*prefs\) =>/);
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

test('docker preview popup runtime stays enabled behind lazy advanced-preview initialization', () => {
    assert.match(dockerJs, /const buildDockerTooltipContent\s*=\s*\(ct\)\s*=>/);
    assert.match(dockerJs, /const DOCKER_PREVIEW_POPUP_ENABLED = true;/);
    assert.match(dockerJs, /fvTooltipLazyBuilt/);
    assert.match(dockerJs, /Loading preview\.\.\./);
    assert.match(dockerJs, /const initializeDockerTooltipOnDemand = \(\$target,\s*init,\s*hoverOpen = true\) =>/);
    assert.match(dockerJs, /initializeDockerTooltipOnDemand\(\$\(tooltip_trigger_element\), \(\) => \$\(tooltip_trigger_element\)\.tooltipster\(\{/);
    assert.match(dockerJs, /\}\), triggerMode === 'hover'\);/);
    assert.match(dockerJs, /if \(DOCKER_PREVIEW_POPUP_ENABLED !== true\) \{\s*return;\s*\}/);
    assert.match(dockerJs, /if\(DOCKER_PREVIEW_POPUP_ENABLED && tooltip_trigger_element && tooltip_trigger_element\.length > 0\) \{/);
});

test('docker first paint keeps a lightweight loading shell and enriches state payload fields', () => {
    assert.match(dockerJs, /const ensureDockerRuntimeLoadingOverlay = \(\) =>/);
    assert.match(dockerJs, /showDockerRuntimeLoadingOverlay\(\);/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-loading-overlay\s*\{/);
    assert.match(libPhp, /\$dockerWebuiInfo = readDockerWebuiInfoCache\(\);/);
    assert.match(libPhp, /resolveDockerCachedUpdatedStateValue\(string \$containerName, array \$dockerWebuiInfo = \[\]\): \?bool/);
    assert.match(libPhp, /function readInfoState\(string \$type,\s*bool \$preferLiveUpdateStatus = false\): array/);
    assert.match(libPhp, /'Updated'\s*=>\s*\$manager === 'dockerman'[\s\S]*resolveDockerCachedUpdatedStateValue\(\$name, \$dockerWebuiInfo\)/);
    assert.match(libPhp, /'Labels'\s*=>\s*\$labels/);
    assert.match(libPhp, /'Image'\s*=>\s*trim\(\(string\)\(\$container\['Image'\] \?\? ''\)\)/);
    assert.match(libPhp, /'shortImageId'\s*=>\s*substr\(str_replace\('sha256:', '', \(string\)\(\$container\['ImageID'\] \?\? ''\)\), 0, 12\)/);
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
    assert.match(dockerJs, /widthNodes = \[/);
    assert.match(dockerJs, /node\.scrollWidth/);
    assert.match(dockerJs, /node\.clientWidth/);
    assert.match(dockerJs, /if \(clientWidth <= 0\) \{\s*return;\s*\}/);
    assert.match(dockerJs, /if \(clientWidth < DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN && rawOverflow <= 0\) \{\s*return;\s*\}/);
    assert.match(dockerJs, /Math\.min\(rawOverflow, DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX\)/);
    assert.match(dockerJs, /const floorLimit = clampDockerRuntimeColumnWidth\(\s*estimatedAppWidth \+ DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,\s*1\s*\) \|\| estimatedAppWidth;/);
    assert.match(dockerJs, /boundedFloor = Math\.min\(dockerRuntimeAutoAppWidthFloor, floorLimit\)/);
    assert.match(dockerJs, /appliedWidth = Math\.max\(appliedWidth, boundedFloor\)/);
    assert.match(dockerJs, /dockerRuntimeAutoAppWidthFloor = decision\.nextFloor;/);
    assert.match(dockerJs, /const ensureDockerRuntimeWidthDebugPanel = \(\) =>/);
    assert.match(dockerJs, /window\.toggleDockerRuntimeWidthDebug = \(enabled = true\) =>/);
    assert.match(dockerJs, /const applyDockerRuntimeColumnWidths = \(_widthMap = null\) =>/);
    assert.match(dockerJs, /estimateFromRows\(\{\s*rows,\s*baseline,/s);
    assert.match(dockerJs, /nameSelector:\s*'\.folder-appname'/);
    assert.match(dockerJs, /auxSelectors:\s*\['\.folder-state'\]/);
    assert.match(dockerJs, /tbody#docker_list tr\.folder,\s*tbody#docker_view tr\.folder/);
    assert.match(dockerJs, /tbody#docker_list > tr > td:nth-child\(\$\{index\}\),\s*tbody#docker_view > tr > td:nth-child\(\$\{index\}\)/);
    assert.match(dockerJs, /bindDockerRuntimeAppColumnResizer\(\);/);
    assert.match(dockerJs, /queueDockerRuntimeResizerBind\(\);/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('render-complete', 12\)/);
    assert.match(dockerRuntimeHierarchyJs, /scheduleRuntimeWidthReflow\('folder-toggle', 24\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('prefs-change', 0\)/);
});

test('vm runtime tiny-width overflow guard can still recover clipped folder names', () => {
    assert.match(vmJs, /if \(clientWidth <= 0\) \{\s*return;\s*\}/);
    assert.match(vmJs, /if \(clientWidth < VM_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN && rawOverflow <= 0\) \{\s*return;\s*\}/);
    assert.match(vmJs, /Math\.min\(rawOverflow, VM_RUNTIME_APP_OVERFLOW_NUDGE_MAX\)/);
});

test('import apply uses chunked execution and performance diagnostics stay internal to support exports', () => {
    assert.match(settingsRuntime, /IMPORT_APPLY_CHUNK_SIZE/);
    assert.match(settingsRuntime, /runImportChunked/);
    assert.match(settingsRuntime, /performanceDiagnosticsState/);
    assert.match(settingsRuntime, /renderPerformanceDiagnostics/);
    assert.doesNotMatch(settingsPage, /performance-diagnostics-output/);
});

test('settings/runtime scripts use batched localStorage writes', () => {
    assert.match(utilsJs, /const createBatchedStorageWriter = \(storageRef = null,\s*options = \{\}\) =>/);
    assert.match(dockerJs, /const dockerStorageWriter = typeof utils\.createBatchedStorageWriter === 'function'/);
    assert.match(vmJs, /const vmStorageWriter = typeof utils\.createBatchedStorageWriter === 'function'/);
    assert.match(dashboardJs, /const dashboardStorageWriter = typeof utils\.createBatchedStorageWriter === 'function'/);
    assert.match(settingsJs, /const settingsStorageWriter = utils && typeof utils\.createBatchedStorageWriter === 'function'/);
});

test('folder editor avoids synchronous large-list stalls via chunking and worker-backed regex matching', () => {
    assert.match(folderEditorJs, /const MEMBER_LIST_RENDER_CHUNK_SIZE = \d+;/);
    assert.match(folderEditorJs, /const REGEX_WORKER_MIN_ITEMS = \d+;/);
    assert.match(folderEditorJs, /const getRegexWorker = \(\) =>/);
    assert.match(folderEditorJs, /const runRegexMatch = async \(pattern,\s*names\) =>/);
    assert.match(folderEditorJs, /const mergeMembersByName = \(baseMembers,\s*candidateMembers\) =>/);
    assert.match(folderEditorJs, /if \(rows\.length <= MEMBER_LIST_RENDER_CHUNK_SIZE\) \{/);
    assert.match(folderEditorJs, /scheduleAnimationFrameTask\(appendChunk\)/);
});

test('folder editor save queues docker order sync off the submit critical path in both runtimes', () => {
    assert.match(folderEditorJs, /const queueBackgroundMutationPost = \(url,\s*data = \{\}\) =>/);
    assert.match(folderEditorJs, /navigator\.sendBeacon/);
    assert.match(folderEditorJs, /keepalive:\s*true/);
    assert.match(folderEditorJs, /const shouldSyncDockerOrderAfterSave = \(nextFolder,\s*options = \{\}\) =>/);
    assert.match(folderEditorJs, /const flushPostSaveDockerSync = async \(options = \{\}\) =>/);
    assert.match(folderEditorJs, /if \(type !== 'docker'\) \{\s*return;\s*\}/);
    assert.match(folderEditorJs, /if \(!shouldSyncDockerOrderAfterSave\(options\.folder,\s*options\)\) \{\s*return;\s*\}/);
    const modernSubmitBlock = folderEditorJs.match(/const submitForm = async \(e, saveAsCopy = false\) => \{([\s\S]*?)\n\}/)?.[1] || '';
    assert.match(modernSubmitBlock, /const currentFolderId = String\(activeFolderEditorFolderId \|\| folderId \|\| ''\)\.trim\(\);/);
    assert.match(modernSubmitBlock, /await flushPostSaveDockerSync\(\{[\s\S]*force:\s*saveAsCopy \|\| !currentFolderId,[\s\S]*previousFolder[\s\S]*\}\);/);
    assert.doesNotMatch(modernSubmitBlock, /await securePost\('\/plugins\/folderview\.plus\/server\/sync_order\.php'/);
});
