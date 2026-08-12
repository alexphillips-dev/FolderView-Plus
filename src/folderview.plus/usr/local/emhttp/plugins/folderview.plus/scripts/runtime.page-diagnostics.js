// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimePageDiagnostics = factory(root);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(defaultWindow) {
    'use strict';

    const SCHEMA_VERSION = 1;
    const STORAGE_KEY = 'fv.support.bundle.runtime.pages.v1';
    const MAX_CAPTURES_PER_SURFACE = 3;
    const TTL_MS = 30 * 60 * 1000;
    const SURFACES = Object.freeze(['docker', 'vm', 'dashboard']);
    const TRIGGERS = Object.freeze(['manual', 'visual-capture', 'runtime-error', 'support-request']);
    const VARIANTS = Object.freeze(['default', 'docker', 'vm', 'folderview', 'host', 'command']);

    const normalizeEnum = (value, allowed, fallback) => {
        const normalized = String(value || '').trim().toLowerCase();
        return allowed.includes(normalized) ? normalized : fallback;
    };
    const boundedCount = (value) => Math.min(10000, Math.max(0, Math.floor(Number(value) || 0)));
    const viewportClass = (width) => width <= 600 ? 'phone' : (width <= 1024 ? 'tablet' : 'desktop');
    const sizeBucket = (value) => {
        const size = Math.max(0, Number(value) || 0);
        if (size <= 600) return '0-600';
        if (size <= 1024) return '601-1024';
        if (size <= 1440) return '1025-1440';
        if (size <= 1920) return '1441-1920';
        return '1921+';
    };
    const matchesMedia = (win, query) => {
        try {
            return win?.matchMedia?.(query)?.matches === true;
        } catch (_error) {
            return false;
        }
    };
    const safeStorage = (win) => {
        try {
            return win?.localStorage || null;
        } catch (_error) {
            return null;
        }
    };
    const emptyRecord = () => ({
        schemaVersion: SCHEMA_VERSION,
        expiresAfterMs: TTL_MS,
        maxCapturesPerSurface: MAX_CAPTURES_PER_SURFACE,
        surfaces: { docker: [], vm: [], dashboard: [] }
    });
    const validTimestamp = (value) => {
        const timestamp = Date.parse(String(value || ''));
        return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const normalizeSnapshot = (snapshot) => {
        const surface = normalizeEnum(snapshot?.surface, SURFACES, 'docker');
        const capturedAtMs = validTimestamp(snapshot?.capturedAt);
        if (!capturedAtMs) return null;
        return {
            schemaVersion: SCHEMA_VERSION,
            surface,
            variant: normalizeEnum(snapshot?.variant, VARIANTS, 'default'),
            trigger: normalizeEnum(snapshot?.trigger, TRIGGERS, 'manual'),
            capturedAt: new Date(capturedAtMs).toISOString(),
            viewport: {
                class: normalizeEnum(snapshot?.viewport?.class, ['phone', 'tablet', 'desktop'], 'desktop'),
                widthBucket: normalizeEnum(snapshot?.viewport?.widthBucket, ['0-600', '601-1024', '1025-1440', '1441-1920', '1921+'], '0-600'),
                heightBucket: normalizeEnum(snapshot?.viewport?.heightBucket, ['0-600', '601-1024', '1025-1440', '1441-1920', '1921+'], '0-600'),
                touchCapable: snapshot?.viewport?.touchCapable === true,
                reducedMotion: snapshot?.viewport?.reducedMotion === true
            },
            appearance: {
                darkScheme: snapshot?.appearance?.darkScheme === true,
                highContrast: snapshot?.appearance?.highContrast === true
            },
            state: {
                visibleRows: boundedCount(snapshot?.state?.visibleRows),
                folderRows: boundedCount(snapshot?.state?.folderRows),
                expandedFolders: boundedCount(snapshot?.state?.expandedFolders),
                visibleMembers: boundedCount(snapshot?.state?.visibleMembers),
                loadingIndicators: boundedCount(snapshot?.state?.loadingIndicators),
                spinningControls: boundedCount(snapshot?.state?.spinningControls),
                errorIndicators: boundedCount(snapshot?.state?.errorIndicators),
                horizontalOverflow: snapshot?.state?.horizontalOverflow === true
            }
        };
    };

    const normalizeRecord = (source, now = Date.now()) => {
        const next = emptyRecord();
        const cutoff = Number(now) - TTL_MS;
        SURFACES.forEach((surface) => {
            const candidates = Array.isArray(source?.surfaces?.[surface]) ? source.surfaces[surface] : [];
            next.surfaces[surface] = candidates
                .map(normalizeSnapshot)
                .filter((snapshot) => snapshot && validTimestamp(snapshot.capturedAt) >= cutoff)
                .slice(-MAX_CAPTURES_PER_SURFACE);
        });
        return next;
    };
    const readRecord = ({ window: win = defaultWindow, now = Date.now } = {}) => {
        let source = null;
        try { source = JSON.parse(String(safeStorage(win)?.getItem?.(STORAGE_KEY) || 'null')); } catch (_error) { source = null; }
        return normalizeRecord(source, Number(now()));
    };

    const writeRecord = (record, win = defaultWindow) => {
        const storage = safeStorage(win);
        if (!storage?.setItem) return false;
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(record));
            if (typeof win?.CustomEvent === 'function' && typeof win?.dispatchEvent === 'function') {
                win.dispatchEvent(new win.CustomEvent('fvplus:runtime-page-diagnostics', { detail: { storageKey: STORAGE_KEY } }));
            }
            return true;
        } catch (_error) {
            return false;
        }
    };

    const countVisible = (root, selector, win) => Array.from(root?.querySelectorAll?.(selector) || []).filter((node) => {
        if (node?.hidden === true) return false;
        const style = win?.getComputedStyle?.(node);
        return !style || (style.display !== 'none' && style.visibility !== 'hidden');
    }).length;

    const buildSnapshot = ({ surface, variant = 'default', trigger = 'manual', window: win = defaultWindow, document: doc = win?.document, root = null, now = Date.now } = {}) => {
        const resolvedSurface = normalizeEnum(surface, SURFACES, 'docker');
        const host = root || doc?.querySelector?.(resolvedSurface === 'dashboard' ? '#dashboard, .dashboard' : (resolvedSurface === 'vm' ? '#kvm_list, #vm_view' : '#docker_list, #docker_view')) || doc?.body;
        const width = Math.max(0, Number(win?.innerWidth) || Number(doc?.documentElement?.clientWidth) || 0);
        const height = Math.max(0, Number(win?.innerHeight) || Number(doc?.documentElement?.clientHeight) || 0);
        const bodyOverflow = Math.max(0, Number(doc?.documentElement?.scrollWidth) || 0) > Math.max(0, Number(doc?.documentElement?.clientWidth) || 0) + 1;
        return normalizeSnapshot({
            schemaVersion: SCHEMA_VERSION,
            surface: resolvedSurface,
            variant,
            trigger,
            capturedAt: new Date(Number(now())).toISOString(),
            viewport: {
                class: viewportClass(width),
                widthBucket: sizeBucket(width),
                heightBucket: sizeBucket(height),
                touchCapable: Number(win?.navigator?.maxTouchPoints || 0) > 0 || matchesMedia(win, '(pointer: coarse)'),
                reducedMotion: matchesMedia(win, '(prefers-reduced-motion: reduce)')
            },
            appearance: {
                darkScheme: matchesMedia(win, '(prefers-color-scheme: dark)'),
                highContrast: matchesMedia(win, '(prefers-contrast: more)')
            },
            state: {
                visibleRows: countVisible(host, 'tr', win),
                folderRows: countVisible(host, '.folder, .folder-showcase-outer', win),
                expandedFolders: countVisible(host, '.folder[expanded="true"], .folder-showcase-outer[expanded="true"]', win),
                visibleMembers: countVisible(host, '.folder-preview-wrapper, .folder-element-docker, .folder-element-vm', win),
                loadingIndicators: countVisible(host, '.spinner, .fv-runtime-loading-row, [aria-busy="true"]', win),
                spinningControls: countVisible(host, '.fa-spin, .fa-spinner, .fa-circle-o-notch', win),
                errorIndicators: countVisible(host, '.error, .invalid, [aria-invalid="true"]', win),
                horizontalOverflow: bodyOverflow || (Number(host?.scrollWidth) || 0) > (Number(host?.clientWidth) || 0) + 1
            }
        });
    };

    const capture = (options = {}) => {
        const win = options.window || defaultWindow;
        const snapshot = buildSnapshot({ ...options, window: win });
        if (!snapshot) return null;
        const record = readRecord({ window: win, now: options.now || Date.now });
        record.surfaces[snapshot.surface] = [...record.surfaces[snapshot.surface], snapshot].slice(-MAX_CAPTURES_PER_SURFACE);
        writeRecord(record, win);
        return snapshot;
    };

    const captureAndAnnounce = (options = {}) => {
        const snapshot = capture(options);
        const surface = normalizeEnum(options.surface, SURFACES, 'docker');
        const label = surface === 'vm' ? 'VM' : (surface === 'dashboard' ? 'Dashboard' : 'Docker');
        const win = options.window || defaultWindow;
        win?.FolderViewPlusUI?.announce?.({
            title: snapshot ? `${label} diagnostics captured` : `${label} diagnostics unavailable`,
            message: snapshot ? 'The sanitized snapshot is ready for the next support bundle.' : `The ${label} page was not ready to capture.`
        });
        return snapshot;
    };

    const createController = (options = {}) => Object.freeze({
        capture: (captureOptions = {}) => capture({ ...options, ...captureOptions }),
        read: () => readRecord(options)
    });

    return Object.freeze({
        SCHEMA_VERSION,
        STORAGE_KEY,
        MAX_CAPTURES_PER_SURFACE,
        TTL_MS,
        SURFACES,
        normalizeSnapshot,
        normalizeRecord,
        readRecord,
        buildSnapshot,
        capture,
        captureAndAnnounce,
        createController
    });
}));
