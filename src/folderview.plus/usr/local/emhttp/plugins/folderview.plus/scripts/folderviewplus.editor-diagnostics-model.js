(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.FolderViewPlusFoundationModules ||= {}; root.FolderViewPlusFoundationModules.editorDiagnosticsModel = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const normalize = (value, { count, dimension, normalizeMeasurement }) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const result = {};
        const enums = {
            phase: ['ready', 'source-changed', 'staged', 'applied', 'cancelled', 'uploading', 'uploaded', 'upload-cancelled', 'upload-error', 'stale-completion'],
            source: ['builtin', 'collections', 'uploads'],
            reason: ['none', 'invalid-file', 'transport', 'user-cancelled', 'conflict-cancelled', 'selection-changed'],
            section: ['general', 'members', 'preview', 'chevron', 'status', 'webuiProfiles', 'rules', 'actions'],
            captureReason: ['initial', 'icon', 'form', 'section', 'resize', 'leave'],
            theme: ['dark', 'light', 'other'], direction: ['ltr', 'rtl']
        };
        for (const [key, allowed] of Object.entries(enums)) result[key] = allowed.includes(value[key]) ? value[key] : allowed[0];
        for (const key of ['applyCount', 'cancelCount', 'discardedCompletions', 'uploadErrorCount', 'cardCount', 'sampledCards', 'overflowingCards', 'overflowingButtonRows', 'disabledRows', 'disabledControls', 'previewDisabledRows', 'contextDisabledRows', 'otherDisabledRows', 'helpButtons', 'missingHelpTargets']) result[key] = count(value[key]);
        for (const key of ['draftMatchesField', 'rollbackAvailable', 'cancelRestorationAttempted', 'cancelRestored', 'fieldIsEmpty', 'uploadPending', 'pickerModuleLoaded', 'pickerInitialized', 'helpModuleLoaded', 'helpInitialized', 'panelsSideBySide', 'coarsePointer', 'reducedMotion', 'truncated']) result[key] = value[key] === true;
        for (const key of ['viewportWidthPx', 'viewportHeightPx', 'devicePixelRatio', 'minCardWidthPx', 'maxCardWidthPx', 'minIconSizePx', 'maxIconSizePx', 'panelHeightDifferencePx']) result[key] = dimension(value[key]);
        for (const key of ['parentPanel', 'iconPanel', 'picker', 'toolbar']) result[key] = normalizeMeasurement(value[key]);
        return result;
    };
    return Object.freeze({ normalize });
}));
