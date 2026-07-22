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

    const createApi = (deps = {}) => {
        const utils = deps.utils || {};
        const formatBytesShort = typeof deps.formatBytesShort === 'function' ? deps.formatBytesShort : ((value) => String(value ?? '0 B'));
        const getPrefsByType = typeof deps.getPrefsByType === 'function' ? deps.getPrefsByType : (() => ({}));
        const getInfoByType = typeof deps.getInfoByType === 'function' ? deps.getInfoByType : (() => ({}));
        const normalizeHealthPrefs = typeof deps.normalizeHealthPrefs === 'function' ? deps.normalizeHealthPrefs : (() => ({}));
        const getItemRuntimeStateKind = typeof deps.getItemRuntimeStateKind === 'function' ? deps.getItemRuntimeStateKind : (() => 'stopped');
        const deriveFolderStatusKey = typeof deps.deriveFolderStatusKey === 'function' ? deps.deriveFolderStatusKey : (() => 'empty');
        const evaluateDockerFolderHealth = typeof deps.evaluateDockerFolderHealth === 'function'
            ? deps.evaluateDockerFolderHealth
            : (() => ({ severity: 'good', score: 100, filterSeverity: 'good', isMaintenance: false }));
        const valueIsTruthy = typeof deps.valueIsTruthy === 'function' ? deps.valueIsTruthy : ((value) => Boolean(value));
        const getHealthFilterMode = typeof deps.getHealthFilterMode === 'function' ? deps.getHealthFilterMode : (() => 'all');

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
            const fixed = gib >= 100 ? gib.toFixed(0) : gib.toFixed(1);
            return `${fixed} GiB`;
        };

        const formatVmMemoryLabel = (kibValue) => {
            const kib = Number(kibValue) || 0;
            if (kib <= 0) {
                return '0 GB';
            }
            const gib = kib / (1024 * 1024);
            const rounded = gib >= 100 ? gib.toFixed(0) : gib.toFixed(1);
            const compact = rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
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
            const pinnedSet = new Set(Array.isArray(prefs.pinnedFolderIds) ? prefs.pinnedFolderIds : []);
            const regexRuleKinds = new Set(['name_regex', 'image_regex', 'compose_project_regex']);
            const invalidRuleRegexCount = (prefs.autoRules || []).reduce((count, rule) => {
                if (!regexRuleKinds.has(String(rule?.kind || ''))) {
                    return count;
                }
                const pattern = String(rule?.pattern || '').trim();
                if (!pattern) {
                    return count;
                }
                try {
                    // eslint-disable-next-line no-new
                    new RegExp(pattern);
                    return count;
                } catch (_error) {
                    return count + 1;
                }
            }, 0);
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

            const memberTotals = { total: 0, started: 0, paused: 0, stopped: 0 };
            const folderStatusTotals = { started: 0, paused: 0, stopped: 0, empty: 0 };
            const folderIssues = {};
            const healthScoreTotals = {
                sum: 0,
                count: 0
            };
            const healthSeverityTotals = {
                good: 0,
                maintenance: 0,
                warn: 0,
                critical: 0,
                empty: 0
            };
            let invalidFolderRegexCount = 0;

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
                memberTotals.total += members.length;
                memberTotals.started += started;
                memberTotals.paused += paused;
                memberTotals.stopped += stopped;

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
                        Number(healthPrefs.warnStoppedPercent) || 60
                    );
                    if (dockerHealth && typeof dockerHealth === 'object') {
                        const score = Number(dockerHealth.score);
                        if (Number.isFinite(score)) {
                            healthScoreTotals.sum += score;
                            healthScoreTotals.count += 1;
                        }
                        const severityKey = String(dockerHealth.filterSeverity || dockerHealth.severity || '').trim().toLowerCase();
                        if (Object.prototype.hasOwnProperty.call(healthSeverityTotals, severityKey)) {
                            healthSeverityTotals[severityKey] += 1;
                        } else if (severityKey === 'warn') {
                            healthSeverityTotals.warn += 1;
                        }
                        needsAttention = (dockerHealth.severity === 'warn' || dockerHealth.severity === 'critical')
                            || hasConflict
                            || invalidRegex;
                    }
                }

                if (isEmpty) {
                    folderStatusTotals.empty += 1;
                } else if (started > 0) {
                    folderStatusTotals.started += 1;
                } else if (paused > 0) {
                    folderStatusTotals.paused += 1;
                } else {
                    folderStatusTotals.stopped += 1;
                }
                if (invalidRegex) {
                    invalidFolderRegexCount += 1;
                }

                folderIssues[String(folderId)] = {
                    empty: isEmpty,
                    stoppedOnly: isStoppedOnly,
                    conflict: hasConflict,
                    invalidRegex,
                    attention: needsAttention,
                    memberCount: members.length,
                    healthSeverity: dockerHealth?.severity || '',
                    healthFilterSeverity: dockerHealth?.filterSeverity || dockerHealth?.severity || '',
                    healthScore: Number.isFinite(Number(dockerHealth?.score)) ? Number(dockerHealth.score) : null,
                    healthMaintenance: dockerHealth?.isMaintenance === true
                };
            }

            const stoppedPercent = memberTotals.total > 0
                ? Math.round((memberTotals.stopped / memberTotals.total) * 100)
                : 0;
            const attentionCount = Object.values(folderIssues).filter((issue) => issue.attention).length;
            let severity = 'ok';
            if (invalidFolderRegexCount > 0 || invalidRuleRegexCount > 0 || conflictReport.conflictingItems > 0) {
                severity = 'danger';
            } else if (healthSeverityTotals.critical > 0 || healthSeverityTotals.warn > 0 || stoppedPercent >= healthPrefs.warnStoppedPercent || attentionCount > 0) {
                severity = 'warning';
            }
            const averageHealthScore = healthScoreTotals.count > 0
                ? Math.round(healthScoreTotals.sum / healthScoreTotals.count)
                : 0;

            return {
                type: normalizedType,
                severity,
                folderCount: Object.keys(folderMap).length,
                pinnedCount: Array.from(pinnedSet).filter((id) => Object.prototype.hasOwnProperty.call(folderMap, id)).length,
                ruleCount: (prefs.autoRules || []).length,
                invalidFolderRegexCount,
                invalidRuleRegexCount,
                conflictItemCount: Number(conflictReport.conflictingItems || 0),
                stoppedPercent,
                averageHealthScore,
                memberTotals,
                folderStatusTotals,
                attentionCount,
                healthSeverityTotals,
                folderIssues
            };
        };

        const normalizeHealthFilterMode = (value) => {
            const mode = String(value || 'all').trim().toLowerCase();
            return ['all', 'attention', 'empty', 'stopped', 'conflict'].includes(mode) ? mode : 'all';
        };

        const folderMatchesHealthFilter = (type, folderId, healthMetrics) => {
            const mode = normalizeHealthFilterMode(getHealthFilterMode(normalizeType(type)));
            if (mode === 'all') {
                return true;
            }
            const issue = healthMetrics?.folderIssues?.[String(folderId)] || {};
            if (mode === 'attention') {
                return issue.attention === true;
            }
            if (mode === 'empty') {
                return issue.empty === true;
            }
            if (mode === 'stopped') {
                return issue.stoppedOnly === true;
            }
            if (mode === 'conflict') {
                return issue.conflict === true;
            }
            return true;
        };

        const getHealthFilterLabel = (mode) => {
            if (mode === 'attention') {
                return 'needs attention';
            }
            if (mode === 'empty') {
                return 'empty';
            }
            if (mode === 'stopped') {
                return 'stopped';
            }
            if (mode === 'conflict') {
                return 'conflicts';
            }
            return 'all';
        };

        return Object.freeze({
            buildStatusSnapshot,
            isDockerUpdateAvailable,
            formatGiBFromKiB,
            formatVmMemoryLabel,
            collectVmFolderResources,
            evaluateVmResourceBadge,
            hasInvalidFolderRegex,
            buildTypeHealthMetrics,
            folderMatchesHealthFilter,
            getHealthFilterLabel
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
