(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDiagnosticsViewModel = factory();
    root.FolderViewPlusDiagnosticsViewModelModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const DEFAULT_STALE_AFTER_MS = 15*60*1000;
    const VALID_STATUSES = new Set(['healthy', 'info', 'warning', 'error']);
    const normalizeStatus = (value, fallback = 'healthy') => {
        const normalized = String(value || '').trim().toLowerCase();
        return VALID_STATUSES.has(normalized) ? normalized : fallback;
    };
    const normalizeCard = (card, checkedAtLabel = '') => {
        if (!card || typeof card !== 'object') return null;
        const key = String(card.key || 'status').trim() || 'status';
        return Object.freeze({
            ...card,
            key,
            label: String(card.label || key).trim() || key,
            status: normalizeStatus(card.status),
            headline: String(card.headline || 'No summary available.').trim(),
            detail: String(card.detail || '').trim(),
            badgeLabel: String(card.badgeLabel || '').trim(),
            meta: String(card.meta || '').trim(),
            freshness: String(card.freshness || '').trim() || (checkedAtLabel ? `Checked ${checkedAtLabel}` : ''),
            technicalDetails: Object.freeze(
                (Array.isArray(card.technicalDetails) ? card.technicalDetails : [])
                    .map((detail) => String(detail || '').trim())
                    .filter(Boolean)
            ),
            actions: Object.freeze(
                (Array.isArray(card.actions) ? card.actions : [])
                    .map((action) => {
                        const actionName = String(action?.action || '').trim();
                        if (!/^[a-z][a-z0-9_]{0,63}$/.test(actionName)) return null;
                        return Object.freeze({
                            action: actionName,
                            label: String(action?.label || 'Run recommended repair').trim(),
                            reason: String(action?.reason || '').trim()
                        });
                    })
                    .filter(Boolean)
            )
        });
    };
    const countByStatus = (cards, statuses) => cards.filter((card) => statuses.includes(card.status)).length;

    const derivePriorityFindings = (coreCards, advisoryCards) => (
        [...coreCards, ...advisoryCards]
            .filter((card) => ['error', 'warning'].includes(card.status))
            .sort((left, right) => {
                const rank = { error: 0, warning: 1 };
                return rank[left.status] - rank[right.status];
            })
            .map((card) => Object.freeze({
                key: card.key,
                status: card.status,
                label: card.label,
                headline: card.headline,
                detail: card.detail
            }))
    );

    const deriveUpdateLabel = (coreCards) => {
        const update = coreCards.find((card) => card.key === 'update');
        if (!update) return 'Not checked';
        if (update.status === 'healthy') return 'Up to date';
        if (/available/i.test(update.headline)) return 'Update available';
        return 'Check needs follow-up';
    };

    const deriveOverall = (coreCards, advisoryCards) => {
        if (countByStatus(coreCards, ['error']) > 0) {
            return Object.freeze({
                status: 'error',
                label: 'Needs attention',
                headline: 'Core plugin health needs attention.',
                detail: 'Review the priority findings and affected system checks below.'
            });
        }
        if (countByStatus(coreCards, ['warning']) > 0) {
            return Object.freeze({
                status: 'warning',
                label: 'Follow up',
                headline: 'Core plugin health needs follow-up.',
                detail: 'The plugin is running, but one or more core checks need review.'
            });
        }
        if (countByStatus(advisoryCards, ['error', 'warning']) > 0) {
            return Object.freeze({
                status: 'warning',
                label: 'Healthy with advisories',
                headline: 'Core plugin health is good.',
                detail: 'A performance advisory needs follow-up, but core operation is healthy.'
            });
        }
        return Object.freeze({
            status: 'healthy',
            label: 'Healthy',
            headline: 'All systems operational.',
            detail: 'No actionable configuration, storage, update, icon, or theme issue was detected.'
        });
    };

    const buildDiagnosticsViewModel = (input = {}) => {
        const checkedAt = String(input.checkedAt || '').trim();
        const checkedAtMs = Date.parse(checkedAt);
        const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
        const staleAfterMs = Number.isFinite(Number(input.staleAfterMs))
            ? Math.max(0, Number(input.staleAfterMs))
            : DEFAULT_STALE_AFTER_MS;
        const hasResults = input.hasResults === true;
        const isRunning = input.running === true;
        const checkedAtLabel = String(input.checkedAtLabel || '').trim();
        const coreCards = Object.freeze(
            (Array.isArray(input.coreCards) ? input.coreCards : [])
                .map((card) => normalizeCard(card, checkedAtLabel))
                .filter(Boolean)
        );
        const advisoryCards = Object.freeze(
            (Array.isArray(input.advisoryCards) ? input.advisoryCards : [])
                .map((card) => normalizeCard(card, checkedAtLabel))
                .filter(Boolean)
        );
        const additionalCards = Object.freeze(
            (Array.isArray(input.additionalCards) ? input.additionalCards : [])
                .map((card) => normalizeCard(card, checkedAtLabel))
                .filter(Boolean)
        );
        const errorMessage = String(input.errorMessage || '').trim();
        const isStale = hasResults
            && Number.isFinite(checkedAtMs)
            && staleAfterMs > 0
            && now - checkedAtMs >= staleAfterMs;

        if (!hasResults) {
            return Object.freeze({
                state: isRunning ? 'running' : (errorMessage ? 'error' : 'unchecked'),
                running: isRunning,
                errorMessage,
                stale: false,
                staleAfterMs,
                overall: Object.freeze({
                    status: errorMessage ? 'error' : 'unchecked',
                    label: errorMessage ? 'Check failed' : 'Not checked',
                    headline: errorMessage ? 'Health check could not finish.' : 'Run a health check to inspect the plugin.',
                    detail: errorMessage || 'Docker, VM, storage, custom icons, updates, and theme will be checked together.'
                }),
                metrics: Object.freeze({
                    coreHealthy: 0,
                    coreTotal: 0,
                    optionalCount: 0,
                    checkedAtLabel: 'Not checked',
                    pluginVersion: String(input.pluginVersion || 'Unknown'),
                    updateLabel: 'Not checked'
                }),
                findings: Object.freeze([]),
                coreCards,
                advisoryCards,
                additionalCards
            });
        }

        const overall = deriveOverall(coreCards, advisoryCards);
        return Object.freeze({
            state: isRunning ? 'running' : (errorMessage ? 'error' : 'results'),
            running: isRunning,
            errorMessage,
            stale: isStale,
            staleAfterMs,
            overall,
            metrics: Object.freeze({
                coreHealthy: countByStatus(coreCards, ['healthy']),
                coreTotal: coreCards.length,
                optionalCount: additionalCards.filter((card) => card.status === 'info').length,
                checkedAtLabel: checkedAtLabel || 'Unknown',
                pluginVersion: String(input.pluginVersion || 'Unknown'),
                updateLabel: deriveUpdateLabel(coreCards)
            }),
            findings: Object.freeze(derivePriorityFindings(coreCards, advisoryCards)),
            coreCards,
            advisoryCards,
            additionalCards
        });
    };

    return Object.freeze({
        DEFAULT_STALE_AFTER_MS,
        normalizeStatus,
        normalizeCard,
        buildDiagnosticsViewModel
    });
}));
