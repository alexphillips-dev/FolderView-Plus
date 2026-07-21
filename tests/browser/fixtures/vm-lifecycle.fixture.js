(() => {
    const $ = window.jQuery;
    const events = [];
    const hostRuntime = { name: 'Test VM', uuid: 'vm-1', state: 'running', autostart: true };
    const runtime = { ...hostRuntime };
    let nativeLoadlistCount = 0;
    let contextCallCount = 0;
    let staleRefreshBudget = 0;

    const meta = () => {
        if (runtime.state === 'running') return { key: 'started', icon: 'fa-play', className: 'started', color: 'green-text' };
        if (['paused', 'pmsuspended', 'unknown'].includes(runtime.state)) return { key: 'paused', icon: 'fa-pause', className: 'paused', color: 'orange-text' };
        return { key: 'stopped', icon: 'fa-square', className: 'stopped', color: 'red-text' };
    };
    const syncRuntime = () => {
        const current = meta();
        const row = document.querySelector('#fixture-vm-row');
        const surface = row.querySelector('span.outer');
        const icon = row.querySelector('#load-vm-1');
        const state = row.querySelector('.state');
        row.dataset.fvRuntimeState = runtime.state;
        surface.dataset.fvRuntimeState = runtime.state;
        surface.classList.remove('started', 'paused', 'stopped');
        surface.classList.add(current.className);
        icon.className = `fa ${current.icon} ${current.className} ${current.color}`;
        icon.removeAttribute('aria-busy');
        state.className = `state ${current.className}`;
        state.textContent = ` ${current.key}`;
        const folderIcon = document.querySelector('#load-folder-media');
        folderIcon.className = `fa ${current.icon} ${current.className} ${current.color} folder-load-status`;
        document.querySelector('.folder-state').textContent = `1/1 ${current.key}`;
    };
    const setHostState = (action) => {
        if (['domain-stop', 'domain-destroy'].includes(action)) hostRuntime.state = 'shutoff';
        else if (action === 'domain-pause') hostRuntime.state = 'paused';
        else if (action === 'domain-pmsuspend') hostRuntime.state = 'pmsuspended';
        else hostRuntime.state = 'running';
    };
    const renderContext = (state) => {
        const actions = state === 'running'
            ? ['domain-stop', 'domain-pause', 'domain-restart']
            : (['paused', 'unknown'].includes(state)
                ? ['domain-resume', 'domain-destroy']
                : (state === 'pmsuspended' ? ['domain-pmwakeup', 'domain-destroy'] : ['domain-start']));
        const menu = document.querySelector('#fixture-context-menu');
        menu.replaceChildren(...actions.map((action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = action;
            button.textContent = action;
            button.addEventListener('click', () => {
                menu.hidden = true;
                window.ajaxVMDispatch({ action, uuid: 'vm-1' }, 'loadlist');
            });
            return button;
        }));
        menu.hidden = false;
        return actions;
    };

    window.loadlist = () => {
        nativeLoadlistCount += 1;
        Object.assign(runtime, hostRuntime);
        syncRuntime();
    };
    window.ajaxVMDispatch = (params, callbackName) => {
        document.querySelectorAll('#fixture-vm-row i').forEach((icon) => {
            icon.classList.remove('fa-play', 'fa-square', 'fa-pause');
            icon.classList.add('fa-refresh', 'fa-spin');
        });
        window.setTimeout(() => {
            setHostState(String(params?.action || '').toLowerCase());
            events.push({ type: 'host-action-complete', action: params.action, callbackName });
            window[callbackName]?.();
        }, 12);
    };
    window.ajaxVMDispatchconsole = window.ajaxVMDispatch;
    window.ajaxVMDispatchconsoleRV = window.ajaxVMDispatch;
    window.addVMContext = (_name, _uuid, _template, state) => {
        contextCallCount += 1;
        events.push({ type: 'context', state });
        return renderContext(state);
    };

    const hostAdapter = window.FolderViewPlusRuntimeHostAdapters.createHostAdapter('vm', { window, document });
    const lifecycle = window.FolderViewPlusVmRuntimeLifecycle.createApi({
        window,
        document,
        $,
        hostAdapter,
        delaysMs: [0, 15, 30],
        getRuntimeEntry: () => runtime,
        getSurfaces: () => [document.querySelector('#fixture-vm-row')],
        refreshRuntimeStateInPlace: async () => {
            if (staleRefreshBudget > 0) {
                staleRefreshBudget -= 1;
                return true;
            }
            Object.assign(runtime, hostRuntime);
            syncRuntime();
            return true;
        },
        syncRuntimeState: syncRuntime,
        queueNativeRefresh: window.loadlist
    });
    lifecycle.bind();
    syncRuntime();

    const openContext = () => window.addVMContext('Test VM', 'vm-1', 'Custom', 'running');
    document.querySelector('#fixture-vm-row').addEventListener('click', (event) => {
        if (event.target.closest('#fixture-context-menu')) return;
        openContext();
    });

    window.fixtureVmLifecycle = {
        lifecycle,
        events,
        openContext,
        setStaleRefreshBudget: (count) => { staleRefreshBudget = Math.max(0, Number(count) || 0); },
        getSnapshot: () => ({
            hostState: hostRuntime.state,
            runtimeState: runtime.state,
            nativeLoadlistCount,
            contextCallCount,
            menuActions: Array.from(document.querySelectorAll('#fixture-context-menu [data-action]')).map((button) => button.dataset.action),
            memberIconClasses: document.querySelector('#load-vm-1').className,
            consoleIconClasses: document.querySelector('#fixture-console-icon').className,
            menuIconClasses: document.querySelector('#fixture-menu-icon').className,
            busyIconCount: document.querySelectorAll('#fixture-vm-row .fa-spin, #fixture-vm-row .fa-spinner, #fixture-vm-row .fa-circle-o-notch').length,
            folderText: document.querySelector('.folder-state').textContent,
            lifecycle: lifecycle.getSnapshot(),
            hostAdapter: hostAdapter.getSnapshot()
        })
    };
})();
