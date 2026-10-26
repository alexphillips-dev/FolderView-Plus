(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'), require('./folderviewplus.utils-transfer.js'), require('./folderviewplus.membership.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.rulesEngine = factory(modules.utilityFoundation, modules.utilityNormalization, modules.utilityTransfer, modules.legacyMembership);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(foundation, normalization, transfer, membership) {
    'use strict';
    const { isPlainObject } = foundation;
    const { LEGACY_FOLDER_LABEL_KEYS, RULE_KINDS } = normalization;
    const { normalizeMemberList } = transfer;
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const unique = (values) => Array.from(new Set(values));
    const regexMatches = (pattern, input, flags = '') => {
        if (!pattern) {
            return false;
        }
        try {
            return new RegExp(pattern, flags).test(input);
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
        return String(item.image ?? item.Image ?? item.info?.Config?.Image ?? '');
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

    const getFolderLabelValue = (labels) => membership.labelValue(isPlainObject(labels) ? labels : {}, LEGACY_FOLDER_LABEL_KEYS);


    const compilePredicate = (rule, type) => {
        if (!isPlainObject(rule) || !RULE_KINDS.includes(rule.kind)) throw new Error('invalid-rule-kind');
        if (type !== 'docker' && rule.kind !== 'name_regex') throw new Error('unsupported-rule-type');
        if (['name_regex', 'image_regex', 'compose_project_regex'].includes(rule.kind)) {
            if (String(rule.pattern || '') === '') throw new Error('empty-regex');
            const regex = new RegExp(String(rule.pattern), 'u');
            return (name, infos) => regex.test(rule.kind === 'name_regex' ? name : rule.kind === 'image_regex' ? getDockerImage(infos, name) : getComposeProject(infos, name));
        }
        const key = String(rule.labelKey || ''), expected = String(rule.labelValue ?? '');
        if (!key) throw new Error('missing-label-key');
        if (rule.kind === 'label') return (name, infos) => own(getDockerLabels(infos, name), key) && (expected === '' || String(getDockerLabels(infos, name)[key]) === expected);
        if (expected === '') throw new Error('missing-label-value');
        const escaped = expected.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        const regex = new RegExp((rule.kind === 'label_starts_with' ? '^' : '') + escaped, 'iu');
        return (name, infos) => own(getDockerLabels(infos, name), key) && regex.test(String(getDockerLabels(infos, name)[key]));
    };
    const ruleMatchesItem = (rule, name, infos, type) => {
        try { return compilePredicate(rule, type)(name, infos); } catch (_error) { return false; }
    };
    const compileRuleSet = ({ rules, type = 'docker', folders }) => {
        const issues = [], compiled = [];
        for (const [index, rule] of (Array.isArray(rules) ? rules : []).entries()) {
            if (rule?.enabled === false) continue;
            if (rule?.effect !== 'exclude' && folders && !own(folders, rule?.folderId)) {
                issues.push(Object.freeze({ index, code: 'missing-target' })); continue;
            }
            try {
                const ownedRule = Object.freeze({ ...rule, kind: rule?.kind || 'name_regex' });
                compiled.push({ rule: ownedRule, index, predicate: compilePredicate(ownedRule, type) });
            }
            catch (_error) { issues.push(Object.freeze({ index, code: 'invalid-predicate' })); }
        }
        const decide = (name, infos = {}) => {
            infos = isPlainObject(infos) ? infos : {};
            for (const { rule, index, predicate } of compiled) {
                if (!predicate(name, infos)) continue;
                return { assignedRule: rule.effect === 'exclude' ? null : rule, blockedBy: rule.effect === 'exclude' ? rule : null, matchedRule: rule, matchedIndex: index };
            }
            return { assignedRule: null, blockedBy: null, matchedRule: null, matchedIndex: null };
        };
        return Object.freeze({ decide, issues: Object.freeze(issues) });
    };
    const getAutoRuleDecision = ({ rules, name, infoByName, type, folders }) => {
        const decision = compileRuleSet({ rules, type, folders }).decide(name, infoByName);
        const source = decision.matchedIndex === null ? null : rules[decision.matchedIndex];
        return { ...decision, matchedRule: source, assignedRule: decision.assignedRule ? source : null, blockedBy: decision.blockedBy ? source : null };
    };
    const getAutoRuleFirstMatch = (options) => getAutoRuleDecision(options).assignedRule;
    const getAutoRuleMatches = ({ rules, folderId, names, infoByName, type, folders }) => {
        const compiled = compileRuleSet({ rules, type, folders });
        return unique((Array.isArray(names) ? names : []).filter(name => {
            const rule = compiled.decide(name, infoByName).assignedRule;
            return rule && String(rule.folderId || '') === String(folderId || '');
        }));
    };
    const buildLegacyMembership = (options) => membership.build({ ...options, getAutoRuleDecision, getFolderLabelValue, getDockerLabels, normalizeMemberList });
    const reconcileLegacyMatchCache = (cache, options) => membership.reconcileCache(cache, buildLegacyMembership(options));
    const snapshotInputs = ({ type = 'docker', folders = {}, rules = [], infoByName = {}, names = [], displayFolderIds = [], validateTargets = true, restrictNames = false, ruleTargetIds }) => {
        folders = folders && typeof folders === 'object' ? folders : {};
        infoByName = infoByName && typeof infoByName === 'object' ? infoByName : {};
        names = Array.isArray(names) ? names : [];
        rules = Array.isArray(rules) ? rules : [];
        displayFolderIds = Array.isArray(displayFolderIds) ? displayFolderIds.map(String) : [];
        const folderMap = Object.fromEntries(Object.entries(folders).filter(([, folder]) => isPlainObject(folder)).map(([id, folder]) => [id, {
            name: String(folder.name || ''), parentId: String(folder.parentId || ''), membershipPolicy: String(folder.membershipPolicy || ''),
            containers: unique(normalizeMemberList(folder.containers)), regex: String(folder.regex || '')
        }]));
        const labelKeys = new Set(LEGACY_FOLDER_LABEL_KEYS);
        for (const rule of rules || []) {
            if (rule?.enabled === false) continue;
            if (String(rule?.kind || '').startsWith('label') && rule.labelKey) labelKeys.add(String(rule.labelKey));
            if (rule?.kind === 'compose_project_regex') for (const key of ['com.docker.compose.project', 'com.docker.compose.project.working_dir', 'com.docker.compose.project.config_files']) labelKeys.add(key);
        }
        const info = Object.fromEntries(Object.keys(infoByName).map(name => [name, {
            id: type === 'vm' ? String(infoByName[name]?.uuid || infoByName[name]?.id || '') : String(infoByName[name]?.shortId || infoByName[name]?.id || infoByName[name]?.Id || infoByName[name]?.info?.Id || '').split(':').pop().slice(0, 12),
            Labels: Object.fromEntries(Object.entries(getDockerLabels(infoByName, name)).filter(([key]) => labelKeys.has(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
            Image: getDockerImage(infoByName, name)
        }]));
        const orderedNames = unique(restrictNames && names.length ? names : [...names, ...Object.keys(info)]).filter(name => own(info, name));
        const ruleList = (Array.isArray(rules) ? rules : []).filter(isPlainObject).map(rule => ({
            id: String(rule.id || ''), enabled: rule.enabled !== false, folderId: String(rule.folderId || ''), effect: rule.effect === 'exclude' ? 'exclude' : 'include',
            kind: String(rule.kind || 'name_regex'), pattern: String(rule.pattern || ''), labelKey: String(rule.labelKey || ''), labelValue: String(rule.labelValue ?? '')
        }));
        return { type: type === 'vm' ? 'vm' : 'docker', folders: folderMap, rules: ruleList, infoByName: info, names: orderedNames, validateTargets, restrictNames,
            ruleTargetIds: Array.isArray(ruleTargetIds) ? [...ruleTargetIds] : Object.keys(folderMap),
            displayFolderIds: unique([...displayFolderIds, ...Object.keys(folderMap)]).filter(id => own(folderMap, id)) };
    };
    const getMembershipSignature = (options) => JSON.stringify([1, snapshotInputs(options)]);
    const buildMembershipSnapshot = (options) => {
        const input = snapshotInputs(options), { type, folders, rules, infoByName, names } = input;
        const compiled = compileRuleSet({ rules, type, folders: input.validateTargets ? Object.fromEntries(input.ruleTargetIds.map(id => [id, true])) : undefined });
        const decisionsByName = Object.fromEntries(Object.keys(infoByName).map(name => [name, Object.freeze(compiled.decide(name, infoByName))]));
        const legacy = membership.build({ ...input, getAutoRuleDecision: ({ name }) => decisionsByName[name], getFolderLabelValue, getDockerLabels, normalizeMemberList });
        const byFolder = Object.create(null), matchCache = Object.create(null), primaryOwnerByName = Object.create(null), issues = [...compiled.issues];
        for (const [id, folder] of Object.entries(folders)) {
            const manualMembers = [...folder.containers], reasonsByName = Object.create(null);
            const buckets = { explicit: manualMembers.filter(name => own(infoByName, name)), regex: [], label: [], rules: [] };
            const add = (name, reason) => { (reasonsByName[name] ||= []).push(reason); };
            manualMembers.forEach(name => add(name, 'manual'));
            let regex = null;
            if (folder.regex) {
                try { regex = new RegExp(folder.regex); } catch (_error) { issues.push(Object.freeze({ folderId: id, code: 'invalid-legacy-regex' })); }
            }
            for (const name of names) {
                if (regex?.test(name)) { buckets.regex.push(name); add(name, 'regex'); }
                if (type === 'docker' && folder.name && getFolderLabelValue(getDockerLabels(infoByName, name)) === folder.name) { buckets.label.push(name); add(name, 'label'); }
                if (decisionsByName[name].assignedRule?.folderId === id) { buckets.rules.push(name); add(name, 'rule'); }
            }
            if (own(legacy, id)) {
                for (const name of Object.keys(reasonsByName)) delete reasonsByName[name];
                legacy[id].forEach(name => add(name, 'legacy'));
                buckets.explicit = [...legacy[id]]; buckets.regex = []; buckets.label = []; buckets.rules = [];
            }
            const members = own(legacy, id) ? [...legacy[id]] : Object.keys(reasonsByName).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
            const liveMembers = unique(Object.values(buckets).flat());

            for (const reasons of Object.values(reasonsByName)) Object.freeze(reasons);
            for (const value of Object.values(buckets)) Object.freeze(value);
            matchCache[id] = Object.freeze(buckets);
            byFolder[id] = { parentId: folder.parentId, manualMembers: Object.freeze(manualMembers), members: Object.freeze(members), liveMembers: Object.freeze(liveMembers), displayMembers: [], reasonsByName: Object.freeze(reasonsByName) };
        }
        for (const id of input.displayFolderIds) {
            const display = byFolder[id].liveMembers.filter(name => !own(primaryOwnerByName, name));
            display.forEach(name => { primaryOwnerByName[name] = id; });
            byFolder[id].displayMembers = Object.freeze(display); Object.freeze(byFolder[id]);
        }
        for (const folder of Object.values(folders)) { Object.freeze(folder.containers); Object.freeze(folder); }
        const configuration = Object.freeze({ type, folders: Object.freeze(folders), rules: Object.freeze(rules), displayFolderIds: Object.freeze(input.displayFolderIds) });
        for (const rule of rules) Object.freeze(rule);
        for (const item of Object.values(infoByName)) { Object.freeze(item.Labels); Object.freeze(item); }
        return Object.freeze({ schemaVersion: 1, type, configuration, displayFolderIds: Object.freeze(input.displayFolderIds), signature: JSON.stringify([1, input]), names: Object.freeze(names), factsByName: Object.freeze(infoByName),
            decisionsByName: Object.freeze(decisionsByName), byFolder: Object.freeze(byFolder), matchCache: Object.freeze(matchCache), primaryOwnerByName: Object.freeze(primaryOwnerByName), issues: Object.freeze(issues) });
    };
    const getEffectiveFolderMembers = ({ folderId, folder, folders, snapshot, ...options }) => {
        const id = String(folderId || '');
        const map = folders && typeof folders === 'object' ? folders : {};
        const nativeFolder = { ...(isPlainObject(folder) ? folder : {}), membershipPolicy: '' };
        const resolved = snapshot || buildMembershipSnapshot({ ...options, rules: id ? options.rules : [],
            folders: map[id]?.membershipPolicy === 'folderview3' ? map : { ...map, [id]: nativeFolder },
            validateTargets: Boolean(folders), ruleTargetIds: Object.keys(map), restrictNames: true });
        const result = resolved.byFolder[id];
        return result ? { members: [...result.members], reasonsByName: Object.fromEntries(Object.entries(result.reasonsByName).map(([name, reasons]) => [name, [...reasons]])) } : { members: [], reasonsByName: {} };
    };
    const getMembershipBranchMembers = (snapshot, folderId, includeDescendants = true, projection = 'liveMembers') => {
        if (!own(snapshot.byFolder, String(folderId || ''))) return [];
        const ids = [String(folderId || '')], visited = new Set(), members = new Set();
        while (ids.length) {
            const id = ids.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            for (const name of snapshot.byFolder[id]?.[projection] || []) members.add(name);
            if (includeDescendants) for (const [childId, folder] of Object.entries(snapshot.byFolder)) if (folder.parentId === id) ids.push(childId);
        }
        return [...members];
    };
    return Object.freeze({ regexMatches, getDockerLabels, getDockerImage, basenameFromPathish, getComposeProjectFromLabels, isComposeManagedFromLabels, getComposeProject, getFolderLabelValue,
        compileRuleSet, ruleMatchesItem, getAutoRuleDecision, getAutoRuleFirstMatch, getAutoRuleMatches, buildLegacyMembership, reconcileLegacyMatchCache, buildMembershipSnapshot, getMembershipSignature, getMembershipBranchMembers, getEffectiveFolderMembers });
}));
