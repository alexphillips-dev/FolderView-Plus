// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.startOrderModel = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    const MODES = Object.freeze(['unmanaged', 'docker-page', 'custom-batches']);
    const REMAINING_MODES = Object.freeze(['after', 'before', 'keep']);
    const DEFAULT_PLAN = Object.freeze({
        mode: 'docker-page',
        remaining: 'after',
        batches: [],
        containerWaits: {}
    });

    const boundedText = (value, maximum) => String(value || '').trim().slice(0, maximum);
    const boundedInteger = (value, minimum, maximum, fallback = minimum) => {
        const parsed = Number(value);
        return Number.isFinite(parsed)
            ? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
            : fallback;
    };

    const normalizeItem = (item) => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        if (String(item.type || '').toLowerCase() === 'folder') {
            const id = boundedText(item.id || item.folderId, 64);
            return id ? { type: 'folder', id } : null;
        }
        const name = boundedText(item.name, 255);
        return name ? { type: 'container', name } : null;
    };

    const normalizeBatch = (batch, index) => {
        const source = batch && typeof batch === 'object' ? batch : {};
        const items = (Array.isArray(source.items) ? source.items : [])
            .slice(0, 2000)
            .map(normalizeItem)
            .filter(Boolean);
        return {
            id: boundedText(source.id, 64) || `batch-${index + 1}`,
            name: boundedText(source.name, 64) || `Start batch ${index + 1}`,
            delay: boundedInteger(source.delay, 0, 3600, 0),
            parallel: source.parallel === true,
            useFolderOrder: !Object.prototype.hasOwnProperty.call(source, 'useFolderOrder') || source.useFolderOrder !== false,
            items
        };
    };

    const normalizeContainerWaits = (value) => {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const waits = {};
        Object.entries(source).slice(0, 2000).forEach(([name, delay]) => {
            const normalizedName = boundedText(name, 255);
            if (normalizedName) {
                waits[normalizedName] = boundedInteger(delay, 0, 3600, 0);
            }
        });
        return waits;
    };

    const normalizePlan = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        const mode = boundedText(source.mode, 32).toLowerCase();
        const remaining = boundedText(source.remaining, 16).toLowerCase();
        return {
            mode: MODES.includes(mode) ? mode : DEFAULT_PLAN.mode,
            remaining: REMAINING_MODES.includes(remaining) ? remaining : DEFAULT_PLAN.remaining,
            batches: (Array.isArray(source.batches) ? source.batches : []).slice(0, 100).map(normalizeBatch),
            containerWaits: normalizeContainerWaits(source.containerWaits)
        };
    };

    const patchPlan = (current, patch) => normalizePlan({
        ...normalizePlan(current),
        ...(patch && typeof patch === 'object' ? patch : {})
    });

    const createId = (prefix = 'batch', now = Date.now, random = Math.random) => (
        `${boundedText(prefix, 16) || 'batch'}-${now().toString(36)}-${random().toString(16).slice(2, 8)}`
    );

    return Object.freeze({
        MODES,
        REMAINING_MODES,
        DEFAULT_PLAN,
        normalizePlan,
        patchPlan,
        createId
    });
}));
