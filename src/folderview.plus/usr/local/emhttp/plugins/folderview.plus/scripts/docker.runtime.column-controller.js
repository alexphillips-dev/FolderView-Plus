// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.dockerColumnController = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const createController = (deps = {}) => {
        const window = deps.window || (typeof globalThis !== 'undefined' ? globalThis : {});
        const document = deps.document || window.document || null;
        const $ = deps.$ || window.jQuery || window.$ || null;
        const utils = deps.utils || {};
        const localStorage = deps.localStorage || window.localStorage || null;
        const dockerStorageWriter = deps.storageWriter || null;
        const dockerRuntimeColumnLayoutEngine = deps.columnLayoutEngine || null;
        const dockerRuntimeWidthState = deps.widthState || {};
        const controllerState = deps.controllerState || {};
        const dockerHostAdapter = deps.hostAdapter || null;
        const runtimeStateObserverModule = deps.stateObserverModule || null;
        const getLastAppliedRuntimePrefs = typeof deps.getLastAppliedRuntimePrefs === 'function'
            ? deps.getLastAppliedRuntimePrefs
            : (() => null);
        const recordDockerRuntimeWidthTelemetry = typeof deps.recordWidthTelemetry === 'function'
            ? deps.recordWidthTelemetry
            : (() => {});
        const applyDockerThemeResolverTokens = typeof deps.applyThemeResolverTokens === 'function'
            ? deps.applyThemeResolverTokens
            : (() => null);
        const decorateDockerRuntimeLanEndpointValues = typeof deps.decorateLanEndpointValues === 'function'
            ? deps.decorateLanEndpointValues
            : (() => {});
        const {
            DOCKER_RUNTIME_APP_WIDTH_MIN,
            DOCKER_RUNTIME_APP_WIDTH_MAX,
            DOCKER_RUNTIME_APP_CHROME_WIDTH,
            DOCKER_RUNTIME_APP_TEXT_BUFFER,
            DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN,
            DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX,
            DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,
            DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE,
            DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
            DOCKER_RUNTIME_VERSION_GAP_MIN,
            DOCKER_RUNTIME_VERSION_GAP_MAX,
            DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP,
            DOCKER_RUNTIME_WIDTH_PHASES,
            DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS,
            DOCKER_RUNTIME_WIDTH_BOOTSTRAP_SETTLE_MS,
            DOCKER_RUNTIME_WIDTH_BOOTSTRAP_FONT_TIMEOUT_MS,
            DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX,
            DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY,
            DOCKER_RUNTIME_COLUMN_WIDTH_MIN,
            DOCKER_RUNTIME_COLUMN_WIDTH_MAX,
            DOCKER_RUNTIME_APP_PRESET_WIDTHS
        } = deps.constants || {};
        const clampDockerRuntimeColumnWidth = (value, columnIndex = 0) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
                return null;
            }
            const rounded = Math.round(parsed);
            if (columnIndex === 1) {
                if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.clampWidth === 'function') {
                    return dockerRuntimeColumnLayoutEngine.clampWidth(rounded);
                }
                return Math.max(DOCKER_RUNTIME_APP_WIDTH_MIN, Math.min(DOCKER_RUNTIME_APP_WIDTH_MAX, rounded));
            }
            return Math.max(DOCKER_RUNTIME_COLUMN_WIDTH_MIN, Math.min(DOCKER_RUNTIME_COLUMN_WIDTH_MAX, rounded));
        };

        const normalizeDockerRuntimeAppColumnMode = (value) => {
            const fallbackNormalize = () => {
                const mode = String(value || '').trim().toLowerCase();
                return mode === 'compact' || mode === 'wide' ? mode : 'standard';
            };
            if (!utils || typeof utils.normalizeAppColumnWidth !== 'function') {
                return fallbackNormalize();
            }
            return utils.normalizeAppColumnWidth(value);
        };

        const getDockerRuntimeAppColumnMode = () => {
            if (getLastAppliedRuntimePrefs() && typeof getLastAppliedRuntimePrefs() === 'object') {
                return normalizeDockerRuntimeAppColumnMode(getLastAppliedRuntimePrefs().appColumnWidth);
            }
            if (document.body && typeof document.body.getAttribute === 'function') {
                return normalizeDockerRuntimeAppColumnMode(document.body.getAttribute('data-fvplus-docker-app-width'));
            }
            return 'standard';
        };

        const isDockerRuntimeWidthDebugEnabled = () => {
            try {
                const params = new URLSearchParams(window.location.search || '');
                if (params.get('fvplusWidthDebug') === '1') {
                    return true;
                }
            } catch (_error) {
                // Ignore URL parsing issues in older environments.
            }
            try {
                return localStorage.getItem(DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY) === '1';
            } catch (_error) {
                return false;
            }
        };

        const setDockerRuntimeWidthDebugEnabled = (enabled) => {
            const next = enabled === true;
            try {
                if (dockerStorageWriter && typeof dockerStorageWriter.setItem === 'function') {
                    dockerStorageWriter.setItem(
                        DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY,
                        next ? '1' : '0',
                        { delayMs: 0, idle: false }
                    );
                } else {
                    localStorage.setItem(DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY, next ? '1' : '0');
                }
            } catch (_error) {
                // Ignore localStorage limitations.
            }
            if (dockerRuntimeWidthState.debugPanel) {
                dockerRuntimeWidthState.debugPanel.style.display = next ? 'block' : 'none';
            }
            if (next) {
                scheduleDockerRuntimeWidthReflow('debug-toggle', 0);
            }
            return next;
        };

        const ensureDockerRuntimeWidthDebugPanel = () => {
            if (!document.body || dockerRuntimeWidthState.debugPanel) {
                return dockerRuntimeWidthState.debugPanel;
            }
            const panel = document.createElement('div');
            panel.id = 'fvplus-docker-width-debug-panel';
            panel.style.position = 'fixed';
            panel.style.right = '14px';
            panel.style.bottom = '14px';
            panel.style.maxWidth = '340px';
            panel.style.maxHeight = '45vh';
            panel.style.overflow = 'auto';
            panel.style.padding = '8px 10px';
            panel.style.border = '1px solid var(--fvplus-runtime-menu-border, var(--fvplus-theme-border-subtle, currentColor))';
            panel.style.background = 'var(--fvplus-runtime-menu-bg, var(--fvplus-theme-surface-panel, transparent))';
            panel.style.color = 'var(--fvplus-runtime-menu-fg, var(--fvplus-theme-foreground, currentColor))';
            panel.style.fontFamily = 'Consolas, Menlo, monospace';
            panel.style.fontSize = '11px';
            panel.style.lineHeight = '1.42';
            panel.style.zIndex = '1200';
            panel.style.borderRadius = '6px';
            panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
            panel.style.pointerEvents = 'none';
            panel.style.whiteSpace = 'pre-wrap';
            panel.style.display = isDockerRuntimeWidthDebugEnabled() ? 'block' : 'none';
            panel.textContent = 'Docker width debug panel ready.';
            document.body.appendChild(panel);
            dockerRuntimeWidthState.debugPanel = panel;
            return panel;
        };

        const readDockerRuntimeGapMetrics = () => {
            const rows = Array.from(document.querySelectorAll('tbody#docker_list tr.folder, tbody#docker_view tr.folder'));
            const samples = [];
            rows.forEach((row) => {
                if (!row || row.offsetParent === null || row.classList.contains('fv-nested-hidden')) {
                    return;
                }
                const appCell = row.querySelector('td.ct-name.folder-name, td.folder-name');
                const dropdown = row.querySelector('button.folder-dropdown');
                const versionCell = row.querySelector('td.updatecolumn.folder-update');
                if (!appCell || !dropdown || !versionCell) {
                    return;
                }
                const appRect = appCell.getBoundingClientRect();
                const dropdownRect = dropdown.getBoundingClientRect();
                const versionRect = versionCell.getBoundingClientRect();
                const appBoundaryGap = appRect.right - dropdownRect.right;
                const versionGap = versionRect.left - dropdownRect.right;
                if (!Number.isFinite(versionGap) || !Number.isFinite(appBoundaryGap)) {
                    return;
                }
                samples.push({ versionGap, appBoundaryGap });
            });
            if (!samples.length) {
                return {
                    sampleCount: 0,
                    minVersionGap: null,
                    maxVersionGap: null,
                    minAppBoundaryGap: null,
                    maxAppBoundaryGap: null
                };
            }
            let minVersionGap = Number.POSITIVE_INFINITY;
            let maxVersionGap = Number.NEGATIVE_INFINITY;
            let minAppBoundaryGap = Number.POSITIVE_INFINITY;
            let maxAppBoundaryGap = Number.NEGATIVE_INFINITY;
            samples.forEach((sample) => {
                minVersionGap = Math.min(minVersionGap, sample.versionGap);
                maxVersionGap = Math.max(maxVersionGap, sample.versionGap);
                minAppBoundaryGap = Math.min(minAppBoundaryGap, sample.appBoundaryGap);
                maxAppBoundaryGap = Math.max(maxAppBoundaryGap, sample.appBoundaryGap);
            });
            return {
                sampleCount: samples.length,
                minVersionGap,
                maxVersionGap,
                minAppBoundaryGap,
                maxAppBoundaryGap
            };
        };

        const applyDockerRuntimeGapContract = (widthPx, metrics = null) => {
            const current = clampDockerRuntimeColumnWidth(widthPx, 1);
            if (!current) {
                return widthPx;
            }
            const gapMetrics = metrics && typeof metrics === 'object' ? metrics : readDockerRuntimeGapMetrics();
            let adjusted = current;
            if (Number.isFinite(gapMetrics.maxVersionGap) && gapMetrics.maxVersionGap > DOCKER_RUNTIME_VERSION_GAP_MAX) {
                const reduceBy = Math.min(
                    DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP,
                    gapMetrics.maxVersionGap - DOCKER_RUNTIME_VERSION_GAP_MAX
                );
                adjusted -= reduceBy;
            }
            if (Number.isFinite(gapMetrics.minVersionGap) && gapMetrics.minVersionGap < DOCKER_RUNTIME_VERSION_GAP_MIN) {
                const increaseBy = Math.min(
                    DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP,
                    DOCKER_RUNTIME_VERSION_GAP_MIN - gapMetrics.minVersionGap
                );
                adjusted += increaseBy;
            }
            return clampDockerRuntimeColumnWidth(adjusted, 1) || current;
        };

        const renderDockerRuntimeWidthDebugPanel = (decision) => {
            const panel = ensureDockerRuntimeWidthDebugPanel();
            if (!panel || !isDockerRuntimeWidthDebugEnabled()) {
                return;
            }
            const summary = decision && typeof decision === 'object' ? decision : {};
            const line = (label, value) => `${label}: ${value === null || value === undefined ? 'n/a' : value}`;
            panel.style.display = 'block';
            panel.textContent = [
                '[FolderView Plus] Docker Width',
                line('phase', dockerRuntimeWidthState.phase),
                line('reason', dockerRuntimeWidthState.lastReason),
                line('mode', summary.mode),
                line('estimated', summary.estimatedAppWidth),
                line('overflowAdjusted', summary.overflowAdjustedWidth),
                line('gapAdjusted', summary.gapAdjustedWidth),
                line('floorLimit', summary.floorLimit),
                line('boundedFloor', summary.boundedFloor),
                line('applied', summary.appliedWidth),
                line('gap.sampleCount', summary.gapMetricsAfter?.sampleCount),
                line('gap.minVersion', summary.gapMetricsAfter?.minVersionGap),
                line('gap.maxVersion', summary.gapMetricsAfter?.maxVersionGap),
                line('gap.minBoundary', summary.gapMetricsAfter?.minAppBoundaryGap),
                line('gap.maxBoundary', summary.gapMetricsAfter?.maxAppBoundaryGap),
                line('timestamp', new Date().toISOString()),
                '',
                'toggle: window.toggleDockerRuntimeWidthDebug(true|false)'
            ].join('\n');
        };

        const getDockerRuntimePresetAppWidth = () => {
            const mode = getDockerRuntimeAppColumnMode();
            if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.resolvePresetWidth === 'function') {
                return dockerRuntimeColumnLayoutEngine.resolvePresetWidth(mode);
            }
            const preset = DOCKER_RUNTIME_APP_PRESET_WIDTHS[mode] || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
            return clampDockerRuntimeColumnWidth(preset, 1);
        };

        const getDockerRuntimeTableTargets = () => {
            const tbody = document.querySelector('tbody#docker_list') || document.querySelector('tbody#docker_view');
            if (!tbody) {
                return null;
            }
            const table = tbody.closest('table');
            if (!table) {
                return null;
            }
            const headers = Array.from(table.querySelectorAll('thead th'));
            if (headers.length === 0) {
                return null;
            }
            return { table, headers };
        };

        const applyDockerRuntimeAppWidthVariables = (desktopWidthPx = null) => {
            if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.applyCssWidthVars === 'function') {
                dockerRuntimeColumnLayoutEngine.applyCssWidthVars(desktopWidthPx);
                return;
            }
            const safeDesktopWidth = clampDockerRuntimeColumnWidth(desktopWidthPx, 1);
            if (!document.body || !document.body.style) {
                return;
            }
            if (!safeDesktopWidth) {
                document.body.style.removeProperty('--fvplus-docker-app-column-width');
                document.body.style.removeProperty('--fvplus-docker-app-column-width-mobile');
                return;
            }
            const mobileWidth = Math.max(
                DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
                Math.round(safeDesktopWidth * DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE)
            );
            document.body.style.setProperty('--fvplus-docker-app-column-width', `${safeDesktopWidth}px`);
            document.body.style.setProperty('--fvplus-docker-app-column-width-mobile', `${mobileWidth}px`);
        };

        const applyDockerRuntimeAppColumnInlineWidth = (desktopWidthPx = null) => {
            const effectiveWidth = clampDockerRuntimeColumnWidth(desktopWidthPx, 1);
            if (!effectiveWidth) {
                return;
            }
            const targets = getDockerRuntimeTableTargets();
            if (!targets) {
                return;
            }
            const applyWidth = (element) => {
                if (!element || !element.style) {
                    return;
                }
                element.style.setProperty('width', `${effectiveWidth}px`);
                element.style.setProperty('min-width', `${effectiveWidth}px`);
                element.style.setProperty('max-width', `${effectiveWidth}px`);
            };
            applyWidth(targets.headers[0]);
            const cells = document.querySelectorAll('tbody#docker_list > tr > td:nth-child(1), tbody#docker_view > tr > td:nth-child(1)');
            cells.forEach((cell) => applyWidth(cell));
        };

        const primeDockerRuntimeAppWidthBeforeRender = (folders = null) => {
            const baseline = getDockerRuntimePresetAppWidth() || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
            const folderEntries = folders && typeof folders === 'object'
                ? Object.values(folders).filter((folder) => folder && typeof folder === 'object')
                : [];
            const bootstrap = dockerRuntimeColumnLayoutEngine?.resolveFolderBootstrap?.({
                folders: folderEntries,
                baseline,
                statusLabels: dockerRuntimeColumnLayoutEngine?.resolveStatusLabels?.((key) => $.i18n(key)) || [],
                sampleNode: document.querySelector('tbody#docker_list td.ct-name, tbody#docker_view td.ct-name, body'),
                chromeWidth: DOCKER_RUNTIME_APP_CHROME_WIDTH,
                textBuffer: DOCKER_RUNTIME_APP_TEXT_BUFFER,
                mode: getDockerRuntimeAppColumnMode(),
                floor: controllerState.autoAppWidthFloor
            }) || { estimatedWidth: baseline, primedWidth: baseline, contentSignature: '' };
            controllerState.widthContentSignature = String(bootstrap.contentSignature || '').trim();
            if (bootstrap.staleCacheRejected) {
                controllerState.autoAppWidthFloor = null;
            }
            const primedWidth = clampDockerRuntimeColumnWidth(bootstrap.primedWidth, 1);
            if (!primedWidth) {
                return null;
            }
            recordDockerRuntimeWidthTelemetry('primed', {
                presetPx: baseline,
                cachedPx: bootstrap.cachedWidth,
                estimatedPx: bootstrap.estimatedWidth,
                primedPx: primedWidth,
                appliedPx: primedWidth,
                contentSignature: controllerState.widthContentSignature
            });
            controllerState.autoAppWidthFloor = primedWidth;
            applyDockerRuntimeAppWidthVariables(primedWidth);
            applyDockerRuntimeAppColumnInlineWidth(primedWidth);
            return primedWidth;
        };

        const estimateDockerRuntimeAutoAppWidth = () => {
            const baseline = getDockerRuntimePresetAppWidth() || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
            const rows = Array.from(document.querySelectorAll('tbody#docker_list tr.folder, tbody#docker_view tr.folder'));
            if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.estimateFromRows === 'function') {
                const estimated = dockerRuntimeColumnLayoutEngine.estimateFromRows({
                    rows,
                    baseline,
                    nameSelector: '.folder-appname',
                    auxSelectors: ['.folder-state'],
                    indentSelector: '.folder-name-sub',
                    hiddenClass: 'fv-nested-hidden',
                    chromeWidth: DOCKER_RUNTIME_APP_CHROME_WIDTH,
                    textBuffer: DOCKER_RUNTIME_APP_TEXT_BUFFER
                });
                return estimated || baseline;
            }
            return baseline;
        };

        const adjustDockerRuntimeAppWidthForRenderedOverflow = (baseWidth = null) => {
            const fallback = getDockerRuntimePresetAppWidth() || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
            const startingWidth = clampDockerRuntimeColumnWidth(baseWidth, 1) || fallback;
            const rows = Array.from(document.querySelectorAll('tbody#docker_list tr.folder, tbody#docker_view tr.folder'));
            if (!rows.length) {
                return startingWidth;
            }
            let maxOverflow = 0;
            rows.forEach((row) => {
                if (!row || row.offsetParent === null || row.classList.contains('fv-nested-hidden')) {
                    return;
                }
                const widthNodes = [
                    row.querySelector('.folder-appname'),
                    row.querySelector('.folder-state')
                ].filter(Boolean);
                if (!widthNodes.length) {
                    return;
                }
                widthNodes.forEach((node) => {
                    const clientWidth = Math.max(0, Math.ceil(node.clientWidth || 0));
                    if (clientWidth <= 0) {
                        return;
                    }
                    const rawOverflow = Math.ceil((node.scrollWidth || 0) - clientWidth);
                    if (clientWidth < DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN && rawOverflow <= 0) {
                        return;
                    }
                    if (rawOverflow <= 0) {
                        return;
                    }
                    const overflow = Math.min(rawOverflow, DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX);
                    if (overflow > maxOverflow) {
                        maxOverflow = overflow;
                    }
                });
            });
            if (maxOverflow <= 0) {
                return startingWidth;
            }
            // Only nudge width when real rendered clipping exists; avoid global widening.
            const padded = startingWidth + maxOverflow + DOCKER_RUNTIME_APP_TEXT_BUFFER;
            return clampDockerRuntimeColumnWidth(padded, 1) || startingWidth;
        };

        const buildDockerRuntimeWidthDecision = () => {
            const mode = getDockerRuntimeAppColumnMode();
            if (controllerState.autoAppWidthFloorMode !== mode) {
                controllerState.autoAppWidthFloorMode = mode;
                controllerState.autoAppWidthFloor = null;
            }
            const estimatedAppWidth = estimateDockerRuntimeAutoAppWidth();
            const overflowAdjustedWidth = adjustDockerRuntimeAppWidthForRenderedOverflow(estimatedAppWidth);
            const gapMetricsBefore = readDockerRuntimeGapMetrics();
            const gapAdjustedWidth = applyDockerRuntimeGapContract(overflowAdjustedWidth, gapMetricsBefore);
            const floorLimit = clampDockerRuntimeColumnWidth(
                estimatedAppWidth + DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,
                1
            ) || estimatedAppWidth;
            let boundedFloor = null;
            let appliedWidth = gapAdjustedWidth;
            if (Number.isFinite(controllerState.autoAppWidthFloor)) {
                boundedFloor = controllerState.autoAppWidthFloor;
                appliedWidth = Math.max(appliedWidth, boundedFloor);
            }
            appliedWidth = clampDockerRuntimeColumnWidth(appliedWidth, 1) || estimatedAppWidth;
            const nextFloor = appliedWidth;
            return {
                mode,
                estimatedAppWidth,
                overflowAdjustedWidth,
                gapAdjustedWidth,
                floorLimit,
                boundedFloor,
                appliedWidth,
                nextFloor,
                gapMetricsBefore
            };
        };

        const readDockerRuntimeAppliedAppWidth = () => {
            const inlineValue = document.body?.style?.getPropertyValue('--fvplus-docker-app-column-width') || '';
            const parsedInline = Number.parseFloat(inlineValue);
            if (Number.isFinite(parsedInline)) {
                return clampDockerRuntimeColumnWidth(parsedInline, 1);
            }
            const targets = getDockerRuntimeTableTargets();
            const parsedHeader = Number.parseFloat(targets?.headers?.[0]?.style?.width || '');
            return Number.isFinite(parsedHeader) ? clampDockerRuntimeColumnWidth(parsedHeader, 1) : null;
        };

        const applyDockerRuntimeColumnWidths = (_widthMap = null, options = {}) => {
            const targets = getDockerRuntimeTableTargets();
            if (!targets) {
                return;
            }
            const decision = buildDockerRuntimeWidthDecision();
            const currentWidth = readDockerRuntimeAppliedAppWidth();
            const minimumDelta = Math.max(0, Number(options?.minimumDelta) || 0);
            if (
                minimumDelta > 0
                && Number.isFinite(currentWidth)
                && Math.abs(decision.appliedWidth - currentWidth) < minimumDelta
            ) {
                decision.requestedWidth = decision.appliedWidth;
                decision.appliedWidth = currentWidth;
                decision.nextFloor = currentWidth;
                decision.suppressedSmallDelta = true;
            }
            controllerState.autoAppWidthFloor = decision.nextFloor;
            dockerRuntimeColumnLayoutEngine?.writeCachedWidth?.(
                decision.mode,
                decision.appliedWidth,
                controllerState.widthContentSignature,
                dockerStorageWriter
            );
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
            targets.headers.forEach((header, idx) => {
                const index = idx + 1;
                if (index !== 1) {
                    return;
                }
                const effectiveWidth = isMobile
                    ? Math.max(
                        DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
                        Math.round(decision.appliedWidth * DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE)
                    )
                    : decision.appliedWidth;
                applyDockerRuntimeAppColumnInlineWidth(effectiveWidth);
            });
            applyDockerRuntimeAppWidthVariables(decision.appliedWidth || null);
            const gapMetricsAfter = readDockerRuntimeGapMetrics();
            dockerRuntimeWidthState.lastDecision = {
                ...decision,
                gapMetricsAfter,
                reason: dockerRuntimeWidthState.lastReason,
                phase: dockerRuntimeWidthState.phase
            };
            const telemetryStage = dockerRuntimeWidthState.lastReason === 'pre-visible-folder-commit'
                ? 'pre-visible'
                : (dockerRuntimeWidthState.lastReason === 'bootstrap-stable' ? 'settled' : 'reflow');
            recordDockerRuntimeWidthTelemetry(telemetryStage, {
                appliedPx: decision.appliedWidth,
                preVisiblePx: telemetryStage === 'pre-visible' ? decision.appliedWidth : null,
                settledPx: telemetryStage === 'settled' ? decision.appliedWidth : null
            });
            renderDockerRuntimeWidthDebugPanel(dockerRuntimeWidthState.lastDecision);
            return decision.appliedWidth;
        };

        const isDockerRuntimeWidthBootstrapActive = () => (
            dockerRuntimeWidthState.bootstrapLocked === true
            || dockerRuntimeWidthState.stabilizationPending === true
        );

        const runDockerRuntimeWidthReflow = (reason = 'direct', options = {}) => {
            if (isDockerRuntimeWidthBootstrapActive() && options?.force !== true) {
                dockerRuntimeWidthState.deferredReason = String(reason || 'direct');
                return null;
            }
            if (dockerRuntimeWidthState.debounceTimer !== null) {
                clearTimeout(dockerRuntimeWidthState.debounceTimer);
                dockerRuntimeWidthState.debounceTimer = null;
            }
            dockerRuntimeWidthState.pendingReason = '';
            dockerRuntimeWidthState.lastReason = String(reason || 'direct');
            dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.measure;
            const appliedWidth = applyDockerRuntimeColumnWidths(null, options);
            dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.idle;
            return appliedWidth;
        };

        const scheduleDockerRuntimeWidthReflow = (reason = 'event', delayMs = DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS) => {
            if (isDockerRuntimeWidthBootstrapActive()) {
                dockerRuntimeWidthState.deferredReason = String(reason || 'event');
                return;
            }
            dockerRuntimeWidthState.pendingReason = String(reason || 'event');
            dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.debounce;
            if (dockerRuntimeWidthState.debounceTimer !== null) {
                clearTimeout(dockerRuntimeWidthState.debounceTimer);
            }
            const safeDelay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS;
            dockerRuntimeWidthState.debounceTimer = window.setTimeout(() => {
                dockerRuntimeWidthState.debounceTimer = null;
                const pendingReason = dockerRuntimeWidthState.pendingReason || reason;
                dockerRuntimeWidthState.pendingReason = '';
                runDockerRuntimeWidthReflow(`debounced:${pendingReason}`);
            }, safeDelay);
        };

        const beginDockerRuntimeWidthBootstrap = () => {
            dockerRuntimeWidthState.stabilizationGeneration += 1;
            dockerRuntimeWidthState.bootstrapLocked = true;
            dockerRuntimeWidthState.stabilizationPending = false;
            dockerRuntimeWidthState.deferredReason = '';
            dockerRuntimeWidthState.resizerBindPending = false;
            if (dockerRuntimeWidthState.debounceTimer !== null) {
                clearTimeout(dockerRuntimeWidthState.debounceTimer);
                dockerRuntimeWidthState.debounceTimer = null;
            }
            if (dockerRuntimeWidthState.stabilizationTimer !== null) {
                clearTimeout(dockerRuntimeWidthState.stabilizationTimer);
                dockerRuntimeWidthState.stabilizationTimer = null;
            }
            if (controllerState.resizerBindTimer !== null) {
                clearTimeout(controllerState.resizerBindTimer);
                controllerState.resizerBindTimer = null;
            }
            dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.idle;
            return dockerRuntimeWidthState.stabilizationGeneration;
        };

        const completeDockerRuntimeWidthBootstrap = (generation, options = {}) => {
            if (generation !== dockerRuntimeWidthState.stabilizationGeneration) {
                return;
            }
            dockerRuntimeWidthState.bootstrapLocked = false;
            if (options?.stabilize === false) {
                dockerRuntimeWidthState.stabilizationPending = false;
                dockerRuntimeWidthState.resizerBindPending = false;
                bindDockerRuntimeColumnResizers({ scheduleReflow: false });
                if (options?.reflow !== false) {
                    scheduleDockerRuntimeWidthReflow('bootstrap-error', 0);
                }
                return;
            }
            dockerRuntimeWidthState.stabilizationPending = true;
            const startedAt = Date.now();
            const waitForFonts = document.fonts?.ready && typeof document.fonts.ready.then === 'function'
                ? Promise.resolve(document.fonts.ready).catch(() => undefined)
                : Promise.resolve();
            const fontTimeout = new Promise((resolve) => {
                window.setTimeout(resolve, DOCKER_RUNTIME_WIDTH_BOOTSTRAP_FONT_TIMEOUT_MS);
            });
            Promise.race([waitForFonts, fontTimeout]).then(() => {
                if (generation !== dockerRuntimeWidthState.stabilizationGeneration) {
                    return;
                }
                const elapsed = Date.now() - startedAt;
                const remaining = Math.max(0, DOCKER_RUNTIME_WIDTH_BOOTSTRAP_SETTLE_MS - elapsed);
                dockerRuntimeWidthState.stabilizationTimer = window.setTimeout(() => {
                    if (generation !== dockerRuntimeWidthState.stabilizationGeneration) {
                        return;
                    }
                    dockerRuntimeWidthState.stabilizationTimer = null;
                    dockerRuntimeWidthState.stabilizationPending = false;
                    dockerRuntimeWidthState.resizerBindPending = false;
                    bindDockerRuntimeColumnResizers({ scheduleReflow: false });
                    runDockerRuntimeWidthReflow('bootstrap-stable', {
                        force: true,
                        minimumDelta: DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX
                    });
                    dockerRuntimeWidthState.deferredReason = '';
                }, remaining);
            });
        };

        const bindDockerRuntimeFontReadyReflow = () => {
            if (dockerRuntimeWidthState.fontReadyBound) {
                return;
            }
            dockerRuntimeWidthState.fontReadyBound = true;
            if (!document.fonts) {
                return;
            }
            const onFontReady = () => scheduleDockerRuntimeWidthReflow('font-ready', 20);
            if (document.fonts.ready && typeof document.fonts.ready.then === 'function') {
                document.fonts.ready.then(onFontReady).catch(() => {});
            }
            if (typeof document.fonts.addEventListener === 'function') {
                document.fonts.addEventListener('loadingdone', onFontReady);
            }
        };

        const dockerRuntimeThemeReflowController = runtimeStateObserverModule && typeof runtimeStateObserverModule.createThemeReflowController === 'function'
            ? runtimeStateObserverModule.createThemeReflowController({
                window,
                document,
                viewportReason: 'viewport-change',
                viewportDelayMs: DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS,
                themeReasonPrefix: 'theme',
                themeDelayMs: 40,
                scheduleReflow: (reason, delayMs) => scheduleDockerRuntimeWidthReflow(reason, delayMs),
                onQueueReason: (reason) => {
                    applyDockerThemeResolverTokens(`docker-runtime:${reason}`, {
                        root: document.body,
                        modeInput: 'auto'
                    });
                }
            })
            : null;

        const applyDockerRuntimeResolvedThemeTokens = (reason = 'docker-runtime:initial') => applyDockerThemeResolverTokens(reason, {
            root: document.body,
            modeInput: 'auto'
        });

        const bindDockerRuntimeViewportWidthSync = () => {
            dockerRuntimeThemeReflowController?.bindViewportWidthSync();
        };

        const bindDockerRuntimeThemeReflow = () => {
            applyDockerRuntimeResolvedThemeTokens('docker-runtime:bind');
            dockerRuntimeThemeReflowController?.bindThemeReflow();
        };

        const scheduleDockerRuntimeResizerRetry = () => {
            if (controllerState.resizerRetryTimer !== null) {
                return;
            }
            controllerState.resizerRetryTimer = window.setTimeout(() => {
                controllerState.resizerRetryTimer = null;
                bindDockerRuntimeColumnResizers();
            }, 180);
        };

        const ensureDockerRuntimeResizerObserver = () => {
            if (controllerState.resizerObserver || !dockerHostAdapter || typeof dockerHostAdapter.observeRows !== 'function') {
                return;
            }
            const target = dockerHostAdapter.getPrimaryBody?.();
            if (!target) {
                return;
            }
            const disconnect = dockerHostAdapter.observeRows(() => {
                decorateDockerRuntimeLanEndpointValues();
                if (isDockerRuntimeWidthBootstrapActive()) {
                    dockerRuntimeWidthState.resizerBindPending = true;
                    return;
                }
                queueDockerRuntimeResizerBind();
            }, { subtree: true });
            controllerState.resizerObserver = { disconnect };
        };

        const queueDockerRuntimeResizerBind = () => {
            if (isDockerRuntimeWidthBootstrapActive()) {
                dockerRuntimeWidthState.resizerBindPending = true;
                return;
            }
            if (controllerState.resizerBindTimer !== null) {
                return;
            }
            controllerState.resizerBindTimer = window.setTimeout(() => {
                controllerState.resizerBindTimer = null;
                bindDockerRuntimeColumnResizers();
            }, 0);
        };

        const bindDockerRuntimeColumnResizers = (options = {}) => {
            if (isDockerRuntimeWidthBootstrapActive() && options?.force !== true) {
                dockerRuntimeWidthState.resizerBindPending = true;
                return;
            }
            const targets = getDockerRuntimeTableTargets();
            if (!targets) {
                if (controllerState.resizerRetryCount < 20) {
                    controllerState.resizerRetryCount += 1;
                    scheduleDockerRuntimeResizerRetry();
                }
                return;
            }
            controllerState.resizerRetryCount = 0;
            ensureDockerRuntimeResizerObserver();
            bindDockerRuntimeViewportWidthSync();
            bindDockerRuntimeFontReadyReflow();
            bindDockerRuntimeThemeReflow();
            ensureDockerRuntimeWidthDebugPanel();
            targets.headers.forEach((header, idx) => {
                const columnIndex = idx + 1;
                header.classList.remove('fvplus-runtime-resizable');
                header.classList.toggle('fvplus-runtime-app-col', columnIndex === 1);
                const existingHandle = header.querySelector('.fvplus-runtime-col-resizer');
                if (existingHandle) {
                    existingHandle.remove();
                }
            });
            if (options?.scheduleReflow !== false) {
                scheduleDockerRuntimeWidthReflow('table-bind', 0);
            }
        };

        const bindDockerRuntimeAppColumnResizer = () => bindDockerRuntimeColumnResizers();

        const readCachedAppWidth = (mode) => dockerRuntimeColumnLayoutEngine?.readCachedWidth?.(mode) || null;
        const setAutoAppWidthFloor = (value, mode = null) => {
            controllerState.autoAppWidthFloor = Number.isFinite(Number(value)) ? Number(value) : null;
            if (mode !== null) {
                controllerState.autoAppWidthFloorMode = String(mode || '').trim() || null;
            }
            return controllerState.autoAppWidthFloor;
        };
        const dispose = () => {
            if (dockerRuntimeWidthState.debounceTimer !== null) {
                window.clearTimeout(dockerRuntimeWidthState.debounceTimer);
                dockerRuntimeWidthState.debounceTimer = null;
            }
            if (dockerRuntimeWidthState.stabilizationTimer !== null) {
                window.clearTimeout(dockerRuntimeWidthState.stabilizationTimer);
                dockerRuntimeWidthState.stabilizationTimer = null;
            }
            if (controllerState.resizerBindTimer !== null) {
                window.clearTimeout(controllerState.resizerBindTimer);
                controllerState.resizerBindTimer = null;
            }
            if (controllerState.resizerRetryTimer !== null) {
                window.clearTimeout(controllerState.resizerRetryTimer);
                controllerState.resizerRetryTimer = null;
            }
            controllerState.resizerObserver?.disconnect?.();
            controllerState.resizerObserver = null;
            dockerRuntimeThemeReflowController?.dispose?.();
        };

        return Object.freeze({
            adjustDockerRuntimeAppWidthForRenderedOverflow,
            applyDockerRuntimeAppColumnInlineWidth,
            applyDockerRuntimeAppWidthVariables,
            applyDockerRuntimeColumnWidths,
            applyDockerRuntimeGapContract,
            applyDockerRuntimeResolvedThemeTokens,
            beginDockerRuntimeWidthBootstrap,
            bindDockerRuntimeAppColumnResizer,
            bindDockerRuntimeColumnResizers,
            bindDockerRuntimeThemeReflow,
            bindDockerRuntimeViewportWidthSync,
            buildDockerRuntimeWidthDecision,
            clampDockerRuntimeColumnWidth,
            completeDockerRuntimeWidthBootstrap,
            dispose,
            ensureDockerRuntimeWidthDebugPanel,
            estimateDockerRuntimeAutoAppWidth,
            getDockerRuntimeAppColumnMode,
            getDockerRuntimePresetAppWidth,
            getDockerRuntimeTableTargets,
            isDockerRuntimeWidthBootstrapActive,
            primeDockerRuntimeAppWidthBeforeRender,
            queueDockerRuntimeResizerBind,
            readCachedAppWidth,
            readDockerRuntimeGapMetrics,
            runDockerRuntimeWidthReflow,
            scheduleDockerRuntimeWidthReflow,
            setAutoAppWidthFloor,
            setDockerRuntimeWidthDebugEnabled
        });
    };

    return Object.freeze({ createController });
}));
