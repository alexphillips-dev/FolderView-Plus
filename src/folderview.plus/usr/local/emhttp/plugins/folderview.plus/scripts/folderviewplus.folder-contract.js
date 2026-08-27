// @ts-check
(function fvplusFolderContractScope(window) {
    'use strict';

    const DEFAULT_FOLDER_STATUS_COLORS = Object.freeze({
        started: '#55b72d',
        paused: '#b8860b',
        stopped: '#ff4d4d',
        text: '#ffffff'
    });
    const LEGACY_DEFAULT_FOLDER_STARTED_COLOR = '#ffffff';
    const DEFAULT_FOLDER_ACCENT_COLOR = '#ffca63';
    const DEFAULT_PREVIEW_BORDER_COLOR = '#afa89e';
    const DEFAULT_PREVIEW_BORDER_WIDTH = 1;
    const DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH = 1;
    const DEFAULT_DROPDOWN_STYLE = 'minimal';
    const DEFAULT_DROPDOWN_COLOR = '#ff9a3c';
    const DEFAULT_DROPDOWN_HOVER_COLOR = '#111111';
    const SUPPORTED_DROPDOWN_STYLES = Object.freeze(['minimal', 'boxed', 'ghost', 'pill', 'filled']);

    const normalizeHexColor = (value, fallback) => {
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
    };

    const normalizePositiveInt = (value, fallback, min = 1, max = 4) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }
        return Math.max(min, Math.min(max, Math.round(parsed)));
    };

    const extractDropdownStyleValue = (value, fallbackSource = null) => {
        const sources = [value, fallbackSource];
        for (const source of sources) {
            if (source && typeof source === 'object') {
                const candidate = source.dropdown_style
                    ?? source.dropdownStyle
                    ?? source.chevron_style
                    ?? source.chevronStyle;
                if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
                    return candidate;
                }
            } else if (source !== undefined && source !== null && String(source).trim() !== '') {
                return source;
            }
        }
        return '';
    };

    const normalizeDropdownStyle = (value, fallbackSource = null) => {
        const normalized = String(extractDropdownStyleValue(value, fallbackSource) || '').trim().toLowerCase();
        return SUPPORTED_DROPDOWN_STYLES.includes(normalized)
            ? normalized
            : DEFAULT_DROPDOWN_STYLE;
    };

    const hexColorToRgba = (hex, alpha) => {
        const normalized = normalizeHexColor(hex, DEFAULT_DROPDOWN_COLOR);
        const safeAlpha = Number.isFinite(Number(alpha)) ? Math.max(0, Math.min(1, Number(alpha))) : 1;
        const value = normalized.slice(1);
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    };

    const getDropdownStyleTokens = (style, normalColor, hoverColor) => {
        switch (style) {
            case 'boxed':
                return { border: hexColorToRgba(normalColor, 0.52), hoverBorder: hoverColor, background: hexColorToRgba(normalColor, 0.10), hoverBackground: hexColorToRgba(normalColor, 0.82), minWidth: '22px', height: '22px', padding: '0 6px', radius: '4px', shadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)', hoverShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)' };
            case 'ghost':
                return { border: 'transparent', hoverBorder: hoverColor, background: 'transparent', hoverBackground: hexColorToRgba(normalColor, 0.08), minWidth: '20px', height: '20px', padding: '0 5px', radius: '4px', shadow: 'none', hoverShadow: 'none' };
            case 'pill':
                return { border: hexColorToRgba(normalColor, 0.42), hoverBorder: hoverColor, background: hexColorToRgba(normalColor, 0.10), hoverBackground: hexColorToRgba(normalColor, 0.18), minWidth: '24px', height: '20px', padding: '0 7px', radius: '999px', shadow: 'none', hoverShadow: 'none' };
            case 'filled':
                return { border: hexColorToRgba(normalColor, 0.65), hoverBorder: hoverColor, background: hexColorToRgba(normalColor, 0.22), hoverBackground: hexColorToRgba(normalColor, 0.34), minWidth: '22px', height: '22px', padding: '0 6px', radius: '4px', shadow: 'none', hoverShadow: 'none' };
            case 'minimal':
            default:
                return { border: 'transparent', hoverBorder: 'transparent', background: 'transparent', hoverBackground: 'transparent', minWidth: '12px', height: '16px', padding: '0 2px', radius: '0px', shadow: 'none', hoverShadow: 'none' };
        }
    };

    const isPreviewBorderEnabled = (settings) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        if (Object.prototype.hasOwnProperty.call(source, 'preview_border')) {
            const raw = String(source.preview_border ?? '').trim().toLowerCase();
            const explicitOff = raw === '0' || raw === 'false' || raw === 'off' || raw === 'no';
            return !explicitOff;
        }
        return true;
    };

    const isFolderAccentEnabled = (settings) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        if (!Object.prototype.hasOwnProperty.call(source, 'folder_accent_enabled')) {
            return false;
        }
        const raw = source.folder_accent_enabled;
        if (typeof raw === 'string') {
            const normalized = raw.trim().toLowerCase();
            return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
        }
        return raw === true || raw === 1;
    };

    const extractPreviewRowLimitValue = (value, fallbackSource = null) => {
        const sources = [value, fallbackSource];
        for (const source of sources) {
            if (source && typeof source === 'object') {
                const candidate = source.preview_rows ?? source.previewRows;
                if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
                    return candidate;
                }
            } else if (source !== undefined && source !== null && String(source).trim() !== '') {
                return source;
            }
        }
        return '1';
    };

    const normalizePreviewRowLimit = (value, fallbackSource = null) => {
        const normalized = String(extractPreviewRowLimitValue(value, fallbackSource) ?? '').trim().toLowerCase();
        if (normalized === 'auto') {
            return 0;
        }
        const numeric = Number.parseInt(normalized, 10);
        if (!Number.isFinite(numeric)) {
            return 1;
        }
        return Math.max(0, Math.min(4, numeric));
    };

    window.FolderViewPlusFolderContract = {
        DEFAULT_FOLDER_STATUS_COLORS,
        LEGACY_DEFAULT_FOLDER_STARTED_COLOR,
        DEFAULT_FOLDER_ACCENT_COLOR,
        DEFAULT_PREVIEW_BORDER_COLOR,
        DEFAULT_PREVIEW_BORDER_WIDTH,
        DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,
        DEFAULT_DROPDOWN_STYLE,
        DEFAULT_DROPDOWN_COLOR,
        DEFAULT_DROPDOWN_HOVER_COLOR,
        SUPPORTED_DROPDOWN_STYLES,
        normalizeHexColor,
        normalizePositiveInt,
        extractDropdownStyleValue,
        normalizeDropdownStyle,
        hexColorToRgba,
        getDropdownStyleTokens,
        isPreviewBorderEnabled,
        isFolderAccentEnabled,
        extractPreviewRowLimitValue,
        normalizePreviewRowLimit
    };
})(window);
