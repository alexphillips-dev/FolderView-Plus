/* Synthetic Unraid host only. All FolderView Plus scripts remain unmodified. */
window.autostart = []; window.docker = []; window.advanced = false;
window.Docker = []; window.display = { theme: 'black' };
window.listview = () => {};
window.loadlist = () => window.listview();
window.openDocker = () => {};
window.eventControl = () => {};
window.addDockerContainerContext = () => {};
window.context = { attach() {}, init() {}, destroy() {} };
window.loadDocker = () => {};
window.done = () => {}; window.prepareDocker = () => {};
window.addDockerContainer = () => {};
window.jQuery.cookie = () => '';
window.jQuery.fn.switchButton = function () { return this; };
for (const name of ['sortable', 'tooltip', 'dialog', 'multiselect', 'multiselectfilter', 'tablesorter', 'contextMenu']) {
    window.jQuery.fn[name] = function (action) { return action === 'getChecked' ? window.jQuery() : this; };
}
window.swal = () => Promise.resolve(false);
window.swal.close = () => {};
document.addEventListener('DOMContentLoaded', () => {
    if (location.pathname === '/docker') window.FolderViewPlusDockerBootstrapPromise.then(() => window.loadlist());
});
