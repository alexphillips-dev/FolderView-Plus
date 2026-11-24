(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeDebugDownload = factory(root);
}(typeof window !== 'undefined' ? window : globalThis, function(window) {
    'use strict';

    const targets = {
        docker: [['default', '#docker_list, #docker_view', 'debug-DOCKER.json']],
        vm: [['default', '#kvm_list, #vm_view', 'debug-VM.json']],
        dashboard: [
            ['docker', '#docker_view', 'debug-DASHBOARD-DOCKER.json'],
            ['vm', '#vm_view', 'debug-DASHBOARD-VM.json']
        ]
    };

    const downloadSnapshot = (snapshot, name) => {
        const doc = window.document;
        const url = window.URL.createObjectURL(new window.Blob([JSON.stringify(snapshot)], { type: 'application/json' }));
        const anchor = doc.createElement('a');
        anchor.hidden = true;
        anchor.href = url;
        anchor.download = name;
        doc.body.append(anchor);
        try {
            anchor.click();
        } finally {
            anchor.remove();
            window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
        }
    };

    const bind = (surface) => {
        if (!Object.hasOwn(targets, surface)) return;
        let sequence = '';
        const onKey = (event) => {
            if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey
                || event.target?.closest?.('input, textarea, select, [contenteditable]')) {
                sequence = '';
                return;
            }
            if (event.repeat || event.key?.length !== 1) return;
            sequence = (sequence + event.key.toLowerCase()).slice(-5);
            if (sequence !== 'debug') return;
            sequence = '';
            const diagnostics = window.FolderViewPlusFoundationModules?.runtimePageDiagnostics;
            for (const [variant, selector, name] of targets[surface]) {
                const root = window.document.querySelector(selector);
                if (!root) continue;
                const snapshot = diagnostics?.buildSnapshot({ surface, variant, root });
                if (snapshot) downloadSnapshot(snapshot, name);
            }
        };
        const onPageHide = (event) => {
            sequence = '';
            if (event.persisted) return;
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pagehide', onPageHide);
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pagehide', onPageHide);
    };

    return Object.freeze({ bind });
}));
