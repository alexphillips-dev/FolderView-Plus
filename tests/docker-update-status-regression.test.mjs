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
const dockerRuntimeInfoModule = require(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.info.js')
);
const dockerRuntimeReconcileModule = require(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.reconcile.js')
);
const runtimeHostAdaptersModule = require(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.host-adapter.js')
);
const dockerPreviewActionsJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.preview-actions.js'),
    'utf8'
);
const dockerRuntimeInfoJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.info.js'),
    'utf8'
);
const dockerRuntimeReconcileJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.reconcile.js'),
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
    assert.match(dockerRuntimeInfoJs, /const preservePreviousUpdated = typeof previousState\.Updated === 'boolean'/);
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
    assert.match(dockerRuntimeInfoJs, /const hostUpdated = manager === 'dockerman' && !isHostUpdateSyncSuspended\(\)[\s\S]*readDockerHostRowUpdatedState\(safeName\)/);
    assert.match(dockerRuntimeInfoJs, /const resolvedUpdated = typeof sourceUpdated === 'boolean'[\s\S]*typeof hostUpdated === 'boolean'/);
    assert.match(dockerRuntimeInfoJs, /Updated:\s*resolvedUpdated/);
});

test('docker runtime prefers visible host up-to-date state over stale cached update flags', () => {
    const previousHTMLElement = globalThis.HTMLElement;
    class FakeElement {
        constructor(textContent = '') {
            this.textContent = textContent;
        }
        querySelector() {
            return null;
        }
    }
    class FakeCell extends FakeElement {}
    class FakeRow extends FakeElement {
        constructor(cell) {
            super('');
            this.cell = cell;
        }
        querySelector(selector) {
            return selector === 'td.updatecolumn' ? this.cell : null;
        }
    }
    globalThis.HTMLElement = FakeElement;
    try {
        const api = dockerRuntimeInfoModule.createApi({
            window: {},
            document: {
                getElementById: (id) => {
                    assert.equal(id, 'ct-qbittorrentvpn');
                    return new FakeRow(new FakeCell('up-to-date'));
                }
            },
            $: { i18n: (_key) => '' },
            isHostUpdateSyncSuspended: () => false
        });
        const normalized = api.normalizeDockerRuntimeInfoMap({
            qbittorrentvpn: {
                manager: 'dockerman',
                running: true,
                paused: false
            }
        }, {
            qbittorrentvpn: {
                info: {
                    Name: 'qbittorrentvpn',
                    State: {
                        Updated: false,
                        manager: 'dockerman'
                    },
                    Config: {}
                },
                Labels: {}
            }
        });
        assert.equal(normalized.qbittorrentvpn.info.State.Updated, true);
    } finally {
        if (previousHTMLElement) {
            globalThis.HTMLElement = previousHTMLElement;
        } else {
            delete globalThis.HTMLElement;
        }
    }
});

test('docker runtime clears stale folder update metadata during post-update reconciliation', () => {
    const api = dockerRuntimeInfoModule.createApi({
        window: {},
        isHostUpdateSyncSuspended: () => true
    });
    const previous = {
        info: {
            Name: 'nextcloud',
            State: {
                Updated: false,
                manager: 'dockerman'
            },
            Config: {}
        },
        Labels: {}
    };
    const normalized = api.normalizeDockerRuntimeInfoMap({
        nextcloud: {
            manager: 'dockerman',
            running: true,
            paused: false
        }
    }, {
        nextcloud: previous
    });
    assert.equal(normalized.nextcloud.info.State.Updated, null);

    const runtimeApi = dockerRuntimeInfoModule.createApi({
        window: {},
        getDockerRuntimeInfoMap: () => normalized,
        isHostUpdateSyncSuspended: () => true
    });
    const entry = runtimeApi.buildRuntimeContainerEntry('nextcloud', {
        update: true,
        manager: 'dockerman'
    });
    assert.equal(entry.update, false);
});

