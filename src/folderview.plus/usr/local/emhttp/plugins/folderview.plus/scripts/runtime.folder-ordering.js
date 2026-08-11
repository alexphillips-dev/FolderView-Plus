// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusRuntimeFolderOrdering = factory();
    root.FolderViewPlusRuntimeFolderOrderingModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    /**
     * @typedef {object} OrderOptions
     * @property {string[]} [order]
     * @property {string[]} [completedFolderIds]
     * @property {string} [currentFolderId]
     */

    /** @param {*} value */
    const normalizeFolderToken = (value) => {
        const token = String(value || '').trim();
        if (!token) return '';
        return token.startsWith('folder-') ? token : `folder-${token}`;
    };
    const isFolderToken = (value) => /^folder-/.test(String(value || ''));
    const normalizeParentId = (value) => String(value || '').trim();
    const buildFolderDepthById = (folders, options = {}) => {
        const source = folders && typeof folders === 'object' ? folders : {};
        const ids = Object.keys(source);
        if (!ids.length) return {};
        const validIds = new Set(ids);
        const depthById = {};
        const maxDepth = Math.max(1, Number(options.maxDepth) || 8);
        const normalizeParent = typeof options.normalizeParentId === 'function'
            ? options.normalizeParentId
            : normalizeParentId;
        const resolveDepth = (id, chain = new Set()) => {
            if (!validIds.has(id)) return 0;
            if (Object.prototype.hasOwnProperty.call(depthById, id)) return depthById[id];
            if (chain.has(id)) {
                depthById[id] = 0;
                return 0;
            }
            chain.add(id);
            const parentId = normalizeParent(source[id]?.parentId || source[id]?.parent_id || '');
            let depth = 0;
            if (parentId && parentId !== id && validIds.has(parentId)) {
                depth = Math.min(maxDepth, resolveDepth(parentId, chain) + 1);
            }
            chain.delete(id);
            depthById[id] = depth;
            return depth;
        };
        ids.forEach((id) => resolveDepth(id, new Set()));
        return depthById;
    };
    const reorderFolderSlotsInBaseOrder = (baseOrder, folders, prefs, options = {}) => {
        const order = Array.isArray(baseOrder)
            ? baseOrder.map((item) => String(item || ''))
            : Object.values(baseOrder || {}).map((item) => String(item || ''));
        const folderMap = folders && typeof folders === 'object' ? folders : {};
        const orderFolders = typeof options.orderFolders === 'function'
            ? options.orderFolders
            : ((value) => value);
        const prefix = String(options.folderTokenPrefix || 'folder-');
        const matchesFolderToken = typeof options.isFolderToken === 'function'
            ? options.isFolderToken
            : (entry) => String(entry || '').startsWith(prefix);
        const desiredFolderTokens = Object.keys(orderFolders(folderMap, prefs || {}) || {})
            .map((id) => `${prefix}${id}`);
        if (!desiredFolderTokens.length) return order;
        const sortMode = ['manual', 'alpha', 'name_desc', 'created_newest', 'created_oldest', 'updated_newest']
            .includes(String(prefs?.sortMode || '').trim().toLowerCase())
            ? String(prefs.sortMode).trim().toLowerCase()
            : 'created';
        const hasPinnedFolders = Array.isArray(prefs?.pinnedFolderIds) && prefs.pinnedFolderIds.length > 0;
        if (sortMode !== 'created' || hasPinnedFolders) {
            let desiredIndex = 0;
            return order.map((entry) => {
                if (!matchesFolderToken(entry)) return entry;
                while (desiredIndex < desiredFolderTokens.length) {
                    const candidate = desiredFolderTokens[desiredIndex++];
                    const candidateId = candidate.startsWith(prefix) ? candidate.slice(prefix.length) : candidate;
                    if (Object.prototype.hasOwnProperty.call(folderMap, candidateId)) return candidate;
                }
                return entry;
            });
        }
        const liveFolderTokens = new Set();
        order.forEach((entry) => {
            if (!matchesFolderToken(entry)) return;
            const folderId = entry.startsWith(prefix) ? entry.slice(prefix.length) : entry;
            if (Object.prototype.hasOwnProperty.call(folderMap, folderId)) liveFolderTokens.add(entry);
        });
        const missingDesiredTokens = desiredFolderTokens.filter((token) => !liveFolderTokens.has(token));
        const usedFolderTokens = new Set();
        let missingIndex = 0;
        return order.map((entry) => {
            if (!matchesFolderToken(entry)) return entry;
            const folderId = entry.startsWith(prefix) ? entry.slice(prefix.length) : entry;
            if (Object.prototype.hasOwnProperty.call(folderMap, folderId) && !usedFolderTokens.has(entry)) {
                usedFolderTokens.add(entry);
                return entry;
            }
            while (missingIndex < missingDesiredTokens.length) {
                const candidate = missingDesiredTokens[missingIndex++];
                if (!usedFolderTokens.has(candidate)) {
                    usedFolderTokens.add(candidate);
                    return candidate;
                }
            }
            return entry;
        });
    };
    const reconcileOrderWithFolderSlots = (liveOrder, savedOrder, folders, options = {}) => {
        const currentOrder = Array.isArray(liveOrder)
            ? liveOrder.map((item) => String(item || '')).filter(Boolean)
            : [];
        const preferredOrder = Array.isArray(savedOrder)
            ? savedOrder.map((item) => String(item || '')).filter(Boolean)
            : [];
        const folderMap = folders && typeof folders === 'object' ? folders : {};
        const prefix = String(options.folderTokenPrefix || 'folder-');
        const matchesFolderToken = typeof options.isFolderToken === 'function'
            ? options.isFolderToken
            : (entry) => String(entry || '').startsWith(prefix);
        const liveSet = new Set(currentOrder);
        const savedSet = new Set(preferredOrder);
        const newOnes = currentOrder.filter((entry) => !savedSet.has(entry));
        const reconciledFolderOrder = [];
        const reconciledMemberOrder = [];
        const seen = new Set();
        const appendUnique = (target, entry) => {
            if (!entry || seen.has(entry)) return;
            seen.add(entry);
            target.push(entry);
        };
        preferredOrder.forEach((entry) => {
            if (matchesFolderToken(entry)) {
                const folderId = entry.startsWith(prefix) ? entry.slice(prefix.length) : entry;
                if (Object.prototype.hasOwnProperty.call(folderMap, folderId)) {
                    appendUnique(reconciledFolderOrder, entry);
                }
                return;
            }
            if (liveSet.has(entry)) appendUnique(reconciledMemberOrder, entry);
        });
        newOnes.forEach((entry) => appendUnique(reconciledMemberOrder, entry));
        return {
            order: [...reconciledFolderOrder, ...reconciledMemberOrder],
            newOnes
        };
    };
    /** @param {OrderOptions} [options] */
    const buildCustomOrder = ({ order = [], completedFolderIds = [], currentFolderId = '' } = {}) => {
        const completed = new Set((completedFolderIds || []).map(normalizeFolderToken).filter(Boolean));
        const currentToken = normalizeFolderToken(currentFolderId);
        return (Array.isArray(order) ? order : []).filter((entry) => (
            entry && (completed.has(String(entry)) || !(isFolderToken(entry) && String(entry) !== currentToken))
        ));
    };
    /** @param {OrderOptions} [options] */
    const createOrderCursor = (options = {}) => {
        const values = buildCustomOrder(options);
        let active = true;
        const indexOf = (value) => active ? values.indexOf(value) : -1;
        const remove = (value) => {
            if (!active) return -1;
            const index = values.indexOf(value);
            if (index >= 0) values.splice(index, 1);
            return index;
        };
        const snapshot = () => Object.freeze([...values]);
        const destroy = () => {
            active = false;
            values.length = 0;
        };
        return Object.freeze({ indexOf, remove, snapshot, destroy });
    };

    return Object.freeze({
        normalizeFolderToken,
        isFolderToken,
        normalizeParentId,
        buildFolderDepthById,
        reorderFolderSlotsInBaseOrder,
        reconcileOrderWithFolderSlots,
        buildCustomOrder,
        createOrderCursor
    });
}));
