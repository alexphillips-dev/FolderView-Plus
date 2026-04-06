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
        const deriveFolderStatusKey = typeof deps.deriveFolderStatusKey === 'function' ? deps.deriveFolderStatusKey : (() => 'empty');
        const isDockerUpdateAvailable = typeof deps.isDockerUpdateAvailable === 'function' ? deps.isDockerUpdateAvailable : (() => false);
        const statusLabelForKey = typeof deps.statusLabelForKey === 'function' ? deps.statusLabelForKey : ((value) => String(value || ''));
        const normalizeStatusPrefs = typeof deps.normalizeStatusPrefs === 'function' ? deps.normalizeStatusPrefs : (() => ({ warnStoppedPercent: 60 }));
        const normalizeHealthPrefs = typeof deps.normalizeHealthPrefs === 'function' ? deps.normalizeHealthPrefs : (() => ({}));
        const evaluateDockerFolderHealth = typeof deps.evaluateDockerFolderHealth === 'function' ? deps.evaluateDockerFolderHealth : (() => ({ text: 'Healthy', severity: 'good', score: 100, reasons: [], filterSeverity: 'good', policy: {} }));
        const toggleStatusFilter = typeof deps.toggleStatusFilter === 'function' ? deps.toggleStatusFilter : (() => {});
        const toggleHealthSeverityFilter = typeof deps.toggleHealthSeverityFilter === 'function' ? deps.toggleHealthSeverityFilter : (() => {});

        const getFolderStatusBreakdown = (type, folderId) => {
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
            const namesByState = { started: [], paused: [], stopped: [] };
            for (const member of members) {
                const runtimeState = getItemRuntimeStateKind(resolvedType, infoByName[member] || {});
                if (runtimeState === 'started') {
                    countsByState.started += 1;
                    namesByState.started.push(String(member));
                } else if (runtimeState === 'paused') {
                    countsByState.paused += 1;
                    namesByState.paused.push(String(member));
                } else {
                    countsByState.stopped += 1;
                    namesByState.stopped.push(String(member));
                }
            }
            const dominantStatus = deriveFolderStatusKey(countsByState, members.length);
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
                namesByState,
                dominantStatus,
                updateCount
            };
        };

        const showFolderStatusBreakdown = (type, folderId) => {
            const details = getFolderStatusBreakdown(type, folderId);
            if (!details || !swalFn) {
                return;
            }
            const total = details.members.length;
            const stoppedPercent = total > 0 ? Math.round((details.countsByState.stopped / total) * 100) : 0;
            const suggestions = [];
            if (total <= 0) {
                suggestions.push('Add members to this folder to track runtime status.');
            }
            if (details.countsByState.started <= 0 && details.countsByState.paused <= 0 && details.countsByState.stopped > 0) {
                suggestions.push('All members are stopped. Consider running Start from Folder runtime actions.');
            }
            if (details.countsByState.paused > 0) {
                suggestions.push('Paused members detected. Resume them from Folder runtime actions if needed.');
            }
            if (details.type === 'docker' && details.updateCount > 0) {
                suggestions.push(`Updates available in ${details.updateCount} container${details.updateCount === 1 ? '' : 's'}.`);
            }
            if (stoppedPercent >= normalizeStatusPrefs(details.type).warnStoppedPercent) {
                suggestions.push(`Stopped percentage (${stoppedPercent}%) is above current warn threshold.`);
            }
            if (!suggestions.length) {
                suggestions.push('No action needed. This folder status looks healthy.');
            }
            const summaryLines = [
                `Folder: ${details.folderName}`,
                `Members: ${total}`,
                `${details.countsByState.started} started, ${details.countsByState.paused} paused, ${details.countsByState.stopped} stopped`,
                `Dominant status: ${statusLabelForKey(details.dominantStatus)}`,
                details.type === 'docker' ? `Updates: ${details.updateCount}` : '',
                '',
                'Suggestions:',
                ...suggestions.map((line) => `- ${line}`)
            ].filter(Boolean);

            swalFn({
                title: 'Status breakdown',
                text: summaryLines.join('\n'),
                type: 'info',
                showCancelButton: true,
                confirmButtonText: `Filter ${statusLabelForKey(details.dominantStatus)}`,
                cancelButtonText: 'Close'
            }, (confirmed) => {
                if (confirmed) {
                    toggleStatusFilter(details.type, details.dominantStatus);
                }
            });
        };

        const showFolderHealthBreakdown = (type, folderId) => {
            const details = getFolderStatusBreakdown(type, folderId);
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
            getFolderStatusBreakdown,
            showFolderStatusBreakdown,
            showFolderHealthBreakdown
        });
    };

    return Object.freeze({
        createApi
    });
}));
