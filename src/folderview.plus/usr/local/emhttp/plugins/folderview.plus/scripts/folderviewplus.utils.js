(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./folderviewplus.utils-foundation.js'),
            require('./folderviewplus.utils-normalization.js'),
            require('./folderviewplus.utils-prefs.js'),
            require('./folderviewplus.utils-ordering.js'),
            require('./folderviewplus.utils-transfer.js'),
            require('./folderviewplus.utils-rules.js')
        );
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusUtils = factory(
        modules.utilityFoundation,
        modules.utilityNormalization,
        modules.utilityPrefs,
        modules.utilityOrdering,
        modules.utilityTransfer,
        modules.utilityRules
    );
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(
    utilityFoundation,
    utilityNormalization,
    utilityPrefs,
    utilityOrdering,
    utilityTransfer,
    utilityRules
) {
    'use strict';
    const modules = [utilityFoundation, utilityNormalization, utilityPrefs, utilityOrdering, utilityTransfer, utilityRules];
    if (modules.some((moduleApi) => !moduleApi || typeof moduleApi !== 'object')) {
        throw new Error('FolderView Plus utility modules are unavailable.');
    }
    const api = Object.assign({}, ...modules);
    return Object.freeze({
        EXPORT_SCHEMA_VERSION: api.EXPORT_SCHEMA_VERSION,
        RULE_KINDS: api.RULE_KINDS,
        RULE_EFFECTS: api.RULE_EFFECTS,
        LEGACY_FOLDER_LABEL_KEYS: api.LEGACY_FOLDER_LABEL_KEYS,
        RUNTIME_PREFS_SCHEMA: api.RUNTIME_PREFS_SCHEMA,
        DEFAULT_FOLDER_STATUS_COLORS: api.DEFAULT_FOLDER_STATUS_COLORS,
        DEFAULT_HEALTH_PREFS: api.DEFAULT_HEALTH_PREFS,
        DEFAULT_DASHBOARD_PREFS: api.DEFAULT_DASHBOARD_PREFS,
        DASHBOARD_LAYOUT_OPTIONS: api.DASHBOARD_LAYOUT_OPTIONS,
        DASHBOARD_LAYOUT_LABELS: api.DASHBOARD_LAYOUT_LABELS,
        DASHBOARD_OVERFLOW_OPTIONS: api.DASHBOARD_OVERFLOW_OPTIONS,
        bindEventOnce: api.bindEventOnce,
        createFrameScheduler: api.createFrameScheduler,
        createIdleTaskQueue: api.createIdleTaskQueue,
        createBatchedStorageWriter: api.createBatchedStorageWriter,
        createSecureRuntimeId: api.createSecureRuntimeId,
        escapeHtml: api.escapeHtml,
        sanitizeImageUrl: api.sanitizeImageUrl,
        sanitizeImageSrc: api.sanitizeImageSrc,
        normalizeFolderId: api.normalizeFolderId,
        normalizeFolderMap: api.normalizeFolderMap,
        normalizeFolderMembers: api.normalizeFolderMembers,
        normalizeAppColumnWidth: api.normalizeAppColumnWidth,
        normalizeDashboardLayout: api.normalizeDashboardLayout,
        normalizeDashboardOverflowMode: api.normalizeDashboardOverflowMode,
        normalizeRuntimePageViewMode: api.normalizeRuntimePageViewMode,
        resolvePreviewActionPrefs: api.resolvePreviewActionPrefs,
        normalizeThemeCompatibilityMode: api.normalizeThemeCompatibilityMode,
        normalizePerformanceProfile: api.normalizePerformanceProfile,
        normalizePrefs: api.normalizePrefs,
        orderFoldersByPrefs: api.orderFoldersByPrefs,
        getFolderStatusColors: api.getFolderStatusColors,
        buildFullExportPayload: api.buildFullExportPayload,
        buildSingleExportPayload: api.buildSingleExportPayload,
        parseImportPayload: api.parseImportPayload,
        summarizeImport: api.summarizeImport,
        buildImportOperations: api.buildImportOperations,
        buildImportDiffRows: api.buildImportDiffRows,
        diffFolderFields: api.diffFolderFields,
        ruleMatchesItem: api.ruleMatchesItem,
        getAutoRuleDecision: api.getAutoRuleDecision,
        getAutoRuleMatches: api.getAutoRuleMatches,
        getAutoRuleFirstMatch: api.getAutoRuleFirstMatch,
        getEffectiveFolderMembers: api.getEffectiveFolderMembers,
        planFolderRuntimeAction: api.planFolderRuntimeAction,
        getFolderLabelValue: api.getFolderLabelValue,
        getComposeProjectFromLabels: api.getComposeProjectFromLabels,
        isComposeManagedFromLabels: api.isComposeManagedFromLabels,
        getConflictReport: api.getConflictReport
    });
}));
