(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.legacyMembership = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const labelValue = (labels, keys) => {
        for (const key of keys) if (typeof labels[key] === 'string' && labels[key].trim() !== '') return labels[key].trim();
        return '';
    };
    const build = ({ folders, names, infoByName, type, rules, getAutoRuleDecision, getFolderLabelValue, getDockerLabels, normalizeMemberList }) => {
        const folderMap = folders && typeof folders === 'object' ? folders : {};
        const result = Object.create(null);
        if (!Object.values(folderMap).some((folder) => folder?.membershipPolicy === 'folderview3')) return result;
        const manual = new Map(), labels = new Map();
        for (const [id, folder] of Object.entries(folderMap)) {
            if (folder?.membershipPolicy === 'folderview3') result[id] = [];
            for (const name of normalizeMemberList(folder?.containers)) if (!manual.has(name)) manual.set(name, id);
            const label = String(folder?.name || '');
            if (label && !labels.has(label)) labels.set(label, id);
        }
        const infos = infoByName && typeof infoByName === 'object' ? infoByName : {};
        const available = new Set(normalizeMemberList([...(Array.isArray(names) ? names : []), ...Object.keys(infos)]).filter(name => Object.prototype.hasOwnProperty.call(infos, name)));
        const labelMembers = Object.fromEntries(Object.keys(result).map(id => [id, []]));
        for (const id of Object.keys(result)) result[id] = normalizeMemberList(folderMap[id].containers).filter(name => available.has(name) && manual.get(name) === id);
        for (const name of available) {
            if (manual.has(name)) continue;
            const labelOwner = type === 'docker' ? labels.get(getFolderLabelValue(getDockerLabels(infos, name))) || '' : '';
            const owner = labelOwner || String(getAutoRuleDecision({ rules, name, infoByName: infos, type, folders: folderMap }).assignedRule?.folderId || '');
            if (Object.prototype.hasOwnProperty.call(result, owner)) (labelOwner ? labelMembers : result)[owner].push(name);
        }
        for (const id of Object.keys(result)) result[id].push(...labelMembers[id]);
        return result;
    };
    const reconcileCache = (cache, membership) => {
        for (const [id, members] of Object.entries(membership)) cache[id] = { explicit: members, regex: [], label: [], rules: [] };
        return cache;
    };
    const effective = (membership, id) => Object.prototype.hasOwnProperty.call(membership, id)
        ? { members: membership[id], reasonsByName: Object.fromEntries(membership[id].map(name => [name, ['legacy']])) } : null;
    const appendConflict = (membership, id, name, folder, matches) => {
        if (!Object.prototype.hasOwnProperty.call(membership, id)) return false;
        if (membership[id].includes(name)) matches.push({ folderId: id, folderName: String(folder.name || id), reasons: ['legacy'] });
        return true;
    };
    return Object.freeze({ build, reconcileCache, labelValue, effective, appendConflict });
}));
