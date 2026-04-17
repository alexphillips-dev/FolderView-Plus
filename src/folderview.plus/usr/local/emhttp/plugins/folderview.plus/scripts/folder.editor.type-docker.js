// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorTypeDocker = factory();
    root.FolderViewPlusFolderEditorTypeDockerModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SYNC_ORDER_PATH = '/plugins/folderview.plus/server/sync_order.php';

    const createApi = (deps = {}) => {
        const normalizeFolderRecordForEditor = typeof deps.normalizeFolderRecordForEditor === 'function'
            ? deps.normalizeFolderRecordForEditor
            : ((folder) => (folder && typeof folder === 'object' ? folder : {}));
        const queueBackgroundMutationPost = typeof deps.queueBackgroundMutationPost === 'function'
            ? deps.queueBackgroundMutationPost
            : (() => false);
        const securePost = typeof deps.securePost === 'function'
            ? deps.securePost
            : (async () => {});
        const syncType = String(deps.syncType || 'docker').trim() || 'docker';

        const buildComparableFolder = (folderRecord) => {
            const normalized = normalizeFolderRecordForEditor(folderRecord || {});
            const containers = Array.from(new Set(
                (Array.isArray(normalized.containers) ? normalized.containers : [])
                    .map((entry) => String(entry || '').trim())
                    .filter(Boolean)
            )).sort();
            return {
                name: String(normalized.name || '').trim(),
                regex: String(normalized.regex || ''),
                containers
            };
        };

        const shouldSyncAfterSave = (nextFolder, options = {}) => {
            if (options.force === true) {
                return true;
            }
            const currentFolderId = String(options.folderId || '').trim();
            if (!currentFolderId) {
                return true;
            }
            const previousFolderRecord = options.previousFolder && typeof options.previousFolder === 'object'
                ? options.previousFolder
                : null;
            if (!previousFolderRecord) {
                return true;
            }
            const previousComparable = buildComparableFolder(previousFolderRecord);
            const nextComparable = buildComparableFolder(nextFolder || {});
            return previousComparable.name !== nextComparable.name
                || previousComparable.regex !== nextComparable.regex
                || JSON.stringify(previousComparable.containers) !== JSON.stringify(nextComparable.containers);
        };

        const flushPostSaveSync = async (options = {}) => {
            if (!shouldSyncAfterSave(options.folder, options)) {
                return;
            }
            const scheduled = queueBackgroundMutationPost(SYNC_ORDER_PATH, { type: syncType });
            if (scheduled) {
                return;
            }
            await securePost(SYNC_ORDER_PATH, { type: syncType });
        };

        return Object.freeze({
            buildComparableFolder,
            shouldSyncAfterSave,
            flushPostSaveSync
        });
    };

    return Object.freeze({
        createApi
    });
}));
