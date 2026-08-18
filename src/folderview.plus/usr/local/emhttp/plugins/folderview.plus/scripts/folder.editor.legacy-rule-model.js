(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.legacyRuleModel = factory();
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
    'use strict';

    const itemTypeFromItems = (items) => {
        const first = (Array.isArray(items) ? items : []).find((item) => item && typeof item === 'object');
        const rawType = String(first?.Type || first?.type || '').trim().toLowerCase();
        return rawType === 'vm' ? 'vm' : 'docker';
    };

    const buildLegacyRegexMigrationPreview = ({ pattern, folderId, items, folders, rules, utils }) => {
        const sourcePattern = String(pattern || '');
        const targetFolderId = String(folderId || '').trim();
        const sourceItems = Array.isArray(items) ? items : [];
        const folderMap = folders && typeof folders === 'object' ? folders : {};
        const ruleList = Array.isArray(rules) ? rules : [];
        let regex = null;
        let error = '';
        try {
            regex = sourcePattern ? new RegExp(sourcePattern) : null;
        } catch (regexError) {
            error = String(regexError?.message || regexError || 'Invalid regex.');
        }
        const infoByName = {};
        const names = [];
        sourceItems.forEach((item) => {
            const name = String(item?.Name || item?.name || '').trim();
            if (!name || Object.prototype.hasOwnProperty.call(infoByName, name)) {
                return;
            }
            names.push(name);
            infoByName[name] = item;
        });
        const matches = regex
            ? names.filter((name) => {
                const matched = regex.test(name);
                regex.lastIndex = 0;
                return matched;
            })
            : [];
        const advancedConflicts = [];
        if (utils && typeof utils.getAutoRuleDecision === 'function') {
            matches.forEach((name) => {
                const decision = utils.getAutoRuleDecision({
                    rules: ruleList,
                    name,
                    infoByName,
                    type: itemTypeFromItems(sourceItems)
                });
                const assignedFolderId = String(decision?.assignedRule?.folderId || '').trim();
                if (decision?.blockedBy || (assignedFolderId && assignedFolderId !== targetFolderId)) {
                    advancedConflicts.push(name);
                }
            });
        }
        const overlappingLegacyFolders = [];
        Object.entries(folderMap).forEach(([candidateId, folder]) => {
            if (String(candidateId) === targetFolderId) {
                return;
            }
            const candidatePattern = String(folder?.regex || '').trim();
            if (!candidatePattern) {
                return;
            }
            let candidateRegex;
            try {
                candidateRegex = new RegExp(candidatePattern);
            } catch (_error) {
                return;
            }
            if (matches.some((name) => {
                const matched = candidateRegex.test(name);
                candidateRegex.lastIndex = 0;
                return matched;
            })) {
                overlappingLegacyFolders.push(String(folder?.name || candidateId));
            }
        });
        return {
            valid: Boolean(regex) && !error,
            error,
            matches,
            advancedConflicts: Array.from(new Set(advancedConflicts)),
            overlappingLegacyFolders: Array.from(new Set(overlappingLegacyFolders))
        };
    };

    return Object.freeze({ buildLegacyRegexMigrationPreview });
}));
