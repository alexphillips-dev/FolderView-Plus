// @ts-check
(function dockerRuntimeCapabilitiesModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerRuntimeCapabilities = factory();
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeCapabilitiesFactory() {
    'use strict';

    const emptySnapshot = (state = 'unavailable') => Object.freeze({
        state,
        endpointAvailable: false,
        query: Object.freeze({ containers: false, dockerContainers: false })
    });
    const supportsCapabilityPath = (snapshot = {}, path = '') => {
        const normalized = String(path || '').trim();
        const aliases = {
            'query.containers': snapshot?.query?.containers === true || snapshot?.query?.dockerContainers === true,
            'query.container': snapshot?.query?.container === true,
            'query.portConflicts': snapshot?.query?.portConflicts === true,
            'query.logs': snapshot?.query?.logs === true,
            'subscription.dockerContainerStats': snapshot?.subscription?.dockerContainerStats === true,
            'mutation.refreshDockerDigests': snapshot?.rootMutation?.refreshDockerDigests === true
        };
        if (Object.prototype.hasOwnProperty.call(aliases, normalized)) return aliases[normalized];
        const [scope, name] = normalized.split('.', 2);
        return ['mutation', 'query', 'subscription'].includes(scope)
            && snapshot?.[scope]?.[name] === true;
    };
    const createAccessors = (getSnapshot, isReady = () => true) => {
        const getCapabilities = () => getSnapshot?.() || {};
        return Object.freeze({
            getCapabilities,
            getCapabilitySnapshot: getCapabilities,
            supports: (path) => isReady() === true && supportsCapabilityPath(getCapabilities(), path)
        });
    };
    const buildCompatibilityEvidence = (snapshot) => snapshot ? {
        endpointAvailable: snapshot.endpointAvailable === true,
        apiVersion: String(snapshot.apiVersion || 'unknown'),
        unraidVersion: String(snapshot.unraidVersion || 'unknown'),
        queryContainers: snapshot.query?.containers === true || snapshot.query?.dockerContainers === true,
        queryShape: String(snapshot.query?.shape || 'unknown'),
        queryCapabilities: {
            targetedContainer: snapshot.query?.container === true,
            networks: snapshot.query?.networks === true,
            portConflicts: snapshot.query?.portConflicts === true,
            logs: snapshot.query?.logs === true,
            updateStatuses: snapshot.query?.containerUpdateStatuses === true
        },
        mutations: {
            start: snapshot.mutation?.start === true,
            stop: snapshot.mutation?.stop === true,
            restart: snapshot.mutation?.restart === true,
            pause: snapshot.mutation?.pause === true,
            unpause: snapshot.mutation?.unpause === true,
            removeContainer: snapshot.mutation?.removeContainer === true,
            updateContainer: snapshot.mutation?.updateContainer === true,
            updateContainers: snapshot.mutation?.updateContainers === true,
            updateAllContainers: snapshot.mutation?.updateAllContainers === true,
            updateAutostartConfiguration: snapshot.mutation?.updateAutostartConfiguration === true,
            refreshDockerDigests: snapshot.rootMutation?.refreshDockerDigests === true
        },
        subscriptions: { dockerContainerStats: snapshot.subscription?.dockerContainerStats === true },
        organizer: {
            query: snapshot.organizer?.query === true,
            mutation: snapshot.organizer?.mutation === true,
            policy: 'detect-only'
        },
        lastErrorCategory: snapshot.lastErrorCategory || null
    } : {};

    return Object.freeze({ emptySnapshot, supportsCapabilityPath, createAccessors, buildCompatibilityEvidence });
}));
