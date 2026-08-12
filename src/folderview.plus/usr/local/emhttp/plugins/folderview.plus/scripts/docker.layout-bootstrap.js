(function folderViewPlusDockerLayoutBootstrap(root) {
    'use strict';

    if (root.FolderViewPlusDockerHostCompatibilityDecision?.runtimeActivationAllowed !== true) return;
    try {
        const cachedLayout = JSON.parse(root.localStorage?.getItem('fvplus.runtime.docker.appWidth.v2') || '{}');
        const cachedMode = ['compact', 'standard', 'wide'].includes(String(cachedLayout?.lastMode || '').toLowerCase())
            ? String(cachedLayout.lastMode).toLowerCase()
            : 'standard';
        const cachedWidth = Number(cachedLayout?.widths?.[cachedMode]?.width);
        if (
            cachedLayout?.schemaVersion === 2
            && cachedLayout?.algorithmVersion === 'content-aware-v2'
            && Number.isFinite(cachedWidth)
            && cachedWidth >= 118
            && cachedWidth <= 1280
        ) {
            root.document.body?.setAttribute('data-fvplus-docker-app-width', cachedMode);
            root.document.body?.style?.setProperty('--fvplus-docker-app-column-width', `${Math.round(cachedWidth)}px`);
            root.document.body?.style?.setProperty('--fvplus-docker-app-column-width-mobile', `${Math.max(136, Math.round(cachedWidth))}px`);
        }
    } catch (_error) {
        // A missing or restricted cache must never block the native Docker page.
    }
    root.document.querySelectorAll('link[data-fvplus-docker-legacy-style="true"]').forEach((link) => {
        link.media = 'all';
    });
}(typeof window !== 'undefined' ? window : globalThis));
