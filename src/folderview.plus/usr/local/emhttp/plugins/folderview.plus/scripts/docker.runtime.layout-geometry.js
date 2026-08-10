// @ts-check
(function dockerRuntimeLayoutGeometryModule(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    root.FolderViewPlusDockerLayoutGeometry = api;
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeLayoutGeometryFactory() {
    'use strict';

    const readNodeGeometry = (node) => {
        const rect = typeof node?.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
        if (!rect) {
            return null;
        }
        const owner = node.parentElement || null;
        const ownerRect = typeof owner?.getBoundingClientRect === 'function'
            ? owner.getBoundingClientRect()
            : null;
        return Object.freeze({
            left: Number(rect.left || 0),
            top: Number(rect.top || 0),
            relativeLeft: ownerRect ? Number(rect.left || 0) - Number(ownerRect.left || 0) : null,
            relativeTop: ownerRect ? Number(rect.top || 0) - Number(ownerRect.top || 0) : null,
            ownerLeft: ownerRect ? Number(ownerRect.left || 0) : null,
            ownerTop: ownerRect ? Number(ownerRect.top || 0) : null
        });
    };

    const distance = (after, before, key) => (
        before?.[key] === null || after?.[key] === null
            ? 0
            : Math.abs(Number(after?.[key] || 0) - Number(before?.[key] || 0))
    );

    const compareGeometry = (before, after) => {
        if (!before || !after) {
            return null;
        }
        const xShift = distance(after, before, 'left');
        const yShift = distance(after, before, 'top');
        const relativeXShift = distance(after, before, 'relativeLeft');
        const relativeYShift = distance(after, before, 'relativeTop');
        const rowXShift = distance(after, before, 'ownerLeft');
        const rowYShift = distance(after, before, 'ownerTop');
        return Object.freeze({
            xShift,
            yShift,
            shift: Math.max(xShift, yShift),
            relativeXShift,
            relativeYShift,
            relativeShift: Math.max(relativeXShift, relativeYShift),
            rowXShift,
            rowYShift,
            rowShift: Math.max(rowXShift, rowYShift)
        });
    };

    return Object.freeze({
        readNodeGeometry,
        compareGeometry
    });
}));
