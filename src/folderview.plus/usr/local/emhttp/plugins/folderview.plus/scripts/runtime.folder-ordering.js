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

    return Object.freeze({ normalizeFolderToken, isFolderToken, buildCustomOrder, createOrderCursor });
}));
