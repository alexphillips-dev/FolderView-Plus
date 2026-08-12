(function folderViewPlusI18nBootstrap(root) {
    'use strict';

    if (typeof root.folderi18n !== 'function') {
        root.folderi18n = () => {};
    }
    const meta = root.document?.querySelector?.('meta[name="fvplus-i18n-config"]');
    const runtime = root.FolderViewPlusI18n;
    if (!meta || !runtime || typeof runtime.configure !== 'function') return;
    try {
        const config = JSON.parse(String(meta.content || ''));
        Promise.resolve(runtime.configure(config)).catch((error) => {
            root.console?.warn?.('[FolderView Plus] Localization initialization failed; English fallback remains active.', error);
        });
    } catch (error) {
        root.console?.warn?.('[FolderView Plus] Localization bootstrap data was invalid; English fallback remains active.', error);
    }
}(typeof window !== 'undefined' ? window : globalThis));
