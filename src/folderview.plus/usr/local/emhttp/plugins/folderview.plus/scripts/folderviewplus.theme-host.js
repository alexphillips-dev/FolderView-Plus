// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.themeHost = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    const readPalette = (styleSources, page, card, { resolveColorCandidate, isColorUsable, window: win }) => isColorUsable(page) && isColorUsable(card) ? {
            page,
            card,
            muted: resolveColorCandidate(styleSources, ['--alt-text-color'], null),
            border: resolveColorCandidate(styleSources, ['--table-border-color', '--border-color'], null),
            subtle: resolveColorCandidate(styleSources, ['--mild-background-color'], null),
            input: resolveColorCandidate(styleSources, ['--input-bg-color'], null),
            control: resolveColorCandidate(styleSources, ['--button-background'], null),
            controlHover: resolveColorCandidate(styleSources, ['--hover-button-background'], null),
            radius: styleSources.flatMap((style) => ['--button-border-radius', '--tp-r-full'].map((name) => (
                String(style.getPropertyValue(name) || '').trim()
            ))).find((value) => value && win.CSS?.supports?.('border-radius', value)) || '8px'
        } : null;

    const buildTokenMap = (tokens = {}, applied = false) => {
        const hostTokenMap = {
            '--fvplus-ui-page': tokens.hostPage,
            '--fvplus-ui-panel': tokens.surfacePanel,
            '--fvplus-ui-card': tokens.surfaceCard,
            '--fvplus-ui-card-raised': tokens.surfaceMuted,
            '--fvplus-ui-field': tokens.hostInput,
            '--fvplus-ui-input': tokens.hostInput,
            '--fvplus-ui-muted': tokens.surfaceMuted,
            '--fvplus-ui-strong': tokens.surfaceStrong,
            '--fvplus-ui-control': tokens.hostControl,
            '--fvplus-ui-control-hover': tokens.hostControlHover,
            '--fvplus-ui-control-active': tokens.accentSoft,
            '--fvplus-ui-control-radius': tokens.hostControlRadius,
            '--fv-ui-radius-sm': tokens.hostControlRadius,
            '--fvplus-ui-text-primary': tokens.textPrimary,
            '--fvplus-ui-text-muted': tokens.textMuted,
            '--fvplus-ui-text-dim': tokens.textDim,
            '--fvplus-ui-border-subtle': tokens.borderSubtle,
            '--fvplus-ui-border-faint': tokens.borderFaint,
            '--fvplus-ui-border-strong': tokens.borderSubtle,
            '--fvplus-ui-accent': tokens.accent,
            '--fvplus-ui-accent-strong': tokens.controlAccentText,
            '--fvplus-ui-accent-soft': tokens.accentSoft,
            '--fvplus-ui-focus-ring': tokens.focusRing,
            '--fvplus-settings-accent-strong': tokens.controlAccentText,
            '--fvplus-settings-title-accent': tokens.controlAccentText,
            '--fvplus-settings-surface-field': tokens.hostInput,
            '--fvplus-settings-button-fg': tokens.textPrimary,
            '--fvplus-settings-button-bg-top': tokens.hostControl,
            '--fvplus-settings-button-bg-bottom': tokens.hostControl,
            '--fvplus-settings-button-hover-top': tokens.hostControlHover,
            '--fvplus-settings-button-hover-bottom': tokens.hostControlHover,
            '--fvplus-settings-button-active-top': tokens.accentSoft,
            '--fvplus-settings-button-active-bottom': tokens.accentSoft,
            '--fvplus-settings-button-outline': tokens.borderSubtle,
            '--fvplus-settings-button-outline-hover': tokens.accent,
            '--fvplus-settings-button-outline-active': tokens.accent,
            '--fvplus-settings-button-shadow': `inset 0 0 0 1px ${tokens.borderFaint}`,
            '--fvplus-settings-button-shadow-hover': `inset 0 0 0 1px ${tokens.accentSoft}`,
            '--fvplus-settings-button-shadow-active': `inset 0 0 0 1px ${tokens.accentSoft}`,
            '--fvplus-settings-button-accent-fg': tokens.textPrimary,
            '--fvplus-settings-button-accent-top': tokens.accentSoft,
            '--fvplus-settings-button-accent-bottom': tokens.accentSoft,
            '--fvplus-settings-button-accent-shadow': `inset 0 0 0 1px ${tokens.accentSoft}`,
            '--fvplus-settings-button-quiet-top': tokens.hostControl,
            '--fvplus-settings-button-quiet-bottom': tokens.hostControl,
            '--fvplus-settings-button-quiet-hover-top': tokens.hostControlHover,
            '--fvplus-settings-button-quiet-hover-bottom': tokens.hostControlHover,
            '--fvplus-settings-button-quiet-shadow': `inset 0 0 0 1px ${tokens.borderFaint}`,
            '--fvplus-settings-button-quiet-shadow-hover': `inset 0 0 0 1px ${tokens.accentSoft}`,
            '--fvplus-runtime-menu-bg': tokens.surfacePanel,
            '--fvplus-runtime-menu-fg': tokens.textPrimary,
            '--fvplus-runtime-menu-border': tokens.borderSubtle,
            '--fvplus-runtime-menu-divider': tokens.borderFaint,
            '--fvplus-runtime-menu-hover-bg': tokens.accentSoft,
            '--fvplus-runtime-menu-hover-fg': tokens.textPrimary,
            '--fvplus-runtime-menu-header-bg': tokens.surfaceMuted,
            '--fvplus-runtime-menu-muted': tokens.textMuted,
            '--fvplus-dashboard-accent': tokens.accent,
            '--fvplus-dashboard-accent-soft': tokens.accentSoft,
            '--fvplus-dashboard-accent-border': tokens.accent,
            '--fvplus-dashboard-accent-soft-active': tokens.accentSoft,
            '--fvplus-dashboard-accent-border-active': tokens.accent,
            '--fvplus-dashboard-surface-tint': tokens.surfaceMuted,
            '--fvplus-dashboard-border-muted': tokens.borderSubtle,
            '--fvplus-dashboard-quick-action-border': tokens.borderSubtle,
            '--fvplus-dashboard-quick-action-bg': tokens.hostControl,
            '--fvplus-dashboard-quick-action-fg': tokens.textPrimary,
            '--fvplus-dashboard-quick-action-bg-top': tokens.hostControl,
            '--fvplus-dashboard-quick-action-bg-bottom': tokens.hostControl,
            '--fvplus-dashboard-quick-action-hover-top': tokens.accentSoft,
            '--fvplus-dashboard-quick-action-hover-bottom': tokens.accentSoft,
            '--fvplus-dashboard-quick-action-active-top': tokens.accentSoft,
            '--fvplus-dashboard-quick-action-active-bottom': tokens.accentSoft,
            '--fvplus-dashboard-quick-action-active-fg': tokens.textPrimary,
            '--fvplus-dashboard-quick-action-shadow': `inset 0 0 0 1px ${tokens.borderFaint}`,
            '--fvplus-dashboard-quick-action-shadow-hover': `inset 0 0 0 1px ${tokens.accentSoft}`,
            '--fvplus-dashboard-quick-action-shadow-active': `inset 0 0 0 1px ${tokens.accentSoft}`,
            '--fvplus-folder-dropdown-color': tokens.accent,
            '--fvplus-folder-dropdown-hover-color': tokens.accent,
            '--fvplus-folder-dropdown-bg': tokens.accentSoft,
            '--fvplus-folder-dropdown-hover-bg': tokens.accentSoft,
            '--fvplus-folder-dropdown-border-color': tokens.accent,
            '--fvplus-folder-dropdown-hover-border-color': tokens.accent
        };
        return Object.fromEntries(Object.entries(hostTokenMap).map(([name, value]) => [name, applied ? value || '' : '']));
    };

    const adaptPalette = (fallback, colors, accent) => ({
        hostColors: colors,
        textMuted: colors.muted || fallback.textMuted,
        borderSubtle: colors.border || fallback.borderSubtle,
        borderFaint: colors.border || fallback.borderFaint,
        surfaceMuted: colors.subtle || fallback.surfaceMuted,
        surfaceStrong: colors.control || fallback.surfaceStrong,
        surfacePanel: colors.card,
        surfaceCard: colors.card,
        focusRing: { ...(accent || fallback.accent), a: 0.34 }
    });

    const editorTokens = (host, palette, toCss) => ({
        editorBg: toCss(host.page),
        editorPanel: toCss(host.card),
        editorHeroIconBg: toCss(host.subtle || host.card),
        editorControlSurface: toCss(host.control || host.card),
        editorControlSurfaceHover: toCss(host.controlHover || host.subtle || host.card),
        editorInputBg: toCss(host.input || host.card),
        editorInsetSurface: toCss(host.subtle || host.card),
        editorNavCountText: toCss(palette.accent)
    });

    return Object.freeze({ readPalette, buildTokenMap, adaptPalette, editorTokens });
}));
