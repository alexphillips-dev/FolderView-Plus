(function folderViewPlusEarlyI18nBootstrap(root) {
    'use strict';

    const meta = root.document?.querySelector?.('meta[name="fvplus-i18n-early"]');
    if (!meta) return;
    try {
        const payload = JSON.parse(String(meta.content || ''));
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            root.FolderViewPlusEarlyI18n = Object.freeze(payload);
        }
    } catch (_error) {
        // The full localization runtime retains its English fallback.
    }
}(typeof window !== 'undefined' ? window : globalThis));
