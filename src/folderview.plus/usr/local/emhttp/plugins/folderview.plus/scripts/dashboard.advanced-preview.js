// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDashboardAdvancedPreview = factory();
    root.FolderViewPlusDashboardAdvancedPreviewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
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
        const raw = String(value || '').trim();
        const match = raw.match(/^([0-9]*\.?[0-9]+)\s*([KMGTPE]?i?B?)?$/i);
        if (!match) {
            return 0;
        }
        const amount = Number(match[1]);
        if (!Number.isFinite(amount)) {
            return 0;
        }
        const unit = String(match[2] || 'B').toUpperCase();
        const multipliers = {
            B: 1,
            K: 1024,
            KB: 1024,
            KIB: 1024,
            M: 1024 ** 2,
            MB: 1024 ** 2,
            MIB: 1024 ** 2,
            G: 1024 ** 3,
            GB: 1024 ** 3,
            GIB: 1024 ** 3,
            T: 1024 ** 4,
            TB: 1024 ** 4,
            TIB: 1024 ** 4
        };
        return amount * (multipliers[unit] || 1);
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
                        <img src="${icon}" class="img folder-img" alt="" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png'">
                        <div class="fv-dashboard-advanced-preview-title">
                            <span class="blue-text appname">${name}</span>
                            <span><i class="fa fa-${statusIcon} ${statusClass}"></i> ${escapeHtml(i18n(statusKey, statusKey))}</span>
                        </div>
                    </div>
                    <div class="fv-dashboard-advanced-preview-grid">
                        <div>
                            <div class="fv-dashboard-advanced-preview-section-title">${escapeHtml(i18n('version', 'Version'))}</div>
                            <div>${image}</div>
                            <div class="fv-dashboard-advanced-preview-muted">${repository}</div>
                        </div>
                        <div>
                            <div class="fv-dashboard-advanced-preview-section-title">CPU/MEM</div>
                            <span class="cpu-${shortId}">0%</span>
                            <div class="usage-disk mm"><span id="cpu-${shortId}" style="width: 0%;"></span><span></span></div>
                            <span class="mem-${shortId}">0 / 0</span>
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
                        <div>${buildPortMappingsHtml(info.Ports)}</div>
                    </details>
                    <details class="fv-dashboard-advanced-preview-details">
                        <summary>${escapeHtml(i18n('volume-mappings', 'Volume mappings'))}</summary>
                        <div>${buildVolumeMappingsHtml(ct?.Mounts)}</div>
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
            const addAction = (icon, label, handler, href = '#') => {
                const $action = jq(`<a href="${href}" class="fv-dashboard-advanced-preview-action"><i class="fa fa-${icon}" aria-hidden="true"></i> ${escapeHtml(label)}</a>`);
                $action.on('click', (event) => {
                    event.preventDefault();
                    handler();
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
            if (typeof win?.eventControl === 'function' && shortId) {
                if (state.Running !== true) {
                    addAction('play', i18n('start', 'Start'), () => win.eventControl({ action: 'start', container: shortId }, 'loadlist'));
                } else if (state.Paused === true) {
                    addAction('play', i18n('resume', 'Resume'), () => win.eventControl({ action: 'resume', container: shortId }, 'loadlist'));
                } else {
                    addAction('stop', i18n('stop', 'Stop'), () => win.eventControl({ action: 'stop', container: shortId }, 'loadlist'));
                    addAction('pause', i18n('pause', 'Pause'), () => win.eventControl({ action: 'pause', container: shortId }, 'loadlist'));
                }
                addAction('refresh', i18n('restart', 'Restart'), () => win.eventControl({ action: 'restart', container: shortId }, 'loadlist'));
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
            const colorCpu = getComputedStyle(doc?.documentElement || doc?.body || {}).getPropertyValue('--folder-view3-graph-cpu') || '#2b8da3';
            const colorMem = getComputedStyle(doc?.documentElement || doc?.body || {}).getPropertyValue('--folder-view3-graph-mem') || '#5d6db6';
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
            const shortId = String(ct?.shortId || '').trim();
            const raw = typeof event?.data === 'string' ? event.data : String(event || '');
            const line = raw.split('\n').find((entry) => shortId && entry.includes(shortId)) || '';
            const parts = line.split(/\s+/).filter(Boolean);
            if (parts.length < 3) {
                return { cpu: 0, mem: 0 };
            }
            const cpuRaw = Number(String(parts[1] || '0').replace('%', ''));
            const cpu = Number.isFinite(cpuRaw) ? cpuRaw / Math.max(1, Number(cpus) || 1) : 0;
            const memParts = String(parts[2] || '').split('/');
            const used = memToBytes(memParts[0]);
            const total = memToBytes(memParts[1]);
            return {
                cpu,
                mem: total > 0 ? (used / total) * 100 : 0
            };
        };

        const attachAdvancedPreview = ({ triggerEl, ct, folder = {}, id = '', settings = {}, cpus = 1 } = {}) => {
            if (!jq || !triggerEl || !ct || typeof jq.fn?.tooltipster !== 'function') {
                return false;
            }
            const $trigger = jq(triggerEl).first();
            if (!$trigger.length || $trigger.data('fvDashboardAdvancedPreviewAttached') === true) {
                return false;
            }
            const triggerMode = settings.previewTrigger === 'hover' && win?.FolderViewPlusTouchMode !== true ? 'hover' : 'click';
            const CPU = [];
            const MEM = [];
            let charts = [];
            let attachedListener = null;
            let tooltipObserver = null;
            const graphListener = (event) => {
                const now = Date.now();
                const next = parseStatsMessage(event, ct, cpus);
                CPU.push({ x: now, y: next.cpu });
                MEM.push({ x: now, y: next.mem });
                updateCharts(charts);
            };
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
                functionReady: function(_instance, helper) {
                    const tooltipDom = helper.tooltip && helper.tooltip.length ? helper.tooltip : jq(helper.tooltip);
                    charts = createCharts(tooltipDom, ct, settings, CPU, MEM);
                    const cpuTextElement = tooltipDom.find(`.cpu-${ct.shortId}`).get(0);
                    if (cpuTextElement && typeof win?.MutationObserver === 'function') {
                        tooltipObserver = new win.MutationObserver((mutationList) => {
                            for (const mutation of mutationList) {
                                tooltipDom.find(`span#cpu-${ct.shortId}`).css('width', mutation.target.textContent);
                            }
                        });
                        tooltipObserver.observe(cpuTextElement, { childList: true });
                    }
                    if (!attachedListener && win?.dockerload && typeof win.dockerload.addEventListener === 'function') {
                        win.dockerload.addEventListener('message', graphListener);
                        attachedListener = 'sse';
                    }
                },
                functionAfter: function() {
                    if (attachedListener === 'sse' && win?.dockerload && typeof win.dockerload.removeEventListener === 'function') {
                        win.dockerload.removeEventListener('message', graphListener);
                    }
                    attachedListener = null;
                    for (const chart of charts) {
                        try {
                            chart.destroy();
                        } catch (_error) {
                            // Ignore late chart cleanup failures.
                        }
                    }
                    charts = [];
                    if (tooltipObserver) {
                        tooltipObserver.disconnect();
                        tooltipObserver = null;
                    }
                },
                content: jq('<div class="fv-tooltip-lazy-loading">Loading preview...</div>')
            });
            return true;
        };

        return {
            attachAdvancedPreview,
            buildContent,
            parseStatsMessage
        };
    };

    return {
        createApi
    };
}));
