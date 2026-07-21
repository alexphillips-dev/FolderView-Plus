(() => {
    const $ = window.jQuery;
    const events = [];
    const originalInlineState = Object.freeze({
        audiobookshelf: { running: true, paused: false },
        paperless: { running: false, paused: false }
    });
    const hostRuntime = {
        audiobookshelf: {
            id: 'abc123def456',
            running: true,
            paused: false,
            info: { State: { Running: true, Paused: false, Autostart: true, Updated: true } }
        },
        paperless: {
            id: 'fed654cba321',
            running: false,
            paused: false,
            info: { State: { Running: false, Paused: false, Autostart: false, Updated: true } }
        }
    };
    let snapshotRuntime = structuredClone(hostRuntime);
    let staleRefreshBudget = 0;
    let nativeLoadlistCount = 0;
    let hostContextCallCount = 0;
    let quickRailController = null;
    const runtimeSurface = window.FolderViewPlusDashboardRuntimeSurface.createApi({
        window,
        document,
        $,
        translate: (key) => key
    });

    const metaFor = (entry = {}) => runtimeSurface.getRuntimeStateMeta('docker', entry);
    const findEntryById = (containerId) => Object.values(snapshotRuntime).find((entry) => entry.id === String(containerId || '')) || null;
    const findNameById = (containerId) => Object.keys(hostRuntime).find((name) => hostRuntime[name].id === String(containerId || '')) || '';
    const surfaceFor = (containerId) => {
        const control = document.getElementById(String(containerId || ''));
        return control ? control.parentElement : null;
    };
    const captureSurface = runtimeSurface.captureSurface;
    const restoreSurface = (surface) => runtimeSurface.restoreSurfaceIcons($(surface));
    const syncMember = (name) => {
        const entry = snapshotRuntime[name];
        const card = document.querySelector(`[data-fv-runtime-name="${name}"]`);
        if (!entry || !card) return;
        runtimeSurface.syncSurface('docker', $(card), entry);
    };
    const syncFolder = () => {
        const entries = Object.values(snapshotRuntime);
        const started = entries.filter((entry) => metaFor(entry).active).length;
        const folder = document.querySelector('#fixture-audiobooks-folder');
        const surface = folder.querySelector(':scope > span.outer');
        const icon = surface.querySelector('.folder-load-status-docker');
        const state = surface.querySelector('.folder-state-docker');
        const running = started > 0;
        surface.classList.remove('started', 'stopped');
        surface.classList.add(running ? 'started' : 'stopped');
        surface.dataset.fvRuntimeState = running ? 'running' : 'stopped';
        icon.className = `fa ${running ? 'fa-play started green-text' : 'fa-square stopped red-text'} folder-load-status-docker`;
        state.textContent = `${running ? started : entries.length}/${entries.length} ${running ? 'started' : 'stopped'}`;
    };
    const syncAll = () => {
        Object.keys(snapshotRuntime).forEach(syncMember);
        syncFolder();
        quickRailController?.applyDashboardStartedOnlyFilterForType('docker');
    };
    const refreshRuntime = async () => {
        if (staleRefreshBudget > 0) {
            staleRefreshBudget -= 1;
            events.push({ type: 'stale-refresh', remaining: staleRefreshBudget });
            return true;
        }
        snapshotRuntime = structuredClone(hostRuntime);
        syncAll();
        return true;
    };
    const isSettled = (request = {}) => {
        const entry = findEntryById(request.container);
        const meta = entry ? metaFor(entry) : null;
        if (!meta) return false;
        if (request.action === 'stop') return !meta.active;
        if (request.action === 'pause') return meta.active && meta.paused;
        return meta.active && !meta.paused;
    };

    window.loadlist = () => {
        nativeLoadlistCount += 1;
        snapshotRuntime = structuredClone(hostRuntime);
        syncAll();
        events.push({ type: 'native-loadlist' });
    };
    window.addDockerContainerContext = (name, _image, _template, running, paused, _update, _autostart, ...rest) => {
        hostContextCallCount += 1;
        const containerId = String(rest[3] || hostRuntime[name]?.id || '');
        const menu = document.querySelector('#fixture-context-menu');
        const actions = running
            ? (paused ? ['resume', 'stop', 'restart'] : ['stop', 'pause', 'restart'])
            : ['start'];
        menu.replaceChildren(...actions.map((action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.role = 'menuitem';
            button.dataset.action = action;
            button.textContent = action[0].toUpperCase() + action.slice(1);
            button.addEventListener('click', () => {
                menu.hidden = true;
                window.eventControl({ action, container: containerId }, 'loadlist');
            });
            return button;
        }));
        menu.hidden = false;
        events.push({ type: 'context', name, running, paused, actions });
        return actions;
    };
    window.eventControl = (params, callbackName) => {
        const request = { action: String(params?.action || '').toLowerCase(), container: String(params?.container || '') };
        const surface = surfaceFor(request.container);
        surface?.querySelectorAll('i').forEach((icon) => {
            icon.classList.remove('fa-play', 'fa-square', 'fa-pause');
            icon.classList.add('fa-refresh', 'fa-spin');
        });
        const name = findNameById(request.container);
        window.setTimeout(() => {
            const entry = hostRuntime[name];
            if (entry) {
                const running = !['stop'].includes(request.action);
                const paused = request.action === 'pause';
                entry.running = running;
                entry.paused = paused;
                entry.info.State.Running = running;
                entry.info.State.Paused = paused;
            }
            events.push({ type: 'host-action-complete', ...request });
            if (typeof window[callbackName] === 'function') window[callbackName]();
        }, 12);
    };

    const hostAdapter = window.FolderViewPlusRuntimeHostAdapters.createHostAdapter('docker', { window, document });
    const reconcile = window.FolderViewPlusDockerRuntimeReconcile.createApi({
        window,
        document,
        refreshDockerRuntimeStateInPlace: refreshRuntime,
        getDockerRuntimeContainerInfo: (name) => snapshotRuntime[name] || null,
        isDockerLifecycleStateSettled: isSettled,
        prepareDockerLifecycleSurface: captureSurface,
        getDockerLifecycleStateSnapshot: (request) => {
            const entry = findEntryById(request.container);
            const meta = entry ? metaFor(entry) : null;
            return meta ? { state: meta.state, active: meta.active, paused: meta.paused } : null;
        },
        finalizeDockerLifecycleSurface: (request, outcome) => {
            const surface = surfaceFor(request.container);
            restoreSurface(surface);
            const name = findNameById(request.container);
            if (snapshotRuntime[name]) syncMember(name);
            syncFolder();
            quickRailController?.applyDashboardStartedOnlyFilterForType('docker');
            events.push({ type: 'finalize', action: request.action, ...outcome });
            if (!outcome.settled) window.setTimeout(() => window.loadlist(), 0);
        },
        appendDockerBulkUpdateTrace: (eventType, details) => events.push({ type: 'trace', eventType, details }),
        getDockerHostGuardsApi: () => ({
            wrapHostHook: (name, handler, options = {}) => hostAdapter.wrapHook(name, handler, options)
        }),
        lifecycleRefreshCallbackName: '__fvplusDashboardFixtureLifecycleRefresh',
        lifecycleRefreshDelaysMs: [0, 15, 30]
    });
    reconcile.bindLifecycleEventControlPatch();
    reconcile.bindDockerContainerContextStatePatch();
    reconcile.bindLifecycleEventControlPatch();
    reconcile.bindDockerContainerContextStatePatch();

    quickRailController = window.FolderViewPlusDashboardLayoutQuickRail.createController({
        window,
        $,
        ui: window.FolderViewPlusUI,
        normalizeDashboardPrefsForType: () => ({ layout: 'classic', expandToggle: true, greyscale: false, folderLabel: true }),
        isDashboardPrefsHydratedForType: () => true,
        isDashboardRenderCompleteForType: () => true,
        getDashboardStartedOnlySelectorForType: () => '#apps',
        isDashboardStartedOnlyEnabledForType: () => document.querySelector('#apps').checked,
        readDashboardHealthEmphasisStateForType: () => false,
        readDashboardCompactDensityStateForType: () => false,
        resolveFolderIdFromCard: () => 'audiobooks',
        updateExpandToggleIcon: () => {},
        onLayoutCycle: async () => ({ ok: true }),
        onToggleExpandAll: () => {},
        onSetStartedOnlyEnabled: (_type, enabled) => {
            document.querySelector('#apps').checked = enabled;
            quickRailController.applyDashboardStartedOnlyFilterForType('docker');
        },
        onToggleHealthEmphasis: () => {},
        onToggleDensity: () => {},
        onResetView: () => {},
        onOpenSettings: () => {},
        onLayoutTelemetry: () => {}
    });
    quickRailController.bindDashboardQuickActionSyncHandlers();
    quickRailController.applyDashboardStartedOnlyFilterForType('docker');

    const openContext = (name = 'audiobookshelf') => {
        const inline = originalInlineState[name];
        const entry = hostRuntime[name];
        return window.addDockerContainerContext(
            name,
            'image',
            'template',
            inline.running,
            inline.paused,
            0,
            entry.info.State.Autostart,
            'webui',
            '',
            'bash',
            entry.id
        );
    };
    document.querySelector('#fixture-audiobookshelf-card').addEventListener('click', (event) => {
        if (event.target.closest('#fixture-context-menu')) return;
        openContext('audiobookshelf');
    });
    document.querySelector('#apps').addEventListener('change', () => quickRailController.applyDashboardStartedOnlyFilterForType('docker'));
    syncAll();

    window.fixtureDashboardLifecycle = {
        events,
        openContext,
        setStaleRefreshBudget: (count) => { staleRefreshBudget = Math.max(0, Number(count) || 0); },
        getSnapshot: () => ({
            host: structuredClone(hostRuntime),
            snapshot: structuredClone(snapshotRuntime),
            nativeLoadlistCount,
            hostContextCallCount,
            menuActions: [...document.querySelectorAll('#fixture-context-menu [data-action]')].map((button) => button.dataset.action),
            memberState: document.querySelector('#fixture-audiobookshelf-card').dataset.fvRuntimeState,
            memberIconClasses: document.querySelector('#load-abc123def456').className,
            busyIconCount: document.querySelectorAll('#fixture-audiobookshelf-card i.fa-spin, #fixture-audiobookshelf-card i.fa-spinner, #fixture-audiobookshelf-card i.fa-circle-o-notch').length,
            folderState: document.querySelector('#fixture-audiobooks-folder > span.outer').dataset.fvRuntimeState,
            folderText: document.querySelector('.folder-state-docker').textContent,
            folderHidden: document.querySelector('#fixture-audiobooks-folder').classList.contains('fv-dashboard-started-only-hidden'),
            memberHidden: document.querySelector('#fixture-audiobookshelf-card').classList.contains('fv-dashboard-started-only-hidden'),
            hookSnapshot: hostAdapter.getSnapshot()
        })
    };
})();
