(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSupportBundlePreview = factory();
    root.FolderViewPlusSupportBundlePreviewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SUPPORT_BUNDLE_PREVIEW_SECTIONS = Object.freeze({
        bundleMeta: Object.freeze({
            label: 'Bundle metadata',
            detail: 'Schema, version, build channel, and privacy policy.',
            icon: 'document'
        }),
        system: Object.freeze({
            label: 'System snapshot',
            detail: 'Unraid, PHP, kernel, request, and path health details.',
            icon: 'monitor'
        }),
        pluginState: Object.freeze({
            label: 'Plugin state',
            detail: 'Preferences, folder counts, templates, and backups.',
            icon: 'puzzle'
        }),
        runtimeState: Object.freeze({
            label: 'Runtime state',
            detail: 'Docker and VM summaries, hierarchy, and conflicts.',
            icon: 'server'
        }),
        uiTelemetry: Object.freeze({
            label: 'Browser/UI telemetry',
            detail: 'Performance, request errors, and visual evidence.',
            icon: 'globe'
        }),
        healthAndHistory: Object.freeze({
            label: 'Health and history',
            detail: 'Health findings, timeline, and change history.',
            icon: 'heart'
        }),
        redactionManifest: Object.freeze({
            label: 'Redaction manifest',
            detail: 'The privacy operations applied to sensitive fields.',
            icon: 'shield'
        })
    });

    const SUPPORT_BUNDLE_REDACTION_LABELS = Object.freeze({
        hashedFields: 'Hashed',
        maskedFields: 'Masked',
        omittedFields: 'Omitted',
        truncatedFields: 'Truncated'
    });

    const createApi = (deps = {}) => {
        const $ = deps.$ || null;
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? ''));
        const formatCheckedAtLabel = typeof deps.formatCheckedAtLabel === 'function'
            ? deps.formatCheckedAtLabel
            : ((value) => String(value || 'unknown'));
        const normalizeSupportBundleV2Payload = typeof deps.normalizeSupportBundleV2Payload === 'function'
            ? deps.normalizeSupportBundleV2Payload
            : ((bundle) => (bundle && typeof bundle === 'object' ? { ...bundle } : {}));
        const getSupportBundlePreview = typeof deps.getSupportBundlePreview === 'function'
            ? deps.getSupportBundlePreview
            : (typeof deps.getSupportBundle === 'function' ? deps.getSupportBundle : async () => null);
        const enrichSupportBundlePreview = typeof deps.enrichSupportBundlePreview === 'function'
            ? deps.enrichSupportBundlePreview
            : ((bundle) => bundle);
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const translate = (key, fallback = '', ...params) => (
            typeof deps.t === 'function' ? deps.t(key, fallback, ...params) : (fallback || key)
        );
        const svgIcon = typeof deps.svgIcon === 'function'
            ? deps.svgIcon
            : ((name, { className = '' } = {}) => `<svg class="fv-ui-svg-icon${className ? ` ${escapeHtml(className)}` : ''}" viewBox="0 0 24 24" aria-hidden="true" data-fv-icon="${escapeHtml(name)}"><circle cx="12" cy="12" r="9"></circle></svg>`);

        let lastSupportBundlePreview = null;
        const formatAge = (ageMs) => {
            const numeric = Number(ageMs);
            if (!Number.isFinite(numeric) || numeric < 0) return translate('diagnostics.capture.age-unknown', 'age unknown');
            if (numeric < 60 * 1000) return translate('diagnostics.capture.age-under-minute', 'under 1 min old');
            const minutes = Math.round(numeric / (60 * 1000));
            if (minutes < 60) return translate('diagnostics.capture.age-minutes', '$1 min old', minutes);
            const hours = Math.round(minutes / 60);
            return translate('diagnostics.capture.age-hours', '$1 hr old', hours);
        };

        const buildDashboardCaptureStatusHtml = (bundle) => {
            const visual = bundle?.uiTelemetry?.dashboardVisual || {};
            const entries = ['docker', 'vm'].map((type) => ({
                type,
                value: visual?.[type] || {}
            }));
            const available = entries.filter((entry) => entry.value?.available === true);
            if (!available.length) {
                return `
                    <article class="fv-diagnostics-capture-card is-missing">
                        <div class="fv-diagnostics-support-card-head">
                            <div>${svgIcon('monitor')}<strong>${escapeHtml(translate('diagnostics.capture.guide-title', 'Capture Dashboard evidence in 3 easy steps'))}</strong></div>
                            <span class="fv-diagnostics-status-badge is-warning">${escapeHtml(translate('diagnostics.capture.missing', 'Missing'))}</span>
                        </div>
                        <ol class="fv-dashboard-capture-steps">
                            <li><span>1</span><div><strong>${escapeHtml(translate('diagnostics.capture.step-open', 'Open the Dashboard'))}</strong><small>${escapeHtml(translate('diagnostics.capture.step-open-detail', 'Go to the affected device and expand the problem folder.'))}</small></div></li>
                            <li><span>2</span><div><strong>${escapeHtml(translate('diagnostics.capture.step-reproduce', 'Capture the issue'))}</strong><small>${escapeHtml(translate('diagnostics.capture.step-reproduce-detail', 'Reproduce the problem and resize or rotate when relevant.'))}</small></div></li>
                            <li><span>3</span><div><strong>${escapeHtml(translate('diagnostics.capture.step-return', 'Return here'))}</strong><small>${escapeHtml(translate('diagnostics.capture.step-return-detail', 'Use View options → Capture layout diagnostics, then return.'))}</small></div></li>
                        </ol>
                        <a class="fv-ui-button fv-dashboard-capture-guide-action" href="/Dashboard"><i class="fa fa-dashboard" aria-hidden="true"></i>${escapeHtml(translate('diagnostics.capture.open-dashboard', 'Open Dashboard to capture'))}</a>
                    </article>
                `;
            }
            const rows = available.map(({ type, value }) => {
                const latest = value.latest || {};
                const verdict = String(latest.verdict?.status || 'unknown');
                const viewport = latest.environment?.viewport || {};
                const viewportLabel = viewport.width && viewport.height
                    ? `${viewport.width} x ${viewport.height}`
                    : translate('diagnostics.capture.viewport-unavailable', 'viewport unavailable');
                const touchLabel = value.capturedOnTouchCapableDevice
                    ? translate('diagnostics.capture.touch', 'touch-capable')
                    : translate('diagnostics.capture.non-touch', 'non-touch');
                const freshness = String(value.freshness || 'unknown');
                const statusClass = freshness === 'fresh' && verdict === 'healthy'
                    ? 'is-ready'
                    : (verdict === 'error' ? 'is-error' : 'is-attention');
                return `
                    <div class="fv-support-bundle-capture-row ${statusClass}">
                        <strong>${escapeHtml(type === 'vm'
                            ? translate('diagnostics.capture.vm', 'VM Dashboard')
                            : translate('diagnostics.capture.docker', 'Docker Dashboard'))}</strong>
                        <span>${escapeHtml(`${freshness}; ${formatAge(value.ageMs)}; ${viewportLabel}; ${touchLabel}; render ${verdict}.`)}</span>
                    </div>
                `;
            }).join('');
            const hasEnvironmentMismatch = available.some((entry) => entry.value?.environmentComparison?.differs === true);
            const needsCaptureReview = hasEnvironmentMismatch || available.some((entry) => (
                String(entry.value?.freshness || 'unknown') !== 'fresh'
                || String(entry.value?.latest?.verdict?.status || 'unknown') !== 'healthy'
            ));
            const mismatch = hasEnvironmentMismatch
                ? `<span class="fv-support-bundle-capture-warning">${escapeHtml(translate('diagnostics.capture.environment-warning', 'The export environment differs from at least one captured Dashboard environment.'))}</span>`
                : '';
            return `
                <article class="fv-diagnostics-capture-card">
                    <div class="fv-diagnostics-support-card-head">
                        <div>${svgIcon('monitor')}<strong>${escapeHtml(translate('diagnostics.capture.title', 'Dashboard visual evidence'))}</strong></div>
                        <span class="fv-diagnostics-status-badge ${needsCaptureReview ? 'is-warning' : 'is-healthy'}">${escapeHtml(needsCaptureReview ? translate('diagnostics.capture.review', 'Review') : translate('diagnostics.capture.ready', 'Ready'))}</span>
                    </div>
                    <p>${escapeHtml(translate('diagnostics.capture.help', 'These captures preserve the rendered Dashboard geometry after navigation to Settings.'))}</p>
                    <div class="fv-support-bundle-capture-rows">${rows}</div>
                    ${mismatch}
                    <a class="fv-ui-button fv-dashboard-capture-guide-action" href="/Dashboard"><i class="fa fa-refresh" aria-hidden="true"></i>${escapeHtml(translate('diagnostics.capture.capture-again', 'Capture again'))}</a>
                </article>
            `;
        };

        const buildSupportBundlePreviewSectionCards = (bundle) => {
            const normalized = normalizeSupportBundleV2Payload(
                bundle || {},
                bundle?.bundleMeta?.privacyMode || 'sanitized'
            );
            return Object.entries(SUPPORT_BUNDLE_PREVIEW_SECTIONS).map(([sectionKey, sectionConfig]) => {
                const sectionValue = normalized[sectionKey];
                const hasObjectPayload = Boolean(
                    sectionValue
                    && typeof sectionValue === 'object'
                    && !Array.isArray(sectionValue)
                );
                const statusLabel = hasObjectPayload ? 'Included' : 'Pending';
                const statusClass = hasObjectPayload ? 'is-ready' : 'is-pending';
                return `
                    <article class="fv-support-bundle-section-card ${statusClass}">
                        <div class="fv-support-bundle-section-icon" aria-hidden="true">${svgIcon(sectionConfig.icon)}</div>
                        <div class="fv-support-bundle-section-copy">
                            <strong>${escapeHtml(sectionConfig.label)}</strong>
                            <span>${escapeHtml(sectionConfig.detail)}</span>
                        </div>
                        <span class="fv-support-bundle-section-badge">${svgIcon(hasObjectPayload ? 'check-circle' : 'clock')}${escapeHtml(statusLabel)}</span>
                    </article>
                `;
            }).join('');
        };

        const buildSupportBundleRedactionPreviewHtml = (bundle) => {
            const normalized = normalizeSupportBundleV2Payload(
                bundle || {},
                bundle?.bundleMeta?.privacyMode || 'sanitized'
            );
            const manifest = (
                normalized.redactionManifest
                && typeof normalized.redactionManifest === 'object'
                && !Array.isArray(normalized.redactionManifest)
            ) ? normalized.redactionManifest : {};
            const mode = String(normalized.bundleMeta?.privacyMode || manifest.mode || 'sanitized').trim() === 'full'
                ? 'full'
                : 'sanitized';
            const saltScope = String(
                manifest.saltScope
                || normalized.bundleMeta?.bundleSaltScope
                || (mode === 'full' ? 'none' : 'per-bundle')
            ).trim() || 'per-bundle';
            const saltHash = String(
                manifest.saltHash
                || normalized.bundleMeta?.bundleSaltHash
                || ''
            ).trim();
            const previewOnly = manifest.previewOnly === true || normalized.bundleMeta?.previewOnly === true;
            const redactionItems = Object.entries(SUPPORT_BUNDLE_REDACTION_LABELS).map(([fieldKey, label]) => {
                const badgeTone = String(fieldKey).replace(/Fields$/, '').toLowerCase();
                const count = Array.isArray(manifest[fieldKey]) ? manifest[fieldKey].length : 0;
                const examples = Array.isArray(manifest[fieldKey]) ? manifest[fieldKey].slice(0, 3) : [];
                const stateCopy = previewOnly ? 'on export' : String(count);
                if (previewOnly) {
                    return `<span class="fv-support-bundle-privacy-item is-${escapeHtml(badgeTone)}" title="${escapeHtml(`${label} fields are calculated when the export is created.`)}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(stateCopy)}</small></span>`;
                }
                const title = examples.length
                    ? `${label}: ${examples.join(', ')}${count > examples.length ? ', ...' : ''}`
                    : `${label}: none reported`;
                return `<span class="fv-support-bundle-privacy-item is-${escapeHtml(badgeTone)}" title="${escapeHtml(title)}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(stateCopy)}</small></span>`;
            }).join('');
            const modeCopy = mode === 'full'
                ? 'Full export keeps raw fields and only records truncation metadata.'
                : 'Sanitized export replaces sensitive names/paths/request metadata with per-bundle hashes, masks, or omissions.';
            const saltCopy = mode === 'full'
                ? 'Salt scope: none for full exports.'
                : `Salt scope: ${saltScope}${saltHash ? ` - salt hash ${saltHash}` : ''}.`;
            return `
                <div class="fv-support-bundle-privacy-summary">
                    <div>${svgIcon('shield')}<strong>${escapeHtml(mode === 'full' ? 'Full export' : 'Privacy and sanitization')}</strong><span class="fv-diagnostics-status-badge ${mode === 'full' ? 'is-warning' : 'is-healthy'}">${escapeHtml(mode === 'full' ? 'Full mode' : 'Sanitized')}</span></div>
                    <div class="fv-support-bundle-privacy-items">${redactionItems}</div>
                </div>
                <details class="fv-support-bundle-privacy-details">
                    <summary>${escapeHtml(translate('diagnostics.support.data-handling', 'Learn more about data handling'))} <i class="fa fa-angle-right" aria-hidden="true"></i></summary>
                    <p>${escapeHtml(modeCopy)}</p>
                    <p>${escapeHtml(saltCopy)}</p>
                </details>
            `;
        };

        const renderSupportBundlePreview = (bundle = null) => {
            if (!$) {
                return;
            }
            const previewHost = $('#fv-support-bundle-preview');
            if (!previewHost.length) {
                return;
            }
            if (!bundle || typeof bundle !== 'object') {
                previewHost.html(`
                    <div class="fv-diagnostics-state-banner is-running" role="status">
                        <i class="fa fa-spinner fa-spin" aria-hidden="true"></i>
                        <span><strong>${escapeHtml(translate('diagnostics.support.preview-title', 'Preparing support bundle preview.'))}</strong>${escapeHtml(translate('diagnostics.support.preview-description', 'Included sections and privacy handling will appear here shortly.'))}</span>
                    </div>
                `);
                return;
            }
            const normalized = normalizeSupportBundleV2Payload(
                bundle,
                bundle?.bundleMeta?.privacyMode || 'sanitized'
            );
            const generatedAt = formatCheckedAtLabel(normalized.bundleMeta?.generatedAt || '');
            const bundleVersion = Number.isFinite(Number(normalized.bundleMeta?.bundleVersion))
                ? Number(normalized.bundleMeta.bundleVersion)
                : 2;
            const privacyMode = String(normalized.bundleMeta?.privacyMode || 'sanitized').trim() === 'full'
                ? 'full'
                : 'sanitized';
            const sectionCount = Object.keys(SUPPORT_BUNDLE_PREVIEW_SECTIONS).length;
            previewHost.html(`
                <div class="fv-diagnostics-support-grid">
                    ${buildDashboardCaptureStatusHtml(normalized)}
                    <article class="fv-support-bundle-overview">
                        <div class="fv-diagnostics-support-card-head">
                            <div>${svgIcon('support')}<strong>${escapeHtml(translate('diagnostics.support.overview-title', 'Support bundle overview'))}</strong></div>
                            <span class="fv-diagnostics-status-badge ${privacyMode === 'full' ? 'is-warning' : 'is-healthy'}">${escapeHtml(privacyMode === 'full' ? 'Full mode' : 'Sanitized')}</span>
                        </div>
                        <p>${escapeHtml(translate('diagnostics.support.overview-description', 'Your bundle is sanitized by default to protect sensitive data.'))}</p>
                        <div class="fv-support-bundle-preview-meta">
                            <span>${escapeHtml(`v${bundleVersion}`)}</span>
                            <span>${escapeHtml(`${sectionCount} sections`)}</span>
                            <span>${escapeHtml(`Previewed ${generatedAt}`)}</span>
                        </div>
                        <div class="fv-support-bundle-section-grid">
                            ${buildSupportBundlePreviewSectionCards(normalized)}
                        </div>
                    </article>
                </div>
                <div class="fv-support-bundle-redaction-card">
                    ${buildSupportBundleRedactionPreviewHtml(normalized)}
                </div>
            `);
        };

        const refreshSupportBundlePreview = async ({ privacy = 'sanitized', quiet = true } = {}) => {
            try {
                const bundle = await getSupportBundlePreview(privacy);
                lastSupportBundlePreview = await enrichSupportBundlePreview(bundle);
                renderSupportBundlePreview(lastSupportBundlePreview);
                return lastSupportBundlePreview;
            } catch (error) {
                if (!quiet) {
                    showError('Support bundle preview failed', error);
                }
                if (lastSupportBundlePreview) {
                    renderSupportBundlePreview(lastSupportBundlePreview);
                    return lastSupportBundlePreview;
                }
                renderSupportBundlePreview(null);
                return null;
            }
        };

        const getLastSupportBundlePreview = () => lastSupportBundlePreview;

        const setLastSupportBundlePreview = (bundle) => {
            lastSupportBundlePreview = (bundle && typeof bundle === 'object') ? bundle : null;
            return lastSupportBundlePreview;
        };

        return Object.freeze({
            buildSupportBundlePreviewSectionCards,
            buildSupportBundleRedactionPreviewHtml,
            buildDashboardCaptureStatusHtml,
            renderSupportBundlePreview,
            refreshSupportBundlePreview,
            getLastSupportBundlePreview,
            setLastSupportBundlePreview
        });
    };

    return Object.freeze({
        createApi,
        SUPPORT_BUNDLE_PREVIEW_SECTIONS,
        SUPPORT_BUNDLE_REDACTION_LABELS
    });
}));
