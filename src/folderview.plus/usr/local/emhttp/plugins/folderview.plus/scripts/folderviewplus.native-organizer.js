// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    root.FolderViewPlusNativeOrganizer = factory(root);
    root.FolderViewPlusNativeOrganizerModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root = {}) {
    const NATIVE_ORGANIZER_STATUS_STORAGE_KEY = 'fv.native.organizer.status.v1';
    const STATUS_SCHEMA_VERSION = 2;
    const SAFE_SOURCES = new Set(['detect', 'docker-page', 'dashboard-page', 'settings', 'diagnostics']);
    const SAFE_REASONS = new Set([
        '',
        'already_synced',
        'base_api_unavailable',
        'organizer_unavailable',
        'organizer_unsupported',
        'capability_available',
        'no_organizer_views',
        'sync_failed'
    ]);
    const SAFE_FAILURE_CATEGORIES = new Set([
        '',
        'fetch_unavailable',
        'network',
        'authentication',
        'endpoint_unavailable',
        'http_error',
        'schema_unsupported',
        'graphql_error',
        'invalid_response',
        'aborted',
        'unknown'
    ]);
    let apiAvailable = null;
    let organizerApiAvailable = null;
    let organizerSyncDone = false;
    let lastStatus = null;

    const normalizeSource = (value) => {
        const source = String(value || '').trim().toLowerCase();
        return SAFE_SOURCES.has(source) ? source : 'detect';
    };

    const normalizeFailureCategory = (value) => {
        const category = String(value || '').trim().toLowerCase();
        return SAFE_FAILURE_CATEGORIES.has(category) ? category : 'unknown';
    };

    const normalizeFailureStage = (value) => {
        const stage = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48);
        return stage || 'unknown';
    };

    const sanitizeFailure = (error, stage = 'unknown') => {
        const message = String(error?.message || error || '').trim().toLowerCase();
        const statusMatch = message.match(/(?:graphql\s+http|http)\s+(\d{3})/i);
        const rawStatus = Number(error?.httpStatus || error?.status || statusMatch?.[1] || 0);
        const httpStatus = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 0;
        let failureCategory = normalizeFailureCategory(error?.failureCategory || '');
        if (!error?.failureCategory) {
            if (typeof root.fetch !== 'function' || /fetch is unavailable/.test(message)) failureCategory = 'fetch_unavailable';
            else if (error?.name === 'AbortError' || /\babort(?:ed)?\b/.test(message)) failureCategory = 'aborted';
            else if (httpStatus === 401 || httpStatus === 403 || /unauthori[sz]ed|forbidden|authentication|permission denied/.test(message)) failureCategory = 'authentication';
            else if (httpStatus === 404) failureCategory = 'endpoint_unavailable';
            else if (httpStatus > 0) failureCategory = 'http_error';
            else if (/cannot query field|unknown field|does not exist on type|schema/.test(message)) failureCategory = 'schema_unsupported';
            else if (/invalid json|unexpected token|invalid response|response shape/.test(message)) failureCategory = 'invalid_response';
            else if (/failed to fetch|network|load failed|connection|offline/.test(message)) failureCategory = 'network';
            else if (/graphql/.test(message)) failureCategory = 'graphql_error';
            else failureCategory = 'unknown';
        }
        return {
            failureCategory,
            failureStage: normalizeFailureStage(error?.failureStage || stage),
            httpStatus
        };
    };

    const createFailure = (failureCategory, failureStage, httpStatus = 0) => {
        const error = new Error(normalizeFailureCategory(failureCategory));
        error.failureCategory = normalizeFailureCategory(failureCategory);
        error.failureStage = normalizeFailureStage(failureStage);
        error.httpStatus = Number(httpStatus) || 0;
        return error;
    };

    const writeStatus = (status = {}) => {
        const reasonInput = String(status.reason || '').trim().toLowerCase();
        const reason = SAFE_REASONS.has(reasonInput) ? reasonInput : (status.ok === false ? 'sync_failed' : '');
        const failure = status.failureCategory
            ? sanitizeFailure(status, status.failureStage || 'unknown')
            : { failureCategory: '', failureStage: '', httpStatus: 0 };
        lastStatus = {
            schemaVersion: STATUS_SCHEMA_VERSION,
            checkedAt: new Date().toISOString(),
            apiAvailable,
            organizerApiAvailable,
            organizerSyncDone,
            hasFetch: typeof root.fetch === 'function',
            ok: status.ok === true,
            skipped: status.skipped === true,
            requested: status.requested === true,
            source: normalizeSource(status.source),
            reason,
            failureCategory: failure.failureCategory,
            failureStage: failure.failureStage,
            httpStatus: failure.httpStatus,
            created: Math.max(0, Number(status.created) || 0),
            updated: Math.max(0, Number(status.updated) || 0)
        };
        try {
            root.localStorage?.setItem?.(NATIVE_ORGANIZER_STATUS_STORAGE_KEY, JSON.stringify(lastStatus));
        } catch (_error) {
            // Status persistence is diagnostic-only; sync behavior must not depend on localStorage.
        }
        return lastStatus;
    };

    const getCsrfToken = () => {
        const metaToken = root.document?.querySelector?.('meta[name="csrf-token"], meta[name="fv-request-token"]');
        const metaValue = String(metaToken?.content || '').trim();
        return metaValue || String(root.csrf_token || root.fv_request_token || '').trim();
    };

    const graphQL = async (query, variables = null, options = {}) => {
        const stage = normalizeFailureStage(options.stage || 'graphql');
        if (typeof root.fetch !== 'function') {
            throw createFailure('fetch_unavailable', stage);
        }
        if (root.FolderViewPlusRuntimeTransport?.query) {
            try {
                return await root.FolderViewPlusRuntimeTransport.query(query, variables, {
                    headers: { 'X-CSRF-Token': getCsrfToken() }
                });
            } catch (error) {
                const failure = sanitizeFailure(error, stage);
                throw createFailure(failure.failureCategory, failure.failureStage, failure.httpStatus);
            }
        }
        let response;
        try {
            response = await root.fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                credentials: 'same-origin',
                body: JSON.stringify(variables ? { query, variables } : { query })
            });
        } catch (error) {
            const failure = sanitizeFailure(error, stage);
            throw createFailure(failure.failureCategory === 'unknown' ? 'network' : failure.failureCategory, stage);
        }
        if (!response.ok) {
            const category = response.status === 401 || response.status === 403
                ? 'authentication'
                : (response.status === 404 ? 'endpoint_unavailable' : 'http_error');
            throw createFailure(category, stage, response.status);
        }
        let json;
        try {
            json = await response.json();
        } catch (_error) {
            throw createFailure('invalid_response', stage);
        }
        if (Array.isArray(json?.errors) && json.errors.length > 0) {
            const failure = sanitizeFailure(new Error(String(json.errors[0]?.message || 'GraphQL error')), stage);
            throw createFailure(failure.failureCategory, stage);
        }
        if (!json || typeof json !== 'object' || !Object.prototype.hasOwnProperty.call(json, 'data')) {
            throw createFailure('invalid_response', stage);
        }
        return json.data || {};
    };

    const resetCapabilityCache = () => {
        apiAvailable = null;
        organizerApiAvailable = null;
    };

    const detectApi = async (options = {}) => {
        if (options.force === true) resetCapabilityCache();
        if (apiAvailable !== null) return apiAvailable;
        const source = normalizeSource(options.source || 'detect');
        const requested = options.requested === true;
        try {
            const data = await graphQL('{ info { os { release } cpu { cores } } }', null, { stage: 'base_api_probe' });
            apiAvailable = Boolean(data?.info?.os?.release);
            if (!apiAvailable) throw createFailure('invalid_response', 'base_api_probe');
            const cores = Number(data?.info?.cpu?.cores || 0);
            if (Number.isFinite(cores) && cores > 0) root.fvplusCpuCores = cores;
        } catch (error) {
            apiAvailable = false;
            organizerApiAvailable = false;
            const failure = sanitizeFailure(error, 'base_api_probe');
            writeStatus({
                ok: false,
                skipped: true,
                requested,
                source,
                reason: 'base_api_unavailable',
                ...failure
            });
        }
        return apiAvailable;
    };

    const detectOrganizerApi = async (options = {}) => {
        const source = normalizeSource(options.source || 'detect');
        const requested = options.requested === true;
        const baseAvailable = await detectApi(options);
        if (!baseAvailable) return false;
        if (organizerApiAvailable !== null) return organizerApiAvailable;
        try {
            const data = await graphQL(
                '{ docker { organizer { views { id } } } }',
                null,
                { stage: 'organizer_capability_probe' }
            );
            organizerApiAvailable = Boolean(
                data?.docker
                && Object.prototype.hasOwnProperty.call(data.docker, 'organizer')
            );
            if (!organizerApiAvailable) throw createFailure('schema_unsupported', 'organizer_capability_probe');
            writeStatus({
                ok: true,
                skipped: true,
                requested,
                source,
                reason: 'capability_available'
            });
        } catch (error) {
            organizerApiAvailable = false;
            const failure = sanitizeFailure(error, 'organizer_capability_probe');
            writeStatus({
                ok: false,
                skipped: true,
                requested,
                source,
                reason: failure.failureCategory === 'schema_unsupported' ? 'organizer_unsupported' : 'organizer_unavailable',
                ...failure
            });
        }
        return organizerApiAvailable;
    };

    const checkCapabilities = async (options = {}) => {
        await detectOrganizerApi({
            force: options.force === true,
            requested: options.requested === true,
            source: options.source || 'diagnostics'
        });
        return lastStatus || writeStatus({
            ok: organizerApiAvailable === true,
            skipped: true,
            requested: options.requested === true,
            source: options.source || 'diagnostics',
            reason: organizerApiAvailable === true ? 'capability_available' : 'organizer_unavailable'
        });
    };

    const getFolderContainerNames = (folder) => {
        const source = folder?.containers && typeof folder.containers === 'object'
            ? folder.containers
            : (folder?.runtimeContainers && typeof folder.runtimeContainers === 'object' ? folder.runtimeContainers : {});
        return Object.keys(source).filter((name) => String(name || '').trim() !== '');
    };

    const syncDockerOrganizer = async (folders = {}, options = {}) => {
        const source = normalizeSource(options.source);
        const requested = options.explicit === true || source === 'settings';
        if (options.force === true) {
            resetCapabilityCache();
            organizerSyncDone = false;
        }
        if (organizerSyncDone) {
            return writeStatus({ ok: true, skipped: true, requested, source, reason: 'already_synced' });
        }
        const available = await detectOrganizerApi({ force: false, requested, source });
        if (!available) return lastStatus;
        organizerSyncDone = true;

        try {
            const data = await graphQL(
                '{ docker { organizer { views { id flatEntries { id type name childrenIds } } } } }',
                null,
                { stage: 'organizer_read' }
            );
            const views = Array.isArray(data?.docker?.organizer?.views) ? data.docker.organizer.views : [];
            if (views.length <= 0) {
                return writeStatus({ ok: true, skipped: true, requested, source, reason: 'no_organizer_views' });
            }

            const entries = Array.isArray(views[0]?.flatEntries) ? views[0].flatEntries : [];
            const organizerFoldersByName = {};
            const organizerEntryIdsByName = {};
            for (const entry of entries) {
                const name = String(entry?.name || '').trim();
                if (!name) continue;
                if (entry?.type === 'folder' || entry?.type === 'group') {
                    if (!organizerFoldersByName[name]) organizerFoldersByName[name] = entry;
                } else {
                    organizerEntryIdsByName[name] = entry.id;
                }
            }

            const seenNames = new Set();
            let created = 0;
            let updated = 0;
            for (const [, folder] of Object.entries(folders && typeof folders === 'object' ? folders : {})) {
                const name = String(folder?.name || '').trim();
                if (!name || seenNames.has(name)) continue;
                seenNames.add(name);
                const childIds = getFolderContainerNames(folder)
                    .map((containerName) => organizerEntryIdsByName[containerName])
                    .filter(Boolean);
                const existing = organizerFoldersByName[name];
                if (existing) {
                    const current = new Set(Array.isArray(existing.childrenIds) ? existing.childrenIds : []);
                    const differs = current.size !== childIds.length || childIds.some((id) => !current.has(id));
                    if (differs) {
                        await graphQL(
                            'mutation($fid: String!, $cids: [String!]!) { setDockerFolderChildren(folderId: $fid, childrenIds: $cids) { version } }',
                            { fid: existing.id, cids: childIds },
                            { stage: 'organizer_update' }
                        );
                        updated++;
                    }
                } else {
                    await graphQL(
                        'mutation($n: String!, $ids: [String!]) { createDockerFolderWithItems(name: $n, sourceEntryIds: $ids) { version } }',
                        { n: name, ids: childIds },
                        { stage: 'organizer_create' }
                    );
                    created++;
                }
            }

            return writeStatus({ ok: true, skipped: false, requested, source, reason: '', created, updated });
        } catch (error) {
            const failure = sanitizeFailure(error, 'organizer_sync');
            return writeStatus({
                ok: false,
                skipped: true,
                requested,
                source,
                reason: 'sync_failed',
                ...failure
            });
        }
    };

    const getStatus = () => ({
        schemaVersion: STATUS_SCHEMA_VERSION,
        apiAvailable,
        organizerApiAvailable,
        organizerSyncDone,
        hasFetch: typeof root.fetch === 'function',
        last: lastStatus
    });

    return Object.freeze({
        NATIVE_ORGANIZER_STATUS_STORAGE_KEY,
        STATUS_SCHEMA_VERSION,
        detectApi,
        detectOrganizerApi,
        checkCapabilities,
        graphQL,
        syncDockerOrganizer,
        resetCapabilityCache,
        sanitizeFailure,
        getStatus,
        getFolderContainerNames
    });
}));
