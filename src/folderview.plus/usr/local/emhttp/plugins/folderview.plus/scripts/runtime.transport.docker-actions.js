// @ts-check
(function runtimeTransportDockerActionsModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.transportDockerActions = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function runtimeTransportDockerActionsFactory() {
    'use strict';

    const DOCKER_ACTIONS = Object.freeze({
        start: 'start',
        stop: 'stop',
        restart: 'restart',
        pause: 'pause',
        resume: 'unpause',
        unpause: 'unpause'
    });

    const createRuntime = (deps = {}) => {
        const fallbackWindow = deps.fallbackWindow || {};
        const RuntimeTransportError = deps.RuntimeTransportError;
        const operationAcceptsArguments = deps.operationAcceptsArguments;
        const probeCapabilities = deps.probeCapabilities;
        const query = deps.query;
        const record = typeof deps.record === 'function' ? deps.record : (() => {});
        if (typeof RuntimeTransportError !== 'function'
            || typeof operationAcceptsArguments !== 'function'
            || typeof probeCapabilities !== 'function'
            || typeof query !== 'function') {
            throw new Error('FolderView Plus Docker transport dependencies are unavailable.');
        }
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

        return Object.freeze({
            DOCKER_MUTATION_OPERATIONS,
            runDockerAction,
            runDockerMutation
        });
    };

    return Object.freeze({ createRuntime });
}));
