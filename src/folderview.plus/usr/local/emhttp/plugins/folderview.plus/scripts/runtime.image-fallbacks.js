(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.imageFallbacks = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
    'use strict';
    const MAX_FAILED_SOURCES = 128;
    const failedSources = new Set();
    const normalize = (value) => {
        const raw = String(value || '').trim();
        if (!raw || raw.length > 2048 || /^data:/i.test(raw)) return '';
        if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
        try {
            const parsed = new URL(raw);
            return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
                ? parsed.href
                : '';
        } catch (_error) {
            return '';
        }
    };
    const has = (value) => {
        const key = normalize(value);
        return key ? failedSources.has(key) : false;
    };
    const record = (value) => {
        const key = normalize(value);
        if (!key || failedSources.has(key)) return false;
        if (failedSources.size >= MAX_FAILED_SOURCES) failedSources.delete(failedSources.values().next().value);
        failedSources.add(key);
        return true;
    };
    const snapshot = () => Object.freeze({ count: failedSources.size, limit: MAX_FAILED_SOURCES });
    return Object.freeze({ has, record, snapshot });
}));
