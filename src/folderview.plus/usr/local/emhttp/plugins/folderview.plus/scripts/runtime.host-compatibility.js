// @ts-check
(function runtimeHostCompatibilityModule(root, factory) {
    const fallbackWindow = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusHostCompatibility = factory(fallbackWindow);
    root.FolderViewPlusHostCompatibilityModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function runtimeHostCompatibilityFactory(fallbackWindow) {
    'use strict';

    const DOCKER_COMPATIBILITY_STORAGE_KEY = 'fv.support.bundle.docker.compatibility.v1';
    const HOST_GENERATIONS = Object.freeze({
        LEGACY_DOCKER_TABLE: 'legacy-docker-table',
        NATIVE_DOCKER_VUE: 'native-docker-vue',
        UNKNOWN_DOCKER_HOST: 'unknown-docker-host'
    });
    const NATIVE_DOCKER_SELECTORS = Object.freeze([
        'unraid-docker-container-overview',
        '.unapi unraid-docker-container-overview',
        '[data-unraid-docker-container-overview]'
    ]);
    const LEGACY_DOCKER_SELECTORS = Object.freeze({
        table: 'table#docker_containers',
        listBody: 'tbody#docker_list',
        viewBody: 'tbody#docker_view',
        header: '#docker_containers > thead > tr'
    });
    const LEGACY_DOCKER_HOOKS = Object.freeze([
        'loadlist',
        'listview',
        'openDocker',
        'eventControl',
        'addDockerContainerContext'
    ]);

    const clone = (value) => {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return null;
        }
    };
    const hasSelector = (doc, selector) => Boolean(
        doc
        && typeof doc.querySelector === 'function'
        && doc.querySelector(selector)
    );
    const readStoredSnapshot = (win = fallbackWindow) => {
        try {
            const value = JSON.parse(String(win?.localStorage?.getItem(DOCKER_COMPATIBILITY_STORAGE_KEY) || 'null'));
            return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
        } catch (_error) {
            return null;
        }
    };
    const writeStoredSnapshot = (snapshot, win = fallbackWindow) => {
        try {
            win?.localStorage?.setItem(DOCKER_COMPATIBILITY_STORAGE_KEY, JSON.stringify(snapshot));
            return true;
        } catch (_error) {
            return false;
        }
    };

    const detectDockerHost = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        const nativeDockerComponent = NATIVE_DOCKER_SELECTORS.some((selector) => hasSelector(doc, selector));
        const classicDockerTable = hasSelector(doc, LEGACY_DOCKER_SELECTORS.table);
        const classicDockerListBody = hasSelector(doc, LEGACY_DOCKER_SELECTORS.listBody);
        const classicDockerViewBody = hasSelector(doc, LEGACY_DOCKER_SELECTORS.viewBody);
        const classicDockerHeader = hasSelector(doc, LEGACY_DOCKER_SELECTORS.header);
        const classicRequiredComplete = classicDockerTable
            && classicDockerListBody
            && classicDockerHeader;
        const hookAvailability = Object.fromEntries(
            LEGACY_DOCKER_HOOKS.map((name) => [name, typeof win?.[name] === 'function'])
        );
        const hostGeneration = nativeDockerComponent
            ? HOST_GENERATIONS.NATIVE_DOCKER_VUE
            : (classicRequiredComplete
                ? HOST_GENERATIONS.LEGACY_DOCKER_TABLE
                : HOST_GENERATIONS.UNKNOWN_DOCKER_HOST);
        const reason = hostGeneration === HOST_GENERATIONS.NATIVE_DOCKER_VUE
            ? 'native-component-present'
            : (hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE
                ? 'classic-contract-complete'
                : 'no-supported-docker-page-contract');
        return Object.freeze({
            schemaVersion: 1,
            detectedAt: new Date().toISOString(),
            hostGeneration,
            reason,
            pageShape: Object.freeze({
                nativeDockerComponent,
                classicDockerTable,
                classicDockerListBody,
                classicDockerViewBody,
                classicDockerHeader,
                classicRequiredComplete
            }),
            hookAvailability: Object.freeze(hookAvailability),
            runtimeActivationAllowed: hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE,
            compatibilityMode: hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE
                ? 'legacy-enhancement'
                : (hostGeneration === HOST_GENERATIONS.NATIVE_DOCKER_VUE
                    ? 'native-coexistence'
                    : 'safe-unknown'),
            ownership: Object.freeze({
                dockerPage: hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE
                    ? 'folderview-plus-enhanced-legacy-host'
                    : (hostGeneration === HOST_GENERATIONS.NATIVE_DOCKER_VUE ? 'unraid-native' : 'unknown'),
                folderOverlayAllowed: hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE,
                nativeOrganizerMutationAllowed: false,
                nativeOrganizerDirectFileWriteAllowed: false
            })
        });
    };

    const createController = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        let snapshot = null;

        const publish = (nextSnapshot) => {
            snapshot = Object.freeze(clone(nextSnapshot) || {});
            writeStoredSnapshot(snapshot, win);
            if (typeof win?.dispatchEvent === 'function' && typeof win?.CustomEvent === 'function') {
                win.dispatchEvent(new win.CustomEvent('folderviewplus:docker-host-compatibility', {
                    detail: clone(snapshot)
                }));
            }
            return snapshot;
        };
        const evaluateDockerRuntime = (options = {}) => {
            const detection = detectDockerHost({ window: win, document: doc });
            return publish({
                ...detection,
                pluginVersion: String(
                    options.pluginVersion
                    || win?.FolderViewPlusFatalRuntimeContext?.pluginVersion
                    || 'unknown'
                ).trim() || 'unknown',
                provider: {
                    selected: detection.hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE
                        ? 'hybrid-legacy-graphql'
                        : (detection.hostGeneration === HOST_GENERATIONS.NATIVE_DOCKER_VUE
                            ? 'unraid-graphql-pending'
                            : 'unsupported-unknown'),
                    state: detection.hostGeneration === HOST_GENERATIONS.LEGACY_DOCKER_TABLE
                        ? 'ready'
                        : 'pending',
                    fallback: detection.hostGeneration === HOST_GENERATIONS.UNKNOWN_DOCKER_HOST
                        ? 'leave-host-ui-untouched'
                        : 'none'
                },
                graphql: {
                    endpointAvailable: false,
                    apiVersion: 'unknown',
                    unraidVersion: String(
                        win?.FolderViewPlusFatalRuntimeContext?.unraidVersion || 'unknown'
                    ).trim() || 'unknown',
                    queryContainers: false,
                    queryShape: 'unknown',
                    queryCapabilities: {
                        targetedContainer: false,
                        networks: false,
                        portConflicts: false,
                        logs: false,
                        updateStatuses: false
                    },
                    mutations: {
                        start: false,
                        stop: false,
                        restart: false,
                        pause: false,
                        unpause: false,
                        removeContainer: false,
                        updateContainer: false,
                        updateContainers: false,
                        updateAllContainers: false,
                        updateAutostartConfiguration: false,
                        refreshDockerDigests: false
                    },
                    subscriptions: {
                        dockerContainerStats: false
                    },
                    organizer: {
                        query: false,
                        mutation: false,
                        policy: 'detect-only'
                    }
                }
            });
        };
        const updateProviderEvidence = (evidence = {}) => {
            const base = snapshot || readStoredSnapshot(win) || evaluateDockerRuntime();
            return publish({
                ...base,
                capturedAt: new Date().toISOString(),
                provider: {
                    ...(base.provider || {}),
                    ...(evidence.provider || {})
                },
                graphql: {
                    ...(base.graphql || {}),
                    ...(evidence.graphql || {}),
                    mutations: {
                        ...(base.graphql?.mutations || {}),
                        ...(evidence.graphql?.mutations || {})
                    },
                    subscriptions: {
                        ...(base.graphql?.subscriptions || {}),
                        ...(evidence.graphql?.subscriptions || {})
                    },
                    organizer: {
                        ...(base.graphql?.organizer || {}),
                        ...(evidence.graphql?.organizer || {})
                    },
                    queryCapabilities: {
                        ...(base.graphql?.queryCapabilities || {}),
                        ...(evidence.graphql?.queryCapabilities || {})
                    }
                }
            });
        };

        return Object.freeze({
            evaluateDockerRuntime,
            updateProviderEvidence,
            getSnapshot: () => clone(snapshot || readStoredSnapshot(win)),
            isLegacyDockerRuntimeAllowed: () => (
                (snapshot || evaluateDockerRuntime()).runtimeActivationAllowed === true
            )
        });
    };

    let defaultController = null;
    const getDefaultController = (deps = {}) => {
        if (!defaultController) defaultController = createController(deps);
        return defaultController;
    };
    const resetDefaultControllerForTests = () => {
        defaultController = null;
    };

    return Object.freeze({
        DOCKER_COMPATIBILITY_STORAGE_KEY,
        HOST_GENERATIONS,
        NATIVE_DOCKER_SELECTORS,
        LEGACY_DOCKER_SELECTORS,
        LEGACY_DOCKER_HOOKS,
        detectDockerHost,
        createController,
        getDefaultController,
        readStoredSnapshot,
        resetDefaultControllerForTests
    });
}));
