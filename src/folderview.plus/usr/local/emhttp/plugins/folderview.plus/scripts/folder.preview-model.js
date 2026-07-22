// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderPreviewModel = factory();
    root.FolderViewPlusFolderPreviewModelModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const toSafeString = (value, fallback = '') => {
        const normalized = String(value ?? '').trim();
        return normalized || fallback;
    };

    const normalizeCount = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
    };

    const normalizeBreadcrumb = (breadcrumb, fallbackName = '') => {
        const parts = Array.isArray(breadcrumb)
            ? breadcrumb
            : String(breadcrumb || '').split('/');
        return parts
            .map((part) => toSafeString(part))
            .filter(Boolean)
            .concat([])
            .filter((part, index, source) => index === 0 || part !== source[index - 1])
            .length
            ? parts.map((part) => toSafeString(part)).filter(Boolean)
            : [toSafeString(fallbackName, 'Folder')];
    };

    const formatMemberCountLabel = (memberCount, unit = 'item') => {
        const count = normalizeCount(memberCount);
        return `${count} ${unit}${count === 1 ? '' : 's'}`;
    };

    const formatRuntimeCountLabel = (startedCount, memberCount) => {
        const total = normalizeCount(memberCount);
        if (total <= 0) {
            return 'Empty';
        }
        return `${normalizeCount(startedCount)}/${total}`;
    };

    const createChildFolderPreviewModel = (input = {}) => {
        const childFolder = input.childFolder && typeof input.childFolder === 'object'
            ? input.childFolder
            : {};
        const childId = toSafeString(input.childId ?? input.id ?? childFolder.id);
        const sourceId = toSafeString(input.sourceId ?? input.rootId ?? input.parentId);
        const name = toSafeString(input.name ?? childFolder.name, 'Folder');
        const icon = toSafeString(input.icon ?? childFolder.icon);
        const memberCount = normalizeCount(input.memberCount ?? input.total ?? childFolder.memberCount);
        const startedCount = normalizeCount(input.startedCount ?? childFolder.startedCount);
        const breadcrumb = normalizeBreadcrumb(input.breadcrumb, name);
        const breadcrumbText = breadcrumb.join(' / ');

        return Object.freeze({
            kind: 'child-folder',
            id: childId,
            childId,
            sourceId,
            rootId: toSafeString(input.rootId ?? sourceId),
            parentId: toSafeString(input.parentId ?? sourceId),
            name,
            icon,
            memberCount,
            startedCount,
            depth: normalizeCount(input.depth),
            hasChildren: input.hasChildren === true,
            breadcrumb,
            breadcrumbText,
            statusLabel: formatMemberCountLabel(memberCount),
            runtimeCountLabel: formatRuntimeCountLabel(startedCount, memberCount)
        });
    };

    return Object.freeze({
        createChildFolderPreviewModel,
        formatMemberCountLabel,
        formatRuntimeCountLabel
    });
}));
