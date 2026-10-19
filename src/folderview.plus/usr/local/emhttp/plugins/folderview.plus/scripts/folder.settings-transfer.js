// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderSettingsTransfer = factory();
    root.FolderViewPlusFolderSettingsTransferModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const CLIPBOARD_STORAGE_KEY = 'fv.folder.settings.clipboard.v1';
    const CLIPBOARD_LOCAL_STORAGE_KEY = 'fv.folder.settings.clipboard.persist.v1';
    const CLIPBOARD_SCHEMA_VERSION = 2;
    const CATEGORY_IDS = Object.freeze(['appearance', 'layout', 'behavior', 'actions']);
    const CLIPBOARD_CLEARED_KEY = 'fv.folder.settings.clipboard.cleared.v1';
    const CLIPBOARD_TYPE_VALUES = Object.freeze(new Set(['docker', 'vm']));
    const SETTINGS_PAYLOAD_KEYS = Object.freeze(['icon', 'settings', 'actions']);

    const deepClone = (value) => {
        if (value === undefined) {
            return undefined;
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return value;
        }
    };

    const normalizeType = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return CLIPBOARD_TYPE_VALUES.has(normalized) ? normalized : '';
    };

    const normalizeFolderSettingsPayload = (payload) => {
        const source = payload && typeof payload === 'object' ? deepClone(payload) || {} : {};
        const normalizedSettings = source.settings && typeof source.settings === 'object'
            ? deepClone(source.settings) || {}
            : {};
        delete normalizedSettings.webui_profiles;
        delete normalizedSettings.webuiProfiles;
        const actions = Array.isArray(source.actions) ? source.actions : [];
        const normalizedActions = [];
        let droppedMemberBoundActionCount = 0;

        actions.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const cloned = deepClone(entry) || {};
            const actionType = Number.parseInt(cloned.type, 10);
            const actionTargets = Array.isArray(cloned.conatiners)
                ? cloned.conatiners
                : (Array.isArray(cloned.containers) ? cloned.containers : []);
            const isScriptAction = actionType === 1;
            if (!isScriptAction && actionTargets.length > 0) {
                droppedMemberBoundActionCount += 1;
                return;
            }
            if (!isScriptAction) {
                droppedMemberBoundActionCount += 1;
                return;
            }
            normalizedActions.push(cloned);
        });

        if (normalizedSettings.override_default_actions === true && normalizedActions.length <= 0) {
            normalizedSettings.override_default_actions = false;
        }

        return {
            payload: {
                icon: String(source.icon || ''),
                settings: normalizedSettings,
                actions: normalizedActions
            },
            meta: {
                copiedKeys: [...SETTINGS_PAYLOAD_KEYS],
                omittedTopLevelKeys: ['name', 'parentId', 'regex', 'containers', 'id', 'createdAt', 'updatedAt'],
                droppedMemberBoundActionCount,
                copiedActionCount: normalizedActions.length
            }
        };
    };

    const buildClipboardEntry = (type, folder, options = {}) => {
        const normalizedType = normalizeType(type);
        if (!normalizedType) {
            return null;
        }
        const normalized = normalizeFolderSettingsPayload(folder);
        return {
            schemaVersion: CLIPBOARD_SCHEMA_VERSION,
            categories: options.categories || [...CATEGORY_IDS],
            type: normalizedType,
            copiedAt: new Date().toISOString(),
            sourceId: String(options.sourceId || '').trim(),
            sourceName: String(options.sourceName || folder?.name || '').trim(),
            sourceContext: String(options.sourceContext || '').trim() || 'runtime',
            payload: normalized.payload,
            meta: normalized.meta
        };
    };

    const parseClipboardEntry = (rawValue) => {
        const raw = String(rawValue || '').trim();
        if (!raw) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return null;
            }
            if (![1, 2].includes(parsed.schemaVersion)) return null;
            const categories = parsed.schemaVersion === 1 ? [...CATEGORY_IDS] : parsed.categories;
            if (!Array.isArray(categories) || !categories.length || categories.some(value => !CATEGORY_IDS.includes(value))) return null;
            const normalizedType = normalizeType(parsed.type);
            if (!normalizedType) {
                return null;
            }
            const normalized = normalizeFolderSettingsPayload(parsed.payload || {});
            const dropped = Number(parsed.meta?.droppedMemberBoundActionCount);
            if (Number.isInteger(dropped) && dropped >= 0 && dropped <= 200) normalized.meta.droppedMemberBoundActionCount = Math.max(dropped, normalized.meta.droppedMemberBoundActionCount);
            return {
                schemaVersion: CLIPBOARD_SCHEMA_VERSION,
                categories: [...new Set(categories)],
                type: normalizedType,
                copiedAt: String(parsed.copiedAt || '').trim(),
                sourceId: String(parsed.sourceId || '').trim(),
                sourceName: String(parsed.sourceName || '').trim(),
                sourceContext: String(parsed.sourceContext || '').trim() || 'runtime',
                payload: normalized.payload,
                meta: normalized.meta
            };
        } catch (_error) {
            return null;
        }
    };

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;

        let schema = deps.schema || null;
        let schemaPromise = null;
        const loadSchema = async () => {
            if (schema) return schema;
            const request = deps.requestClient || win.FolderViewPlusRequest;
            if (!request?.getJson) throw new Error('Folder settings categories are unavailable.');
            if (!schemaPromise) schemaPromise = request.getJson('/plugins/folderview.plus/schemas/folder-settings-transfer.schema.json', { cache: 'no-store', retries: 0 })
                .then(value => { if (value.schemaVersion !== 1 || JSON.stringify(value.categories) !== JSON.stringify(CATEGORY_IDS)) throw new Error('Invalid folder settings registry.'); schema = value; return schema; })
                .catch(error => { schemaPromise = null; throw error; });
            return schemaPromise;
        };
        const categoryForKey = key => {
            if (!schema) throw new Error('Load folder settings categories first.');
            if (schema.protectedSettings.includes(key)) return '';
            if (schema.actionKeys.includes(key)) return 'actions';
            for (const category of ['appearance', 'layout']) if (schema[category + 'Prefixes'].some(prefix => key.startsWith(prefix))) return category;
            return schema.layoutKeys.includes(key) ? 'layout' : 'behavior';
        };
        const normalizeCategories = categories => {
            if (!Array.isArray(categories) || !categories.length || categories.some(value => !CATEGORY_IDS.includes(value))) throw new Error('Invalid folder settings categories.');
            return CATEGORY_IDS.filter(category => categories.includes(category));
        };
        const selectPayload = (folder, categories) => {
            categories = normalizeCategories(categories);
            const payload = normalizeFolderSettingsPayload(folder).payload;
            return { icon: categories.includes('appearance') ? payload.icon : '',
                settings: Object.fromEntries(Object.entries(payload.settings).filter(([key]) => categories.includes(categoryForKey(key)))),
                actions: categories.includes('actions') ? payload.actions : [] };
        };
        const clearedAt = () => Math.max(0, ...['localStorage', 'sessionStorage'].map(storage => {
            try { return Number(win?.[storage]?.getItem(CLIPBOARD_CLEARED_KEY)) || 0; } catch { return 0; }
        }));
        const newestStoredAt = () => Math.max(clearedAt(), ...[['localStorage', CLIPBOARD_LOCAL_STORAGE_KEY], ['sessionStorage', CLIPBOARD_STORAGE_KEY]].map(([storage, key]) => {
            try { return Date.parse(parseClipboardEntry(win?.[storage]?.getItem(key))?.copiedAt) || 0; } catch { return 0; }
        }));
        const writeClipboardEntry = entry => {
            if (!entry || typeof entry !== 'object') return false;
            entry.copiedAt = new Date(Math.max(Date.now(), newestStoredAt() + 1)).toISOString();
            const serialized = JSON.stringify(entry);
            let wrote = false;
            for (const [storage, key] of [['localStorage', CLIPBOARD_LOCAL_STORAGE_KEY], ['sessionStorage', CLIPBOARD_STORAGE_KEY]]) {
                try { if (win?.[storage]) { win[storage].setItem(key, serialized); wrote = true; } } catch { /* Storage is optional. */ }
            }
            return wrote;
        };
        const readClipboardEntry = (expectedType = '') => {
            const expected = normalizeType(expectedType), cleared = clearedAt();
            const entries = [];
            for (const [storage, key] of [['localStorage', CLIPBOARD_LOCAL_STORAGE_KEY], ['sessionStorage', CLIPBOARD_STORAGE_KEY]]) {
                try {
                    const entry = parseClipboardEntry(win?.[storage]?.getItem(key));
                    if (entry && (Date.parse(entry.copiedAt) || 0) >= cleared) entries.push(entry);
                } catch { /* Storage is optional. */ }
            }
            const newest = entries.sort((left, right) => (Date.parse(right.copiedAt) || 0) - (Date.parse(left.copiedAt) || 0))[0];
            return newest && (!expected || newest.type === expected) ? newest : null;
        };
        const clearClipboardEntry = () => {
            let cleared = false;
            const at = String(Math.max(Date.now(), newestStoredAt() + 1));
            for (const [storage, key] of [['localStorage', CLIPBOARD_LOCAL_STORAGE_KEY], ['sessionStorage', CLIPBOARD_STORAGE_KEY]]) {
                try { if (win?.[storage]) { win[storage].setItem(CLIPBOARD_CLEARED_KEY, at); win[storage].removeItem(key); cleared = true; } } catch { /* Storage is optional. */ }
            }
            return cleared;
        };
        const buildSelectedClipboardEntry = (type, folder, options = {}) => {
            const categories = normalizeCategories(options.categories || [...CATEGORY_IDS]);
            const entry = buildClipboardEntry(type, folder, { ...options, categories });
            if (entry && schema) entry.payload = selectPayload(folder, categories);
            else if (categories.length !== CATEGORY_IDS.length) throw new Error('Load folder settings categories first.');
            if (entry) {
                entry.meta.copiedActionCount = entry.payload.actions.length;
                if (!categories.includes('actions')) entry.meta.droppedMemberBoundActionCount = 0;
            }
            return entry;
        };

        const summarizeClipboardEntry = (entry) => {
            const source = entry && typeof entry === 'object' ? entry : {};
            const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
            const labels = [];
            labels.push('Icon');
            labels.push('Folder settings');
            if ((Number(meta.copiedActionCount) || 0) > 0) {
                labels.push('Script actions');
            }
            return {
                sourceName: String(source.sourceName || '').trim() || 'Copied folder settings',
                copiedActionCount: Number(meta.copiedActionCount) || 0,
                droppedMemberBoundActionCount: Number(meta.droppedMemberBoundActionCount) || 0,
                labels
            };
        };

        return Object.freeze({
            normalizeType,
            normalizeFolderSettingsPayload,
            buildClipboardEntry: buildSelectedClipboardEntry,
            loadSchema, categoryForKey, normalizeCategories, selectPayload, clearClipboardEntry,
            writeClipboardEntry,
            readClipboardEntry,
            summarizeClipboardEntry
        });
    };

    return Object.freeze({
        createApi,
        CLIPBOARD_STORAGE_KEY,
        CLIPBOARD_LOCAL_STORAGE_KEY,
        SETTINGS_PAYLOAD_KEYS, CATEGORY_IDS
    });
}));
