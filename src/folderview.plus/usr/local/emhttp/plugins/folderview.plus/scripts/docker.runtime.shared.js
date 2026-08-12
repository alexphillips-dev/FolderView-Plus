// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            typeof globalThis !== 'undefined' ? globalThis : root,
            null,
            require('./runtime.shared-primitives.js'),
            require('./runtime.shared-diagnostics.js'),
            require('./runtime.shared-controls.js')
        );
        return;
    }
    root.FolderViewDockerRuntimeShared = factory(
        root,
        root.FolderViewPlusFolderContract || null,
        root.FolderViewPlusFoundationModules?.runtimeSharedPrimitives,
        root.FolderViewPlusFoundationModules?.runtimeSharedDiagnostics,
        root.FolderViewPlusFoundationModules?.runtimeSharedControls
    );
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(
    window,
    folderContract,
    runtimePrimitives,
    runtimeDiagnostics,
    runtimeControls
) {
    'use strict';

    const runtimeJquery = window.jQuery || window.$ || null;

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

    if (!runtimePrimitives || !runtimeDiagnostics || !runtimeControls) {
        throw new Error('FolderView Plus shared runtime foundations are unavailable.');
    }
    const {
        createRuntimeStateStore,
        createAsyncActionBoundary,
        createContextMenuQuickStripAdapter,
        createRuntimePerfTelemetry,
        createDeferredPreviewController,
        createSafeUiActionRunner,
        resolveRuntimePerformanceProfile,
        normalizePerformanceProfileMode,
        runtimeContracts
    } = runtimePrimitives;
    const { createDebugLogger, createRuntimeDiagnosticsBridge } = runtimeDiagnostics;
    const { createStableToggleController, createSecureNavigationApi, layoutTokens } = runtimeControls;

    return {
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
        createStableToggleController,
        createSecureNavigationApi,
        resolveRuntimePerformanceProfile,
        normalizePerformanceProfileMode,
        createDeferredPreviewController,
        runtimeContracts,
        layoutTokens
    };
}));
