// @ts-check
(function runtimeTransportModule(root, factory) {
    const fallbackWindow = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusRuntimeTransport = factory(fallbackWindow);
    root.FolderViewPlusRuntimeTransportModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function runtimeTransportFactory(fallbackWindow) {
    'use strict';

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
    const DOCKER_ACTIONS = Object.freeze({
        start: 'start',
        stop: 'stop',
        restart: 'restart',
        pause: 'pause',
        resume: 'unpause',
        unpause: 'unpause'
    });
    const diagnostics = [];
    const staleGenerations = new Map();
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

    class RuntimeTransportError extends Error {
        constructor(message, options = {}) {
            super(String(message || 'Runtime transport request failed.'));
            this.name = 'RuntimeTransportError';
            this.category = String(options.category || 'request-failed');
            this.status = Number.isFinite(Number(options.status)) ? Number(options.status) : 0;
            this.retryable = options.retryable === true;
            this.partialData = options.partialData || null;
        }
    }

    const clone = (value) => {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return null;
        }
    };
    const record = (event, details = {}) => {
        diagnostics.push({
            event: String(event || 'runtime-transport'),
            at: new Date().toISOString(),
            ...details
        });
        if (diagnostics.length > 100) diagnostics.splice(0, diagnostics.length - 100);
    };
    const csrfToken = (win = fallbackWindow) => String(win?.csrf_token || '').trim();
    const buildHeaders = (options = {}, win = fallbackWindow) => {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        const token = String(options.csrfToken || csrfToken(win)).trim();
        if (token && !Object.keys(headers).some((name) => name.toLowerCase() === 'x-csrf-token')) {
            headers['x-csrf-token'] = token;
        }
        return headers;
    };
    const classifyHttpError = (status) => {
        if (status === 401) return { category: 'authentication-required', message: 'GraphQL authentication is required.', retryable: false };
        if (status === 403) return { category: 'permission-denied', message: 'GraphQL permission was denied.', retryable: false };
        if (status === 429) return { category: 'rate-limited', message: 'GraphQL request was rate limited.', retryable: true };
        if (status >= 500) return { category: 'service-unavailable', message: 'The GraphQL service is unavailable.', retryable: true };
        return { category: 'http-error', message: 'The GraphQL request was rejected.', retryable: false };
    };
    const classifyGraphqlErrors = (errors = []) => {
        const text = errors.map((entry) => String(entry?.message || '')).join(' ').toLowerCase();
        const codes = errors.map((entry) => String(entry?.extensions?.code || '').toLowerCase());
        if (codes.some((code) => code.includes('unauth')) || /authenticat|not logged/.test(text)) {
            return { category: 'authentication-required', message: 'GraphQL authentication is required.', retryable: false };
        }
        if (codes.some((code) => code.includes('forbidden')) || /forbidden|permission|not authorized/.test(text)) {
            return { category: 'permission-denied', message: 'GraphQL permission was denied.', retryable: false };
        }
        if (/cannot query field|unknown (?:field|argument|type)|validation/.test(text)) {
            return { category: 'capability-unavailable', message: 'The requested GraphQL capability is unavailable.', retryable: false };
        }
        return { category: 'graphql-error', message: 'The GraphQL operation failed.', retryable: false };
    };
    const createAbortBoundary = (options = {}, win = fallbackWindow) => {
        const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
        const externalSignal = options.signal || null;
        const Controller = win?.AbortController || (typeof AbortController !== 'undefined' ? AbortController : null);
        if (!Controller || (!timeoutMs && !externalSignal)) {
            return { signal: externalSignal || undefined, cleanup: () => {}, timedOut: () => false };
        }
        const controller = new Controller();
        let didTimeout = false;
        let timer = null;
        const abortFromExternal = () => controller.abort(externalSignal?.reason);
        if (externalSignal?.aborted) abortFromExternal();
        else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
        if (timeoutMs) {
            timer = win.setTimeout(() => {
                didTimeout = true;
                controller.abort();
            }, timeoutMs);
        }
        return {
            signal: controller.signal,
            timedOut: () => didTimeout,
            cleanup: () => {
                if (timer !== null) win.clearTimeout(timer);
                externalSignal?.removeEventListener?.('abort', abortFromExternal);
            }
        };
    };

    const query = async (document, variables = {}, options = {}) => {
        const win = options.window || fallbackWindow;
        if (typeof win?.fetch !== 'function') {
            throw new RuntimeTransportError('Fetch is unavailable.', {
                category: 'fetch-unavailable',
                retryable: false
            });
        }
        const operation = String(options.operation || 'graphql').trim() || 'graphql';
        const endpoint = String(options.endpoint || GRAPHQL_ENDPOINT);
        const staleKey = String(options.staleKey || '').trim();
        const generation = staleKey
            ? (staleGenerations.get(staleKey) || 0) + 1
            : 0;
        if (staleKey) staleGenerations.set(staleKey, generation);
        const abortBoundary = createAbortBoundary(options, win);
        const startedAt = Date.now();
        try {
            const response = await win.fetch(endpoint, {
                method: 'POST',
                credentials: 'same-origin',
                headers: buildHeaders(options, win),
                body: JSON.stringify({
                    query: String(document || ''),
                    variables: variables && typeof variables === 'object' ? variables : {}
                }),
                signal: abortBoundary.signal
            });
            if (staleKey && staleGenerations.get(staleKey) !== generation) {
                throw new RuntimeTransportError('A newer request replaced this response.', {
                    category: 'stale-response',
                    retryable: false
                });
            }
            const payload = await response.json().catch(() => null);
            if (staleKey && staleGenerations.get(staleKey) !== generation) {
                throw new RuntimeTransportError('A newer request replaced this response.', {
                    category: 'stale-response',
                    retryable: false
                });
            }
            const durationMs = Date.now() - startedAt;
            if (!response.ok) {
                const classification = classifyHttpError(response.status);
                record('graphql', {
                    operation,
                    ok: false,
                    status: response.status,
                    durationMs,
                    category: classification.category
                });
                throw new RuntimeTransportError(classification.message, {
                    ...classification,
                    status: response.status
                });
            }
            if (!payload || typeof payload !== 'object') {
                record('graphql', {
                    operation,
                    ok: false,
                    status: response.status,
                    durationMs,
                    category: 'invalid-response'
                });
                throw new RuntimeTransportError('The GraphQL service returned an invalid response.', {
                    category: 'invalid-response',
                    retryable: true
                });
            }
            if (Array.isArray(payload.errors) && payload.errors.length > 0) {
                const classification = classifyGraphqlErrors(payload.errors);
                const partialData = payload.data && typeof payload.data === 'object' ? payload.data : null;
                record('graphql', {
                    operation,
                    ok: options.allowPartialData === true && Boolean(partialData),
                    partial: Boolean(partialData),
                    status: response.status,
                    durationMs,
                    category: classification.category
                });
                if (options.allowPartialData === true && partialData) return partialData;
                throw new RuntimeTransportError(classification.message, {
                    ...classification,
                    partialData
                });
            }
            record('graphql', {
                operation,
                ok: true,
                status: response.status,
                durationMs
            });
            return payload.data || {};
        } catch (rawError) {
            if (rawError instanceof RuntimeTransportError) throw rawError;
            const aborted = rawError?.name === 'AbortError';
            const category = aborted
                ? (abortBoundary.timedOut() ? 'timeout' : 'aborted')
                : 'offline';
            record('graphql', {
                operation,
                ok: false,
                status: 0,
                durationMs: Date.now() - startedAt,
                category
            });
            throw new RuntimeTransportError(
                category === 'timeout'
                    ? 'The GraphQL request timed out.'
                    : (category === 'aborted' ? 'The GraphQL request was cancelled.' : 'The GraphQL service could not be reached.'),
                { category, retryable: category === 'timeout' || category === 'offline' }
            );
        } finally {
            abortBoundary.cleanup();
        }
    };

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

    const resolveWebSocketUrl = (options = {}, win = fallbackWindow) => {
        if (options.webSocketUrl) return String(options.webSocketUrl);
        if (options.autoWebSocket !== true || !win?.location?.href) return '';
        try {
            const url = new URL(String(options.endpoint || GRAPHQL_ENDPOINT), win.location.href);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            return url.toString();
        } catch (_error) {
            return '';
        }
    };
    const subscribe = (options = {}) => {
        const win = options.window || fallbackWindow;
        const onData = typeof options.onData === 'function' ? options.onData : () => {};
        const onError = typeof options.onError === 'function' ? options.onError : () => {};
        const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
        const requestedMaxReconnects = Number(options.maxReconnects);
        const maxReconnects = Math.max(
            0,
            Math.min(10, Number.isFinite(requestedMaxReconnects) ? requestedMaxReconnects : 4)
        );
        const webSocketUrl = resolveWebSocketUrl(options, win);
        const subscriptionId = String(options.subscriptionId || 'fvplus-runtime');
        let disposed = false;
        let socket = null;
        let socketAckTimer = null;
        let eventSource = null;
        let reconnectTimer = null;
        let reconnectCount = 0;
        let pollTimer = null;
        let pollActive = false;
        let transport = 'none';
        let status = 'idle';

        const setStatus = (nextStatus, details = {}) => {
            status = nextStatus;
            onStatus({ status, transport, reconnectCount, ...details });
        };
        const scheduleReconnect = () => {
            if (disposed || reconnectCount >= maxReconnects) {
                setStatus(disposed ? 'closed' : 'failed');
                return;
            }
            const delayMs = Math.min(30000, Math.max(250, Number(options.reconnectBaseMs) || 500) * (2 ** reconnectCount));
            reconnectCount += 1;
            setStatus('reconnecting', { delayMs });
            reconnectTimer = win.setTimeout(openWebSocket, delayMs);
        };
        const openWebSocket = () => {
            if (disposed || !webSocketUrl || typeof win?.WebSocket !== 'function') return;
            transport = 'websocket';
            setStatus(reconnectCount > 0 ? 'reconnecting' : 'connecting');
            try {
                socket = new win.WebSocket(webSocketUrl, 'graphql-transport-ws');
            } catch (_error) {
                onError(new RuntimeTransportError('The GraphQL subscription could not be opened.', {
                    category: 'subscription-open-failed',
                    retryable: true
                }));
                scheduleReconnect();
                return;
            }
            socket.addEventListener('open', () => {
                const params = { ...(options.connectionParams || {}) };
                const token = String(options.csrfToken || csrfToken(win)).trim();
                if (token) params['x-csrf-token'] = token;
                socket.send(JSON.stringify({ type: 'connection_init', payload: params }));
                setStatus('authenticating');
                socketAckTimer = win.setTimeout(() => {
                    socketAckTimer = null;
                    if (socket?.readyState <= 1 && status === 'authenticating') {
                        socket.close(4408, 'GraphQL connection acknowledgement timed out');
                    }
                }, Math.max(1000, Number(options.connectionAckTimeoutMs) || 6000));
            });
            socket.addEventListener('message', (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'connection_ack') {
                        if (socketAckTimer !== null) win.clearTimeout(socketAckTimer);
                        socketAckTimer = null;
                        reconnectCount = 0;
                        socket.send(JSON.stringify({
                            id: subscriptionId,
                            type: 'subscribe',
                            payload: {
                                query: String(options.document || ''),
                                variables: options.variables || {}
                            }
                        }));
                        setStatus('active');
                    } else if (message.type === 'next') {
                        onData(message.payload?.data || message.payload);
                    } else if (message.type === 'error') {
                        onError(new RuntimeTransportError('The GraphQL subscription reported an error.', {
                            category: 'subscription-error',
                            retryable: false
                        }));
                    } else if (message.type === 'complete') {
                        setStatus('complete');
                    } else if (message.type === 'ping') {
                        socket.send(JSON.stringify({ type: 'pong', payload: message.payload }));
                    }
                } catch (_error) {
                    onError(new RuntimeTransportError('The GraphQL subscription returned invalid data.', {
                        category: 'invalid-subscription-response',
                        retryable: true
                    }));
                }
            });
            socket.addEventListener('error', () => {
                onError(new RuntimeTransportError('The GraphQL subscription connection failed.', {
                    category: 'subscription-offline',
                    retryable: true
                }));
            });
            socket.addEventListener('close', (event) => {
                if (socketAckTimer !== null) win.clearTimeout(socketAckTimer);
                socketAckTimer = null;
                socket = null;
                if (disposed || event?.code === 1000) {
                    setStatus('closed');
                    return;
                }
                scheduleReconnect();
            });
            record('subscription-open', { transport });
        };
        const startEventSource = () => {
            transport = 'sse';
            setStatus('connecting');
            eventSource = new win.EventSource(String(options.sseUrl), { withCredentials: true });
            eventSource.onopen = () => setStatus('active');
            eventSource.onmessage = (event) => {
                try {
                    onData(JSON.parse(event.data));
                } catch (_error) {
                    onData(event.data);
                }
            };
            eventSource.onerror = () => {
                onError(new RuntimeTransportError('The event stream connection failed.', {
                    category: 'subscription-offline',
                    retryable: true
                }));
                setStatus('degraded');
            };
            record('subscription-open', { transport });
        };
        const startPoll = () => {
            transport = 'poll';
            const interval = Math.max(1000, Number(options.pollIntervalMs) || 5000);
            const tick = async () => {
                if (disposed || pollActive) return;
                pollActive = true;
                try {
                    const data = await options.poll();
                    if (disposed) return;
                    onData(data);
                    setStatus('active');
                } catch (_error) {
                    if (disposed) return;
                    onError(new RuntimeTransportError('The Docker polling request failed.', {
                        category: 'poll-failed',
                        retryable: true
                    }));
                    setStatus('degraded');
                } finally {
                    pollActive = false;
                }
            };
            setStatus('connecting');
            tick();
            pollTimer = win.setInterval(tick, interval);
            record('subscription-open', { transport });
        };

        if (webSocketUrl && typeof win?.WebSocket === 'function') openWebSocket();
        else if (options.sseUrl && typeof win?.EventSource === 'function') startEventSource();
        else if (typeof options.poll === 'function') startPoll();
        else {
            setStatus('unavailable');
            record('subscription-skipped', { reason: 'no-compatible-adapter' });
        }
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            if (reconnectTimer !== null) win.clearTimeout(reconnectTimer);
            if (pollTimer !== null) win.clearInterval(pollTimer);
            if (socketAckTimer !== null) win.clearTimeout(socketAckTimer);
            eventSource?.close?.();
            eventSource = null;
            if (socket?.readyState === 1) {
                try {
                    socket.send(JSON.stringify({ id: subscriptionId, type: 'complete' }));
                } catch (_error) {
                    // The socket is closing; completion is best effort.
                }
            }
            if (socket?.readyState <= 1) socket.close(1000, 'FolderView Plus closed');
            socket = null;
            setStatus('closed');
            record('subscription-close', { transport });
        };
        options.signal?.addEventListener?.('abort', dispose, { once: true });
        dispose.snapshot = () => ({
            transport,
            status,
            reconnectCount,
            disposed
        });
        return dispose;
    };

    const buildDockerActionMutation = (action) => `
        mutation FVPlusDocker${action.charAt(0).toUpperCase()}${action.slice(1)}($id: PrefixedID!) {
            docker {
                ${action}(id: $id) { id names state status }
            }
        }
    `;
    const runDockerAction = async (request = {}, options = {}) => {
        const win = options.window || fallbackWindow;
        const requestedAction = String(request.action || '').trim().toLowerCase();
        const action = DOCKER_ACTIONS[requestedAction] || '';
        const container = String(request.containerId || request.container || '').trim();
        if (!action || !container) {
            return Promise.reject(new RuntimeTransportError('Docker action and container are required.', {
                category: 'invalid-action-request',
                retryable: false
            }));
        }
        if (typeof options.graphqlMutation === 'string' && options.graphqlMutation.trim()) {
            const data = await query(options.graphqlMutation, options.variables || { action, container }, {
                ...options,
                window: win,
                operation: `docker-${action}`
            });
            return { transport: 'graphql', data };
        }
        const useGraphql = options.forceGraphql === true || typeof win?.eventControl !== 'function';
        if (useGraphql) {
            const capabilities = options.capabilitySnapshot || await probeCapabilities({
                ...options,
                window: win
            });
            if (capabilities.mutation?.[action] !== true
                || !operationAcceptsArguments(capabilities.operations?.[action], { id: 'PrefixedID!' })) {
                throw new RuntimeTransportError(`Docker ${action} is unavailable through this Unraid API version.`, {
                    category: 'capability-unavailable',
                    retryable: false
                });
            }
            const data = await query(buildDockerActionMutation(action), { id: container }, {
                ...options,
                window: win,
                operation: `docker-${action}`
            });
            record('docker-action', { transport: 'graphql', action, ok: true });
            return { transport: 'graphql', data };
        }
        win.eventControl({ action: requestedAction, container }, options.refreshTarget || 'loadlist');
        record('docker-action', { transport: 'host-event-control', action: requestedAction, ok: true });
        return { transport: 'host-event-control' };
    };

    const DOCKER_MUTATION_OPERATIONS = Object.freeze({
        removeContainer: {
            document: `mutation FVPlusDockerRemove($id: PrefixedID!, $withImage: Boolean) {
                docker { removeContainer(id: $id, withImage: $withImage) }
            }`,
            variables: (request) => ({
                id: String(request.containerId || request.container || '').trim(),
                withImage: request.withImage === true
            })
        },
        updateContainer: {
            document: `mutation FVPlusDockerUpdate($id: PrefixedID!) {
                docker { updateContainer(id: $id) { id names state status } }
            }`,
            variables: (request) => ({
                id: String(request.containerId || request.container || '').trim()
            })
        },
        updateContainers: {
            document: `mutation FVPlusDockerUpdateMany($ids: [PrefixedID!]!) {
                docker { updateContainers(ids: $ids) { id names state status } }
            }`,
            variables: (request) => ({
                ids: (Array.isArray(request.containerIds) ? request.containerIds : [])
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
            })
        },
        updateAllContainers: {
            document: `mutation FVPlusDockerUpdateAll {
                docker { updateAllContainers { id names state status } }
            }`,
            variables: () => ({})
        },
        updateAutostartConfiguration: {
            document: `mutation FVPlusDockerAutostart(
                $entries: [DockerAutostartEntryInput!]!,
                $persistUserPreferences: Boolean
            ) {
                docker {
                    updateAutostartConfiguration(
                        entries: $entries,
                        persistUserPreferences: $persistUserPreferences
                    )
                }
            }`,
            variables: (request) => ({
                entries: (Array.isArray(request.entries) ? request.entries : []).map((entry) => ({
                    id: String(entry?.id || '').trim(),
                    autoStart: entry?.autoStart === true,
                    ...(Number.isFinite(Number(entry?.wait))
                        ? { wait: Math.max(0, Math.trunc(Number(entry.wait))) }
                        : {})
                })).filter((entry) => Boolean(entry.id)),
                persistUserPreferences: request.persistUserPreferences !== false
            })
        },
        refreshDockerDigests: {
            document: 'mutation FVPlusRefreshDockerDigests { refreshDockerDigests }',
            variables: () => ({})
        }
    });
    const DOCKER_MUTATION_ARGUMENTS = Object.freeze({
        removeContainer: { id: 'PrefixedID!', withImage: 'Boolean' },
        updateContainer: { id: 'PrefixedID!' },
        updateContainers: { ids: '[PrefixedID!]!' },
        updateAllContainers: {},
        updateAutostartConfiguration: { entries: '[DockerAutostartEntryInput!]!', persistUserPreferences: 'Boolean' },
        refreshDockerDigests: {}
    });
    const runDockerMutation = async (request = {}, options = {}) => {
        const win = options.window || fallbackWindow;
        const operation = String(request.operation || '').trim();
        const definition = DOCKER_MUTATION_OPERATIONS[operation];
        if (!definition) {
            throw new RuntimeTransportError('The requested Docker mutation is not supported.', {
                category: 'invalid-action-request',
                retryable: false
            });
        }
        const capabilities = options.capabilitySnapshot || await probeCapabilities({
            ...options,
            window: win
        });
        const available = operation === 'refreshDockerDigests'
            ? capabilities.rootMutation?.refreshDockerDigests === true
            : capabilities.mutation?.[operation] === true;
        if (!available || !operationAcceptsArguments(
            capabilities.operations?.[operation],
            DOCKER_MUTATION_ARGUMENTS[operation]
        )) {
            throw new RuntimeTransportError(`Docker ${operation} is unavailable through this Unraid API.`, {
                category: 'capability-unavailable',
                retryable: false
            });
        }
        const variables = definition.variables(request);
        if (
            ['removeContainer', 'updateContainer'].includes(operation)
            && !String(variables.id || '').trim()
        ) {
            throw new RuntimeTransportError('A Docker container identity is required.', {
                category: 'invalid-action-request',
                retryable: false
            });
        }
        if (operation === 'updateContainers' && variables.ids.length === 0) {
            throw new RuntimeTransportError('At least one Docker container identity is required.', {
                category: 'invalid-action-request',
                retryable: false
            });
        }
        if (operation === 'updateAutostartConfiguration' && variables.entries.length === 0) {
            throw new RuntimeTransportError('At least one Docker autostart entry is required.', {
                category: 'invalid-action-request',
                retryable: false
            });
        }
        const data = await query(definition.document, variables, {
            ...options,
            window: win,
            operation: `docker-${operation}`
        });
        record('docker-mutation', { transport: 'graphql', operation, ok: true });
        return { transport: 'graphql', operation, data };
    };

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
        diagnostics: () => diagnostics.map((entry) => ({ ...entry }))
    });
}));
