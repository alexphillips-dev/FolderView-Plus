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
    const hostAdapter = window.FolderViewPlusRuntimeHostAdapters.getOrCreate('docker', { window, document });

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
        hostAdapter,
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
        exerciseHostAdapters: () => {
            const vmShell = document.createElement('section');
            vmShell.innerHTML = '<table id="kvm_table"><thead><tr><th>Name</th></tr></thead><tbody id="kvm_list"><tr class="sortable" data-name="fixture-vm"><td class="vm-name">Fixture VM</td></tr></tbody></table>';
            document.body.appendChild(vmShell);
            const vmAdapter = window.FolderViewPlusRuntimeHostAdapters.createHostAdapter('vm', { window, document });
            const vmStructure = vmAdapter.ensureStructure({ throwOnError: false });
            const vmSnapshot = vmAdapter.getSnapshot();
            vmShell.remove();

            const calls = [];
            const hookWindow = {
                document,
                loadlist: (...args) => calls.push(['original', ...args])
            };
            const hookAdapter = window.FolderViewPlusRuntimeHostAdapters.createHostAdapter('docker', {
                window: hookWindow,
                document
            });
            const firstWrapper = hookAdapter.wrapHook('loadlist', ({ args, invokeOriginal }) => {
                calls.push(['first-handler', ...args]);
                return invokeOriginal(...args);
            }, { legacyAlias: 'loadlist_original' });
            const secondWrapper = hookAdapter.wrapHook('loadlist', ({ args, invokeOriginal }) => {
                calls.push(['second-handler', ...args]);
                return invokeOriginal(...args);
            }, { legacyAlias: 'loadlist_original' });
            hookWindow.loadlist('refresh');
            const hookSnapshot = hookAdapter.getSnapshot();
            hookAdapter.restoreHook('loadlist');
            return {
                dockerSnapshot: hostAdapter.getSnapshot(),
                dockerNames: hostAdapter.queryRows('item').map((row) => hostAdapter.getRowIdentity(row)),
                vmStructure,
                vmSnapshot,
                hookSnapshot,
                wrapperReused: firstWrapper === secondWrapper,
                restored: hookWindow.loadlist === hookWindow.loadlist_original,
                calls
            };
        },
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
            const lifecycleHostAdapter = window.FolderViewPlusRuntimeHostAdapters.createHostAdapter('docker', {
                window: fixtureWindow,
                document
            });
            const reconcile = window.FolderViewPlusDockerRuntimeReconcile.createApi({
                window: fixtureWindow,
                document,
                refreshDockerRuntimeStateInPlace: async () => {
                    lifecycleRefreshes += 1;
                    return true;
                },
                waitForDockerRenderFrame: async () => {},
                appendDockerBulkUpdateTrace: () => true,
                getDockerHostGuardsApi: () => ({
                    wrapHostHook: (name, handler, options = {}) => lifecycleHostAdapter.wrapHook(name, handler, options)
                })
            });
            reconcile.bindLifecycleEventControlPatch();
            fixtureWindow.eventControl({ action: 'start', container: 'plex' }, 'loadlist');
            const callbackName = calls[0]?.[1] || '';
            fixtureWindow[callbackName]?.();
            await new Promise((resolve) => setTimeout(resolve, 40));
            return {
                callbackName,
                lifecycleRefreshes,
                calls: calls.length,
                adapterSnapshot: lifecycleHostAdapter.getSnapshot()
            };
        }
    };
})();
