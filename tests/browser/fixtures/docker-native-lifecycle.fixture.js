(function () {
    const $ = window.jQuery;
    const model = window.FolderViewPlusDockerContainerModel;
    const coordinator = window.FolderViewPlusFoundationModules.dockerApiCoordinator;
    const id = 'abcdef123456' + '0'.repeat(52);
    const nativeId = id.slice(0, 12);
    const row = document.getElementById(nativeId).closest('tr');
    const icon = document.getElementById(`load-${nativeId}`);
    const menu = document.getElementById('fixture-menu');
    const scenario = new URLSearchParams(location.search).get('scenario') || 'native';
    const traces = [];
    const requests = [];
    let state = 'running';
    let menuOpens = 0;
    let hostReloads = 0;
    let preview = null;
    let runtimeMap = {
        'fixture-app': coordinator.mergeContainerIntoRuntimeEntry({
            shortId: nativeId,
            info: { Id: id, Name: 'fixture-app', State: { Running: true, Paused: false } }
        }, { id: `server:${id}`, name: 'fixture-app', shortId: id, state: 'running' })
    };
    if (scenario === 'canonical') row.id = 'ct-fixture-app';
    if (scenario === 'expanded') row.classList.add('folder-element');
    if (scenario === 'name-only') document.getElementById(nativeId).removeAttribute('id');
    if (scenario === 'collapsed') {
        const folderRow = document.createElement('tr');
        folderRow.className = 'folder folder-id-fixture';
        folderRow.innerHTML = '<td><div class="folder-storage" hidden></div><div class="folder-preview"></div></td>';
        row.before(folderRow);
        folderRow.querySelector('.folder-storage').append(row);
        preview = $(row).find('span.outer').clone();
        preview.find('[id]').removeAttr('id');
        preview.attr('data-fv-container-id', nativeId).attr('data-fv-container-name', 'fixture-app');
        preview.find('span.hand').attr('aria-label', 'Open preview menu');
        $(folderRow).find('.folder-preview').append(preview);
    }
    const actionsApi = window.FolderViewPlusDockerPreviewActions.createApi({ window, document, $ });
    const renderEntry = () => ({
        ...runtimeMap['fixture-app'],
        name: 'fixture-app',
        state: runtimeMap['fixture-app'].info.State.Running,
        pause: runtimeMap['fixture-app'].info.State.Paused
    });
    const sync = () => {
        const entries = { 'fixture-app': renderEntry() };
        actionsApi.syncDockerRuntimeRows(entries, new Set(['fixture-app']));
        if (preview) {
            actionsApi.syncDockerLeafFolderPreviewActions('fixture', { settings: { preview: 1, context: 1 } }, entries);
        }
    };
    window.loadlist = () => { hostReloads += 1; };
    window.eventControl = (request, callback) => {
        requests.push({ ...request, callback });
        $(row).find('i').removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
        menu.hidden = true;
        window.setTimeout(() => {
            state = request.action === 'stop' ? 'exited' : (request.action === 'pause' ? 'paused' : 'running');
            window[callback]();
        }, 20);
        return true;
    };
    window.addDockerContainerContext = (_name, _image, _template, running, paused) => {
        menuOpens += 1;
        menu.replaceChildren();
        const actions = running ? (paused ? ['resume', 'stop'] : ['stop', 'pause', 'restart']) : ['start'];
        actions.forEach((action) => {
            const button = document.createElement('button');
            button.textContent = action;
            button.addEventListener('click', () => window.eventControl({ action, container: nativeId }, 'loadlist'));
            menu.append(button);
        });
        menu.hidden = false;
    };
    $(row).find('span.hand').on('click.fixtureNativeMenu', () => (
        window.addDockerContainerContext('fixture-app', '', '', false, false)
    ));
    const hostAdapter = window.FolderViewPlusRuntimeHostAdapters.createHostAdapter('docker', { window, document });
    const provider = {
        supports: () => true,
        getCapabilities: () => ({}),
        listContainers: async () => [model.normalizeContainer({ id: `server:${id}`, name: 'fixture-app', state })],
        reconcileContainer: async () => model.normalizeContainer({ id: `server:${id}`, name: 'fixture-app', state })
    };
    const integration = coordinator.createIntegration({
        providerRegistry: { getDefault: () => provider, prepare: async () => provider },
        getRuntimeMap: () => runtimeMap,
        applyRuntimeMap: (next) => { runtimeMap = next; sync(); },
        setTimeout: window.setTimeout.bind(window)
    });
    const lifecycle = window.FolderViewPlusDockerRuntimeReconcile.createApi({
        window,
        document,
        getDockerRuntimeInfoEntries: () => Object.values(runtimeMap),
        getDockerRuntimeContainerInfo: (name) => runtimeMap[name] || null,
        refreshDockerRuntimeStateInPlace: (options) => integration.refresh(options),
        syncDockerVisibleFoldersFromRuntimeCache: sync,
        getDockerHostGuardsApi: () => ({ wrapHostHook: (name, handler, options) => hostAdapter.wrapHook(name, handler, options) }),
        appendDockerBulkUpdateTrace: (eventType, details) => traces.push({ eventType, details }),
        lifecycleRefreshDelaysMs: [0, 30, 80]
    });
    lifecycle.bindLifecycleEventControlPatch();
    lifecycle.bindDockerContainerContextStatePatch();
    if (preview) actionsApi.bindDockerPreviewDefaultContextBridge(preview, $(row), { preview: 1, context: 1 });
    const trigger = preview ? preview.find('span.hand')[0] : $(row).find('span.hand')[0];
    trigger.setAttribute('data-fixture-trigger', 'true');
    window.fixtureNativeLifecycle = {
        traces,
        snapshot: () => ({
            state: icon.className,
            label: row.querySelector('span.state').textContent.trim(),
            menuActions: [...menu.querySelectorAll('button')].map((button) => button.textContent),
            menuOpens,
            hostReloads,
            requestCount: requests.length,
            callbacks: requests.map((request) => request.callback),
            finalizations: traces.filter((entry) => entry.eventType === 'lifecycleSurfaceFinalized').map((entry) => entry.details),
            rowPreserved: row.isConnected && row.querySelector('i[id^="load-"]') === icon,
            unrelatedLabel: document.getElementById('ct-unrelated').querySelector('span.state').textContent,
            busyIcons: document.querySelectorAll('.fa-spin').length
        })
    };
}());
