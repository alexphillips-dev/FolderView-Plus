(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsHealth = factory();
    root.FolderViewPlusSettingsHealthModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const normalizeType = (type) => type === 'vm' ? 'vm' : 'docker';
    const HEALTH_PROFILE_PRESETS = Object.freeze({
        strict: Object.freeze({
            warnStoppedPercent: 45,
            criticalStoppedPercent: 75,
            updatesMode: 'warn',
            allStoppedMode: 'critical'
        }),
        balanced: Object.freeze({
            warnStoppedPercent: 60,
            criticalStoppedPercent: 90,
            updatesMode: 'maintenance',
            allStoppedMode: 'critical'
        }),
        lenient: Object.freeze({
            warnStoppedPercent: 75,
            criticalStoppedPercent: 95,
            updatesMode: 'maintenance',
            allStoppedMode: 'warn'
        })
    });

    const applyHealthProfilePreset = (health, profile) => {
        const normalizedProfile = Object.prototype.hasOwnProperty.call(HEALTH_PROFILE_PRESETS, String(profile || '').trim().toLowerCase())
            ? String(profile).trim().toLowerCase()
            : 'balanced';
        return {
            ...(health && typeof health === 'object' && !Array.isArray(health) ? health : {}),
            profile: normalizedProfile,
            ...HEALTH_PROFILE_PRESETS[normalizedProfile]
        };
    };

    const syncHealthSummaryVisibility = (host, enabled) => {
        if (!host || typeof host !== 'object') {
            return false;
        }
        const visible = enabled === true;
        host.hidden = !visible;
        host.setAttribute?.('aria-hidden', visible ? 'false' : 'true');
        if (!visible) {
            host.replaceChildren?.();
        }
        return visible;
    };

    const classifyDockerFolderHealth = ({ members, started, paused, stopped, updateCount, policy } = {}) => {
        const totalMembers = Math.max(0, Number(members) || 0);
        const startedCount = Math.max(0, Number(started) || 0);
        const pausedCount = Math.max(0, Number(paused) || 0);
        const stoppedCount = Math.max(0, Number(stopped) || 0);
        const availableUpdates = Math.max(0, Number(updateCount) || 0);
        const resolvedPolicy = policy && typeof policy === 'object' ? policy : {};
        const warnRaw = Number(resolvedPolicy.warnThreshold);
        const criticalRaw = Number(resolvedPolicy.criticalThreshold);
        const warnThreshold = Number.isFinite(warnRaw) ? Math.min(100, Math.max(0, warnRaw)) : 60;
        const criticalThreshold = Number.isFinite(criticalRaw) ? Math.min(100, Math.max(0, criticalRaw)) : 90;
        const stoppedPercent = totalMembers > 0 ? Math.round((stoppedCount / totalMembers) * 100) : 0;
        const allStopped = totalMembers > 0 && startedCount === 0 && pausedCount === 0 && stoppedCount > 0;
        const hasUpdates = availableUpdates > 0;
        const allStoppedCritical = allStopped && resolvedPolicy.allStoppedMode === 'critical';
        const allStoppedWarn = allStopped && resolvedPolicy.allStoppedMode === 'warn';
        const stoppedCritical = !allStopped && stoppedPercent >= criticalThreshold;
        const stoppedWarn = !allStopped && stoppedPercent >= warnThreshold;
        const updateWarn = hasUpdates && resolvedPolicy.updatesMode === 'warn';
        const updateMaintenance = hasUpdates && resolvedPolicy.updatesMode === 'maintenance';
        const updateCritical = updateWarn && availableUpdates >= 10;

        let severity = 'good';
        if (allStoppedCritical || stoppedCritical || updateCritical) {
            severity = 'critical';
        } else if (allStoppedWarn || stoppedWarn || pausedCount > 0 || updateWarn || updateMaintenance) {
            severity = 'warn';
        }
        const maintenanceOnly = severity === 'warn'
            && updateMaintenance
            && !allStoppedWarn
            && !allStoppedCritical
            && !stoppedWarn
            && !stoppedCritical
            && pausedCount <= 0;

        return {
            stoppedPercent,
            allStopped,
            hasUpdates,
            allStoppedCritical,
            allStoppedWarn,
            stoppedCritical,
            stoppedWarn,
            updateWarn,
            updateMaintenance,
            updateCritical,
            severity,
            maintenanceOnly,
            filterSeverity: maintenanceOnly ? 'maintenance' : severity
        };
    };

    const HEALTH_REASON_META = Object.freeze({
        EMPTY_FOLDER: Object.freeze({ label: 'Empty folder' }),
        HEALTHY: Object.freeze({ label: 'Healthy runtime' }),
        ALL_STOPPED: Object.freeze({ label: 'All members stopped' }),
        STOPPED_PERCENT_WARN: Object.freeze({ label: 'Stopped ratio over warn threshold' }),
        STOPPED_PERCENT_CRITICAL: Object.freeze({ label: 'Stopped ratio over critical threshold' }),
        PAUSED_MEMBERS: Object.freeze({ label: 'Paused members detected' }),
        UPDATES_PENDING: Object.freeze({ label: 'Updates pending' }),
        UPDATE_SURGE: Object.freeze({ label: 'Large update backlog' })
    });

    const normalizeHealthProfile = (value, fallback = 'balanced') => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'strict' || normalized === 'balanced' || normalized === 'lenient') {
            return normalized;
        }
        return fallback;
    };

    const normalizeHealthUpdatesMode = (value, fallback = 'maintenance') => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'maintenance' || normalized === 'warn' || normalized === 'ignore') {
            return normalized;
        }
        return fallback;
    };

    const normalizeHealthAllStoppedMode = (value, fallback = 'critical') => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'critical' || normalized === 'warn') {
            return normalized;
        }
        return fallback;
    };

    const makeHealthReason = (code, message, severity = 'info') => ({
        code,
        label: String(HEALTH_REASON_META?.[code]?.label || code),
        message,
        severity
    });

    const createApi = (deps = {}) => {
        const utils = deps.utils || {};
        const formatBytesShort = typeof deps.formatBytesShort === 'function' ? deps.formatBytesShort : ((value) => String(value ?? '0 B'));
        const getPrefsByType = typeof deps.getPrefsByType === 'function' ? deps.getPrefsByType : (() => ({}));
        const getInfoByType = typeof deps.getInfoByType === 'function' ? deps.getInfoByType : (() => ({}));
        const normalizeHealthPrefs = typeof deps.normalizeHealthPrefs === 'function' ? deps.normalizeHealthPrefs : (type, prefsOverride = null) => {
            const incomingPrefs = prefsOverride || getPrefsByType(type);
            const source = typeof utils.normalizePrefs === 'function' ? utils.normalizePrefs(incomingPrefs) : (incomingPrefs || {});
            const incoming = source?.health && typeof source.health === 'object' ? source.health : {};
            const warnRaw = Number(incoming.warnStoppedPercent);
            const warnStoppedPercent = Number.isFinite(warnRaw) ? Math.min(100, Math.max(0, Math.round(warnRaw))) : 60;
            const criticalRaw = Number(incoming.criticalStoppedPercent);
            const criticalStoppedPercent = Number.isFinite(criticalRaw) ? Math.min(100, Math.max(0, Math.round(criticalRaw))) : 90;
            const profileRaw = String(incoming.profile || '').trim().toLowerCase();
            const profile = ['strict', 'balanced', 'lenient'].includes(profileRaw) ? profileRaw : 'balanced';
            const updatesModeRaw = String(incoming.updatesMode || '').trim().toLowerCase();
            const updatesMode = ['maintenance', 'warn', 'ignore'].includes(updatesModeRaw) ? updatesModeRaw : 'maintenance';
            const allStoppedModeRaw = String(incoming.allStoppedMode || '').trim().toLowerCase();
            const allStoppedMode = ['critical', 'warn'].includes(allStoppedModeRaw) ? allStoppedModeRaw : 'critical';
            const warnVcpusRaw = Number(incoming.vmResourceWarnVcpus);
            let warnVcpus = Number.isFinite(warnVcpusRaw) ? Math.min(512, Math.max(1, Math.round(warnVcpusRaw))) : 16;
            const criticalVcpusRaw = Number(incoming.vmResourceCriticalVcpus);
            let criticalVcpus = Number.isFinite(criticalVcpusRaw) ? Math.min(512, Math.max(1, Math.round(criticalVcpusRaw))) : 32;
            if (criticalVcpus <= warnVcpus) {
                warnVcpus = Math.min(511, warnVcpus);
                criticalVcpus = Math.min(512, warnVcpus + 1);
            }
            const warnGiBRaw = Number(incoming.vmResourceWarnGiB);
            let warnGiB = Number.isFinite(warnGiBRaw) ? Math.min(1024, Math.max(1, Math.round(warnGiBRaw))) : 32;
            const criticalGiBRaw = Number(incoming.vmResourceCriticalGiB);
            let criticalGiB = Number.isFinite(criticalGiBRaw) ? Math.min(1024, Math.max(1, Math.round(criticalGiBRaw))) : 64;
            if (criticalGiB <= warnGiB) {
                warnGiB = Math.min(1023, warnGiB);
                criticalGiB = Math.min(1024, warnGiB + 1);
            }
            return {
                cardsEnabled: incoming.cardsEnabled !== false,
                runtimeBadgeEnabled: incoming.runtimeBadgeEnabled === true,
                warnStoppedPercent,
                criticalStoppedPercent,
                profile,
                updatesMode,
                allStoppedMode,
                vmResourceWarnVcpus: warnVcpus,
                vmResourceCriticalVcpus: criticalVcpus,
                vmResourceWarnGiB: warnGiB,
                vmResourceCriticalGiB: criticalGiB
            };
        };
        const getItemRuntimeStateKind = typeof deps.getItemRuntimeStateKind === 'function' ? deps.getItemRuntimeStateKind : (() => 'stopped');
        const deriveFolderStatusKey = typeof deps.deriveFolderStatusKey === 'function' ? deps.deriveFolderStatusKey : (() => 'empty');
        const surfaceT = typeof deps.surfaceT === 'function' ? deps.surfaceT
            : ((_key, fallback, ...params) => String(fallback).replace(/\$(\d+)/g, (_match, index) => String(params[Number(index) - 1] ?? '')));

        const resolveFolderHealthPolicy = (folder, fallbackThreshold) => {
            const globalHealthPrefs = normalizeHealthPrefs('docker');
            const globalProfile = normalizeHealthProfile(globalHealthPrefs.profile, 'balanced');
            const globalDefaults = HEALTH_PROFILE_PRESETS[globalProfile] || HEALTH_PROFILE_PRESETS.balanced;
            const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
                ? folder.settings
                : {};

            const folderProfileRaw = String(settings.health_profile || '').trim();
            const hasFolderProfile = folderProfileRaw !== '';
            const folderProfile = hasFolderProfile
                ? normalizeHealthProfile(folderProfileRaw, globalProfile)
                : globalProfile;
            const profileDefaults = hasFolderProfile
                ? (HEALTH_PROFILE_PRESETS[folderProfile] || globalDefaults)
                : globalDefaults;

            const fallbackWarn = Number.isFinite(Number(fallbackThreshold))
                ? Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold))))
                : Number(globalHealthPrefs.warnStoppedPercent ?? profileDefaults.warnStoppedPercent ?? 60);
            let warnThreshold = fallbackWarn;
            let warnSource = Number.isFinite(Number(fallbackThreshold)) ? 'global-warn' : 'profile';

            const warnRaw = settings.health_warn_stopped_percent;
            if (!(warnRaw === '' || warnRaw === null || warnRaw === undefined)) {
                const parsedWarn = Number(warnRaw);
                if (Number.isFinite(parsedWarn)) {
                    warnThreshold = Math.min(100, Math.max(0, Math.round(parsedWarn)));
                    warnSource = 'folder-warn';
                }
            }

            let criticalThreshold = Number(globalHealthPrefs.criticalStoppedPercent ?? profileDefaults.criticalStoppedPercent ?? 90);
            let criticalSource = Number.isFinite(Number(globalHealthPrefs.criticalStoppedPercent)) ? 'global-critical' : 'profile';
            const criticalRaw = settings.health_critical_stopped_percent;
            if (!(criticalRaw === '' || criticalRaw === null || criticalRaw === undefined)) {
                const parsedCritical = Number(criticalRaw);
                if (Number.isFinite(parsedCritical)) {
                    criticalThreshold = Math.min(100, Math.max(0, Math.round(parsedCritical)));
                    criticalSource = 'folder-critical';
                }
            } else {
                criticalThreshold = Math.min(100, Math.max(0, Math.round(criticalThreshold)));
            }

            let updatesMode = normalizeHealthUpdatesMode(globalHealthPrefs.updatesMode, profileDefaults.updatesMode);
            let updatesModeSource = (globalHealthPrefs.updatesMode && String(globalHealthPrefs.updatesMode).trim() !== '')
                ? 'global-updates'
                : 'profile';
            const updatesModeRaw = String(settings.health_updates_mode || '').trim();
            if (updatesModeRaw !== '') {
                updatesMode = normalizeHealthUpdatesMode(updatesModeRaw, updatesMode);
                updatesModeSource = 'folder-updates';
            }

            let allStoppedMode = normalizeHealthAllStoppedMode(globalHealthPrefs.allStoppedMode, profileDefaults.allStoppedMode);
            let allStoppedModeSource = (globalHealthPrefs.allStoppedMode && String(globalHealthPrefs.allStoppedMode).trim() !== '')
                ? 'global-all-stopped'
                : 'profile';
            const allStoppedModeRaw = String(settings.health_all_stopped_mode || '').trim();
            if (allStoppedModeRaw !== '') {
                allStoppedMode = normalizeHealthAllStoppedMode(allStoppedModeRaw, allStoppedMode);
                allStoppedModeSource = 'folder-all-stopped';
            }

            criticalThreshold = Math.min(100, Math.max(0, Math.round(criticalThreshold)));
            if (criticalThreshold < warnThreshold + 5) {
                criticalThreshold = Math.min(100, warnThreshold + 5);
                criticalSource = 'auto-adjust';
            }

            return {
                profile: folderProfile,
                warnThreshold,
                warnSource,
                criticalThreshold,
                criticalSource,
                updatesMode,
                updatesModeSource,
                allStoppedMode,
                allStoppedModeSource
            };
        };

        const evaluateDockerFolderHealth = typeof deps.evaluateDockerFolderHealth === 'function' ? deps.evaluateDockerFolderHealth : (folder, members, countsByState, updateCount, fallbackWarnThreshold) => {
            const totalMembers = Number(members) || 0;
            const started = Number(countsByState?.started || 0);
            const paused = Number(countsByState?.paused || 0);
            const stopped = Number(countsByState?.stopped || 0);
            const policy = resolveFolderHealthPolicy(folder, fallbackWarnThreshold);
            const warnThreshold = policy.warnThreshold;
            const criticalThreshold = policy.criticalThreshold;
            if (totalMembers === 0) {
                return {
                    severity: 'empty',
                    filterSeverity: 'empty',
                    text: 'Empty',
                    className: 'is-empty',
                    isAlert: false,
                    score: 100,
                    isMaintenance: false,
                    reasons: [
                        makeHealthReason('EMPTY_FOLDER', 'No members in this folder.', 'info')
                    ],
                    policy,
                    details: [
                        'Score: 100/100.',
                        'No members in this folder.',
                        `Policy: ${policy.profile} profile (${warnThreshold}% warn, ${criticalThreshold}% critical).`
                    ]
                };
            }

            const {
                stoppedPercent,
                allStopped,
                hasUpdates,
                allStoppedCritical,
                stoppedCritical,
                stoppedWarn,
                updateMaintenance,
                updateCritical,
                severity,
                maintenanceOnly,
                filterSeverity
            } = classifyDockerFolderHealth({
                members: totalMembers,
                started,
                paused,
                stopped,
                updateCount,
                policy
            });

            const reasons = [];
            if (allStopped) {
                reasons.push(makeHealthReason(
                    'ALL_STOPPED',
                    `All ${stopped}/${totalMembers} members are stopped.`,
                    allStoppedCritical ? 'critical' : 'warning'
                ));
            }
            if (stoppedCritical) {
                reasons.push(makeHealthReason(
                    'STOPPED_PERCENT_CRITICAL',
                    `Stopped percentage ${stoppedPercent}% is above critical threshold ${criticalThreshold}%.`,
                    'critical'
                ));
            } else if (stoppedWarn) {
                reasons.push(makeHealthReason(
                    'STOPPED_PERCENT_WARN',
                    `Stopped percentage ${stoppedPercent}% is above warn threshold ${warnThreshold}%.`,
                    'warning'
                ));
            }
            if (paused > 0) {
                reasons.push(makeHealthReason(
                    'PAUSED_MEMBERS',
                    surfaceT("common.repair.paused-members-1-9c89f8", "Paused members: $1.", paused),
                    'warning'
                ));
            }
            if (hasUpdates && policy.updatesMode !== 'ignore') {
                reasons.push(makeHealthReason(
                    updateCount >= 10 ? 'UPDATE_SURGE' : 'UPDATES_PENDING',
                    surfaceT("common.repair.available-updates-1-1251a9", "Available updates: $1.", updateCount),
                    updateMaintenance ? 'maintenance' : (updateCritical ? 'critical' : 'warning')
                ));
            }
            if (!reasons.length) {
                reasons.push(makeHealthReason(
                    'HEALTHY',
                    'No health issues detected.',
                    'success'
                ));
            }

            let scorePenalty = 0;
            if (stoppedPercent > 0) {
                if (stoppedPercent >= warnThreshold) {
                    const range = Math.max(1, 100 - warnThreshold);
                    scorePenalty += 18 + Math.round(((stoppedPercent - warnThreshold) / range) * 42);
                } else {
                    scorePenalty += Math.round((stoppedPercent / Math.max(1, warnThreshold)) * 18);
                }
            }
            if (paused > 0) {
                scorePenalty += Math.min(20, 2 + Math.round((paused / totalMembers) * 30));
            }
            if (hasUpdates && policy.updatesMode !== 'ignore') {
                const updatePenaltyBase = policy.updatesMode === 'warn' ? 4 : 2;
                const updatePenaltyCap = policy.updatesMode === 'warn' ? 34 : 18;
                scorePenalty += Math.min(updatePenaltyCap, updateCount * updatePenaltyBase);
            }
            if (allStopped) {
                scorePenalty += policy.allStoppedMode === 'critical' ? 40 : 24;
            }
            if (stoppedCritical) {
                scorePenalty += 18;
            }
            if (updateCritical) {
                scorePenalty += 16;
            }
            const score = Math.max(0, Math.min(100, 100 - scorePenalty));

            const details = [
                `Score: ${score}/100.`,
                `${started} started, ${paused} paused, ${stopped} stopped (${stoppedPercent}% stopped).`,
                hasUpdates ? surfaceT("common.repair.available-updates-1-1251a9", "Available updates: $1.", updateCount) : 'No updates available.',
                `Policy: ${policy.profile} | updates ${policy.updatesMode} | all-stopped ${policy.allStoppedMode}.`,
                `Thresholds: warn ${warnThreshold}% (${policy.warnSource}), critical ${criticalThreshold}% (${policy.criticalSource}).`,
                ...reasons.map((reason) => `${reason.label}: ${reason.message}`)
            ];

            let text = 'Healthy';
            let className = 'is-ok';
            if (severity === 'critical') {
                text = 'Critical';
                className = 'is-danger';
            } else if (maintenanceOnly) {
                text = 'Maintenance';
                className = 'is-maintenance';
            } else if (severity === 'warn') {
                text = 'Degraded';
                className = 'is-warning';
            }
            return {
                severity,
                filterSeverity,
                text,
                className,
                isAlert: severity === 'critical' || (severity === 'warn' && !maintenanceOnly),
                score,
                isMaintenance: maintenanceOnly,
                reasons,
                policy,
                details
            };
        };
        const valueIsTruthy = typeof deps.valueIsTruthy === 'function' ? deps.valueIsTruthy : ((value) => Boolean(value));

        const buildStatusSnapshot = (type, folders, memberSnapshot, infoByName) => {
            const snapshot = {};
            for (const [id] of Object.entries(folders || {})) {
                const members = Array.isArray(memberSnapshot?.[id]?.members) ? memberSnapshot[id].members : [];
                const countsByState = { started: 0, paused: 0, stopped: 0 };
                for (const member of members) {
                    const runtimeState = getItemRuntimeStateKind(type, infoByName[member] || {});
                    if (runtimeState === 'started') {
                        countsByState.started += 1;
                    } else if (runtimeState === 'paused') {
                        countsByState.paused += 1;
                    } else {
                        countsByState.stopped += 1;
                    }
                }
                snapshot[String(id)] = {
                    total: members.length,
                    started: countsByState.started,
                    paused: countsByState.paused,
                    stopped: countsByState.stopped,
                    statusKey: deriveFolderStatusKey(countsByState, members.length)
                };
            }
            return snapshot;
        };

        const isDockerUpdateAvailable = (itemInfo) => {
            const source = itemInfo && typeof itemInfo === 'object' ? itemInfo : {};
            if (source.UpdateAvailable === true || source.update === true) {
                return true;
            }
            const state = source?.info?.State || source?.State || {};
            return state?.manager === 'dockerman' && state?.Updated === false;
        };

        const formatGiBFromKiB = (kibValue) => {
            const kib = Number(kibValue) || 0;
            if (kib <= 0) {
                return '0 GiB';
            }
            const gib = kib / (1024 * 1024);
            const fixed = (globalThis.FolderViewPlusI18n?.formatNumber?.(gib, { minimumFractionDigits: gib >= 100 ? 0 : 1, maximumFractionDigits: gib >= 100 ? 0 : 1 }) || (gib >= 100 ? gib.toFixed(0) : gib.toFixed(1)));
            return `${fixed} GiB`;
        };

        const formatVmMemoryLabel = (kibValue) => {
            const kib = Number(kibValue) || 0;
            if (kib <= 0) {
                return '0 GB';
            }
            const gib = kib / (1024 * 1024);
            const rounded = (globalThis.FolderViewPlusI18n?.formatNumber?.(gib, { minimumFractionDigits: gib >= 100 ? 0 : 1, maximumFractionDigits: gib >= 100 ? 0 : 1 }) || (gib >= 100 ? gib.toFixed(0) : gib.toFixed(1)));
            const compact = globalThis.FolderViewPlusI18n?.formatNumber?.(gib, { maximumFractionDigits: gib >= 100 ? 0 : 1 }) || (rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded);
            return `${compact} GB`;
        };

        const collectVmFolderResources = (members, infoByName) => {
            const list = Array.isArray(members) ? members : [];
            const info = infoByName && typeof infoByName === 'object' ? infoByName : {};
            let autostartCount = 0;
            let vcpusTotal = 0;
            let memoryKiBTotal = 0;
            let storageBytesTotal = 0;
            const autostartMembers = [];
            for (const member of list) {
                const vmInfo = info[member] || {};
                if (valueIsTruthy(vmInfo.autostart)) {
                    autostartCount += 1;
                    autostartMembers.push(String(member));
                }
                vcpusTotal += Number(vmInfo.vcpus ?? vmInfo.nrVirtCpu ?? 0) || 0;
                memoryKiBTotal += Number(vmInfo.memoryKiB ?? vmInfo.memory ?? vmInfo.maxMem ?? 0) || 0;
                storageBytesTotal += Number(vmInfo.storageBytes ?? vmInfo.storage ?? 0) || 0;
            }
            return {
                membersCount: list.length,
                autostartCount,
                autostartMembers,
                vcpusTotal,
                memoryKiBTotal,
                storageBytesTotal
            };
        };

        const evaluateVmResourceBadge = (resourceTotals, healthPrefs) => {
            const totals = resourceTotals && typeof resourceTotals === 'object' ? resourceTotals : {};
            const prefs = healthPrefs && typeof healthPrefs === 'object' ? healthPrefs : {};
            const vcpusTotal = Number(totals.vcpusTotal || 0);
            const memoryKiBTotal = Number(totals.memoryKiBTotal || 0);
            const storageBytesTotal = Number(totals.storageBytesTotal || 0);
            const membersCount = Number(totals.membersCount || 0);
            const memoryGiBTotal = memoryKiBTotal > 0 ? (memoryKiBTotal / (1024 * 1024)) : 0;
            const storageText = formatBytesShort(storageBytesTotal) || '0 B';
            const warnVcpus = Number.isFinite(Number(prefs.vmResourceWarnVcpus)) ? Number(prefs.vmResourceWarnVcpus) : 16;
            const criticalVcpus = Number.isFinite(Number(prefs.vmResourceCriticalVcpus)) ? Number(prefs.vmResourceCriticalVcpus) : 32;
            const warnGiB = Number.isFinite(Number(prefs.vmResourceWarnGiB)) ? Number(prefs.vmResourceWarnGiB) : 32;
            const criticalGiB = Number.isFinite(Number(prefs.vmResourceCriticalGiB)) ? Number(prefs.vmResourceCriticalGiB) : 64;
            const criticalCpuExceeded = vcpusTotal >= criticalVcpus;
            const criticalMemoryExceeded = memoryGiBTotal >= criticalGiB;
            const warnCpuExceeded = vcpusTotal >= warnVcpus;
            const warnMemoryExceeded = memoryGiBTotal >= warnGiB;

            let severity = 'good';
            if (membersCount <= 0) {
                severity = 'empty';
            } else if (criticalCpuExceeded || criticalMemoryExceeded) {
                severity = 'critical';
            } else if (warnCpuExceeded || warnMemoryExceeded) {
                severity = 'warn';
            }

            const cpuClass = membersCount <= 0
                ? 'is-empty'
                : (criticalCpuExceeded ? 'is-critical' : (warnCpuExceeded ? 'is-warn' : 'is-good'));
            const memoryClass = membersCount <= 0
                ? 'is-empty'
                : (criticalMemoryExceeded ? 'is-critical' : (warnMemoryExceeded ? 'is-warn' : 'is-good'));
            const storageClass = membersCount <= 0
                ? 'is-empty'
                : (storageBytesTotal > 0 ? 'is-good' : 'is-empty');
            const text = `${vcpusTotal} vCPU | ${formatVmMemoryLabel(memoryKiBTotal)} RAM | ${storageText} storage`;
            const detailLines = [
                `Total resources: ${text}`,
                `Thresholds: warn ${warnVcpus} vCPU / ${warnGiB} GB, critical ${criticalVcpus} vCPU / ${criticalGiB} GB.`
            ];
            if (warnCpuExceeded || warnMemoryExceeded) {
                const reasons = [];
                if (warnCpuExceeded) {
                    reasons.push(`${vcpusTotal} vCPU >= warn ${warnVcpus}`);
                }
                if (warnMemoryExceeded) {
                    reasons.push(`${formatVmMemoryLabel(memoryKiBTotal)} >= warn ${warnGiB} GB`);
                }
                detailLines.push(`Warning: ${reasons.join(' | ')}`);
            }
            if (criticalCpuExceeded || criticalMemoryExceeded) {
                const reasons = [];
                if (criticalCpuExceeded) {
                    reasons.push(`${vcpusTotal} vCPU >= critical ${criticalVcpus}`);
                }
                if (criticalMemoryExceeded) {
                    reasons.push(`${formatVmMemoryLabel(memoryKiBTotal)} >= critical ${criticalGiB} GB`);
                }
                detailLines.push(`Critical: ${reasons.join(' | ')}`);
            }

            return {
                severity,
                text,
                title: detailLines.join('\n'),
                className: severity === 'critical'
                    ? 'is-critical'
                    : (severity === 'warn' ? 'is-warn' : (severity === 'empty' ? 'is-empty' : 'is-good')),
                chips: {
                    cpu: {
                        text: `${vcpusTotal} vCPU`,
                        className: cpuClass,
                        title: `CPU total: ${vcpusTotal} vCPU\nWarn: ${warnVcpus} vCPU\nCritical: ${criticalVcpus} vCPU`
                    },
                    memory: {
                        text: `${formatVmMemoryLabel(memoryKiBTotal)} RAM`,
                        className: memoryClass,
                        title: `Memory total: ${formatVmMemoryLabel(memoryKiBTotal)}\nWarn: ${warnGiB} GB\nCritical: ${criticalGiB} GB`
                    },
                    storage: {
                        text: `${storageText} Storage`,
                        className: storageClass,
                        title: `Storage total (file-backed disks): ${storageText}`
                    }
                }
            };
        };

        const hasInvalidFolderRegex = (folder) => {
            const pattern = String(folder?.regex || '').trim();
            if (!pattern) {
                return false;
            }
            try {
                // eslint-disable-next-line no-new
                new RegExp(pattern);
                return false;
            } catch (_error) {
                return true;
            }
        };

        const buildTypeHealthMetrics = (type, folders, memberSnapshot = {}, prefsOverride = null) => {
            const normalizedType = normalizeType(type);
            const folderMap = typeof utils.normalizeFolderMap === 'function' ? utils.normalizeFolderMap(folders) : (folders && typeof folders === 'object' ? folders : {});
            const prefsSource = prefsOverride || getPrefsByType(normalizedType);
            const prefs = typeof utils.normalizePrefs === 'function' ? utils.normalizePrefs(prefsSource) : (prefsSource && typeof prefsSource === 'object' ? prefsSource : {});
            const healthPrefs = normalizeHealthPrefs(normalizedType, prefs);
            const info = getInfoByType(normalizedType) || {};
            const conflictReport = typeof utils.getConflictReport === 'function'
                ? utils.getConflictReport({
                    type: normalizedType,
                    folders: folderMap,
                    prefs,
                    infoByName: info
                })
                : { conflictingItems: 0, rows: [] };
            const conflictFolderIds = new Set();
            for (const row of conflictReport.rows || []) {
                if (!row?.hasConflict) {
                    continue;
                }
                for (const matched of row.matchedFolders || []) {
                    const folderId = String(matched?.folderId || '').trim();
                    if (folderId) {
                        conflictFolderIds.add(folderId);
                    }
                }
            }

            const folderStatusTotals = { empty: 0 };
            let attentionCount = 0;
            const healthSeverityTotals = {
                maintenance: 0,
                warn: 0,
                critical: 0
            };
            for (const [folderId, folder] of Object.entries(folderMap)) {
                const members = Array.isArray(memberSnapshot?.[folderId]?.members) ? memberSnapshot[folderId].members : [];
                let started = 0;
                let paused = 0;
                let stopped = 0;
                for (const name of members) {
                    const state = getItemRuntimeStateKind(normalizedType, info[name] || {});
                    if (state === 'started') {
                        started += 1;
                    } else if (state === 'paused') {
                        paused += 1;
                    } else {
                        stopped += 1;
                    }
                }
                const isEmpty = members.length === 0;
                const isStoppedOnly = members.length > 0 && started === 0 && paused === 0;
                const hasConflict = conflictFolderIds.has(String(folderId));
                const invalidRegex = hasInvalidFolderRegex(folder);
                let needsAttention = isEmpty || isStoppedOnly || hasConflict || invalidRegex;
                let dockerHealth = null;
                if (normalizedType === 'docker') {
                    let updateCount = 0;
                    for (const member of members) {
                        if (isDockerUpdateAvailable(info[member] || {})) {
                            updateCount += 1;
                        }
                    }
                    dockerHealth = evaluateDockerFolderHealth(
                        folder,
                        members.length,
                        { started, paused, stopped },
                        updateCount,
                        healthPrefs.warnStoppedPercent
                    );
                    if (dockerHealth && typeof dockerHealth === 'object') {
                        const severityKey = String(dockerHealth.filterSeverity || dockerHealth.severity || '').trim().toLowerCase();
                        if (['maintenance', 'warn', 'critical'].includes(severityKey)) {
                            healthSeverityTotals[severityKey] += 1;
                        }
                        needsAttention = (dockerHealth.severity === 'warn' || dockerHealth.severity === 'critical')
                            || hasConflict
                            || invalidRegex;
                    }
                }

                if (isEmpty) {
                    folderStatusTotals.empty += 1;
                }
                if (needsAttention) {
                    attentionCount += 1;
                }
            }

            return {
                folderCount: Object.keys(folderMap).length,
                ruleCount: (prefs.autoRules || []).length,
                folderStatusTotals,
                attentionCount,
                healthSeverityTotals
            };
        };

        return Object.freeze({
            normalizeHealthPrefs,
            resolveFolderHealthPolicy,
            evaluateDockerFolderHealth,
            buildStatusSnapshot,
            isDockerUpdateAvailable,
            formatGiBFromKiB,
            formatVmMemoryLabel,
            collectVmFolderResources,
            evaluateVmResourceBadge,
            hasInvalidFolderRegex,
            buildTypeHealthMetrics
        });
    };

    return Object.freeze({
        createApi,
        HEALTH_PROFILE_PRESETS,
        applyHealthProfilePreset,
        syncHealthSummaryVisibility,
        classifyDockerFolderHealth
    });
}));
