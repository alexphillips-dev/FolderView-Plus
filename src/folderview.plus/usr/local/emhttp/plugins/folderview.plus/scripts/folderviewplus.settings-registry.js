// @ts-check
// Generated from schemas/filter-view-settings.schema.json. Run scripts/generate_filter_view_registry.mjs after editing the schema.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsRegistry = factory();
    root.FolderViewPlusSettingsRegistryModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const SCHEMA = {"schemaVersion":1,"types":["docker","vm"],"groups":{"visibility":{"handler":"changeVisibilityPref","path":"","consumerFiles":["scripts/folderviewplus.js","scripts/docker.js","scripts/vm.js"],"settings":{"appColumnWidth":{"types":["docker","vm"],"kind":"enum","default":"standard","values":["compact","standard","wide"],"liveApply":true},"hideEmptyFolders":{"types":["docker","vm"],"kind":"boolean","default":false,"liveApply":true}}},"status":{"handler":"changeStatusPref","path":"status","consumerFiles":["scripts/folderviewplus.js","scripts/folderviewplus.settings-health.js"],"settings":{"mode":{"types":["docker","vm"],"kind":"enum","default":"summary","values":["summary","dominant"],"liveApply":true},"displayMode":{"types":["docker","vm"],"kind":"enum","default":"balanced","values":["simple","balanced","detailed"],"liveApply":true},"trendEnabled":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"attentionAccent":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"warnStoppedPercent":{"types":["docker","vm"],"kind":"integer","default":60,"min":0,"max":100,"liveApply":true}}},"badges":{"handler":"changeBadgePref","path":"badges","consumerFiles":["scripts/folderviewplus.js","scripts/docker.js","scripts/vm.js"],"settings":{"running":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"stopped":{"types":["docker","vm"],"kind":"boolean","default":false,"liveApply":true},"updates":{"types":["docker"],"kind":"boolean","default":true,"liveApply":true}}},"runtime":{"handler":"changeRuntimePref","path":"","consumerFiles":["scripts/folderviewplus.js","scripts/docker.js","scripts/vm.js","scripts/docker.runtime.shared.js"],"settings":{"liveRefreshEnabled":{"types":["docker","vm"],"kind":"boolean","default":false,"liveApply":true},"liveRefreshSeconds":{"types":["docker","vm"],"kind":"integer","default":20,"min":10,"max":300,"liveApply":true},"performanceProfile":{"types":["docker","vm"],"kind":"enum","default":"standard","values":["standard","adaptive","maximum"],"liveApply":true},"lazyPreviewEnabled":{"types":["docker","vm"],"kind":"boolean","default":false,"liveApply":true},"lazyPreviewThreshold":{"types":["docker","vm"],"kind":"integer","default":30,"min":10,"max":200,"liveApply":true},"pageViewMode":{"types":["docker"],"kind":"enum","default":"folderview","values":["folderview","host","command"],"liveApply":true},"themeCompatibilityMode":{"types":["docker","vm"],"kind":"enum","default":"auto","values":["auto","host","safe","highcontrast"],"liveApply":true}}},"dashboard":{"handler":"changeDashboardPref","path":"dashboard","consumerFiles":["scripts/folderviewplus.js","scripts/dashboard.js","scripts/docker.js","scripts/vm.js"],"settings":{"layout":{"types":["docker","vm"],"kind":"enum","default":"classic","values":["classic","legacy","fullwidth","accordion","inset","compactmatrix","embossed"],"liveApply":true},"expandToggle":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"greyscale":{"types":["docker","vm"],"kind":"boolean","default":false,"liveApply":true},"folderLabel":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"previewContext":{"types":["docker"],"kind":"enum","default":"native","values":["native","advanced"],"liveApply":true},"previewTrigger":{"types":["docker"],"kind":"enum","default":"click","values":["click","hover"],"liveApply":true},"previewGraph":{"types":["docker"],"kind":"integer","default":1,"min":0,"max":4,"liveApply":true},"previewGraphTime":{"types":["docker"],"kind":"integer","default":60,"min":5,"max":600,"liveApply":true},"privacyMode":{"types":["vm"],"kind":"boolean","default":false,"liveApply":true},"privacyMaskNames":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskContainerIps":{"types":["docker"],"kind":"boolean","default":true,"liveApply":true,"ui":false,"deprecationId":"prefs.dashboard.privacyMaskContainerIps"},"privacyMaskLocalIps":{"types":["docker"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskPorts":{"types":["docker"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskVolumePaths":{"types":["docker"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskImageRegistry":{"types":["docker"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskVmDiskPaths":{"types":["vm"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskMacAddresses":{"types":["vm"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskPublicIps":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskInterfaces":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"privacyMaskExternalUrls":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true}}},"health":{"handler":"changeHealthPref","path":"health","consumerFiles":["scripts/folderviewplus.js","scripts/folderviewplus.settings-health.js","scripts/docker.js","scripts/vm.js"],"settings":{"cardsEnabled":{"types":["docker","vm"],"kind":"boolean","default":true,"liveApply":true},"runtimeBadgeEnabled":{"types":["docker","vm"],"kind":"boolean","default":false,"liveApply":true},"warnStoppedPercent":{"types":["docker"],"kind":"integer","default":60,"min":0,"max":100,"liveApply":true},"criticalStoppedPercent":{"types":["docker"],"kind":"integer","default":90,"min":0,"max":100,"liveApply":true},"profile":{"types":["docker"],"kind":"enum","default":"balanced","values":["strict","balanced","lenient"],"liveApply":true},"updatesMode":{"types":["docker"],"kind":"enum","default":"maintenance","values":["maintenance","warn","ignore"],"liveApply":true},"allStoppedMode":{"types":["docker"],"kind":"enum","default":"critical","values":["critical","warn"],"liveApply":true},"resourceWarnVcpu":{"types":["vm"],"storageKey":"vmResourceWarnVcpus","kind":"integer","default":16,"min":1,"max":512,"liveApply":true},"resourceCriticalVcpu":{"types":["vm"],"storageKey":"vmResourceCriticalVcpus","kind":"integer","default":32,"min":1,"max":512,"liveApply":true},"resourceWarnGiB":{"types":["vm"],"storageKey":"vmResourceWarnGiB","kind":"integer","default":32,"min":1,"max":1024,"liveApply":true},"resourceCriticalGiB":{"types":["vm"],"storageKey":"vmResourceCriticalGiB","kind":"integer","default":64,"min":1,"max":1024,"liveApply":true}}}}};
    const definitions = [];
    Object.entries(SCHEMA.groups || {}).forEach(([group, groupDefinition]) => {
        Object.entries(groupDefinition.settings || {}).forEach(([key, setting]) => {
            definitions.push(Object.freeze({
                ...setting,
                group,
                handler: groupDefinition.handler,
                key,
                path: groupDefinition.path || '',
                storageKey: setting.storageKey || key,
                types: Object.freeze([...(setting.types || [])]),
                values: setting.values ? Object.freeze([...setting.values]) : undefined,
                consumerFiles: Object.freeze([...(groupDefinition.consumerFiles || [])])
            }));
        });
    });
    const DEFINITIONS = Object.freeze(definitions);
    const DEFINITION_MAP = new Map(DEFINITIONS.map((definition) => [
        `${definition.handler}:${definition.key}`,
        definition
    ]));

    const normalizeType = (value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker';
    const getDefinition = (handler, key, type) => {
        const definition = DEFINITION_MAP.get(`${String(handler || '')}:${String(key || '')}`) || null;
        if (!definition || !definition.types.includes(normalizeType(type))) return null;
        return definition;
    };
    const coerceValue = (definition, value, fallback) => {
        if (!definition) return fallback;
        if (definition.kind === 'boolean') return value === true;
        if (definition.kind === 'integer') {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return fallback ?? definition.default;
            return Math.min(Number(definition.max), Math.max(Number(definition.min), Math.round(parsed)));
        }
        if (definition.kind === 'enum') {
            const normalized = String(value ?? '').trim().toLowerCase();
            return definition.values.includes(normalized) ? normalized : (fallback ?? definition.default);
        }
        return value;
    };
    const resolveChange = (handler, type, key, value, fallback) => {
        const definition = getDefinition(handler, key, type);
        if (!definition) return null;
        return Object.freeze({
            definition,
            group: definition.group,
            handler: definition.handler,
            key: definition.key,
            path: definition.path,
            storageKey: definition.storageKey,
            type: normalizeType(type),
            value: coerceValue(definition, value, fallback)
        });
    };

    return Object.freeze({
        schemaVersion: Number(SCHEMA.schemaVersion || 0),
        definitions: DEFINITIONS,
        normalizeType,
        getDefinition,
        coerceValue,
        resolveChange
    });
}));
