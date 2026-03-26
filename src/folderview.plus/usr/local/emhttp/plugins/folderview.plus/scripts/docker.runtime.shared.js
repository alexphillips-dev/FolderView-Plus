// @ts-check
(function fvplusDockerRuntimeSharedScope(window) {
    'use strict';

    const folderContract = window.FolderViewPlusFolderContract || null;
    const runtimeJquery = window.jQuery || window.$ || null;

    /**
     * @template T
     * @param {T} value
     * @returns {T}
     */
    const clonePlain = (value) => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        return /** @type {T} */ ({ ...value });
    };

    const DEFAULT_FOLDER_STATUS_COLORS = folderContract?.DEFAULT_FOLDER_STATUS_COLORS || Object.freeze({
        started: '#ffffff',
        paused: '#b8860b',
        stopped: '#ff4d4d'
    });
    const DEFAULT_PREVIEW_BORDER_COLOR = folderContract?.DEFAULT_PREVIEW_BORDER_COLOR || '#afa89e';
    const DEFAULT_PREVIEW_BORDER_WIDTH = folderContract?.DEFAULT_PREVIEW_BORDER_WIDTH || 1;
    const DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH = folderContract?.DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH || 1;
    const DEFAULT_DROPDOWN_STYLE = folderContract?.DEFAULT_DROPDOWN_STYLE || 'minimal';
    const DEFAULT_DROPDOWN_COLOR = folderContract?.DEFAULT_DROPDOWN_COLOR || '#ff9a3c';
    const DEFAULT_DROPDOWN_HOVER_COLOR = folderContract?.DEFAULT_DROPDOWN_HOVER_COLOR || '#111111';
    const SUPPORTED_DROPDOWN_STYLES = folderContract?.SUPPORTED_DROPDOWN_STYLES || Object.freeze(['minimal', 'boxed', 'ghost', 'pill', 'filled']);
    const FOLDER_STATUS_COLOR_STYLE_PROPS = Object.freeze({
        started: '--fvplus-folder-status-started',
        paused: '--fvplus-folder-status-paused',
        stopped: '--fvplus-folder-status-stopped'
    });

    const normalizeStatusHexColor = typeof folderContract?.normalizeHexColor === 'function'
        ? folderContract.normalizeHexColor
        : ((value, fallback) => {
            if (typeof value !== 'string') {
                return fallback;
            }
            const trimmed = value.trim();
            if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
                return fallback;
            }
            if (trimmed.length === 4) {
                return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
            }
            return trimmed.toLowerCase();
        });

    const normalizePositiveInt = typeof folderContract?.normalizePositiveInt === 'function'
        ? folderContract.normalizePositiveInt
        : ((value, fallback, min = 1, max = 4) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
                return fallback;
            }
            return Math.max(min, Math.min(max, Math.round(parsed)));
        });

    const extractDropdownStyleValue = typeof folderContract?.extractDropdownStyleValue === 'function'
        ? folderContract.extractDropdownStyleValue
        : ((value) => {
            if (value && typeof value === 'object') {
                return value.dropdown_style
                    ?? value.dropdownStyle
                    ?? value.chevron_style
                    ?? value.chevronStyle
                    ?? '';
            }
            return value;
        });

    const normalizeDropdownStyle = typeof folderContract?.normalizeDropdownStyle === 'function'
        ? folderContract.normalizeDropdownStyle
        : ((value) => {
            const normalized = String(extractDropdownStyleValue(value) || '').trim().toLowerCase();
            return SUPPORTED_DROPDOWN_STYLES.includes(normalized)
                ? normalized
                : DEFAULT_DROPDOWN_STYLE;
        });

    const getDropdownStyleTokens = typeof folderContract?.getDropdownStyleTokens === 'function'
        ? ((style, normalColor, hoverColor) => {
            const tokens = folderContract.getDropdownStyleTokens(style, normalColor, hoverColor);
            return {
                borderWidth: style === 'minimal' ? '0px' : '1px',
                borderColor: tokens.border,
                hoverBorderColor: tokens.hoverBorder,
                background: tokens.background,
                hoverBackground: tokens.hoverBackground,
                minWidth: tokens.minWidth,
                height: tokens.height,
                padding: tokens.padding,
                radius: tokens.radius,
                shadow: tokens.shadow,
                hoverShadow: tokens.hoverShadow
            };
        })
        : ((style, normalColor, hoverColor) => {
            const hexToRgba = (hex, alpha) => {
                const normalized = normalizeStatusHexColor(hex, DEFAULT_DROPDOWN_COLOR);
                const safeAlpha = Number.isFinite(Number(alpha)) ? Math.max(0, Math.min(1, Number(alpha))) : 1;
                const value = normalized.slice(1);
                const r = parseInt(value.slice(0, 2), 16);
                const g = parseInt(value.slice(2, 4), 16);
                const b = parseInt(value.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
            };
            switch (style) {
                case 'boxed':
                    return { borderWidth: '1px', borderColor: hexToRgba(normalColor, 0.52), hoverBorderColor: hoverColor, background: hexToRgba(normalColor, 0.10), hoverBackground: hexToRgba(normalColor, 0.82), minWidth: '22px', height: '22px', padding: '0 6px', radius: '4px', shadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)', hoverShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)' };
                case 'ghost':
                    return { borderWidth: '1px', borderColor: 'transparent', hoverBorderColor: hoverColor, background: 'transparent', hoverBackground: hexToRgba(normalColor, 0.08), minWidth: '20px', height: '20px', padding: '0 5px', radius: '4px', shadow: 'none', hoverShadow: 'none' };
                case 'pill':
                    return { borderWidth: '1px', borderColor: hexToRgba(normalColor, 0.42), hoverBorderColor: hoverColor, background: hexToRgba(normalColor, 0.10), hoverBackground: hexToRgba(normalColor, 0.18), minWidth: '24px', height: '20px', padding: '0 7px', radius: '999px', shadow: 'none', hoverShadow: 'none' };
                case 'filled':
                    return { borderWidth: '1px', borderColor: hexToRgba(normalColor, 0.65), hoverBorderColor: hoverColor, background: hexToRgba(normalColor, 0.22), hoverBackground: hexToRgba(normalColor, 0.34), minWidth: '22px', height: '22px', padding: '0 6px', radius: '4px', shadow: 'none', hoverShadow: 'none' };
                case 'minimal':
                default:
                    return { borderWidth: '0px', borderColor: 'transparent', hoverBorderColor: 'transparent', background: 'transparent', hoverBackground: 'transparent', minWidth: '12px', height: '16px', padding: '0 2px', radius: '0px', shadow: 'none', hoverShadow: 'none' };
            }
        });

    const isPreviewBorderEnabled = typeof folderContract?.isPreviewBorderEnabled === 'function'
        ? folderContract.isPreviewBorderEnabled
        : ((settings) => {
            const source = settings && typeof settings === 'object' ? settings : {};
            if (Object.prototype.hasOwnProperty.call(source, 'preview_border')) {
                const raw = String(source.preview_border ?? '').trim().toLowerCase();
                const explicitOff = raw === '0' || raw === 'false' || raw === 'off' || raw === 'no';
                return !explicitOff;
            }
            return true;
        });

    const getFolderStatusColors = (settings) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        return {
            started: normalizeStatusHexColor(source.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started),
            paused: normalizeStatusHexColor(source.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused),
            stopped: normalizeStatusHexColor(source.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped)
        };
    };

    const getFolderStatusColorOverrides = (settings) => {
        const colors = getFolderStatusColors(settings);
        return {
            started: colors.started !== DEFAULT_FOLDER_STATUS_COLORS.started ? colors.started : '',
            paused: colors.paused !== DEFAULT_FOLDER_STATUS_COLORS.paused ? colors.paused : '',
            stopped: colors.stopped !== DEFAULT_FOLDER_STATUS_COLORS.stopped ? colors.stopped : ''
        };
    };

    const applyFolderStatusColorOverrides = ($folderRow, settings) => {
        if (!$folderRow || !$folderRow.length || !$folderRow[0] || !$folderRow[0].style) {
            return;
        }
        const style = $folderRow[0].style;
        const overrides = getFolderStatusColorOverrides(settings);
        style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.started);
        style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.paused);
        style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.stopped);
        if (overrides.started) {
            style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.started, overrides.started);
        }
        if (overrides.paused) {
            style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.paused, overrides.paused);
        }
        if (overrides.stopped) {
            style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.stopped, overrides.stopped);
        }
    };

    const applyPreviewBorderStyle = (previewNode, settings) => {
        if (!previewNode) {
            return;
        }
        const source = settings && typeof settings === 'object' ? settings : {};
        const enabled = isPreviewBorderEnabled(source);
        if (previewNode.classList && typeof previewNode.classList.toggle === 'function') {
            previewNode.classList.toggle('fv-preview-border-off', !enabled);
        }
        const previewColor = normalizeStatusHexColor(source.preview_border_color, DEFAULT_PREVIEW_BORDER_COLOR);
        const previewBorderWidth = normalizePositiveInt(source.preview_border_width, DEFAULT_PREVIEW_BORDER_WIDTH, 1, 4);
        const previewBarsWidth = normalizePositiveInt(source.preview_vertical_bars_width, DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH, 1, 4);
        previewNode.style.setProperty('--fvplus-preview-border-width', `${previewBorderWidth}px`);
        previewNode.style.setProperty('--fvplus-preview-divider-width', `${previewBarsWidth}px`);
        previewNode.style.setProperty('border', enabled ? `${previewBorderWidth}px solid ${previewColor}` : 'none', 'important');
    };

    const getPreviewRowLimitValue = (settings = {}) => (
        settings?.preview_rows
        ?? settings?.previewRows
        ?? ''
    );

    const normalizeFolderPreviewRowLimit = (settings = {}) => {
        const raw = String(getPreviewRowLimitValue(settings)).trim().toLowerCase();
        if (raw === '0' || raw === 'auto' || raw === 'unlimited') {
            return 0;
        }
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) {
            return 1;
        }
        return Math.max(1, Math.min(4, parsed));
    };

    const isCompactMultiRowPreview = (settings = {}) => {
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        return normalizedRows === 0 || normalizedRows > 1;
    };

    const applyFolderPreviewLayout = ($preview, settings = {}) => {
        if (!$preview || !$preview.length) {
            return;
        }
        const previewNode = $preview.get(0);
        if (!previewNode || !previewNode.style) {
            return;
        }
        previewNode.dataset.previewRows = String(normalizeFolderPreviewRowLimit(settings));
        previewNode.style.removeProperty('--fvplus-preview-row-limit');
        previewNode.style.removeProperty('--fvplus-preview-max-height');
        previewNode.classList.remove('fv-preview-unlimited-rows', 'fv-preview-multirow');
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        if (normalizedRows === 0) {
            previewNode.classList.add('fv-preview-unlimited-rows', 'fv-preview-multirow');
        } else if (normalizedRows > 1) {
            previewNode.classList.add('fv-preview-multirow');
        }
    };

    const flattenPreviewWrappers = ($preview) => {
        if (!$preview || !$preview.length) {
            return [];
        }
        const $existingRows = $preview.children('.folder-preview-row');
        if ($existingRows.length) {
            $existingRows.children('.folder-preview-wrapper, .folder-preview-divider').appendTo($preview);
            $existingRows.remove();
        }
        const wrappers = $preview.children('.folder-preview-wrapper').get();
        $preview.children('.folder-preview-divider').remove();
        return wrappers;
    };

    const restoreLinearPreviewLayout = ($preview, settings = {}) => {
        const wrappers = flattenPreviewWrappers($preview);
        if (!settings?.preview_vertical_bars || !runtimeJquery) {
            return wrappers;
        }
        const barsColor = settings?.preview_vertical_bars_color || settings?.preview_border_color || '';
        wrappers.forEach((wrapper, index) => {
            if (index < wrappers.length - 1) {
                runtimeJquery(wrapper).after(`<div class="folder-preview-divider" ${barsColor ? `style="border-color: ${barsColor};"` : ''}></div>`);
            }
        });
        return wrappers;
    };

    const finalizePreviewRows = ($preview, rowSlices = [], settings = {}) => {
        if (!$preview || !$preview.length) {
            return;
        }
        const addDividers = settings?.preview_vertical_bars === true;
        const barsColor = settings?.preview_vertical_bars_color || settings?.preview_border_color || '';
        $preview.empty();
        rowSlices.forEach((slice) => {
            const $row = runtimeJquery ? runtimeJquery('<div class="folder-preview-row"></div>') : null;
            if (!$row || !$row.length) {
                return;
            }
            slice.forEach((wrapper, index) => {
                $row.append(wrapper);
                if (addDividers && index < slice.length - 1) {
                    $row.append(`<div class="folder-preview-divider" ${barsColor ? `style="border-color: ${barsColor};"` : ''}></div>`);
                }
            });
            $preview.append($row);
        });
    };

    const applyFolderDropdownStyle = ($folderRow, settings) => {
        if (!$folderRow || !$folderRow.length || !$folderRow[0] || !$folderRow[0].style) {
            return;
        }
        const source = settings && typeof settings === 'object' ? settings : {};
        const rowStyle = $folderRow[0].style;
        const dropdownStyle = normalizeDropdownStyle(source);
        const normalColor = normalizeStatusHexColor(source.dropdown_color, DEFAULT_DROPDOWN_COLOR);
        const hoverColor = normalizeStatusHexColor(source.dropdown_hover_color, DEFAULT_DROPDOWN_HOVER_COLOR);
        const tokens = getDropdownStyleTokens(dropdownStyle, normalColor, hoverColor);
        rowStyle.setProperty('--fvplus-folder-dropdown-color', normalColor);
        rowStyle.setProperty('--fvplus-folder-dropdown-hover-color', hoverColor);
        rowStyle.setProperty('--fvplus-folder-dropdown-border-width', tokens.borderWidth);
        rowStyle.setProperty('--fvplus-folder-dropdown-border-color', tokens.borderColor);
        rowStyle.setProperty('--fvplus-folder-dropdown-hover-border-color', tokens.hoverBorderColor);
        rowStyle.setProperty('--fvplus-folder-dropdown-bg', tokens.background);
        rowStyle.setProperty('--fvplus-folder-dropdown-hover-bg', tokens.hoverBackground);
        rowStyle.setProperty('--fvplus-folder-dropdown-min-width', tokens.minWidth);
        rowStyle.setProperty('--fvplus-folder-dropdown-height', tokens.height);
        rowStyle.setProperty('--fvplus-folder-dropdown-padding', tokens.padding);
        rowStyle.setProperty('--fvplus-folder-dropdown-radius', tokens.radius);
        rowStyle.setProperty('--fvplus-folder-dropdown-shadow', tokens.shadow);
        rowStyle.setProperty('--fvplus-folder-dropdown-hover-shadow', tokens.hoverShadow);
    };

    /**
     * Lightweight runtime store for Docker tab state.
     * @param {Record<string, any>} initialState
     */
    const createRuntimeStateStore = (initialState = {}) => {
        let state = clonePlain(initialState);
        const listeners = new Set();

        const notify = (nextState, prevState, patch) => {
            listeners.forEach((listener) => {
                try {
                    listener(nextState, prevState, patch);
                } catch (error) {
                    console.error('folderview.plus: runtime store listener failed', error);
                }
            });
        };

        return {
            getState: () => clonePlain(state),
            get: (key, fallback = undefined) => (
                Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback
            ),
            set: (patch = {}) => {
                if (!patch || typeof patch !== 'object') {
                    return clonePlain(state);
                }
                const previous = clonePlain(state);
                const next = clonePlain(state);
                let changed = false;
                Object.entries(patch).forEach(([key, value]) => {
                    if (next[key] !== value) {
                        next[key] = value;
                        changed = true;
                    }
                });
                if (!changed) {
                    return clonePlain(state);
                }
                state = next;
                notify(clonePlain(state), previous, clonePlain(patch));
                return clonePlain(state);
            },
            subscribe: (listener) => {
                if (typeof listener !== 'function') {
                    return () => {};
                }
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        };
    };

    /**
     * Async action wrapper with uniform error routing.
     * @param {{prefix?: string, onError?: (actionName: string, error: Error, context?: any) => void}} options
     */
    const createAsyncActionBoundary = (options = {}) => {
        const prefix = String(options.prefix || 'folderview.plus');
        const onError = typeof options.onError === 'function'
            ? options.onError
            : (actionName, error) => console.error(`${prefix}: ${actionName} failed`, error);
        return {
            run: async (actionName, action, context = {}) => {
                if (typeof action !== 'function') {
                    return { ok: false, error: new Error('Action handler must be a function') };
                }
                try {
                    const value = await action();
                    return { ok: true, value };
                } catch (rawError) {
                    const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                    onError(String(actionName || 'action'), error, context);
                    return { ok: false, error };
                }
            }
        };
    };

    const normalizeLabel = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

    /**
     * Context-menu adapter for icon-only top quick actions.
     * It matches quick items by either label or icon class to stay resilient to markup changes.
     * @param {{
     *  menuClassName?: string,
     *  quickItemClassName?: string,
     *  clearClassName?: string,
     *  labelSet?: Set<string>,
     *  iconClassCandidates?: string[],
     *  selectors?: string[]
     * }} options
     */
    const createContextMenuQuickStripAdapter = (options = {}) => {
        const menuClassName = String(options.menuClassName || 'fvplus-docker-context-menu');
        const quickItemClassName = String(options.quickItemClassName || 'fvplus-docker-quick-item');
        const clearClassName = String(options.clearClassName || 'fvplus-docker-quick-clear');
        const labelSet = options.labelSet instanceof Set ? options.labelSet : new Set();
        const iconClassCandidates = Array.isArray(options.iconClassCandidates) ? options.iconClassCandidates : [];
        const selectors = Array.isArray(options.selectors) && options.selectors.length
            ? options.selectors
            : [
                'ul.context-menu-list:visible',
                'ul.contextMenuPlugin:visible',
                'ul.context-menu:visible',
                'ul.dropdown-menu:visible'
            ];

        const findVisibleMenu = () => {
            const $ = window.jQuery || window.$;
            if (!$) {
                return null;
            }
            for (const selector of selectors) {
                const menus = $(selector);
                for (let idx = menus.length - 1; idx >= 0; idx -= 1) {
                    const $menu = $(menus.get(idx));
                    if (!$menu || !$menu.length) {
                        continue;
                    }
                    return $menu;
                }
            }
            return null;
        };

        const isQuickItem = ($item) => {
            const text = normalizeLabel($item.text());
            if (labelSet.has(text)) {
                return true;
            }
            const icon = $item.find('i.fa').first();
            if (!icon.length) {
                return false;
            }
            for (const iconClass of iconClassCandidates) {
                if (icon.hasClass(iconClass)) {
                    return true;
                }
            }
            return false;
        };

        const enhance = () => {
            const $ = window.jQuery || window.$;
            if (!$) {
                return false;
            }
            const $menu = findVisibleMenu();
            if (!$menu || !$menu.length) {
                return false;
            }
            const $quickItems = $menu.children('li').filter((_, item) => isQuickItem($(item))).slice(0, 3);
            if ($quickItems.length < 3) {
                return false;
            }
            $menu.addClass(menuClassName);
            $quickItems.each((_, item) => {
                const $item = $(item);
                const label = String($item.text() || '').trim().replace(/\s+/g, ' ');
                $item.addClass(quickItemClassName);
                const $interactive = $item.find('a, .context-menu-item').first();
                if ($interactive.length) {
                    $interactive.attr('title', label);
                    $interactive.attr('aria-label', label);
                } else {
                    $item.attr('title', label);
                    $item.attr('aria-label', label);
                }
            });
            const $firstNonQuick = $menu.children('li').not(`.${quickItemClassName}`).first();
            if ($firstNonQuick.length) {
                $firstNonQuick.addClass(clearClassName);
            }
            return true;
        };

        const queueEnhance = (attempt = 0) => {
            if (enhance()) {
                return;
            }
            const safeAttempt = Number.isFinite(Number(attempt)) ? Number(attempt) : 0;
            if (safeAttempt >= 8) {
                return;
            }
            window.setTimeout(() => queueEnhance(safeAttempt + 1), 18 * (safeAttempt + 1));
        };

        return {
            enhance,
            queueEnhance
        };
    };

    /**
     * Structured perf telemetry for action-level timing.
     * @param {string} namespace
     * @param {boolean} enabled
     */
    const createRuntimePerfTelemetry = (namespace = 'folderview-plus.docker', enabled = false) => {
        const on = Boolean(enabled && typeof performance !== 'undefined');
        const marks = new Map();
        const aggregates = new Map();
        const begin = (name) => {
            if (!on) return;
            marks.set(String(name || ''), performance.now());
        };
        const end = (name, metadata = {}) => {
            if (!on) return 0;
            const key = String(name || '');
            const start = marks.get(key);
            if (typeof start !== 'number') return 0;
            const elapsed = performance.now() - start;
            marks.delete(key);
            const prev = aggregates.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
            const next = {
                count: prev.count + 1,
                totalMs: prev.totalMs + elapsed,
                maxMs: Math.max(prev.maxMs, elapsed)
            };
            aggregates.set(key, next);
            console.debug(`[FV_PERF][${namespace}] ${key}: ${elapsed.toFixed(2)}ms`, metadata);
            return elapsed;
        };
        const snapshot = () => {
            const rows = {};
            aggregates.forEach((entry, key) => {
                rows[key] = {
                    count: entry.count,
                    totalMs: Number(entry.totalMs.toFixed(2)),
                    avgMs: Number((entry.totalMs / Math.max(1, entry.count)).toFixed(2)),
                    maxMs: Number(entry.maxMs.toFixed(2))
                };
            });
            return rows;
        };
        return { enabled: on, begin, end, snapshot };
    };

    const runtimeContracts = Object.freeze({
        folderLabelKeys: Object.freeze(['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view']),
        performance: Object.freeze({
            strictFolderCount: 34,
            strictItemCount: 220,
            strictExpandRestoreLimit: 8,
            strictLiveRefreshSeconds: 30
        })
    });

    /**
     * Resolves effective runtime performance profile for large installs.
     * @param {{performanceMode?: boolean}} prefs
     * @param {{folderCount?: number, itemCount?: number}} counts
     * @param {{strictFolderCount?: number, strictItemCount?: number, strictExpandRestoreLimit?: number, strictLiveRefreshSeconds?: number}} overrides
     */
    const resolveRuntimePerformanceProfile = (prefs = {}, counts = {}, overrides = {}) => {
        const perf = runtimeContracts.performance;
        const performanceMode = prefs?.performanceMode === true;
        const folderCount = Math.max(0, Number(counts?.folderCount || 0));
        const itemCount = Math.max(0, Number(counts?.itemCount || 0));
        const strictFolderCount = Math.max(1, Number(overrides.strictFolderCount || perf.strictFolderCount));
        const strictItemCount = Math.max(1, Number(overrides.strictItemCount || perf.strictItemCount));
        const strictExpandRestoreLimit = Math.max(1, Number(overrides.strictExpandRestoreLimit || perf.strictExpandRestoreLimit));
        const strictLiveRefreshSeconds = Math.max(10, Number(overrides.strictLiveRefreshSeconds || perf.strictLiveRefreshSeconds));
        const strict = performanceMode && (folderCount >= strictFolderCount || itemCount >= strictItemCount);
        return Object.freeze({
            performanceMode,
            strict,
            folderCount,
            itemCount,
            strictFolderCount,
            strictItemCount,
            expandRestoreLimit: strict ? strictExpandRestoreLimit : null,
            minLiveRefreshSeconds: strict ? strictLiveRefreshSeconds : null
        });
    };

    /**
     * Deduplicates UI-triggered async actions by key to avoid racey double-click behavior.
     * @param {{onError?: (error: Error, actionKey: string) => void, onBusy?: (actionKey: string) => void}} options
     */
    const createSafeUiActionRunner = (options = {}) => {
        const inFlight = new Set();
        const onError = typeof options.onError === 'function'
            ? options.onError
            : (error, actionKey) => console.error(`folderview.plus: safe ui action failed (${actionKey})`, error);
        const onBusy = typeof options.onBusy === 'function' ? options.onBusy : null;
        return {
            isRunning: (actionKey) => inFlight.has(String(actionKey || '')),
            run: async (actionKey, action) => {
                const key = String(actionKey || '').trim() || 'action';
                if (inFlight.has(key)) {
                    if (onBusy) {
                        onBusy(key);
                    }
                    return { ok: false, skipped: true, reason: 'in-flight' };
                }
                if (typeof action !== 'function') {
                    return { ok: false, skipped: true, reason: 'invalid-action' };
                }
                inFlight.add(key);
                try {
                    const value = await action();
                    return { ok: true, value };
                } catch (rawError) {
                    const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                    onError(error, key);
                    return { ok: false, error };
                } finally {
                    inFlight.delete(key);
                }
            }
        };
    };

    const createDebugLogger = (enabled = false, namespace = 'folderview.plus') => {
        const shouldLog = enabled === true;
        const prefix = String(namespace || 'folderview.plus').trim() || 'folderview.plus';
        const emit = (method, args) => {
            if (!shouldLog || typeof console?.[method] !== 'function') {
                return;
            }
            console[method](`[${prefix}]`, ...args);
        };
        return Object.freeze({
            log: (...args) => emit('log', args),
            warn: (...args) => emit('warn', args),
            error: (...args) => emit('error', args)
        });
    };

    const layoutTokens = Object.freeze({
        folderRightGutterPx: 28,
        folderOuterReservedPx: 106,
        folderDropdownRightMarginPx: 16,
        contextQuickItemWidthPx: 34,
        contextQuickLinkWidthPx: 30,
        contextQuickLinkHeightPx: 26
    });

    window.FolderViewDockerRuntimeShared = {
        DEFAULT_FOLDER_STATUS_COLORS,
        DEFAULT_PREVIEW_BORDER_COLOR,
        DEFAULT_PREVIEW_BORDER_WIDTH,
        DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,
        DEFAULT_DROPDOWN_STYLE,
        DEFAULT_DROPDOWN_COLOR,
        DEFAULT_DROPDOWN_HOVER_COLOR,
        FOLDER_STATUS_COLOR_STYLE_PROPS,
        normalizeStatusHexColor,
        normalizePositiveInt,
        normalizeDropdownStyle,
        isPreviewBorderEnabled,
        getFolderStatusColors,
        getFolderStatusColorOverrides,
        applyFolderStatusColorOverrides,
        applyPreviewBorderStyle,
        getPreviewRowLimitValue,
        normalizeFolderPreviewRowLimit,
        isCompactMultiRowPreview,
        applyFolderPreviewLayout,
        flattenPreviewWrappers,
        restoreLinearPreviewLayout,
        finalizePreviewRows,
        applyFolderDropdownStyle,
        createRuntimeStateStore,
        createAsyncActionBoundary,
        createContextMenuQuickStripAdapter,
        createRuntimePerfTelemetry,
        createSafeUiActionRunner,
        createDebugLogger,
        resolveRuntimePerformanceProfile,
        runtimeContracts,
        layoutTokens
    };
})(window);
