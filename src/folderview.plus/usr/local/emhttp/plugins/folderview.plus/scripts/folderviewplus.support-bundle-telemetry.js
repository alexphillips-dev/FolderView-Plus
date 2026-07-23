(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    root.FolderViewPlusSupportBundleTelemetry = factory(root);
    root.FolderViewPlusSupportBundleTelemetryModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const browserModule = root?.FolderViewPlusSupportBundleBrowser || null;
    const SUPPORT_BUNDLE_UI_ID_KEYS = Object.freeze(new Set([
        'id',
        'uuid',
        'containerId',
        'folderId',
        'launchId',
        'launchFolderId',
        'routeFolderId',
        'resolvedRouteId',
        'pageRequestedId',
        'pageResolvedId',
        'requestedId',
        'resolvedId',
        'queryId',
        'hashId',
        'seedId',
        'requestedRef',
        'requestedRefs',
        'effectiveFolderId',
        'navigationPrefillId',
        'bootstrapRouteId',
        'bootstrapEffectiveId',
        'stateSignature'
    ]));

    const SUPPORT_BUNDLE_UI_NAME_KEYS = Object.freeze(new Set([
        'folderName',
        'containerName',
        'containerNames',
        'title',
        'name'
    ]));

    const SUPPORT_BUNDLE_UI_SAFE_HOOK_NOTES = Object.freeze(new Set([
        'captured',
        'wrapped',
        'invoked',
        'update_container invoked'
    ]));

    const SUPPORT_BUNDLE_UI_URL_KEYS = Object.freeze(new Set([
        'currentPage',
        'currentUrl',
        'targetUrl',
        'pageUrl',
        'sourceUrl',
        'url',
        'href'
    ]));

    const SUPPORT_BUNDLE_UI_DEBUG_TEXT_KEYS = Object.freeze(new Set([
        'debug',
        'message',
        'stack',
        'detail',
        'responseSnippet'
    ]));

    const normalizePrivacyMode = (value) => (String(value || '').trim().toLowerCase() === 'full' ? 'full' : 'sanitized');

    const hashValue = (value, saltSeed = '') => {
        const input = `${String(saltSeed || '')}|${String(value || '')}`;
        let hashA = 0x811c9dc5;
        let hashB = 0x9e3779b9;
        for (let index = 0; index < input.length; index++) {
            const code = input.charCodeAt(index);
            hashA ^= code;
            hashA = Math.imul(hashA, 0x01000193) >>> 0;
            hashB ^= (code + index + 1);
            hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
        }
        return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
    };

    const appendRedactionManifestField = (manifest, bucket, fieldPath) => {
        const safeBucket = String(bucket || '').trim();
        const safePath = String(fieldPath || '').trim();
        if (!manifest || typeof manifest !== 'object' || !safeBucket || !safePath) {
            return;
        }
        const list = Array.isArray(manifest[safeBucket]) ? manifest[safeBucket] : [];
        if (!list.includes(safePath)) {
            list.push(safePath);
        }
        manifest[safeBucket] = list;
    };

    const buildUiTelemetryPrivacySelfCheck = (uiTelemetry, privacy = 'sanitized') => {
        const mode = normalizePrivacyMode(privacy);
        if (mode === 'full') {
            return {
                status: 'not-applicable',
                scope: 'uiTelemetry',
                privacyMode: mode,
                checkedFieldCount: 0,
                violationCount: 0,
                rawIdentityViolations: 0,
                rawUrlViolations: 0,
                rawPrivateNetworkAddressViolations: 0,
                rawSensitivePathViolations: 0
            };
        }

        const counters = {
            checkedFieldCount: 0,
            rawIdentityViolations: 0,
            rawUrlViolations: 0,
            rawPrivateNetworkAddressViolations: 0,
            rawSensitivePathViolations: 0
        };
        const isRedactedIdentity = (value) => /^(?:ui|note)-[0-9a-f]{16}$/.test(String(value || ''));
        const isSafeHookNote = (value) => {
            const note = String(value || '').trim().toLowerCase();
            return SUPPORT_BUNDLE_UI_SAFE_HOOK_NOTES.has(note)
                || /^update_container(?: ui-[0-9a-f]{16}(?:\*ui-[0-9a-f]{16})*)?$/.test(note)
                || /^note-[0-9a-f]{16}$/.test(note);
        };
        const inspect = (value, key = '', path = []) => {
            if (Array.isArray(value)) {
                value.forEach((entry, index) => inspect(entry, key, [...path, index]));
                return;
            }
            if (value && typeof value === 'object') {
                Object.entries(value).forEach(([childKey, childValue]) => inspect(childValue, childKey, [...path, childKey]));
                return;
            }
            if (typeof value !== 'string' || value === '') {
                return;
            }
            counters.checkedFieldCount += 1;
            const isThemeMetadata = path[0] === 'theme';
            if (!isThemeMetadata && (
                SUPPORT_BUNDLE_UI_ID_KEYS.has(key)
                || SUPPORT_BUNDLE_UI_NAME_KEYS.has(key)
                || /(?:^|[A-Z])(?:Id|Ref)$/.test(key)
                || /(?:Fingerprint|Signature)$/.test(key)
                || String(key || '').toLowerCase().endsWith('name')
            )) {
                if (!isRedactedIdentity(value)) {
                    counters.rawIdentityViolations += 1;
                }
            }
            if (key === 'notes' && !isSafeHookNote(value)) {
                counters.rawIdentityViolations += 1;
            }
            if (SUPPORT_BUNDLE_UI_URL_KEYS.has(key) && /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value)) {
                counters.rawUrlViolations += 1;
            }
            if (/\b(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}\b/.test(value)) {
                counters.rawPrivateNetworkAddressViolations += 1;
            }
            if (/(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:boot|mnt|home|root|Users)\/)/.test(value)) {
                counters.rawSensitivePathViolations += 1;
            }
        };
        inspect(uiTelemetry);
        const violationCount = counters.rawIdentityViolations
            + counters.rawUrlViolations
            + counters.rawPrivateNetworkAddressViolations
            + counters.rawSensitivePathViolations;
        return {
            status: violationCount === 0 ? 'passed' : 'failed',
            scope: 'uiTelemetry',
            privacyMode: mode,
            ...counters,
            violationCount
        };
    };

    const createUiTelemetryRedactor = (bundle, privacy = 'sanitized') => {
        const mode = normalizePrivacyMode(privacy);
        const payload = bundle && typeof bundle === 'object' && !Array.isArray(bundle) ? bundle : {};
        const manifest = payload.redactionManifest && typeof payload.redactionManifest === 'object' && !Array.isArray(payload.redactionManifest)
            ? payload.redactionManifest
            : {};
        payload.redactionManifest = manifest;
        const saltSeed = String(payload.bundleMeta?.bundleSaltHash || manifest.saltHash || payload.bundleMeta?.generatedAt || Date.now()).trim();

        return {
            mode,
            redactId(fieldPath, value) {
                const raw = String(value || '').trim();
                if (mode === 'full' || !raw) {
                    return raw;
                }
                appendRedactionManifestField(manifest, 'hashedFields', fieldPath);
                return `ui-${hashValue(raw, saltSeed)}`;
            },
            redactName(fieldPath, value) {
                const raw = String(value || '').trim();
                if (mode === 'full') {
                    return raw;
                }
                if (!raw) {
                    return '';
                }
                appendRedactionManifestField(manifest, 'hashedFields', fieldPath);
                return `ui-${hashValue(raw, saltSeed)}`;
            },
            redactUrl(fieldPath, value) {
                const raw = String(value || '').trim();
                if (mode === 'full' || !raw) {
                    return raw;
                }
                appendRedactionManifestField(manifest, 'maskedFields', fieldPath);
                try {
                    const parsed = new URL(raw, root?.location?.origin || 'http://fvplus.local');
                    return parsed.pathname || '/';
                } catch (_error) {
                    return raw.replace(/^https?:\/\/[^/?#]+/i, '').replace(/[?#].*$/, '') || '/';
                }
            },
            redactDebugText(fieldPath, value) {
                const raw = String(value || '');
                if (mode === 'full' || !raw) {
                    return raw;
                }
                appendRedactionManifestField(manifest, 'maskedFields', fieldPath);
                return raw
                    .replace(/https?:\/\/[^\s"')]+/gi, (match) => {
                        try {
                            const parsed = new URL(match);
                            return parsed.pathname || '/';
                        } catch (_error) {
                            return match.replace(/^https?:\/\/[^/?#]+/i, '').replace(/[?#].*$/, '') || '/';
                        }
                    })
                    .replace(/((?:^|\n)[A-Za-z][A-Za-z0-9]*(?:Id|Ref|Requested|Resolved|Seed|Target)=)([^\n]+)/g, (_match, prefix, secret) => {
                        const safeSecret = String(secret || '').trim();
                        return safeSecret ? `${prefix}ui-${hashValue(safeSecret, saltSeed)}` : prefix;
                    })
                    .replace(/(?:[A-Za-z]:[\\/]|\/)[^\s"'<>)]*/g, (pathValue) => {
                        const basename = String(pathValue || '').split(/[\\/]/).filter(Boolean).pop() || '';
                        return basename ? `${basename}[path-hash:${hashValue(pathValue, saltSeed)}]` : '[path-redacted]';
                    })
                    .replace(/\b(?:10|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, (ipValue) => {
                        appendRedactionManifestField(manifest, 'maskedFields', `${fieldPath}.ip`);
                        return `${String(ipValue || '').split('.').slice(0, 2).join('.')}.x.x`;
                    });
            },
            redactHookNote(fieldPath, value) {
                const raw = String(value || '');
                if (mode === 'full' || !raw) {
                    return raw;
                }
                const updateMatch = raw.match(/^\s*(update_container)(?:\s+(.+))?\s*$/i);
                if (!updateMatch) {
                    const safeNote = raw.trim().toLowerCase();
                    if (SUPPORT_BUNDLE_UI_SAFE_HOOK_NOTES.has(safeNote)) {
                        return safeNote;
                    }
                    appendRedactionManifestField(manifest, 'hashedFields', fieldPath);
                    return `note-${hashValue(raw, saltSeed)}`;
                }
                const operation = String(updateMatch[1] || 'update_container').toLowerCase();
                const containerNames = String(updateMatch[2] || '')
                    .split('*')
                    .map((entry) => String(entry || '').trim())
                    .filter(Boolean);
                if (containerNames.length === 0) {
                    return operation;
                }
                appendRedactionManifestField(manifest, 'maskedFields', fieldPath);
                const redactedNames = containerNames.map((containerName, index) => (
                    this.redactName(`${fieldPath}.containerNames.${index}`, containerName)
                ));
                return `${operation} ${redactedNames.join('*')}`;
            },
            sanitizeValue(fieldPath, key, value) {
                if (Array.isArray(value)) {
                    return value.map((entry, index) => this.sanitizeValue(`${fieldPath}.${index}`, key, entry));
                }
                if (value && typeof value === 'object') {
                    const output = {};
                    for (const [childKey, childValue] of Object.entries(value)) {
                        output[childKey] = this.sanitizeValue(`${fieldPath}.${childKey}`, childKey, childValue);
                    }
                    return output;
                }
                if (typeof value !== 'string') {
                    return value;
                }
                if (SUPPORT_BUNDLE_UI_URL_KEYS.has(key)) {
                    return this.redactUrl(fieldPath, value);
                }
                if (SUPPORT_BUNDLE_UI_ID_KEYS.has(key) || /(?:^|[A-Z])(?:Id|Ref)$/.test(key)) {
                    return this.redactId(fieldPath, value);
                }
                if (/(?:Fingerprint|Signature)$/.test(String(key || ''))) {
                    return this.redactId(fieldPath, value);
                }
                if (SUPPORT_BUNDLE_UI_NAME_KEYS.has(key) || String(key || '').toLowerCase().endsWith('name')) {
                    return this.redactName(fieldPath, value);
                }
                if (SUPPORT_BUNDLE_UI_DEBUG_TEXT_KEYS.has(key)) {
                    return this.redactDebugText(fieldPath, value);
                }
                if (key === 'notes') {
                    return this.redactHookNote(fieldPath, value);
                }
                return value;
            }
        };
    };

    const createApi = (deps = {}) => {
        const normalizeSupportBundleV2Payload = typeof deps.normalizeSupportBundleV2Payload === 'function'
            ? deps.normalizeSupportBundleV2Payload
            : ((bundle) => (bundle && typeof bundle === 'object' ? { ...bundle } : {}));
        const collectClientPerformanceTelemetry = typeof deps.collectClientPerformanceTelemetry === 'function'
            ? deps.collectClientPerformanceTelemetry
            : (() => ({}));
        const getRequestErrorDiagnosticsSnapshot = typeof deps.getRequestErrorDiagnosticsSnapshot === 'function'
            ? deps.getRequestErrorDiagnosticsSnapshot
            : (() => ({ count: 0, last: null, samples: [] }));
        const getStandardRequestDiagnosticsSnapshot = typeof deps.getStandardRequestDiagnosticsSnapshot === 'function'
            ? deps.getStandardRequestDiagnosticsSnapshot
            : (() => ({ count: 0, failures: 0, retries: 0, entries: [] }));
        const collectFolderEditorDebugDiagnostics = typeof deps.collectFolderEditorDebugDiagnostics === 'function'
            ? deps.collectFolderEditorDebugDiagnostics
            : (() => null);
        const collectThemeTelemetrySnapshot = typeof deps.collectThemeTelemetrySnapshot === 'function'
            ? deps.collectThemeTelemetrySnapshot
            : (() => null);
        const getLocalizationDiagnosticsSnapshot = typeof deps.getLocalizationDiagnosticsSnapshot === 'function'
            ? deps.getLocalizationDiagnosticsSnapshot
            : (() => ({ requestedLocale: 'en', resolvedLocale: 'en', activeLocale: 'en', initialized: false }));
        const getDiagnosticsSummary = typeof deps.getDiagnosticsSummary === 'function'
            ? deps.getDiagnosticsSummary
            : (() => null);
        const readClientDiagnosticsStorageRecord = typeof deps.readClientDiagnosticsStorageRecord === 'function'
            ? deps.readClientDiagnosticsStorageRecord
            : (() => null);
        const storageKeys = deps.storageKeys && typeof deps.storageKeys === 'object' && !Array.isArray(deps.storageKeys)
            ? deps.storageKeys
            : {};

        const browserCollectors = (
            browserModule
            && typeof browserModule.createCollectors === 'function'
        ) ? browserModule.createCollectors({
            readClientDiagnosticsStorageRecord,
            storageKeys
        }) : null;
        const collectBrowserCapabilities = browserCollectors?.collectBrowserCapabilities || (() => ({}));
        const collectClientStorageDiagnostics = browserCollectors?.collectClientStorageDiagnostics || (() => ({
            localStorageAvailable: false,
            sessionStorageAvailable: false,
            dockerListViewModeCookie: null,
            nativeOrganizer: { available: false },
            folderEditorDebug: {
                launchPresent: false,
                bootstrapPresent: false,
                surfacePresent: false
            }
        }));
        const collectCurrentPageTelemetry = browserCollectors?.collectCurrentPageTelemetry || ((uiRedactor) => {
            const href = String(root?.location?.href || '');
            return {
                path: String(root?.location?.pathname || ''),
                href: uiRedactor ? uiRedactor.redactUrl('uiTelemetry.currentPage.href', href) : href
            };
        });
        const collectLoadedAssetTelemetry = browserCollectors?.collectLoadedAssetTelemetry || (() => ({ count: 0, entries: [] }));
        const collectBrowserConsoleErrors = browserCollectors?.collectBrowserConsoleErrors || (() => ({
            storageKey: 'fv.support.bundle.consoleErrors.v1',
            maxEntries: 30,
            count: 0,
            entries: []
        }));
        const collectDockerPageDiagnostics = browserCollectors?.collectDockerPageDiagnostics || (() => ({ available: false }));
        const collectDockerBulkUpdateTrace = browserCollectors?.collectDockerBulkUpdateTrace || (() => ({ available: false }));
        const collectDockerRequestBundleTrace = browserCollectors?.collectDockerRequestBundleTrace || (() => ({ available: false }));
        const collectDockerTraceHealth = browserCollectors?.collectDockerTraceHealth || (() => ({ available: false }));
        const collectDashboardLayoutDiagnostics = browserCollectors?.collectDashboardLayoutDiagnostics || (() => ({
            docker: { available: false },
            vm: { available: false }
        }));
        const collectDashboardVisualDiagnostics = browserCollectors?.collectDashboardVisualDiagnostics || (() => ({
            schemaVersion: 1,
            docker: { available: false, freshness: 'unavailable' },
            vm: { available: false, freshness: 'unavailable' }
        }));
        const collectDashboardLifecycleDiagnostics = browserCollectors?.collectDashboardLifecycleDiagnostics || (() => ({ available: false }));
        const collectVmLifecycleDiagnostics = browserCollectors?.collectVmLifecycleDiagnostics || (() => ({ available: false }));
        const collectRuntimePerformanceDiagnostics = (uiRedactor) => {
            const surfaces = Object.fromEntries(Object.entries(storageKeys.runtimePerformance || {}).map(([surface, key]) => {
                const record = readClientDiagnosticsStorageRecord(key);
                const available = Boolean(record && typeof record === 'object' && !Array.isArray(record));
                return [surface, available ? { available, ...record } : { available }];
            }));
            return uiRedactor.sanitizeValue('uiTelemetry.runtimePerformance', 'runtimePerformance', {
                schemaVersion: 1,
                available: Object.values(surfaces).some((surface) => surface.available),
                surfaces
            });
        };
        const buildDiagnosticDomains = (payload) => {
            const healthSummary = payload.healthAndHistory?.summary || {};
            const cards = Array.isArray(healthSummary.cards) ? healthSummary.cards : [];
            const cardByKey = Object.fromEntries(cards.map((card) => [String(card?.key || ''), card]));
            const visualTypes = ['docker', 'vm']
                .map((type) => payload.uiTelemetry?.dashboardVisual?.[type])
                .filter((entry) => entry?.available === true);
            const visualErrorCount = visualTypes.filter((entry) => entry.latest?.verdict?.status === 'error').length;
            const visualWarningCount = visualTypes.filter((entry) => (
                entry.latest?.verdict?.status === 'warning'
                || entry.captureQuality?.status === 'attention'
            )).length;
            const configurationCards = ['docker', 'vm'].map((key) => cardByKey[key]).filter(Boolean);
            const configurationIssueCount = configurationCards.reduce((total, card) => total + Math.max(0, Number(card?.count) || 0), 0);
            const configurationErrors = configurationCards.filter((card) => card?.status === 'error').length;
            const configurationWarnings = configurationCards.filter((card) => card?.status === 'warning').length;
            const requestFailures = Math.max(0, Number(payload.uiTelemetry?.requestActivity?.failures) || 0);
            const requestErrors = Math.max(0, Number(payload.uiTelemetry?.requestErrors?.count) || 0);
            const currentConsoleErrors = Math.max(0, Number(payload.uiTelemetry?.browserConsoleErrors?.currentSessionCount) || 0);
            const themeWarnings = Array.isArray(payload.uiTelemetry?.theme?.warnings)
                ? payload.uiTelemetry.theme.warnings.length
                : 0;
            const localizationLoadErrors = Array.isArray(payload.uiTelemetry?.localization?.loadErrors)
                ? payload.uiTelemetry.localization.loadErrors.length
                : 0;
            const localizationMissing = Math.max(0, Number(payload.uiTelemetry?.localization?.missingKeyCount) || 0);
            const statusForCount = (errorCount, warningCount = 0) => (
                errorCount > 0 ? 'error' : (warningCount > 0 ? 'warning' : 'healthy')
            );
            const storageCard = cardByKey.storage || null;
            const updateCard = cardByKey.update || null;
            const iconCard = cardByKey.custom_icons || null;
            return {
                schemaVersion: 1,
                domains: {
                    layoutRendering: {
                        status: visualTypes.length === 0
                            ? 'unavailable'
                            : statusForCount(visualErrorCount, visualWarningCount),
                        issueCount: visualErrorCount + visualWarningCount,
                        evidenceCount: visualTypes.length,
                        dockerFreshness: payload.uiTelemetry?.dashboardVisual?.docker?.freshness || 'unavailable',
                        vmFreshness: payload.uiTelemetry?.dashboardVisual?.vm?.freshness || 'unavailable'
                    },
                    configurationIntegrity: {
                        status: configurationCards.length === 0
                            ? 'unavailable'
                            : statusForCount(configurationErrors, configurationWarnings),
                        issueCount: configurationIssueCount
                    },
                    runtimeRequests: {
                        status: statusForCount(requestFailures + requestErrors + currentConsoleErrors),
                        issueCount: requestFailures + requestErrors + currentConsoleErrors,
                        requestFailures,
                        requestErrors,
                        currentConsoleErrors
                    },
                    storage: {
                        status: String(storageCard?.status || 'unavailable'),
                        issueCount: Math.max(0, Number(storageCard?.count) || 0)
                    },
                    customIcons: {
                        status: String(iconCard?.status || 'unavailable'),
                        issueCount: Math.max(0, Number(iconCard?.count) || 0)
                    },
                    theme: {
                        status: statusForCount(0, themeWarnings),
                        issueCount: themeWarnings
                    },
                    localization: {
                        status: statusForCount(localizationLoadErrors, localizationMissing),
                        issueCount: localizationLoadErrors + localizationMissing
                    },
                    update: {
                        status: String(updateCard?.status || 'unavailable'),
                        issueCount: Math.max(0, Number(updateCard?.count) || 0)
                    }
                }
            };
        };

        const collectSupportBundleUiTelemetry = (bundle) => {
            const payload = normalizeSupportBundleV2Payload(bundle, bundle?.bundleMeta?.privacyMode || 'sanitized');
            const privacyMode = normalizePrivacyMode(payload.bundleMeta?.privacyMode || 'sanitized');
            const uiRedactor = createUiTelemetryRedactor(payload, privacyMode);
            const existingUiTelemetry = (
                payload.uiTelemetry && typeof payload.uiTelemetry === 'object' && !Array.isArray(payload.uiTelemetry)
            ) ? { ...payload.uiTelemetry } : {};
            existingUiTelemetry.browserCapabilities = collectBrowserCapabilities();
            existingUiTelemetry.clientStorage = collectClientStorageDiagnostics();
            existingUiTelemetry.currentPage = collectCurrentPageTelemetry(uiRedactor);
            existingUiTelemetry.loadedAssets = collectLoadedAssetTelemetry(uiRedactor, {
                pluginVersion: payload.bundleMeta?.pluginVersion || ''
            });
            existingUiTelemetry.performance = uiRedactor.sanitizeValue(
                'uiTelemetry.performance',
                'performance',
                collectClientPerformanceTelemetry()
            );
            existingUiTelemetry.requestErrors = uiRedactor.sanitizeValue(
                'uiTelemetry.requestErrors',
                'requestErrors',
                getRequestErrorDiagnosticsSnapshot()
            );
            existingUiTelemetry.requestActivity = uiRedactor.sanitizeValue(
                'uiTelemetry.requestActivity',
                'requestActivity',
                getStandardRequestDiagnosticsSnapshot()
            );
            existingUiTelemetry.browserConsoleErrors = uiRedactor.sanitizeValue(
                'uiTelemetry.browserConsoleErrors',
                'browserConsoleErrors',
                collectBrowserConsoleErrors({
                    pluginVersion: payload.bundleMeta?.pluginVersion || ''
                })
            );
            existingUiTelemetry.dockerDiagnostics = {
                pageSnapshot: collectDockerPageDiagnostics(uiRedactor),
                bulkUpdateTrace: collectDockerBulkUpdateTrace(uiRedactor),
                requestBundleTrace: collectDockerRequestBundleTrace(uiRedactor),
                traceHealth: collectDockerTraceHealth(uiRedactor)
            };
            existingUiTelemetry.dashboardLayout = collectDashboardLayoutDiagnostics(uiRedactor);
            existingUiTelemetry.dashboardVisual = collectDashboardVisualDiagnostics(uiRedactor, {
                pluginVersion: payload.bundleMeta?.pluginVersion || ''
            });
            existingUiTelemetry.dashboardLifecycle = collectDashboardLifecycleDiagnostics(uiRedactor);
            existingUiTelemetry.vmLifecycle = collectVmLifecycleDiagnostics(uiRedactor);
            existingUiTelemetry.runtimePerformance = collectRuntimePerformanceDiagnostics(uiRedactor);
            existingUiTelemetry.folderEditorDebug = uiRedactor.sanitizeValue(
                'uiTelemetry.folderEditorDebug',
                'folderEditorDebug',
                collectFolderEditorDebugDiagnostics()
            );
            existingUiTelemetry.theme = collectThemeTelemetrySnapshot();
            existingUiTelemetry.localization = uiRedactor.sanitizeValue(
                'uiTelemetry.localization',
                'localization',
                getLocalizationDiagnosticsSnapshot()
            );
            payload.uiTelemetry = existingUiTelemetry;
            payload.healthAndHistory = (
                payload.healthAndHistory && typeof payload.healthAndHistory === 'object' && !Array.isArray(payload.healthAndHistory)
            ) ? payload.healthAndHistory : {};
            const diagnosticsSummary = getDiagnosticsSummary();
            if (
                payload.bundleMeta?.previewOnly === true
                && diagnosticsSummary
                && typeof diagnosticsSummary === 'object'
                && !Array.isArray(diagnosticsSummary)
            ) {
                payload.healthAndHistory.summary = { ...diagnosticsSummary };
            }
            payload.healthAndHistory.diagnosticDomains = buildDiagnosticDomains(payload);
            payload.redactionManifest.privacySelfCheck = buildUiTelemetryPrivacySelfCheck(
                existingUiTelemetry,
                privacyMode
            );
            return payload;
        };

        return Object.freeze({
            collectSupportBundleUiTelemetry,
            collectBrowserCapabilities,
            collectClientStorageDiagnostics,
            collectCurrentPageTelemetry,
            collectLoadedAssetTelemetry,
            collectBrowserConsoleErrors,
            createUiTelemetryRedactor
        });
    };

    return Object.freeze({
        createApi,
        createUiTelemetryRedactor,
        buildUiTelemetryPrivacySelfCheck,
        normalizePrivacyMode,
        hashValue,
        SUPPORT_BUNDLE_UI_ID_KEYS,
        SUPPORT_BUNDLE_UI_NAME_KEYS,
        SUPPORT_BUNDLE_UI_URL_KEYS
    });
}));
