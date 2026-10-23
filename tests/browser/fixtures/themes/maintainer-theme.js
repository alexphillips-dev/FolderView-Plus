/* Synthetic maintainer example: palette ownership only; no row or native-hook writes. */
(function () {
    const doc = document;
    window.fixtureMaintainerTheme?.remove();
    const style = doc.createElement('style');
    style.textContent = ':root {--background-color:#101827;--table-background-color:#172136;--text-color:#f1f5f9;--alt-text-color:#cbd5e1;--link-text-color:#80bfff;--button-background:#172136;--hover-button-background:#243450;--input-bg-color:#172136;--border-color:#64748b} body {background:#101827;color:#f1f5f9}';
    doc.head.append(style);
    doc.documentElement.setAttribute('data-fvplus-theme-name', 'Maintainer fixture');
    const refresh = () => window.dispatchEvent(new Event('folderviewplus:theme-change'));
    const state = { owner:'pending' };
    const recognize = () => {
        state.owner = doc.querySelector('script[src*="/plugins/folderview.plus/"],script[src*="/plugin/scripts/"]')
            || window.FolderViewPlusDockerHostCompatibilityDecision ? 'folderview-plus' : 'native';
        // A real enhancer must stop its grouping/filtering/sorting/row movement here.
        // Keep its existing native-container actions and the plugin lifecycle bridge.
    };
    const ready = () => { recognize(); refresh(); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, {once:true});
    else ready();
    window.addEventListener('folderviewplus:docker-host-compatibility', recognize);
    window.fixtureMaintainerTheme = { state, refresh, remove() {
        doc.removeEventListener('DOMContentLoaded', ready);
        window.removeEventListener('folderviewplus:docker-host-compatibility', recognize);
        style.remove();
        if (doc.documentElement.getAttribute('data-fvplus-theme-name') === 'Maintainer fixture') doc.documentElement.removeAttribute('data-fvplus-theme-name');
        refresh();
    } };
}());
