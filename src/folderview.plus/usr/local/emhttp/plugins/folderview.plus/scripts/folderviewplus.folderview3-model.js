(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderView3Model = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const normalizeDetection = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        return {
            available: source.available === true,
            pluginVersion: String(source.pluginVersion || '').trim(),
            componentCount: Math.max(0, Number(source.componentCount) || 0),
            components: Array.isArray(source.components) ? source.components.map(String) : [],
            canPreview: source.canPreview === true,
            dockerFolderCount: Math.max(0, Number(source.dockerFolderCount) || 0),
            vmFolderCount: Math.max(0, Number(source.vmFolderCount) || 0),
            customStyleCount: Math.max(0, Number(source.customStyleCount) || 0),
            nativeAutostartCount: Math.max(0, Number(source.nativeAutostartCount) || 0)
        };
    };
    const validateSource = (source) => {
        if (source.kind !== 'export') return;
        if (source.text.length > 5242880 || new TextEncoder().encode(source.text).byteLength > 5242880) throw new Error('FolderView3 export exceeds the 5 MB migration limit.');
        let payload;
        try { payload = JSON.parse(source.text); } catch (_) { throw new Error('FolderView3 export is not valid JSON.'); }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('FolderView3 export is not valid JSON.');
        if (payload.fv3_export_version !== 1) throw new Error('Unsupported FolderView3 export version.');
        for (const type of ['docker', 'vm']) for (const folder of Object.values(payload[type] || {})) {
            if (typeof folder?.regex === 'string' && folder.regex.trim() !== '') {
                try { new RegExp(folder.regex); } catch (_) { throw new Error('FolderView3 regex is invalid or uses unsupported JavaScript/PHP syntax. Correct the original expression before importing.'); }
            }
        }
    };
        const normalizeReport = (value) => {
            const source = value && typeof value === 'object' ? value : {};
            const summary = source.summary && typeof source.summary === 'object' ? source.summary : {};
            const sourceMeta = source.source && typeof source.source === 'object' ? source.source : {};
            return {
                kind: String(source.kind || 'folderview3_migration_plan'),
                schemaVersion: Math.max(1, Number(source.schemaVersion) || 1),
                createdAt: String(source.createdAt || '').trim(),
                source: {
                    kind: String(sourceMeta.kind || 'export').trim(),
                    sourceName: String(sourceMeta.sourceName || '').trim(),
                    pluginVersion: String(sourceMeta.pluginVersion || '').trim(),
                    unraidVersion: String(sourceMeta.unraidVersion || '').trim(),
                    exportedAt: String(sourceMeta.exportedAt || '').trim(),
                    digest: String(sourceMeta.digest || '').trim()
                },
                summary: {
                    dockerFolderCount: Math.max(0, Number(summary.dockerFolderCount) || 0),
                    vmFolderCount: Math.max(0, Number(summary.vmFolderCount) || 0),
                    dockerAssignmentCount: Math.max(0, Number(summary.dockerAssignmentCount) || 0),
                    vmAssignmentCount: Math.max(0, Number(summary.vmAssignmentCount) || 0),
                    convertedSettingCount: Math.max(0, Number(summary.convertedSettingCount) || 0),
                    unsupportedSettingCount: Math.max(0, Number(summary.unsupportedSettingCount) || 0),
                    dockerRuleCount: Math.max(0, Number(summary.dockerRuleCount) || 0),
                    vmRuleCount: Math.max(0, Number(summary.vmRuleCount) || 0),
                    dockerOrderStatus: ['imported', 'missing', 'empty', 'invalid'].includes(summary.dockerOrderStatus) ? summary.dockerOrderStatus : 'missing',
                    vmOrderStatus: ['imported', 'missing', 'empty', 'invalid'].includes(summary.vmOrderStatus) ? summary.vmOrderStatus : 'missing',
                    appearanceProfileCount: Math.max(1, Number(summary.appearanceProfileCount) || 1),
                    disabledAppearanceProfileCount: Math.max(0, Number(summary.disabledAppearanceProfileCount) || 0),
                    appearanceProfileId: String(summary.appearanceProfileId || '').trim(),
                    appearanceProfileActive: summary.appearanceProfileActive === true,
                    startOrderMode: String(summary.startOrderMode || 'docker-page').trim(),
                    nativeAutostartCount: Math.max(0, Number(summary.nativeAutostartCount) || 0),
                    organizerRegistryCount: Math.max(0, Number(summary.organizerRegistryCount) || 0)
                },
                operations: Array.isArray(source.operations) ? source.operations.map((entry) => ({
                    id: String(entry?.id || '').trim(),
                    category: String(entry?.category || '').trim(),
                    label: String(entry?.label || '').trim(),
                    selected: entry?.selected === true,
                    count: Math.max(0, Number(entry?.count) || 0)
                })).filter((entry) => entry.id && entry.label) : [],
                warnings: Array.isArray(source.warnings)
                    ? source.warnings.map((entry) => String(entry || '').trim()).filter(Boolean)
                    : []
            };
        };
    return Object.freeze({ normalizeDetection, normalizeReport, validateSource });
}));
