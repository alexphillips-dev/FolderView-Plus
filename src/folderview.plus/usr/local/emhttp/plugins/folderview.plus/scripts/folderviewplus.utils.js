(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const EXPORT_SCHEMA_VERSION = 1;
    const RULE_KINDS = [
        'name_regex',
        'label',
        'label_contains',
        'label_starts_with',
        'image_regex',
        'compose_project_regex'
    ];
    const RULE_EFFECTS = ['include', 'exclude'];
    const LEGACY_FOLDER_LABEL_KEYS = ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
    const DEFAULT_FOLDER_STATUS_COLORS = {
        started: '#ffffff',
        paused: '#b8860b',
        stopped: '#ff4d4d'
    };

    const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

    const cloneJson = (value) => JSON.parse(JSON.stringify(value));

    const normalizeHexColor = (value, fallback) => {
        if (typeof value !== 'string') {
            return fallback;
        }
        const trimmed = value.trim();
        const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
        if (!hexMatch.test(trimmed)) {
            return fallback;
        }
        if (trimmed.length === 4) {
            return (
                '#' +
                trimmed
                    .slice(1)
                    .split('')
                    .map((ch) => ch + ch)
                    .join('')
                    .toLowerCase()
            );
        }
        return trimmed.toLowerCase();
    };

    const getFolderStatusColors = (settings) => {
        const source = isPlainObject(settings) ? settings : {};
        return {
            started: normalizeHexColor(source.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started),
            paused: normalizeHexColor(source.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused),
            stopped: normalizeHexColor(source.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped)
        };
    };

    const clampNumber = (value, min, max, fallback) => {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }
        if (number < min) {
            return min;
        }
        if (number > max) {
            return max;
        }
        return number;
    };

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
        const defaultSchedule = {
            enabled: false,
            intervalHours: 24,
            retention: 25,
            lastRunAt: ''
        };
        const autoRules = autoRulesRaw
            .filter((rule) => isPlainObject(rule))
            .map((rule) => ({
                id: typeof rule.id === 'string' && rule.id ? rule.id : '',
                enabled: rule.enabled !== false,
                folderId: typeof rule.folderId === 'string' ? rule.folderId : '',
                kind: RULE_KINDS.includes(rule.kind) ? rule.kind : 'name_regex',
                effect: RULE_EFFECTS.includes(rule.effect) ? rule.effect : 'include',
                pattern: typeof rule.pattern === 'string' ? rule.pattern : '',
                labelKey: typeof rule.labelKey === 'string' ? rule.labelKey : '',
                labelValue: typeof rule.labelValue === 'string' ? rule.labelValue : ''
            }))
            .filter((rule) => rule.folderId !== '');
        const incomingBadges = isPlainObject(incoming.badges) ? incoming.badges : {};
        const badges = {
            running: !Object.prototype.hasOwnProperty.call(incomingBadges, 'running') ? true : incomingBadges.running !== false,
            stopped: incomingBadges.stopped === true,
            updates: !Object.prototype.hasOwnProperty.call(incomingBadges, 'updates') ? true : incomingBadges.updates !== false
        };
        const backupScheduleRaw = isPlainObject(incoming.backupSchedule) ? incoming.backupSchedule : {};
        const backupSchedule = {
            enabled: backupScheduleRaw.enabled === true,
            intervalHours: clampNumber(backupScheduleRaw.intervalHours, 1, 168, defaultSchedule.intervalHours),
            retention: clampNumber(backupScheduleRaw.retention, 1, 200, defaultSchedule.retention),
            lastRunAt: typeof backupScheduleRaw.lastRunAt === 'string' ? backupScheduleRaw.lastRunAt : ''
        };
        const liveRefreshEnabled = !Object.prototype.hasOwnProperty.call(incoming, 'liveRefreshEnabled') ? true : incoming.liveRefreshEnabled !== false;
        const liveRefreshSeconds = clampNumber(incoming.liveRefreshSeconds, 10, 300, 20);
        const performanceMode = incoming.performanceMode === true;
        const lazyPreviewEnabled = !Object.prototype.hasOwnProperty.call(incoming, 'lazyPreviewEnabled') ? true : incoming.lazyPreviewEnabled !== false;
        const lazyPreviewThreshold = clampNumber(incoming.lazyPreviewThreshold, 10, 200, 30);

        return {
            sortMode,
            manualOrder,
            autoRules,
            badges,
            liveRefreshEnabled,
            liveRefreshSeconds,
            performanceMode,
            lazyPreviewEnabled,
            lazyPreviewThreshold,
            backupSchedule
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

    const buildImportDiffRows = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const operations = buildImportOperations(current, parsed, mode);
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

    const regexMatches = (pattern, input) => {
        if (!pattern) {
            return false;
        }
        try {
            return new RegExp(pattern).test(input);
        } catch (err) {
            return false;
        }
    };

    const getDockerLabels = (infos, name) => {
        const item = infos[name] || {};
        return item.Labels || item.info?.Config?.Labels || {};
    };

    const getDockerImage = (infos, name) => {
        const item = infos[name] || {};
        return String(item.info?.Config?.Image || item.Image || '');
    };

    const getComposeProject = (infos, name) => {
        const labels = getDockerLabels(infos, name);
        return String(labels['com.docker.compose.project'] || labels['com.docker.compose.project.working_dir'] || '');
    };

    const getFolderLabelValue = (labels) => {
        const source = isPlainObject(labels) ? labels : {};
        for (const key of LEGACY_FOLDER_LABEL_KEYS) {
            if (typeof source[key] === 'string' && source[key].trim() !== '') {
                return source[key].trim();
            }
        }
        return '';
    };

    const ruleMatchesItem = (rule, name, infos, type) => {
        if (!isPlainObject(rule)) {
            return false;
        }
        if (rule.kind === 'name_regex') {
            return regexMatches(String(rule.pattern || ''), name);
        }

        if (type !== 'docker') {
            return false;
        }

        if (rule.kind === 'label') {
            if (type !== 'docker') {
                return false;
            }
            const key = String(rule.labelKey || '');
            if (!key) {
                return false;
            }
            const labels = getDockerLabels(infos, name);
            const labelValue = labels[key];
            if (typeof labelValue === 'undefined') {
                return false;
            }
            return rule.labelValue === '' || String(labelValue) === String(rule.labelValue);
        }

        if (rule.kind === 'label_contains') {
            const key = String(rule.labelKey || '');
            const expected = String(rule.labelValue || '');
            if (!key || expected === '') {
                return false;
            }
            const labels = getDockerLabels(infos, name);
            const labelValue = labels[key];
            if (typeof labelValue === 'undefined') {
                return false;
            }
            return String(labelValue).toLowerCase().includes(expected.toLowerCase());
        }

        if (rule.kind === 'label_starts_with') {
            const key = String(rule.labelKey || '');
            const expected = String(rule.labelValue || '');
            if (!key || expected === '') {
                return false;
            }
            const labels = getDockerLabels(infos, name);
            const labelValue = labels[key];
            if (typeof labelValue === 'undefined') {
                return false;
            }
            return String(labelValue).toLowerCase().startsWith(expected.toLowerCase());
        }

        if (rule.kind === 'image_regex') {
            return regexMatches(String(rule.pattern || ''), getDockerImage(infos, name));
        }

        if (rule.kind === 'compose_project_regex') {
            return regexMatches(String(rule.pattern || ''), getComposeProject(infos, name));
        }

        return false;
    };

    const getAutoRuleDecision = ({ rules, name, infoByName, type }) => {
        const infos = isPlainObject(infoByName) ? infoByName : {};
        let firstIncludeRule = null;
        for (const rule of (Array.isArray(rules) ? rules : [])) {
            if (!isPlainObject(rule) || rule.enabled === false) {
                continue;
            }
            if (ruleMatchesItem(rule, name, infos, type)) {
                if (rule.effect === 'exclude') {
                    return {
                        assignedRule: null,
                        blockedBy: rule,
                        matchedRule: rule
                    };
                }
                if (!firstIncludeRule) {
                    firstIncludeRule = rule;
                }
            }
        }
        if (firstIncludeRule) {
            return {
                assignedRule: firstIncludeRule,
                blockedBy: null,
                matchedRule: firstIncludeRule
            };
        }
        return {
            assignedRule: null,
            blockedBy: null,
            matchedRule: null
        };
    };

    const getAutoRuleFirstMatch = ({ rules, name, infoByName, type }) => {
        const decision = getAutoRuleDecision({ rules, name, infoByName, type });
        return decision.assignedRule;
    };

    const getAutoRuleMatches = ({ rules, folderId, names, infoByName, type }) => {
        const allNames = Array.isArray(names) ? names : [];
        const targetFolderId = String(folderId || '');

        const matches = [];
        for (const name of allNames) {
            const firstMatch = getAutoRuleFirstMatch({
                rules,
                name,
                infoByName,
                type
            });
            if (firstMatch && String(firstMatch.folderId || '') === targetFolderId) {
                matches.push(name);
            }
        }
        return Array.from(new Set(matches));
    };

    const getConflictReport = ({ type, folders, prefs, infoByName }) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const folderMap = normalizeFolderMap(folders);
        const normalizedPrefs = normalizePrefs(prefs);
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const names = Object.keys(infos).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

        const rows = [];
        let conflictCount = 0;

        for (const name of names) {
            const matchedFolders = [];
            const labels = getDockerLabels(infos, name);
            const legacyLabelTarget = normalizedType === 'docker' ? getFolderLabelValue(labels) : '';
            const ruleDecision = getAutoRuleDecision({
                rules: normalizedPrefs.autoRules,
                name,
                infoByName: infos,
                type: normalizedType
            });

            for (const [folderId, folder] of Object.entries(folderMap)) {
                const reasons = [];
                const members = Array.isArray(folder.containers) ? folder.containers.map((item) => String(item)) : [];
                if (members.includes(name)) {
                    reasons.push('manual');
                }
                if (regexMatches(String(folder.regex || ''), name)) {
                    reasons.push('regex');
                }
                if (normalizedType === 'docker' && legacyLabelTarget && legacyLabelTarget === String(folder.name || '')) {
                    reasons.push('label');
                }
                if (ruleDecision.assignedRule && String(ruleDecision.assignedRule.folderId || '') === String(folderId)) {
                    reasons.push('rule');
                }
                if (reasons.length) {
                    matchedFolders.push({
                        folderId,
                        folderName: String(folder.name || folderId),
                        reasons
                    });
                }
            }

            const hasConflict = matchedFolders.length > 1;
            if (hasConflict) {
                conflictCount += 1;
            }

            rows.push({
                item: name,
                type: normalizedType,
                hasConflict,
                matchedFolderCount: matchedFolders.length,
                matchedFolders,
                blockedByRule: ruleDecision.blockedBy ? {
                    id: String(ruleDecision.blockedBy.id || ''),
                    folderId: String(ruleDecision.blockedBy.folderId || ''),
                    kind: String(ruleDecision.blockedBy.kind || 'name_regex')
                } : null
            });
        }

        return {
            totalItems: names.length,
            conflictingItems: conflictCount,
            rows
        };
    };

    return {
        EXPORT_SCHEMA_VERSION,
        RULE_KINDS,
        RULE_EFFECTS,
        LEGACY_FOLDER_LABEL_KEYS,
        DEFAULT_FOLDER_STATUS_COLORS,
        normalizeFolderMap,
        normalizePrefs,
        orderFoldersByPrefs,
        getFolderStatusColors,
        buildFullExportPayload,
        buildSingleExportPayload,
        parseImportPayload,
        summarizeImport,
        buildImportOperations,
        buildImportDiffRows,
        diffFolderFields,
        ruleMatchesItem,
        getAutoRuleDecision,
        getAutoRuleMatches,
        getAutoRuleFirstMatch,
        getFolderLabelValue,
        getConflictReport
    };
}));
