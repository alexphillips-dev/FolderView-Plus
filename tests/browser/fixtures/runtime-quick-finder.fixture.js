(() => {
    const type = new URLSearchParams(location.search).get('type') === 'vm' ? 'vm' : 'docker';
    const table = document.querySelector('table');
    const body = table.tBodies[0];
    if (type === 'vm') { table.id = 'kvm_table'; body.id = 'kvm_list'; }
    const folders = {
        home: { name: 'Home Automation', icon: '/plugin/images/folder-icon.png', containers: { Assistant: {}, Mosquitto: {} }, status: { expanded: false } },
        services: { name: 'Services', parentId: 'home', containers: { Assistant: {}, Mosquitto: {} }, status: { expanded: false } },
        backup: { name: 'Backup', containers: {}, status: { expanded: false } }
    };
    const runtime = type === 'vm' ? {
        Assistant: { icon: '/plugin/images/folder-icon.png', uuid: 'sample-vm', state: 'running', logs: '/sample/assistant.log' },
        Mosquitto: { uuid: 'sample-stopped-vm', state: 'shutoff' }
    } : {
        Assistant: { icon: '/plugin/images/folder-icon.png', state: true, webui: 'https://example.com/assistant', shell: '/bin/sh' },
        Mosquitto: { state: false }
    };
    const events = [];
    let api, releasePrepare, preparePending = false;
    window.openTerminal = (...args) => events.push({ action: 'terminal', args });
    function renderRows() {
        body.replaceChildren();
        for (const [id, folder] of Object.entries(folders)) {
            const row = document.createElement('tr'); row.className = `folder folder-id-${id}`; row.dataset.sampleFolder = id;
            row.insertCell().textContent = folder.name;
            const storage = document.createElement('table'); storage.className = 'folder-storage'; storage.createTBody(); row.insertCell().append(storage);
            body.append(row);
        }
        for (const [name, entry] of Object.entries(runtime)) {
            const row = document.createElement('tr'); row.id = `ct-${name}`; row.dataset.name = name;
            const cell = row.insertCell(); cell.className = type === 'vm' ? 'vm-name' : 'ct-name';
            const trigger = document.createElement('button'); trigger.className = 'hand'; trigger.textContent = name;
            trigger.onclick = () => events.push({ action: 'native-menu', name }); cell.append(trigger);
            row.insertCell().textContent = String(entry.state);
            body.querySelector('.folder-id-services .folder-storage tbody').append(row);
        }
        const child = body.querySelector('.folder-id-services'); body.querySelector('.folder-id-home .folder-storage tbody').append(child);
    }
    const rowFor = (id) => Array.from(table.querySelectorAll('tr.folder')).find(row => row.classList.contains(`folder-id-${id}`));
    function expand(id) {
        const row = rowFor(id);
        const children = Array.from(row.querySelector('.folder-storage > tbody').children);
        let previous = row;
        for (const child of children) { previous.after(child); previous = child; }
        folders[id].status.expanded = true; events.push({ action: 'expand', id });
    }
    const create = () => window.FolderViewPlusFoundationModules.runtimeQuickFinderAdapter.createApi({
        window, document, type, hostAdapter: { getTable: () => table },
        getFolders: () => folders, getRuntime: () => runtime, getMembers: (id) => folders[id].containers,
        readRowName: (row) => row.dataset.name || '',
        expand, clearFocus: () => events.push({ action: 'clear-focus' }),
        clearFilters: () => events.push({ action: 'clear-filters' }),
        focus: (id) => events.push({ action: 'focus', id }), edit: (id) => events.push({ action: 'edit', id }),
        safeWebui: (url) => /^https?:/.test(String(url)) ? url : '',
        openWebui: (url) => events.push({ action: 'webui', url }),
        prepareView: () => preparePending ? new Promise(resolve => { releasePrepare = resolve; }) : Promise.resolve(),
        onError: (message) => events.push({ action: 'error', message })
    });
    renderRows(); api = create(); api.mount();
    window.fixtureFinder = {
        type, folders, runtime, events,
        refresh: () => api.mount(),
        remount: () => { const host = document.querySelector('.ToggleViewMode'); const replacement = document.createElement('div'); replacement.className = host.className; const label = document.createElement('label'); label.textContent = 'Basic view'; label.className = 'native-toggle'; replacement.append(label); host.replaceWith(replacement); api.mount(); },
        removeItem: (name) => { delete runtime[name]; api.refresh(); },
        addItems: (count) => { for (let index = 0; index < count; index++) runtime[`Search item ${index}`] = {}; api.refresh(); },
        dispose: () => api.dispose(),
        replace: () => { api = create(); api.mount(); },
        deferPrepare: () => { preparePending = true; },
        releasePrepare: () => releasePrepare?.()
    };
})();
