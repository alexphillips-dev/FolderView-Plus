(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusRowDetails = factory();
    root.FolderViewPlusRowDetailsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
        const swalFn = typeof deps.swal === 'function' ? deps.swal : null;
        const getFolderMap = typeof deps.getFolderMap === 'function' ? deps.getFolderMap : (() => ({}));
        const getEffectiveMemberSnapshot = typeof deps.getEffectiveMemberSnapshot === 'function' ? deps.getEffectiveMemberSnapshot : (() => ({}));
        const getInfoByType = typeof deps.getInfoByType === 'function' ? deps.getInfoByType : (() => ({}));
        const getItemRuntimeStateKind = typeof deps.getItemRuntimeStateKind === 'function' ? deps.getItemRuntimeStateKind : (() => 'stopped');
        const isDockerUpdateAvailable = typeof deps.isDockerUpdateAvailable === 'function' ? deps.isDockerUpdateAvailable : (() => false);
        const normalizeHealthPrefs = typeof deps.normalizeHealthPrefs === 'function' ? deps.normalizeHealthPrefs : (() => ({}));
        const evaluateDockerFolderHealth = typeof deps.evaluateDockerFolderHealth === 'function' ? deps.evaluateDockerFolderHealth : (() => ({ text: 'Healthy', severity: 'good', score: 100, reasons: [], filterSeverity: 'good', policy: {} }));
        const toggleHealthSeverityFilter = typeof deps.toggleHealthSeverityFilter === 'function' ? deps.toggleHealthSeverityFilter : (() => {});

        const getFolderHealthRuntimeDetails = (type, folderId) => {
            const resolvedType = type === 'vm' ? 'vm' : 'docker';
            const folders = getFolderMap(resolvedType);
            const folder = folders[folderId];
            if (!folder) {
                return null;
            }
            const memberSnapshot = getEffectiveMemberSnapshot(resolvedType, folders);
            const members = Array.isArray(memberSnapshot[folderId]?.members) ? memberSnapshot[folderId].members : [];
            const infoByName = getInfoByType(resolvedType) || {};
            const countsByState = { started: 0, paused: 0, stopped: 0 };
            for (const member of members) {
                const runtimeState = getItemRuntimeStateKind(resolvedType, infoByName[member] || {});
                if (runtimeState === 'started') {
                    countsByState.started += 1;
                } else if (runtimeState === 'paused') {
                    countsByState.paused += 1;
                } else {
                    countsByState.stopped += 1;
                }
            }
            let updateCount = 0;
            if (resolvedType === 'docker') {
                for (const member of members) {
                    if (isDockerUpdateAvailable(infoByName[member] || {})) {
                        updateCount += 1;
                    }
                }
            }
            return {
                type: resolvedType,
                folderId,
                folderName: String(folder.name || folderId),
                members,
                countsByState,
                updateCount
            };
        };

        const showFolderHealthBreakdown = (type, folderId) => {
            const details = getFolderHealthRuntimeDetails(type, folderId);
            if (!details || !swalFn) {
                return;
            }
            if (details.type !== 'docker') {
                swalFn({
                    title: 'Health details',
                    text: 'Detailed health scoring is currently available for Docker folders.',
                    type: 'info'
                });
                return;
            }
            const folders = getFolderMap(details.type);
            const folder = folders[folderId];
            if (!folder) {
                return;
            }
            const healthPrefs = normalizeHealthPrefs('docker');
            const health = evaluateDockerFolderHealth(
                folder,
                details.members.length,
                details.countsByState,
                details.updateCount,
                Number(healthPrefs.warnStoppedPercent) || 60
            );
            const reasonLines = Array.isArray(health.reasons)
                ? health.reasons.map((reason, index) => `${index + 1}. ${reason.label}: ${reason.message}`)
                : [];
            const summaryLines = [
                `Folder: ${details.folderName}`,
                `Health: ${health.text} (${health.severity})`,
                `Score: ${health.score}/100`,
                `Members: ${details.members.length}`,
                `${details.countsByState.started} started, ${details.countsByState.paused} paused, ${details.countsByState.stopped} stopped`,
                `Updates: ${details.updateCount}`,
                `Policy: ${health.policy.profile} | updates ${health.policy.updatesMode} | all-stopped ${health.policy.allStoppedMode}`,
                `Thresholds: warn ${health.policy.warnThreshold}% (${health.policy.warnSource}), critical ${health.policy.criticalThreshold}% (${health.policy.criticalSource})`,
                '',
                'Reasons:',
                ...(reasonLines.length ? reasonLines : ['- No health reasons available.'])
            ];

            swalFn({
                title: 'Health details',
                text: summaryLines.join('\n'),
                type: health.severity === 'critical' ? 'error' : (health.severity === 'warn' ? 'warning' : 'info'),
                showCancelButton: true,
                confirmButtonText: `Filter ${health.text}`,
                cancelButtonText: 'Close'
            }, (confirmed) => {
                if (confirmed) {
                    toggleHealthSeverityFilter(details.type, health.filterSeverity || health.severity);
                }
            });
        };

        return Object.freeze({
            showFolderHealthBreakdown
        });
    };

    return Object.freeze({
        createApi
    });
}));
