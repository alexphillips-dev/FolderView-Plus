(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(require('./folderviewplus.utils-foundation.js')); return; }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.folderGroupsModel = factory(modules.utilityFoundation);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(foundation) {
    'use strict';
    const { isPlainObject, sanitizeImageUrl } = foundation;
    const normalizeFolderGroups = (value) => {
        const groups = [], ids = new Set();
        const text = (value, max) => typeof value === 'string' ? Array.from(value.trim()).slice(0, max).join('') : '';
        for (const row of Array.isArray(value) ? value : []) {
            if (!isPlainObject(row)) continue;
            const id = text(row.id, 96), name = text(row.name, 64);
            if (!/^custom:[a-zA-Z0-9._-]{1,80}$/.test(id) || !name || ids.has(id)) continue;
            const folders = [], names = new Set();
            for (const folder of Array.isArray(row.folders) ? row.folders : []) {
                if (!isPlainObject(folder)) continue;
                const folderName = text(folder.name, 160);
                if (!folderName || names.has(folderName.toLowerCase())) continue;
                names.add(folderName.toLowerCase());
                folders.push({ name: folderName, icon: sanitizeImageUrl(text(folder.icon, 2048), '/plugins/folderview.plus/images/folder-icon.png') });
                if (folders.length >= 50) break;
            }
            if (!folders.length) continue;
            ids.add(id);
            groups.push({ id, name, folders });
            if (groups.length >= 30) break;
        }
        return groups;
    };
    return Object.freeze({ normalizeFolderGroups });
}));
