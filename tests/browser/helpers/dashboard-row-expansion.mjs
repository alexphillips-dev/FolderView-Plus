import assert from 'node:assert/strict';

export const installDashboardRowExpansion = async (page, baseUrl, type) => {
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/dashboard.state-store.js` });
    const response = await page.request.get(`${baseUrl}/plugin/scripts/dashboard.js`);
    assert.equal(response.ok(), true);
    const source = (await response.text()).replaceAll('\r\n', '\n');
    const extract = (start, end) => {
        const begin = source.indexOf(start), finish = source.indexOf(end, begin + start.length);
        assert.ok(begin >= 0 && finish > begin, `Dashboard source boundaries: ${start}`);
        return source.slice(begin, finish);
    };
    const handlers = [extract('const dashboardTypeMeta =', 'let dashboardQuickRailController'),
        extract('const getDashboardCard =', 'const applyFolderDashboardCardSettings'),
        extract('const getGlobalFoldersForType =', 'const scheduleDashboardLayoutApplyForType'),
        extract('const toggleFolderExpansion =', '// Global variables')].join('\n');
    await page.evaluate(type => {
        const toggle = document.querySelector('#vms'); toggle.hidden = true; toggle.checked = false; document.body.append(toggle);
        document.querySelector('#fixture-vm-widget').remove();
        if (type === 'vm') document.querySelector('#docker_view').id = 'vm_view';
        const host = document.querySelector('#fixture-dashboard-host');
        host.querySelectorAll(':scope > .folder-showcase-outer, :scope > span.outer').forEach(node => node.remove());
        const card = id => `<div class="folder-showcase-outer" data-fv-folder-id="${id}" expanded="false"><span id="header-${id}" class="outer ${type === 'vm' ? 'vms folder-vm' : 'apps folder-docker'}" expanded="false" data-fv-dashboard-folder-toggle data-fv-dashboard-type="${type}" role="button" tabindex="0" aria-expanded="false"><span class="inner ${type === 'vm' ? 'folder-inner-vm' : 'folder-inner-docker'}"><span class="${type === 'vm' ? 'folder-appname-vm' : 'folder-appname-docker'}">Synthetic folder ${id}</span></span><div class="folder-storage"><span class="outer ${type === 'vm' ? 'vms folder-element-vm' : 'apps folder-element-docker'} started" data-fv-runtime-state="running"><span class="inner">Synthetic member</span></span></div></span><div class="folder-showcase folder-showcase-${id}"></div></div>`;
        host.insertAdjacentHTML('beforeend', Array.from({length: 6}, (_, index) => card(`row-${index}`)).join(''));
        window.fixtureDashboardLayout.resize(Math.min(600, innerWidth - 24));
    }, type);
    await page.addScriptTag({ content: `(() => {
        const $ = window.jQuery, folderEvents = new EventTarget(), fixture = window.fixtureDashboardLayout;
        const dashboardExpandedStateStore = window.FolderViewPlusDashboardStateStore.createStore({window});
        const globalFolders = {docker: {}, vms: {}};
        document.querySelectorAll('#fixture-dashboard-host > .folder-showcase-outer').forEach(node => {
            globalFolders.${type === 'vm' ? 'vms' : 'docker'}[node.dataset.fvFolderId] = {status: {expanded: false}, settings: {}};
        });
        const normalizeDashboardPrefsForType = () => ({layout: fixture.state.layout});
        const applyFolderDashboardCardSettings = (type, id) => updateExpandToggleIcon(getDashboardCard(type, id), getDashboardCard(type, id).attr('expanded') === 'true');
        const applyDashboardStartedOnlyFilterForType = type => fixture.controller.applyDashboardStartedOnlyFilterForType(type);
        const scheduleDashboardLayoutApplyForType = type => fixture.controller.applyDashboardLayoutStateForType(type);
        ${handlers}
        window.fixtureDashboardRowExpansion = {saved: type => dashboardExpandedStateStore.read(type)};
    })();` });
};
