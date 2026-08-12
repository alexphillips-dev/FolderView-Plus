(function folderViewPlusDockerPageBootstrap(root) {
    'use strict';

    const doc = root.document;
    const controller = root.FolderViewPlusHostCompatibility?.getDefaultController?.({ window: root, document: doc }) || null;
    root.FolderViewPlusDockerHostCompatibilityController = controller;
    root.FolderViewPlusDockerHostCompatibilityDecision = controller?.evaluateDockerRuntime?.() || {
        hostGeneration: 'unknown-docker-host',
        runtimeActivationAllowed: false
    };
    const meta = doc?.querySelector?.('meta[name="fvplus-docker-bootstrap"]');
    try {
        const payload = JSON.parse(String(meta?.content || '{}'));
        root.FolderViewPlusDockerRuntimeAssetUrl = String(payload?.runtimeAssetUrl || '').trim();
    } catch (_error) {
        root.FolderViewPlusDockerRuntimeAssetUrl = '';
    }
}(typeof window !== 'undefined' ? window : globalThis));
