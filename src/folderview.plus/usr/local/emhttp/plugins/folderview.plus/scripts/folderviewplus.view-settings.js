// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusViewSettings = factory();
    root.FolderViewPlusViewSettingsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    /** @typedef {'docker'|'vm'} ManagedType */
    /**
     * @typedef {object} ViewSettingsChange
     * @property {object} definition
     * @property {string} group
     * @property {string} handler
     * @property {string} key
     * @property {string} path
     * @property {string} storageKey
     * @property {ManagedType} type
     * @property {*} value
     */

    const normalizeType = (value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker';
    const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const normalizeText = (value) => String(value || '').trim().toLowerCase();

    const createChangeController = (options = {}) => {
        const registry = options.registry || null;
        const onInvalid = typeof options.onInvalid === 'function' ? options.onInvalid : null;
        let started = false;
        const start = () => {
            started = true;
            return api;
        };
        const resolve = (handler, type, key, value, fallback) => {
            if (!started || !registry || typeof registry.resolveChange !== 'function') return null;
            const change = registry.resolveChange(handler, normalizeType(type), key, value, fallback);
            if (!change) onInvalid?.({ handler, type: normalizeType(type), key, value });
            return change;
        };
        const destroy = () => {
            started = false;
        };
        const snapshot = () => Object.freeze({ started, schemaVersion: Number(registry?.schemaVersion || 0) });
        const api = Object.freeze({ start, resolve, destroy, snapshot });
        return api;
    };

    const createRangeControlLifecycle = (options = {}) => {
        const win = options.window || (typeof window !== 'undefined' ? window : {});
        const doc = options.document || win.document || null;
        const jq = options.$ || win.jQuery || win.$ || null;
        const namespace = '.fvViewSettingsRange';
        let started = false;

        const update = (range, value) => {
            if (!range || String(range.tagName || '').toLowerCase() !== 'input') return;
            const min = Number(range.min || 0);
            const max = Number(range.max || 100);
            const nextValue = Math.max(min, Math.min(max, Number(value) || 0));
            range.value = String(nextValue);
            range.style?.setProperty?.('--fv-range-percent', `${max > min ? ((nextValue - min) / (max - min)) * 100 : 0}%`);
        };
        const refresh = (type = '') => {
            const prefix = type ? `${normalizeType(type)}-` : '';
            doc?.querySelectorAll?.('[data-fv-number-target]')?.forEach?.((range) => {
                const targetId = String(range.dataset?.fvNumberTarget || '');
                if (prefix && !targetId.startsWith(prefix)) return;
                const numberInput = doc.getElementById?.(targetId);
                if (numberInput) update(range, numberInput.value);
            });
        };
        const start = () => {
            if (started || !jq || !doc) return api;
            started = true;
            jq(doc)
                .on(`input${namespace}`, '[data-fv-number-target]', function() {
                    const numberInput = doc.getElementById?.(String(this.dataset?.fvNumberTarget || ''));
                    if (!numberInput) return;
                    numberInput.value = this.value;
                    update(this, this.value);
                })
                .on(`change${namespace}`, '[data-fv-number-target]', function() {
                    const numberInput = doc.getElementById?.(String(this.dataset?.fvNumberTarget || ''));
                    numberInput?.dispatchEvent?.(new win.Event('change', { bubbles: true }));
                })
                .on(`input${namespace}`, '.fv-setting-range-control > input[type="number"]', function() {
                    const range = this.parentElement?.querySelector?.(`[data-fv-number-target="${this.id}"]`);
                    if (range) update(range, this.value);
                });
            return api;
        };
        const destroy = () => {
            if (started && jq && doc) jq(doc).off(namespace);
            started = false;
        };
        const snapshot = () => Object.freeze({ started });
        const api = Object.freeze({ start, refresh, update, destroy, snapshot });
        return api;
    };

    const normalizeUiState = (value, normalizers = {}) => {
        const source = asObject(value);
        const sourceFilters = asObject(source.filters);
        const sourceQuick = asObject(source.quick);
        const sourceHealthSeverity = asObject(source.healthSeverity);
        const sourceTreeCollapsed = asObject(source.treeCollapsed);
        const sourceTreeReorderMode = asObject(source.treeReorderMode);
        const sourceAdvancedSearch = asObject(source.advancedSearch);
        const normalizeFilter = typeof normalizers.filter === 'function' ? normalizers.filter : normalizeText;
        const normalizeQuick = typeof normalizers.quick === 'function' ? normalizers.quick : ((entry) => normalizeText(entry) || 'all');
        const normalizeHealthSeverity = typeof normalizers.healthSeverity === 'function' ? normalizers.healthSeverity : ((entry) => normalizeText(entry) || 'all');
        const normalizeAdvancedSearchMap = typeof normalizers.advancedSearchMap === 'function' ? normalizers.advancedSearchMap : asObject;
        const filters = {};
        const quick = {};
        const healthSeverity = {};
        const treeCollapsed = {};
        const treeReorderMode = {};
        /** @type {ManagedType[]} */
        const types = ['docker', 'vm'];
        types.forEach((type) => {
            const perTypeFilters = asObject(sourceFilters[type]);
            filters[type] = {
                folders: normalizeFilter(perTypeFilters.folders),
                rules: normalizeFilter(perTypeFilters.rules),
                backups: normalizeFilter(perTypeFilters.backups),
                templates: normalizeFilter(perTypeFilters.templates),
                bulk: normalizeFilter(perTypeFilters.bulk)
            };
            quick[type] = normalizeQuick(sourceQuick[type], type);
            healthSeverity[type] = normalizeHealthSeverity(sourceHealthSeverity[type]);
            treeCollapsed[type] = Array.isArray(sourceTreeCollapsed[type])
                ? sourceTreeCollapsed[type].map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            treeReorderMode[type] = sourceTreeReorderMode[type] === true;
        });
        return {
            filters,
            quick,
            healthSeverity,
            dockerUpdatesOnlyFilter: source.dockerUpdatesOnlyFilter === true,
            treeCollapsed,
            treeReorderMode,
            advancedSearch: {
                byTab: normalizeAdvancedSearchMap(sourceAdvancedSearch.byTab || sourceAdvancedSearch.queryByTab || {}),
                basicQuery: normalizeFilter(sourceAdvancedSearch.basicQuery),
                query: typeof sourceAdvancedSearch.query === 'string' ? normalizeFilter(sourceAdvancedSearch.query) : null,
                searchAll: sourceAdvancedSearch.searchAll === true
            }
        };
    };

    const createUiStateStore = (options = {}) => {
        const storage = options.storage || null;
        const writer = options.writer || null;
        const storageKey = String(options.storageKey || '').trim();
        const normalizers = options.normalizers || {};
        let started = false;
        let lastError = '';
        const start = () => {
            started = true;
            return api;
        };
        const save = (value) => {
            if (!started || !storageKey) return false;
            try {
                const serialized = JSON.stringify(normalizeUiState(value, normalizers));
                if (writer && typeof writer.setItem === 'function') writer.setItem(storageKey, serialized, { delayMs: 90, idle: true });
                else storage?.setItem?.(storageKey, serialized);
                lastError = '';
                return true;
            } catch (error) {
                lastError = String(error?.message || error || 'storage write failed');
                return false;
            }
        };
        const restore = () => {
            if (!started || !storageKey) return null;
            try {
                const raw = storage?.getItem?.(storageKey);
                if (!raw) return null;
                lastError = '';
                return normalizeUiState(JSON.parse(raw), normalizers);
            } catch (error) {
                lastError = String(error?.message || error || 'storage read failed');
                return null;
            }
        };
        const destroy = () => {
            started = false;
        };
        const snapshot = () => Object.freeze({ started, storageKey, lastError });
        const api = Object.freeze({ start, save, restore, destroy, snapshot });
        return api;
    };

    return Object.freeze({
        normalizeType,
        createChangeController,
        createRangeControlLifecycle,
        normalizeUiState,
        createUiStateStore
    });
}));
