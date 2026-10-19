// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderBadges = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';
    const isStatusVisible = (kind, badges = {}) => {
        if (kind === 'started') return badges?.running !== false;
        if (kind === 'stopped') return badges?.stopped === true;
        return true;
    };
    const applyStatus = ($icon, badges = {}) => {
        if (!$icon?.length) return;
        const kind = $icon.hasClass('started') ? 'started'
            : ($icon.hasClass('stopped') ? 'stopped' : 'paused');
        $icon.toggle(isStatusVisible(kind, badges));
    };
    return Object.freeze({ isStatusVisible, applyStatus });
}));
