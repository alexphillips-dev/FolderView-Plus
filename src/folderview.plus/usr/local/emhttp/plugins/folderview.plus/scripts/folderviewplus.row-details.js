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
        const refreshType = typeof deps.refreshType === 'function' ? deps.refreshType : (async () => ({ hasErrors: false }));
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;'));
        const doc = deps.document || (typeof document !== 'undefined' ? document : null);
        const setTimeoutFn = typeof deps.setTimeout === 'function'
            ? deps.setTimeout
            : (typeof setTimeout === 'function' ? setTimeout : ((callback) => callback()));
        const STATUS_MEMBER_PREVIEW_LIMIT = 8;

        const statusIconForKey = (key) => ({
            started: 'fa-play',
            paused: 'fa-pause',
            stopped: 'fa-stop',
            mixed: 'fa-adjust',
            empty: 'fa-folder-open-o'
        }[String(key || '').toLowerCase()] || 'fa-info-circle');

        const statusPercent = (count, total) => (
            total > 0 ? Math.round((Number(count || 0) / total) * 100) : 0
        );

        const renderStatusMetric = (key, label, icon, count, total, options = {}) => {
            const numericCount = Number(count || 0);
            const percent = options.percentage === false ? null : statusPercent(numericCount, total);
            return `
                <div class="fv-status-modal-metric is-${escapeHtml(key)} ${numericCount <= 0 ? 'is-zero' : ''}">
                    <div class="fv-status-modal-metric-label"><i class="fa ${escapeHtml(icon)}" aria-hidden="true"></i><span>${escapeHtml(label)}</span></div>
                    <div class="fv-status-modal-metric-value">${numericCount}</div>
                    <div class="fv-status-modal-metric-meta">${percent === null ? (numericCount === 1 ? 'container' : 'containers') : `${percent}% of members`}</div>
                </div>
            `;
        };

        const renderStatusMemberGroup = (key, label, icon, names, open = false) => {
            const members = Array.isArray(names) ? names : [];
            if (members.length === 0) {
                return '';
            }
            const visibleMembers = members.slice(0, STATUS_MEMBER_PREVIEW_LIMIT);
            const remaining = Math.max(0, members.length - visibleMembers.length);
            return `
                <details class="fv-status-modal-members is-${escapeHtml(key)}" ${open ? 'open' : ''}>
                    <summary><span><i class="fa ${escapeHtml(icon)}" aria-hidden="true"></i>${escapeHtml(label)}</span><strong>${members.length}</strong></summary>
                    <ul>${visibleMembers.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>
                    ${remaining > 0 ? `<div class="fv-status-modal-more">+${remaining} more</div>` : ''}
                </details>
            `;
        };

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
            const configuredWarningThreshold = Number(normalizeStatusPrefs(details.type).warnStoppedPercent);
            const warningThreshold = Number.isFinite(configuredWarningThreshold)
                ? Math.max(0, Math.min(100, configuredWarningThreshold))
                : 60;
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
            if (details.countsByState.stopped > 0 && stoppedPercent >= warningThreshold) {
                suggestions.push(`Stopped members are at ${stoppedPercent}%, meeting your ${warningThreshold}% warning threshold.`);
            } else if (details.countsByState.stopped > 0) {
                suggestions.push(`${details.countsByState.stopped} member${details.countsByState.stopped === 1 ? ' is' : 's are'} stopped, but ${stoppedPercent}% remains below your ${warningThreshold}% warning threshold.`);
            }
            if (!suggestions.length) {
                suggestions.push(total > 0
                    ? 'All members are running and no configured warning threshold has been crossed.'
                    : 'No runtime status is available until this folder has members.');
            }
            const hasThresholdWarning = details.countsByState.stopped > 0 && stoppedPercent >= warningThreshold;
            const hasAttention = details.countsByState.paused > 0 || details.countsByState.stopped > 0 || details.updateCount > 0;
            const semanticState = total <= 0
                ? 'empty'
                : (details.countsByState.stopped === total ? 'critical' : (hasThresholdWarning ? 'warning' : (hasAttention ? 'mixed' : 'healthy')));
            const guidanceTitle = ({
                empty: 'No members yet',
                critical: 'Needs attention',
                warning: 'Warning threshold reached',
                mixed: 'Mixed runtime state',
                healthy: 'Healthy'
            })[semanticState];
            const statusLabel = statusLabelForKey(details.dominantStatus) || 'Unknown';
            const statusKey = String(details.dominantStatus || 'empty').toLowerCase();
            const typeLabel = details.type === 'docker' ? 'Docker' : 'VM';
            const startedPercent = statusPercent(details.countsByState.started, total);
            const pausedPercent = statusPercent(details.countsByState.paused, total);
            const stoppedBarPercent = total > 0
                ? Math.max(0, 100 - startedPercent - pausedPercent)
                : 0;
            const modalHtml = `
                <section class="fv-status-modal" aria-labelledby="fv-status-modal-title">
                    <header class="fv-status-modal-header">
                        <div class="fv-status-modal-icon is-${escapeHtml(semanticState)}"><i class="fa ${escapeHtml(statusIconForKey(statusKey))}" aria-hidden="true"></i></div>
                        <div class="fv-status-modal-heading">
                            <h2 id="fv-status-modal-title">${escapeHtml(details.folderName)}</h2>
                            <div class="fv-status-modal-context">${escapeHtml(typeLabel)} <span aria-hidden="true">•</span> ${total} member${total === 1 ? '' : 's'} <span aria-hidden="true">•</span> Loaded snapshot</div>
                        </div>
                        <span class="fv-status-modal-badge is-${escapeHtml(semanticState)}"><i class="fa ${escapeHtml(statusIconForKey(statusKey))}" aria-hidden="true"></i>${escapeHtml(statusLabel)}</span>
                    </header>
                    <div class="fv-status-modal-metrics ${details.type === 'docker' ? '' : 'is-three'}" aria-label="Runtime status totals">
                        ${renderStatusMetric('started', 'Started', 'fa-play', details.countsByState.started, total)}
                        ${renderStatusMetric('paused', 'Paused', 'fa-pause', details.countsByState.paused, total)}
                        ${renderStatusMetric('stopped', 'Stopped', 'fa-stop', details.countsByState.stopped, total)}
                        ${details.type === 'docker' ? renderStatusMetric('updates', 'Updates', 'fa-cloud-download', details.updateCount, total, { percentage: false }) : ''}
                    </div>
                    <div class="fv-status-modal-distribution" role="img" aria-label="${startedPercent}% started, ${pausedPercent}% paused, ${stoppedBarPercent}% stopped">
                        <span class="is-started" style="width:${startedPercent}%"></span>
                        <span class="is-paused" style="width:${pausedPercent}%"></span>
                        <span class="is-stopped" style="width:${stoppedBarPercent}%"></span>
                    </div>
                    <div class="fv-status-modal-guidance is-${escapeHtml(semanticState)}" role="status">
                        <div class="fv-status-modal-guidance-title"><i class="fa ${semanticState === 'healthy' ? 'fa-check-circle' : (semanticState === 'empty' ? 'fa-info-circle' : 'fa-exclamation-circle')}" aria-hidden="true"></i>${escapeHtml(guidanceTitle)}</div>
                        <ul>${suggestions.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
                    </div>
                    <div class="fv-status-modal-member-groups" aria-label="Members grouped by status">
                        ${renderStatusMemberGroup('stopped', 'Stopped members', 'fa-stop', details.namesByState.stopped, true)}
                        ${renderStatusMemberGroup('paused', 'Paused members', 'fa-pause', details.namesByState.paused, true)}
                        ${renderStatusMemberGroup('started', 'Started members', 'fa-play', details.namesByState.started, !hasAttention)}
                    </div>
                    <footer class="fv-status-modal-footer">
                        <span id="fv-status-modal-refresh-state" class="fv-status-modal-refresh-state" aria-live="polite"></span>
                        <button type="button" class="fv-status-modal-refresh" data-fv-status-refresh="${escapeHtml(details.type)}"><i class="fa fa-refresh" aria-hidden="true"></i>Refresh status</button>
                    </footer>
                </section>
            `;

            swalFn({
                title: '',
                text: modalHtml,
                html: true,
                customClass: 'fv-status-breakdown-modal',
                showCancelButton: true,
                confirmButtonText: `Show ${String(statusLabel).toLowerCase()} folders`,
                cancelButtonText: 'Close'
            }, (confirmed) => {
                if (confirmed) {
                    toggleStatusFilter(details.type, details.dominantStatus);
                }
            });
            setTimeoutFn(() => {
                const refreshButton = doc?.querySelector?.('.sweet-alert.fv-status-breakdown-modal [data-fv-status-refresh]');
                if (!refreshButton || refreshButton.dataset?.fvStatusRefreshBound === 'true') {
                    return;
                }
                if (refreshButton.dataset) {
                    refreshButton.dataset.fvStatusRefreshBound = 'true';
                }
                refreshButton.addEventListener('click', async () => {
                    const refreshState = doc?.querySelector?.('#fv-status-modal-refresh-state');
                    refreshButton.disabled = true;
                    refreshButton.setAttribute?.('aria-busy', 'true');
                    if (refreshState) {
                        refreshState.textContent = 'Refreshing runtime status…';
                    }
                    try {
                        await refreshType(details.type);
                        showFolderStatusBreakdown(details.type, details.folderId);
                    } catch (_error) {
                        refreshButton.disabled = false;
                        refreshButton.setAttribute?.('aria-busy', 'false');
                        if (refreshState) {
                            refreshState.textContent = 'Refresh failed. Try again.';
                        }
                    }
                });
            }, 0);
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