test('docker runtime observes native update-column mutations and reuses them for folder cache sync', () => {
    assert.match(dockerRuntimeInfoJs, /let dockerHostUpdateCellObserver = null;/);
    assert.match(dockerRuntimeInfoJs, /const isHostUpdateSyncSuspended = typeof deps\.isHostUpdateSyncSuspended === 'function'/);
    assert.match(dockerRuntimeInfoJs, /const syncDockerHostRowUpdateStatesFromDom = \(names = \[\]\) => \{/);
    assert.match(dockerRuntimeInfoJs, /if \(isHostUpdateSyncSuspended\(\)\) \{\s*return false;\s*\}/);
    assert.match(dockerRuntimeInfoJs, /const queueDockerHostRowUpdateStateSync = \(names = \[\]\) => \{/);
    assert.match(dockerRuntimeInfoJs, /if \(syncDockerHostRowUpdateStatesFromDom\(pendingNames\)\) \{\s*syncDockerVisibleFoldersFromRuntimeCache\(pendingNames\);\s*\}/);
    assert.match(dockerRuntimeInfoJs, /const ensureDockerHostRowUpdateObserver = \(\) => \{[\s\S]*dockerHostUpdateCellObserver = new MutationObserver/);
    assert.match(dockerJs, /const DOCKER_HOST_UPDATE_SYNC_SUSPENDED_UNTIL_KEY = '__fvplusDockerHostUpdateSyncSuspendedUntil';/);
    assert.match(dockerJs, /const DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY = dockerRuntimeDiagnosticsModule\?\.DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY \|\| 'fv\.support\.bundle\.docker\.page\.v1';/);
    assert.match(dockerJs, /const dockerHostGuardsModule = window\.FolderViewPlusDockerHostGuards \|\| null;/);
    assert.match(dockerJs, /const dockerRuntimeDiagnosticsModule = window\.FolderViewPlusDockerRuntimeDiagnostics \|\| null;/);
    assert.match(dockerJs, /const dockerRuntimeReconcileModule = window\.FolderViewPlusDockerRuntimeReconcile \|\| null;/);
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
    assert.match(dockerJs, /const getDockerRuntimeReconcileApi = \(\) => \{/);
    assert.match(dockerJs, /dockerRuntimeReconcileModule\.createApi\(\{/);
    assert.match(dockerJs, /ensureDockerHostRowUpdateObserver\(\);\s*if \(!isDockerHostUpdateSyncSuspended\(\) && syncDockerHostRowUpdateStatesFromDom\(\)\) \{\s*containersInfo = \{ \.\.\.dockerRuntimeInfoByName \};\s*\}/);
    assert.match(dockerJs, /const buildDockerRuntimeInfoUrl = \(mode = 'full', cacheBust = Date\.now\(\), options = \{\}\) =>/);
    assert.match(dockerJs, /const liveUpdateQuery = mode === 'state' && options\?\.liveUpdateStatus === true/);
    assert.match(dockerJs, /const dockerApiCoordinatorModule = window\.FolderViewPlusFoundationModules\?\.dockerApiCoordinator \|\| null;/);
    assert.match(dockerJs, /const getDockerApiIntegration = \(\) => \{[\s\S]*dockerApiCoordinatorModule\.createIntegration\(\{/);
    assert.match(dockerJs, /const refreshDockerRuntimeStateInPlace = async \(options = \{\}\) => \{[\s\S]*getDockerApiIntegration\(\)\?\.refresh\?\.\(options\)[\s\S]*refreshDockerRuntimeStateFromPhp\(\{ \.\.\.options, apiFirst: false \}\)/);
    assert.match(dockerJs, /const bindDockerPostUpdateRenderReconcile = \(\) => \{[\s\S]*getDockerRuntimeReconcileApi\(\)\?\.bindPostUpdateRenderReconcile\?\.\(\);/);
    assert.match(dockerJs, /function bindDockerHostOpenDockerPatch\(\) \{[\s\S]*getDockerRuntimeReconcileApi\(\)\?\.bindHostOpenDockerPatch\?\.\(\);/);
    assert.match(dockerJs, /const armDockerPostUpdateRuntimeReconcileWindow = \(durationMs = 0,\s*options = \{\}\) => \{[\s\S]*getDockerRuntimeReconcileApi\(\)\?\.armPostUpdateRuntimeReconcileWindow\?\.\(durationMs,\s*options\) \|\| 0;/);
    assert.match(dockerJs, /const bindDockerUpdateActionClickCapture = \(\) => \{[\s\S]*getDockerRuntimeReconcileApi\(\)\?\.bindUpdateActionClickCapture\?\.\(\);/);
    assert.doesNotMatch(dockerJs, /queueDockerSupportBundlePageSnapshot\('render-complete', 260\);\s*queueDockerPostUpdateRuntimeReconcile\(\);/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker request bundle primed'\);\s*bindDockerHostOpenDockerPatch\(\);\s*bindDockerLifecycleEventControlPatch\(\);\s*bindDockerContainerContextStatePatch\(\);\s*bindDockerUpdateActionClickCapture\(\);\s*bindDockerPostUpdateRenderReconcile\(\);\s*startDockerListViewModeObserver\(\);/);
    assert.match(dockerJs, /if \(!loadedFolder\) \{[\s\S]*queueDockerRuntimeRenderForPageViewMode\(\);/);
    assert.match(dockerJs, /wrapHostHook\?\.\('loadlist',[\s\S]*bindDockerHostOpenDockerPatch\(\);[\s\S]*folderReq = ensureDockerFolderReqForHostRender\(\);/);
    assert.match(dockerJs, /const collectDockerSupportBundlePageSnapshot = \(reason = 'runtime-sync'\) => \{[\s\S]*diagnosticsApi\.collectPageSnapshot\(reason\)/);
    assert.match(dockerJs, /const buildDockerDiagnosticsCorrelationContext = \(\) => \(\{/);
    assert.match(dockerJs, /hookStates:\s*getDockerHostGuardsApi\(\)\?\.getHookStates\?\.\(\) \|\| \{\}/);
});

test('docker post-update reconcile uses finite incremental polls that preserve the grouped DOM', () => {
    assert.match(dockerRuntimeReconcileJs, /let dockerPostUpdateRuntimePollTimer = null;/);
    assert.match(dockerRuntimeReconcileJs, /let dockerPostUpdateRuntimePollRemaining = 0;/);
    assert.match(dockerRuntimeReconcileJs, /const schedulePostUpdateRuntimePoll = \(reason = 'post-update-runtime-poll'/);
    assert.match(dockerRuntimeReconcileJs, /refreshDockerRuntimeStateInPlace\(\{\s*liveUpdateStatus: true,\s*preserveGroupedDom: true\s*\}\)/);
    assert.match(dockerRuntimeReconcileJs, /appendDockerBulkUpdateTrace\('postUpdateRuntimePoll'/);
    assert.match(dockerRuntimeReconcileJs, /appendDockerBulkUpdateTrace\('postUpdateRuntimePollResult'/);
    assert.match(dockerRuntimeReconcileJs, /describeInvocation:\s*\(args\) => \{/);
    assert.match(dockerRuntimeReconcileJs, /commandType:\s*isUpdate \? 'update_container' : 'other'/);
    assert.match(dockerRuntimeReconcileJs, /containerNames:\s*names\.slice\(0, 10\)/);
    assert.doesNotMatch(dockerRuntimeReconcileJs, /note:\s*String\(args\?\.\[0\]/);
    assert.match(dockerRuntimeReconcileJs, /strategy:\s*'event-driven-incremental-with-finite-backstops'/);
    assert.match(dockerRuntimeReconcileJs, /schedulePostUpdateRuntimePoll\('reconcile-window-armed', initialDelayMs\);/);
    assert.doesNotMatch(dockerRuntimeReconcileJs, /if \(isDockerHostUpdateSyncSuspended\(\)\) \{\s*schedulePostUpdateRuntimePoll\('post-update-runtime-poll'/);
});

test('docker update dialog callbacks replace host loadlist redraws with a bounded incremental refresh', async () => {
    let nextTimerId = 1;
    const timers = new Map();
    let forwardedArgs = null;
    const refreshCalls = [];
    const suspendCalls = [];
    const win = {
        location: { pathname: '/Docker' },
        openDocker: (...args) => {
            forwardedArgs = args;
            return 'opened';
        },
        setTimeout: (handler, delayMs) => {
            const id = nextTimerId++;
            timers.set(id, { handler, delayMs });
            return id;
        },
        clearTimeout: (id) => timers.delete(id)
    };
    const hostAdapter = runtimeHostAdaptersModule.createHostAdapter('docker', {
        window: win,
        document: {}
    });
    const hostGuards = {
        wrapHostHook: (name, handler, options = {}) => hostAdapter.wrapHook(name, handler, options)
    };
    const api = dockerRuntimeReconcileModule.createApi({
        window: win,
        document: {},
        isDockerHostUpdateCommand: (command) => /^update_container(?:\s|$)/i.test(String(command || '')),
        suspendDockerHostUpdateSync: (durationMs) => {
            suspendCalls.push(durationMs);
            return Date.now() + durationMs;
        },
        isDockerHostUpdateSyncSuspended: () => true,
        refreshDockerRuntimeStateInPlace: async (options) => {
            refreshCalls.push(options);
            return true;
        },
        getDockerHostGuardsApi: () => hostGuards,
        initialDelayMs: 10,
        pollDelayMs: 20
    });

    api.bindHostOpenDockerPatch();
    assert.equal(win.openDocker('update_container app-one*app-two', 'Update all', '', 'loadlist'), 'opened');
    assert.equal(forwardedArgs[3], dockerRuntimeReconcileModule.DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME);
    assert.notEqual(forwardedArgs[3], 'loadlist');

    win[forwardedArgs[3]]();
    assert.ok(suspendCalls.includes(dockerRuntimeReconcileModule.POST_UPDATE_CALLBACK_WINDOW_MS));
    for (let iteration = 0; iteration < 4 && timers.size > 0; iteration += 1) {
        const [id, timer] = timers.entries().next().value;
        timers.delete(id);
        timer.handler();
        await new Promise((resolve) => setImmediate(resolve));
    }

    assert.equal(refreshCalls.length, 2, 'one callback refresh plus one finite tail poll should run');
    assert.deepEqual(refreshCalls, [
        { liveUpdateStatus: true, preserveGroupedDom: true },
        { liveUpdateStatus: true, preserveGroupedDom: true }
    ]);
    assert.equal(timers.size, 0, 'the reconciliation loop must terminate without waiting for a page refresh');
});

test('docker support bundle snapshot reads only visible update-column text in basic view', () => {
    assert.match(dockerJs, /const collectDockerSupportBundlePageSnapshot = \(reason = 'runtime-sync'\) => \{[\s\S]*diagnosticsApi\.collectPageSnapshot\(reason\)/);
    assert.doesNotMatch(dockerJs, /const updateCellText = normalizeDockerSupportBundleText\(\$row\.find\('td\.updatecolumn'\)\.first\(\)\.text\(\)\);/);
});

test('docker runtime can stay in host-list mode without rendering FolderView rows', () => {
    assert.match(dockerJs, /const normalizeDockerPageViewMode = \(value\) =>/);
    assert.match(dockerJs, /const resolveDockerPageViewMode = \(prefs = folderTypePrefs\) =>/);
    assert.match(dockerJs, /const ensureDockerBootstrapPrefs = \(options = \{\}\) => \{/);
    assert.match(dockerJs, /const ensureDockerFolderReqForHostRender = \(options = \{\}\) => \{[\s\S]*const hasReusableBundle = folderReq[\s\S]*if \(options\?\.forceRefresh === true \|\| !hasReusableBundle\) \{[\s\S]*folderReq = buildDockerFolderReq/);
    assert.match(dockerJs, /const queueDockerRuntimeRenderForPageViewMode = \(options = \{\}\) => \{[\s\S]*ensureDockerFolderReqForHostRender\([\s\S]*resolveDockerBootstrapPrefsFromRequestBundle\(requestBundle\)[\s\S]*const mode = resolveDockerPageViewMode\(prefs\);[\s\S]*mode === 'host'[\s\S]*mode === 'command'[\s\S]*queueCreateFoldersRender\(\);/);
    assert.doesNotMatch(dockerJs, /rebuildDockerFolderReqForHostRender/);
    assert.match(dockerJs, /document\.body\.setAttribute\('data-fvplus-docker-page-view', resolveDockerPageViewMode\(normalized\)\);/);
    assert.match(dockerJs, /syncDockerAddFolderButtonVisibility\(resolveDockerPageViewMode\(normalized\)\);/);
    assert.match(dockerJs, /wrapHostHook\?\.\('listview',[\s\S]*queueDockerRuntimeRenderForPageViewMode\(\);/);
});

test('deferred docker runtime hydration refreshes visible folder state in place instead of reloading the page', () => {
    assert.match(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoSource = null\) => \{[\s\S]*?dockerRuntimeInfoByName = normalizeDockerRuntimeInfoMap\(parsed,\s*dockerRuntimeInfoByName\);[\s\S]*?markDockerFatalBannerStep\('Docker runtime details hydrated'\);[\s\S]*?recordDockerFatalBannerAction\('Docker runtime details hydrated'\);[\s\S]*?syncDockerVisibleFoldersFromRuntimeCache\(\);[\s\S]*?\}\)\s*\.catch\(\(\) => \{\}\);/);
    assert.doesNotMatch(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoSource = null\) => \{[\s\S]*?const previousWebuiSignature/);
    assert.doesNotMatch(dockerJs, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoSource = null\) => \{[\s\S]*?const nextWebuiSignature/);
});

test('docker bootstrap render preserves prior runtime update flags when partial state payloads omit Updated', () => {
    assert.match(
        dockerJs,
        /const containersStateInfo = parseJsonPayloadSafe\(prom\[2\]\);\s*let containersInfo = normalizeDockerRuntimeInfoMap\(containersStateInfo,\s*dockerRuntimeInfoByName\);/
    );
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
    assert.match(dockerJs, /const syncDockerFolderMemberRows = \(id,\s*runtimeContainers,\s*changedNames = null\) => \{[\s\S]*previewActionsApi\.syncDockerFolderMemberRows\(id,\s*runtimeContainers,\s*changedNames\);/s);
    assert.match(dockerJs, /folder\.runtimeContainers = runtimeContainers;\s*syncDockerFolderMemberRows\(id,\s*runtimeContainers,\s*changedSet\);/s);
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
    assert.match(dockerJs, /wrapHostHook\?\.\('loadlist',[\s\S]*bindDockerHostOpenDockerPatch\(\);[\s\S]*bindDockerLifecycleEventControlPatch\(\);[\s\S]*bindDockerListViewModeCookieHook\(\);/);
    assert.match(dockerJs, /markDockerFatalBannerStep\('Docker request bundle primed'\);\s*bindDockerHostOpenDockerPatch\(\);\s*bindDockerLifecycleEventControlPatch\(\);\s*bindDockerContainerContextStatePatch\(\);\s*bindDockerUpdateActionClickCapture\(\);\s*bindDockerPostUpdateRenderReconcile\(\);\s*startDockerListViewModeObserver\(\);/);
});

test('docker folder expand path re-syncs direct member rows from runtime state after moving them out of storage', () => {
    assert.match(dockerJs, /syncDockerFolderMemberRows: \(id,\s*runtimeContainers\) => syncDockerFolderMemberRows\(id,\s*runtimeContainers\),/);
    assert.match(dockerRuntimeHierarchyJs, /const syncDockerFolderMemberRows = typeof deps\.syncDockerFolderMemberRows === 'function'[\s\S]*:\s*\(\(\) => \{\}\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$directMemberRows = getDirectMemberRowsForFolder\(id\);[\s\S]*const directRuntimeContainers = buildRuntimeContainerMapForFolder\(id,\s*false\);[\s\S]*\$folderRow\.after\(\$directMemberRows\);[\s\S]*syncDockerFolderMemberRows\(id,\s*directRuntimeContainers\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$rowsToShow = \$directMemberRows\.length \? \$directMemberRows : \$fallbackRows;[\s\S]*const directRuntimeContainers = buildRuntimeContainerMapForFolder\(id,\s*false\);[\s\S]*jq\(`tr\.folder-id-\$\{id\}`\)\.after\(\$rowsToShow\);[\s\S]*syncDockerFolderMemberRows\(id,\s*directRuntimeContainers\);/);
});
