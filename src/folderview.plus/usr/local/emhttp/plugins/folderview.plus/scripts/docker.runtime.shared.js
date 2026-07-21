// @ts-check
(function fvplusDockerRuntimeSharedScope(window) {
    'use strict';

    const folderContract = window.FolderViewPlusFolderContract || null;
    const runtimeJquery = window.jQuery || window.$ || null;
    const pluginRequestClient = window.FolderViewPlusRequest || null;

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
    const DEFAULT_FOLDER_ACCENT_COLOR = folderContract?.DEFAULT_FOLDER_ACCENT_COLOR || '#ffca63';
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

    const isFolderAccentEnabled = typeof folderContract?.isFolderAccentEnabled === 'function'
        ? folderContract.isFolderAccentEnabled
        : ((settings) => settings?.folder_accent_enabled === true);

    const getFolderAccentColor = (settings) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        return normalizeStatusHexColor(source.folder_accent_color, DEFAULT_FOLDER_ACCENT_COLOR);
    };

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

    const previewBorderGlowShadow = (hexColor) => {
        const normalized = normalizeStatusHexColor(hexColor, DEFAULT_PREVIEW_BORDER_COLOR);
        const r = parseInt(normalized.slice(1, 3), 16);
        const g = parseInt(normalized.slice(3, 5), 16);
        const b = parseInt(normalized.slice(5, 7), 16);
        return `0 0 8px rgba(${r}, ${g}, ${b}, 0.52), 0 0 16px rgba(${r}, ${g}, ${b}, 0.34)`;
    };

    const applyFolderStatusColorOverrides = ($folderRow, settings) => {
        if (!$folderRow || !$folderRow.length || !$folderRow[0] || !$folderRow[0].style) {
            return;
        }
        const style = $folderRow[0].style;
        const overrides = getFolderStatusColorOverrides(settings);
        const locked = settings?.status_color_lock === true || settings?.statusColorLock === true;
        style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.started);
        style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.paused);
        style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.stopped);
        if (overrides.started || locked) {
            style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.started, overrides.started || getFolderStatusColors(settings).started, locked ? 'important' : '');
        }
        if (overrides.paused || locked) {
            style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.paused, overrides.paused || getFolderStatusColors(settings).paused, locked ? 'important' : '');
        }
        if (overrides.stopped || locked) {
            style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.stopped, overrides.stopped || getFolderStatusColors(settings).stopped, locked ? 'important' : '');
        }
    };

    const applyFolderAccentStyle = ($folderRow, settings) => {
        if (!$folderRow || !$folderRow.length || !$folderRow[0] || !$folderRow[0].style) {
            return;
        }
        const enabled = isFolderAccentEnabled(settings);
        const style = $folderRow[0].style;
        $folderRow.toggleClass('fv-folder-has-accent', enabled);
        style.removeProperty('--fv-folder-accent-color');
        if (enabled) {
            style.setProperty('--fv-folder-accent-color', getFolderAccentColor(settings));
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
        const glowEnabled = enabled && (source.preview_border_glow === true || source.previewBorderGlow === true);
        previewNode.style.setProperty('--fvplus-preview-border-width', `${previewBorderWidth}px`);
        previewNode.style.setProperty('--fvplus-preview-divider-width', `${previewBarsWidth}px`);
        previewNode.style.setProperty('border', enabled ? `${previewBorderWidth}px solid ${previewColor}` : 'none', 'important');
        previewNode.style.setProperty('box-shadow', glowEnabled ? previewBorderGlowShadow(previewColor) : 'none', 'important');
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

    const normalizeFolderPreviewOverflow = (settings = {}) => {
        const normalized = String(settings?.preview_overflow ?? settings?.previewOverflow ?? '').trim().toLowerCase();
        return ['default', 'expand_row', 'scroll'].includes(normalized) ? normalized : 'default';
    };

    const isCompactMultiRowPreview = (settings = {}) => {
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        return normalizeFolderPreviewOverflow(settings) !== 'default' || normalizedRows === 0 || normalizedRows > 1;
    };

    const normalizePreviewHoverAnimation = (settings = {}) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        const normalized = String(source.preview_hover_animation || source.previewHoverAnimation || '').trim().toLowerCase();
        const aliases = { grow: 'pop', pulse: 'glow', spin: 'flip' };
        const token = aliases[normalized] || normalized;
        return ['lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'].includes(token) ? token : 'none';
    };

    const getPreviewHoverAnimationClass = (settings = {}) => {
        const normalized = normalizePreviewHoverAnimation(settings);
        return normalized === 'none' ? '' : `fv-hover-animation-${normalized}`;
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
        previewNode.classList.remove('fv-preview-unlimited-rows', 'fv-preview-multirow', 'fv-preview-overflow-expand', 'fv-preview-overflow-scroll');
        const overflowMode = normalizeFolderPreviewOverflow(settings);
        previewNode.dataset.previewOverflow = overflowMode;
        if (overflowMode === 'expand_row') {
            previewNode.classList.add('fv-preview-unlimited-rows', 'fv-preview-multirow', 'fv-preview-overflow-expand');
            return;
        }
        if (overflowMode === 'scroll') {
            previewNode.classList.add('fv-preview-overflow-scroll');
            return;
        }
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
        const addRowSeparators = settings?.preview_row_separator === true || settings?.previewRowSeparator === true;
        const rowSeparatorColor = settings?.preview_row_separator_color || settings?.previewRowSeparatorColor || barsColor;
        rowSlices.forEach((slice, rowIndex) => {
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
            if (addRowSeparators && rowIndex < rowSlices.length - 1) {
                const $separator = runtimeJquery('<div class="folder-preview-row-separator" aria-hidden="true"></div>');
                if (rowSeparatorColor) {
                    $separator.css('border-color', rowSeparatorColor);
                }
                $preview.append($separator);
            }
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
        const on = typeof performance !== 'undefined';
        const debug = enabled === true;
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
            if (debug) console.debug(`[FV_PERF][${namespace}] ${key}: ${elapsed.toFixed(2)}ms`, metadata);
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
            standardLiveRefreshSeconds: 10,
            adaptiveLiveRefreshSeconds: 20,
            adaptiveExpandRestoreLimit: 12,
            strictFolderCount: 34,
            strictItemCount: 220,
            strictRenderMs: 140,
            strictExitFolderCount: 30,
            strictExitItemCount: 200,
            strictExitRenderMs: 100,
            strictExpandRestoreLimit: 8,
            strictLiveRefreshSeconds: 30,
            maximumExpandRestoreLimit: 6,
            maximumLiveRefreshSeconds: 45
        })
    });

    const normalizePerformanceProfileMode = (prefs = {}) => {
        const raw = String(prefs?.performanceProfile || '').trim().toLowerCase();
        if (['standard', 'adaptive', 'maximum'].includes(raw)) {
            return raw;
        }
        return prefs?.performanceMode === true ? 'adaptive' : 'standard';
    };

    /**
     * Resolves effective runtime performance profile for large installs.
     * @param {{performanceMode?: boolean}} prefs
     * @param {{folderCount?: number, itemCount?: number}} counts
     * @param {{strictFolderCount?: number, strictItemCount?: number, strictExpandRestoreLimit?: number, strictLiveRefreshSeconds?: number}} overrides
     */
    const resolveRuntimePerformanceProfile = (prefs = {}, counts = {}, overrides = {}) => {
        const perf = runtimeContracts.performance;
        const mode = normalizePerformanceProfileMode(prefs);
        const performanceMode = mode !== 'standard';
        const folderCount = Math.max(0, Number(counts?.folderCount || 0));
        const itemCount = Math.max(0, Number(counts?.itemCount || 0));
        const strictFolderCount = Math.max(1, Number(overrides.strictFolderCount || perf.strictFolderCount));
        const strictItemCount = Math.max(1, Number(overrides.strictItemCount || perf.strictItemCount));
        const renderMs = Math.max(0, Number(counts?.renderMs || 0));
        const previousStrict = counts?.previousStrict === true;
        const strictExpandRestoreLimit = Math.max(1, Number(overrides.strictExpandRestoreLimit || perf.strictExpandRestoreLimit));
        const strictLiveRefreshSeconds = Math.max(10, Number(overrides.strictLiveRefreshSeconds || perf.strictLiveRefreshSeconds));
        const slowRender = renderMs >= Number(perf.strictRenderMs || 140);
        const largeLibrary = folderCount >= strictFolderCount || itemCount >= strictItemCount || slowRender;
        const remainsLarge = previousStrict && (
            folderCount >= Number(perf.strictExitFolderCount || 30)
            || itemCount >= Number(perf.strictExitItemCount || 200)
            || renderMs >= Number(perf.strictExitRenderMs || 100)
        );
        const strict = mode === 'maximum' || (mode === 'adaptive' && (largeLibrary || remainsLarge));
        const requestedRefreshSeconds = Math.max(10, Math.min(300, Number(prefs?.liveRefreshSeconds) || 20));
        const minLiveRefreshSeconds = mode === 'maximum'
            ? Math.max(strictLiveRefreshSeconds, Number(perf.maximumLiveRefreshSeconds || 45))
            : (strict
                ? strictLiveRefreshSeconds
                : (mode === 'adaptive' ? Number(perf.adaptiveLiveRefreshSeconds || 20) : 0));
        const expandRestoreLimit = mode === 'maximum'
            ? Math.max(1, Number(perf.maximumExpandRestoreLimit || 6))
            : (strict
                ? strictExpandRestoreLimit
                : (mode === 'adaptive' ? Number(perf.adaptiveExpandRestoreLimit || 12) : null));
        const deferredPreviews = prefs?.lazyPreviewEnabled === true || strict;
        const reason = mode === 'standard'
            ? 'standard-profile'
            : (mode === 'maximum'
                ? 'maximum-profile'
                : (slowRender ? 'measured-render-cost' : ((largeLibrary || remainsLarge) ? 'large-library' : 'adaptive-profile')));
        return Object.freeze({
            mode,
            performanceMode,
            strict,
            largeLibrary,
            reason,
            folderCount,
            itemCount,
            renderMs,
            previousStrict,
            strictFolderCount,
            strictItemCount,
            reduceMotion: performanceMode,
            previewStrategy: deferredPreviews ? 'deferred' : 'immediate',
            deferredPreviews,
            lazyPreviewThreshold: Math.max(10, Math.min(200, Number(prefs?.lazyPreviewThreshold) || 30)),
            expandRestoreLimit,
            minLiveRefreshSeconds,
            requestedRefreshSeconds,
            effectiveRefreshSeconds: Math.max(requestedRefreshSeconds, minLiveRefreshSeconds || 0)
        });
    };

    /**
     * Defers already-built preview content until its owning row/card approaches the viewport.
     * Folder settings remain immutable; the detached fragment is restored on visibility or interaction.
     */
    const createDeferredPreviewController = (options = {}) => {
        const pending = new Map();
        const rootMargin = String(options.rootMargin || '480px 0px');
        const hydrate = (target) => {
            const entry = pending.get(target);
            if (!entry) return false;
            pending.delete(target);
            observer?.unobserve(target);
            entry.placeholder?.remove();
            target.appendChild(entry.fragment);
            target.classList.remove('fv-preview-deferred');
            target.setAttribute('data-fv-preview-hydrated', '1');
            if (typeof entry.onHydrated === 'function') entry.onHydrated(target);
            return true;
        };
        const observer = typeof window.IntersectionObserver === 'function'
            ? new window.IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting || entry.intersectionRatio > 0) hydrate(entry.target);
                });
            }, { root: null, rootMargin, threshold: 0 })
            : null;
        const defer = (target, metadata = {}) => {
            if (!(target instanceof Element) || pending.has(target) || target.childNodes.length === 0) return false;
            const interactionTarget = metadata.interactionTarget instanceof Element ? metadata.interactionTarget : target;
            if (typeof interactionTarget.getBoundingClientRect === 'function') {
                const rect = interactionTarget.getBoundingClientRect();
                const viewportHeight = Math.max(0, Number(window.innerHeight || document.documentElement?.clientHeight || 0));
                if (viewportHeight > 0 && rect.bottom >= -480 && rect.top <= viewportHeight + 480) return false;
            }
            const fragment = document.createDocumentFragment();
            while (target.firstChild) fragment.appendChild(target.firstChild);
            const placeholder = document.createElement('span');
            placeholder.className = 'fv-preview-deferred-placeholder';
            placeholder.textContent = String(metadata.placeholder || 'Preview loads when visible');
            target.appendChild(placeholder);
            target.classList.add('fv-preview-deferred');
            target.setAttribute('data-fv-preview-hydrated', '0');
            pending.set(target, { fragment, placeholder, onHydrated: metadata.onHydrated });
            const hydrateOnInteraction = () => hydrate(target);
            interactionTarget.addEventListener('pointerenter', hydrateOnInteraction, { once: true, passive: true });
            interactionTarget.addEventListener('focusin', hydrateOnInteraction, { once: true });
            interactionTarget.addEventListener('click', hydrateOnInteraction, { once: true });
            if (observer) observer.observe(target);
            else window.setTimeout(() => hydrate(target), 0);
            return true;
        };
        const flush = () => Array.from(pending.keys()).forEach((target) => hydrate(target));
        const snapshot = () => Object.freeze({ pending: pending.size, rootMargin });
        const disconnect = () => {
            flush();
            observer?.disconnect();
        };
        return Object.freeze({ defer, hydrate, flush, snapshot, disconnect });
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

    const createRuntimeDiagnosticsBridge = (options = {}) => {
        const fatalBanner = window.FolderViewPlusFatalBanner || null;
        const runtimeContext = options.runtimeContext && typeof options.runtimeContext === 'object'
            ? options.runtimeContext
            : {};
        const context = String(options.context || runtimeContext.page || 'Runtime').trim() || 'Runtime';
        const hostSelector = String(options.hostSelector || runtimeContext.hostSelector || 'body').trim() || 'body';
        const codePrefix = String(options.codePrefix || 'FVPLUS-RUN').trim() || 'FVPLUS-RUN';
        const defaultFatalTitle = String(options.fatalTitle || `${context} runtime failed`).trim() || `${context} runtime failed`;
        const defaultFatalMessage = String(options.fatalMessage || `FolderView Plus could not finish rendering folders on the ${context.toLowerCase()} page.`).trim()
            || `FolderView Plus could not finish rendering folders on the ${context.toLowerCase()} page.`;
        const defaultDegradedTitle = String(options.degradedTitle || `${context} page loaded in degraded mode`).trim() || `${context} page loaded in degraded mode`;
        const defaultDegradedMessage = String(options.degradedMessage || `FolderView Plus kept the ${context.toLowerCase()} page open, but part of the folder runtime did not load.`).trim()
            || `FolderView Plus kept the ${context.toLowerCase()} page open, but part of the folder runtime did not load.`;
        const trimDiagnostic = (value) => String(value ?? '').trim();
        const setEnvironment = (patch = {}) => {
            if (!fatalBanner || typeof fatalBanner.setEnvironment !== 'function') {
                return;
            }
            fatalBanner.setEnvironment({
                page: context,
                pluginVersion: trimDiagnostic(runtimeContext.pluginVersion || 'unknown') || 'unknown',
                channel: trimDiagnostic(runtimeContext.channel || 'unknown') || 'unknown',
                unraidVersion: trimDiagnostic(runtimeContext.unraidVersion || 'unknown') || 'unknown',
                url: trimDiagnostic(window.location?.href || ''),
                userAgent: trimDiagnostic(window.navigator?.userAgent || ''),
                ...patch
            });
        };
        const extractTraceId = (error) => {
            const jqXhrTrace = trimDiagnostic(
                typeof error?.jqXHR?.getResponseHeader === 'function'
                    ? error.jqXHR.getResponseHeader('X-FV-Trace')
                    : ''
            );
            if (jqXhrTrace) {
                return jqXhrTrace;
            }
            const direct = trimDiagnostic(error?.traceId);
            if (direct) {
                return direct;
            }
            const message = trimDiagnostic(error?.message || error);
            const match = message.match(/\(trace:\s*([^)]+)\)/i);
            return match ? trimDiagnostic(match[1]) : '';
        };
        const extractStatus = (error) => {
            const direct = Number(error?.jqXHR?.status || error?.status || 0);
            if (Number.isFinite(direct) && direct > 0) {
                return String(direct);
            }
            const message = trimDiagnostic(error?.message || error);
            const match = message.match(/\bHTTP\s+(\d{3})\b/i);
            return match ? trimDiagnostic(match[1]) : '';
        };
        const extractResponseSnippet = (error) => {
            const responseText = trimDiagnostic(error?.jqXHR?.responseText || error?.responseText || '');
            if (!responseText) {
                return '';
            }
            const normalized = responseText.replace(/\s+/g, ' ').trim();
            if (!normalized) {
                return '';
            }
            return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
        };
        const inferCategory = (error, fallbackCategory = 'runtime-failed') => {
            const message = trimDiagnostic(error?.message || error).toLowerCase();
            if (!message) {
                return fallbackCategory;
            }
            if (message.includes('missing modules') || message.includes('module did not load')) {
                return 'missing-module';
            }
            if (message.includes('http 401') || message.includes('invalid request token')) {
                return 'auth-failed';
            }
            if (message.includes('http 403') || message.includes('blocked by request guard')) {
                return 'request-guard';
            }
            if (message.includes('http 404')) {
                return 'missing-endpoint';
            }
            if (message.includes('http 5')) {
                return 'server-error';
            }
            if (message.includes('json') && message.includes('parse')) {
                return 'invalid-response';
            }
            return fallbackCategory;
        };
        const markStep = (step) => fatalBanner?.markStep?.(step);
        const setPhase = (phase) => fatalBanner?.setPhase?.(phase);
        const recordAction = (action) => fatalBanner?.recordAction?.(action);
        const setModuleStatus = (name, status, detail = '') => fatalBanner?.setModuleStatus?.(name, status, detail);
        const recordRequest = (entry = {}) => fatalBanner?.recordRequest?.(entry);
        const reportMissingModules = (missingModules = [], overrides = {}) => {
            fatalBanner?.reportMissingModules?.(missingModules, {
                context,
                hostSelector,
                code: `${codePrefix}-BOOT-001`,
                phase: 'module-load',
                message: `FolderView Plus could not start because required ${context.toLowerCase()} runtime modules failed to load.`,
                ...overrides
            });
        };
        const reportFatalError = (error, overrides = {}) => {
            fatalBanner?.reportFatalError?.(error, {
                context,
                hostSelector,
                title: defaultFatalTitle,
                message: defaultFatalMessage,
                code: `${codePrefix}-BOOT-002`,
                phase: overrides.phase || error?.fvplusPhase || 'runtime',
                category: overrides.category || error?.fvplusCategory || inferCategory(error, 'runtime-failed'),
                ...overrides
            });
        };
        const reportDegradedState = (error, overrides = {}) => {
            fatalBanner?.reportDegradedState?.(error, {
                context,
                hostSelector,
                title: defaultDegradedTitle,
                message: defaultDegradedMessage,
                code: `${codePrefix}-BOOT-003`,
                phase: overrides.phase || error?.fvplusPhase || 'bootstrap-data',
                category: overrides.category || error?.fvplusCategory || 'degraded-mode',
                ...overrides
            });
        };
        const buildRequestError = (label, url, jqXHR, textStatus, errorThrown, requestOptions = {}) => {
            const status = trimDiagnostic(typeof jqXHR?.status === 'number' && jqXHR.status > 0 ? jqXHR.status : '');
            const traceId = trimDiagnostic(
                typeof jqXHR?.getResponseHeader === 'function'
                    ? jqXHR.getResponseHeader('X-FV-Trace')
                    : ''
            );
            const detail = trimDiagnostic(errorThrown || textStatus || 'request failed');
            const messageParts = [`${label} request failed for ${url}`];
            if (status) {
                messageParts.push(`HTTP ${status}`);
            }
            if (detail && detail.toLowerCase() !== 'error') {
                messageParts.push(detail);
            }
            if (traceId) {
                messageParts.push(`trace: ${traceId}`);
            }
            const error = new Error(messageParts.join(' | '));
            error.jqXHR = jqXHR;
            error.status = status;
            error.traceId = traceId;
            error.responseText = jqXHR?.responseText || '';
            error.fvplusPhase = requestOptions.phase || 'bootstrap-data';
            error.fvplusCategory = inferCategory(error, requestOptions.category || 'request-failed');
            return error;
        };
        const createRequest = (url, requestOptions = {}) => {
            const method = trimDiagnostic(requestOptions.method || 'GET') || 'GET';
            const source = trimDiagnostic(requestOptions.source || `${context.toLowerCase()}-runtime`);
            const detail = trimDiagnostic(requestOptions.detail || '');
            const label = trimDiagnostic(requestOptions.label || source || url);
            const allowFallback = requestOptions.allowFallback === true;
            const fallbackValue = requestOptions.fallbackValue;
            const requestPromise = method.toUpperCase() === 'POST'
                ? pluginRequestClient?.postText?.(url, requestOptions.data || {}, requestOptions)
                : pluginRequestClient?.getText?.(url, requestOptions);
            if (!requestPromise || typeof requestPromise.then !== 'function') {
                return Promise.reject(new Error('FolderView Plus request client is unavailable.'));
            }
            return requestPromise.then(
                (data) => {
                    recordRequest({
                        method,
                        url,
                        source,
                        outcome: 'ok',
                        detail
                    });
                    return data;
                },
                (requestError) => {
                    const error = requestError instanceof Error
                        ? requestError
                        : buildRequestError(label, url, requestError?.jqXHR, requestError?.textStatus, requestError?.errorThrown, requestOptions);
                    recordRequest({
                        method,
                        url,
                        source,
                        outcome: allowFallback ? 'fallback' : 'error',
                        status: extractStatus(error),
                        traceId: extractTraceId(error),
                        category: inferCategory(error, allowFallback ? 'degraded-mode' : 'request-failed'),
                        detail: trimDiagnostic(error.message),
                        responseSnippet: extractResponseSnippet(error)
                    });
                    if (allowFallback) {
                        reportDegradedState(error, {
                            title: requestOptions.fallbackTitle || `${context} runtime preferences could not be loaded`,
                            message: requestOptions.fallbackMessage || `FolderView Plus kept the ${context.toLowerCase()} page open, but the runtime had to fall back to default ${context.toLowerCase()} folder preferences.`,
                            detailLabel: requestOptions.fallbackDetailLabel || 'Fallback request',
                            details: [
                                requestOptions.fallbackLead || `${label} request fell back to defaults.`,
                                trimDiagnostic(error.message)
                            ].filter(Boolean)
                        });
                        return fallbackValue;
                    }
                    throw error;
                }
            );
        };

        setEnvironment();
        setPhase('bootstrap');
        recordAction(`${context} runtime bootstrap started`);

        return Object.freeze({
            setEnvironment,
            markStep,
            setPhase,
            recordAction,
            setModuleStatus,
            recordRequest,
            reportMissingModules,
            reportFatalError,
            reportDegradedState,
            inferCategory,
            createRequest
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
        DEFAULT_FOLDER_ACCENT_COLOR,
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
        isFolderAccentEnabled,
        getFolderAccentColor,
        getFolderStatusColors,
        getFolderStatusColorOverrides,
        applyFolderStatusColorOverrides,
        applyFolderAccentStyle,
        applyPreviewBorderStyle,
        getPreviewRowLimitValue,
        normalizeFolderPreviewRowLimit,
        normalizeFolderPreviewOverflow,
        normalizePreviewHoverAnimation,
        getPreviewHoverAnimationClass,
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
        createRuntimeDiagnosticsBridge,
        resolveRuntimePerformanceProfile,
        normalizePerformanceProfileMode,
        createDeferredPreviewController,
        runtimeContracts,
        layoutTokens
    };
})(window);
