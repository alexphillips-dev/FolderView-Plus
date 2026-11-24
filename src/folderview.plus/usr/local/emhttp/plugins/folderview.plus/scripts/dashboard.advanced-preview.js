// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDashboardAdvancedPreview = factory();
    root.FolderViewPlusDashboardAdvancedPreviewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const GRAPHQL_STATS_TIMEOUT_MS = 5000;
    const LEGACY_STATS_TARGET_CHECK_MS = 1000;

    const escapeHtmlFallback = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const clampGraphMode = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(0, Math.min(4, Math.round(numeric))) : 1;
    };

    const clampGraphTimeMs = (value) => {
        const numeric = Number(value);
        const seconds = Number.isFinite(numeric) ? Math.max(5, Math.min(600, Math.round(numeric))) : 60;
        return seconds * 1000;
    };

    const memToBytes = (value) => {
        const raw = String(value ?? '').trim();
        const match = raw.match(/^([0-9]*\.?[0-9]+)\s*([KMGTPE](?:i?B)?|B)?$/i);
        if (!match) {
            return null;
        }
        const amount = Number(match[1]);
        const unit = String(match[2] || 'B').toUpperCase();
        const bytes = amount * 1024 ** 'BKMGTPE'.indexOf(unit[0]);
        return Number.isFinite(bytes) ? bytes : null;
    };

    const statsNumber = (value) => {
        if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) {
            return null;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
    };

    const statsContainerId = (value) => String(value ?? '').split(':').pop()?.trim() || '';
    const matchesStatsId = (value, ct) => {
        const statsId = statsContainerId(value);
        const shortId = statsContainerId(ct?.shortId);
        const containerId = [ct?.id, ct?.info?.Id].map(statsContainerId).find((id) => (
            id.length > shortId.length && id.startsWith(shortId)
        ));
        if (containerId && statsId.length > shortId.length) return statsId === containerId;
        return shortId !== '' && statsId.startsWith(shortId);
    };

    const createApi = (deps = {}) => {
        const win = deps.window || (typeof window !== 'undefined' ? window : null);
        const doc = deps.document || win?.document || null;
        const jq = deps.$ || win?.jQuery || win?.$ || null;
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : escapeHtmlFallback;
        const sanitizeImageSrc = typeof deps.sanitizeImageSrc === 'function'
            ? deps.sanitizeImageSrc
            : ((value, fallback = '/plugins/dynamix.docker.manager/images/question.png') => {
                const raw = String(value || '').trim();
                return raw && !/^javascript:/i.test(raw) ? escapeHtml(raw) : fallback;
            });
        const getSafeWebUiUrl = typeof deps.getSafeWebUiUrl === 'function'
            ? deps.getSafeWebUiUrl
            : ((value) => {
                const raw = String(value || '').trim();
                return /^(https?:)?\/\//i.test(raw) || raw.startsWith('/') ? raw : '';
            });
        const openWebUiInNewTab = typeof deps.openWebUiInNewTab === 'function'
            ? deps.openWebUiInNewTab
            : ((url) => {
                if (!win || !url) {
                    return false;
                }
                const anchor = doc?.createElement ? doc.createElement('a') : null;
                if (!anchor || !doc?.body) {
                    return false;
                }
                anchor.href = url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.style.display = 'none';
                doc.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                return true;
            });
        const i18n = (key, fallback = '') => {
            try {
                if (jq && typeof jq.i18n === 'function') {
                    const localized = String(jq.i18n(key) || '').trim();
                    if (localized && localized !== key) {
                        return localized;
                    }
                }
            } catch (_error) {
                // Fall through to fallback.
            }
            return fallback || key;
        };

        const buildPortMappingsHtml = (ports) => {
            const rows = Array.isArray(ports) ? ports : [];
            if (!rows.length) {
                return `<span class="fv-dashboard-advanced-preview-muted">${escapeHtml(i18n('none', 'None'))}</span>`;
            }
            return rows.map((entry) => {
                const privateIp = escapeHtml(entry?.PrivateIP || '');
                const publicIp = escapeHtml(entry?.PublicIP || '');
                const privatePort = escapeHtml(entry?.PrivatePort || '');
                const publicPort = escapeHtml(entry?.PublicPort || '');
                const type = escapeHtml(String(entry?.Type || '').toUpperCase());
                const left = [privateIp, privatePort].filter(Boolean).join(':');
                const right = [publicIp, publicPort].filter(Boolean).join(':');
                return `<span class="fv-dashboard-advanced-preview-mono">${left || '-'} <i class="fa fa-arrows-h"></i> ${right || '-'} ${type}</span>`;
            }).join('<br>');
        };

        const buildVolumeMappingsHtml = (mounts) => {
            const rows = Array.isArray(mounts) ? mounts.filter((entry) => entry?.Type === 'bind') : [];
            if (!rows.length) {
                return `<span class="fv-dashboard-advanced-preview-muted">${escapeHtml(i18n('none', 'None'))}</span>`;
            }
            return rows.slice(0, 16).map((entry) => {
                const destination = escapeHtml(entry?.Destination || '');
                const source = escapeHtml(entry?.Source || '');
                return `<span class="fv-dashboard-advanced-preview-mono">${destination || '-'} <i class="fa fa-arrows-h"></i> ${source || '-'}</span>`;
            }).join('<br>');
        };

        const buildContent = (ct, settings = {}) => {
            const info = ct?.info || {};
            const state = info.State || {};
            const labels = ct?.Labels && typeof ct.Labels === 'object' ? ct.Labels : {};
            const shortId = escapeHtml(ct?.shortId || info.Id || info.Name || 'docker');
            const name = escapeHtml(info.Name || '');
            const image = escapeHtml(String(info.Config?.Image || '').split(':').pop() || '');
            const repository = escapeHtml(String(info.Config?.Image || '').split(':').shift() || '');
            const icon = sanitizeImageSrc(labels['net.unraid.docker.icon'], '/plugins/dynamix.docker.manager/images/question.png');
            const running = state.Running === true;
            const paused = state.Paused === true;
            const statusKey = running ? (paused ? 'paused' : 'started') : 'stopped';
            const statusIcon = running ? (paused ? 'pause' : 'play') : 'square';
            const statusClass = running ? (paused ? 'paused orange-text' : 'started green-text') : 'stopped red-text';
            const graphMode = clampGraphMode(settings.previewGraph);
            const graphHidden = graphMode === 0 ? ' is-hidden' : '';
            return jq(`
                <div class="fv-dashboard-advanced-preview preview-outbox preview-outbox-${shortId}">
                    <div class="fv-dashboard-advanced-preview-header">
                        <img src="${icon}" class="img folder-img" alt="" data-fv-onerror="this.src='/plugins/dynamix.docker.manager/images/question.png'">
                        <div class="fv-dashboard-advanced-preview-title">
                            <span class="blue-text appname">${name}</span>
                            <span class="fv-dashboard-advanced-preview-subtitle"><i class="fa fa-${statusIcon} ${statusClass}"></i> ${escapeHtml(i18n(statusKey, statusKey))}</span>
                        </div>
                    </div>
                    <div class="fv-dashboard-advanced-preview-grid">
                        <div class="fv-dashboard-advanced-preview-field">
                            <div class="fv-dashboard-advanced-preview-label">${escapeHtml(i18n('version', 'Version'))}</div>
                            <div class="fv-dashboard-advanced-preview-value">${image}</div>
                            <div class="fv-dashboard-advanced-preview-muted">${repository}</div>
                        </div>
                        <div class="fv-dashboard-advanced-preview-field">
                            <div class="fv-dashboard-advanced-preview-label">CPU/MEM</div>
                            <span class="fv-dashboard-advanced-preview-value cpu-${shortId}">0%</span>
                            <div class="usage-disk mm"><span id="cpu-${shortId}" data-fvplus-style="fv-u-u73jk7"></span><span></span></div>
                            <span class="fv-dashboard-advanced-preview-value mem-${shortId}">0 / 0</span>
                        </div>
                    </div>
                    <div class="fv-dashboard-advanced-preview-actions"></div>
                    <div class="fv-dashboard-advanced-preview-graphs${graphHidden}">
                        <div class="comb-grapth-${shortId} comb-stat-grapth"><canvas></canvas></div>
                        <div class="cpu-grapth-${shortId} cpu-stat-grapth"><canvas></canvas></div>
                        <div class="mem-grapth-${shortId} mem-stat-grapth"><canvas></canvas></div>
                    </div>
                    <details class="fv-dashboard-advanced-preview-details">
                        <summary>${escapeHtml(i18n('port-mappings', 'Port mappings'))}</summary>
                        <div class="fv-dashboard-advanced-preview-list">${buildPortMappingsHtml(info.Ports)}</div>
                    </details>
                    <details class="fv-dashboard-advanced-preview-details">
                        <summary>${escapeHtml(i18n('volume-mappings', 'Volume mappings'))}</summary>
                        <div class="fv-dashboard-advanced-preview-list">${buildVolumeMappingsHtml(ct?.Mounts)}</div>
                    </details>
                </div>
            `);
        };

        const attachActions = ($content, ct) => {
            const info = ct?.info || {};
            const state = info.State || {};
            const containerName = String(info.Name || '').trim();
            const shortId = String(ct?.shortId || '').trim();
            const webUiUrl = getSafeWebUiUrl(state.WebUi);
            const shell = String(info.Shell || 'sh').trim() || 'sh';
            const $actions = $content.find('.fv-dashboard-advanced-preview-actions').first();
            const dockerActionProvider = win?.FolderViewPlusDockerProviders?.getDefault?.() || null;
            const providerSupportsAction = (action) => {
                const capabilityAction = String(action || '').trim().toLowerCase() === 'resume'
                    ? 'unpause'
                    : String(action || '').trim().toLowerCase();
                if (typeof win?.eventControl === 'function') return true;
                if (typeof dockerActionProvider?.supports === 'function') {
                    return dockerActionProvider.supports(`mutation.${capabilityAction}`) === true;
                }
                return dockerActionProvider?.capabilities?.executeActions === true;
            };
            const runDockerAction = (action) => {
                if (dockerActionProvider && typeof dockerActionProvider.executeAction === 'function') {
                    return dockerActionProvider.executeAction({ action, container: shortId });
                }
                if (win?.FolderViewPlusRuntimeTransport?.runDockerAction) {
                    return win.FolderViewPlusRuntimeTransport.runDockerAction({ action, container: shortId });
                }
                if (typeof win?.eventControl === 'function') {
                    win.eventControl({ action, container: shortId }, 'loadlist');
                    return Promise.resolve({ transport: 'host-event-control' });
                }
                return Promise.reject(new Error('No compatible Docker action provider is available.'));
            };
            const addAction = (icon, label, handler, href = '#') => {
                const $action = jq(`<a href="${href}" class="fv-dashboard-advanced-preview-action"><i class="fa fa-${icon}" aria-hidden="true"></i> ${escapeHtml(label)}</a>`);
                $action.on('click', (event) => {
                    event.preventDefault();
                    Promise.resolve()
                        .then(handler)
                        .catch((error) => {
                            if (win?.FolderViewPlusUI?.alert) {
                                win.FolderViewPlusUI.alert({
                                    title: 'FolderView action failed',
                                    message: String(error?.message || 'FolderView action failed'),
                                    tone: 'danger'
                                });
                            }
                        });
                });
                $actions.append($action);
            };
            if (webUiUrl && state.Running === true && state.Paused !== true) {
                addAction('globe', i18n('webui', 'WebUI'), () => openWebUiInNewTab(webUiUrl), webUiUrl);
            }
            if (containerName && typeof win?.openTerminal === 'function' && state.Running === true) {
                addAction('terminal', i18n('console', 'Console'), () => win.openTerminal('docker', containerName, shell));
            }
            if (containerName && typeof win?.openTerminal === 'function') {
                addAction('navicon', i18n('logs', 'Logs'), () => win.openTerminal('docker', containerName, '.log'));
            }
            if (
                shortId
                && (
                    typeof win?.eventControl === 'function'
                    || ['start', 'stop', 'restart', 'pause', 'resume'].some(providerSupportsAction)
                    || (
                        !dockerActionProvider
                        && typeof win?.FolderViewPlusRuntimeTransport?.runDockerAction === 'function'
                    )
                )
            ) {
                if (state.Running !== true && providerSupportsAction('start')) {
                    addAction('play', i18n('start', 'Start'), () => runDockerAction('start'));
                } else if (state.Paused === true && providerSupportsAction('resume')) {
                    addAction('play', i18n('resume', 'Resume'), () => runDockerAction('resume'));
                } else {
                    if (providerSupportsAction('stop')) {
                        addAction('stop', i18n('stop', 'Stop'), () => runDockerAction('stop'));
                    }
                    if (providerSupportsAction('pause')) {
                        addAction('pause', i18n('pause', 'Pause'), () => runDockerAction('pause'));
                    }
                }
                if (providerSupportsAction('restart')) {
                    addAction('refresh', i18n('restart', 'Restart'), () => runDockerAction('restart'));
                }
            }
        };

        const updateCharts = (charts) => {
            for (const chart of charts) {
                try {
                    if (chart && chart.canvas && (!doc?.body || doc.body.contains(chart.canvas))) {
                        chart.update('quiet');
                    }
                } catch (_error) {
                    // Chart can receive a late event while Tooltipster is closing.
                }
            }
        };

        const createCharts = ($tooltip, ct, settings, CPU, MEM) => {
            if (!win?.Chart || clampGraphMode(settings.previewGraph) === 0) {
                return [];
            }
            const shortId = String(ct?.shortId || ct?.info?.Name || 'docker');
            const graphMode = clampGraphMode(settings.previewGraph);
            const duration = clampGraphTimeMs(settings.previewGraphTime);
            const styles = win.getComputedStyle(doc?.documentElement || doc?.body || {});
            const colorCpu = styles.getPropertyValue('--folder-view3-graph-cpu') || '#2b8da3';
            const colorMem = styles.getPropertyValue('--folder-view3-graph-mem') || '#5d6db6';
            const options = {
                scales: {
                    x: {
                        type: 'realtime',
                        realtime: { duration, refresh: 1000, delay: 1000 }
                    },
                    y: { min: 0 }
                },
                interaction: { intersect: false, mode: 'index' },
                plugins: { tooltip: { position: 'nearest' } }
            };
            const makeChart = (selector, datasets) => {
                const canvas = $tooltip.find(selector).find('canvas').get(0);
                return canvas ? new win.Chart(canvas, { type: 'line', data: { datasets }, options }) : null;
            };
            const charts = [];
            if (graphMode === 1) {
                charts.push(makeChart(`.comb-grapth-${shortId}`, [
                    { label: 'CPU', data: CPU, borderColor: colorCpu, backgroundColor: colorCpu, tension: 0.4, pointRadius: 0, borderWidth: 1 },
                    { label: 'MEM', data: MEM, borderColor: colorMem, backgroundColor: colorMem, tension: 0.4, pointRadius: 0, borderWidth: 1 }
                ]));
            } else if (graphMode === 2) {
                charts.push(makeChart(`.cpu-grapth-${shortId}`, [
                    { label: 'CPU', data: CPU, borderColor: colorCpu, backgroundColor: colorCpu, tension: 0.4, pointRadius: 0, borderWidth: 1 }
                ]));
                charts.push(makeChart(`.mem-grapth-${shortId}`, [
                    { label: 'MEM', data: MEM, borderColor: colorMem, backgroundColor: colorMem, tension: 0.4, pointRadius: 0, borderWidth: 1 }
                ]));
            } else if (graphMode === 3) {
                charts.push(makeChart(`.cpu-grapth-${shortId}`, [
                    { label: 'CPU', data: CPU, borderColor: colorCpu, backgroundColor: colorCpu, tension: 0.4, pointRadius: 0, borderWidth: 1 }
                ]));
            } else if (graphMode === 4) {
                charts.push(makeChart(`.mem-grapth-${shortId}`, [
                    { label: 'MEM', data: MEM, borderColor: colorMem, backgroundColor: colorMem, tension: 0.4, pointRadius: 0, borderWidth: 1 }
                ]));
            }
            return charts.filter(Boolean);
        };

        const parseStatsMessage = (event, ct, cpus = 1) => {
            const raw = typeof event?.data === 'string' ? event.data : String(event ?? '');
            for (const row of raw.split('\n')) {
                const fields = row.includes(';') ? row.split(';') : row.trim().match(/^(\S+)\s+(\S+)\s+(.+)$/)?.slice(1);
                if (!fields) continue;
                const [id, cpuPercent, usage] = fields;
                if (!matchesStatsId(id, ct)) continue;
                const memUsage = (usage || '').trim();
                const cpuRaw = statsNumber(cpuPercent?.replace(/%\s*$/, ''));
                const [usedText, totalText] = memUsage.split('/');
                const used = memToBytes(usedText);
                const total = memToBytes(totalText);
                if (cpuRaw === null || used === null || total === null) continue;
                const mem = total > 0 ? (used / total) * 100 : 0;
                if (!Number.isFinite(mem)) continue;
                return { cpu: cpuRaw / Math.max(1, Number(cpus) || 1), mem, memUsage };
            }
            return null;
        };

        const parseGraphqlStats = (payload, ct, cpus = 1) => {
            const stats = payload?.dockerContainerStats || payload?.data?.dockerContainerStats || null;
            if (!stats || !matchesStatsId(stats.id, ct)) {
                return null;
            }
            const cpuRaw = statsNumber(stats.cpuPercent);
            const memRaw = statsNumber(stats.memPercent);
            if (cpuRaw === null || memRaw === null) {
                return null;
            }
            return {
                cpu: cpuRaw / Math.max(1, Number(cpus) || 1),
                mem: memRaw,
                memUsage: String(stats.memUsage || '').trim(),
                netIO: String(stats.netIO || '').trim(),
                blockIO: String(stats.blockIO || '').trim()
            };
        };

        const attachAdvancedPreview = ({ triggerEl, ct, getCurrentEntry, folder = {}, id = '', settings = {}, cpus = 1 } = {}) => {
            if (!jq || !triggerEl || !ct || typeof jq.fn?.tooltipster !== 'function') {
                return false;
            }
            const $trigger = jq(triggerEl).first();
            if (!$trigger.length || $trigger.data('fvDashboardAdvancedPreviewAttached') === true) {
                return false;
            }
            const triggerMode = settings.previewTrigger === 'hover' && win?.FolderViewPlusTouchMode !== true ? 'hover' : 'click';
            let activePreview = null;
            const disposePreview = () => {
                const preview = activePreview;
                activePreview = null;
                preview?.dispose();
            };
            win?.FolderViewPlusFoundationModules?.folderRenderRecovery?.registerCleanup(() => {
                disposePreview();
                if ($trigger.hasClass('tooltipstered')) $trigger.tooltipster('destroy');
                $trigger.removeData('fvDashboardAdvancedPreviewAttached fvDashboardAdvancedPreviewBuilt');
            });
            $trigger.data('fvDashboardAdvancedPreviewAttached', true);
            $trigger.removeAttr('onclick');
            $trigger.tooltipster({
                interactive: true,
                theme: ['tooltipster-docker-folder'],
                trigger: triggerMode,
                zIndex: 99998,
                functionBefore: function(instance, helper) {
                    const origin = helper.origin && helper.origin.length ? helper.origin : jq(helper.origin);
                    if (origin.data('fvDashboardAdvancedPreviewBuilt') !== true) {
                        const $content = buildContent(ct, settings);
                        attachActions($content, ct);
                        instance.content($content);
                        origin.data('fvDashboardAdvancedPreviewBuilt', true);
                    }
                },
                functionReady: function(instance, helper) {
                    disposePreview();
                    const tooltipDom = helper.tooltip && helper.tooltip.length ? helper.tooltip : jq(helper.tooltip);
                    const disposeRuntimeSummary = win.FolderViewPlusFoundationModules?.runtimePreviewSummary?.attach(tooltipDom, {
                        instance, surface: 'dashboard', entry: ct, getCurrentEntry, origin: helper.origin
                    });
                    const CPU = [];
                    const MEM = [];
                    let charts = [];
                    let legacyStatsTarget = null;
                    let unbindLegacyStats = null;
                    let legacyStatsTimer = null;
                    let graphqlStatsTimer = null;
                    let acceptGraphqlStats = true;
                    let statsSubscription = null;
                    let tooltipObserver = null;
                    const shortId = String(ct?.shortId || ct?.info?.Id || ct?.info?.Name || 'docker');
                    const preview = {
                        tooltip: tooltipDom.get(0),
                        dispose: () => {
                            disposeRuntimeSummary?.();
                            clearGraphqlTimer();
                            stopLegacyStats();
                            tooltipObserver?.disconnect();
                            for (const chart of charts) {
                                try {
                                    chart.destroy();
                                } catch (_error) {
                                    // Ignore late chart cleanup failures.
                                }
                            }
                            statsSubscription?.();
                        }
                    };
                    const isCurrent = () => activePreview === preview;
                    const clearGraphqlTimer = () => {
                        if (graphqlStatsTimer !== null) win.clearTimeout(graphqlStatsTimer);
                        graphqlStatsTimer = null;
                    };
                    const renderStats = (next) => {
                        if (!next || !isCurrent()) return;
                        const now = Date.now();
                        CPU.push({ x: now, y: next.cpu });
                        MEM.push({ x: now, y: next.mem });
                        updateCharts(charts);
                        const cpu = Math.max(0, next.cpu);
                        const cpuText = win?.FolderViewPlusI18n?.formatNumber?.(cpu / 100, {
                            style: 'percent',
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1
                        }) || `${cpu.toFixed(1)}%`;
                        tooltipDom.find(`.cpu-${shortId}`).text(cpuText);
                        tooltipDom.find(`span#cpu-${shortId}`).css(
                            'width',
                            `${Math.min(100, cpu).toFixed(1)}%`
                        );
                        if (next.memUsage) {
                            tooltipDom.find(`.mem-${shortId}`).text(next.memUsage);
                        }
                    };
                    const bindLegacyStats = () => {
                        if (!isCurrent() || graphqlStatsTimer !== null) return;
                        const target = win?.dockerload || null;
                        if (target === legacyStatsTarget) return;
                        unbindLegacyStats?.();
                        legacyStatsTarget = target;
                        unbindLegacyStats = null;
                        const handleLegacyStats = (event) => {
                            if (!isCurrent() || graphqlStatsTimer !== null) return;
                            if (target !== win.dockerload) {
                                bindLegacyStats();
                                return;
                            }
                            renderStats(parseStatsMessage(event, ct, cpus));
                        };
                        if (typeof target?.addEventListener === 'function' && typeof target.removeEventListener === 'function') {
                            target.addEventListener('message', handleLegacyStats);
                            unbindLegacyStats = () => target.removeEventListener('message', handleLegacyStats);
                        } else if (typeof target?.on === 'function' && typeof target.off === 'function') {
                            target.on('message', handleLegacyStats);
                            unbindLegacyStats = () => target.off('message', handleLegacyStats);
                        }
                    };
                    const stopLegacyStats = () => {
                        if (legacyStatsTimer !== null) win.clearInterval(legacyStatsTimer);
                        legacyStatsTimer = null;
                        unbindLegacyStats?.();
                        unbindLegacyStats = null;
                        legacyStatsTarget = null;
                    };
                    const useLegacyStats = () => {
                        if (!isCurrent()) return;
                        clearGraphqlTimer();
                        bindLegacyStats();
                        if (legacyStatsTimer === null) {
                            legacyStatsTimer = win.setInterval(bindLegacyStats, LEGACY_STATS_TARGET_CHECK_MS);
                        }
                    };
                    const handleGraphqlStats = (payload) => {
                        if (!isCurrent() || !acceptGraphqlStats) return;
                        const next = parseGraphqlStats(payload, ct, cpus);
                        if (!next) return;
                        stopLegacyStats();
                        clearGraphqlTimer();
                        graphqlStatsTimer = win.setTimeout(useLegacyStats, GRAPHQL_STATS_TIMEOUT_MS);
                        renderStats(next);
                    };
                    const mountCharts = () => {
                        if (isCurrent() && tooltipDom.closest('html').length && charts.length === 0) {
                            charts = createCharts(tooltipDom, ct, settings, CPU, MEM);
                        }
                    };
                    activePreview = preview;
                    useLegacyStats();
                    if (win.FolderViewPlusAssetLoader?.ensureChartStack) {
                        win.FolderViewPlusAssetLoader.ensureChartStack().then(mountCharts).catch((error) => {
                            if (!isCurrent() || !tooltipDom.closest('html').length) return;
                            tooltipDom.find('.folder-graph').empty().append(
                                jq('<div class="fv-tooltip-lazy-loading"></div>').text(`Graph unavailable: ${String(error?.message || error)}`)
                            );
                        });
                    } else if (typeof win.Chart === 'function') {
                        mountCharts();
                    }
                    const cpuTextElement = tooltipDom.find(`.cpu-${shortId}`).get(0);
                    if (cpuTextElement && typeof win?.MutationObserver === 'function') {
                        tooltipObserver = new win.MutationObserver((mutationList) => {
                            if (!isCurrent()) return;
                            for (const mutation of mutationList) {
                                tooltipDom.find(`span#cpu-${shortId}`).css('width', mutation.target.textContent);
                            }
                        });
                        tooltipObserver.observe(cpuTextElement, { childList: true });
                    }
                    const provider = win?.FolderViewPlusDockerProviders?.getDefault?.() || null;
                    if (
                        (
                            provider?.supports?.('subscription.dockerContainerStats') === true
                            || (
                                typeof provider?.supports !== 'function'
                                && provider?.capabilities?.subscribeStats === true
                            )
                        )
                        && typeof provider.subscribeStats === 'function'
                    ) {
                        const unsubscribe = provider.subscribeStats({
                            onData: handleGraphqlStats,
                            onError: (error) => {
                                if (['subscription-error', 'subscription-offline'].includes(error?.category)) {
                                    acceptGraphqlStats = false;
                                }
                                useLegacyStats();
                            },
                            onStatus: (snapshot) => {
                                const status = String(snapshot?.status || '');
                                if (['complete', 'reconnecting', 'unavailable', 'failed', 'closed'].includes(status)) {
                                    acceptGraphqlStats = false;
                                    useLegacyStats();
                                } else if (status === 'active') {
                                    acceptGraphqlStats = true;
                                    bindLegacyStats();
                                }
                            },
                            subscriptionId: `fvplus-dashboard-stats-${String(ct.shortId || 'container')}`
                        });
                        if (typeof unsubscribe === 'function') {
                            if (isCurrent()) statsSubscription = unsubscribe;
                            else unsubscribe();
                        }
                    }
                },
                functionAfter: function(_instance, helper) {
                    const tooltip = helper?.tooltip?.[0] || helper?.tooltip;
                    if (!tooltip || activePreview?.tooltip === tooltip) disposePreview();
                },
                content: jq('<div class="fv-tooltip-lazy-loading">Loading preview...</div>')
            });
            return true;
        };

        return {
            attachAdvancedPreview,
            buildContent,
            parseStatsMessage,
            parseGraphqlStats
        };
    };

    return {
        createApi
    };
}));
