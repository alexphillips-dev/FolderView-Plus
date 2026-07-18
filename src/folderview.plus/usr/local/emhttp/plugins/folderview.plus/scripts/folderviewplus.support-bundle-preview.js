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
            detail: 'Client perf samples, sanitized request activity and errors, folder editor bootstrap debug, and theme telemetry.'
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
        const getSupportBundle = typeof deps.getSupportBundle === 'function'
            ? deps.getSupportBundle
            : async () => null;
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});

        let lastSupportBundlePreview = null;

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
            const redactionPills = Object.entries(SUPPORT_BUNDLE_REDACTION_LABELS).map(([fieldKey, label]) => {
                const count = Array.isArray(manifest[fieldKey]) ? manifest[fieldKey].length : 0;
                const examples = Array.isArray(manifest[fieldKey]) ? manifest[fieldKey].slice(0, 3) : [];
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
                lastSupportBundlePreview = await getSupportBundle(privacy);
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
