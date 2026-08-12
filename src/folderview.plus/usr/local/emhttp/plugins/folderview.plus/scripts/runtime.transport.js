// @ts-check
(function runtimeTransportModule(root, factory) {
    const fallbackWindow = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            fallbackWindow,
            require('./runtime.transport.core.js'),
            require('./runtime.transport.subscription.js'),
            require('./runtime.transport.docker-actions.js')
        );
        return;
    }
    root.FolderViewPlusRuntimeTransport = factory(
        fallbackWindow,
        root.FolderViewPlusFoundationModules?.transportCore,
        root.FolderViewPlusFoundationModules?.transportSubscription,
        root.FolderViewPlusFoundationModules?.transportDockerActions
    );
}(typeof window !== 'undefined' ? window : {}, function runtimeTransportFactory(fallbackWindow, transportCoreModule, subscriptionModule, dockerActionsModule) {
    'use strict';
    if (!transportCoreModule || typeof transportCoreModule.createClient !== 'function') {
        throw new Error('FolderView Plus runtime transport core is unavailable.');
    }
    if (!subscriptionModule || typeof subscriptionModule.createRuntime !== 'function') {
        throw new Error('FolderView Plus runtime subscription transport is unavailable.');
    }
    if (!dockerActionsModule || typeof dockerActionsModule.createRuntime !== 'function') {
        throw new Error('FolderView Plus Docker action transport is unavailable.');
    }
    const requestCore = transportCoreModule.createClient(fallbackWindow);
    const {
        RuntimeTransportError,
        clone,
        csrfToken,
        query,
        record
    } = requestCore;
    const subscriptionRuntime = subscriptionModule.createRuntime({
        fallbackWindow,
        graphqlEndpoint: '/graphql',
        RuntimeTransportError,
        csrfToken,
        record
    });
    const { subscribe } = subscriptionRuntime;
    const GRAPHQL_ENDPOINT = '/graphql';
    const GRAPHQL_CAPABILITY_QUERY = `
        query FVPlusDockerCapabilities {
            queryType: __type(name: "Query") { fields(includeDeprecated: true) { ...FVPlusFieldCapability } }
            mutationType: __type(name: "Mutation") { fields(includeDeprecated: true) { ...FVPlusFieldCapability } }
            subscriptionType: __type(name: "Subscription") { fields(includeDeprecated: true) { ...FVPlusFieldCapability } }
            dockerType: __type(name: "Docker") { fields(includeDeprecated: true) { ...FVPlusFieldCapability } }
            dockerMutationsType: __type(name: "DockerMutations") { fields(includeDeprecated: true) { ...FVPlusFieldCapability } }
            dockerContainerType: __type(name: "DockerContainer") { fields(includeDeprecated: true) { ...FVPlusFieldCapability } }
            dockerAutostartInput: __type(name: "DockerAutostartEntryInput") {
                inputFields {
                    name
                    defaultValue
                    type { ...FVPlusTypeRef }
                }
            }
        }
        fragment FVPlusFieldCapability on __Field {
            name
            isDeprecated
            deprecationReason
            args {
                name
                defaultValue
                type { ...FVPlusTypeRef }
            }
            type { ...FVPlusTypeRef }
        }
        fragment FVPlusTypeRef on __Type {
            kind
            name
            ofType {
                kind
                name
                ofType {
                    kind
                    name
                    ofType {
                        kind
                        name
                        ofType {
                            kind
                            name
                        }
                    }
                }
            }
        }
    `;
    const GRAPHQL_VERSION_QUERY = `
        query FVPlusApiVersion {
            info { versions { core { unraid api } } }
        }
    `;
    const GRAPHQL_CURRENT_SHAPE_PROBE = 'query FVPlusDockerShape { docker { containers { __typename } } }';
    const GRAPHQL_LEGACY_SHAPE_PROBE = 'query FVPlusLegacyDockerShape { dockerContainers { __typename } }';
    let capabilityProbePromise = null;
    let capabilitySnapshot = Object.freeze({
        schemaVersion: 3,
        checkedAt: null,
        state: 'not-checked',
        endpointAvailable: false,
        apiVersion: 'unknown',
        unraidVersion: 'unknown',
        query: Object.freeze({
            docker: false,
            containers: false,
            container: false,
            networks: false,
            portConflicts: false,
            logs: false,
            containerUpdateStatuses: false,
            dockerContainers: false,
            shape: 'unknown'
        }),
        mutation: Object.freeze({
            docker: false,
            start: false,
            stop: false,
            restart: false,
            pause: false,
            unpause: false,
            removeContainer: false,
            updateContainer: false,
            updateContainers: false,
            updateAllContainers: false,
            updateAutostartConfiguration: false
        }),
        rootMutation: Object.freeze({
            refreshDockerDigests: false
        }),
        subscription: Object.freeze({
            dockerContainerStats: false
        }),
        containerFields: Object.freeze({}),
        operations: Object.freeze({}),
        organizer: Object.freeze({
            query: false,
            mutation: false,
            policy: 'detect-only'
        }),
        transport: Object.freeze({
            fetch: typeof fallbackWindow?.fetch === 'function',
            websocket: typeof fallbackWindow?.WebSocket === 'function',
            sse: typeof fallbackWindow?.EventSource === 'function'
        }),
        lastErrorCategory: null
    });

    const typeRefToString = (typeRef) => {
        if (!typeRef || typeof typeRef !== 'object') return 'unknown';
        const kind = String(typeRef.kind || '').trim();
        if (kind === 'NON_NULL') return `${typeRefToString(typeRef.ofType)}!`;
        if (kind === 'LIST') return `[${typeRefToString(typeRef.ofType)}]`;
        return String(typeRef.name || 'unknown').trim() || 'unknown';
    };
    const fieldRecords = (typeRecord) => new Map(
        (Array.isArray(typeRecord?.fields) ? typeRecord.fields : [])
            .map((entry) => [String(entry?.name || '').trim(), entry])
            .filter(([name]) => Boolean(name))
    );
    const operationCapability = (path, field) => {
        const args = (Array.isArray(field?.args) ? field.args : []).map((entry) => Object.freeze({
            name: String(entry?.name || '').trim(),
            type: typeRefToString(entry?.type),
            required: typeRefToString(entry?.type).endsWith('!'),
            hasDefault: entry?.defaultValue !== null && typeof entry?.defaultValue !== 'undefined'
        }));
        const returnType = field ? typeRefToString(field.type) : 'unknown';
        return Object.freeze({
            available: Boolean(field),
            path: String(path || '').trim(),
            deprecated: field?.isDeprecated === true,
            deprecationReason: field?.isDeprecated === true
                ? String(field?.deprecationReason || 'deprecated').trim()
                : null,
            arguments: Object.freeze(args),
            returnType,
            signature: field
                ? `${String(path || '').trim()}(${args.map((entry) => `${entry.name}:${entry.type}`).join(',')}):${returnType}`
                : ''
        });
    };
    const buildOperationMatrix = ({
        dockerFields = new Map(),
        dockerMutationFields = new Map(),
        mutationFields = new Map(),
        subscriptionFields = new Map()
    } = {}) => Object.freeze({
        listContainers: operationCapability('docker.containers', dockerFields.get('containers')),
        getContainer: operationCapability('docker.container', dockerFields.get('container')),
        listNetworks: operationCapability('docker.networks', dockerFields.get('networks')),
        portConflicts: operationCapability('docker.portConflicts', dockerFields.get('portConflicts')),
        logs: operationCapability('docker.logs', dockerFields.get('logs')),
        updateStatuses: operationCapability(
            'docker.containerUpdateStatuses',
            dockerFields.get('containerUpdateStatuses')
        ),
        start: operationCapability('mutation.docker.start', dockerMutationFields.get('start')),
        stop: operationCapability('mutation.docker.stop', dockerMutationFields.get('stop')),
        restart: operationCapability('mutation.docker.restart', dockerMutationFields.get('restart')),
        pause: operationCapability('mutation.docker.pause', dockerMutationFields.get('pause')),
        unpause: operationCapability('mutation.docker.unpause', dockerMutationFields.get('unpause')),
        removeContainer: operationCapability(
            'mutation.docker.removeContainer',
            dockerMutationFields.get('removeContainer')
        ),
        updateContainer: operationCapability(
            'mutation.docker.updateContainer',
            dockerMutationFields.get('updateContainer')
        ),
        updateContainers: operationCapability(
            'mutation.docker.updateContainers',
            dockerMutationFields.get('updateContainers')
        ),
        updateAllContainers: operationCapability(
            'mutation.docker.updateAllContainers',
            dockerMutationFields.get('updateAllContainers')
        ),
        updateAutostartConfiguration: operationCapability(
            'mutation.docker.updateAutostartConfiguration',
            dockerMutationFields.get('updateAutostartConfiguration')
        ),
        refreshDockerDigests: operationCapability(
            'mutation.refreshDockerDigests',
            mutationFields.get('refreshDockerDigests')
        ),
        stats: operationCapability(
            'subscription.dockerContainerStats',
            subscriptionFields.get('dockerContainerStats')
        )
    });
    const operationAcceptsArguments = (capability, expected = {}) => {
        const args = Array.isArray(capability?.arguments) ? capability.arguments : [], types = new Map(args.map((entry) => [entry.name, entry.type]));
        return capability?.available === true && Object.entries(expected).every(([name, type]) => types.get(name) === type) && args.every((entry) => expected[entry.name] || !entry.required || entry.hasDefault);
    };
    const freezeCapabilitySnapshot = (value) => Object.freeze({
        ...value,
        query: Object.freeze({ ...(value.query || {}) }),
        mutation: Object.freeze({ ...(value.mutation || {}) }),
        rootMutation: Object.freeze({ ...(value.rootMutation || {}) }),
        subscription: Object.freeze({ ...(value.subscription || {}) }),
        containerFields: Object.freeze({ ...(value.containerFields || {}) }),
        operations: Object.freeze({ ...(value.operations || {}) }),
        organizer: Object.freeze({ ...(value.organizer || {}) }),
        transport: Object.freeze({ ...(value.transport || {}) })
    });
    const probeCapabilities = async (options = {}) => {
        if (capabilityProbePromise && options.force !== true) return capabilityProbePromise;
        if (capabilitySnapshot.checkedAt && options.force !== true) return capabilitySnapshot;
        const win = options.window || fallbackWindow;
        capabilityProbePromise = (async () => {
            const base = {
                schemaVersion: 3,
                checkedAt: new Date().toISOString(),
                state: 'checking',
                endpointAvailable: false,
                apiVersion: 'unknown',
                unraidVersion: String(options.unraidVersion || 'unknown').trim() || 'unknown',
                query: {
                    docker: false,
                    containers: false,
                    container: false,
                    networks: false,
                    portConflicts: false,
                    logs: false,
                    containerUpdateStatuses: false,
                    dockerContainers: false,
                    shape: 'unknown'
                },
                mutation: {
                    docker: false,
                    start: false,
                    stop: false,
                    restart: false,
                    pause: false,
                    unpause: false,
                    removeContainer: false,
                    updateContainer: false,
                    updateContainers: false,
                    updateAllContainers: false,
                    updateAutostartConfiguration: false
                },
                rootMutation: {
                    refreshDockerDigests: false
                },
                subscription: { dockerContainerStats: false },
                containerFields: {},
                operations: {},
                organizer: { query: false, mutation: false, policy: 'detect-only' },
                transport: {
                    fetch: typeof win?.fetch === 'function',
                    websocket: typeof win?.WebSocket === 'function',
                    sse: typeof win?.EventSource === 'function'
                },
                lastErrorCategory: null
            };
            if (!base.transport.fetch) {
                capabilitySnapshot = freezeCapabilitySnapshot({
                    ...base,
                    state: 'unavailable',
                    lastErrorCategory: 'fetch-unavailable'
                });
                return capabilitySnapshot;
            }
            try {
                const data = await query(GRAPHQL_CAPABILITY_QUERY, {}, {
                    ...options,
                    window: win,
                    operation: 'capability-probe',
                    timeoutMs: Number(options.timeoutMs) || 6000,
                    staleKey: 'graphql-capability-probe'
                });
                const queryFieldRecords = fieldRecords(data.queryType);
                const mutationFieldRecords = fieldRecords(data.mutationType);
                const subscriptionFieldRecords = fieldRecords(data.subscriptionType);
                const dockerFieldRecords = fieldRecords(data.dockerType);
                const dockerMutationFieldRecords = fieldRecords(data.dockerMutationsType);
                const dockerContainerFieldRecords = fieldRecords(data.dockerContainerType);
                const queryFields = new Set(queryFieldRecords.keys());
                const mutationFields = new Set(mutationFieldRecords.keys());
                const subscriptionFields = new Set(subscriptionFieldRecords.keys());
                const dockerFields = new Set(dockerFieldRecords.keys());
                const dockerMutationFields = new Set(dockerMutationFieldRecords.keys());
                base.endpointAvailable = true;
                base.query.docker = queryFields.has('docker');
                base.query.containers = base.query.docker && dockerFields.has('containers');
                base.query.container = base.query.docker && dockerFields.has('container');
                base.query.networks = base.query.docker && dockerFields.has('networks');
                base.query.portConflicts = base.query.docker && dockerFields.has('portConflicts');
                base.query.logs = base.query.docker && dockerFields.has('logs');
                base.query.containerUpdateStatuses = base.query.docker
                    && dockerFields.has('containerUpdateStatuses');
                base.query.dockerContainers = queryFields.has('dockerContainers');
                base.query.shape = base.query.containers
                    ? 'docker.containers'
                    : (base.query.dockerContainers ? 'dockerContainers' : 'unavailable');
                base.mutation.docker = mutationFields.has('docker');
                Object.keys(base.mutation).forEach((action) => {
                    if (action !== 'docker') base.mutation[action] = base.mutation.docker && dockerMutationFields.has(action);
                });
                base.rootMutation.refreshDockerDigests = mutationFields.has('refreshDockerDigests');
                base.subscription.dockerContainerStats = subscriptionFields.has('dockerContainerStats');
                dockerContainerFieldRecords.forEach((_field, name) => {
                    base.containerFields[name] = true;
                });
                base.operations = buildOperationMatrix({
                    dockerFields: dockerFieldRecords,
                    dockerMutationFields: dockerMutationFieldRecords,
                    mutationFields: mutationFieldRecords,
                    subscriptionFields: subscriptionFieldRecords
                });
                base.organizer.query = base.query.docker && dockerFields.has('organizer');
                base.organizer.mutation = Array.from(mutationFields).some((field) => {
                    const normalizedField = String(field || '').toLowerCase();
                    return normalizedField.includes('docker')
                        && ['folder', 'entries', 'items', 'viewpreferences']
                            .some((marker) => normalizedField.includes(marker));
                });
                base.state = 'ready';
            } catch (error) {
                base.lastErrorCategory = String(error?.category || 'capability-probe-failed');
                try {
                    await query(GRAPHQL_CURRENT_SHAPE_PROBE, {}, {
                        ...options,
                        window: win,
                        operation: 'current-shape-probe',
                        timeoutMs: Number(options.timeoutMs) || 6000
                    });
                    base.endpointAvailable = true;
                    base.query.docker = true;
                    base.query.containers = true;
                    base.query.shape = 'docker.containers';
                    base.operations.listContainers = Object.freeze({
                        available: true,
                        path: 'docker.containers',
                        deprecated: false,
                        deprecationReason: null,
                        arguments: Object.freeze([]),
                        returnType: 'unknown',
                        signature: 'docker.containers'
                    });
                    base.state = 'limited';
                } catch (_currentError) {
                    try {
                        await query(GRAPHQL_LEGACY_SHAPE_PROBE, {}, {
                            ...options,
                            window: win,
                            operation: 'legacy-shape-probe',
                            timeoutMs: Number(options.timeoutMs) || 6000
                        });
                        base.endpointAvailable = true;
                        base.query.dockerContainers = true;
                        base.query.shape = 'dockerContainers';
                        base.operations.listContainers = Object.freeze({
                            available: true,
                            path: 'dockerContainers',
                            deprecated: false,
                            deprecationReason: null,
                            arguments: Object.freeze([]),
                            returnType: 'unknown',
                            signature: 'dockerContainers'
                        });
                        base.state = 'limited';
                    } catch (shapeError) {
                        base.state = 'unavailable';
                        base.lastErrorCategory = String(shapeError?.category || base.lastErrorCategory);
                    }
                }
            }
            if (base.endpointAvailable) {
                try {
                    const versionData = await query(GRAPHQL_VERSION_QUERY, {}, {
                        ...options,
                        window: win,
                        operation: 'version-probe',
                        timeoutMs: Number(options.timeoutMs) || 6000
                    });
                    base.apiVersion = String(versionData?.info?.versions?.core?.api || 'unknown').trim() || 'unknown';
                    base.unraidVersion = String(versionData?.info?.versions?.core?.unraid || base.unraidVersion).trim() || 'unknown';
                } catch (_error) {
                    // Version telemetry is optional and does not invalidate Docker capabilities.
                }
            }
            capabilitySnapshot = freezeCapabilitySnapshot(base);
            record('capability-probe', {
                ok: capabilitySnapshot.endpointAvailable,
                state: capabilitySnapshot.state,
                queryShape: capabilitySnapshot.query.shape,
                mutationCount: [
                    'start',
                    'stop',
                    'restart',
                    'pause',
                    'unpause',
                    'removeContainer',
                    'updateContainer',
                    'updateContainers',
                    'updateAllContainers',
                    'updateAutostartConfiguration'
                ]
                    .filter((action) => capabilitySnapshot.mutation[action]).length,
                subscriptionAvailable: capabilitySnapshot.subscription.dockerContainerStats,
                organizerDetected: capabilitySnapshot.organizer.query || capabilitySnapshot.organizer.mutation,
                category: capabilitySnapshot.lastErrorCategory
            });
            return capabilitySnapshot;
        })().finally(() => {
            capabilityProbePromise = null;
        });
        return capabilityProbePromise;
    };

    const dockerActionRuntime = dockerActionsModule.createRuntime({
        fallbackWindow,
        RuntimeTransportError,
        operationAcceptsArguments,
        probeCapabilities,
        query,
        record
    });
    const {
        DOCKER_MUTATION_OPERATIONS,
        runDockerAction,
        runDockerMutation
    } = dockerActionRuntime;

    const capabilities = (win = fallbackWindow) => Object.freeze({
        graphql: typeof win?.fetch === 'function',
        websocket: typeof win?.WebSocket === 'function',
        sse: typeof win?.EventSource === 'function',
        hostEventControl: typeof win?.eventControl === 'function',
        probed: clone(capabilitySnapshot)
    });

    return Object.freeze({
        GRAPHQL_ENDPOINT,
        GRAPHQL_CAPABILITY_QUERY,
        GRAPHQL_VERSION_QUERY,
        DOCKER_MUTATION_OPERATIONS,
        RuntimeTransportError,
        query,
        probeCapabilities,
        getCapabilitySnapshot: () => clone(capabilitySnapshot),
        subscribe,
        runDockerAction,
        runDockerMutation,
        capabilities,
        diagnostics: requestCore.diagnostics
    });
}));
