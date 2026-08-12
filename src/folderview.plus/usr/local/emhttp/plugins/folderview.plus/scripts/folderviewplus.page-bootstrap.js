(function folderViewPlusPageBootstrap(root) {
    'use strict';

    const win = root || globalThis;
    const doc = win.document;
    if (!doc) return;

    const readJsonMeta = (name, fallback = null) => {
        const node = doc.querySelector(`meta[name="${name}"]`);
        if (!node) return fallback;
        try {
            return JSON.parse(String(node.content || ''));
        } catch (_error) {
            return fallback;
        }
    };

    const versionState = readJsonMeta('fvplus-page-version', {});
    try {
        const currentVersion = String(versionState?.version || '');
        const pageKey = String(versionState?.pageKey || 'page');
        if (win.sessionStorage) {
            const currentPath = String(win.location?.pathname || pageKey);
            const storageKey = `fvplus.page-version:${pageKey}:${currentPath}`;
            const reloadKey = `${storageKey}:reloaded`;
            const previousVersion = String(win.sessionStorage.getItem(storageKey) || '').trim();
            const lastReloadedVersion = String(win.sessionStorage.getItem(reloadKey) || '').trim();
            win.sessionStorage.setItem(storageKey, currentVersion);
            if (previousVersion && previousVersion !== currentVersion && lastReloadedVersion !== currentVersion) {
                win.sessionStorage.setItem(reloadKey, currentVersion);
                win.location.reload();
                return;
            }
            if (previousVersion === currentVersion && lastReloadedVersion === currentVersion) {
                win.sessionStorage.removeItem(reloadKey);
            }
        }
    } catch (_error) {
        // Cache recovery is best effort only.
    }

    const runtimeContext = readJsonMeta('fvplus-runtime-context', null);
    if (runtimeContext && typeof runtimeContext === 'object' && !Array.isArray(runtimeContext)) {
        win.FolderViewPlusFatalRuntimeContext = runtimeContext;
    }

    const pageData = readJsonMeta('fvplus-page-data', {});
    if (pageData && typeof pageData === 'object' && !Array.isArray(pageData)) {
        if (Object.prototype.hasOwnProperty.call(pageData, 'dashboardPluginVersion')) {
            win.FolderViewPlusDashboardPluginVersion = String(pageData.dashboardPluginVersion || '');
        }
        if (pageData.assetUrls && typeof pageData.assetUrls === 'object') {
            const chartStack = Array.isArray(pageData.assetUrls.chartStack)
                ? pageData.assetUrls.chartStack.map((value) => String(value || '')).filter(Boolean)
                : [];
            win.FolderViewPlusAssetUrls = Object.freeze({ chartStack: Object.freeze(chartStack) });
        }
    }

    const hostThemeState = readJsonMeta('fvplus-host-theme', {});
    const hostThemeName = String(hostThemeState?.name || '').trim().toLowerCase();
    if (hostThemeName) {
        win.FolderViewPlusHostThemeName = hostThemeName;
        const applyTheme = () => {
            doc.documentElement?.setAttribute('data-fvplus-host-theme', hostThemeName);
            doc.documentElement?.setAttribute('data-fv-host-theme', hostThemeName);
            doc.body?.setAttribute('data-fvplus-host-theme', hostThemeName);
            doc.body?.setAttribute('data-fv-host-theme', hostThemeName);
        };
        applyTheme();
        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', applyTheme, { once: true });
        }
    }

    const i18nState = readJsonMeta('fvplus-page-i18n', {});
    const i18nMode = String(i18nState?.mode || '').trim().toLowerCase();
    if (i18nMode) {
        win.folderi18n = () => {
            if (i18nMode === 'docker' && win.FolderViewPlusDockerHostCompatibilityDecision?.runtimeActivationAllowed !== true) {
                return;
            }
            if (i18nMode === 'docker' && !doc.getElementById('fvplus-docker-action-bar')) {
                const table = doc.querySelector('table#docker_containers');
                if (table?.parentNode) {
                    const actionBar = doc.createElement('div');
                    actionBar.id = 'fvplus-docker-action-bar';
                    actionBar.className = 'fvplus-docker-action-bar';
                    actionBar.setAttribute('aria-label', 'FolderView actions');
                    table.parentNode.insertBefore(actionBar, table.nextSibling);
                }
            }
            if (i18nMode === 'vms' && !doc.querySelector('[data-fvplus-add-folder="vms"]')) {
                const table = doc.querySelector('table#kvm_table');
                if (table?.parentNode) {
                    const button = doc.createElement('input');
                    button.type = 'button';
                    button.value = 'Add Folder';
                    button.dataset.i18n = '[value]add-folder';
                    button.dataset.fvOnclick = 'createFolderBtn()';
                    button.dataset.fvplusAddFolder = 'vms';
                    table.parentNode.insertBefore(button, table.nextSibling);
                }
            }
            win.jQuery?.('body')?.i18n?.();
            win.jQuery?.('[type="button"]')?.i18n?.();
        };
        const runI18n = () => win.folderi18n?.();
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', runI18n, { once: true });
        else runI18n();
    }

    win.FolderViewPlusPageBootstrap = Object.freeze({ readJsonMeta });
}(typeof window !== 'undefined' ? window : globalThis));
