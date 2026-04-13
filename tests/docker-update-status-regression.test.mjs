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
    assert.match(dockerJs, /const isDockerHostUpdateSyncSuspended = \(\) => readDockerHostUpdateSyncSuspendedUntil\(\) > Date\.now\(\);/);
    assert.match(dockerJs, /const suspendDockerHostUpdateSync = \(durationMs = 0\) => \{/);
    assert.match(dockerJs, /ensureDockerHostRowUpdateObserver\(\);\s*if \(!isDockerHostUpdateSyncSuspended\(\) && syncDockerHostRowUpdateStatesFromDom\(\)\) \{\s*containersInfo = \{ \.\.\.dockerRuntimeInfoByName \};\s*\}/);
    assert.match(dockerJs, /const queueDockerPostUpdateRuntimeReconcile = \(delayMs = 220\) => \{[\s\S]*refreshDockerRuntimeStateInPlace\(\{\s*followupDelayMs: 650\s*\}\)/);
    assert.match(dockerJs, /queueDockerSupportBundlePageSnapshot\('render-complete', 260\);\s*queueDockerPostUpdateRuntimeReconcile\(\);/);
});

test('deferred docker runtime hydration refreshes visible folder state in place instead of reloading the page', () => {
    assert.match(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?dockerRuntimeInfoByName = normalizeDockerRuntimeInfoMap\(parsed,\s*dockerRuntimeInfoByName\);[\s\S]*?markDockerFatalBannerStep\('Docker runtime details hydrated'\);[\s\S]*?recordDockerFatalBannerAction\('Docker runtime details hydrated'\);[\s\S]*?syncDockerVisibleFoldersFromRuntimeCache\(\);[\s\S]*?\}\)\s*\.catch\(\(\) => \{\}\);/);
    assert.doesNotMatch(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?const previousWebuiSignature/);
    assert.doesNotMatch(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?const nextWebuiSignature/);
});

test('folder update-column renderer is reused across initial and synced folder state', () => {
    assert.match(dockerJs, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) =>/);
    assert.match(dockerJs, /hierarchyApi\.renderFolderUpdateColumn\(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\);/);
    assert.match(dockerRuntimeHierarchyJs, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) =>/);
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

test('docker tooltip update action also respects the Docker advanced/basic cookie', () => {
    assert.match(dockerJs, /const tooltipShowAdvanced = \$\.cookie\('docker_listview_mode'\) == 'advanced';/);
    assert.match(dockerJs, /const tooltipForceUpdateHtml = tooltipShowAdvanced/);
    assert.match(dockerJs, /tooltipForceUpdateHtml/);
});

test('docker runtime re-syncs folder rows when the Docker basic or advanced cookie changes live', () => {
    assert.match(dockerJs, /let lastDockerListViewMode = \$\.cookie\('docker_listview_mode'\) == 'advanced' \? 'advanced' : 'basic';/);
    assert.match(dockerJs, /const readDockerListViewMode = \(\) => \(\$\.cookie\('docker_listview_mode'\) == 'advanced' \? 'advanced' : 'basic'\);/);
    assert.match(dockerJs, /const syncDockerListViewModeFromCookie = \(\) => \{[\s\S]*if \(nextMode === lastDockerListViewMode\) \{\s*return;\s*\}[\s\S]*if \(!loadedFolder \|\| !globalFolders \|\| Object\.keys\(globalFolders\)\.length <= 0\) \{\s*return;\s*\}[\s\S]*syncDockerVisibleFoldersFromRuntimeCache\(\);[\s\S]*scheduleDockerRuntimeWidthReflow\('listview-mode-change', 12\);/);
    assert.match(dockerJs, /const startDockerListViewModeObserver = \(\) => \{[\s\S]*dockerListViewModeObserverTimer = window\.setInterval\(\(\) => \{[\s\S]*syncDockerListViewModeFromCookie\(\);[\s\S]*\}, 500\);[\s\S]*document\.addEventListener\('visibilitychange', syncDockerListViewModeFromCookie\);[\s\S]*window\.addEventListener\('focus', syncDockerListViewModeFromCookie\);/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker request bundle primed'\);\s*startDockerListViewModeObserver\(\);/);
});

test('docker folder expand path re-syncs direct member rows from runtime state after moving them out of storage', () => {
    assert.match(dockerJs, /syncDockerFolderMemberRows: \(id,\s*runtimeContainers\) => syncDockerFolderMemberRows\(id,\s*runtimeContainers\),/);
    assert.match(dockerRuntimeHierarchyJs, /const syncDockerFolderMemberRows = typeof deps\.syncDockerFolderMemberRows === 'function'[\s\S]*:\s*\(\(\) => \{\}\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$directMemberRows = getDirectMemberRowsForFolder\(id\);[\s\S]*const directRuntimeContainers = buildRuntimeContainerMapForFolder\(id,\s*false\);[\s\S]*\$folderRow\.after\(\$directMemberRows\);[\s\S]*syncDockerFolderMemberRows\(id,\s*directRuntimeContainers\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$rowsToShow = \$directMemberRows\.length \? \$directMemberRows : \$fallbackRows;[\s\S]*const directRuntimeContainers = buildRuntimeContainerMapForFolder\(id,\s*false\);[\s\S]*jq\(`tr\.folder-id-\$\{id\}`\)\.after\(\$rowsToShow\);[\s\S]*syncDockerFolderMemberRows\(id,\s*directRuntimeContainers\);/);
});
