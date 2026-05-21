// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusNativeOrganizer = factory(root);
    root.FolderViewPlusNativeOrganizerModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root = {}) {
    let apiAvailable = null;
    let organizerSyncDone = false;

    const getCsrfToken = () => {
        const metaToken = root.document?.querySelector?.('meta[name="csrf-token"], meta[name="fv-request-token"]');
        const metaValue = String(metaToken?.content || '').trim();
        return metaValue || String(root.csrf_token || root.fv_request_token || '').trim();
    };

    const graphQL = async (query, variables = null) => {
        const response = await root.fetch('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrfToken()
            },
            credentials: 'same-origin',
            body: JSON.stringify(variables ? { query, variables } : { query })
        });
        if (!response.ok) {
            throw new Error(`GraphQL HTTP ${response.status}`);
        }
        const json = await response.json();
        if (Array.isArray(json?.errors) && json.errors.length > 0) {
            throw new Error(String(json.errors[0]?.message || 'GraphQL error'));
        }
        return json?.data || {};
    };

    const detectApi = async () => {
        if (apiAvailable !== null) {
            return apiAvailable;
        }
        if (typeof root.fetch !== 'function') {
            apiAvailable = false;
            return apiAvailable;
        }
        try {
            const data = await graphQL('{ info { os { release } cpu { cores } } }');
            apiAvailable = Boolean(data?.info?.os?.release);
            const cores = Number(data?.info?.cpu?.cores || 0);
            if (apiAvailable && Number.isFinite(cores) && cores > 0) {
                root.fvplusCpuCores = cores;
            }
        } catch (_error) {
            apiAvailable = false;
        }
        return apiAvailable;
    };

    const getFolderContainerNames = (folder) => {
        const source = folder?.containers && typeof folder.containers === 'object'
            ? folder.containers
            : (folder?.runtimeContainers && typeof folder.runtimeContainers === 'object' ? folder.runtimeContainers : {});
        return Object.keys(source).filter((name) => String(name || '').trim() !== '');
    };

    const syncDockerOrganizer = async (folders = {}, options = {}) => {
        if (organizerSyncDone && options.force !== true) {
            return { ok: true, skipped: true, reason: 'already_synced', created: 0, updated: 0 };
        }
        organizerSyncDone = true;
        const available = await detectApi();
        if (!available) {
            return { ok: false, skipped: true, reason: 'graphql_unavailable', created: 0, updated: 0 };
        }

        try {
            const data = await graphQL('{ docker { organizer { views { id flatEntries { id type name childrenIds } } } } }');
            const views = Array.isArray(data?.docker?.organizer?.views) ? data.docker.organizer.views : [];
            if (views.length <= 0) {
                return { ok: true, skipped: true, reason: 'no_organizer_views', created: 0, updated: 0 };
            }

            const entries = Array.isArray(views[0]?.flatEntries) ? views[0].flatEntries : [];
            const organizerFoldersByName = {};
            const organizerEntryIdsByName = {};
            for (const entry of entries) {
                const name = String(entry?.name || '').trim();
                if (!name) {
                    continue;
                }
                if (entry?.type === 'folder' || entry?.type === 'group') {
                    if (!organizerFoldersByName[name]) {
                        organizerFoldersByName[name] = entry;
                    }
                } else {
                    organizerEntryIdsByName[name] = entry.id;
                }
            }

            const seenNames = new Set();
            let created = 0;
            let updated = 0;
            for (const [, folder] of Object.entries(folders && typeof folders === 'object' ? folders : {})) {
                const name = String(folder?.name || '').trim();
                if (!name || seenNames.has(name)) {
                    continue;
                }
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
                            { fid: existing.id, cids: childIds }
                        );
                        updated++;
                    }
                } else {
                    await graphQL(
                        'mutation($n: String!, $ids: [String!]) { createDockerFolderWithItems(name: $n, sourceEntryIds: $ids) { version } }',
                        { n: name, ids: childIds }
                    );
                    created++;
                }
            }

            return { ok: true, skipped: false, reason: '', created, updated, source: String(options.source || '') };
        } catch (error) {
            return {
                ok: false,
                skipped: true,
                reason: String(error?.message || error || 'organizer_sync_failed'),
                created: 0,
                updated: 0
            };
        }
    };

    const resetDockerOrganizerSync = () => {
        organizerSyncDone = false;
    };

    const getStatus = () => ({
        apiAvailable,
        organizerSyncDone,
        hasFetch: typeof root.fetch === 'function'
    });

    return {
        detectApi,
        graphQL,
        syncDockerOrganizer,
        resetDockerOrganizerSync,
        getStatus,
        getFolderContainerNames
    };
}));
