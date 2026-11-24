export const nativeMarkupFor = (type, rows) => `<tr class="updated"><td>${Object.entries(rows).map(([name, id]) => `
    <span class="outer ${type === 'vm' ? 'vms' : 'apps'} started">
        <span class="hand" id="${type === 'vm' ? 'vm-' : ''}${id}"><button type="button">Native ${name} control</button></span>
        <span class="inner"><span>${name}</span></span>
    </span>`).join('')}</td></tr>`;

export const membershipSnapshot = (type, rows, { rules = [], extraFolders = {}, enabled = true } = {}) => {
    const id = `${type}-group`;
    return {
        folders: {
            [id]: { id, name: `${type} configured folder`, containers: [`fixture-${type}`], settings: { expand_dashboard: true }, actions: [] },
            ...extraFolders
        },
        order: [`folder-${id}`, ...Object.keys(extraFolders).map(key => `folder-${key}`)],
        runtime: Object.fromEntries(Object.entries(rows).map(([name, identity]) => [name, type === 'vm'
            ? { uuid: identity, state: 'running', autostart: true }
            : { id: identity, manager: 'dockerman', state: 'running', running: true, autostart: true, Updated: true }
        ])),
        unraidOrder: Object.keys(rows),
        prefs: { dashboard: { layout: 'fullwidth' }, groupUnassignedItems: enabled, hiddenFolderIds: Object.keys(extraFolders), autoRules: rules }
    };
};

export const unassignedNames = async (widget) => widget.locator('[data-fv-unassigned-item] .inner').allTextContents();
