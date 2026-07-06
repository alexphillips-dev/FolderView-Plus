// @ts-check
(function fvplusThemeResolverScope(window) {
    'use strict';

    let themeColorParserCanvasContext = null;
    let configuredModeResolver = null;
    let configuredTrackEvent = null;

    const THEME_COMPATIBILITY_MODE_OPTIONS = Object.freeze(['auto', 'host', 'safe', 'highcontrast']);
    const THEME_COMPATIBILITY_MODE_WEIGHT = Object.freeze({
        host: 0,
        auto: 1,
        safe: 2,
        highcontrast: 3
    });
    const THEME_CONTRAST_RULES = Object.freeze({
        textPrimary: 4.5,
        textMuted: 3.0,
        textDim: 2.7,
        statusStarted: 3.0,
        statusPaused: 3.0,
        statusStopped: 3.0
    });
    const DEFAULT_THEME_ROOT_SELECTORS = Object.freeze([
        '#fv-settings-root',
        '.canvas form.folder-editor-form',
        '#fvEditorChrome',
        'body',
        'html'
    ]);

    const clampThemeChannel = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 0;
        }
        return Math.min(255, Math.max(0, Math.round(parsed)));
    };

    const clampThemeAlpha = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 1;
        }
        return Math.min(1, Math.max(0, parsed));
    };

    const getThemeColorParserContext = () => {
        if (themeColorParserCanvasContext) {
            return themeColorParserCanvasContext;
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            themeColorParserCanvasContext = canvas.getContext('2d');
        } catch (_error) {
            themeColorParserCanvasContext = null;
        }
        return themeColorParserCanvasContext;
    };

    const parseThemeColorToRgba = (value) => {
        const raw = String(value || '').trim();
        if (!raw || raw === 'transparent' || raw === 'currentcolor') {
            return null;
        }
        const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) {
            const body = hexMatch[1];
            if (body.length === 3) {
                return {
                    r: clampThemeChannel(parseInt(`${body[0]}${body[0]}`, 16)),
                    g: clampThemeChannel(parseInt(`${body[1]}${body[1]}`, 16)),
                    b: clampThemeChannel(parseInt(`${body[2]}${body[2]}`, 16)),
                    a: 1
                };
            }
            return {
                r: clampThemeChannel(parseInt(body.slice(0, 2), 16)),
                g: clampThemeChannel(parseInt(body.slice(2, 4), 16)),
                b: clampThemeChannel(parseInt(body.slice(4, 6), 16)),
                a: 1
            };
        }
        const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
        if (rgbMatch) {
            const channels = rgbMatch[1].split(',').map((part) => part.trim());
            if (channels.length >= 3) {
                return {
                    r: clampThemeChannel(channels[0]),
                    g: clampThemeChannel(channels[1]),
                    b: clampThemeChannel(channels[2]),
                    a: clampThemeAlpha(channels[3] ?? 1)
                };
            }
        }
        const parserContext = getThemeColorParserContext();
        if (!parserContext) {
            return null;
        }
        parserContext.fillStyle = '#000000';
        parserContext.fillStyle = raw;
        const normalized = String(parserContext.fillStyle || '').trim();
        if (!normalized) {
            return null;
        }
        if (normalized === raw) {
            const normalizedRgb = raw.match(/^rgba?\(([^)]+)\)$/i);
            if (normalizedRgb) {
                const channels = normalizedRgb[1].split(',').map((part) => part.trim());
                if (channels.length >= 3) {
                    return {
                        r: clampThemeChannel(channels[0]),
                        g: clampThemeChannel(channels[1]),
                        b: clampThemeChannel(channels[2]),
                        a: clampThemeAlpha(channels[3] ?? 1)
                    };
                }
            }
        }
        return parseThemeColorToRgba(normalized);
    };

    const themeRgbaToCss = (color, alphaOverride = null) => {
        if (!color) {
            return '';
        }
        const alpha = alphaOverride === null ? clampThemeAlpha(color.a ?? 1) : clampThemeAlpha(alphaOverride);
        if (alpha >= 0.999) {
            return `rgb(${clampThemeChannel(color.r)}, ${clampThemeChannel(color.g)}, ${clampThemeChannel(color.b)})`;
        }
        return `rgba(${clampThemeChannel(color.r)}, ${clampThemeChannel(color.g)}, ${clampThemeChannel(color.b)}, ${alpha.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')})`;
    };

    const themeRgbaLuminance = (color) => {
        if (!color) {
            return 0;
        }
        const normalizeChannel = (channel) => {
            const value = clampThemeChannel(channel) / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        const r = normalizeChannel(color.r);
        const g = normalizeChannel(color.g);
        const b = normalizeChannel(color.b);
        return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    };

    const themeContrastRatio = (left, right) => {
        if (!left || !right) {
            return 1;
        }
        const luminanceLeft = themeRgbaLuminance(left);
        const luminanceRight = themeRgbaLuminance(right);
        const bright = Math.max(luminanceLeft, luminanceRight);
        const dark = Math.min(luminanceLeft, luminanceRight);
        return (bright + 0.05) / (dark + 0.05);
    };

    const isThemeSurfaceColorUsable = (color, minAlpha = 0.08) => (
        !!color && clampThemeAlpha(color.a ?? 1) >= clampThemeAlpha(minAlpha)
    );

    const resolveThemeSurfaceColor = (...candidates) => {
        for (const candidate of candidates) {
            if (isThemeSurfaceColorUsable(candidate)) {
                return candidate;
            }
        }
        return candidates.find(Boolean) || null;
    };

    const themeBlendColors = (foreground, background, alpha = 0.65) => {
        if (!foreground && !background) {
            return null;
        }
        if (!foreground) {
            return background;
        }
        if (!background) {
            return foreground;
        }
        const blend = clampThemeAlpha(alpha);
        const inv = 1 - blend;
        return {
            r: clampThemeChannel((foreground.r * blend) + (background.r * inv)),
            g: clampThemeChannel((foreground.g * blend) + (background.g * inv)),
            b: clampThemeChannel((foreground.b * blend) + (background.b * inv)),
            a: 1
        };
    };

    const normalizeThemeCompatibilityMode = (value) => {
        const utils = window.FolderViewPlusUtils || null;
        if (utils && typeof utils.normalizeThemeCompatibilityMode === 'function') {
            return utils.normalizeThemeCompatibilityMode(value);
        }
        const normalized = String(value || '').trim().toLowerCase();
        return THEME_COMPATIBILITY_MODE_OPTIONS.includes(normalized) ? normalized : 'auto';
    };

    const getThemeCompatibilityModeWeight = (value) => {
        const normalized = normalizeThemeCompatibilityMode(value);
        return Number(THEME_COMPATIBILITY_MODE_WEIGHT[normalized] ?? 1);
    };

    const resolveThemeColorCandidate = (styleSources, candidates, fallbackColor) => {
        const sourceList = Array.isArray(styleSources) ? styleSources : [];
        const candidateList = Array.isArray(candidates) ? candidates : [];
        for (const candidate of candidateList) {
            const value = String(candidate || '').trim();
            if (!value) {
                continue;
            }
            if (value.startsWith('--')) {
                for (const style of sourceList) {
                    if (!style || typeof style.getPropertyValue !== 'function') {
                        continue;
                    }
                    const tokenValue = String(style.getPropertyValue(value) || '').trim();
                    const parsedToken = parseThemeColorToRgba(tokenValue);
                    if (parsedToken) {
                        return parsedToken;
                    }
                }
                continue;
            }
            const parsedRaw = parseThemeColorToRgba(value);
            if (parsedRaw) {
                return parsedRaw;
            }
        }
        return fallbackColor || null;
    };

    const resolveThemeStatusColor = (name, preferred, background, contrastThreshold, fallbackList) => {
        const preferredRatio = themeContrastRatio(preferred, background);
        if (preferredRatio >= contrastThreshold) {
            return {
                color: preferred,
                ratio: preferredRatio,
                autoHealed: false,
                reason: `${name}:native`
            };
        }
        const fallbackCandidates = Array.isArray(fallbackList) ? fallbackList : [];
        for (const candidate of fallbackCandidates) {
            const ratio = themeContrastRatio(candidate, background);
            if (ratio >= contrastThreshold) {
                return {
                    color: candidate,
                    ratio,
                    autoHealed: true,
                    reason: `${name}:fallback`
                };
            }
        }
        return {
            color: preferred,
            ratio: preferredRatio,
            autoHealed: false,
            reason: `${name}:unresolved`
        };
    };

    const buildThemePaletteForMode = ({
        mode = 'auto',
        classification = 'dark',
        hostText = null,
        hostBackground = null,
        accent = null
    } = {}) => {
        const isDark = classification === 'dark';
        const safeDark = {
            textPrimary: parseThemeColorToRgba('#f2f2f3'),
            textMuted: parseThemeColorToRgba('#b6b6ba'),
            textDim: parseThemeColorToRgba('#8d8d92'),
            borderSubtle: parseThemeColorToRgba('rgba(255,255,255,0.16)'),
            borderFaint: parseThemeColorToRgba('rgba(255,255,255,0.1)'),
            surfaceMuted: parseThemeColorToRgba('rgba(255,255,255,0.03)'),
            surfaceStrong: parseThemeColorToRgba('#242426'),
            surfacePanel: parseThemeColorToRgba('#171718'),
            surfaceCard: parseThemeColorToRgba('#1d1d1f'),
            accent: accent || parseThemeColorToRgba('#ff8a1f'),
            accentSoft: parseThemeColorToRgba('rgba(255,138,31,0.14)'),
            focusRing: parseThemeColorToRgba('rgba(74,179,255,0.34)'),
            runtimeForeground: parseThemeColorToRgba('#f2f2f3'),
            statusPaused: parseThemeColorToRgba('#d09a24'),
            statusStopped: parseThemeColorToRgba('#ff7474')
        };
        const safeLight = {
            textPrimary: parseThemeColorToRgba('#101926'),
            textMuted: parseThemeColorToRgba('#304154'),
            textDim: parseThemeColorToRgba('#56667a'),
            borderSubtle: parseThemeColorToRgba('rgba(10,16,28,0.24)'),
            borderFaint: parseThemeColorToRgba('rgba(10,16,28,0.16)'),
            surfaceMuted: parseThemeColorToRgba('rgba(16,24,38,0.04)'),
            surfaceStrong: parseThemeColorToRgba('rgba(255,255,255,0.72)'),
            surfacePanel: parseThemeColorToRgba('rgba(255,255,255,0.82)'),
            surfaceCard: parseThemeColorToRgba('rgba(255,255,255,0.98)'),
            accent: accent || parseThemeColorToRgba('#2f78d8'),
            accentSoft: parseThemeColorToRgba('rgba(47,120,216,0.15)'),
            focusRing: parseThemeColorToRgba('rgba(48,116,214,0.44)'),
            runtimeForeground: parseThemeColorToRgba('#101926'),
            statusPaused: parseThemeColorToRgba('#8a5d00'),
            statusStopped: parseThemeColorToRgba('#c62828')
        };
        const baseSafe = isDark ? safeDark : safeLight;
        const hostForeground = hostText || baseSafe.textPrimary;
        const hostSurface = hostBackground || (isDark ? parseThemeColorToRgba('#0f0f10') : parseThemeColorToRgba('#f6f8fc'));
        const hostPalette = {
            textPrimary: hostForeground,
            textMuted: themeBlendColors(hostForeground, hostSurface, 0.72) || baseSafe.textMuted,
            textDim: themeBlendColors(hostForeground, hostSurface, 0.58) || baseSafe.textDim,
            borderSubtle: baseSafe.borderSubtle,
            borderFaint: baseSafe.borderFaint,
            surfaceMuted: baseSafe.surfaceMuted,
            surfaceStrong: baseSafe.surfaceStrong,
            surfacePanel: baseSafe.surfacePanel,
            surfaceCard: baseSafe.surfaceCard,
            accent: accent || baseSafe.accent,
            accentSoft: baseSafe.accentSoft,
            focusRing: baseSafe.focusRing,
            runtimeForeground: hostForeground,
            statusPaused: baseSafe.statusPaused,
            statusStopped: baseSafe.statusStopped
        };
        if (mode === 'host') {
            return hostPalette;
        }
        if (mode === 'highcontrast') {
            return {
                ...baseSafe,
                textPrimary: isDark ? parseThemeColorToRgba('#ffffff') : parseThemeColorToRgba('#000000'),
                textMuted: isDark ? parseThemeColorToRgba('#f0f5ff') : parseThemeColorToRgba('#111827'),
                textDim: isDark ? parseThemeColorToRgba('#dce8ff') : parseThemeColorToRgba('#1f2937'),
                borderSubtle: isDark ? parseThemeColorToRgba('rgba(255,255,255,0.28)') : parseThemeColorToRgba('rgba(0,0,0,0.34)'),
                borderFaint: isDark ? parseThemeColorToRgba('rgba(255,255,255,0.2)') : parseThemeColorToRgba('rgba(0,0,0,0.24)'),
                focusRing: isDark ? parseThemeColorToRgba('rgba(122,208,255,0.85)') : parseThemeColorToRgba('rgba(34,94,196,0.78)'),
                runtimeForeground: isDark ? parseThemeColorToRgba('#ffffff') : parseThemeColorToRgba('#000000'),
                statusPaused: isDark ? parseThemeColorToRgba('#ffd36b') : parseThemeColorToRgba('#7a4e00'),
                statusStopped: isDark ? parseThemeColorToRgba('#ff8a8a') : parseThemeColorToRgba('#a61b1b')
            };
        }
        return baseSafe;
    };

    const stringifyThemeTokens = (tokens) => ({
        textPrimary: themeRgbaToCss(tokens.textPrimary),
        textMuted: themeRgbaToCss(tokens.textMuted),
        textDim: themeRgbaToCss(tokens.textDim),
        borderSubtle: themeRgbaToCss(tokens.borderSubtle),
        borderFaint: themeRgbaToCss(tokens.borderFaint),
        surfaceMuted: themeRgbaToCss(tokens.surfaceMuted),
        surfaceStrong: themeRgbaToCss(tokens.surfaceStrong),
        surfacePanel: themeRgbaToCss(tokens.surfacePanel),
        surfaceCard: themeRgbaToCss(tokens.surfaceCard),
        accent: themeRgbaToCss(tokens.accent),
        accentSoft: themeRgbaToCss(tokens.accentSoft),
        focusRing: themeRgbaToCss(tokens.focusRing),
        runtimeForeground: themeRgbaToCss(tokens.runtimeForeground),
        statusStarted: themeRgbaToCss(tokens.runtimeForeground),
        statusPaused: themeRgbaToCss(tokens.statusPaused),
        statusStopped: themeRgbaToCss(tokens.statusStopped)
    });

    const resolveThemeRoot = (rootCandidate = null, doc = document) => {
        if (rootCandidate && typeof rootCandidate === 'object' && rootCandidate.nodeType === 1) {
            return rootCandidate;
        }
        if (typeof rootCandidate === 'string' && rootCandidate.trim() !== '') {
            return doc.querySelector(rootCandidate) || doc.body || doc.documentElement;
        }
        for (const selector of DEFAULT_THEME_ROOT_SELECTORS) {
            const match = doc.querySelector(selector);
            if (match) {
                return match;
            }
        }
        return doc.body || doc.documentElement;
    };

    const resolveThemeTargets = (rootCandidate = null, extraTargets = [], doc = document) => {
        const seen = new Set();
        const targets = [];
        const pushTarget = (candidate) => {
            const resolved = resolveThemeRoot(candidate, doc);
            if (!resolved || seen.has(resolved)) {
                return;
            }
            seen.add(resolved);
            targets.push(resolved);
        };
        pushTarget(rootCandidate);
        const extras = Array.isArray(extraTargets) ? extraTargets : [extraTargets];
        for (const candidate of extras) {
            if (!candidate) {
                continue;
            }
            pushTarget(candidate);
        }
        pushTarget(doc.body || null);
        pushTarget(doc.documentElement || null);
        return targets;
    };

    const resolveRequestedMode = (modeInput = null, options = {}) => {
        const hasExplicitMode = modeInput !== null && modeInput !== undefined && String(modeInput).trim() !== '';
        if (hasExplicitMode) {
            return normalizeThemeCompatibilityMode(modeInput);
        }
        const modeResolver = typeof options.getMode === 'function'
            ? options.getMode
            : configuredModeResolver;
        if (typeof modeResolver === 'function') {
            return normalizeThemeCompatibilityMode(modeResolver());
        }
        return 'auto';
    };

    const inferThemeClassificationFromHostTheme = (themeName) => {
        const normalized = String(themeName || '').trim().toLowerCase();
        if (!normalized) {
            return '';
        }
        if (normalized.includes('white') || normalized.includes('light')) {
            return 'light';
        }
        if (normalized.includes('black')) {
            return 'dark';
        }
        return '';
    };

    const buildEditorThemeTokenStrings = (classification, palette) => {
        const isLight = classification === 'light';
        const editorOutline = themeRgbaToCss(palette.accent, isLight ? 0.24 : 0.22);
        const editorOutlineStrong = themeRgbaToCss(palette.accent, isLight ? 0.44 : 0.5);
        return {
            editorBg: isLight
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(244, 248, 252, 0.99))'
                : '#0f0f10',
            editorPanel: isLight
                ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(242, 247, 252, 0.98))'
                : '#1d1d1f',
            editorBorder: editorOutline,
            editorBorderStrong: editorOutlineStrong,
            editorTextPrimary: themeRgbaToCss(palette.textPrimary),
            editorMuted: themeRgbaToCss(palette.textMuted),
            editorDim: themeRgbaToCss(palette.textDim),
            editorAccent: themeRgbaToCss(palette.accent),
            editorAccentSoft: themeRgbaToCss(palette.accentSoft),
            editorSuccess: isLight ? '#287a43' : '#8ce69b',
            editorWarning: isLight ? '#9a6b00' : '#ffbe76',
            editorDanger: isLight ? '#b63737' : '#ff7f7f',
            editorHeroIconBorder: editorOutline,
            editorHeroIconBg: isLight
                ? `radial-gradient(circle at top left, ${themeRgbaToCss(palette.accent, 0.18)}, rgba(255, 255, 255, 0.72))`
                : '#242426',
            editorControlBorder: editorOutline,
            editorControlSurface: isLight ? 'rgba(255, 255, 255, 0.74)' : '#242426',
            editorControlSurfaceHover: isLight ? themeRgbaToCss(palette.accent, 0.08) : '#29292b',
            editorControlSurfaceActive: themeRgbaToCss(palette.accent, 0.14),
            editorInputBg: isLight ? 'rgba(255, 255, 255, 0.92)' : '#111112',
            editorInsetSurface: isLight ? 'rgba(18, 26, 38, 0.03)' : '#1a1a1b',
            editorShadow: isLight ? '0 16px 38px rgba(18, 24, 38, 0.14)' : '0 16px 38px rgba(0, 0, 0, 0.26)',
            editorFocusRing: themeRgbaToCss(palette.focusRing),
            editorNavCountBg: themeRgbaToCss(palette.accent, 0.16),
            editorNavCountText: isLight ? themeRgbaToCss(palette.accent) : '#ffd7ab',
            editorInfo: isLight ? '#2f6ea6' : '#a6d8ff'
        };
    };

    const buildSettingsSemanticTokenStrings = (classification) => {
        const isLight = classification === 'light';
        return {
            settingsTreeGuide: isLight ? 'rgba(129, 140, 154, 0.48)' : 'rgba(173, 178, 192, 0.55)',
            settingsBreadcrumbText: isLight ? 'rgba(89, 103, 120, 0.86)' : 'rgba(180, 197, 221, 0.88)',
            settingsMembersMetaText: isLight ? 'rgba(95, 108, 123, 0.82)' : 'rgba(187, 199, 219, 0.82)',
            settingsNestedMetaText: isLight ? 'rgba(105, 117, 133, 0.86)' : 'rgba(194, 206, 224, 0.86)',
            settingsChipInfo: isLight ? '#2f6ea6' : '#9ecbff',
            settingsChipInfoBorder: isLight ? 'rgba(47, 110, 166, 0.34)' : 'rgba(113, 184, 255, 0.58)',
            settingsChipInfoBg: isLight ? 'rgba(47, 110, 166, 0.10)' : 'rgba(113, 184, 255, 0.12)',
            settingsChipSuccess: isLight ? '#287a43' : '#93e19f',
            settingsChipSuccessBorder: isLight ? 'rgba(40, 122, 67, 0.34)' : 'rgba(147, 225, 159, 0.55)',
            settingsChipSuccessBg: isLight ? 'rgba(40, 122, 67, 0.10)' : 'rgba(147, 225, 159, 0.14)',
            settingsChipWarning: isLight ? '#9a6400' : '#ffc15e',
            settingsChipWarningBorder: isLight ? 'rgba(154, 100, 0, 0.34)' : 'rgba(255, 193, 94, 0.58)',
            settingsChipWarningBg: isLight ? 'rgba(154, 100, 0, 0.12)' : 'rgba(255, 193, 94, 0.14)',
            settingsChipDanger: isLight ? '#b63737' : '#ff7474',
            settingsChipDangerBorder: isLight ? 'rgba(182, 55, 55, 0.34)' : 'rgba(255, 116, 116, 0.62)',
            settingsChipDangerBg: isLight ? 'rgba(182, 55, 55, 0.10)' : 'rgba(255, 116, 116, 0.14)',
            settingsChipEmpty: isLight ? '#667385' : 'rgba(240, 240, 240, 0.86)',
            settingsChipEmptyBorder: isLight ? 'rgba(102, 115, 133, 0.32)' : 'rgba(192, 192, 192, 0.45)',
            settingsChipEmptyBg: isLight ? 'rgba(102, 115, 133, 0.10)' : 'rgba(255, 255, 255, 0.08)'
        };
    };

    const buildThemeTokenMap = (snapshot, palette) => {
        const baseTokens = stringifyThemeTokens(palette);
        return {
            ...baseTokens,
            themeForeground: baseTokens.textPrimary,
            settingsTextPrimary: baseTokens.textPrimary,
            settingsTextMuted: baseTokens.textMuted,
            settingsTextDim: baseTokens.textDim,
            settingsBorderSubtle: baseTokens.borderSubtle,
            settingsBorderFaint: baseTokens.borderFaint,
            settingsSurfaceMuted: baseTokens.surfaceMuted,
            settingsSurfaceStrong: baseTokens.surfaceStrong,
            settingsSurfacePanel: baseTokens.surfacePanel,
            settingsSurfaceCard: baseTokens.surfaceCard,
            settingsAccent: baseTokens.accent,
            settingsAccentSoft: baseTokens.accentSoft,
            settingsFocusRing: baseTokens.focusRing,
            ...buildSettingsSemanticTokenStrings(snapshot.classification),
            ...buildEditorThemeTokenStrings(snapshot.classification, palette)
        };
    };

    const buildResolvedThemeSnapshot = (modeInput = null, options = {}) => {
        const doc = options.document || document;
        const win = options.window || window;
        const sampleRoot = resolveThemeRoot(options.sampleRoot ?? options.root, doc);
        const html = doc.documentElement;
        const body = doc.body;
        const rootStyle = sampleRoot ? win.getComputedStyle(sampleRoot) : null;
        const htmlStyle = html ? win.getComputedStyle(html) : null;
        const bodyStyle = body ? win.getComputedStyle(body) : null;
        const styleSources = [rootStyle, bodyStyle, htmlStyle].filter(Boolean);

        const requestedMode = resolveRequestedMode(modeInput, options);
        const hostThemeName = String(
            options.hostThemeName
            || window.FolderViewPlusHostThemeName
            || doc.documentElement?.getAttribute?.('data-fv-host-theme')
            || ''
        ).trim();
        const rootBackground = resolveThemeSurfaceColor(
            parseThemeColorToRgba(rootStyle?.backgroundColor),
            parseThemeColorToRgba(bodyStyle?.backgroundColor),
            parseThemeColorToRgba(htmlStyle?.backgroundColor),
            parseThemeColorToRgba('#0f0f10')
        );
        const hostForeground = resolveThemeColorCandidate(
            styleSources,
            ['--text', '--fvplus-theme-foreground'],
            parseThemeColorToRgba(rootStyle?.color) || parseThemeColorToRgba(bodyStyle?.color) || parseThemeColorToRgba('#e7eef9')
        );
        const hostAccent = resolveThemeColorCandidate(
            styleSources,
            ['--orange', '--fvplus-dashboard-accent', '--accent'],
            parseThemeColorToRgba('#ff8a1f')
        );
        const backgroundLuminance = themeRgbaLuminance(rootBackground);
        const foregroundLuminance = themeRgbaLuminance(hostForeground);
        const hostThemeClassification = inferThemeClassificationFromHostTheme(hostThemeName);
        const classification = hostThemeClassification || (backgroundLuminance <= 0.45
            ? 'dark'
            : (backgroundLuminance >= 0.58 ? 'light' : 'mixed'));
        const hostContrast = themeContrastRatio(hostForeground, rootBackground);
        const prefersDark = typeof win.matchMedia === 'function'
            && win.matchMedia('(prefers-color-scheme: dark)').matches;

        const paletteByMode = buildThemePaletteForMode({
            mode: requestedMode === 'auto' ? 'host' : requestedMode,
            classification,
            hostText: hostForeground,
            hostBackground: rootBackground,
            accent: hostAccent
        });
        const safePalette = buildThemePaletteForMode({
            mode: 'safe',
            classification,
            hostText: hostForeground,
            hostBackground: rootBackground,
            accent: hostAccent
        });
        const highContrastPalette = buildThemePaletteForMode({
            mode: 'highcontrast',
            classification,
            hostText: hostForeground,
            hostBackground: rootBackground,
            accent: hostAccent
        });

        let selectedPalette = paletteByMode;
        let modeApplied = requestedMode;
        const contrastChecks = [];
        const evaluateChecks = (palette) => {
            const checks = [];
            const evaluate = (name, color, minRatio) => {
                const ratio = themeContrastRatio(color, rootBackground);
                const passed = ratio >= minRatio;
                checks.push({ name, ratio: Number(ratio.toFixed(3)), minRatio, passed });
            };
            evaluate('textPrimary', palette.textPrimary, THEME_CONTRAST_RULES.textPrimary);
            evaluate('textMuted', palette.textMuted, THEME_CONTRAST_RULES.textMuted);
            evaluate('textDim', palette.textDim, THEME_CONTRAST_RULES.textDim);
            return checks;
        };

        const initialChecks = evaluateChecks(selectedPalette);
        contrastChecks.push(...initialChecks);
        const initialFailed = initialChecks.filter((check) => !check.passed);
        if (requestedMode === 'auto' && initialFailed.length > 0) {
            selectedPalette = initialFailed.some((check) => check.name === 'textPrimary')
                ? highContrastPalette
                : safePalette;
            modeApplied = selectedPalette === highContrastPalette ? 'highcontrast' : 'safe';
            contrastChecks.splice(0, contrastChecks.length, ...evaluateChecks(selectedPalette));
        }

        const statusStarted = resolveThemeStatusColor(
            'statusStarted',
            selectedPalette.runtimeForeground,
            rootBackground,
            THEME_CONTRAST_RULES.statusStarted,
            [safePalette.runtimeForeground, highContrastPalette.runtimeForeground]
        );
        const statusPaused = resolveThemeStatusColor(
            'statusPaused',
            selectedPalette.statusPaused,
            rootBackground,
            THEME_CONTRAST_RULES.statusPaused,
            [safePalette.statusPaused, highContrastPalette.statusPaused]
        );
        const statusStopped = resolveThemeStatusColor(
            'statusStopped',
            selectedPalette.statusStopped,
            rootBackground,
            THEME_CONTRAST_RULES.statusStopped,
            [safePalette.statusStopped, highContrastPalette.statusStopped]
        );
        selectedPalette.runtimeForeground = statusStarted.color;
        selectedPalette.statusPaused = statusPaused.color;
        selectedPalette.statusStopped = statusStopped.color;

        const warnings = [];
        if (hostContrast < THEME_CONTRAST_RULES.textPrimary) {
            warnings.push(`Host text contrast is low (${hostContrast.toFixed(2)}:1).`);
        }
        for (const check of contrastChecks) {
            if (!check.passed) {
                warnings.push(`Contrast check failed for ${check.name} (${check.ratio}:1 < ${check.minRatio}:1).`);
            }
        }
        if (statusStarted.autoHealed || statusPaused.autoHealed || statusStopped.autoHealed) {
            warnings.push('Status colors were auto-healed to preserve contrast.');
        }

        return {
            generatedAt: new Date().toISOString(),
            requestedMode,
            appliedMode: modeApplied,
            prefersDark,
            classification,
            hostThemeName,
            sampleRootSelector: typeof options.sampleRoot === 'string' ? options.sampleRoot : '',
            rootLuminance: Number(backgroundLuminance.toFixed(4)),
            hostTextLuminance: Number(foregroundLuminance.toFixed(4)),
            hostContrast: Number(hostContrast.toFixed(3)),
            autoHealed: modeApplied !== requestedMode || statusStarted.autoHealed || statusPaused.autoHealed || statusStopped.autoHealed,
            contrastChecks,
            statusChecks: {
                started: { ratio: Number(statusStarted.ratio.toFixed(3)), minRatio: THEME_CONTRAST_RULES.statusStarted, autoHealed: statusStarted.autoHealed },
                paused: { ratio: Number(statusPaused.ratio.toFixed(3)), minRatio: THEME_CONTRAST_RULES.statusPaused, autoHealed: statusPaused.autoHealed },
                stopped: { ratio: Number(statusStopped.ratio.toFixed(3)), minRatio: THEME_CONTRAST_RULES.statusStopped, autoHealed: statusStopped.autoHealed }
            },
            tokens: buildThemeTokenMap({ classification }, selectedPalette),
            warnings
        };
    };

    const applyResolvedThemeTokens = (reason = 'runtime', options = {}) => {
        const doc = options.document || document;
        const snapshot = buildResolvedThemeSnapshot(options.modeInput ?? null, options);
        const targets = resolveThemeTargets(options.root, options.extraTargets, doc);
        if (targets.length === 0) {
            return snapshot;
        }
        const tokens = snapshot.tokens || {};
        const rootTokenMap = {
            '--fvplus-theme-foreground': tokens.themeForeground || '',
            '--fvplus-theme-text-primary': tokens.textPrimary || '',
            '--fvplus-theme-text-muted': tokens.textMuted || '',
            '--fvplus-theme-text-dim': tokens.textDim || '',
            '--fvplus-theme-border-subtle': tokens.borderSubtle || '',
            '--fvplus-theme-border-faint': tokens.borderFaint || '',
            '--fvplus-theme-surface-muted': tokens.surfaceMuted || '',
            '--fvplus-theme-surface-strong': tokens.surfaceStrong || '',
            '--fvplus-theme-surface-panel': tokens.surfacePanel || '',
            '--fvplus-theme-surface-card': tokens.surfaceCard || '',
            '--fvplus-theme-accent': tokens.accent || '',
            '--fvplus-theme-accent-soft': tokens.accentSoft || '',
            '--fvplus-theme-focus-ring': tokens.focusRing || '',
            '--fvplus-runtime-theme-foreground': tokens.runtimeForeground || '',
            '--fvplus-runtime-status-started': tokens.statusStarted || '',
            '--fvplus-runtime-status-paused': tokens.statusPaused || '',
            '--fvplus-runtime-status-stopped': tokens.statusStopped || '',
            '--fvplus-status-started': tokens.statusStarted || '',
            '--fvplus-status-paused': tokens.statusPaused || '',
            '--fvplus-status-stopped': tokens.statusStopped || '',
            '--fvplus-folder-status-started': tokens.statusStarted || '',
            '--fvplus-folder-status-paused': tokens.statusPaused || '',
            '--fvplus-folder-status-stopped': tokens.statusStopped || '',
            '--fvplus-settings-text-primary': tokens.settingsTextPrimary || '',
            '--fvplus-settings-text-muted': tokens.settingsTextMuted || '',
            '--fvplus-settings-text-dim': tokens.settingsTextDim || '',
            '--fvplus-settings-border-subtle': tokens.settingsBorderSubtle || '',
            '--fvplus-settings-border-faint': tokens.settingsBorderFaint || '',
            '--fvplus-settings-surface-muted': tokens.settingsSurfaceMuted || '',
            '--fvplus-settings-surface-strong': tokens.settingsSurfaceStrong || '',
            '--fvplus-settings-surface-panel': tokens.settingsSurfacePanel || '',
            '--fvplus-settings-surface-card': tokens.settingsSurfaceCard || '',
            '--fvplus-settings-accent': tokens.settingsAccent || '',
            '--fvplus-settings-accent-soft': tokens.settingsAccentSoft || '',
            '--fvplus-settings-focus-ring': tokens.settingsFocusRing || '',
            '--fvplus-settings-tree-guide': tokens.settingsTreeGuide || '',
            '--fvplus-settings-breadcrumb-text': tokens.settingsBreadcrumbText || '',
            '--fvplus-settings-members-meta-text': tokens.settingsMembersMetaText || '',
            '--fvplus-settings-nested-meta-text': tokens.settingsNestedMetaText || '',
            '--fvplus-settings-chip-info': tokens.settingsChipInfo || '',
            '--fvplus-settings-chip-info-border': tokens.settingsChipInfoBorder || '',
            '--fvplus-settings-chip-info-bg': tokens.settingsChipInfoBg || '',
            '--fvplus-settings-chip-success': tokens.settingsChipSuccess || '',
            '--fvplus-settings-chip-success-border': tokens.settingsChipSuccessBorder || '',
            '--fvplus-settings-chip-success-bg': tokens.settingsChipSuccessBg || '',
            '--fvplus-settings-chip-warning': tokens.settingsChipWarning || '',
            '--fvplus-settings-chip-warning-border': tokens.settingsChipWarningBorder || '',
            '--fvplus-settings-chip-warning-bg': tokens.settingsChipWarningBg || '',
            '--fvplus-settings-chip-danger': tokens.settingsChipDanger || '',
            '--fvplus-settings-chip-danger-border': tokens.settingsChipDangerBorder || '',
            '--fvplus-settings-chip-danger-bg': tokens.settingsChipDangerBg || '',
            '--fvplus-settings-chip-empty': tokens.settingsChipEmpty || '',
            '--fvplus-settings-chip-empty-border': tokens.settingsChipEmptyBorder || '',
            '--fvplus-settings-chip-empty-bg': tokens.settingsChipEmptyBg || '',
            '--fvplus-editor-bg': tokens.editorBg || '',
            '--fvplus-editor-panel': tokens.editorPanel || '',
            '--fvplus-editor-border': tokens.editorBorder || '',
            '--fvplus-editor-border-strong': tokens.editorBorderStrong || '',
            '--fvplus-editor-text-primary': tokens.editorTextPrimary || '',
            '--fvplus-editor-muted': tokens.editorMuted || '',
            '--fvplus-editor-dim': tokens.editorDim || '',
            '--fvplus-editor-accent': tokens.editorAccent || '',
            '--fvplus-editor-accent-soft': tokens.editorAccentSoft || '',
            '--fvplus-editor-success': tokens.editorSuccess || '',
            '--fvplus-editor-warning': tokens.editorWarning || '',
            '--fvplus-editor-danger': tokens.editorDanger || '',
            '--fvplus-editor-hero-icon-border': tokens.editorHeroIconBorder || '',
            '--fvplus-editor-hero-icon-bg': tokens.editorHeroIconBg || '',
            '--fvplus-editor-control-border': tokens.editorControlBorder || '',
            '--fvplus-editor-control-surface': tokens.editorControlSurface || '',
            '--fvplus-editor-control-surface-hover': tokens.editorControlSurfaceHover || '',
            '--fvplus-editor-control-surface-active': tokens.editorControlSurfaceActive || '',
            '--fvplus-editor-input-bg': tokens.editorInputBg || '',
            '--fvplus-editor-inset-surface': tokens.editorInsetSurface || '',
            '--fvplus-editor-shadow': tokens.editorShadow || '',
            '--fvplus-editor-focus-ring': tokens.editorFocusRing || '',
            '--fvplus-editor-nav-count-bg': tokens.editorNavCountBg || '',
            '--fvplus-editor-nav-count-text': tokens.editorNavCountText || '',
            '--fvplus-editor-info': tokens.editorInfo || ''
        };
        for (const target of targets) {
            for (const [token, value] of Object.entries(rootTokenMap)) {
                target.style.setProperty(token, value);
            }
            target.setAttribute('data-fv-theme-mode', String(snapshot.appliedMode || 'auto'));
            target.setAttribute('data-fv-theme-class', String(snapshot.classification || 'mixed'));
            target.setAttribute('data-fv-theme-autoheal', snapshot.autoHealed ? '1' : '0');
            target.style.colorScheme = snapshot.classification === 'light' ? 'light' : 'dark';
        }
        const trackEvent = typeof options.trackEvent === 'function'
            ? options.trackEvent
            : configuredTrackEvent;
        if (typeof trackEvent === 'function') {
            trackEvent({
                eventType: 'theme_resolver_apply',
                details: {
                    source: String(reason || 'runtime'),
                    requestedMode: snapshot.requestedMode,
                    appliedMode: snapshot.appliedMode,
                    class: snapshot.classification,
                    autoHealed: snapshot.autoHealed === true,
                    warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings.length : 0
                }
            });
        }
        return snapshot;
    };

    const configureRuntime = ({
        getMode = undefined,
        trackEvent = undefined
    } = {}) => {
        if (getMode === null) {
            configuredModeResolver = null;
        } else if (typeof getMode === 'function') {
            configuredModeResolver = getMode;
        }
        if (trackEvent === null) {
            configuredTrackEvent = null;
        } else if (typeof trackEvent === 'function') {
            configuredTrackEvent = trackEvent;
        }
    };

    const bindThemeAwareSurface = ({
        root = null,
        modeInput = null,
        getMode = undefined,
        trackEvent = undefined,
        reasonPrefix = 'surface',
        applyDelayMs = 48,
        onApply = null,
        document: doc = document,
        window: win = window
    } = {}) => {
        let timer = null;
        let observer = null;
        let bound = false;

        const runApply = (reasonValue = 'initial') => {
            const snapshot = applyResolvedThemeTokens(`${reasonPrefix}:${reasonValue}`, {
                root,
                modeInput,
                getMode,
                trackEvent,
                document: doc,
                window: win
            });
            if (typeof onApply === 'function') {
                onApply(snapshot, reasonValue);
            }
            return snapshot;
        };

        const queueApply = (reasonValue = 'theme-change') => {
            if (timer !== null) {
                win.clearTimeout(timer);
            }
            timer = win.setTimeout(() => {
                timer = null;
                runApply(reasonValue);
            }, Number.isFinite(Number(applyDelayMs)) ? Math.max(0, Number(applyDelayMs)) : 48);
        };

        const bind = () => {
            runApply('initial');
            if (bound) {
                return;
            }
            bound = true;
            if (typeof MutationObserver === 'function') {
                observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations || []) {
                        if (mutation.type !== 'attributes') {
                            continue;
                        }
                        const attr = String(mutation.attributeName || '').toLowerCase();
                        if (!attr || attr === 'class' || attr === 'style' || attr.includes('theme')) {
                            queueApply('observer');
                            return;
                        }
                    }
                });
                if (doc.documentElement) {
                    observer.observe(doc.documentElement, {
                        attributes: true,
                        attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
                    });
                }
                if (doc.body) {
                    observer.observe(doc.body, {
                        attributes: true,
                        attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
                    });
                }
            }
            if (typeof win.matchMedia === 'function') {
                const media = win.matchMedia('(prefers-color-scheme: dark)');
                if (media && typeof media.addEventListener === 'function') {
                    media.addEventListener('change', () => queueApply('prefers-color-scheme'));
                } else if (media && typeof media.addListener === 'function') {
                    media.addListener(() => queueApply('prefers-color-scheme'));
                }
            }
        };

        return Object.freeze({
            bind,
            runApply,
            queueApply,
            disconnect: () => observer?.disconnect()
        });
    };

    window.FolderViewPlusThemeResolver = Object.freeze({
        THEME_COMPATIBILITY_MODE_OPTIONS,
        THEME_COMPATIBILITY_MODE_WEIGHT,
        THEME_CONTRAST_RULES,
        normalizeThemeCompatibilityMode,
        getThemeCompatibilityModeWeight,
        buildResolvedThemeSnapshot,
        applyResolvedThemeTokens,
        configureRuntime,
        bindThemeAwareSurface
    });
})(window);

window.FolderViewPlusThemeResolverModuleLoaded = true;
