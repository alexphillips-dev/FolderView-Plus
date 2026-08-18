// @ts-check
(function dockerRuntimeProvidersModule(root, factory) {
    const fallbackWindow = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            fallbackWindow,
            require('./docker.runtime.container-model.js'),
            require('./docker.runtime.capabilities.js')
        );
        return;
    }
    root.FolderViewPlusDockerProviders = factory(
        fallbackWindow,
        root.FolderViewPlusDockerContainerModel,
        root.FolderViewPlusFoundationModules?.dockerRuntimeCapabilities
    );
    root.FolderViewPlusDockerProvidersModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeProvidersFactory(
    fallbackWindow,
    containerModel,
    capabilityTools
    ) {
    'use strict';
    const translate = (key, fallback, ...params) => fallbackWindow?.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback || key;
    const PROVIDER_IDS = Object.freeze({
        LEGACY_WEBGUI: 'legacy-webgui',
        HYBRID_LEGACY_GRAPHQL: 'hybrid-legacy-graphql',
        UNRAID_GRAPHQL: 'unraid-graphql',
        UNSUPPORTED_UNKNOWN: 'unsupported-unknown'
    });
    const BASE_CONTAINER_FIELDS = Object.freeze(['id', 'names', 'state', 'status', 'autoStart']);
    const OPTIONAL_CONTAINER_SCALAR_FIELDS = Object.freeze([
        'image',
        'imageId',
        'command',
        'created',
        'lanIpPorts',
        'sizeRootFs',
        'sizeRw',
        'sizeLog',
        'labels',
        'networkSettings',
        'mounts',
        'autoStartOrder',
        'autoStartWait',
        'templatePath',
        'projectUrl',
        'registryUrl',
        'supportUrl',
        'iconUrl',
        'webUiUrl',
        'shell',
        'isOrphaned',
        'isUpdateAvailable',
        'isRebuildReady',
        'tailscaleEnabled'
    ]);
    const buildContainerSelection = (capabilities = {}) => {
        const available = capabilities?.containerFields || {};
        const scalarFields = OPTIONAL_CONTAINER_SCALAR_FIELDS.filter((field) => available[field] === true);
        const objectFields = [];
        if (available.ports === true) objectFields.push('ports { ip privatePort publicPort type }');
        if (available.templatePorts === true) {
            objectFields.push('templatePorts { ip privatePort publicPort type }');
        }
        if (available.hostConfig === true) objectFields.push('hostConfig { networkMode }');
        return [...BASE_CONTAINER_FIELDS, ...scalarFields, ...objectFields].join('\n');
    };
    const buildCurrentContainersQuery = (capabilities = {}) => `
        query FVPlusDockerContainers {
            docker {
                containers {
                    ${buildContainerSelection(capabilities)}
                }
            }
        }
    `;
    const buildCurrentContainerQuery = (capabilities = {}) => `
        query FVPlusDockerContainer($id: PrefixedID!) {
            docker {
                container(id: $id) {
                    ${buildContainerSelection(capabilities)}
                }
            }
        }
    `;
    const CURRENT_CONTAINERS_QUERY = buildCurrentContainersQuery({});
    const LEGACY_CONTAINERS_QUERY = `
        query FVPlusLegacyDockerContainers {
            dockerContainers { id names state status autoStart }
        }
    `;
    const DOCKER_STATS_SUBSCRIPTION = `
        subscription FVPlusDockerContainerStats {
            dockerContainerStats { id cpuPercent memUsage memPercent netIO blockIO }
        }
    `;
    const DOCKER_PORT_CONFLICTS_QUERY = `
        query FVPlusDockerPortConflicts {
            docker {
                portConflicts {
                    containerPorts {
                        privatePort
                        type
                        containers { id name }
                    }
                    lanPorts {
                        lanIpPort
                        publicPort
                        type
                        containers { id name }
                    }
                }
            }
        }
    `;
    const DOCKER_LOGS_QUERY = `
        query FVPlusDockerLogs($id: PrefixedID!, $since: DateTime, $tail: Int) {
            docker {
                logs(id: $id, since: $since, tail: $tail) {
                    containerId
                    lines { timestamp message }
                    cursor
                }
            }
        }
    `;

    const clone = (value) => {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return null;
        }
    };
    const normalizeContainer = (entry = {}, options = {}) => (
        containerModel?.normalizeContainer?.(entry, options)
        || Object.freeze({
            id: String(entry.id || '').trim(),
            names: Object.freeze(Array.isArray(entry.names) ? entry.names.slice() : []),
            name: String(entry.name || entry.names?.[0] || '').replace(/^\/+/, ''),
            state: String(entry.state || '').trim().toLowerCase(),
            status: String(entry.status || '').trim(),
            autoStart: entry.autoStart === true
        })
    );
    const resolveContainerIdentity = (value, containers = []) => (
        containerModel?.resolveContainerIdentity?.(value, containers) || null
    );
    const unsupportedError = (message, category = 'provider-unavailable') => {
        const error = new Error(String(message || 'Docker provider capability is unavailable.'));
        error.name = 'DockerProviderError';
        error.category = category;
        return error;
    };
    const freezeProvider = (provider) => Object.freeze({
        ...provider,
        capabilities: Object.freeze({ ...(provider.capabilities || {}) }),
        identity: Object.freeze({ ...(provider.identity || {}) }),
        health: Object.freeze({ ...(provider.health || {}) }),
        mutations: Object.freeze({ ...(provider.mutations || {}) }),
        logs: Object.freeze({ ...(provider.logs || {}) }),
        organization: Object.freeze({ ...(provider.organization || {}) }),
        uiSurface: Object.freeze({ ...(provider.uiSurface || {}) })
    });

    const createLegacyWebguiProvider = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        const transport = deps.transport || win?.FolderViewPlusRuntimeTransport || null;
        const activeSubscriptions = new Set();
        const hostAdapter = deps.hostAdapter || win?.FolderViewPlusRuntimeHostAdapters?.getOrCreate?.('docker', {
            window: win,
            document: doc
        }) || null;
        const listContainers = async () => {
            if (typeof deps.listLegacyContainers === 'function') {
                return (await deps.listLegacyContainers()).map((entry) => normalizeContainer(entry, {
                    source: 'legacy-runtime'
                }));
            }
            return (hostAdapter?.queryRows?.('item') || []).map((row) => normalizeContainer({
                id: String(row?.id || '').replace(/^ct-/, ''),
                names: [hostAdapter.getRowIdentity(row)],
                state: row?.dataset?.fvRuntimeState || row?.dataset?.state || '',
                status: row?.querySelector?.('.state')?.textContent || ''
            }, { source: 'legacy-dom' }));
        };
        const executeAction = (request = {}, options = {}) => {
            if (!transport?.runDockerAction) {
                return Promise.reject(unsupportedError('The legacy Docker action bridge is unavailable.'));
            }
            return transport.runDockerAction(request, {
                ...options,
                window: win,
                forceGraphql: false
            });
        };
        const subscribe = (options = {}) => {
            if (!transport?.subscribe) return () => {};
            const close = transport.subscribe({
                ...options,
                window: win,
                poll: options.poll || listContainers
            });
            const disposeSubscription = () => {
                activeSubscriptions.delete(disposeSubscription);
                close();
            };
            activeSubscriptions.add(disposeSubscription);
            return disposeSubscription;
        };
        return freezeProvider({
            id: PROVIDER_IDS.LEGACY_WEBGUI,
            label: 'Legacy Unraid WebGUI',
            capabilities: {
                listContainers: true,
                containerStatus: true,
                subscribe: true,
                subscribeStats: false,
                executeActions: typeof win?.eventControl === 'function',
                identityResolution: true,
                targetedReconciliation: false,
                richMetadata: false,
                portConflicts: false,
                boundedLogs: false,
                updateMutations: false,
                autostartMutation: false,
                organizationRead: typeof deps.readOrganization === 'function',
                organizationWrite: typeof deps.writeOrganization === 'function',
                uiSurface: true
            },
            listContainers,
            getContainer: async (identity) => resolveContainerIdentity(identity, await listContainers()),
            subscribe,
            subscribeStats: (options = {}) => {
                options.onStatus?.({ status: 'unavailable', transport: 'legacy-host' });
                return () => {};
            },
            executeAction,
            identity: {
                resolve: resolveContainerIdentity
            },
            health: {
                getSummary: async () => {
                    const containers = await listContainers();
                    return Object.freeze({
                        checkedAt: new Date().toISOString(),
                        source: 'legacy',
                        containerCount: containers.length,
                        updateAvailableCount: 0,
                        rebuildReadyCount: 0,
                        orphanedCount: 0,
                        containerPortConflictCount: 0,
                        lanPortConflictCount: 0,
                        affectedContainerCount: 0,
                        detailsAvailable: false
                    });
                }
            },
            mutations: {},
            logs: {
                tail: () => Promise.reject(unsupportedError(
                    'Bounded Docker logs are unavailable through the legacy provider.',
                    'capability-unavailable'
                ))
            },
            organization: {
                authority: 'folderview-plus',
                read: typeof deps.readOrganization === 'function'
                    ? deps.readOrganization
                    : () => Promise.reject(unsupportedError('Folder organization reader was not supplied.')),
                write: typeof deps.writeOrganization === 'function'
                    ? deps.writeOrganization
                    : () => Promise.reject(unsupportedError('Folder organization writer was not supplied.'))
            },
            uiSurface: {
                owner: 'legacy-unraid-webgui',
                folderOverlayAllowed: true,
                nativeOrganizerMutationAllowed: false
            },
            getDiagnostics: () => ({
                provider: PROVIDER_IDS.LEGACY_WEBGUI,
                state: typeof win?.eventControl === 'function' ? 'ready' : 'degraded',
                fallback: typeof win?.eventControl === 'function' ? 'none' : 'actions-unavailable'
            }),
            ...capabilityTools.createAccessors(() => capabilityTools.emptySnapshot('legacy'), () => false),
            dispose: () => {
                Array.from(activeSubscriptions).forEach((close) => close());
                activeSubscriptions.clear();
            }
        });
    };

    const createGraphqlProvider = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const transport = deps.transport || win?.FolderViewPlusRuntimeTransport || null;
        const activeSubscriptions = new Set();
        let lastCapabilities = transport?.getCapabilitySnapshot?.() || null;
        let containerCache = [];
        let lastHealthSummary = null;
        let healthSummaryPromise = null;
        const ready = async (options = {}) => {
            if (!transport?.probeCapabilities) {
                throw unsupportedError('The Unraid GraphQL transport is unavailable.');
            }
            lastCapabilities = await transport.probeCapabilities({
                ...options,
                window: win,
                unraidVersion: win?.FolderViewPlusFatalRuntimeContext?.unraidVersion || 'unknown'
            });
            return clone(lastCapabilities);
        };
        const cacheContainers = (entries) => {
            containerCache = (Array.isArray(entries) ? entries : []).map((entry) => (
                entry?.schemaVersion === 1
                    ? entry
                    : normalizeContainer(entry, { source: 'unraid-graphql' })
            ));
            return containerCache.slice();
        };
        const updateCachedContainer = (entry) => {
            const normalized = entry?.schemaVersion === 1
                ? entry
                : normalizeContainer(entry, { source: 'unraid-graphql' });
            const current = resolveContainerIdentity(normalized.id || normalized.name, containerCache);
            if (current) {
                containerCache = containerCache.map((candidate) => (
                    candidate === current ? normalized : candidate
                ));
            } else {
                containerCache = [...containerCache, normalized];
            }
            return normalized;
        };
        const listContainers = async (options = {}) => {
            const capabilities = await ready(options);
            if (!capabilities?.query?.containers && !capabilities?.query?.dockerContainers) {
                throw unsupportedError(
                    'This Unraid API does not expose a supported Docker container query.',
                    'capability-unavailable'
                );
            }
            const useCurrentShape = capabilities.query.containers === true;
            const data = await transport.query(
                useCurrentShape
                    ? buildCurrentContainersQuery(capabilities)
                    : LEGACY_CONTAINERS_QUERY,
                {},
                {
                    ...options,
                    window: win,
                    operation: 'docker-containers',
                    staleKey: String(options.staleKey || 'docker-provider-containers')
                }
            );
            const entries = useCurrentShape ? data?.docker?.containers : data?.dockerContainers;
            return cacheContainers(entries);
        };
        const resolveIdentity = async (value, options = {}) => {
            let resolved = resolveContainerIdentity(value, containerCache);
            if (!resolved) {
                resolved = resolveContainerIdentity(value, await listContainers(options));
            }
            if (!resolved?.id) {
                throw unsupportedError(
                    'The requested Docker container identity could not be resolved.',
                    'identity-unresolved'
                );
            }
            return resolved;
        };
        const getContainer = async (identity, options = {}) => {
            const capabilities = await ready(options);
            let resolved = resolveContainerIdentity(identity, containerCache);
            if (!resolved) resolved = await resolveIdentity(identity, options);
            if (capabilities.query?.container !== true || !resolved?.id) return resolved;
            const data = await transport.query(
                buildCurrentContainerQuery(capabilities),
                { id: resolved.id },
                {
                    ...options,
                    window: win,
                    operation: 'docker-container',
                    staleKey: String(options.staleKey || `docker-provider-container:${resolved.id}`)
                }
            );
            return data?.docker?.container
                ? updateCachedContainer(data.docker.container)
                : null;
        };
        const reconcileContainer = async (identity, options = {}) => {
            const capabilities = await ready(options);
            if (capabilities.query?.container === true) {
                return getContainer(identity, options);
            }
            const containers = await listContainers(options);
            return resolveContainerIdentity(identity, containers);
        };
        const executeAction = async (request = {}, options = {}) => {
            const resolved = await resolveIdentity(request.containerId || request.container, options);
            const result = await transport.runDockerAction({
                ...request,
                containerId: resolved.id
            }, {
                ...options,
                window: win,
                forceGraphql: true,
                capabilitySnapshot: lastCapabilities
            });
            const requestedAction = String(request.action || '').trim().toLowerCase();
            const actionKey = requestedAction === 'resume' ? 'unpause' : requestedAction;
            const returned = result?.data?.docker?.[actionKey];
            if (returned && typeof returned === 'object') updateCachedContainer(returned);
            else await reconcileContainer(resolved.id, options);
            return result;
        };
        const subscribe = (options = {}) => {
            const close = transport.subscribe({
                ...options,
                window: win,
                poll: options.poll || (() => listContainers(options))
            });
            const disposeSubscription = () => {
                activeSubscriptions.delete(disposeSubscription);
                close();
            };
            activeSubscriptions.add(disposeSubscription);
            return disposeSubscription;
        };
        const subscribeStats = (options = {}) => {
            let close = null;
            let disposed = false;
            let status = 'checking';
            const setStatus = (next) => {
                status = String(next?.status || next || 'unknown');
                options.onStatus?.(
                    typeof next === 'object' ? next : { status, transport: 'none' }
                );
            };
            const disposeSubscription = () => {
                if (disposed) return;
                disposed = true;
                activeSubscriptions.delete(disposeSubscription);
                close?.();
                close = null;
            };
            disposeSubscription.snapshot = () => ({
                status,
                disposed,
                transport: close?.snapshot?.()?.transport || 'none'
            });
            activeSubscriptions.add(disposeSubscription);
            Promise.resolve()
                .then(() => ready(options))
                .then((capabilities) => {
                    if (disposed) return;
                    if (
                        capabilities.subscription?.dockerContainerStats !== true
                        || typeof win?.WebSocket !== 'function'
                    ) {
                        setStatus({ status: 'unavailable', transport: 'none' });
                        return;
                    }
                    close = transport.subscribe({
                        ...options,
                        window: win,
                        autoWebSocket: true,
                        document: DOCKER_STATS_SUBSCRIPTION,
                        poll: undefined,
                        onStatus: setStatus
                    });
                })
                .catch((error) => {
                    if (disposed) return;
                    options.onError?.(error);
                    setStatus({ status: 'failed', transport: 'none' });
                });
            return disposeSubscription;
        };
        const collectHealthSummary = async (options = {}) => {
            const capabilities = await ready(options);
            const containers = await listContainers({
                ...options,
                staleKey: String(options.staleKey || 'docker-provider-health-containers')
            });
            let containerPortConflictCount = 0;
            let lanPortConflictCount = 0;
            const affectedIds = new Set();
            if (capabilities.query?.portConflicts === true) {
                const data = await transport.query(DOCKER_PORT_CONFLICTS_QUERY, {}, {
                    ...options,
                    window: win,
                    operation: 'docker-port-conflicts',
                    staleKey: String(options.conflictStaleKey || 'docker-provider-port-conflicts')
                });
                const conflicts = data?.docker?.portConflicts || {};
                const containerConflicts = Array.isArray(conflicts.containerPorts)
                    ? conflicts.containerPorts
                    : [];
                const lanConflicts = Array.isArray(conflicts.lanPorts) ? conflicts.lanPorts : [];
                containerPortConflictCount = containerConflicts.length;
                lanPortConflictCount = lanConflicts.length;
                [...containerConflicts, ...lanConflicts].forEach((conflict) => {
                    (Array.isArray(conflict?.containers) ? conflict.containers : [])
                        .forEach((entry) => {
                            const id = String(entry?.id || '').trim();
                            if (id) affectedIds.add(id);
                        });
                });
            }
            lastHealthSummary = Object.freeze({
                checkedAt: new Date().toISOString(),
                source: 'unraid-graphql',
                containerCount: containers.length,
                updateAvailableCount: containers.filter((entry) => entry.isUpdateAvailable === true).length,
                rebuildReadyCount: containers.filter((entry) => entry.isRebuildReady === true).length,
                orphanedCount: containers.filter((entry) => entry.isOrphaned === true).length,
                containerPortConflictCount,
                lanPortConflictCount,
                affectedContainerCount: affectedIds.size,
                detailsAvailable: true
            });
            return lastHealthSummary;
        };
        const getHealthSummary = (options = {}) => {
            const checkedAt = Date.parse(String(lastHealthSummary?.checkedAt || '')) || 0;
            if (
                options.force !== true
                && lastHealthSummary
                && Date.now() - checkedAt < 60000
            ) {
                return Promise.resolve(lastHealthSummary);
            }
            if (healthSummaryPromise) return healthSummaryPromise;
            healthSummaryPromise = collectHealthSummary(options).finally(() => {
                healthSummaryPromise = null;
            });
            return healthSummaryPromise;
        };
        const runMutation = async (operation, request = {}, options = {}) => {
            const capabilities = await ready(options);
            return transport.runDockerMutation(
                { ...request, operation },
                {
                    ...options,
                    window: win,
                    capabilitySnapshot: capabilities
                }
            );
        };
        const resolveMutationId = async (request = {}, options = {}) => {
            const resolved = await resolveIdentity(request.containerId || request.container, options);
            return { ...request, containerId: resolved.id };
        };
        const mutations = {
            remove: async (request = {}, options = {}) => {
                const resolved = await resolveMutationId(request, options);
                const result = await runMutation('removeContainer', resolved, options);
                containerCache = containerCache.filter((entry) => entry.id !== resolved.containerId);
                return result;
            },
            update: async (request = {}, options = {}) => {
                const resolved = await resolveMutationId(request, options);
                const result = await runMutation('updateContainer', resolved, options);
                await reconcileContainer(resolved.containerId, options);
                return result;
            },
            updateMany: async (identities = [], options = {}) => {
                const resolved = await Promise.all(
                    identities.map((identity) => resolveIdentity(identity, options))
                );
                const result = await runMutation('updateContainers', {
                    containerIds: resolved.map((entry) => entry.id)
                }, options);
                await listContainers(options);
                return result;
            },
            updateAll: async (options = {}) => {
                const result = await runMutation('updateAllContainers', {}, options);
                await listContainers(options);
                return result;
            },
            refreshDigests: (options = {}) => runMutation('refreshDockerDigests', {}, options),
            updateAutostart: async (entries = [], options = {}) => {
                const resolvedEntries = await Promise.all(entries.map(async (entry) => {
                    const resolved = await resolveIdentity(entry?.id || entry?.container, options);
                    return {
                        id: resolved.id,
                        autoStart: entry?.autoStart === true,
                        wait: entry?.wait
                    };
                }));
                const result = await runMutation('updateAutostartConfiguration', {
                    entries: resolvedEntries,
                    persistUserPreferences: options.persistUserPreferences !== false
                }, options);
                await listContainers(options);
                return result;
            }
        };
        const tailLogs = async (identity, options = {}) => {
            const capabilities = await ready(options);
            if (capabilities.query?.logs !== true) {
                throw unsupportedError(
                    'Bounded Docker logs are unavailable through this Unraid API.',
                    'capability-unavailable'
                );
            }
            const resolved = await resolveIdentity(identity, options);
            const tail = Math.max(1, Math.min(500, Math.trunc(Number(options.tail) || 100)));
            const data = await transport.query(DOCKER_LOGS_QUERY, {
                id: resolved.id,
                since: options.since || null,
                tail
            }, {
                ...options,
                window: win,
                operation: 'docker-logs'
            });
            return data?.docker?.logs || { lines: [], cursor: null };
        };
        const capabilityAccessors = capabilityTools.createAccessors(() => clone(lastCapabilities) || {});
        return freezeProvider({
            id: PROVIDER_IDS.UNRAID_GRAPHQL,
            label: 'Unraid GraphQL API',
            capabilities: {
                listContainers: true,
                containerStatus: true,
                subscribe: true,
                subscribeStats: true,
                executeActions: true,
                identityResolution: true,
                targetedReconciliation: true,
                richMetadata: true,
                portConflicts: true,
                boundedLogs: true,
                updateMutations: true,
                autostartMutation: true,
                organizationRead: false,
                organizationWrite: false,
                uiSurface: false
            },
            ready,
            listContainers,
            getContainer,
            reconcileContainer,
            subscribe,
            subscribeStats,
            executeAction,
            identity: {
                resolve: resolveContainerIdentity
            },
            health: {
                getSummary: getHealthSummary,
                getLastSummary: () => clone(lastHealthSummary)
            },
            mutations,
            logs: {
                tail: tailLogs
            },
            organization: {
                authority: 'unraid-native',
                qualification: () => Object.freeze({
                    schemaDetected: lastCapabilities?.organizer?.query === true,
                    mutationDetected: lastCapabilities?.organizer?.mutation === true,
                    upstreamActivated: deps.nativeDockerUpstreamActivated === true,
                    migrationReviewed: deps.nativeOrganizerMigrationReviewed === true,
                    policy: 'detect-only',
                    integrationAllowed: false
                }),
                read: () => Promise.reject(unsupportedError(
                    'Native Docker organization remains owned by Unraid until its public schema is stable.',
                    'native-organization-owned-by-unraid'
                )),
                write: () => Promise.reject(unsupportedError(
                    'FolderView Plus does not mutate the native Unraid Docker organizer.',
                    'native-organization-owned-by-unraid'
                ))
            },
            uiSurface: {
                owner: 'unraid-native',
                folderOverlayAllowed: false,
                nativeOrganizerMutationAllowed: false
            },
            getDiagnostics: () => ({
                provider: PROVIDER_IDS.UNRAID_GRAPHQL,
                state: lastCapabilities?.endpointAvailable ? 'ready' : 'pending',
                fallback: lastCapabilities?.endpointAvailable ? 'none' : 'leave-host-ui-untouched',
                health: lastHealthSummary ? {
                    detailsAvailable: lastHealthSummary.detailsAvailable === true,
                    updateAvailableCount: lastHealthSummary.updateAvailableCount,
                    rebuildReadyCount: lastHealthSummary.rebuildReadyCount,
                    orphanedCount: lastHealthSummary.orphanedCount,
                    containerPortConflictCount: lastHealthSummary.containerPortConflictCount,
                    lanPortConflictCount: lastHealthSummary.lanPortConflictCount
                } : null
            }),
            ...capabilityAccessors,
            dispose: () => {
                Array.from(activeSubscriptions).forEach((close) => close());
                activeSubscriptions.clear();
                containerCache = [];
                healthSummaryPromise = null;
            }
        });
    };

    const createHybridProvider = (deps = {}) => {
        const legacy = createLegacyWebguiProvider(deps);
        const graphql = createGraphqlProvider(deps);
        const deferredSubscriptions = new Set();
        let graphReady = false;
        let lastFallback = 'graphql-not-checked';
        const ready = async (options = {}) => {
            try {
                const capabilities = await graphql.ready(options);
                graphReady = capabilities?.endpointAvailable === true
                    && (
                        capabilities?.query?.containers === true
                        || capabilities?.query?.dockerContainers === true
                    );
                lastFallback = graphReady ? 'none' : 'legacy-data';
                return capabilities;
            } catch (_error) {
                graphReady = false;
                lastFallback = 'legacy-data';
                return null;
            }
        };
        const listContainers = async (options = {}) => {
            const capabilities = await ready(options);
            if (graphReady && capabilities) {
                try {
                    return await graphql.listContainers(options);
                } catch (_error) {
                    lastFallback = 'legacy-data';
                }
            }
            return legacy.listContainers(options);
        };
        const getContainer = async (identity, options = {}) => {
            const capabilities = await ready(options);
            if (graphReady && capabilities) {
                try {
                    return await graphql.getContainer(identity, options);
                } catch (_error) {
                    lastFallback = 'legacy-data';
                }
            }
            return legacy.getContainer(identity, options);
        };
        const reconcileContainer = async (identity, options = {}) => {
            const capabilities = await ready(options);
            if (graphReady && capabilities?.query?.container === true) {
                try {
                    return await graphql.reconcileContainer(identity, options);
                } catch (_error) {
                    lastFallback = 'legacy-reconciliation';
                }
            }
            return legacy.getContainer(identity, options);
        };
        const subscribeStats = (options = {}) => {
            let active = true;
            let close = null;
            const dispose = () => {
                active = false;
                deferredSubscriptions.delete(dispose);
                close?.();
                close = null;
            };
            deferredSubscriptions.add(dispose);
            Promise.resolve()
                .then(() => ready(options))
                .then((capabilities) => {
                    if (!active) return;
                    if (
                        graphReady
                        && capabilities?.subscription?.dockerContainerStats === true
                    ) {
                        close = graphql.subscribeStats(options);
                        return;
                    }
                    lastFallback = 'legacy-stats';
                    options.onStatus?.({ status: 'unavailable', transport: 'legacy-host' });
                })
                .catch((error) => {
                    if (!active) return;
                    lastFallback = 'legacy-stats';
                    options.onError?.(error);
                    options.onStatus?.({ status: 'failed', transport: 'legacy-host' });
                });
            return dispose;
        };
        const getHealthSummary = async (options = {}) => {
            const capabilities = await ready(options);
            if (graphReady && capabilities) {
                try {
                    return await graphql.health.getSummary(options);
                } catch (_error) {
                    lastFallback = 'legacy-health';
                }
            }
            return legacy.health.getSummary(options);
        };
        const capabilityAccessors = capabilityTools.createAccessors(() => graphql.getCapabilities?.() || {}, () => graphReady);
        return freezeProvider({
            id: PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL,
            label: translate('docker.provider.hybrid-label', 'Legacy Unraid WebGUI with GraphQL data'),
            capabilities: {
                listContainers: true,
                containerStatus: true,
                subscribe: true,
                subscribeStats: true,
                executeActions: legacy.capabilities.executeActions === true,
                identityResolution: true,
                targetedReconciliation: true,
                richMetadata: true,
                portConflicts: true,
                boundedLogs: true,
                updateMutations: true,
                autostartMutation: true,
                organizationRead: legacy.capabilities.organizationRead === true,
                organizationWrite: legacy.capabilities.organizationWrite === true,
                uiSurface: true
            },
            ready,
            listContainers,
            getContainer,
            reconcileContainer,
            subscribe: legacy.subscribe,
            subscribeStats,
            executeAction: legacy.executeAction,
            identity: {
                resolve: resolveContainerIdentity
            },
            health: {
                getSummary: getHealthSummary,
                getLastSummary: graphql.health.getLastSummary
            },
            mutations: graphql.mutations,
            logs: graphql.logs,
            organization: legacy.organization,
            uiSurface: legacy.uiSurface,
            getDiagnostics: () => ({
                provider: PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL,
                state: graphReady ? 'ready' : 'degraded',
                dataTransport: graphReady ? 'unraid-graphql' : 'legacy-webgui',
                actionTransport: 'legacy-webgui',
                fallback: lastFallback
            }),
            ...capabilityAccessors,
            dispose: () => {
                Array.from(deferredSubscriptions).forEach((close) => close());
                deferredSubscriptions.clear();
                legacy.dispose();
                graphql.dispose();
            }
        });
    };

    const createUnsupportedProvider = () => freezeProvider({
        id: PROVIDER_IDS.UNSUPPORTED_UNKNOWN,
        label: 'Unsupported Docker host',
        capabilities: {
            listContainers: false,
            containerStatus: false,
            subscribe: false,
            subscribeStats: false,
            executeActions: false,
            identityResolution: false,
            targetedReconciliation: false,
            richMetadata: false,
            portConflicts: false,
            boundedLogs: false,
            updateMutations: false,
            autostartMutation: false,
            organizationRead: false,
            organizationWrite: false,
            uiSurface: false
        },
        listContainers: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        getContainer: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        reconcileContainer: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        subscribe: () => () => {},
        subscribeStats: (options = {}) => {
            options.onStatus?.({ status: 'unavailable', transport: 'none' });
            return () => {};
        },
        executeAction: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        identity: {
            resolve: () => null
        },
        health: {
            getSummary: () => Promise.reject(unsupportedError('Docker health metadata is unavailable.'))
        },
        mutations: {},
        logs: {
            tail: () => Promise.reject(unsupportedError('Docker logs are unavailable.'))
        },
        organization: {
            authority: 'unknown',
            read: () => Promise.reject(unsupportedError('Docker organization is unavailable.')),
            write: () => Promise.reject(unsupportedError('Docker organization is unavailable.'))
        },
        uiSurface: {
            owner: 'unknown',
            folderOverlayAllowed: false,
            nativeOrganizerMutationAllowed: false
        },
        getDiagnostics: () => ({
            provider: PROVIDER_IDS.UNSUPPORTED_UNKNOWN,
            state: 'unavailable',
            fallback: 'leave-host-ui-untouched'
        }),
        ...capabilityTools.createAccessors(() => capabilityTools.emptySnapshot(), () => false),
        dispose: () => {}
    });

    const createRegistry = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        const compatibilityModule = deps.compatibilityModule || win?.FolderViewPlusHostCompatibility || null;
        const compatibilityController = deps.compatibilityController
            || compatibilityModule?.getDefaultController?.({ window: win, document: doc })
            || null;
        const transport = deps.transport || win?.FolderViewPlusRuntimeTransport || null;
        const instances = new Map();
        let preparedProvider = null;
        let prepareAbortController = null;
        const getPrepareSignal = () => {
            if (
                !prepareAbortController
                || prepareAbortController.signal?.aborted === true
            ) {
                const Controller = win?.AbortController
                    || (typeof AbortController !== 'undefined' ? AbortController : null);
                prepareAbortController = Controller ? new Controller() : null;
            }
            return prepareAbortController?.signal;
        };

        const get = (id) => {
            if (instances.has(id)) return instances.get(id);
            let provider = null;
            if (id === PROVIDER_IDS.LEGACY_WEBGUI) {
                provider = createLegacyWebguiProvider({ ...deps, window: win, document: doc, transport });
            } else if (id === PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL) {
                provider = createHybridProvider({ ...deps, window: win, document: doc, transport });
            } else if (id === PROVIDER_IDS.UNRAID_GRAPHQL) {
                provider = createGraphqlProvider({ ...deps, window: win, document: doc, transport });
            } else {
                provider = createUnsupportedProvider();
            }
            instances.set(id, provider);
            return provider;
        };
        const select = (options = {}) => {
            const generation = String(options.hostGeneration || '').trim();
            if (generation === compatibilityModule?.HOST_GENERATIONS?.LEGACY_DOCKER_TABLE) {
                return get(PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL);
            }
            if (generation === compatibilityModule?.HOST_GENERATIONS?.NATIVE_DOCKER_VUE) {
                return get(PROVIDER_IDS.UNRAID_GRAPHQL);
            }
            if (!generation && typeof win?.eventControl === 'function') {
                return get(PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL);
            }
            if (!generation && typeof win?.fetch === 'function') {
                return get(PROVIDER_IDS.UNRAID_GRAPHQL);
            }
            return get(PROVIDER_IDS.UNSUPPORTED_UNKNOWN);
        };
        const prepare = async (options = {}) => {
            preparedProvider = select(options);
            const preparingProvider = preparedProvider;
            const prepareOptions = {
                ...options,
                signal: options.signal || getPrepareSignal()
            };
            let capabilityEvidence = options.__capabilityEvidence
                || transport?.getCapabilitySnapshot?.()
                || null;
            if (preparedProvider.id === PROVIDER_IDS.UNRAID_GRAPHQL) {
                try {
                    capabilityEvidence = await preparedProvider.ready(prepareOptions);
                } catch (_error) {
                    capabilityEvidence = transport?.getCapabilitySnapshot?.() || capabilityEvidence;
                }
            } else if (
                preparedProvider.id === PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL
                && options.__backgroundResolution !== true
            ) {
                void Promise.resolve(preparedProvider.ready({
                    ...prepareOptions,
                    timeoutMs: Math.max(1000, Number(options.timeoutMs) || 4000)
                })).then((resolved) => {
                    if (preparedProvider !== preparingProvider) return;
                    return prepare({
                        ...options,
                        __backgroundResolution: true,
                        __capabilityEvidence: resolved || transport?.getCapabilitySnapshot?.() || null
                    });
                }).catch(() => {
                    // Legacy UI activation is independent of optional GraphQL discovery.
                });
            }
            const providerDiagnostics = preparedProvider.getDiagnostics();
            compatibilityController?.updateProviderEvidence?.({
                provider: {
                    selected: providerDiagnostics.provider,
                    state: providerDiagnostics.state,
                    fallback: providerDiagnostics.fallback
                },
                graphql: capabilityTools.buildCompatibilityEvidence(capabilityEvidence)
            });
            if (
                preparedProvider.id === PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL
                && capabilityEvidence?.endpointAvailable === true
                && typeof preparedProvider.health?.getSummary === 'function'
            ) {
                Promise.resolve()
                    .then(() => preparedProvider.health.getSummary({
                        timeoutMs: 8000,
                        signal: prepareOptions.signal,
                        staleKey: 'docker-provider-prepare-health'
                    }))
                    .then((health) => {
                        compatibilityController?.updateProviderEvidence?.({
                            provider: {
                                health: {
                                    detailsAvailable: health?.detailsAvailable === true,
                                    containerCount: Math.max(0, Number(health?.containerCount) || 0),
                                    updateAvailableCount:
                                        Math.max(0, Number(health?.updateAvailableCount) || 0),
                                    rebuildReadyCount:
                                        Math.max(0, Number(health?.rebuildReadyCount) || 0),
                                    orphanedCount: Math.max(0, Number(health?.orphanedCount) || 0),
                                    containerPortConflictCount:
                                        Math.max(0, Number(health?.containerPortConflictCount) || 0),
                                    lanPortConflictCount:
                                        Math.max(0, Number(health?.lanPortConflictCount) || 0),
                                    affectedContainerCount:
                                        Math.max(0, Number(health?.affectedContainerCount) || 0)
                                }
                            }
                        });
                    })
                    .catch(() => {
                        // Health metadata is optional; legacy rendering remains authoritative.
                    });
            }
            return preparedProvider;
        };
        const getDefault = () => preparedProvider || select();
        const dispose = () => {
            prepareAbortController?.abort?.();
            prepareAbortController = null;
            instances.forEach((provider) => provider.dispose?.());
            instances.clear();
            preparedProvider = null;
        };
        return Object.freeze({
            get,
            select,
            prepare,
            getDefault,
            dispose,
            snapshot: () => ({
                selected: preparedProvider?.id || null,
                availableProviders: Array.from(instances.keys())
            })
        });
    };

    let defaultRegistry = null;
    const getDefaultRegistry = (deps = {}) => {
        if (!defaultRegistry) defaultRegistry = createRegistry(deps);
        return defaultRegistry;
    };
    const getDefault = () => getDefaultRegistry().getDefault();
    const prepare = (options = {}) => getDefaultRegistry().prepare(options);

    return Object.freeze({
        PROVIDER_IDS,
        BASE_CONTAINER_FIELDS,
        OPTIONAL_CONTAINER_SCALAR_FIELDS,
        CURRENT_CONTAINERS_QUERY,
        LEGACY_CONTAINERS_QUERY,
        DOCKER_STATS_SUBSCRIPTION,
        DOCKER_PORT_CONFLICTS_QUERY,
        DOCKER_LOGS_QUERY,
        buildContainerSelection,
        buildCurrentContainersQuery,
        buildCurrentContainerQuery,
        normalizeContainer,
        resolveContainerIdentity,
        supportsCapabilityPath: capabilityTools.supportsCapabilityPath,
        createLegacyWebguiProvider,
        createHybridProvider,
        createGraphqlProvider,
        createUnsupportedProvider,
        createRegistry,
        getDefaultRegistry,
        getDefault,
        prepare
    });
}));
