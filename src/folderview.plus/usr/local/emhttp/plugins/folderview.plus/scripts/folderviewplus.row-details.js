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
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : (value) => String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const translate = typeof deps.translate === 'function' ? deps.translate : ((_key, fallback, ...params) =>
            params.reduce((text, value, index) => text.replaceAll(`$${index + 1}`, String(value)), fallback));
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
            const severity = ['good', 'warn', 'critical', 'empty'].includes(health.severity) ? health.severity : 'empty';
            const reasonLines = Array.isArray(health.reasons)
                ? health.reasons.map((reason) => `<li><strong>${escapeHtml(reason.label)}</strong><span>${escapeHtml(reason.message)}</span></li>`)
                : [];
            const summaryHtml = `<div class="fv-health-details is-${severity}">
                <div class="fv-health-details-summary">
                    <strong class="fv-health-details-folder" data-i18n-ignore>${escapeHtml(details.folderName)}</strong>
                    <span class="fv-health-details-status">${escapeHtml(health.text)}</span>
                </div>
                <dl class="fv-health-details-metrics">
                    <div><dt>${escapeHtml(translate('legacy.surface.38e5a46cbc5ad328', 'Score'))}</dt><dd>${escapeHtml(health.score)}<small>/100</small></dd></div>
                    <div><dt>Members</dt><dd>${details.members.length}</dd></div>
                    <div><dt>Updates</dt><dd>${details.updateCount}</dd></div>
                </dl>
                <div class="fv-health-details-runtime">${escapeHtml(translate('legacy.surface.4af78f5cb7bc5532', '$1 started, $2 paused, $3 stopped', details.countsByState.started, details.countsByState.paused, details.countsByState.stopped))}</div>
                <div class="fv-health-details-policy">
                    <div>${escapeHtml(translate('legacy.surface.ee9ed7a51cff434e', 'Policy: $1 | updates $2 | all-stopped $3', health.policy.profile, health.policy.updatesMode, health.policy.allStoppedMode))}</div>
                    <div>${escapeHtml(translate('legacy.surface.7f7bdce0e22a9f0a', 'Thresholds: warn $1% ($2), critical $3% ($4)', health.policy.warnThreshold, health.policy.warnSource, health.policy.criticalThreshold, health.policy.criticalSource))}</div>
                </div>
                <div class="fv-health-details-reasons">
                    <strong>${escapeHtml(translate('legacy.surface.72ed245d2cf11822', 'Reasons'))}</strong>
                    <ul>${reasonLines.length ? reasonLines.join('') : `<li>${escapeHtml('- No health reasons available.')}</li>`}</ul>
                </div>
            </div>`;

            swalFn({
                title: 'Health details',
                text: summaryHtml,
                html: true,
                customClass: 'fv-health-details-modal',
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
