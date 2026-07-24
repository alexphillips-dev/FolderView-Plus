// @ts-check
(function dockerRuntimeProvidersModule(root, factory) {
    const fallbackWindow = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDockerProviders = factory(fallbackWindow);
    root.FolderViewPlusDockerProvidersModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeProvidersFactory(fallbackWindow) {
    'use strict';

    const PROVIDER_IDS = Object.freeze({
        LEGACY_WEBGUI: 'legacy-webgui',
        UNRAID_GRAPHQL: 'unraid-graphql',
        UNSUPPORTED_UNKNOWN: 'unsupported-unknown'
    });
    const CURRENT_CONTAINERS_QUERY = `
        query FVPlusDockerContainers {
            docker {
                containers { id names state status autoStart }
            }
        }
    `;
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

    const clone = (value) => {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return null;
        }
    };
    const normalizeName = (value) => String(value || '').trim().replace(/^\/+/, '');
    const normalizeContainer = (entry = {}) => {
        const names = (Array.isArray(entry.names) ? entry.names : [entry.name])
            .map(normalizeName)
            .filter(Boolean);
        return Object.freeze({
            id: String(entry.id || '').trim(),
            names: Object.freeze(names),
            name: names[0] || '',
            state: String(entry.state || '').trim().toLowerCase(),
            status: String(entry.status || '').trim(),
            autoStart: entry.autoStart === true
        });
    };
    const resolveContainerIdentity = (value, containers = []) => {
        const needle = normalizeName(value);
        if (!needle) return null;
        const exact = containers.filter((entry) => (
            String(entry.id || '') === needle
            || String(entry.id || '').split(':').pop() === needle
            || (Array.isArray(entry.names) && entry.names.some((name) => normalizeName(name) === needle))
        ));
        if (exact.length === 1) return exact[0];
        const suffix = containers.filter((entry) => {
            const id = String(entry.id || '').split(':').pop() || '';
            return needle.length >= 8 && id.startsWith(needle);
        });
        return suffix.length === 1 ? suffix[0] : null;
    };
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
                return (await deps.listLegacyContainers()).map(normalizeContainer);
            }
            return (hostAdapter?.queryRows?.('item') || []).map((row) => normalizeContainer({
                id: String(row?.id || '').replace(/^ct-/, ''),
                names: [hostAdapter.getRowIdentity(row)],
                state: row?.dataset?.fvRuntimeState || row?.dataset?.state || '',
                status: row?.querySelector?.('.state')?.textContent || ''
            }));
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
                executeActions: typeof win?.eventControl === 'function',
                identityResolution: true,
                organizationRead: typeof deps.readOrganization === 'function',
                organizationWrite: typeof deps.writeOrganization === 'function',
                uiSurface: true
            },
            listContainers,
            getContainer: async (identity) => resolveContainerIdentity(identity, await listContainers()),
            subscribe,
            executeAction,
            identity: {
                resolve: resolveContainerIdentity
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
        const listContainers = async (options = {}) => {
            const capabilities = await ready(options);
            if (!capabilities?.query?.containers && !capabilities?.query?.dockerContainers) {
                throw unsupportedError('This Unraid API does not expose a supported Docker container query.', 'capability-unavailable');
            }
            const useCurrentShape = capabilities.query.containers === true;
            const data = await transport.query(
                useCurrentShape ? CURRENT_CONTAINERS_QUERY : LEGACY_CONTAINERS_QUERY,
                {},
                {
                    ...options,
                    window: win,
                    operation: 'docker-containers',
                    staleKey: String(options.staleKey || 'docker-provider-containers')
                }
            );
            const entries = useCurrentShape ? data?.docker?.containers : data?.dockerContainers;
            return (Array.isArray(entries) ? entries : []).map(normalizeContainer);
        };
        const getContainer = async (identity, options = {}) => (
            resolveContainerIdentity(identity, await listContainers(options))
        );
        const executeAction = async (request = {}, options = {}) => {
            const containers = await listContainers(options);
            const resolved = resolveContainerIdentity(request.containerId || request.container, containers);
            if (!resolved?.id) {
                throw unsupportedError('The requested Docker container identity could not be resolved.', 'identity-unresolved');
            }
            return transport.runDockerAction({
                ...request,
                containerId: resolved.id
            }, {
                ...options,
                window: win,
                forceGraphql: true,
                capabilitySnapshot: lastCapabilities
            });
        };
        const subscribe = (options = {}) => {
            const useWebSocket = lastCapabilities?.subscription?.dockerContainerStats === true;
            const close = transport.subscribe({
                ...options,
                window: win,
                autoWebSocket: useWebSocket,
                document: useWebSocket ? DOCKER_STATS_SUBSCRIPTION : options.document,
                poll: useWebSocket ? options.poll : (options.poll || (() => listContainers(options)))
            });
            const disposeSubscription = () => {
                activeSubscriptions.delete(disposeSubscription);
                close();
            };
            activeSubscriptions.add(disposeSubscription);
            return disposeSubscription;
        };
        return freezeProvider({
            id: PROVIDER_IDS.UNRAID_GRAPHQL,
            label: 'Unraid GraphQL API',
            capabilities: {
                listContainers: true,
                containerStatus: true,
                subscribe: true,
                executeActions: true,
                identityResolution: true,
                organizationRead: false,
                organizationWrite: false,
                uiSurface: false
            },
            ready,
            listContainers,
            getContainer,
            subscribe,
            executeAction,
            identity: {
                resolve: resolveContainerIdentity
            },
            organization: {
                authority: 'unraid-native',
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
                fallback: lastCapabilities?.endpointAvailable ? 'none' : 'leave-host-ui-untouched'
            }),
            dispose: () => {
                Array.from(activeSubscriptions).forEach((close) => close());
                activeSubscriptions.clear();
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
            executeActions: false,
            identityResolution: false,
            organizationRead: false,
            organizationWrite: false,
            uiSurface: false
        },
        listContainers: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        getContainer: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        subscribe: () => () => {},
        executeAction: () => Promise.reject(unsupportedError('The Docker host generation is not supported.')),
        identity: {
            resolve: () => null
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

        const get = (id) => {
            if (instances.has(id)) return instances.get(id);
            let provider = null;
            if (id === PROVIDER_IDS.LEGACY_WEBGUI) {
                provider = createLegacyWebguiProvider({ ...deps, window: win, document: doc, transport });
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
                return get(PROVIDER_IDS.LEGACY_WEBGUI);
            }
            if (generation === compatibilityModule?.HOST_GENERATIONS?.NATIVE_DOCKER_VUE) {
                return get(PROVIDER_IDS.UNRAID_GRAPHQL);
            }
            if (!generation && typeof win?.eventControl === 'function') {
                return get(PROVIDER_IDS.LEGACY_WEBGUI);
            }
            if (!generation && typeof win?.fetch === 'function') {
                return get(PROVIDER_IDS.UNRAID_GRAPHQL);
            }
            return get(PROVIDER_IDS.UNSUPPORTED_UNKNOWN);
        };
        const prepare = async (options = {}) => {
            preparedProvider = select(options);
            let capabilityEvidence = transport?.getCapabilitySnapshot?.() || null;
            if (preparedProvider.id === PROVIDER_IDS.UNRAID_GRAPHQL) {
                try {
                    capabilityEvidence = await preparedProvider.ready(options);
                } catch (_error) {
                    capabilityEvidence = transport?.getCapabilitySnapshot?.() || capabilityEvidence;
                }
            }
            const providerDiagnostics = preparedProvider.getDiagnostics();
            compatibilityController?.updateProviderEvidence?.({
                provider: {
                    selected: providerDiagnostics.provider,
                    state: providerDiagnostics.state,
                    fallback: providerDiagnostics.fallback
                },
                graphql: capabilityEvidence ? {
                    endpointAvailable: capabilityEvidence.endpointAvailable === true,
                    apiVersion: String(capabilityEvidence.apiVersion || 'unknown'),
                    unraidVersion: String(capabilityEvidence.unraidVersion || 'unknown'),
                    queryContainers: capabilityEvidence.query?.containers === true
                        || capabilityEvidence.query?.dockerContainers === true,
                    queryShape: String(capabilityEvidence.query?.shape || 'unknown'),
                    mutations: {
                        start: capabilityEvidence.mutation?.start === true,
                        stop: capabilityEvidence.mutation?.stop === true,
                        restart: capabilityEvidence.mutation?.restart === true,
                        pause: capabilityEvidence.mutation?.pause === true,
                        unpause: capabilityEvidence.mutation?.unpause === true
                    },
                    subscriptions: {
                        dockerContainerStats: capabilityEvidence.subscription?.dockerContainerStats === true
                    },
                    organizer: {
                        query: capabilityEvidence.organizer?.query === true,
                        mutation: capabilityEvidence.organizer?.mutation === true,
                        policy: 'detect-only'
                    },
                    lastErrorCategory: capabilityEvidence.lastErrorCategory || null
                } : {}
            });
            return preparedProvider;
        };
        const getDefault = () => preparedProvider || select();
        const dispose = () => {
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
        CURRENT_CONTAINERS_QUERY,
        LEGACY_CONTAINERS_QUERY,
        DOCKER_STATS_SUBSCRIPTION,
        normalizeContainer,
        resolveContainerIdentity,
        createLegacyWebguiProvider,
        createGraphqlProvider,
        createUnsupportedProvider,
        createRegistry,
        getDefaultRegistry,
        getDefault,
        prepare
    });
}));
