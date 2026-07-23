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
            detail: 'Schema, version, build channel, generated-at timestamp, privacy mode, and redaction policy.'
        }),
        system: Object.freeze({
            label: 'System snapshot',
            detail: 'Unraid/PHP/kernel details, request metadata, path health, and loaded PHP extension names.'
        }),
        pluginState: Object.freeze({
            label: 'Plugin state',
            detail: 'Docker/VM prefs, folder counts, template counts, backup metadata, and config file fingerprints.'
        }),
        runtimeState: Object.freeze({
            label: 'Runtime state',
            detail: 'Docker/VM entity summaries, folder hierarchy summaries, update counts, and runtime conflict status.'
        }),
        uiTelemetry: Object.freeze({
            label: 'Browser/UI telemetry',
            detail: 'Client performance, sanitized requests and errors, Dashboard visual evidence, folder editor bootstrap debug, and theme telemetry.'
        }),
        healthAndHistory: Object.freeze({
            label: 'Health and history',
            detail: 'Summary cards, integrity findings, recommended actions, recent timeline rows, and mutation history.'
        }),
        redactionManifest: Object.freeze({
            label: 'Redaction manifest',
            detail: 'Lists which field paths were hashed, masked, omitted, or truncated in this export.'
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
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const translate = (key, fallback = '', ...params) => (
            typeof deps.t === 'function' ? deps.t(key, fallback, ...params) : (fallback || key)
        );

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
                    <div class="fv-support-bundle-capture-status is-missing">
                        <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
                        <div>
                            <strong>${escapeHtml(translate('diagnostics.capture.none-title', 'No recent Dashboard visual capture is available.'))}</strong>
                            <span>${escapeHtml(translate('diagnostics.capture.none-help', 'Open Dashboard, expand the affected folder, reproduce the issue, and return here before exporting.'))}</span>
                        </div>
                    </div>
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
            const mismatch = hasEnvironmentMismatch
                ? `<span class="fv-support-bundle-capture-warning">${escapeHtml(translate('diagnostics.capture.environment-warning', 'The export environment differs from at least one captured Dashboard environment.'))}</span>`
                : '';
            return `
                <div class="fv-support-bundle-capture-status">
                    <i class="fa fa-desktop" aria-hidden="true"></i>
                    <div>
                        <strong>${escapeHtml(translate('diagnostics.capture.title', 'Dashboard visual evidence'))}</strong>
                        <span>${escapeHtml(translate('diagnostics.capture.help', 'These captures preserve the rendered Dashboard geometry after navigation to Settings.'))}</span>
                        <div class="fv-support-bundle-capture-rows">${rows}</div>
                        ${mismatch}
                    </div>
                </div>
            `;
        };

        const buildDiagnosticDomainsHtml = (bundle) => {
            const domains = bundle?.healthAndHistory?.diagnosticDomains?.domains || {};
            const labels = {
                layoutRendering: translate('diagnostics.domains.layout', 'Layout and rendering'),
                configurationIntegrity: translate('diagnostics.domains.configuration', 'Configuration integrity'),
                runtimeRequests: translate('diagnostics.domains.runtime', 'Runtime and requests'),
                storage: translate('diagnostics.domains.storage', 'Storage'),
                customIcons: translate('diagnostics.domains.icons', 'Custom icons'),
                theme: translate('diagnostics.domains.theme', 'Theme'),
                localization: translate('diagnostics.domains.localization', 'Localization'),
                update: translate('diagnostics.domains.update', 'Update')
            };
            const entries = Object.entries(labels).map(([key, label]) => {
                const domain = domains[key] || { status: 'unavailable', issueCount: 0 };
                const status = String(domain.status || 'unavailable');
                return `
                    <span class="fv-support-bundle-domain is-${escapeHtml(status)}">
                        <strong>${escapeHtml(label)}</strong>
                        <span>${escapeHtml(status)}${Number(domain.issueCount) > 0
                            ? escapeHtml(translate('diagnostics.domains.issue-count', ' - $1 issue(s)', Number(domain.issueCount)))
                            : ''}</span>
                    </span>
                `;
            }).join('');
            return `
                <div class="fv-support-bundle-domains">
                    <div>
                        <strong>${escapeHtml(translate('diagnostics.domains.title', 'Troubleshooting domains'))}</strong>
                        <span>${escapeHtml(translate('diagnostics.domains.help', 'Reported problems are separated so unrelated configuration findings do not obscure layout evidence.'))}</span>
                    </div>
                    <div class="fv-support-bundle-domain-grid">${entries}</div>
                </div>
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
                        <div class="fv-support-bundle-section-top">
                            <div class="fv-support-bundle-section-title">${escapeHtml(sectionConfig.label)}</div>
                            <span class="fv-support-bundle-section-badge">${escapeHtml(statusLabel)}</span>
                        </div>
                        <div class="fv-support-bundle-section-copy">${escapeHtml(sectionConfig.detail)}</div>
                        <div class="fv-support-bundle-section-key">${escapeHtml(sectionKey)}</div>
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
            const redactionPills = Object.entries(SUPPORT_BUNDLE_REDACTION_LABELS).map(([fieldKey, label]) => {
                const count = Array.isArray(manifest[fieldKey]) ? manifest[fieldKey].length : 0;
                const examples = Array.isArray(manifest[fieldKey]) ? manifest[fieldKey].slice(0, 3) : [];
                if (previewOnly) {
                    return `<span class="fv-support-bundle-redaction-pill" title="${escapeHtml(`${label} fields are calculated when the export is created.`)}">${escapeHtml(label)}: on export</span>`;
                }
                const title = examples.length
                    ? `${label}: ${examples.join(', ')}${count > examples.length ? ', ...' : ''}`
                    : `${label}: none reported`;
                return `<span class="fv-support-bundle-redaction-pill" title="${escapeHtml(title)}">${escapeHtml(label)}: ${count}</span>`;
            }).join('');
            const modeCopy = mode === 'full'
                ? 'Full export keeps raw fields and only records truncation metadata.'
                : 'Sanitized export replaces sensitive names/paths/request metadata with per-bundle hashes, masks, or omissions.';
            const saltCopy = mode === 'full'
                ? 'Salt scope: none for full exports.'
                : `Salt scope: ${saltScope}${saltHash ? ` - salt hash ${saltHash}` : ''}.`;
            return `
                <div class="fv-support-bundle-redaction-head">
                    <strong>${escapeHtml(mode === 'full' ? 'Full export privacy profile' : 'Sanitized export privacy profile')}</strong>
                    <span>${escapeHtml(modeCopy)}</span>
                </div>
                <div class="fv-support-bundle-redaction-meta">
                    <span class="fv-support-bundle-redaction-pill">${escapeHtml(saltCopy)}</span>
                    ${redactionPills}
                </div>
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
                    <div class="fv-diagnostics-empty-state is-compact">
                        <strong>Preparing support bundle preview.</strong>
                        <span>Included sections and redaction categories will appear here before you download the bundle.</span>
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
                <div class="fv-support-bundle-preview-head">
                    <div>
                        <div class="fv-support-bundle-preview-title">Support bundle preview</div>
                        <div class="fv-support-bundle-preview-copy">Review the v${bundleVersion} sections and privacy handling before download.</div>
                    </div>
                    <div class="fv-support-bundle-preview-meta">
                        <span class="fv-diagnostics-pill">${escapeHtml(privacyMode === 'full' ? 'Full mode' : 'Sanitized mode')}</span>
                        <span class="fv-diagnostics-pill">${sectionCount} sections</span>
                        <span class="fv-diagnostics-pill">Previewed ${escapeHtml(generatedAt)}</span>
                    </div>
                </div>
                ${buildDashboardCaptureStatusHtml(normalized)}
                ${buildDiagnosticDomainsHtml(normalized)}
                <div class="fv-support-bundle-section-grid">
                    ${buildSupportBundlePreviewSectionCards(normalized)}
                </div>
                <div class="fv-support-bundle-redaction-card">
                    ${buildSupportBundleRedactionPreviewHtml(normalized)}
                </div>
            `);
        };

        const refreshSupportBundlePreview = async ({ privacy = 'sanitized', quiet = true } = {}) => {
            try {
                lastSupportBundlePreview = await getSupportBundlePreview(privacy);
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
            buildDiagnosticDomainsHtml,
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
