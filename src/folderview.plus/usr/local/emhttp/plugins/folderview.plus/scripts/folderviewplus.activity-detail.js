(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    root.FolderViewPlusActivityDetail = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackTranslate = (_key, fallback = '', ...params) => fallback.replace(/\$(\d+)/g,
        (token, index) => String(params[Number(index) - 1] ?? token));
    const buildActivityEventDetail = (row, translate = fallbackTranslate) => {
        const details = row?.details && typeof row.details === 'object' && !Array.isArray(row.details) ? row.details : {};
        const count = (key) => Number.isSafeInteger(details[key]) && details[key] >= 0 ? details[key] : null;
        const action = String(row?.action || '');
        const folderCount = count('folderCount');
        const scopeCounts = () => {
            const docker = count('dockerCount');
            const vm = count('vmCount');
            return docker !== null && vm !== null
                ? translate('diagnostics.activity.detail.scope', '$1 Docker folders, $2 VM folders', docker, vm) : '';
        };
        switch (action) {
            case 'backup_create': {
                if (folderCount === null) break;
                const reason = String(details.reason || '');
                const reasonLabel = reason.startsWith('before-tree-move-')
                    ? translate('diagnostics.activity.detail.before-move', 'before a folder move')
                    : (reason === 'scheduled' ? translate('settings.recovery.reason-scheduled', 'Scheduled backup') : '');
                return [translate('diagnostics.activity.detail.saved', '$1 folders saved', folderCount), reasonLabel].filter(Boolean).join(' · ');
            }
            case 'backup_restore':
                return folderCount === null ? '' : translate('diagnostics.activity.detail.restored', '$1 folders restored', folderCount);
            case 'folder_batch_mutation': {
                const created = count('createdCount');
                const updated = count('updatedCount');
                const deleted = count('deletedCount');
                return [created, updated, deleted].every((value) => value !== null)
                    ? translate('diagnostics.activity.detail.changes', '$1 created, $2 updated, $3 deleted', created, updated, deleted) : '';
            }
            case 'folder_create':
            case 'folder_update':
            case 'folder_delete':
            case 'delete_folder':
            case 'reorder':
                return folderCount === null ? '' : translate('diagnostics.activity.detail.total-folders', '$1 folders now configured', folderCount);
            case 'folder_settings_apply':
                return count('targetCount') === null ? '' : translate('diagnostics.activity.detail.affected', '$1 folders affected', count('targetCount'));
            case 'folder_batch_assignment':
            case 'bulk_assign':
                return count('assignedCount') === null || count('targetFolderCount') === null ? ''
                    : translate('diagnostics.activity.detail.assigned', '$1 items assigned across $2 folders', count('assignedCount'), count('targetFolderCount'));
            case 'runtime_bulk_action': {
                const succeeded = count('succeeded');
                const failed = count('failed');
                const skipped = count('skipped');
                return [succeeded, failed, skipped].every((value) => value !== null)
                    ? translate('diagnostics.activity.detail.runtime', '$1 succeeded, $2 failed, $3 skipped', succeeded, failed, skipped) : '';
            }
            case 'backup_delete_all':
                return count('deletedCount') === null || count('failedCount') === null ? ''
                    : translate('diagnostics.activity.detail.deleted', '$1 deleted, $2 failed', count('deletedCount'), count('failedCount'));
            case 'environment_export':
            case 'environment_import':
            case 'rollback_create':
            case 'rollback_restore':
                return scopeCounts();
            default:
                break;
        }
        if (['warning', 'warn', 'degraded', 'partial', 'error', 'danger', 'failed', 'fatal'].includes(String(row?.status || '').toLowerCase())) {
            return /^[a-z][a-z0-9_]{0,47}$/.test(action)
                ? translate('diagnostics.activity.detail.action', 'Action: $1', action.replace(/_/g, ' ')) : '';
        }
        return '';
    };
    return Object.freeze({ buildActivityEventDetail });
}));
