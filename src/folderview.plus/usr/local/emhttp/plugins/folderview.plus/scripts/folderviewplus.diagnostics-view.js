(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDiagnosticsView = factory();
    root.FolderViewPlusDiagnosticsViewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const STATUS_CONFIG = Object.freeze({
        unchecked: Object.freeze({ label: 'Not checked', icon: 'fa-minus-circle' }),
        healthy: Object.freeze({ label: 'Healthy', icon: 'fa-check-circle' }),
        info: Object.freeze({ label: 'Notice', icon: 'fa-info-circle' }),
        warning: Object.freeze({ label: 'Follow up', icon: 'fa-exclamation-triangle' }),
        error: Object.freeze({ label: 'Needs attention', icon: 'fa-times-circle' })
    });
    const CARD_CONFIG = Object.freeze({
        docker: Object.freeze({ icon: 'fa-cubes' }),
        vm: Object.freeze({ icon: 'fa-desktop' }),
        storage: Object.freeze({ icon: 'fa-folder-o' }),
        custom_icons: Object.freeze({ icon: 'fa-picture-o' }),
        update: Object.freeze({ icon: 'fa-upload' }),
        theme: Object.freeze({ icon: 'fa-paint-brush' }),
        performance_budget: Object.freeze({ icon: 'fa-line-chart' }),
        native_organizer: Object.freeze({ icon: 'fa-puzzle-piece', action: 'diagnostics-check-native-organizer' }),
        localization: Object.freeze({ icon: 'fa-globe' })
    });

    const createApi = (deps = {}) => {
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? ''));
        const translate = (key, fallback = '', ...params) => (
            typeof deps.t === 'function' ? deps.t(key, fallback, ...params) : (fallback || key)
        );
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
            const config = CARD_CONFIG[card.key] || { icon: 'fa-stethoscope' };
            const action = config.action ? `
                <button type="button" class="fv-diagnostics-context-action" data-fv-ui-action="${escapeHtml(config.action)}">
                    <i class="fa fa-refresh" aria-hidden="true"></i>
                    ${escapeHtml(translate('diagnostics.actions.check-again', 'Check again'))}
                </button>
            ` : '';
            return `
                <article id="${escapeHtml(cardId(card.key))}" class="fv-diagnostics-health-card is-${escapeHtml(card.status)}" tabindex="-1" data-fv-diagnostics-card="${escapeHtml(card.key)}">
                    <div class="fv-diagnostics-health-card-head">
                        <span class="fv-diagnostics-health-card-icon" aria-hidden="true"><i class="fa ${config.icon}"></i></span>
                        <strong>${escapeHtml(card.label)}</strong>
                        <span class="fv-diagnostics-status-badge is-${escapeHtml(card.status)}"><i class="fa ${status.icon}" aria-hidden="true"></i>${escapeHtml(card.badgeLabel || status.label)}</span>
                    </div>
                    <p class="fv-diagnostics-health-card-headline">${escapeHtml(card.headline)}</p>
                    ${card.detail ? `<p class="fv-diagnostics-health-card-detail">${escapeHtml(card.detail)}</p>` : ''}
                    <div class="fv-diagnostics-health-card-foot">
                        ${card.freshness ? `<span><i class="fa fa-clock-o" aria-hidden="true"></i>${escapeHtml(card.freshness)}</span>` : ''}
                        ${action}
                    </div>
                    ${buildTechnicalDetails(card)}
                </article>
            `;
        };

        const buildHero = (model) => {
            const status = statusConfig(model.overall.status);
            const metrics = model.metrics;
            return `
                <section class="fv-diagnostics-hero is-${escapeHtml(model.overall.status)}" aria-labelledby="fv-diagnostics-overall-title">
                    <div class="fv-diagnostics-overall">
                        <span class="fv-diagnostics-status-ring" role="img" aria-label="${escapeHtml(model.overall.label)}">
                            <i class="fa ${status.icon}" aria-hidden="true"></i>
                        </span>
                        <div>
                            <span class="fv-diagnostics-eyebrow">${escapeHtml(translate('diagnostics.overall.label', 'Overall health'))}</span>
                            <h3 id="fv-diagnostics-overall-title">${escapeHtml(model.overall.headline)}</h3>
                            <p>${escapeHtml(model.overall.detail)}</p>
                            <span class="fv-diagnostics-overall-chip is-${escapeHtml(model.overall.status)}">${escapeHtml(model.overall.label)}</span>
                        </div>
                    </div>
                    <dl class="fv-diagnostics-metrics">
                        <div><dt>${escapeHtml(translate('diagnostics.metrics.notices', 'Optional notices'))}</dt><dd>${escapeHtml(metrics.optionalCount)}</dd><small>${escapeHtml(translate('diagnostics.metrics.informational', 'Informational only'))}</small></div>
                        <div><dt>${escapeHtml(translate('diagnostics.metrics.last-check', 'Last checked'))}</dt><dd>${escapeHtml(metrics.checkedAtLabel)}</dd></div>
                        <div><dt>${escapeHtml(translate('diagnostics.metrics.version', 'Current version'))}</dt><dd>${escapeHtml(metrics.pluginVersion)}</dd><small>${escapeHtml(metrics.updateLabel)}</small></div>
                        <div><dt>${escapeHtml(translate('diagnostics.metrics.core-checks', 'Core checks'))}</dt><dd>${escapeHtml(`${metrics.coreHealthy} / ${metrics.coreTotal}`)}</dd><small>${escapeHtml(model.overall.status === 'healthy' ? 'All checks passed' : 'Review results below')}</small></div>
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
                banners.push(`<div class="fv-diagnostics-state-banner is-error" role="alert"><i class="fa fa-exclamation-circle" aria-hidden="true"></i><span><strong>${escapeHtml(translate('diagnostics.state.failed-title', 'The latest health check failed.'))}</strong>${escapeHtml(model.errorMessage)}</span></div>`);
            }
            if (model.stale) {
                banners.push(`<div class="fv-diagnostics-state-banner is-stale" role="status"><i class="fa fa-clock-o" aria-hidden="true"></i><span><strong>${escapeHtml(translate('diagnostics.state.stale-title', 'These results may be out of date.'))}</strong>${escapeHtml(translate('diagnostics.state.stale-detail', 'Run the health check again to refresh checks older than 15 minutes.'))}</span></div>`);
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
                        <div class="fv-diagnostics-clear-result"><i class="fa fa-check-circle" aria-hidden="true"></i><span><strong>${escapeHtml(translate('diagnostics.findings.none-title', 'No urgent issues detected'))}</strong><small>${escapeHtml(translate('diagnostics.findings.none-detail', 'Your system is operating normally.'))}</small></span></div>
                    </section>
                `;
            }
            return `
                <section class="fv-diagnostics-findings" aria-labelledby="fv-diagnostics-findings-title">
                    <div class="fv-diagnostics-findings-head"><h3 id="fv-diagnostics-findings-title">${escapeHtml(translate('diagnostics.findings.title', 'Priority findings'))}</h3><span>${escapeHtml(`${model.findings.length} ${model.findings.length === 1 ? 'finding' : 'findings'}`)}</span></div>
                    <div class="fv-diagnostics-findings-list">
                        ${model.findings.map((finding) => {
                            const status = statusConfig(finding.status);
                            return `<a href="#${escapeHtml(cardId(finding.key))}" class="fv-diagnostics-finding is-${escapeHtml(finding.status)}"><i class="fa ${status.icon}" aria-hidden="true"></i><span><strong>${escapeHtml(finding.label)}</strong><small>${escapeHtml(finding.headline)}</small></span><i class="fa fa-angle-right" aria-hidden="true"></i></a>`;
                        }).join('')}
                    </div>
                </section>
            `;
        };

        const buildSection = (id, title, cards, additional = false) => {
            if (!cards.length) return '';
            const healthy = cards.filter((card) => card.status === 'healthy').length;
            const notices = cards.filter((card) => card.status === 'info').length;
            const badge = additional
                ? `${notices} ${notices === 1 ? 'notice' : 'notices'}`
                : `${healthy} of ${cards.length} healthy`;
            return `
                <section class="fv-diagnostics-card-section is-${additional ? 'additional' : 'system'}" aria-labelledby="${escapeHtml(id)}">
                    <div class="fv-diagnostics-section-heading"><h3 id="${escapeHtml(id)}">${escapeHtml(title)}</h3><span>${escapeHtml(badge)}</span></div>
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
                        <span class="fv-diagnostics-status-ring" aria-hidden="true"><i class="fa ${statusConfig(model.overall.status).icon}"></i></span>
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
                ${buildSection('fv-diagnostics-additional-title', translate('diagnostics.sections.additional', 'Additional diagnostics'), [...model.advisoryCards, ...model.additionalCards], true)}
            `;
        };

        return Object.freeze({ render, buildCard, buildHero, buildFindings, buildSection });
    };

    return Object.freeze({ createApi, STATUS_CONFIG, CARD_CONFIG });
}));
