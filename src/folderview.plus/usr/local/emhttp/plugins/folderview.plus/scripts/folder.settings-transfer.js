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
    const CLIPBOARD_SCHEMA_VERSION = 1;
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
            const normalizedType = normalizeType(parsed.type);
            if (!normalizedType) {
                return null;
            }
            const normalized = normalizeFolderSettingsPayload(parsed.payload || {});
            return {
                schemaVersion: CLIPBOARD_SCHEMA_VERSION,
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

        const writeClipboardEntry = (entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }
            const serialized = JSON.stringify(entry);
            let wrote = false;
            try {
                if (typeof win?.sessionStorage !== 'undefined') {
                    win.sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, serialized);
                    wrote = true;
                }
            } catch (_error) {
                // Best effort only.
            }
            try {
                if (typeof win?.localStorage !== 'undefined') {
                    win.localStorage.setItem(CLIPBOARD_LOCAL_STORAGE_KEY, serialized);
                    wrote = true;
                }
            } catch (_error) {
                // Best effort only.
            }
            return wrote;
        };

        const readClipboardEntry = (expectedType = '') => {
            const normalizedExpectedType = normalizeType(expectedType);
            const storageReaders = [
                () => (typeof win?.sessionStorage !== 'undefined' ? win.sessionStorage.getItem(CLIPBOARD_STORAGE_KEY) : ''),
                () => (typeof win?.localStorage !== 'undefined' ? win.localStorage.getItem(CLIPBOARD_LOCAL_STORAGE_KEY) : '')
            ];
            for (const read of storageReaders) {
                try {
                    const entry = parseClipboardEntry(read());
                    if (!entry) {
                        continue;
                    }
                    if (normalizedExpectedType && entry.type !== normalizedExpectedType) {
                        continue;
                    }
                    return entry;
                } catch (_error) {
                    continue;
                }
            }
            return null;
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
            buildClipboardEntry,
            writeClipboardEntry,
            readClipboardEntry,
            summarizeClipboardEntry
        });
    };

    return Object.freeze({
        createApi,
        CLIPBOARD_STORAGE_KEY,
        CLIPBOARD_LOCAL_STORAGE_KEY,
        SETTINGS_PAYLOAD_KEYS
    });
}));
