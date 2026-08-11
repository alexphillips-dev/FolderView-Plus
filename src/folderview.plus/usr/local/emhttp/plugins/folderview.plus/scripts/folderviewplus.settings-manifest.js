(function folderViewPlusSettingsManifestBootstrap(root) {
    'use strict';
    const meta = root.document?.querySelector?.('meta[name="fvplus-settings-loader-manifest"]');
    if (!meta) return;
    try {
        const payload = JSON.parse(String(meta.content || '{}'));
        const foundation = Array.isArray(payload?.foundation) ? payload.foundation.map(String) : [];
        const workspace = Array.isArray(payload?.workspace) ? payload.workspace.map(String) : [];
        root.FolderViewPlusSettingsLoaderManifest = Object.freeze({
            moduleTimeoutMs: Math.max(1000, Number(payload?.moduleTimeoutMs) || 12000),
            foundation: Object.freeze(foundation),
            workspace: Object.freeze(workspace)
        });
    } catch (_error) {
        root.FolderViewPlusSettingsLoaderManifest = null;
    }
}(typeof window !== 'undefined' ? window : globalThis));
