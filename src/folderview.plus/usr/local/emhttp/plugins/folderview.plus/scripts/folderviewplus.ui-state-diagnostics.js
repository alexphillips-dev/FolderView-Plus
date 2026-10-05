// @ts-check
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FolderViewPlusUiStateDiagnostics = api.createApi({ window: root });
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const STORAGE_KEY = 'fv.support.bundle.uiState.v1';
    const HISTORY_LIMIT = 3;
    const STALE_AFTER_MS = 30 * 60 * 1000;
    const KINDS = ['settings', 'bulk', 'compare'];
    const TYPES = ['docker', 'vm'];
    const WORKSPACES = ['automation', 'rules', 'recovery', 'operations', 'startup', 'appearance', 'diagnostics', 'logs', 'basic'];
    const FIELDS = {
        settings: {
            counts: ['totalFolders', 'displayedFolders', 'hiddenSearch', 'hiddenCollapsed', 'hiddenEmpty', 'hiddenQuick', 'hiddenStatus', 'hiddenUpdates', 'hiddenHealth', 'parentsKeptByDescendants'],
            flags: ['hideEmpty', 'searchActive', 'runtimeReady'], phases: ['ready', 'pending', 'unavailable']
        },
        bulk: {
            counts: ['available', 'displayed', 'selected', 'visibleSelected', 'hiddenSelected', 'plannedChanges', 'alreadyInTarget', 'invalid', 'failed', 'succeeded', 'skipped'],
            flags: ['hasTarget', 'confirming', 'applying', 'filtersActive'], phases: ['idle', 'confirming', 'applying', 'success', 'warning', 'error', 'cancelled']
        },
        compare: {
            counts: ['fromFolders', 'toFolders', 'added', 'changed', 'removed', 'unchanged', 'prefsChanged', 'prefsCompared', 'discardedResponses'],
            flags: ['includePrefs', 'prefsAvailable'], phases: ['chooser', 'loading', 'complete', 'cancelled', 'error']
        }
    };
    const count = value => Number.isFinite(value) ? Math.min(1000000, Math.max(0, Math.round(value))) : 0;
    const dimension = value => Number.isFinite(value) ? Math.min(100000, Math.max(0, Math.round(value * 10) / 10)) : 0;
    const version = value => typeof value === 'string' && /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/.test(value) ? value : null;
    const normalizeMeasurement = value => {
        if (!value || typeof value !== 'object') return { available: false };
        const result = { available: value.available === true, visible: value.visible === true, outsideViewport: value.outsideViewport === true };
        for (const key of ['widthPx', 'heightPx', 'fontSizePx', 'horizontalOverflowPx', 'clippedByAncestors']) result[key] = dimension(value[key]);
        return result;
    };
    const normalize = (kind, value) => {
        if (!FIELDS[kind] || !value || typeof value !== 'object' || Array.isArray(value)) return null;
        const schema = FIELDS[kind];
        const result = { phase: schema.phases.includes(value.phase) ? value.phase : schema.phases[0] };
        for (const key of schema.counts) result[key] = count(value[key]);
        for (const key of schema.flags) result[key] = value[key] === true;
        if (kind === 'settings' && value.surface) result.surface = { mode: ['advanced', 'basic'].includes(value.surface.mode) ? value.surface.mode : 'unavailable', workspace: WORKSPACES.includes(value.surface.workspace) ? value.surface.workspace : 'none', geometry: normalizeMeasurement(value.surface.geometry) };
        if (kind === 'compare') {
            for (const key of ['fromKind', 'toKind']) result[key] = ['snapshot', 'current'].includes(value[key]) ? value[key] : 'none';
            result.durationMs = Math.min(3600000, count(value.durationMs));
            if (value.dialog) result.dialog = { geometry: normalizeMeasurement(value.dialog.geometry), buttons: Array.isArray(value.dialog.buttons) ? value.dialog.buttons.slice(0, 6).map(normalizeMeasurement) : [] };
        }
        return result;
    };
    const browserInfo = navigator => {
        const ua = String(navigator?.userAgent || '').slice(0, 2048);
        const patterns = [['edge', /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/], ['firefox', /(?:Firefox|FxiOS)\/([\d.]+)/], ['chromium', /Chromium\/([\d.]+)/], ['chrome', /(?:Chrome|CriOS)\/([\d.]+)/], ['safari', /Version\/([\d.]+).*Safari\//]];
        for (const [family, pattern] of patterns) {
            const match = ua.match(pattern);
            if (match && /^\d{1,4}(?:\.\d{1,4}){0,3}$/.test(match[1])) return { family, reportedVersion: match[1] };
        }
        return { family: 'unknown', reportedVersion: null };
    };
    const measure = (node, win) => {
        if (!node?.getBoundingClientRect) return { available: false };
        const rect = node.getBoundingClientRect();
        let visible = rect.width > 0 && rect.height > 0, clippedByAncestors = 0;
        for (let parent = node; parent; parent = parent.parentElement) {
            const style = win?.getComputedStyle?.(parent);
            if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse' || (style?.opacity !== undefined && style.opacity !== '' && Number(style.opacity) === 0)) visible = false;
            if (parent === node || !style) continue;
            const bounds = parent.getBoundingClientRect();
            const clipX = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
            const clipY = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
            if ((clipX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) || (clipY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1))) clippedByAncestors += 1;
        }
        const style = win?.getComputedStyle?.(node);
        return {
            available: true, visible, clippedByAncestors: count(clippedByAncestors),
            widthPx: dimension(rect.width), heightPx: dimension(rect.height), fontSizePx: dimension(Number.parseFloat(style?.fontSize)),
            horizontalOverflowPx: dimension(Math.max(0, node.scrollWidth - node.clientWidth)),
            outsideViewport: rect.left < -1 || rect.top < -1 || rect.right > (win?.innerWidth || 0) + 1 || rect.bottom > (win?.innerHeight || 0) + 1
        };
    };
    const createApi = (deps = {}) => {
        const win = deps.window || {}, doc = deps.document || win.document, now = deps.now || Date.now;
        const operations = new Map();
        let serial = 0, memory = {}, storageWriteFailed = false;
        const pluginVersion = () => version(win.FolderViewPlusFatalRuntimeContext?.pluginVersion);
        const keyFor = (kind, type) => KINDS.includes(kind) && TYPES.includes(type) ? `${kind}.${type}` : null;
        const read = () => {
            let raw = memory;
            try {
                const text = storageWriteFailed ? null : win.localStorage?.getItem(STORAGE_KEY);
                if (text && text.length <= 50000) raw = JSON.parse(text);
            } catch (_error) { /* Diagnostics must not interrupt a user operation. */ }
            const result = {};
            for (const kind of KINDS) for (const type of TYPES) {
                const key = keyFor(kind, type), rows = Array.isArray(raw?.[key]) ? raw[key].slice(-HISTORY_LIMIT) : [];
                result[key] = rows.flatMap(row => {
                    const capturedAt = typeof row?.capturedAt === 'string' ? Date.parse(row.capturedAt) : NaN;
                    const data = normalize(kind, row?.data);
                    if (!data || !Number.isFinite(capturedAt) || now() - capturedAt > STALE_AFTER_MS || capturedAt > now() + 1000) return [];
                    return [{ capturedAt: new Date(capturedAt).toISOString(), pluginVersion: version(row.pluginVersion), data }];
                });
            }
            return result;
        };
        const record = (kind, type, data = {}) => {
            const key = keyFor(kind, type);
            if (!key) return;
            const records = read(), rows = records[key];
            const next = normalize(kind, { ...rows.at(-1)?.data, ...data });
            const row = { capturedAt: new Date(now()).toISOString(), pluginVersion: pluginVersion(), data: next };
            if (rows.length && JSON.stringify(rows.at(-1).data) === JSON.stringify(next)) rows[rows.length - 1] = row;
            else rows.push(row);
            records[key] = rows.slice(-HISTORY_LIMIT);
            memory = records;
            try { win.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records)); storageWriteFailed = false; } catch (_error) { storageWriteFailed = true; } // Keep fresh memory captures if persisted history remains readable.
        };
        const begin = (kind, type, data) => {
            const key = keyFor(kind, type);
            if (!key) return null;
            const token = ++serial;
            operations.set(key, { token, startedAt: now() });
            record(kind, type, { ...normalize(kind, {}), ...data });
            return token;
        };
        const finish = (kind, type, token, data) => {
            const operation = operations.get(keyFor(kind, type));
            if (kind === 'compare' && operation?.token === token && data.discarded === true) cancel(kind, type);
            if (!operation || operation.token !== token || data.discarded === true) {
                if (kind === 'compare') {
                    const latest = read()[keyFor(kind, type)]?.at(-1)?.data;
                    record(kind, type, { discardedResponses: count(latest?.discardedResponses) + 1 });
                }
                return false;
            }
            record(kind, type, { ...data, durationMs: now() - operation.startedAt });
            return true;
        };
        const cancel = (kind, type) => {
            const key = keyFor(kind, type), latest = read()[key]?.at(-1)?.data;
            if (!latest || !['chooser', 'loading', 'confirming'].includes(latest.phase)) return;
            const operation = operations.get(key);
            operations.delete(key);
            record(kind, type, { phase: 'cancelled', durationMs: operation ? now() - operation.startedAt : 0 });
        };
        const traceComparison = (type, fromCurrent, toCurrent, includePrefs) => {
            const token = begin('compare', type, { phase: 'loading', fromKind: fromCurrent ? 'current' : 'snapshot', toKind: toCurrent ? 'current' : 'snapshot', includePrefs });
            return Object.freeze({
                complete: (counts, fromFolders, toFolders, prefsChanged, prefsCompared, prefsAvailable) => finish('compare', type, token, { phase: 'complete', fromFolders, toFolders, prefsChanged, prefsCompared, prefsAvailable, added: counts.create, changed: counts.update, removed: counts.delete, unchanged: counts.unchanged }),
                discard: () => finish('compare', type, token, { discarded: true }),
                error: () => finish('compare', type, token, { phase: 'error' })
            });
        };
        const recordDialog = (type, shell) => {
            if (!TYPES.includes(type) || !shell) return;
            const buttons = Array.from(shell.querySelectorAll?.('.ui-dialog-buttonpane button') || []).slice(0, 6);
            record('compare', type, { dialog: { geometry: measure(shell, win), buttons: buttons.map(button => measure(button, win)) } });
        };
        const settingsSurface = () => {
            const node = doc?.getElementById?.('fv-settings-root'), mode = node ? (node.classList.contains('fv-advanced-mode') ? 'advanced' : 'basic') : 'unavailable';
            const active = doc?.querySelector?.('#fv-advanced-nav .fv-advanced-tab.is-active')?.getAttribute('data-fv-advanced-tab');
            return { mode, workspace: mode === 'basic' ? 'basic' : (WORKSPACES.includes(active) ? active : 'none'), geometry: measure(node, win) };
        };
        const recordSettingsSurface = type => record('settings', type, { surface: settingsSurface() });
        const collect = () => {
            const records = read(), channels = {};
            for (const kind of KINDS) {
                channels[kind] = {};
                for (const type of TYPES) {
                    const snapshots = records[keyFor(kind, type)], latest = snapshots.at(-1) || null;
                    channels[kind][type] = { available: !!latest, versionMismatch: !!latest?.pluginVersion && !!pluginVersion() && latest.pluginVersion !== pluginVersion(), latest, snapshots };
                }
            }
            const dialogs = Array.from(doc?.querySelectorAll?.('.fv-snapshot-compare-modal') || []).slice(0, 4).map(node => {
                const shell = node.closest?.('.ui-dialog') || node;
                const buttons = Array.from(shell.querySelectorAll?.('.ui-dialog-buttonpane button') || []).slice(0, 6);
                return { kind: 'compare', geometry: measure(shell, win), buttons: buttons.map(button => measure(button, win)) };
            });
            return {
                schemaVersion: 1, historyLimit: HISTORY_LIMIT, staleAfterMs: STALE_AFTER_MS,
                browser: browserInfo(win.navigator),
                settingsSurface: settingsSurface(),
                dialogs, channels
            };
        };
        return Object.freeze({ record, begin, finish, cancel, traceComparison, recordDialog, recordSettingsSurface, collect, normalizeDashboardGeometry });
    };
    const normalizeDashboardGeometry = value => {
        if (!value || typeof value !== 'object') return { available: false };
        const result = { observedTileCount: count(value.observedTileCount), truncated: value.truncated === true, appliedRowGapPx: dimension(value.appliedRowGapPx) };
        for (const key of ['folderHeaderHeights', 'nativeTileHeights', 'rowGaps', 'previewHeights']) {
            result[key] = { count: count(value[key]?.count) };
            for (const metric of ['minimumPx', 'medianPx', 'maximumPx']) result[key][metric] = dimension(value[key]?.[metric]);
        }
        const expansion = value.expansion || {};
        result.expansion = { available: expansion.available === true, reason: ['measured', 'expired', 'layout-changed', 'headers-unavailable', 'not-observed'].includes(expansion.reason) ? expansion.reason : 'not-observed' };
        for (const key of ['measuredHeaderCount', 'movedHeaderCount', 'maximumHorizontalShiftPx', 'maximumVerticalShiftPx']) result.expansion[key] = dimension(expansion[key]);
        return result;
    };
    return Object.freeze({ STORAGE_KEY, HISTORY_LIMIT, STALE_AFTER_MS, normalize, browserInfo, measure, normalizeDashboardGeometry, createApi });
}));
