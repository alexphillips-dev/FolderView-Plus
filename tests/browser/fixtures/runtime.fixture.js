(() => {
    const folders = {
        media: { name: 'Media', status: { started: 1, stopped: 1, paused: 0, upToDate: true } },
        updates: { name: 'Updates', status: { started: 1, stopped: 0, paused: 0, upToDate: false } },
        empty: { name: 'Empty', status: { started: 0, stopped: 0, paused: 0, upToDate: true } }
    };
    const members = {
        media: { plex: {}, sonarr: {} },
        updates: { toolbox: {} },
        empty: {}
    };
    let prefs = { pageViewMode: 'folderview', hideEmptyFolders: false, health: { warnStoppedPercent: 60 } };
    const events = [];
    let refreshCount = 0;

    const normalizePrefs = (value = {}) => ({
        pageViewMode: ['host', 'command'].includes(String(value.pageViewMode || '')) ? value.pageViewMode : 'folderview',
        hideEmptyFolders: value.hideEmptyFolders === true,
        health: { warnStoppedPercent: Number(value.health?.warnStoppedPercent) || 60 }
    });
    const applyPrefs = (nextPrefs = prefs) => {
        const mode = normalizePrefs(nextPrefs).pageViewMode;
        document.body.dataset.fixtureView = mode;
        document.querySelectorAll('#docker_list > tr.folder').forEach((row) => {
            row.hidden = mode !== 'folderview';
        });
        document.querySelectorAll('#docker_list > tr:not(.folder)').forEach((row) => {
            row.hidden = mode === 'command';
        });
    };
    const api = window.FolderViewPlusDockerRuntimeActionBar.createApi({
        window,
        document,
        utils: { normalizePrefs },
        escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char])),
        normalizePageViewMode: (value) => ['host', 'command'].includes(String(value || '')) ? String(value) : 'folderview',
        resolvePageViewMode: (value) => normalizePrefs(value).pageViewMode,
        getPrefs: () => prefs,
        setPrefs: (value) => { prefs = normalizePrefs(value); },
        applyPrefs,
        savePrefs: async (patch, nextPrefs) => {
            events.push({ type: 'save-prefs', patch: { ...patch } });
            return normalizePrefs(nextPrefs);
        },
        refreshRuntimeView: async () => { refreshCount += 1; },
        getFolders: () => folders,
        getScopedContainers: (id) => members[id] || {},
        readFolderIdFromRow: (row) => String(row?.dataset?.folderId || ''),
        readFolderOwnerFromRow: (row) => String(row?.dataset?.folderOwner || ''),
        getFolderAncestors: () => [],
        getFolderDescendants: () => [],
        applyFocusedFolderState: () => {},
        getFocusedFolderId: () => '',
        clearFocusedFolder: () => events.push({ type: 'clear-focus' }),
        scheduleWidthReflow: () => {},
        buildFolderHierarchy: () => ({ parentById: { media: '', updates: '', empty: '' } }),
        expandFolderBranch: (id) => events.push({ type: 'expand', id }),
        collapseFolderBranch: (id) => events.push({ type: 'collapse', id }),
        createFolder: () => events.push({ type: 'create-folder' }),
        showError: (message) => events.push({ type: 'error', message })
    });
    applyPrefs(prefs);
    api.sync();

    window.fixtureRuntime = {
        api,
        events,
        getPrefs: () => ({ ...prefs }),
        getRefreshCount: () => refreshCount,
        syncRepeatedly: (count = 5) => {
            for (let index = 0; index < count; index += 1) api.sync();
        },
        exerciseLifecyclePatch: async () => {
            const calls = [];
            let lifecycleRefreshes = 0;
            const fixtureWindow = {
                document,
                setTimeout: (callback) => {
                    Promise.resolve().then(callback);
                    return 1;
                },
                clearTimeout: () => {},
                eventControl: (...args) => calls.push(args),
                addDockerContainerContext: () => ({})
            };
            const reconcile = window.FolderViewPlusDockerRuntimeReconcile.createApi({
                window: fixtureWindow,
                document,
                refreshDockerRuntimeStateInPlace: async () => {
                    lifecycleRefreshes += 1;
                    return true;
                },
                waitForDockerRenderFrame: async () => {},
                appendDockerBulkUpdateTrace: () => true
            });
            reconcile.bindLifecycleEventControlPatch();
            fixtureWindow.eventControl({ action: 'start', container: 'plex' }, 'loadlist');
            const callbackName = calls[0]?.[1] || '';
            fixtureWindow[callbackName]?.();
            await new Promise((resolve) => setTimeout(resolve, 40));
            return { callbackName, lifecycleRefreshes, calls: calls.length };
        }
    };
})();
