(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'), require('./folderviewplus.utils-prefs.js'), require('./folderviewplus.utils-transfer.js'), require('./folderviewplus.membership.js'), require('./folderviewplus.rules-engine.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityRules = factory(modules.utilityFoundation, modules.utilityNormalization, modules.utilityPrefs, modules.utilityTransfer, modules.legacyMembership, modules.rulesEngine);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation, utilityNormalization, utilityPrefs, utilityTransfer, membership, engine) {
    'use strict';
    const utilityDependencies = Object.assign({}, utilityFoundation, utilityNormalization, utilityPrefs, utilityTransfer);
    const {
        isPlainObject,
        RUNTIME_ACTIONS_BY_TYPE,
        normalizeFolderMap,
        normalizePrefs
    } = utilityDependencies;
    const { regexMatches, getDockerLabels, getDockerImage, basenameFromPathish, getComposeProjectFromLabels, isComposeManagedFromLabels, getComposeProject, getFolderLabelValue,
        ruleMatchesItem, getAutoRuleDecision, getAutoRuleFirstMatch, getAutoRuleMatches, buildLegacyMembership, reconcileLegacyMatchCache, getEffectiveFolderMembers, buildMembershipSnapshot, getMembershipSignature, getMembershipBranchMembers, compileRuleSet } = engine;

    const getMembershipSnapshotFromCache = (cache) => cache?.[Symbol.for('folderview.plus.membership')] || null;
    const buildFolderMatchCache = (options) => {
        const snapshot = buildMembershipSnapshot(options);
        const cache = Object.fromEntries(Object.entries(snapshot.matchCache).map(([id, buckets]) => [id, Object.fromEntries(Object.entries(buckets).map(([key, names]) => [key, [...names]]))]));
        Object.defineProperty(cache, Symbol.for('folderview.plus.membership'), { value: snapshot });
        return cache;
    };

    const dockerRuntimeStateKind = (item) => {
        const source = isPlainObject(item) ? item : {};
        const nestedState = isPlainObject(source.info?.State) ? source.info.State : {};
        const paused = nestedState.Paused ?? source.pause ?? source.paused;
        const explicitRunning = nestedState.Running ?? (typeof source.state === 'boolean' ? source.state : null);
        if (explicitRunning != null) {
            return Boolean(explicitRunning)
                ? (Boolean(paused) ? 'paused' : 'started')
                : 'stopped';
        }
        const state = typeof source.state === 'string' ? source.state.trim().toLowerCase() : '';
        if (paused === true || state === 'paused') {
            return 'paused';
        }
        const running = typeof source.running === 'boolean' ? source.running : ['running', 'started'].includes(state);
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
    const repairT40ba899d = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
        const normalizedAction = String(action || '').toLowerCase();
        if (normalizedAction === 'start') {
            return state === 'paused' ? repairT40ba899d("common.repair.item-is-paused-resume-instead-09b805", "Item is paused, resume instead.") : 'Item already started.';
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

    const planFolderRuntimeAction = ({ type, folderId, folder, folders, names, infoByName, rules, action, snapshot }) => {
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
            folders,
            names,
            infoByName,
            rules, snapshot
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
        const snapshot = buildMembershipSnapshot({ type: normalizedType, folders: folderMap, rules: normalizedPrefs.autoRules, infoByName: infos });

        for (const name of names) {
            const matchedFolders = [];
            const ruleDecision = snapshot.decisionsByName[name];
            for (const [folderId, folder] of Object.entries(folderMap)) {
                const reasons = snapshot.byFolder[folderId]?.reasonsByName[name] || [];
                if (reasons.length) matchedFolders.push({ folderId, folderName: String(folder.name || folderId), reasons: [...reasons] });
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
        buildFolderMatchCache, getMembershipSnapshotFromCache, buildMembershipSnapshot, getMembershipSignature, getMembershipBranchMembers, compileRuleSet, regexMatches,
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
        buildLegacyMembership, reconcileLegacyMatchCache,
        getEffectiveFolderMembers,
        dockerRuntimeStateKind,
        vmRuntimeStateKind,
        isRuntimeActionAllowed,
        skipReasonForAction,
        planFolderRuntimeAction,
        getConflictReport
    });
}));
