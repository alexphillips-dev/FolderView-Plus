(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'), require('./folderviewplus.utils-prefs.js'), require('./folderviewplus.utils-transfer.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityRules = factory(modules.utilityFoundation, modules.utilityNormalization, modules.utilityPrefs, modules.utilityTransfer);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation, utilityNormalization, utilityPrefs, utilityTransfer) {
    'use strict';
    const utilityDependencies = Object.assign({}, utilityFoundation, utilityNormalization, utilityPrefs, utilityTransfer);
    const {
        isPlainObject,
        LEGACY_FOLDER_LABEL_KEYS,
        RUNTIME_ACTIONS_BY_TYPE,
        normalizeFolderMap,
        normalizePrefs,
        normalizeMemberList
    } = utilityDependencies;

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

    const basenameFromPathish = (value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) {
            return '';
        }
        const firstEntry = trimmed.split(',')[0].trim();
        if (!firstEntry) {
            return '';
        }
        const normalized = firstEntry.replace(/\\/g, '/').replace(/\/+$/, '');
        if (!normalized) {
            return '';
        }
        const parts = normalized.split('/');
        return String(parts[parts.length - 1] || '').trim();
    };

    const getComposeProjectFromLabels = (labels) => {
        const source = isPlainObject(labels) ? labels : {};

        const explicit = String(source['com.docker.compose.project'] || '').trim();
        if (explicit) {
            return explicit;
        }

        const fromWorkingDir = basenameFromPathish(source['com.docker.compose.project.working_dir']);
        if (fromWorkingDir) {
            return fromWorkingDir;
        }

        const configFiles = String(source['com.docker.compose.project.config_files'] || '').trim();
        if (configFiles) {
            const firstConfig = configFiles.split(',')[0].trim();
            if (firstConfig) {
                const normalized = firstConfig.replace(/\\/g, '/');
                const dir = normalized.split('/').slice(0, -1).join('/');
                const fromConfigDir = basenameFromPathish(dir);
                if (fromConfigDir) {
                    return fromConfigDir;
                }
            }
        }

        return '';
    };

    const isComposeManagedFromLabels = (labels) => {
        const source = isPlainObject(labels) ? labels : {};
        const manager = String(source['net.unraid.docker.managed'] || '').trim().toLowerCase();
        return manager === 'composeman' || getComposeProjectFromLabels(source) !== '';
    };

    const getComposeProject = (infos, name) => {
        const labels = getDockerLabels(infos, name);
        return getComposeProjectFromLabels(labels);
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
                return {
                    assignedRule: rule,
                    blockedBy: null,
                    matchedRule: rule
                };
            }
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

    const getEffectiveFolderMembers = ({ type, folderId, folder, names, infoByName, rules }) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const targetFolderId = String(folderId || '');
        const targetFolder = isPlainObject(folder) ? folder : {};
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const allNames = Array.isArray(names) && names.length
            ? Array.from(new Set(names.map((name) => String(name || '')).filter((name) => name !== '')))
            : Object.keys(infos);
        const reasonsByName = {};
        const addReason = (name, reason) => {
            if (!name || !reason) {
                return;
            }
            if (!reasonsByName[name]) {
                reasonsByName[name] = [];
            }
            if (!reasonsByName[name].includes(reason)) {
                reasonsByName[name].push(reason);
            }
        };

        for (const member of normalizeMemberList(targetFolder.containers)) {
            addReason(member, 'manual');
        }

        const regex = String(targetFolder.regex || '');
        if (regex) {
            for (const name of allNames) {
                if (regexMatches(regex, name)) {
                    addReason(name, 'regex');
                }
            }
        }

        if (normalizedType === 'docker') {
            const folderName = String(targetFolder.name || '').trim();
            if (folderName) {
                for (const name of allNames) {
                    const labels = getDockerLabels(infos, name);
                    if (getFolderLabelValue(labels) === folderName) {
                        addReason(name, 'label');
                    }
                }
            }
        }

        if (targetFolderId !== '') {
            for (const name of allNames) {
                const decision = getAutoRuleDecision({
                    rules,
                    name,
                    infoByName: infos,
                    type: normalizedType
                });
                const assignedFolderId = String(decision?.assignedRule?.folderId || '');
                if (assignedFolderId !== '' && assignedFolderId === targetFolderId) {
                    addReason(name, 'rule');
                }
            }
        }

        const members = Object.keys(reasonsByName).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
        return {
            members,
            reasonsByName
        };
    };

    const dockerRuntimeStateKind = (item) => {
        const source = isPlainObject(item) ? item : {};
        const nestedState = isPlainObject(source.info?.State) ? source.info.State : {};
        const running = Boolean(
            nestedState.Running
            ?? source.state
            ?? source.running
        );
        const paused = Boolean(
            nestedState.Paused
            ?? source.pause
            ?? source.paused
        );
        if (running && paused) {
            return 'paused';
        }
        if (running) {
            return 'started';
        }
        return 'stopped';
    };

    const vmRuntimeStateKind = (item) => {
        const source = isPlainObject(item) ? item : {};
        const raw = String(source.state || source.State || '').toLowerCase();
        if (raw === 'running') {
            return 'started';
        }
        if (raw === 'paused' || raw === 'unknown' || raw === 'pmsuspended') {
            return 'paused';
        }
        return 'stopped';
    };

    const isRuntimeActionAllowed = (type, action, state) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const normalizedState = ['started', 'paused', 'stopped'].includes(state) ? state : 'stopped';
        const normalizedAction = String(action || '').toLowerCase();

        if (!RUNTIME_ACTIONS_BY_TYPE[normalizedType].includes(normalizedAction)) {
            return false;
        }

        if (normalizedAction === 'start') {
            return normalizedState === 'stopped';
        }
        if (normalizedAction === 'stop') {
            return normalizedState === 'started' || normalizedState === 'paused';
        }
        if (normalizedAction === 'pause') {
            return normalizedType === 'docker'
                ? normalizedState === 'started'
                : normalizedState === 'started';
        }
        if (normalizedAction === 'resume') {
            return normalizedState === 'paused';
        }
        return false;
    };

    const skipReasonForAction = (action, state) => {
        const normalizedAction = String(action || '').toLowerCase();
        if (normalizedAction === 'start') {
            return state === 'paused' ? 'Item is paused, resume instead.' : 'Item already started.';
        }
        if (normalizedAction === 'stop') {
            return 'Item already stopped.';
        }
        if (normalizedAction === 'pause') {
            return state === 'paused' ? 'Item already paused.' : 'Item must be started before pause.';
        }
        if (normalizedAction === 'resume') {
            return state === 'started' ? 'Item already started.' : 'Item is stopped.';
        }
        return 'Action is not supported for this item.';
    };

    const planFolderRuntimeAction = ({ type, folderId, folder, names, infoByName, rules, action }) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const normalizedAction = String(action || '').toLowerCase();
        const validActions = RUNTIME_ACTIONS_BY_TYPE[normalizedType] || [];
        if (!validActions.includes(normalizedAction)) {
            return {
                type: normalizedType,
                action: normalizedAction,
                folderId: String(folderId || ''),
                requestedCount: 0,
                eligible: [],
                skipped: [],
                countsByState: { started: 0, paused: 0, stopped: 0 },
                error: 'Unsupported action.'
            };
        }

        const effectiveMembers = getEffectiveFolderMembers({
            type: normalizedType,
            folderId,
            folder,
            names,
            infoByName,
            rules
        });
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const countsByState = {
            started: 0,
            paused: 0,
            stopped: 0
        };
        const eligible = [];
        const skipped = [];

        for (const name of effectiveMembers.members) {
            const item = infos[name] || {};
            const state = normalizedType === 'docker'
                ? dockerRuntimeStateKind(item)
                : vmRuntimeStateKind(item);
            countsByState[state] = (countsByState[state] || 0) + 1;
            const canRun = isRuntimeActionAllowed(normalizedType, normalizedAction, state);
            if (canRun) {
                eligible.push({
                    name,
                    state,
                    reasons: effectiveMembers.reasonsByName[name] || []
                });
            } else {
                skipped.push({
                    name,
                    state,
                    reason: skipReasonForAction(normalizedAction, state)
                });
            }
        }

        return {
            type: normalizedType,
            action: normalizedAction,
            folderId: String(folderId || ''),
            requestedCount: effectiveMembers.members.length,
            eligible,
            skipped,
            countsByState
        };
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


    return Object.freeze({
        regexMatches,
        getDockerLabels,
        getDockerImage,
        basenameFromPathish,
        getComposeProjectFromLabels,
        isComposeManagedFromLabels,
        getComposeProject,
        getFolderLabelValue,
        ruleMatchesItem,
        getAutoRuleDecision,
        getAutoRuleFirstMatch,
        getAutoRuleMatches,
        getEffectiveFolderMembers,
        dockerRuntimeStateKind,
        vmRuntimeStateKind,
        isRuntimeActionAllowed,
        skipReasonForAction,
        planFolderRuntimeAction,
        getConflictReport
    });
}));
