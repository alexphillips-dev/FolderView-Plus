(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    root.FolderViewPlusSupportBundleTelemetry = factory(root);
    root.FolderViewPlusSupportBundleTelemetryModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const SUPPORT_BUNDLE_UI_ID_KEYS = Object.freeze(new Set([
        'id',
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
        'bootstrapEffectiveId'
    ]));

    const SUPPORT_BUNDLE_UI_NAME_KEYS = Object.freeze(new Set([
        'folderName',
        'name'
    ]));

    const SUPPORT_BUNDLE_UI_URL_KEYS = Object.freeze(new Set([
        'currentPage',
        'currentUrl',
        'targetUrl',
        'pageUrl',
        'url',
        'href'
    ]));

    const normalizePrivacyMode = (value) => (
        String(value || '').trim().toLowerCase() === 'full' ? 'full' : 'sanitized'
    );

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

    const clientStorageIsAvailable = (kind) => {
        try {
            return typeof root?.[kind] !== 'undefined';
        } catch (_error) {
            return false;
        }
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
                    });
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
                if (SUPPORT_BUNDLE_UI_NAME_KEYS.has(key) || String(key || '').toLowerCase().endsWith('name')) {
                    return this.redactName(fieldPath, value);
                }
                if (key === 'debug') {
                    return this.redactDebugText(fieldPath, value);
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
        const collectFolderEditorDebugDiagnostics = typeof deps.collectFolderEditorDebugDiagnostics === 'function'
            ? deps.collectFolderEditorDebugDiagnostics
            : (() => null);
        const collectThemeTelemetrySnapshot = typeof deps.collectThemeTelemetrySnapshot === 'function'
            ? deps.collectThemeTelemetrySnapshot
            : (() => null);
        const readClientDiagnosticsStorageRecord = typeof deps.readClientDiagnosticsStorageRecord === 'function'
            ? deps.readClientDiagnosticsStorageRecord
            : (() => null);
        const storageKeys = deps.storageKeys && typeof deps.storageKeys === 'object' && !Array.isArray(deps.storageKeys)
            ? deps.storageKeys
            : {};

        const collectBrowserCapabilities = () => ({
            clipboardWrite: Boolean(root?.navigator?.clipboard && typeof root.navigator.clipboard.writeText === 'function'),
            cookieEnabled: root?.navigator?.cookieEnabled !== false,
            fetch: typeof root?.fetch === 'function',
            mutationObserver: typeof root?.MutationObserver === 'function',
            pointerEvent: typeof root?.PointerEvent === 'function',
            resizeObserver: typeof root?.ResizeObserver === 'function',
            touchPoints: Number.isFinite(Number(root?.navigator?.maxTouchPoints)) ? Number(root.navigator.maxTouchPoints) : 0,
            viewport: {
                width: Number.isFinite(Number(root?.innerWidth)) ? Number(root.innerWidth) : 0,
                height: Number.isFinite(Number(root?.innerHeight)) ? Number(root.innerHeight) : 0,
                devicePixelRatio: Number.isFinite(Number(root?.devicePixelRatio)) ? Number(root.devicePixelRatio) : 1
            }
        });

        const collectClientStorageDiagnostics = () => ({
            localStorageAvailable: clientStorageIsAvailable('localStorage'),
            sessionStorageAvailable: clientStorageIsAvailable('sessionStorage'),
            folderEditorDebug: {
                launchPresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.launch || '')),
                bootstrapPresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.bootstrap || '')),
                surfacePresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.surface || ''))
            }
        });

        const collectCurrentPageTelemetry = (uiRedactor) => {
            const pathname = String(root?.location?.pathname || '');
            const href = String(root?.location?.href || '');
            return {
                path: pathname,
                href: uiRedactor ? uiRedactor.redactUrl('uiTelemetry.currentPage.href', href) : href
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
            existingUiTelemetry.performance = collectClientPerformanceTelemetry();
            existingUiTelemetry.requestErrors = getRequestErrorDiagnosticsSnapshot();
            existingUiTelemetry.folderEditorDebug = uiRedactor.sanitizeValue(
                'uiTelemetry.folderEditorDebug',
                'folderEditorDebug',
                collectFolderEditorDebugDiagnostics()
            );
            existingUiTelemetry.theme = collectThemeTelemetrySnapshot();
            payload.uiTelemetry = existingUiTelemetry;
            return payload;
        };

        return Object.freeze({
            collectSupportBundleUiTelemetry,
            collectBrowserCapabilities,
            collectClientStorageDiagnostics,
            collectCurrentPageTelemetry,
            createUiTelemetryRedactor
        });
    };

    return Object.freeze({
        createApi,
        createUiTelemetryRedactor,
        normalizePrivacyMode,
        hashValue,
        SUPPORT_BUNDLE_UI_ID_KEYS,
        SUPPORT_BUNDLE_UI_NAME_KEYS,
        SUPPORT_BUNDLE_UI_URL_KEYS
    });
}));
