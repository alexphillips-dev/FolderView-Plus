(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDiagnosticsView = factory();
    root.FolderViewPlusDiagnosticsViewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const STATUS_CONFIG = Object.freeze({
        unchecked: Object.freeze({ label: 'Not checked', icon: 'minus-circle' }),
        healthy: Object.freeze({ label: 'Healthy', icon: 'check-circle' }),
        info: Object.freeze({ label: 'Notice', icon: 'info-circle' }),
        warning: Object.freeze({ label: 'Follow up', icon: 'alert-triangle' }),
        error: Object.freeze({ label: 'Needs attention', icon: 'x-circle' })
    });
    const CARD_CONFIG = Object.freeze({
        docker: Object.freeze({ icon: 'boxes' }),
        vm: Object.freeze({ icon: 'monitor' }),
        storage: Object.freeze({ icon: 'folder' }),
        custom_icons: Object.freeze({ icon: 'image' }),
        update: Object.freeze({ icon: 'upload' }),
        theme: Object.freeze({ icon: 'paintbrush' })
    });

    const createApi = (deps = {}) => {
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? ''));
        const translate = (key, fallback = '', ...params) => (
            typeof deps.t === 'function' ? deps.t(key, fallback, ...params) : (fallback || key)
        );
        const svgIcon = typeof deps.svgIcon === 'function'
            ? deps.svgIcon
            : ((name, { className = '' } = {}) => `<svg class="fv-ui-svg-icon${className ? ` ${escapeHtml(className)}` : ''}" viewBox="0 0 24 24" aria-hidden="true" data-fv-icon="${escapeHtml(name)}"><circle cx="12" cy="12" r="9"></circle></svg>`);
        const statusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
        const cardId = (key) => `fv-diagnostics-card-${String(key || 'status').replace(/[^a-z0-9_-]/gi, '-')}`;

        const buildTechnicalDetails = (card) => {
            if (!card.technicalDetails?.length) return '';
            return `
                <details class="fv-diagnostics-card-details">
                    <summary>${escapeHtml(translate('diagnostics.cards.technical-details', 'Technical details'))} <i class="fa fa-angle-right" aria-hidden="true"></i></summary>
                    <ul>${card.technicalDetails.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
                </details>
            `;
        };

        const buildCard = (card) => {
            const status = statusConfig(card.status);
            const config = CARD_CONFIG[card.key] || { icon: 'info-circle' };
            const iconTone = `is-${String(card.key || 'status').replace(/[^a-z0-9_-]/gi, '-')}`;
            const action = config.action ? `
                <button type="button" class="fv-diagnostics-context-action" data-fv-ui-action="${escapeHtml(config.action)}">
                    ${svgIcon('refresh')}
                    ${escapeHtml(translate('diagnostics.actions.check-again', 'Check again'))}
                </button>
            ` : '';
            return `
                <article id="${escapeHtml(cardId(card.key))}" class="fv-diagnostics-health-card is-${escapeHtml(card.status)}" tabindex="-1" data-fv-diagnostics-card="${escapeHtml(card.key)}">
                    <div class="fv-diagnostics-health-card-head">
                        <span class="fv-diagnostics-health-card-icon ${escapeHtml(iconTone)}" aria-hidden="true">${svgIcon(config.icon)}</span>
                        <strong>${escapeHtml(card.label)}</strong>
                        <span class="fv-diagnostics-status-badge is-${escapeHtml(card.status)}">${svgIcon(status.icon)}${escapeHtml(card.badgeLabel || status.label)}</span>
                    </div>
                    <p class="fv-diagnostics-health-card-headline">${escapeHtml(card.headline)}</p>
                    ${card.detail ? `<p class="fv-diagnostics-health-card-detail">${escapeHtml(card.detail)}</p>` : ''}
                    <div class="fv-diagnostics-health-card-foot">
                        ${card.freshness ? `<span>${svgIcon('clock')}${escapeHtml(card.freshness)}</span>` : ''}
                        ${action}
                    </div>
                    ${buildTechnicalDetails(card)}
                </article>
            `;
        };

        const buildHero = (model) => {
            const status = statusConfig(model.overall.status);
            const metrics = model.metrics;
            const corePercent = metrics.coreTotal > 0
                ? Math.max(0, Math.min(100, Math.round((metrics.coreHealthy / metrics.coreTotal) * 100)))
                : 0;
            return `
                <section class="fv-diagnostics-hero is-${escapeHtml(model.overall.status)}" aria-labelledby="fv-diagnostics-overall-title">
                    <div class="fv-diagnostics-overall">
                        <span class="fv-diagnostics-status-ring" role="img" aria-label="${escapeHtml(model.overall.label)}">
                            ${svgIcon(status.icon)}
                        </span>
                        <div>
                            <span class="fv-diagnostics-eyebrow">${escapeHtml(translate('diagnostics.overall.label', 'Overall health'))}</span>
                            <h3 id="fv-diagnostics-overall-title">${escapeHtml(model.overall.headline)}</h3>
                            <p>${escapeHtml(model.overall.detail)}</p>
                            <span class="fv-diagnostics-overall-chip is-${escapeHtml(model.overall.status)}">${escapeHtml(model.overall.label)}</span>
                        </div>
                    </div>
                    <dl class="fv-diagnostics-metrics">
                        <div class="fv-diagnostics-metric has-icon is-notices">
                            ${svgIcon('info-circle', { className: 'fv-diagnostics-metric-icon' })}
                            <dt>${escapeHtml(translate('diagnostics.metrics.notices', 'Optional notices'))}</dt>
                            <dd>${escapeHtml(metrics.optionalCount)}</dd>
                            <dd class="fv-diagnostics-metric-note"><small>${escapeHtml(translate('diagnostics.metrics.informational', 'Informational only'))}</small></dd>
                        </div>
                        <div class="fv-diagnostics-metric has-icon is-checked">
                            ${svgIcon('calendar', { className: 'fv-diagnostics-metric-icon' })}
                            <dt>${escapeHtml(translate('diagnostics.metrics.last-check', 'Last checked'))}</dt>
                            <dd>${escapeHtml(metrics.checkedAtLabel)}</dd>
                        </div>
                        <div class="fv-diagnostics-metric has-icon is-version">
                            ${svgIcon('package', { className: 'fv-diagnostics-metric-icon' })}
                            <dt>${escapeHtml(translate('diagnostics.metrics.version', 'Current version'))}</dt>
                            <dd>${escapeHtml(metrics.pluginVersion)}</dd>
                            <dd class="fv-diagnostics-metric-note"><small>${escapeHtml(metrics.updateLabel)}</small></dd>
                        </div>
                        <div class="fv-diagnostics-metric is-core is-${escapeHtml(model.overall.status)}">
                            <dt>${escapeHtml(translate('diagnostics.metrics.core-checks', 'Core checks'))}</dt>
                            <dd>${escapeHtml(`${metrics.coreHealthy} / ${metrics.coreTotal}`)}</dd>
                            <dd class="fv-diagnostics-metric-note"><small>${escapeHtml(model.overall.status === 'healthy' ? 'All checks passed' : 'Review results below')}</small></dd>
                            <dd class="fv-diagnostics-core-progress-wrap"><span class="fv-diagnostics-core-progress" role="progressbar" aria-label="${escapeHtml(translate('diagnostics.metrics.core-checks', 'Core checks'))}" aria-valuemin="0" aria-valuemax="${escapeHtml(metrics.coreTotal)}" aria-valuenow="${escapeHtml(metrics.coreHealthy)}"><span style="width: ${corePercent}%"></span></span></dd>
                        </div>
                    </dl>
                </section>
            `;
        };

        const buildBanners = (model) => {
            const banners = [];
            if (model.running) {
                banners.push(`<div class="fv-diagnostics-state-banner is-running" role="status"><i class="fa fa-spinner fa-spin" aria-hidden="true"></i><span><strong>${escapeHtml(translate('diagnostics.state.running-title', 'Health check in progress'))}</strong>${escapeHtml(translate('diagnostics.state.running-detail', 'The latest complete results will remain visible while checks refresh.'))}</span></div>`);
            }
            if (model.errorMessage) {
                banners.push(`<div class="fv-diagnostics-state-banner is-error" role="alert">${svgIcon('x-circle')}<span><strong>${escapeHtml(translate('diagnostics.state.failed-title', 'The latest health check failed.'))}</strong>${escapeHtml(model.errorMessage)}</span></div>`);
            }
            if (model.stale) {
                banners.push(`<div class="fv-diagnostics-state-banner is-stale" role="status">${svgIcon('clock')}<span><strong>${escapeHtml(translate('diagnostics.state.stale-title', 'These results may be out of date.'))}</strong>${escapeHtml(translate('diagnostics.state.stale-detail', 'Run the health check again to refresh checks older than 15 minutes.'))}</span></div>`);
            }
            return banners.join('');
        };

        const buildFindings = (model) => {
            if (!model.findings.length) {
                return `
                    <section class="fv-diagnostics-findings is-clear" aria-labelledby="fv-diagnostics-findings-title">
                        <div class="fv-diagnostics-findings-head">
                            <h3 id="fv-diagnostics-findings-title">${escapeHtml(translate('diagnostics.findings.title', 'Priority findings'))}</h3>
                        </div>
                        <div class="fv-diagnostics-clear-result">${svgIcon('check-circle')}<span><strong>${escapeHtml(translate('diagnostics.findings.none-title', 'No urgent issues detected'))}</strong><small>${escapeHtml(translate('diagnostics.findings.none-detail', 'Your system is operating normally.'))}</small></span></div>
                    </section>
                `;
            }
            const coreCardKeys = new Set(model.coreCards.map((card) => card.key));
            return `
                <section class="fv-diagnostics-findings" aria-labelledby="fv-diagnostics-findings-title">
                    <div class="fv-diagnostics-findings-head"><h3 id="fv-diagnostics-findings-title">${escapeHtml(translate('diagnostics.findings.title', 'Priority findings'))}</h3><span>${escapeHtml(`${model.findings.length} ${model.findings.length === 1 ? 'finding' : 'findings'}`)}</span></div>
                    <div class="fv-diagnostics-findings-list">
                        ${model.findings.map((finding) => {
                            const status = statusConfig(finding.status);
                            const content = `${svgIcon(status.icon)}<span><strong>${escapeHtml(finding.label)}</strong><small>${escapeHtml(finding.headline)}</small></span>`;
                            if (coreCardKeys.has(finding.key)) {
                                return `<a href="#${escapeHtml(cardId(finding.key))}" class="fv-diagnostics-finding is-${escapeHtml(finding.status)}">${content}<i class="fa fa-angle-right" aria-hidden="true"></i></a>`;
                            }
                            return `<div class="fv-diagnostics-finding is-${escapeHtml(finding.status)} is-summary-only">${content}</div>`;
                        }).join('')}
                    </div>
                </section>
            `;
        };

        const buildSection = (id, title, cards) => {
            if (!cards.length) return '';
            const healthy = cards.filter((card) => card.status === 'healthy').length;
            return `
                <section class="fv-diagnostics-card-section is-system" aria-labelledby="${escapeHtml(id)}">
                    <div class="fv-diagnostics-section-heading"><h3 id="${escapeHtml(id)}">${escapeHtml(title)}</h3><span>${escapeHtml(`${healthy} of ${cards.length} healthy`)}</span></div>
                    <div class="fv-diagnostics-health-grid">${cards.map(buildCard).join('')}</div>
                </section>
            `;
        };

        const render = (host, model) => {
            if (!host || !model) return;
            host.setAttribute('aria-busy', model.running ? 'true' : 'false');
            if (model.state === 'unchecked' || (model.state === 'error' && !model.coreCards.length)) {
                host.innerHTML = `
                    ${buildBanners(model)}
                    <section class="fv-diagnostics-unchecked is-${escapeHtml(model.overall.status)}">
                        <span class="fv-diagnostics-status-ring" aria-hidden="true">${svgIcon(statusConfig(model.overall.status).icon)}</span>
                        <div><span class="fv-diagnostics-eyebrow">${escapeHtml(model.overall.label)}</span><h3>${escapeHtml(model.overall.headline)}</h3><p>${escapeHtml(model.overall.detail)}</p></div>
                    </section>
                `;
                return;
            }
            host.innerHTML = `
                ${buildBanners(model)}
                ${buildHero(model)}
                ${buildFindings(model)}
                ${buildSection('fv-diagnostics-system-title', translate('diagnostics.sections.system', 'System health'), model.coreCards)}
            `;
        };

        return Object.freeze({ render, buildCard, buildHero, buildFindings, buildSection });
    };

    return Object.freeze({ createApi, STATUS_CONFIG, CARD_CONFIG });
}));
