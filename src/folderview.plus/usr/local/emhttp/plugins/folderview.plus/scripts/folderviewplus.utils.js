(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const EXPORT_SCHEMA_VERSION = 1;

    const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

    const cloneJson = (value) => JSON.parse(JSON.stringify(value));

    const normalizeFolderMap = (value) => {
        if (!isPlainObject(value)) {
            return {};
        }
        const output = {};
        for (const [id, folder] of Object.entries(value)) {
            if (!isPlainObject(folder)) {
                continue;
            }
            if (typeof folder.name !== 'string' || folder.name.trim() === '') {
                continue;
            }
            output[id] = folder;
        }
        return output;
    };

    const normalizePrefs = (prefs) => {
        const incoming = isPlainObject(prefs) ? prefs : {};
        const sortMode = ['created', 'manual', 'alpha'].includes(incoming.sortMode) ? incoming.sortMode : 'created';
        const manualOrder = Array.isArray(incoming.manualOrder) ? incoming.manualOrder.filter((id) => typeof id === 'string' && id !== '') : [];
        const autoRulesRaw = Array.isArray(incoming.autoRules) ? incoming.autoRules : [];
        const autoRules = autoRulesRaw
            .filter((rule) => isPlainObject(rule))
            .map((rule) => ({
                id: typeof rule.id === 'string' && rule.id ? rule.id : '',
                enabled: rule.enabled !== false,
                folderId: typeof rule.folderId === 'string' ? rule.folderId : '',
                kind: rule.kind === 'label' ? 'label' : 'name_regex',
                pattern: typeof rule.pattern === 'string' ? rule.pattern : '',
                labelKey: typeof rule.labelKey === 'string' ? rule.labelKey : '',
                labelValue: typeof rule.labelValue === 'string' ? rule.labelValue : ''
            }))
            .filter((rule) => rule.folderId !== '');

        return {
            sortMode,
            manualOrder,
            autoRules
        };
    };

    const orderFoldersByPrefs = (folders, prefs) => {
        const normalizedFolders = normalizeFolderMap(folders);
        const normalizedPrefs = normalizePrefs(prefs);

        if (normalizedPrefs.sortMode === 'alpha') {
            const keys = Object.keys(normalizedFolders).sort((a, b) => {
                const nameA = String(normalizedFolders[a]?.name ?? a).toLowerCase();
                const nameB = String(normalizedFolders[b]?.name ?? b).toLowerCase();
                const cmp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                return cmp !== 0 ? cmp : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            });
            const ordered = {};
            for (const key of keys) {
                ordered[key] = normalizedFolders[key];
            }
            return ordered;
        }

        if (normalizedPrefs.sortMode === 'manual') {
            const ordered = {};
            for (const id of normalizedPrefs.manualOrder) {
                if (Object.prototype.hasOwnProperty.call(normalizedFolders, id)) {
                    ordered[id] = normalizedFolders[id];
                    delete normalizedFolders[id];
                }
            }
            for (const [id, folder] of Object.entries(normalizedFolders)) {
                ordered[id] = folder;
            }
            return ordered;
        }

        return normalizedFolders;
    };

    const buildFullExportPayload = ({ type, folders, pluginVersion }) => ({
        schemaVersion: EXPORT_SCHEMA_VERSION,
        pluginVersion: pluginVersion || '0.0.0',
        exportedAt: new Date().toISOString(),
        type,
        mode: 'full',
        folders: normalizeFolderMap(folders)
    });

    const buildSingleExportPayload = ({ type, folderId, folder, pluginVersion }) => ({
        schemaVersion: EXPORT_SCHEMA_VERSION,
        pluginVersion: pluginVersion || '0.0.0',
        exportedAt: new Date().toISOString(),
        type,
        mode: 'single',
        folderId: folderId || null,
        folder: isPlainObject(folder) ? folder : {}
    });

    const parseImportPayload = (payload, expectedType) => {
        if (!isPlainObject(payload)) {
            return { ok: false, error: 'Import file must contain a JSON object.' };
        }

        const hasSchema = Object.prototype.hasOwnProperty.call(payload, 'schemaVersion');
        if (hasSchema) {
            const schemaVersion = Number(payload.schemaVersion);
            if (!Number.isFinite(schemaVersion)) {
                return { ok: false, error: 'Invalid schema version in import file.' };
            }
            if (schemaVersion > EXPORT_SCHEMA_VERSION) {
                return { ok: false, error: `Unsupported schema version ${schemaVersion}.` };
            }
            if (payload.type && expectedType && payload.type !== expectedType) {
                return { ok: false, error: `Import type "${payload.type}" does not match "${expectedType}".` };
            }

            const mode = payload.mode === 'single' ? 'single' : 'full';
            if (mode === 'single') {
                if (!isPlainObject(payload.folder) || typeof payload.folder.name !== 'string' || payload.folder.name.trim() === '') {
                    return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
                }
                return {
                    ok: true,
                    schemaVersion,
                    pluginVersion: payload.pluginVersion || null,
                    exportedAt: payload.exportedAt || null,
                    type: payload.type || expectedType || null,
                    mode,
                    legacy: false,
                    folder: payload.folder,
                    folderId: typeof payload.folderId === 'string' && payload.folderId !== '' ? payload.folderId : null,
                    folders: {}
                };
            }

            const folders = normalizeFolderMap(payload.folders);
            return {
                ok: true,
                schemaVersion,
                pluginVersion: payload.pluginVersion || null,
                exportedAt: payload.exportedAt || null,
                type: payload.type || expectedType || null,
                mode,
                legacy: false,
                folder: null,
                folderId: null,
                folders
            };
        }

        // Legacy format support
        if (typeof payload.name === 'string' && payload.name.trim() !== '') {
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: expectedType || null,
                mode: 'single',
                legacy: true,
                folder: payload,
                folderId: null,
                folders: {}
            };
        }

        return {
            ok: true,
            schemaVersion: null,
            pluginVersion: null,
            exportedAt: null,
            type: expectedType || null,
            mode: 'full',
            legacy: true,
            folder: null,
            folderId: null,
            folders: normalizeFolderMap(payload)
        };
    };

    const summarizeImport = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const existingIds = Object.keys(current);
        const result = {
            mode,
            creates: [],
            updates: [],
            unchanged: [],
            skipped: [],
            deletes: [],
            notes: []
        };

        if (parsed.mode === 'single') {
            const singleName = parsed.folder?.name || 'Unnamed folder';
            if (parsed.folderId) {
                const exists = Object.prototype.hasOwnProperty.call(current, parsed.folderId);
                if (exists) {
                    const same = JSON.stringify(current[parsed.folderId]) === JSON.stringify(parsed.folder);
                    if (mode === 'skip') {
                        result.skipped.push({ id: parsed.folderId, name: singleName });
                    } else if (same) {
                        result.unchanged.push({ id: parsed.folderId, name: singleName });
                    } else {
                        result.updates.push({ id: parsed.folderId, name: singleName });
                    }
                } else {
                    result.creates.push({ id: parsed.folderId, name: singleName });
                }
                if (mode === 'replace') {
                    result.deletes = existingIds
                        .filter((id) => id !== parsed.folderId)
                        .map((id) => ({ id, name: current[id]?.name || id }));
                }
                return result;
            }

            const sameName = existingIds.find((id) => String(current[id]?.name || '') === String(singleName));
            if (mode === 'skip' && sameName) {
                result.skipped.push({ id: sameName, name: singleName });
            } else {
                result.creates.push({ id: null, name: singleName });
            }
            if (mode === 'replace') {
                result.deletes = existingIds.map((id) => ({ id, name: current[id]?.name || id }));
                result.notes.push('Replace mode with single-folder import will delete all current folders first.');
            }
            return result;
        }

        const incoming = normalizeFolderMap(parsed.folders);
        const incomingIds = Object.keys(incoming);
        for (const id of incomingIds) {
            const existing = current[id];
            if (!existing) {
                result.creates.push({ id, name: incoming[id]?.name || id });
                continue;
            }
            const same = JSON.stringify(existing) === JSON.stringify(incoming[id]);
            if (mode === 'skip') {
                result.skipped.push({ id, name: incoming[id]?.name || id });
            } else if (same) {
                result.unchanged.push({ id, name: incoming[id]?.name || id });
            } else {
                result.updates.push({ id, name: incoming[id]?.name || id });
            }
        }

        if (mode === 'replace') {
            for (const id of existingIds) {
                if (!Object.prototype.hasOwnProperty.call(incoming, id)) {
                    result.deletes.push({ id, name: current[id]?.name || id });
                }
            }
        }

        return result;
    };

    const buildImportOperations = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const operations = {
            mode,
            upserts: [],
            creates: [],
            deletes: []
        };

        if (parsed.mode === 'single') {
            if (mode === 'replace') {
                operations.deletes = Object.keys(current);
            }

            if (parsed.folderId) {
                if (!(mode === 'skip' && Object.prototype.hasOwnProperty.call(current, parsed.folderId))) {
                    operations.upserts.push({ id: parsed.folderId, folder: cloneJson(parsed.folder) });
                }
                return operations;
            }

            const singleName = String(parsed.folder?.name || '');
            const sameNameId = Object.keys(current).find((id) => String(current[id]?.name || '') === singleName);
            if (!(mode === 'skip' && sameNameId)) {
                operations.creates.push({ folder: cloneJson(parsed.folder) });
            }
            return operations;
        }

        const incoming = normalizeFolderMap(parsed.folders);
        for (const [id, folder] of Object.entries(incoming)) {
            if (mode === 'skip' && Object.prototype.hasOwnProperty.call(current, id)) {
                continue;
            }
            operations.upserts.push({ id, folder: cloneJson(folder) });
        }

        if (mode === 'replace') {
            operations.deletes = Object.keys(current).filter((id) => !Object.prototype.hasOwnProperty.call(incoming, id));
        }

        return operations;
    };

    const getAutoRuleMatches = ({ rules, folderId, names, infoByName, type }) => {
        const allNames = Array.isArray(names) ? names : [];
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const filteredRules = (Array.isArray(rules) ? rules : [])
            .filter((rule) => isPlainObject(rule))
            .filter((rule) => rule.enabled !== false)
            .filter((rule) => String(rule.folderId || '') === String(folderId));

        const matches = [];
        for (const name of allNames) {
            for (const rule of filteredRules) {
                if (rule.kind === 'name_regex') {
                    if (!rule.pattern) {
                        continue;
                    }
                    try {
                        const regex = new RegExp(rule.pattern);
                        if (regex.test(name)) {
                            matches.push(name);
                            break;
                        }
                    } catch (err) {
                        continue;
                    }
                    continue;
                }

                if (rule.kind === 'label') {
                    if (type !== 'docker') {
                        continue;
                    }
                    const key = String(rule.labelKey || '');
                    if (!key) {
                        continue;
                    }
                    const labels = infos[name]?.Labels || infos[name]?.info?.Config?.Labels || {};
                    const labelValue = labels[key];
                    if (typeof labelValue === 'undefined') {
                        continue;
                    }
                    if (rule.labelValue === '' || String(labelValue) === String(rule.labelValue)) {
                        matches.push(name);
                        break;
                    }
                }
            }
        }
        return Array.from(new Set(matches));
    };

    return {
        EXPORT_SCHEMA_VERSION,
        normalizeFolderMap,
        normalizePrefs,
        orderFoldersByPrefs,
        buildFullExportPayload,
        buildSingleExportPayload,
        parseImportPayload,
        summarizeImport,
        buildImportOperations,
        getAutoRuleMatches
    };
}));
