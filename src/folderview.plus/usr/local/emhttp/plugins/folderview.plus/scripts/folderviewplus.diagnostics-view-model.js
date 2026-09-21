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
    const fallbackTranslate = (_key, fallback = '', ...params) => fallback.replace(/\$(\d+)/g,
        (token, index) => String(params[Number(index) - 1] ?? token));
    const normalizeStatus = (value, fallback = 'healthy') => {
        const normalized = String(value || '').trim().toLowerCase();
        return VALID_STATUSES.has(normalized) ? normalized : fallback;
    };
    const normalizeCard = (card, checkedAtLabel = '', translate = fallbackTranslate) => {
        if (!card || typeof card !== 'object') return null;
        const key = String(card.key || 'status').trim() || 'status';
        return Object.freeze({
            ...card,
            key,
            label: String(card.label || key).trim() || key,
            status: normalizeStatus(card.status),
            headline: String(card.headline || translate('diagnostics.cards.no-summary', 'No summary available.')).trim(),
            detail: String(card.detail || '').trim(),
            badgeLabel: String(card.badgeLabel || '').trim(),
            meta: String(card.meta || '').trim(),
            freshness: String(card.freshness || '').trim() || (checkedAtLabel ? translate('diagnostics.cards.checked', 'Checked $1', checkedAtLabel) : ''),
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
                            ...(['docker', 'vm'].includes(action.type) ? { type: action.type } : {}),
                            label: String(action?.label || 'Run recommended repair').trim(),
                            reason: String(action?.reason || '').trim()
                        });
                    })
                    .filter(Boolean)
            )
        });
    };
    const countByStatus = (cards, statuses) => cards.filter((card) => statuses.includes(card.status)).length;

    const buildThemeCard = (snapshot, { t: translate = fallbackTranslate, appliedMode = '', checkedAtLabel = '' } = {}) => {
        const list = (value) => (Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : []);
        const warnings = list(snapshot?.warnings);
        return {
            key: 'theme',
            label: translate('diagnostics.cards.theme', 'Theme'),
            status: warnings.length ? 'warning' : 'healthy',
            headline: warnings.length ? translate('diagnostics.cards.theme-warning', 'Theme compatibility needs attention.')
                : translate('diagnostics.cards.theme-healthy', 'Theme diagnostics look healthy.'),
            detail: appliedMode ? translate('diagnostics.cards.theme-mode', 'Effective mode: $1.', appliedMode)
                : translate('diagnostics.cards.theme-clear', 'Theme compatibility checks did not report any warnings.'),
            count: warnings.length,
            freshness: translate('diagnostics.cards.checked', 'Checked $1', checkedAtLabel),
            technicalDetails: [...warnings, ...list(snapshot?.adjustments)]
        };
    };

    const localizeSummaryCard = (card, diagnostics, translate) => {
        const typeData = diagnostics?.types?.[card.key];
        const count = Math.max(0, Number(card.count || typeData?.integrityChecks?.issuesCount || 0));
        const review = () => translate('diagnostics.cards.review-details', 'Review the findings in Technical details.');
        let localized = {};
        if (['docker', 'vm'].includes(card.key)) {
            localized = {
                label: card.key === 'docker' ? translate('diagnostics.cards.docker', 'Docker configuration') : translate('diagnostics.cards.vm', 'VM configuration'),
                headline: count > 0 ? translate('diagnostics.cards.issue-count', 'Issues requiring attention: $1', count)
                    : translate('diagnostics.cards.no-issues', 'No issues detected.'),
                detail: count > 0 ? review() : (typeData ? translate('diagnostics.cards.config-counts', 'Folders: $1. Rules: $2. Backups: $3.',
                    typeData.folderCount || 0, typeData.ruleCount || 0, typeData.backupCount || 0) : card.detail)
            };
        } else if (card.key === 'storage') {
            localized = {
                label: translate('diagnostics.cards.storage', 'Storage and paths'),
                headline: card.status === 'healthy' ? translate('diagnostics.cards.paths-healthy', 'Paths look healthy.')
                    : translate('diagnostics.cards.paths-issues', 'Storage or permission issues: $1', count),
                detail: card.status !== 'healthy' ? review() : (diagnostics?.runtimeIntegrity?.status === 'healthy'
                    ? translate('diagnostics.cards.storage-verified', 'Folder maps, preferences, backups, and installed runtime files passed integrity checks.')
                    : translate('diagnostics.cards.storage-readable', 'Folder maps, preferences, and backups are readable and writable.'))
            };
        } else if (card.key === 'custom_icons') {
            localized = {
                label: translate('diagnostics.cards.icons', 'Custom icons'),
                headline: card.status === 'healthy' ? translate('diagnostics.cards.icons-healthy', 'Custom icon storage looks healthy.')
                    : (card.status === 'error' ? translate('diagnostics.cards.icons-issues', 'Custom icon storage issues: $1', count)
                        : translate('diagnostics.cards.icons-unused', 'Unused custom icons: $1', count)),
                detail: card.status === 'error' ? review() : (card.status === 'warning'
                    ? translate('diagnostics.cards.icons-cleanup', 'Unused custom icons can be cleaned up later if needed.')
                    : translate('diagnostics.cards.icons-count', 'Icon files tracked: $1', diagnostics?.customIcons?.fileCount || 0))
            };
        } else if (card.key === 'update') {
            const update = diagnostics?.update || {};
            const available = update.updateAvailable === true;
            const unknown = translate('diagnostics.value.unknown', 'Unknown');
            localized = {
                label: translate('diagnostics.cards.update', 'Update check'),
                updateAvailable: available,
                headline: update.ok === false ? translate('diagnostics.cards.update-failed', 'Update check failed.')
                    : (available ? translate('diagnostics.cards.update-available', 'Update available: $1', update.remoteVersion || unknown)
                        : translate('diagnostics.cards.update-current', 'Plugin is up to date.')),
                detail: update.ok === false ? review() : (available
                    ? translate('diagnostics.cards.update-versions', 'Current version: $1. Available version: $2.', update.currentVersion || unknown, update.remoteVersion || unknown)
                    : translate('diagnostics.cards.update-version', 'Current version: $1.', update.currentVersion || diagnostics?.pluginVersion || unknown))
            };
        }
        // Keep source evidence in technical details; only display text is localized.
        const orphanCount = Number(typeData?.integrityChecks?.orphanedMembers?.count || 0);
        const retainEvidence = Object.keys(localized).length > 0 && card.status !== 'healthy' && card.detail
            && (card.key === 'storage' || (card.key === 'custom_icons' && card.status === 'error')
                || (card.key === 'update' && diagnostics?.update?.ok === false)
                || (typeData && count > orphanCount));
        return { ...card, ...localized, technicalDetails: [
            ...(retainEvidence ? [card.detail] : []),
            ...(Array.isArray(card.technicalDetails) ? card.technicalDetails : [])
        ] };
    };

    const decorateIntegrityCard = (card, diagnostics, translate) => {
        card = localizeSummaryCard(card, diagnostics, translate);
        const typeData = diagnostics?.types?.[card.key];
        const orphans = typeData?.integrityChecks?.orphanedMembers;
        const rows = Array.isArray(orphans?.folders) ? orphans.folders : [];
        const missingCount = Math.max(0, Number(orphans?.count || 0));
        const issueCount = Math.max(missingCount, Number(typeData?.integrityChecks?.issuesCount || 0));
        const orphanDetails = rows.map((row, index) => {
            const full = diagnostics.privacyMode === 'full';
            const folderName = full ? typeData?.stateSnapshot?.folders?.[row.folderId]?.folderName : '';
            const folderLabel = folderName || translate('diagnostics.orphans.folder', 'Folder $1', index + 1);
            const count = Math.max(0, Number(row.count || 0));
            const items = full && Array.isArray(row.items) ? row.items.map(String) : [];
            const detail = translate('diagnostics.orphans.folder-count', '$1: $2 missing references.', folderLabel, count);
            if (!full) return `${detail} ${translate('diagnostics.orphans.hidden', 'Names are hidden in this sanitized snapshot. Run a health check to view affected items on this page.')}`;
            const remaining = Math.max(0, count - items.length);
            return [
                detail,
                items.length ? translate('diagnostics.orphans.members', 'Missing items: $1', items.join(', ')) : '',
                remaining ? translate('diagnostics.orphans.more', '$1 more references are not listed.', remaining) : ''
            ].filter(Boolean).join(' ');
        });
        return {
            ...card,
            ...(card.key === 'docker' ? { label: translate('diagnostics.cards.docker', 'Docker configuration') } : {}),
            ...(card.key === 'vm' ? { label: translate('diagnostics.cards.vm', 'VM configuration') } : {}),
            ...(missingCount > 0 ? {
                orphanDetails: true,
                headline: translate('diagnostics.cards.issue-count', 'Issues requiring attention: $1', issueCount),
                detail: translate('diagnostics.orphans.count', 'Missing references: $1', missingCount)
                    + '. ' + translate('diagnostics.orphans.folders', 'Affected folders: $1. Review the saved references below.', rows.length)
            } : {}),
            technicalDetails: Array.from(new Set([
                ...orphanDetails,
                ...(Array.isArray(card.technicalDetails) ? card.technicalDetails : [])
            ]))
        };
    };

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

    const deriveUpdateLabel = (coreCards, translate) => {
        const update = coreCards.find((card) => card.key === 'update');
        if (!update) return translate('diagnostics.state.not-checked', 'Not checked');
        if (update.status === 'healthy') return translate('diagnostics.update.current', 'Up to date');
        if (update.updateAvailable === true || (typeof update.updateAvailable !== 'boolean' && /available/i.test(update.headline))) {
            return translate('diagnostics.update.available', 'Update available');
        }
        return translate('diagnostics.update.follow-up', 'Check needs follow-up');
    };

    const deriveOverall = (coreCards, advisoryCards, translate) => {
        if (countByStatus(coreCards, ['error']) > 0) {
            return Object.freeze({
                status: 'error',
                label: translate('diagnostics.cards.needs-attention', 'Needs attention'),
                headline: translate('diagnostics.overall.error', 'Core plugin health needs attention.'),
                detail: translate('diagnostics.overall.error-detail', 'Review the priority findings and affected system checks below.')
            });
        }
        if (countByStatus(coreCards, ['warning']) > 0) {
            return Object.freeze({
                status: 'warning',
                label: translate('diagnostics.status.follow-up', 'Follow up'),
                headline: translate('diagnostics.overall.warning', 'Core plugin health needs follow-up.'),
                detail: translate('diagnostics.overall.warning-detail', 'The plugin is running, but one or more core checks need review.')
            });
        }
        if (countByStatus(advisoryCards, ['error', 'warning']) > 0) {
            return Object.freeze({
                status: 'warning',
                label: translate('diagnostics.status.advisories', 'Healthy with advisories'),
                headline: translate('diagnostics.overall.advisories', 'Core plugin health is good.'),
                detail: translate('diagnostics.overall.advisories-detail', 'An advisory needs follow-up, but core operation is healthy.')
            });
        }
        return Object.freeze({
            status: 'healthy',
            label: translate('diagnostics.status.healthy', 'Healthy'),
            headline: translate('diagnostics.overall.healthy', 'All systems operational.'),
            detail: translate('diagnostics.overall.healthy-detail', 'No actionable configuration, storage, update, icon, or theme issue was detected.')
        });
    };

    const buildDiagnosticsViewModel = (input = {}) => {
        const translate = typeof input.t === 'function' ? input.t : fallbackTranslate;
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
                .map((card) => normalizeCard(card, checkedAtLabel, translate))
                .filter(Boolean)
        );
        const advisoryCards = Object.freeze(
            (Array.isArray(input.advisoryCards) ? input.advisoryCards : [])
                .map((card) => normalizeCard(card, checkedAtLabel, translate))
                .filter(Boolean)
        );
        const additionalCards = Object.freeze(
            (Array.isArray(input.additionalCards) ? input.additionalCards : [])
                .map((card) => normalizeCard(card, checkedAtLabel, translate))
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
                    label: errorMessage ? translate('diagnostics.status.failed', 'Check failed') : translate('diagnostics.state.not-checked', 'Not checked'),
                    headline: errorMessage ? translate('diagnostics.overall.failed', 'Health check could not finish.')
                        : translate('diagnostics.summary.empty-title', 'Run health check to inspect the plugin state.'),
                    detail: errorMessage || translate('diagnostics.summary.empty-description', 'Docker, VM, storage, custom icons, updates, and theme will be checked together.')
                }),
                metrics: Object.freeze({
                    coreHealthy: 0,
                    coreTotal: 0,
                    optionalCount: 0,
                    checkedAtLabel: translate('diagnostics.state.not-checked', 'Not checked'),
                    pluginVersion: String(input.pluginVersion || translate('diagnostics.value.unknown', 'Unknown')),
                    updateLabel: translate('diagnostics.state.not-checked', 'Not checked')
                }),
                findings: Object.freeze([]),
                coreCards,
                advisoryCards,
                additionalCards
            });
        }

        const overall = deriveOverall(coreCards, advisoryCards, translate);
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
                checkedAtLabel: checkedAtLabel || translate('diagnostics.value.unknown', 'Unknown'),
                pluginVersion: String(input.pluginVersion || translate('diagnostics.value.unknown', 'Unknown')),
                updateLabel: deriveUpdateLabel(coreCards, translate)
            }),
            findings: Object.freeze(derivePriorityFindings(coreCards, advisoryCards)),
            coreCards,
            advisoryCards,
            additionalCards
        });
    };

    const recoveryActionLabel = (action, translate = fallbackTranslate) => ({
        member_identity_reconcile: translate('diagnostics.history.members-reconciled', 'Member references synchronized'),
        backup_create: translate("legacy.surface.ebc91c7ac728323f", 'Backup created'),
        backup_restore: translate('diagnostics.history.backup-restored', 'Backup restored'),
        backup_delete: translate('diagnostics.history.backup-deleted', 'Backup deleted'),
        backup_download: translate('diagnostics.history.backup-download', 'Backup download requested'),
        support_bundle_export: translate('diagnostics.activity.exported', 'Support bundle exported'),
        environment_export: translate("legacy.surface.eae1fdd133376e8b", 'Environment exported'),
        environment_import: translate("legacy.surface.6f50d668c818bd67", 'Environment imported'),
        prefs_update: translate('diagnostics.history.preferences-saved', 'Preferences saved')
    }[String(action)] || translate("legacy.surface.033f7216c0f490c9", 'Recent change'));

    const recoveryStatusLabel = (status, translate = fallbackTranslate) => {
        const value = String(status || '').toLowerCase();
        const level = ['ok', 'success'].includes(value) ? 'success' : ['warn', 'warning'].includes(value) ? 'warning' : ['error', 'danger', 'failed'].includes(value) ? 'error' : 'info';
        if (level === 'success') return translate('common.state.ok', 'OK');
        if (level === 'warning') return translate('common.state.warning', 'Warning');
        if (level === 'error') return translate("legacy.surface.54a0e8c17ebb21a1", 'Error');
        return translate('common.state.info', 'Information');
    };

    return Object.freeze({
        recoveryActionLabel,
        recoveryStatusLabel,
        DEFAULT_STALE_AFTER_MS,
        normalizeStatus,
        normalizeCard,
        buildDiagnosticsViewModel,
        buildThemeCard,
        decorateIntegrityCard
    });
}));
