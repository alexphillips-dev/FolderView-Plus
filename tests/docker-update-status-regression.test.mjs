import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);
const dockerPreviewActionsModule = require(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.preview-actions.js')
);
const dockerPreviewActionsJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.preview-actions.js'),
    'utf8'
);
const dockerRuntimeInfoJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.info.js'),
    'utf8'
);
const dockerRuntimeHierarchyJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js'),
    'utf8'
);
const dockerCss = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'),
    'utf8'
);

test('docker runtime preserves hydrated update flags when normalizing partial runtime entries', () => {
    assert.match(dockerRuntimeInfoJs, /const sourceUpdated = typeof sourceState\.Updated === 'boolean'/);
    assert.match(dockerRuntimeInfoJs, /typeof source\.Updated === 'boolean' \? source\.Updated : null/);
    assert.match(dockerRuntimeInfoJs, /const resolvedUpdated = typeof sourceUpdated === 'boolean'/);
    assert.match(dockerRuntimeInfoJs, /typeof previousState\.Updated === 'boolean'/);
});

test('docker runtime still falls back to the host row update cell when cached state omits update flags', () => {
    assert.match(dockerRuntimeInfoJs, /const readDockerHostRowUpdatedState = \(name\) => \{/);
    assert.match(dockerRuntimeInfoJs, /const row = doc\.getElementById\(`ct-\$\{safeName\}`\);/);
    assert.match(dockerRuntimeInfoJs, /const updateCell = row\.querySelector\('td\.updatecolumn'\);/);
    assert.match(dockerRuntimeInfoJs, /const normalizedText = String\(updateCell\.textContent \|\| ''\)\.trim\(\)\.toLowerCase\(\);/);
    assert.match(dockerRuntimeInfoJs, /const i18nText = \(key, fallback = ''\) => \{/);
    assert.match(dockerRuntimeInfoJs, /const hasToken = \(\.\.\.tokens\) => tokens\.some/);
    assert.match(dockerRuntimeInfoJs, /if \(updateCell\.querySelector\('\.fa-flash'\)\) \{\s*return false;\s*\}/);
    assert.match(dockerRuntimeInfoJs, /if \(updateCell\.querySelector\('\.fa-check'\)\) \{\s*return true;\s*\}/);
    assert.match(dockerRuntimeInfoJs, /if \(hasToken\(i18nText\('update-ready', 'update ready'\), i18nText\('apply-update', 'apply update'\), 'update ready', 'apply update'\)\) \{\s*return false;\s*\}/);
    assert.match(dockerRuntimeInfoJs, /if \(hasToken\(i18nText\('up-to-date', 'up-to-date'\), i18nText\('force-update', 'force update'\), 'up-to-date', 'force update'\)\) \{\s*return true;\s*\}/);
    assert.match(dockerRuntimeInfoJs, /const resolvedUpdated = typeof sourceUpdated === 'boolean'[\s\S]*readDockerHostRowUpdatedState\(safeName\)/);
    assert.match(dockerRuntimeInfoJs, /Updated:\s*resolvedUpdated/);
});

test('docker runtime observes native update-column mutations and reuses them for folder cache sync', () => {
    assert.match(dockerRuntimeInfoJs, /let dockerHostUpdateCellObserver = null;/);
    assert.match(dockerRuntimeInfoJs, /const isHostUpdateSyncSuspended = typeof deps\.isHostUpdateSyncSuspended === 'function'/);
    assert.match(dockerRuntimeInfoJs, /const syncDockerHostRowUpdateStatesFromDom = \(names = \[\]\) => \{/);
    assert.match(dockerRuntimeInfoJs, /if \(isHostUpdateSyncSuspended\(\)\) \{\s*return false;\s*\}/);
    assert.match(dockerRuntimeInfoJs, /const queueDockerHostRowUpdateStateSync = \(names = \[\]\) => \{/);
    assert.match(dockerRuntimeInfoJs, /if \(syncDockerHostRowUpdateStatesFromDom\(pendingNames\)\) \{\s*syncDockerVisibleFoldersFromRuntimeCache\(\);\s*\}/);
    assert.match(dockerRuntimeInfoJs, /const ensureDockerHostRowUpdateObserver = \(\) => \{[\s\S]*dockerHostUpdateCellObserver = new MutationObserver/);
    assert.match(dockerJs, /const DOCKER_HOST_UPDATE_SYNC_SUSPENDED_UNTIL_KEY = '__fvplusDockerHostUpdateSyncSuspendedUntil';/);
    assert.match(dockerJs, /const DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY = dockerRuntimeDiagnosticsModule\?\.DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY \|\| 'fv\.support\.bundle\.docker\.page\.v1';/);
    assert.match(dockerJs, /const dockerHostGuardsModule = window\.FolderViewPlusDockerHostGuards \|\| null;/);
    assert.match(dockerJs, /const dockerRuntimeDiagnosticsModule = window\.FolderViewPlusDockerRuntimeDiagnostics \|\| null;/);
    assert.match(dockerJs, /const DOCKER_HOST_UPDATE_COMMAND_REGEX = \/\^\\s\*update_container\(\?:\\s\|\$\)\/i;/);
    assert.match(dockerJs, /const isDockerHostUpdateCommand = \(command\) => DOCKER_HOST_UPDATE_COMMAND_REGEX\.test\(String\(command \|\| ''\)\.trim\(\)\);/);
    assert.match(dockerJs, /const isDockerHostUpdateSyncSuspended = \(\) => readDockerHostUpdateSyncSuspendedUntil\(\) > Date\.now\(\);/);
    assert.match(dockerJs, /const suspendDockerHostUpdateSync = \(durationMs = 0\) => \{/);
    assert.match(dockerJs, /const updateDockerTraceHealth = \(traceName,\s*success,\s*details = \{\}\) => \{/);
    assert.match(dockerJs, /const appendDockerBulkUpdateTrace = \(eventType,\s*details = \{\}\) => \{/);
    assert.match(dockerJs, /const appendDockerRequestBundleTrace = \(eventType,\s*details = \{\}\) => \{/);
    assert.match(dockerJs, /diagnosticsApi\.updateTraceHealth\(traceName,\s*success,\s*details\)/);
    assert.match(dockerJs, /diagnosticsApi\.appendBulkUpdateTrace\(eventType,\s*details\)/);
    assert.match(dockerJs, /diagnosticsApi\.appendRequestBundleTrace\(eventType,\s*details\)/);
    assert.match(dockerJs, /ensureDockerHostRowUpdateObserver\(\);\s*if \(!isDockerHostUpdateSyncSuspended\(\) && syncDockerHostRowUpdateStatesFromDom\(\)\) \{\s*containersInfo = \{ \.\.\.dockerRuntimeInfoByName \};\s*\}/);
    assert.match(dockerJs, /const buildDockerRuntimeInfoUrl = \(mode = 'full', cacheBust = Date\.now\(\), options = \{\}\) =>/);
    assert.match(dockerJs, /const liveUpdateQuery = mode === 'state' && options\?\.liveUpdateStatus === true/);
    assert.match(dockerJs, /const fetchDockerStateSignature = async \(options = \{\}\) => \{[\s\S]*const liveUpdateStatus = options\?\.liveUpdateStatus === true;[\s\S]*buildDockerRuntimeInfoUrl\('state', Date\.now\(\), \{\s*liveUpdateStatus\s*\}\)/);
    assert.match(dockerJs, /const queueDockerPostUpdateRenderReconcile = \(reason = 'docker-post-folders-creation'\) => \{[\s\S]*appendDockerBulkUpdateTrace\('postUpdateRenderReconcile'/);
    assert.match(dockerJs, /const queueDockerPostUpdateRenderReconcile = \(reason = 'docker-post-folders-creation'\) => \{[\s\S]*refreshDockerRuntimeStateInPlace\(\{\s*followupDelayMs: 650,\s*liveUpdateStatus: true\s*\}\)/);
    assert.match(dockerJs, /const bindDockerPostUpdateRenderReconcile = \(\) => \{[\s\S]*window\.folderEvents\.addEventListener\('docker-post-folders-creation', \(\) => \{[\s\S]*queueDockerPostUpdateRenderReconcile\('docker-post-folders-creation'\);[\s\S]*\}\);/);
    assert.match(dockerJs, /function armDockerPostUpdateRuntimeReconcileForHostCommand\(command,\s*origin = 'host-openDocker'\) \{[\s\S]*appendDockerBulkUpdateTrace\('hostUpdateCommand'/);
    assert.match(dockerJs, /function bindDockerHostOpenDockerPatch\(\) \{[\s\S]*captureHostHook\?\.\('window\.openDocker'/);
    assert.match(dockerJs, /function bindDockerHostOpenDockerPatch\(\) \{[\s\S]*noteHookInvocation\?\.\('window\.openDocker'/);
    assert.match(dockerJs, /function bindDockerHostOpenDockerPatch\(\) \{[\s\S]*noteHookWrapped\?\.\('window\.openDocker'/);
    assert.match(dockerJs, /const armDockerPostUpdateRuntimeReconcileWindow = \(durationMs = 0,\s*options = \{\}\) => \{[\s\S]*appendDockerBulkUpdateTrace\('reconcileWindowArmed'/);
    assert.match(dockerJs, /const handleDockerUpdateActionClickCapture = \(event\) => \{[\s\S]*appendDockerBulkUpdateTrace\('updateActionClick'/);
    assert.match(dockerJs, /const bindDockerUpdateActionClickCapture = \(\) => \{[\s\S]*document\.addEventListener\('click', handleDockerUpdateActionClickCapture, true\);/);
    assert.doesNotMatch(dockerJs, /queueDockerSupportBundlePageSnapshot\('render-complete', 260\);\s*queueDockerPostUpdateRuntimeReconcile\(\);/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker request bundle primed'\);\s*bindDockerHostOpenDockerPatch\(\);\s*bindDockerUpdateActionClickCapture\(\);\s*bindDockerPostUpdateRenderReconcile\(\);\s*startDockerListViewModeObserver\(\);/);
    assert.match(dockerJs, /if \(!loadedFolder\) \{[\s\S]*folderReq = buildDockerFolderReq\(\{\s*liveUpdateStatus: isDockerHostUpdateSyncSuspended\(\)\s*\}\);/);
    assert.match(dockerJs, /window\.loadlist = \(\) => \{[\s\S]*bindDockerHostOpenDockerPatch\(\);[\s\S]*folderReq = buildDockerFolderReq\(\{\s*liveUpdateStatus: isDockerHostUpdateSyncSuspended\(\)\s*\}\);/);
    assert.match(dockerJs, /const collectDockerSupportBundlePageSnapshot = \(reason = 'runtime-sync'\) => \{[\s\S]*diagnosticsApi\.collectPageSnapshot\(reason\)/);
    assert.match(dockerJs, /const buildDockerDiagnosticsCorrelationContext = \(\) => \(\{/);
    assert.match(dockerJs, /hookStates:\s*getDockerHostGuardsApi\(\)\?\.getHookStates\?\.\(\) \|\| \{\}/);
});

test('docker support bundle snapshot reads only visible update-column text in basic view', () => {
    assert.match(dockerJs, /const collectDockerSupportBundlePageSnapshot = \(reason = 'runtime-sync'\) => \{[\s\S]*diagnosticsApi\.collectPageSnapshot\(reason\)/);
    assert.doesNotMatch(dockerJs, /const updateCellText = normalizeDockerSupportBundleText\(\$row\.find\('td\.updatecolumn'\)\.first\(\)\.text\(\)\);/);
});

test('deferred docker runtime hydration refreshes visible folder state in place instead of reloading the page', () => {
    assert.match(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?dockerRuntimeInfoByName = normalizeDockerRuntimeInfoMap\(parsed,\s*dockerRuntimeInfoByName\);[\s\S]*?markDockerFatalBannerStep\('Docker runtime details hydrated'\);[\s\S]*?recordDockerFatalBannerAction\('Docker runtime details hydrated'\);[\s\S]*?syncDockerVisibleFoldersFromRuntimeCache\(\);[\s\S]*?\}\)\s*\.catch\(\(\) => \{\}\);/);
    assert.doesNotMatch(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?const previousWebuiSignature/);
    assert.doesNotMatch(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?const nextWebuiSignature/);
});

test('folder update-column renderer is reused across initial and synced folder state', () => {
    assert.match(dockerJs, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) =>/);
    assert.match(dockerJs, /hierarchyApi\.renderFolderUpdateColumn\(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\);/);
    assert.match(dockerJs, /hierarchyApi && typeof hierarchyApi\.resolveFolderUpdateColumnState === 'function'/);
    assert.match(dockerRuntimeHierarchyJs, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) =>/);
    assert.match(dockerRuntimeHierarchyJs, /const resolveFolderUpdateColumnState = \(managerTypes,\s*upToDate,\s*managed,\s*options = \{\}\) => \{/);
    const helperUsages = dockerJs.match(/renderFolderUpdateColumn\(id,\s*(?:\$\(`tr\.folder-id-\$\{id\} > td\.updatecolumn`\)|\$updateColumn),\s*managerTypes,\s*upToDate,\s*managed\);/g) || [];
    assert.ok(helperUsages.length >= 2, 'expected shared folder update-column rendering in both initial and sync paths');
});

test('docker runtime builds member row update markup from per-container runtime state', () => {
    const previewActionsApi = dockerPreviewActionsModule.createApi({
        window: {},
        $: Object.assign(() => ({}), {
            i18n: (key) => key,
            cookie: () => ''
        }),
        escapeHtml: (value) => String(value ?? '')
    });
    const previewActionsAdvancedApi = dockerPreviewActionsModule.createApi({
        window: {},
        $: Object.assign(() => ({}), {
            i18n: (key) => key,
            cookie: () => 'advanced'
        }),
        escapeHtml: (value) => String(value ?? '')
    });

    const updateReadyHtml = previewActionsApi.buildDockerMemberUpdateColumnHtml({
        name: 'app-one',
        manager: 'dockerman',
        update: true
    });
    const upToDateHtml = previewActionsApi.buildDockerMemberUpdateColumnHtml({
        name: 'app-two',
        manager: 'dockerman',
        update: false
    });
    const composeHtml = previewActionsApi.buildDockerMemberUpdateColumnHtml({
        name: 'stack-one',
        manager: 'composeman',
        update: true
    });
    const thirdPartyHtml = previewActionsApi.buildDockerMemberUpdateColumnHtml({
        name: 'custom-one',
        manager: 'plugin-manager',
        update: true
    });
    const escapedQuoteHtml = previewActionsApi.buildDockerMemberUpdateColumnHtml({
        name: "quote'app",
        manager: 'dockerman',
        update: true
    });
    const advancedUpToDateHtml = previewActionsAdvancedApi.buildDockerMemberUpdateColumnHtml({
        name: 'app-two',
        manager: 'dockerman',
        update: false
    });
    const dockermanUpdateReadyState = previewActionsApi.resolveDockerMemberUpdateState({
        name: 'app-one',
        manager: 'dockerman',
        update: true
    });
    const dockermanUpToDateState = previewActionsAdvancedApi.resolveDockerMemberUpdateState({
        name: 'app-two',
        manager: 'dockerman',
        update: false
    });
    const composeState = previewActionsApi.resolveDockerMemberUpdateState({
        name: 'stack-one',
        manager: 'composeman',
        update: true
    });

    assert.match(updateReadyHtml, /update-ready/);
    assert.match(updateReadyHtml, /apply-update/);
    assert.match(updateReadyHtml, /updateContainer\('app-one'\)/);
    assert.doesNotMatch(updateReadyHtml, /force-update/);
    assert.match(upToDateHtml, /up-to-date/);
    assert.doesNotMatch(upToDateHtml, /force-update/);
    assert.doesNotMatch(upToDateHtml, /updateContainer\('app-two'\)/);
    assert.match(advancedUpToDateHtml, /force-update/);
    assert.match(advancedUpToDateHtml, /updateContainer\('app-two'\)/);
    assert.doesNotMatch(upToDateHtml, /apply-update/);
    assert.match(composeHtml, /compose/);
    assert.doesNotMatch(composeHtml, /updateContainer\(/);
    assert.match(thirdPartyHtml, /third-party/);
    assert.doesNotMatch(thirdPartyHtml, /updateContainer\(/);
    assert.match(escapedQuoteHtml, /updateContainer\('quote\\'app'\)/);
    assert.equal(dockermanUpdateReadyState.statusToken, 'updateReady');
    assert.equal(dockermanUpdateReadyState.actionToken, 'applyUpdate');
    assert.equal(dockermanUpToDateState.statusToken, 'upToDate');
    assert.equal(dockermanUpToDateState.actionToken, 'forceUpdate');
    assert.equal(composeState.statusToken, 'compose');
    assert.equal(composeState.actionToken, 'other');
    assert.match(dockerPreviewActionsJs, /const resolveDockerMemberUpdateState = \(entry = \{\},\s*options = \{\}\) => \{/);
});

test('docker runtime sync normalizes hidden member rows before expand', () => {
    assert.match(dockerPreviewActionsModule.createApi({
        window: {},
        $: Object.assign(() => ({}), {
            i18n: (key) => key
        }),
        escapeHtml: (value) => String(value ?? '')
    }).buildDockerMemberUpdateColumnHtml({ name: 'demo', manager: 'dockerman', update: true }), /apply-update/);
    assert.match(dockerJs, /const syncDockerFolderMemberRows = \(id,\s*runtimeContainers\) => \{[\s\S]*previewActionsApi\.syncDockerFolderMemberRows\(id,\s*runtimeContainers\);/s);
    assert.match(dockerJs, /folder\.runtimeContainers = runtimeContainers;\s*syncDockerFolderMemberRows\(id,\s*runtimeContainers\);/s);
    assert.match(dockerJs, /folder\.containers = newFolder;[\s\S]*syncDockerFolderMemberRows\(id,\s*newFolder\);/s);
});

test('docker runtime sync rewrites both hidden and expanded member rows', () => {
    assert.match(dockerRuntimeInfoJs, /const readDockerHostRowUpdatedState = \(name\) => \{/);
    assert.match(dockerPreviewActionsModule.createApi({
        window: {},
        $: Object.assign(() => ({}), {
            i18n: (key) => key,
            cookie: () => 'advanced'
        }),
        escapeHtml: (value) => String(value ?? '')
    }).buildDockerMemberUpdateColumnHtml({ name: 'demo', manager: 'dockerman', update: false }), /force-update/);
    assert.match(
        dockerPreviewActionsModule.createApi({
            window: {},
            $: Object.assign(() => ({}), {
                i18n: (key) => key
            }),
            escapeHtml: (value) => String(value ?? '')
        }).syncDockerFolderMemberRows.toString(),
        /findDockerFolderMemberRow/
    );
    assert.match(dockerPreviewActionsJs, /const getDirectMemberRowsForFolder = typeof deps\.getDirectMemberRowsForFolder === 'function'/);
    assert.match(dockerPreviewActionsJs, /const findDockerFolderMemberRow = \(id,\s*containerName\) => \{/);
    assert.match(dockerPreviewActionsJs, /tr\.folder-id-\$\{folderId\} div\.folder-storage > tr, tr\.folder-\$\{folderId\}-element/);
    assert.match(dockerPreviewActionsJs, /return matchRows\(getDirectMemberRowsForFolder\(folderId\)\);/);
    assert.match(dockerJs, /getDirectMemberRowsForFolder: \(id\) => getDirectMemberRowsForFolder\(id\),/);
});

test('docker preview update highlight survives live runtime sync', () => {
    assert.match(dockerJs, /const updateClass = settings\?\.preview_update && entry\?\.update === true \? ' orange-text fv-preview-update-ready' : '';/);
    assert.match(dockerJs, /\$appNameSpan\.addClass\('orange-text fv-preview-update-ready'\);/);
    assert.match(dockerJs, /\$appNameSpan\.children\('a\.exec'\)\.addClass\('orange-text fv-preview-update-ready'\);/);
    assert.match(dockerPreviewActionsJs, /const syncDockerPreviewUpdateHighlight = \(\$target,\s*settings = \{\},\s*entry = \{\}\) => \{/);
    assert.match(dockerPreviewActionsJs, /\$appName\.toggleClass\('orange-text fv-preview-update-ready', highlightUpdate\);/);
    assert.match(dockerPreviewActionsJs, /\$appLink\.toggleClass\('orange-text fv-preview-update-ready', highlightUpdate\);/);
    assert.match(dockerPreviewActionsJs, /syncDockerPreviewUpdateHighlight\(\$target,\s*settings,\s*entry\);/);
    assert.match(dockerCss, /\.fv-preview-update-ready\s*\{/);
});

test('docker tooltip update action also respects the Docker advanced/basic cookie', () => {
    assert.match(dockerJs, /const tooltipShowAdvanced = \$\.cookie\('docker_listview_mode'\) == 'advanced';/);
    assert.match(dockerJs, /const previewActionsApi = getDockerPreviewActionsApi\(\);/);
    assert.match(dockerJs, /const tooltipUpdateHtml = previewActionsApi && typeof previewActionsApi\.buildDockerMemberUpdateColumnHtml === 'function'/);
    assert.match(dockerJs, /advanced: tooltipShowAdvanced/);
    assert.match(dockerJs, /<div class="status-version">\$\{tooltipUpdateHtml\}<br><i class="fa fa-info-circle fa-fw"><\/i>/);
});

test('docker runtime re-syncs folder rows when the Docker basic or advanced cookie changes live', () => {
    assert.match(dockerJs, /let lastDockerListViewMode = \$\.cookie\('docker_listview_mode'\) == 'advanced' \? 'advanced' : 'basic';/);
    assert.match(dockerJs, /const readDockerListViewMode = \(\) => \(\$\.cookie\('docker_listview_mode'\) == 'advanced' \? 'advanced' : 'basic'\);/);
    assert.match(dockerJs, /const DOCKER_LIST_VIEW_MODE_CHANGE_EVENT = 'fvplus:docker-listview-mode-change';/);
    assert.match(dockerJs, /const emitDockerListViewModeChange = \(mode,\s*source = 'cookie-write'\) => \{/);
    assert.match(dockerJs, /const bindDockerListViewModeCookieHook = \(\) => \{[\s\S]*if \(args\.length >= 2 && String\(args\[0\] \|\| ''\)\.trim\(\) === 'docker_listview_mode'\) \{[\s\S]*emitDockerListViewModeChange\(readDockerListViewMode\(\), 'cookie-write'\);/);
    assert.match(dockerJs, /const syncDockerListViewModeFromCookie = \(source = 'passive'\) => \{[\s\S]*appendDockerRequestBundleTrace\('listViewModeSync'/);
    assert.match(dockerJs, /const startDockerListViewModeObserver = \(\) => \{[\s\S]*bindDockerListViewModeCookieHook\(\);[\s\S]*window\.addEventListener\(DOCKER_LIST_VIEW_MODE_CHANGE_EVENT,\s*\(event\) => \{[\s\S]*syncDockerListViewModeFromCookie\(event\?\.detail\?\.source \|\| 'event'\);[\s\S]*\}\);[\s\S]*window\.addEventListener\('focus', \(\) => syncDockerListViewModeFromCookie\('focus'\)\);[\s\S]*window\.addEventListener\('pageshow', \(\) => syncDockerListViewModeFromCookie\('pageshow'\)\);[\s\S]*document\.addEventListener\('visibilitychange', \(\) => \{[\s\S]*syncDockerListViewModeFromCookie\('visibilitychange'\);/);
    assert.match(dockerJs, /window\.loadlist = \(\) => \{[\s\S]*bindDockerHostOpenDockerPatch\(\);[\s\S]*bindDockerListViewModeCookieHook\(\);/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker request bundle primed'\);\s*bindDockerHostOpenDockerPatch\(\);\s*bindDockerUpdateActionClickCapture\(\);\s*bindDockerPostUpdateRenderReconcile\(\);\s*startDockerListViewModeObserver\(\);/);
});

test('docker folder expand path re-syncs direct member rows from runtime state after moving them out of storage', () => {
    assert.match(dockerJs, /syncDockerFolderMemberRows: \(id,\s*runtimeContainers\) => syncDockerFolderMemberRows\(id,\s*runtimeContainers\),/);
    assert.match(dockerRuntimeHierarchyJs, /const syncDockerFolderMemberRows = typeof deps\.syncDockerFolderMemberRows === 'function'[\s\S]*:\s*\(\(\) => \{\}\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$directMemberRows = getDirectMemberRowsForFolder\(id\);[\s\S]*const directRuntimeContainers = buildRuntimeContainerMapForFolder\(id,\s*false\);[\s\S]*\$folderRow\.after\(\$directMemberRows\);[\s\S]*syncDockerFolderMemberRows\(id,\s*directRuntimeContainers\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$rowsToShow = \$directMemberRows\.length \? \$directMemberRows : \$fallbackRows;[\s\S]*const directRuntimeContainers = buildRuntimeContainerMapForFolder\(id,\s*false\);[\s\S]*jq\(`tr\.folder-id-\$\{id\}`\)\.after\(\$rowsToShow\);[\s\S]*syncDockerFolderMemberRows\(id,\s*directRuntimeContainers\);/);
});
