(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'), require('./folderviewplus.utils-prefs.js'), require('./folderviewplus.utils-ordering.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityTransfer = factory(modules.utilityFoundation, modules.utilityNormalization, modules.utilityPrefs, modules.utilityOrdering);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation, utilityNormalization, utilityPrefs, utilityOrdering) {
    'use strict';
    const utilityDependencies = Object.assign({}, utilityFoundation, utilityNormalization, utilityPrefs, utilityOrdering);
    const {
        cloneJson,
        isPlainObject,
        EXPORT_SCHEMA_VERSION,
        normalizeFolderRecord,
        normalizeFolderMap
    } = utilityDependencies;

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

    const buildImportTrustMeta = ({
        legacy = false,
        schemaVersion = null,
        pluginVersion = null,
        exportedAt = null,
        declaredType = '',
        expectedType = ''
    } = {}) => {
        if (legacy === true) {
            return {
                level: 'legacy',
                label: 'Legacy compatibility',
                reason: 'Legacy folder.view2/folder.view3 format detected. Review changes before apply.'
            };
        }

        const normalizedDeclaredType = String(declaredType || '').trim().toLowerCase();
        const normalizedExpectedType = String(expectedType || '').trim().toLowerCase();
        const typeMatches = (
            normalizedExpectedType === ''
            || normalizedDeclaredType === ''
            || normalizedDeclaredType === normalizedExpectedType
        );

        const pluginVersionText = String(pluginVersion || '').trim();
        const exportedAtText = String(exportedAt || '').trim();
        const hasPluginVersion = pluginVersionText !== '';
        const hasValidExportedAt = exportedAtText !== '' && Number.isFinite(Date.parse(exportedAtText));
        const hasKnownSchema = Number.isFinite(Number(schemaVersion));

        if (hasKnownSchema && hasPluginVersion && hasValidExportedAt && typeMatches) {
            return {
                level: 'trusted',
                label: `Validated schema v${Math.round(Number(schemaVersion))}`,
                reason: 'Schema metadata and source details validated.'
            };
        }

        const reasons = [];
        if (!hasPluginVersion) {
            reasons.push('missing plugin version');
        }
        if (!hasValidExportedAt) {
            reasons.push('invalid export timestamp');
        }
        if (!typeMatches) {
            reasons.push('type mismatch');
        }
        if (!hasKnownSchema) {
            reasons.push('missing schema metadata');
        }

        const reasonText = reasons.length
            ? `Validation warning: ${reasons.join(', ')}.`
            : 'Validation warning: metadata could not be fully validated.';
        return {
            level: 'untrusted',
            label: 'Validation warning',
            reason: reasonText
        };
    };

    const parseImportPayload = (payload, expectedType) => {
        if (!isPlainObject(payload) || Object.prototype.hasOwnProperty.call(payload, 'fv3_export_version')) {
            return !isPlainObject(payload) ? { ok: false, error: 'Import file must contain a JSON object.' } : { ok: false, migration: true, error: 'This is a complete FolderView3 backup. Use FolderView3 migration in Recovery to review both folder types, settings and appearance.' };
        }

        const normalizedExpectedType = typeof expectedType === 'string' ? expectedType.trim().toLowerCase() : '';
        const hasSchema = Object.prototype.hasOwnProperty.call(payload, 'schemaVersion');
        if (hasSchema) {
            const schemaVersion = Number(payload.schemaVersion);
            if (!Number.isFinite(schemaVersion)) {
                return { ok: false, error: 'Invalid schema version in import file.' };
            }
            if (schemaVersion > EXPORT_SCHEMA_VERSION) {
                return { ok: false, error: `Unsupported schema version ${schemaVersion}.` };
            }
            const declaredType = typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : '';
            if (declaredType !== '' && !['docker', 'vm'].includes(declaredType)) {
                return { ok: false, error: `Import file type "${payload.type}" is invalid.` };
            }
            if (normalizedExpectedType && declaredType === '') {
                return { ok: false, error: 'Import file is missing required type metadata.' };
            }
            if (declaredType !== '' && normalizedExpectedType && declaredType !== normalizedExpectedType) {
                return { ok: false, error: `Import type "${declaredType}" does not match "${normalizedExpectedType}".` };
            }

            const mode = payload.mode === 'single' ? 'single' : 'full';
            const pluginVersion = payload.pluginVersion || null;
            const exportedAt = payload.exportedAt || null;
            const resolvedType = declaredType || normalizedExpectedType || null;
            const trust = buildImportTrustMeta({
                legacy: false,
                schemaVersion,
                pluginVersion,
                exportedAt,
                declaredType,
                expectedType: normalizedExpectedType
            });
            if (mode === 'single') {
                const normalizedFolder = normalizeFolderRecord(payload.folder);
                if (!normalizedFolder) {
                    return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
                }
                return {
                    ok: true,
                    schemaVersion,
                    pluginVersion,
                    exportedAt,
                    type: resolvedType,
                    declaredType: declaredType || null,
                    mode,
                    legacy: false,
                    trust,
                    folder: normalizedFolder,
                    folderId: typeof payload.folderId === 'string' && payload.folderId !== '' ? payload.folderId : null,
                    folders: {}
                };
            }

            const folders = normalizeFolderMap(payload.folders);
            return {
                ok: true,
                schemaVersion,
                pluginVersion,
                exportedAt,
                type: resolvedType,
                declaredType: declaredType || null,
                mode,
                legacy: false,
                trust,
                folder: null,
                folderId: null,
                folders
            };
        }

        // Legacy format support
        if (isPlainObject(payload.folder) && typeof payload.folder.name === 'string' && payload.folder.name.trim() !== '') {
            const normalizedFolder = normalizeFolderRecord(payload.folder);
            if (!normalizedFolder) {
                return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
            }
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: normalizedExpectedType || null,
                declaredType: null,
                mode: 'single',
                legacy: true,
                trust: buildImportTrustMeta({ legacy: true }),
                folder: normalizedFolder,
                folderId: typeof payload.folderId === 'string' && payload.folderId.trim() !== '' ? payload.folderId.trim() : null,
                folders: {}
            };
        }

        if (typeof payload.name === 'string' && payload.name.trim() !== '') {
            const normalizedFolder = normalizeFolderRecord(payload);
            if (!normalizedFolder) {
                return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
            }
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: normalizedExpectedType || null,
                declaredType: null,
                mode: 'single',
                legacy: true,
                trust: buildImportTrustMeta({ legacy: true }),
                folder: normalizedFolder,
                folderId: null,
                folders: {}
            };
        }

        const wrappedByType = normalizedExpectedType && isPlainObject(payload[normalizedExpectedType]) ? payload[normalizedExpectedType] : null;
        const wrappedByFolders = isPlainObject(payload.folders) ? payload.folders : null;
        const wrappedSource = wrappedByType || wrappedByFolders;
        if (wrappedSource) {
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: normalizedExpectedType || null,
                declaredType: null,
                mode: 'full',
                legacy: true,
                trust: buildImportTrustMeta({ legacy: true }),
                folder: null,
                folderId: null,
                folders: normalizeFolderMap(wrappedSource)
            };
        }

        return {
            ok: true,
            schemaVersion: null,
            pluginVersion: null,
            exportedAt: null,
            type: normalizedExpectedType || null,
            declaredType: null,
            mode: 'full',
            legacy: true,
            trust: buildImportTrustMeta({ legacy: true }),
            folder: null,
            folderId: null,
            folders: normalizeFolderMap(payload)
        };
    };

    const normalizeImportPathSegment = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[\\/]+/g, '/');

    const buildImportPathData = (foldersMap) => {
        const folders = normalizeFolderMap(foldersMap);
        const ids = Object.keys(folders);
        const idSet = new Set(ids);
        const parentById = {};
        for (const id of ids) {
            const rawParent = String(folders[id]?.parentId || '').trim();
            parentById[id] = rawParent && rawParent !== id && idSet.has(rawParent) ? rawParent : '';
        }
        const pathById = {};
        const building = new Set();
        const buildPath = (id) => {
            const safeId = String(id || '').trim();
            if (!safeId || !Object.prototype.hasOwnProperty.call(folders, safeId)) {
                return '';
            }
            if (Object.prototype.hasOwnProperty.call(pathById, safeId)) {
                return pathById[safeId];
            }
            if (building.has(safeId)) {
                pathById[safeId] = `__cycle__/${normalizeImportPathSegment(folders[safeId]?.name || safeId)}`;
                return pathById[safeId];
            }
            building.add(safeId);
            const parentId = parentById[safeId];
            const parentPath = parentId ? buildPath(parentId) : '';
            const namePart = normalizeImportPathSegment(folders[safeId]?.name || safeId) || safeId.toLowerCase();
            const ownPath = parentPath ? `${parentPath}/${namePart}` : namePart;
            pathById[safeId] = ownPath;
            building.delete(safeId);
            return ownPath;
        };
        for (const id of ids) {
            buildPath(id);
        }
        const indexByPath = {};
        for (const [id, path] of Object.entries(pathById)) {
            const key = String(path || '').trim();
            if (!key) {
                continue;
            }
            if (!Array.isArray(indexByPath[key])) {
                indexByPath[key] = [];
            }
            indexByPath[key].push(id);
        }
        return { folders, parentById, pathById, indexByPath };
    };

    const resolveImportPathCollisions = (currentFolders, incomingFolders) => {
        const current = buildImportPathData(currentFolders);
        const incoming = buildImportPathData(incomingFolders);
        const currentIds = new Set(Object.keys(current.folders));
        const incomingIds = Object.keys(incoming.folders);
        const resolvedIdByIncomingId = {};
        // An inferred path match must never consume another explicit incoming identity.
        const usedTargetIds = new Set(incomingIds);
        const mappings = [];
        const conflicts = [];

        for (const incomingId of incomingIds) {
            let targetId = incomingId;
            const incomingPath = String(incoming.pathById[incomingId] || '').trim();
            if (currentIds.has(incomingId)) {
                targetId = incomingId;
            } else if (incomingPath && Array.isArray(current.indexByPath[incomingPath]) && current.indexByPath[incomingPath].length === 1) {
                targetId = current.indexByPath[incomingPath][0];

            } else if (incomingPath && Array.isArray(current.indexByPath[incomingPath]) && current.indexByPath[incomingPath].length > 1) {
                conflicts.push({
                    sourceId: incomingId,
                    path: incomingPath,
                    reason: `Ambiguous path matches ${current.indexByPath[incomingPath].length} existing folders`
                });
            }

            if (targetId !== incomingId && (usedTargetIds.has(targetId)
                || (incoming.indexByPath[incomingPath] || []).length > 1)) {
                conflicts.push({
                    sourceId: incomingId,
                    path: incomingPath,
                    reason: `Multiple incoming folders resolved to target "${targetId}"`
                });
                targetId = incomingId;
            }
            if (targetId !== incomingId) {
                mappings.push({ sourceId: incomingId, targetId, path: incomingPath });
            }
            resolvedIdByIncomingId[incomingId] = targetId;
            usedTargetIds.add(targetId);
        }

        return {
            resolvedIdByIncomingId,
            mappings,
            conflicts
        };
    };

    const remapImportedFolderParent = (folder, incomingMap, resolvedIdByIncomingId) => {
        const source = isPlainObject(folder) ? cloneJson(folder) : {};
        const rawParent = String(source.parentId || '').trim();
        if (!rawParent) {
            source.parentId = '';
            return source;
        }
        if (Object.prototype.hasOwnProperty.call(incomingMap, rawParent)) {
            source.parentId = String(resolvedIdByIncomingId[rawParent] || '').trim();
            return source;
        }
        source.parentId = rawParent;
        return source;
    };

    const resolveImportPlan = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const incoming = parsed.mode === 'single' ? null : normalizeFolderMap(parsed.folders);
        const pathResolution = incoming ? resolveImportPathCollisions(current, incoming) : null;
        const entries = [], targetIds = new Set();
        for (const [sourceId, folder] of Object.entries(incoming || {})) {
            const id = String(pathResolution.resolvedIdByIncomingId[sourceId] || sourceId).trim();
            if (!id || targetIds.has(id)) continue;
            targetIds.add(id);
            const resolvedFolder = remapImportedFolderParent(folder, incoming, pathResolution.resolvedIdByIncomingId);
            const existing = current[id];
            entries.push({ id, sourceId, folder: resolvedFolder, pathMapped: id !== sourceId, existing,
                same: Boolean(existing) && JSON.stringify(existing) === JSON.stringify(resolvedFolder) });
        }
        return { current, mode, entries, targetIds, pathResolution };
    };

    const summarizeImport = (existingFolders, parsed, importMode, resolvedPlan = null) => {
        const { current, mode, entries, targetIds, pathResolution } = resolvedPlan || resolveImportPlan(existingFolders, parsed, importMode);
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

        for (const entry of entries) {
            const action = !entry.existing ? 'creates'
                : mode === 'skip' ? 'skipped' : entry.same ? 'unchanged' : 'updates';
            result[action].push({ id: entry.id, name: entry.folder?.name || entry.id });
        }

        if (mode === 'replace') {
            result.deletes = existingIds.filter((id) => !targetIds.has(id))
                .map((id) => ({ id, name: current[id]?.name || id }));
        }

        if (pathResolution.mappings.length > 0) {
            result.notes.push(`Path resolver: mapped ${pathResolution.mappings.length} incoming folder id(s) to existing parent/name path matches.`);
        }
        if (pathResolution.conflicts.length > 0) {
            result.notes.push(`Path conflicts: ${pathResolution.conflicts.length} incoming folder(s) had ambiguous path collisions and kept original ids.`);
        }

        return result;
    };

    const buildImportOperations = (existingFolders, parsed, importMode, resolvedPlan = null) => {
        const { current, mode, entries, targetIds, pathResolution } = resolvedPlan || resolveImportPlan(existingFolders, parsed, importMode);
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

        operations.upserts = entries
            .filter((entry) => mode !== 'skip' || !entry.existing)
            .map(({ existing, same, ...operation }) => operation);
        if (mode === 'replace') {
            operations.deletes = Object.keys(current).filter((id) => !targetIds.has(id));
        }

        operations.pathMappings = pathResolution.mappings.slice();
        operations.pathConflicts = pathResolution.conflicts.slice();

        return operations;
    };

    const normalizeMemberList = (value) => {
        if (Array.isArray(value)) {
            return value.map((item) => String(item)).filter((item) => item !== '');
        }
        if (isPlainObject(value)) {
            return Object.keys(value).map((item) => String(item)).filter((item) => item !== '');
        }
        return [];
    };

    const diffFolderFields = (existingFolder, incomingFolder) => {
        const current = isPlainObject(existingFolder) ? existingFolder : {};
        const next = isPlainObject(incomingFolder) ? incomingFolder : {};
        const fields = [];

        if (String(current.name || '') !== String(next.name || '')) {
            fields.push('name');
        }
        if (String(current.icon || '') !== String(next.icon || '')) {
            fields.push('icon');
        }
        if (String(current.regex || '') !== String(next.regex || '')) {
            fields.push('regex');
        }
        if (String(current.parentId || '') !== String(next.parentId || '')) {
            fields.push('parent');
        }
        if (JSON.stringify(current.settings || {}) !== JSON.stringify(next.settings || {})) {
            fields.push('settings');
        }
        if (JSON.stringify(current.actions || []) !== JSON.stringify(next.actions || [])) {
            fields.push('actions');
        }

        const currentMembers = normalizeMemberList(current.containers);
        const nextMembers = normalizeMemberList(next.containers);
        if (JSON.stringify(currentMembers) !== JSON.stringify(nextMembers)) {
            fields.push('members');
        }

        return fields;
    };

    const buildImportDiffRows = (existingFolders, parsed, importMode, resolvedPlan = null) => {
        const plan = resolvedPlan || resolveImportPlan(existingFolders, parsed, importMode);
        const { current, mode } = plan;
        const operations = plan.operations || buildImportOperations(current, parsed, mode, plan);
        const rows = [];

        for (const id of operations.deletes) {
            rows.push({
                action: 'delete',
                id,
                name: current[id]?.name || id,
                fields: ['folder']
            });
        }

        for (const item of operations.upserts) {
            const id = String(item.id || '');
            const incoming = isPlainObject(item.folder) ? item.folder : {};
            const existing = current[id];
            if (!existing) {
                rows.push({
                    action: 'create',
                    id,
                    name: incoming.name || id || 'New folder',
                    fields: ['folder']
                });
                continue;
            }

            const fields = diffFolderFields(existing, incoming);
            rows.push({
                action: fields.length ? 'update' : 'unchanged',
                id,
                name: incoming.name || existing.name || id,
                fields: fields.length ? fields : ['none']
            });
        }

        for (const item of operations.creates) {
            const incoming = isPlainObject(item.folder) ? item.folder : {};
            rows.push({
                action: 'create',
                id: null,
                name: incoming.name || 'New folder',
                fields: ['folder']
            });
        }

        return rows;
    };


    const buildImportPlan = (existingFolders, parsed, importMode) => {
        const plan = resolveImportPlan(existingFolders, parsed, importMode);
        const operations = buildImportOperations(existingFolders, parsed, importMode, plan);
        return {
            summary: summarizeImport(existingFolders, parsed, importMode, plan),
            operations,
            diffRows: buildImportDiffRows(existingFolders, parsed, importMode, { ...plan, operations })
        };
    };

    return Object.freeze({
        buildImportPlan,
        buildFullExportPayload,
        buildSingleExportPayload,
        buildImportTrustMeta,
        parseImportPayload,
        normalizeImportPathSegment,
        buildImportPathData,
        resolveImportPathCollisions,
        remapImportedFolderParent,
        summarizeImport,
        buildImportOperations,
        normalizeMemberList,
        diffFolderFields,
        buildImportDiffRows
    });
}));
