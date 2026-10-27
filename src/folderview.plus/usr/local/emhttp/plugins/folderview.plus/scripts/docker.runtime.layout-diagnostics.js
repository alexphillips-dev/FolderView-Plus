// @ts-check
(function dockerRuntimeLayoutDiagnosticsModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined' ? globalThis : root;
    if (typeof module === 'object' && module.exports) { module.exports = factory(fallbackWindow); return; }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.dockerLayoutDiagnostics = factory(fallbackWindow);
    const api = modules.dockerLayoutDiagnostics;
    root.FolderViewPlusDockerLayoutGeometry = Object.freeze({ readNodeGeometry: api.readNodeGeometry, compareGeometry: api.compareGeometry });
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeLayoutDiagnosticsFactory(fallbackWindow) {
    'use strict';
    const readNodeGeometry = (node) => {
        const rect = typeof node?.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
        if (!rect) {
            return null;
        }
        const owner = node.parentElement || null;
        const ownerRect = typeof owner?.getBoundingClientRect === 'function'
            ? owner.getBoundingClientRect()
            : null;
        return Object.freeze({
            left: Number(rect.left || 0),
            top: Number(rect.top || 0),
            relativeLeft: ownerRect ? Number(rect.left || 0) - Number(ownerRect.left || 0) : null,
            relativeTop: ownerRect ? Number(rect.top || 0) - Number(ownerRect.top || 0) : null,
            ownerLeft: ownerRect ? Number(ownerRect.left || 0) : null,
            ownerTop: ownerRect ? Number(ownerRect.top || 0) : null
        });
    };

    const distance = (after, before, key) => (
        before?.[key] === null || after?.[key] === null
            ? 0
            : Math.abs(Number(after?.[key] || 0) - Number(before?.[key] || 0))
    );

    const compareGeometry = (before, after) => {
        if (!before || !after) {
            return null;
        }
        const xShift = distance(after, before, 'left');
        const yShift = distance(after, before, 'top');
        const relativeXShift = distance(after, before, 'relativeLeft');
        const relativeYShift = distance(after, before, 'relativeTop');
        const rowXShift = distance(after, before, 'ownerLeft');
        const rowYShift = distance(after, before, 'ownerTop');
        return Object.freeze({
            xShift,
            yShift,
            shift: Math.max(xShift, yShift),
            relativeXShift,
            relativeYShift,
            relativeShift: Math.max(relativeXShift, relativeYShift),
            rowXShift,
            rowYShift,
            rowShift: Math.max(rowXShift, rowYShift)
        });
    };

    // Fixed-size, read-only sampling: never retain DOM text, identifiers or asset URLs.
    const createColumnMovementTracker = ({ window: win, document: doc, readEnvironment = () => ({}),
        getViewMode = () => 'unknown', onSnapshot = () => {} } = {}) => {
        const now = () => win?.performance?.now?.() ?? Date.now();
        const startedAt = now();
        const elapsed = () => Math.max(0, Math.round(now() - startedAt));
        const round = value => Math.round((Number(value) || 0) * 10) / 10;
        const state = { schemaVersion: 1, available: false, sampleIntervalMs: 1000, sampleCount: 0,
            startupDelayMs: 5000, snapshotMinimumIntervalMs: 5000,
            movementCount: 0, reversalCount: 0, maximumColumnShiftPx: 0, maximumTableShiftPx: 0,
            maximumWidthChangePx: 0, maximumHeaderBodyMismatchPx: 0, lastSampleMs: 0,
            maximumBodyColumnShiftPx: 0, maximumBodyWidthChangePx: 0,
            aurora: {}, initial: null, latest: null, events: [], triggers: [] };
        let previous = null, directions = [], timer = null, disposed = false, suspended = false;
        let lastSavedMs = -10000;
        const removals = [];
        const recordTrigger = (kind, reason = '') => {
            const safeKind = ['host-loadlist', 'host-listview', 'plugin-width', 'visibility', 'viewport'].includes(kind) ? kind : 'unknown';
            const clean = String(reason).replace(/^debounced:/, '');
            const safeReason = ['init', 'bootstrap-stable', 'pre-visible-folder-commit', 'table-bind', 'render-complete',
                'font-ready', 'theme:observer', 'theme:viewport', 'theme:theme-event', 'theme:pageshow',
                'viewport-change', 'prefs-change', 'folder-toggle', 'listview-mode-change'].includes(clean) ? clean : 'other';
            state.triggers.push({ atMs: elapsed(), kind: safeKind, reason: safeReason });
            state.triggers = state.triggers.slice(-16);
        };
        const read = () => {
            const table = doc?.querySelector?.('#docker_containers');
            if (!table?.getBoundingClientRect) return null;
            const rect = table.getBoundingClientRect();
            if (rect.width <= 0) return null;
            const headers = Array.from(table.tHead?.rows?.[0]?.cells || []).slice(0, 16);
            if (!headers.length) return null;
            let cells = [];
            const rows = table.tBodies?.[0]?.rows || [];
            for (let index = 0; index < Math.min(rows.length, 32); index++) {
                const row = rows[index];
                if (row.cells?.length !== headers.length || row.classList?.contains('folder-storage')) continue;
                if (row.getBoundingClientRect().width > 0) { cells = Array.from(row.cells); break; }
            }
            const columns = headers.map((header, index) => {
                const box = header.getBoundingClientRect(), body = cells[index]?.getBoundingClientRect();
                return { index, visible: box.width > 0, left: round(box.left - rect.left), width: round(box.width),
                    bodyLeft: body?.width > 0 ? round(body.left - rect.left) : null,
                    bodyWidth: body?.width > 0 ? round(body.width) : null };
            });
            const mode = getViewMode();
            return { tableLeft: round(rect.left), tableWidth: round(rect.width), viewportWidth: round(win.innerWidth),
                scrollbarWidth: round(Math.max(0, win.innerWidth - (doc.documentElement?.clientWidth || win.innerWidth))),
                scrollX: round(win.scrollX), containerScrollX: round(table.closest?.('.TableContainer')?.scrollLeft),
                fixedListing: table.tHead?.classList?.contains('fixed') === true,
                bodyAvailable: cells.length > 0,
                viewMode: ['basic', 'advanced'].includes(mode) ? mode : 'unknown', columns };
        };
        const sample = () => {
            if (disposed || suspended || doc?.hidden) return false;
            const current = read();
            if (!current) { previous = null; directions = []; return false; }
            state.available = true;
            state.sampleCount++;
            state.lastSampleMs = elapsed();
            const environment = readEnvironment();
            const environmentChanged = JSON.stringify(environment) !== JSON.stringify(state.aurora);
            state.aurora = environment;
            let columnShift = 0, widthChange = 0, bodyShift = 0, bodyWidthChange = 0, mismatch = 0, reversed = false;
            const shapeChanged = !!previous && (current.columns.length !== previous.columns.length
                || current.columns.some((column, index) => column.visible !== previous.columns[index]?.visible));
            if (shapeChanged) directions = [];
            current.columns.forEach((column, index) => {
                if (!column.visible) return;
                if (column.bodyLeft !== null) mismatch = Math.max(mismatch, Math.abs(column.left - column.bodyLeft));
                const before = !shapeChanged && previous?.columns[index];
                if (!before?.visible) return;
                const dx = round(column.left - before.left), dw = round(column.width - before.width);
                let bodyDx = 0, bodyDw = 0;
                if (column.bodyLeft !== null && before.bodyLeft !== null) {
                    bodyDx = round(column.bodyLeft - before.bodyLeft); bodyDw = round(column.bodyWidth - before.bodyWidth);
                    bodyShift = Math.max(bodyShift, Math.abs(bodyDx));
                    bodyWidthChange = Math.max(bodyWidthChange, Math.abs(bodyDw));
                }
                columnShift = Math.max(columnShift, Math.abs(dx));
                widthChange = Math.max(widthChange, Math.abs(dw));
                const delta = [dx, dw, bodyDx, bodyDw].reduce((largest, value) => Math.abs(value) > Math.abs(largest) ? value : largest, 0);
                const direction = Math.sign(delta);
                if (Math.abs(delta) >= 0.5) {
                    if (directions[index] && direction !== directions[index]) reversed = true;
                    directions[index] = direction;
                }
            });
            const tableShift = previous ? round(Math.abs(current.tableLeft - previous.tableLeft)) : 0;
            state.maximumColumnShiftPx = Math.max(state.maximumColumnShiftPx, columnShift);
            state.maximumWidthChangePx = Math.max(state.maximumWidthChangePx, widthChange);
            state.maximumTableShiftPx = Math.max(state.maximumTableShiftPx, tableShift);
            state.maximumBodyColumnShiftPx = Math.max(state.maximumBodyColumnShiftPx, bodyShift);
            state.maximumBodyWidthChangePx = Math.max(state.maximumBodyWidthChangePx, bodyWidthChange);
            state.maximumHeaderBodyMismatchPx = round(Math.max(state.maximumHeaderBodyMismatchPx, mismatch));
            const moved = columnShift >= 0.5 || widthChange >= 0.5 || bodyShift >= 0.5
                || bodyWidthChange >= 0.5 || tableShift >= 0.5 || shapeChanged;
            if (moved || environmentChanged || !state.initial) {
                const trigger = state.triggers.at(-1);
                state.events.push({ atMs: elapsed(), tableShiftPx: tableShift, columnShiftPx: round(columnShift),
                    widthChangePx: round(widthChange), headerBodyMismatchPx: round(mismatch), reversed,
                    bodyColumnShiftPx: round(bodyShift), bodyWidthChangePx: round(bodyWidthChange),
                    shapeChanged, viewportChanged: !!previous && current.viewportWidth !== previous.viewportWidth,
                    scrollChanged: !!previous && (current.scrollX !== previous.scrollX || current.containerScrollX !== previous.containerScrollX),
                    nearbyTrigger: trigger && elapsed() - trigger.atMs <= 5000
                        ? { ...trigger, ageMs: elapsed() - trigger.atMs } : null,
                    geometry: current, aurora: environment });
                state.events = state.events.slice(-24);
            }
            if (moved) state.movementCount++;
            if (reversed) state.reversalCount++;
            state.initial ||= current;
            state.latest = current;
            previous = current;
            if (elapsed() - lastSavedMs >= 5000 && (moved || environmentChanged || elapsed() - lastSavedMs >= 10000)) {
                lastSavedMs = elapsed();
                onSnapshot();
            }
            return moved;
        };
        const stop = () => { if (timer !== null) win.clearTimeout(timer); timer = null; };
        const schedule = (delayMs = 1000) => {
            if (disposed || suspended || doc?.hidden || typeof win?.setTimeout !== 'function') return;
            timer = win.setTimeout(() => { timer = null; sample(); schedule(); }, delayMs);
        };
        const listen = (target, name, callback) => {
            target?.addEventListener?.(name, callback);
            removals.push(() => target?.removeEventListener?.(name, callback));
        };
        listen(doc, 'visibilitychange', () => {
            stop(); previous = null; directions = [];
            recordTrigger('visibility');
            if (doc.hidden) onSnapshot(true); else schedule();
        });
        listen(win, 'pagehide', () => { stop(); suspended = true; onSnapshot(true); });
        listen(win, 'pageshow', () => { if (!suspended) return; stop(); suspended = false; previous = null; directions = []; schedule(); });
        listen(win, 'resize', () => recordTrigger('viewport'));
        schedule(state.startupDelayMs);
        return Object.freeze({ sample, recordTrigger, getSnapshot: () => JSON.parse(JSON.stringify(state)),
            destroy: () => { disposed = true; stop(); removals.splice(0).forEach(remove => remove()); } });
    };

    const layoutGeometry = Object.freeze({ readNodeGeometry, compareGeometry });
    const themeIntegration = fallbackWindow.FolderViewPlusFoundationModules?.themeIntegration
        || (typeof module === 'object' && module.exports ? require('./folderviewplus.theme-integration.js') : null);
    let activeLayoutStabilityTracker = null;
    const createLayoutStabilityTracker = (deps = {}) => {
        activeLayoutStabilityTracker?.destroy?.();
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const cacheSchemaVersion = Math.max(1, Number(deps.cacheSchemaVersion) || 1);
        const algorithmVersion = String(deps.algorithmVersion || 'unknown').trim() || 'unknown';
        const startedAt = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
        const state = {
            schemaVersion: 2,
            capturedAt: new Date().toISOString(),
            phases: {},
            width: {
                cacheSchemaVersion,
                algorithmVersion,
                presetPx: null,
                cachedPx: null,
                estimatedPx: null,
                primedPx: null,
                preVisiblePx: null,
                settledPx: null,
                maximumCorrectionPx: 0,
                contentSignature: ''
            },
            previewActions: {
                initialTargetCount: 0,
                pendingWebuiSlotCount: 0,
                readyWebuiSlotCount: 0,
                unavailableWebuiSlotCount: 0,
                hydratedTargetCount: 0,
                shiftedTargetCount: 0,
                shiftedXTargetCount: 0,
                shiftedYTargetCount: 0,
                relativeShiftedTargetCount: 0,
                disconnectedTargetCount: 0,
                maximumShiftPx: 0,
                maximumXShiftPx: 0,
                maximumYShiftPx: 0,
                maximumRelativeShiftPx: 0,
                maximumRowShiftPx: 0
            },
            layoutShift: {
                supported: typeof win.PerformanceObserver === 'function',
                cumulativeValue: 0,
                entryCount: 0
            }
        };
        let layoutShiftObserver = null;
        const elapsedMs = () => {
            const now = typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
            return Math.max(0, Math.round((now - startedAt) * 10) / 10);
        };
        const normalizeDetails = (details = {}) => {
            const normalized = {};
            Object.entries(details && typeof details === 'object' ? details : {}).forEach(([key, value]) => {
                if (typeof value === 'boolean' || typeof value === 'string') {
                    normalized[key] = value;
                } else if (value !== null && Number.isFinite(Number(value))) {
                    normalized[key] = Math.round(Number(value) * 10) / 10;
                }
            });
            return normalized;
        };
        const markPhase = (phase, details = {}) => {
            const safePhase = String(phase || '').trim();
            if (!safePhase) {
                return;
            }
            const timestampMs = elapsedMs();
            const previous = state.phases[safePhase];
            state.phases[safePhase] = {
                firstMs: previous?.firstMs ?? timestampMs,
                lastMs: timestampMs,
                count: Math.max(0, Number(previous?.count) || 0) + 1,
                details: normalizeDetails(details)
            };
            state.capturedAt = new Date().toISOString();
        };
        const recordWidth = (stage, details = {}) => {
            columnMovement?.recordTrigger('plugin-width', details.reason || stage);
            Object.entries(details && typeof details === 'object' ? details : {}).forEach(([key, value]) => {
                if (key === 'contentSignature') {
                    state.width.contentSignature = String(value || '').trim();
                } else if (value !== null && value !== '' && Number.isFinite(Number(value))) {
                    state.width[key] = Math.round(Number(value) * 10) / 10;
                }
            });
            if (Number.isFinite(Number(details?.appliedPx)) && Number.isFinite(Number(state.width.primedPx))) {
                state.width.maximumCorrectionPx = Math.max(
                    Number(state.width.maximumCorrectionPx) || 0,
                    Math.round(Math.abs(Number(details.appliedPx) - Number(state.width.primedPx)) * 10) / 10
                );
            }
            markPhase(`width-${String(stage || '').trim()}`, details);
        };
        const summarizeActionSlots = () => {
            const targets = Array.from(doc?.querySelectorAll?.('.folder-preview .fv-preview-action-slot') || []);
            const webuiSlots = targets.filter((node) => node.classList?.contains('folder-element-webui'));
            return {
                targetCount: targets.length,
                pendingWebuiSlotCount: webuiSlots.filter((node) => node.classList?.contains('is-pending')).length,
                readyWebuiSlotCount: webuiSlots.filter((node) => node.classList?.contains('is-ready')).length,
                unavailableWebuiSlotCount: webuiSlots.filter((node) => node.classList?.contains('is-unavailable')).length
            };
        };
        const captureActionGeometry = () => {
            const geometry = new Map();
            doc?.querySelectorAll?.(
                '.folder-preview .folder-element-console, .folder-preview .folder-element-logs'
            )?.forEach((node) => {
                const measurement = layoutGeometry?.readNodeGeometry?.(node) || null;
                if (measurement) {
                    geometry.set(node, measurement);
                }
            });
            return geometry;
        };
        const compareActionGeometry = (beforeGeometry) => {
            if (!(beforeGeometry instanceof Map)) {
                return;
            }
            let comparedCount = 0;
            let shiftedCount = 0;
            let shiftedXCount = 0;
            let shiftedYCount = 0;
            let relativeShiftedCount = 0;
            let disconnectedCount = 0;
            let maximumShiftPx = 0;
            let maximumXShiftPx = 0;
            let maximumYShiftPx = 0;
            let maximumRelativeShiftPx = 0;
            let maximumRowShiftPx = 0;
            beforeGeometry.forEach((before, node) => {
                if (!node?.isConnected || typeof node.getBoundingClientRect !== 'function') {
                    disconnectedCount += 1;
                    return;
                }
                const after = layoutGeometry?.readNodeGeometry?.(node) || null;
                if (!after) {
                    disconnectedCount += 1;
                    return;
                }
                const comparison = layoutGeometry?.compareGeometry?.(before, after);
                if (!comparison) {
                    disconnectedCount += 1;
                    return;
                }
                const {
                    xShift,
                    yShift,
                    shift,
                    relativeShift,
                    rowShift
                } = comparison;
                comparedCount += 1;
                shiftedCount += shift >= 0.5 ? 1 : 0;
                shiftedXCount += xShift >= 0.5 ? 1 : 0;
                shiftedYCount += yShift >= 0.5 ? 1 : 0;
                relativeShiftedCount += relativeShift >= 0.5 ? 1 : 0;
                maximumShiftPx = Math.max(maximumShiftPx, shift);
                maximumXShiftPx = Math.max(maximumXShiftPx, xShift);
                maximumYShiftPx = Math.max(maximumYShiftPx, yShift);
                maximumRelativeShiftPx = Math.max(maximumRelativeShiftPx, relativeShift);
                maximumRowShiftPx = Math.max(maximumRowShiftPx, rowShift);
            });
            const summary = summarizeActionSlots();
            state.previewActions = {
                ...state.previewActions,
                hydratedTargetCount: comparedCount,
                shiftedTargetCount: shiftedCount,
                shiftedXTargetCount: shiftedXCount,
                shiftedYTargetCount: shiftedYCount,
                relativeShiftedTargetCount: relativeShiftedCount,
                disconnectedTargetCount: disconnectedCount,
                maximumShiftPx: Math.round(maximumShiftPx * 10) / 10,
                maximumXShiftPx: Math.round(maximumXShiftPx * 10) / 10,
                maximumYShiftPx: Math.round(maximumYShiftPx * 10) / 10,
                maximumRelativeShiftPx: Math.round(maximumRelativeShiftPx * 10) / 10,
                maximumRowShiftPx: Math.round(maximumRowShiftPx * 10) / 10,
                pendingWebuiSlotCount: summary.pendingWebuiSlotCount,
                readyWebuiSlotCount: summary.readyWebuiSlotCount,
                unavailableWebuiSlotCount: summary.unavailableWebuiSlotCount
            };
            markPhase('preview-actions-settled', {
                comparedCount,
                shiftedCount,
                shiftedXCount,
                shiftedYCount,
                relativeShiftedCount,
                disconnectedCount,
                maximumShiftPx,
                maximumXShiftPx,
                maximumYShiftPx,
                maximumRelativeShiftPx,
                maximumRowShiftPx
            });
        };
        const getSnapshot = () => {
            try {
                return JSON.parse(JSON.stringify({ ...state, capturedAt: new Date().toISOString(),
                    columnMovement: columnMovement?.getSnapshot() || { available: false } }));
            } catch (_error) {
                return { schemaVersion: 2, available: false };
            }
        };
        if (typeof win.PerformanceObserver === 'function') {
            try {
                layoutShiftObserver = new win.PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry?.hadRecentInput === true) {
                            return;
                        }
                        const touchesRuntime = Array.from(entry?.sources || []).some((source) => (
                            source?.node?.closest?.('#docker_containers, #docker_list, #docker_view')
                        ));
                        if (!touchesRuntime) {
                            return;
                        }
                        state.layoutShift.cumulativeValue = Math.round(
                            (Number(state.layoutShift.cumulativeValue) + Number(entry?.value || 0)) * 10000
                        ) / 10000;
                        state.layoutShift.entryCount += 1;
                    });
                });
                layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
            } catch (_error) {
                state.layoutShift.supported = false;
                layoutShiftObserver = null;
            }
        }
        const columnMovement = createColumnMovementTracker({
            window: win, document: doc, getViewMode: deps.getViewMode,
            readEnvironment: () => themeIntegration?.readAuroraEnvironment?.(doc, win) || {},
            onSnapshot: (flush = false) => deps.onColumnSnapshot?.(flush)
        });
        const tracker = Object.freeze({
            markPhase,
            recordWidth,
            recordColumnTrigger: (kind, reason) => columnMovement?.recordTrigger(kind, reason),
            summarizeActionSlots,
            captureActionGeometry,
            compareActionGeometry,
            updateInitialActionSummary: (summary = {}) => {
                state.previewActions = { ...state.previewActions, ...normalizeDetails(summary) };
            },
            getSnapshot,
            destroy: () => {
                columnMovement?.destroy();
                layoutShiftObserver?.disconnect?.();
                layoutShiftObserver = null;
                if (activeLayoutStabilityTracker === tracker) {
                    activeLayoutStabilityTracker = null;
                }
            }
        });
        activeLayoutStabilityTracker = tracker;
        return tracker;
    };
    return Object.freeze({ readNodeGeometry, compareGeometry, createLayoutStabilityTracker, createColumnMovementTracker });
}));
