(function folderViewPlusRuntimeConflictBootstrap(root) {
    'use strict';
    try {
        const key = String(root.document?.querySelector?.('meta[name="fvplus-runtime-conflict"]')?.content || 'runtime-conflict').trim() || 'runtime-conflict';
        root.localStorage?.setItem('fv.runtimeConflict.active.v1', key);
        root.localStorage?.removeItem('fv.runtimeConflict.resolvedPending.v1');
    } catch (_error) {
        // Conflict state persistence is diagnostic-only.
    }
}(typeof window !== 'undefined' ? window : globalThis));
