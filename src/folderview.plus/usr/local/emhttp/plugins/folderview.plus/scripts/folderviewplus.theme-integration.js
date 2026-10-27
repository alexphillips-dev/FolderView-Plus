// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(globalThis); return; }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.themeIntegration = factory(root);
}(typeof window !== 'undefined' ? window : globalThis, function(defaultWindow) {
    'use strict';
    // Only native controls can supply host metrics. Never sample a resolved plugin control.
    const OWNED = '#fv-settings-root, #fvFolderEditorForm, #fvEditorChrome, .folder-editor-form, .folder, .folder-storage, .folder-showcase-outer, [class^="fv-"]:not(body,html), [class*=" fv-"]:not(body,html), [class^="fvplus-"]:not(body,html), [class*=" fvplus-"]:not(body,html)';
    const findNative = (doc, win, selectors) => {
        for (const selector of selectors) {
            for (const node of Array.from(doc?.querySelectorAll?.(selector) || []).slice(0, 64)) {
                if (node.closest?.(OWNED) || node.disabled || node.hidden) continue;
                const style = win.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden' || !node.getClientRects().length) continue;
                return { node, style };
            }
        }
        return null;
    };
    const readNativeControls = (doc, win = defaultWindow) => {
        if (!doc || typeof win?.getComputedStyle !== 'function') return null;
        const button = findNative(doc, win, ['[data-fvplus-theme-native="button"]', 'input[type="button"], input[type="submit"]', 'button']);
        if (!button) return null;
        const size = parseFloat(button.style.fontSize);
        if (!Number.isFinite(size) || size < 8 || size > 32) return null;
        const height = button.node.getBoundingClientRect().height;
        if (height < 16 || height > 80) return null;
        return { fontFamily: button.style.fontFamily, fontSize: button.style.fontSize,
            fontWeight: button.style.fontWeight, lineHeight: button.style.lineHeight,
            letterSpacing: button.style.letterSpacing, textTransform: button.style.textTransform,
            padding: button.style.padding, radius: button.style.borderRadius,
            height: Math.max(30, height) + 'px' };
    };
    const controlTokens = (enabled, { document: doc, window: win = defaultWindow } = {}) => {
        const metrics = enabled ? readNativeControls(doc, win) : null;
        const fields = { 'font-family':'fontFamily', 'font-size':'fontSize', 'font-weight':'fontWeight',
            'line-height':'lineHeight', 'letter-spacing':'letterSpacing', 'text-transform':'textTransform',
            padding:'padding', radius:'radius', height:'height' };
        return Object.fromEntries(Object.entries(fields).map(([name, field]) => ['--fvplus-host-control-' + name, metrics?.[field] || '']));
    };
    const applyControlState = (doc, tokens) => {
        const node = doc?.documentElement;
        const value = tokens['--fvplus-host-control-font-size'] ? 'host' : 'fallback';
        if (node?.getAttribute?.('data-fv-host-controls') !== value) node?.setAttribute?.('data-fv-host-controls', value);
    };

    // System colors pass through the same writer as every other resolved output.
    const SYSTEM_COLORS = {
        "--fvplus-system-control-border": "1px solid ButtonText",
        "--fvplus-system-focus-color": "Highlight",
        "--fvplus-ui-page": "Canvas",
        "--fvplus-ui-panel": "Canvas",
        "--fvplus-ui-card": "Canvas",
        "--fvplus-ui-card-fg": "CanvasText",
        "--fvplus-ui-input": "Field",
        "--fvplus-ui-input-fg": "FieldText",
        "--fvplus-ui-control": "ButtonFace",
        "--fvplus-ui-control-fg": "ButtonText",
        "--fvplus-ui-control-hover": "Highlight",
        "--fvplus-ui-control-hover-fg": "HighlightText",
        "--fvplus-ui-control-active": "Highlight",
        "--fvplus-ui-control-active-fg": "HighlightText",
        "--fvplus-ui-text-primary": "CanvasText",
        "--fvplus-ui-text-muted": "CanvasText",
        "--fvplus-ui-text-dim": "CanvasText",
        "--fvplus-ui-border-subtle": "ButtonText",
        "--fvplus-ui-border-strong": "ButtonText",
        "--fvplus-ui-focus-ring": "Highlight",
        "--fvplus-theme-foreground": "CanvasText",
        "--fvplus-runtime-menu-bg": "Canvas",
        "--fvplus-runtime-menu-fg": "CanvasText",
        "--fvplus-runtime-menu-border": "CanvasText",
        "--fvplus-runtime-menu-muted": "CanvasText",
        "--fvplus-runtime-menu-hover-bg": "Highlight",
        "--fvplus-runtime-menu-hover-fg": "HighlightText",
        "--fvplus-settings-text-primary": "CanvasText",
        "--fvplus-settings-text-muted": "CanvasText",
        "--fvplus-settings-surface-panel": "Canvas",
        "--fvplus-settings-surface-field": "Field",
        "--fvplus-settings-button-fg": "ButtonText",
        "--fvplus-settings-button-bg-top": "ButtonFace",
        "--fvplus-settings-button-bg-bottom": "ButtonFace",
        "--fvplus-editor-bg": "Canvas",
        "--fvplus-editor-panel": "Canvas",
        "--fvplus-editor-text-primary": "CanvasText",
        "--fvplus-editor-muted": "CanvasText",
        "--fvplus-editor-input-bg": "Field",
        "--fvplus-dashboard-quick-action-fg": "ButtonText",
        "--fvplus-dashboard-quick-action-hover-fg": "HighlightText",
        "--fvplus-dashboard-quick-action-active-fg": "HighlightText",
        "--fvplus-dashboard-quick-action-bg-top": "ButtonFace",
        "--fvplus-dashboard-quick-action-bg-bottom": "ButtonFace"
    };
    const applySystemColors = (tokens, win = defaultWindow) => {
        const forced = !!win.matchMedia?.('(forced-colors: active)')?.matches;
        for (const [name, color] of Object.entries(SYSTEM_COLORS)) {
            if (forced) tokens[name] = color;
            else if (!(name in tokens)) tokens[name] = '';
        }
    };

    const readAuroraEnvironment = (doc, win = defaultWindow) => {
        const assets = { colors: false, enhancements: false, sidebar: false, enhancementScript: false };
        const knownAsset = (href, pattern) => {
            try {
                const url = new URL(href, doc.baseURI);
                return url.origin === new URL(doc.baseURI).origin && pattern.test(url.pathname);
            } catch (_error) { return false; }
        };
        for (const link of Array.from(doc?.querySelectorAll?.('link[rel~="stylesheet"][href]') || [])) {
            if (link.disabled || (link.media && !win.matchMedia?.(link.media)?.matches)) continue;
            if (knownAsset(link.href, /^\/plugins\/Aurora-Theme\/styles\/theme(?:-\d+)?\.css$/i)) assets.colors = true;
            if (knownAsset(link.href, /^\/plugins\/Aurora-Theme\/styles\/enhance(?:-\d+)?\.css$/i)) assets.enhancements = true;
            if (knownAsset(link.href, /^\/plugins\/Aurora-Theme\/styles\/layout-sidebar(?:-\d+)?\.css$/i)) assets.sidebar = true;
        }
        assets.enhancementScript = Array.from(doc?.querySelectorAll?.('script[src]') || []).some(script =>
            knownAsset(script.src, /^\/plugins\/Aurora-Theme\/scripts\/enhance(?:-\d+)?\.js$/i));
        const has = token => doc?.documentElement?.classList?.contains(token) === true;
        return { detected: Object.values(assets).some(Boolean), ...assets,
            enhancementsEnabled: has('tp-enhance'), sidebarEnabled: has('tp-sidebar'),
            sidebarCollapsed: has('tp-sidebar-collapsed'), topbar: has('tp-topbar'),
            plusMarker: has('tp-fvplus'), plusView: win.auroraDockerView?.plus === true,
            compactDockerTable: doc?.querySelector?.('#docker_containers')?.classList?.contains('tp-compact') === true };
    };

    const readHostIdentity = (doc, win = defaultWindow) => {
        const declared = String(doc?.documentElement?.getAttribute?.('data-fvplus-theme-name')
            || doc?.body?.getAttribute?.('data-fvplus-theme-name') || '').trim().slice(0, 96);
        if (declared) return { name:declared, source:'declared' };
        if (readAuroraEnvironment(doc, win).colors) return { name:'Aurora Theme', source:'recognized' };
        const base = String(doc?.documentElement?.getAttribute?.('data-fvplus-host-theme')
            || doc?.body?.getAttribute?.('data-fvplus-host-theme') || win.FolderViewPlusHostThemeName || '').trim().toLowerCase();
        const name = { black:'Unraid Black', white:'Unraid White', gray:'Unraid Gray', azure:'Unraid Azure' }[base];
        return name ? { name, source:'native-base' } : { name:'', source:'unknown' };
    };

    const describeIntegration = ({ document:doc, window:win = defaultWindow, hostColors, applied, requestedMode, appliedMode }) => {
        const forced = !!win.matchMedia?.('(forced-colors: active)')?.matches;
        return { identitySource:readHostIdentity(doc, win).source,
            paletteSource:forced ? 'system' : applied ? (hostColors?.source === 'computed' ? 'computed' : 'variables') : 'fallback',
            reason:forced ? 'forced-colors' : ['safe','highcontrast'].includes(requestedMode) ? 'requested-recovery'
                : applied ? 'none' : appliedMode !== requestedMode ? 'contrast-recovery' : 'missing-host-inputs' };
    };

    const readComputedPalette = (styleSources, { document: doc, window: win = defaultWindow, parseColor, isColorUsable } = {}) => {
        // Defined-but-invalid variables must retain the existing recovery behavior.
        if ((styleSources || []).some(style => ['--background-color', '--table-background-color', '--dashboard-background-color']
            .some(name => String(style.getPropertyValue(name) || '').trim()))) return null;
        if (!doc?.body || typeof win?.getComputedStyle !== 'function') return null;
        const surface = findNative(doc, win, ['[data-fvplus-theme-native="surface"]', 'table']);
        const button = findNative(doc, win, ['[data-fvplus-theme-native="button"]', 'input[type="button"], input[type="submit"]', 'button']);
        const field = findNative(doc, win, ['input[type="text"], input:not([type]), select, textarea']);
        if (!surface && !button && !field) return null;
        // The resolver never paints body/html backgrounds. Plugin roots and resolved
        // component colors are excluded; no probe nodes or saved output tokens are read.
        const body = win.getComputedStyle(doc.body), html = win.getComputedStyle(doc.documentElement);
        const solid = value => { const color = parseColor(value); return isColorUsable(color, 0.999) ? color : null; };
        const page = solid(body.backgroundColor) || solid(html.backgroundColor);
        if (!page) return null;
        const text = solid(surface?.style.color) || solid(body.color);
        if (!text) return null;
        const card = solid(surface?.style.backgroundColor) || page;
        const link = findNative(doc, win, ['[data-fvplus-theme-native="link"]', 'a[href]']);
        return { source:'computed', page, card, text, accent:solid(link?.style.color),
            input:solid(field?.style.backgroundColor) || card, inputText:solid(field?.style.color),
            control:solid(button?.style.backgroundColor) || card, controlText:solid(button?.style.color),
            border:solid(surface?.style.borderTopColor) || solid(button?.style.borderTopColor),
            radius:button?.style.borderRadius || '8px' };
    };

    const resolveSurfaceContrast = (palette, page, { contrastRatio, blendColors, toCss, parseColor }) => {
        const host = palette.hostColors || {};
        const solid = (color, background) => blendColors(color || background, background, color ? (color.a ?? 1) : 1);
        const panel = solid(palette.surfacePanel, page), card = solid(palette.surfaceCard, panel);
        const input = solid(host.input || card, panel), control = solid(host.control || card, panel);
        const hover = solid(host.controlHover || host.subtle || card, panel), active = blendColors(palette.accent, panel, 0.14);
        const choose = (preferred, backgrounds) => {
            const candidates = [preferred, palette.textPrimary, parseColor('#000000'), parseColor('#ffffff')].filter(Boolean);
            const score = color => Math.min(...backgrounds.map(background => contrastRatio(solid(color, background), background)));
            return candidates.find(color => score(color) >= 4.5) || candidates.sort((a,b) => score(b)-score(a))[0];
        };
        const accentText = choose(palette.accent, [active, blendColors(palette.accent, page, 0.14)]);
        const pairs = {
            hostPanelText:[palette.textPrimary,panel], hostCardText:[palette.textPrimary,card],
            hostPanelMuted:[palette.textMuted,panel], hostPanelDim:[palette.textDim,panel],
            hostInputText:[host.inputText || palette.textPrimary,input], hostControlText:[host.controlText || palette.textPrimary,control],
            hostControlHoverText:[palette.textPrimary,hover], hostControlActiveText:[accentText,active],
            hostMenuText:[palette.textPrimary,panel], hostMenuMuted:[palette.textMuted,panel], hostMenuHoverText:[palette.textPrimary,active]
        };
        const tokens = { hostControlActive:toCss(active) }, checks = [];
        for (const [name,[preferred,background]] of Object.entries(pairs)) {
            const color = choose(preferred,[background]), ratio = contrastRatio(solid(color,background),background);
            tokens[name] = toCss(color);
            checks.push({name:'surface.'+name,ratio:Number(ratio.toFixed(3)),minRatio:4.5,passed:ratio>=4.5,adjusted:toCss(color)!==toCss(preferred)});
        }
        return { tokens, checks, accentText, cardForeground:choose(palette.runtimeForeground,[card]), statusBackground:card };
    };

    const THEME_CHECK_NAMES = new Set(['textPrimary','textMuted','textDim','accent','body-text',
        ...['hostPanelText','hostCardText','hostPanelMuted','hostPanelDim','hostInputText','hostControlText',
            'hostControlHoverText','hostControlActiveText','hostMenuText','hostMenuMuted','hostMenuHoverText'].map(name => 'surface.' + name)]);
    const sanitizeDiagnostics = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const snapshot = value.resolver || {}, state = snapshot.hostIntegration || {};
        const choice = (input, allowed, fallback) => allowed.includes(input) ? input : fallback;
        const number = input => typeof input === 'number' && Number.isFinite(input) ? Math.max(0, Math.min(21, input)) : 0;
        const modes = ['auto','host','safe','highcontrast'];
        const check = input => ({ ratio:number(input?.ratio), minRatio:number(input?.minRatio),
            passed:typeof input?.passed === 'boolean' ? input.passed : number(input?.minRatio) > 0 && number(input?.ratio) >= number(input?.minRatio),
            adjusted:input?.adjusted === true, autoHealed:input?.autoHealed === true });
        const count = input => Math.min(32, Array.isArray(input) ? input.length : 0);
        return { schemaVersion:1, resolver:{
            requestedMode:choice(snapshot.requestedMode,modes,'auto'), appliedMode:choice(snapshot.appliedMode,modes,'auto'),
            classification:choice(snapshot.classification,['dark','light','mixed'],'mixed'),
            hostPaletteApplied:snapshot.hostPaletteApplied === true, autoHealed:snapshot.autoHealed === true,
            hostIntegration:{
                identitySource:choice(state.identitySource,['declared','recognized','native-base','unknown'],'unknown'),
                paletteSource:choice(state.paletteSource,['variables','computed','fallback','system'],'fallback'),
                reason:choice(state.reason,['none','forced-colors','requested-recovery','contrast-recovery','missing-host-inputs'],'missing-host-inputs'),
                nativeControls:state.nativeControls === true
            },
            contrastChecks:(Array.isArray(snapshot.contrastChecks) ? snapshot.contrastChecks : []).slice(0,32)
                .filter(entry => THEME_CHECK_NAMES.has(entry?.name)).map(entry => ({ name:entry.name, ...check(entry) })),
            statusChecks:Object.fromEntries(['started','paused','stopped'].map(name => [name,check(snapshot.statusChecks?.[name])]))
        }, warnings:Array(count(value.warnings)).fill('theme-warning'), adjustments:Array(count(value.adjustments)).fill('theme-adjustment') };
    };

    const diagnosticMessages = (snapshot, translate) => {
        const state = snapshot?.hostIntegration;
        return state ? [translate('diagnostics.cards.theme-integration', 'Palette source: $1. Recovery reason: $2. Native sizing: $3.', state.paletteSource, state.reason, String(state.nativeControls === true))] : [];
    };
    const documentWatchers = new WeakMap();
    const createDocumentWatcher = (doc, win) => {
        const subscribers = new Set(), removals = [];
        let active = false, timer = null, generation = 0;
        const attributes = ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme', 'data-fv-host-theme', 'data-fvplus-host-theme', 'data-fvplus-theme-name'];
        const clearPending = () => { if (timer !== null) win.clearTimeout(timer); timer = null; };
        const queue = reason => {
            if (!active) return;
            clearPending();
            timer = win.setTimeout(() => {
                timer = null;
                for (const subscriber of subscribers) subscriber.change(reason);
            }, 24);
        };
        const listen = (target, name, callback, options) => {
            if (typeof target?.addEventListener !== 'function') return;
            target.addEventListener(name, callback, options);
            removals.push(() => target.removeEventListener(name, callback, options));
        };
        const isSheet = node => node?.nodeType === 1 && (['STYLE','LINK'].includes(node.tagName)
            || !!node.querySelector?.('style, link[rel~="stylesheet"]'));
        const stop = () => {
            active = false; generation++; clearPending();
            while (removals.length) removals.pop()();
        };
        const connect = () => {
            if (active) return;
            active = true;
            const current = ++generation;
            const Observer = win.MutationObserver || (typeof MutationObserver === 'function' ? MutationObserver : null);
            if (Observer) {
                const observer = new Observer(mutations => {
                    if ((mutations || []).some(mutation => {
                        if (mutation.type === 'attributes') return !mutation.target || mutation.target === doc.documentElement
                            || mutation.target === doc.body || isSheet(mutation.target);
                        if (mutation.target?.parentElement?.closest?.('style') || mutation.target?.tagName === 'STYLE') return true;
                        return [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])].some(isSheet);
                    })) queue('observer');
                });
                for (const target of [doc.documentElement, doc.body].filter(Boolean)) observer.observe(target, { attributes:true, attributeFilter:attributes });
                if (doc.head) observer.observe(doc.head, { subtree:true, childList:true, characterData:true,
                    attributes:true, attributeFilter:['href','rel','disabled','media'] });
                removals.push(() => observer.disconnect());
            }
            const sheetLoaded = event => { if (isSheet(event.target)) queue(event.type === 'load' ? 'stylesheet-loaded' : 'stylesheet-error'); };
            listen(doc, 'load', sheetLoaded, true); listen(doc, 'error', sheetLoaded, true);
            listen(win, 'folderviewplus:theme-change', () => queue('theme-event'));
            listen(win, 'resize', () => queue('viewport'), { passive:true });
            for (const query of ['(prefers-color-scheme: dark)', '(prefers-contrast: more)', '(forced-colors: active)']) {
                const media = win.matchMedia?.(query), mediaListener = () => queue('media-change');
                if (typeof media?.addEventListener === 'function') {
                    media.addEventListener('change', mediaListener);
                    removals.push(() => media.removeEventListener('change', mediaListener));
                } else if (typeof media?.addListener === 'function') {
                    media.addListener(mediaListener); removals.push(() => media.removeListener(mediaListener));
                }
            }
            listen(doc.fonts, 'loadingdone', () => queue('fonts-loaded'));
            if (doc.fonts?.status === 'loading') Promise.resolve(doc.fonts.ready).then(() => {
                if (active && generation === current) queue('fonts-ready');
            }).catch(() => {});
        };
        const suspend = () => { for (const subscriber of subscribers) subscriber.suspend?.(); stop(); };
        const resume = () => { if (!active && subscribers.size) { connect(); queue('pageshow'); } };
        win.addEventListener?.('pagehide', suspend); win.addEventListener?.('pageshow', resume);
        return { subscribe(change, suspendCallback) {
            const subscriber = { change, suspend:suspendCallback }; subscribers.add(subscriber); connect();
            let subscribed = true;
            return () => {
                if (!subscribed) return;
                subscribed = false;
                subscribers.delete(subscriber);
                if (!subscribers.size) {
                    stop(); win.removeEventListener?.('pagehide', suspend); win.removeEventListener?.('pageshow', resume);
                    documentWatchers.delete(doc);
                }
            };
        } };
    };
    const observeThemeChanges = (change, { document: doc = defaultWindow.document, window: win = defaultWindow, onSuspend } = {}) => {
        if (!doc || typeof change !== 'function') return () => {};
        let watcher = documentWatchers.get(doc);
        if (!watcher) { watcher = createDocumentWatcher(doc, win); documentWatchers.set(doc, watcher); }
        return watcher.subscribe(change, onSuspend);
    };

    const createBinding = (options = {}) => {
        const win = options.window || defaultWindow;
        const doc = options.document || win?.document || null;
        const applyResolvedThemeTokens = typeof options.applyResolvedThemeTokens === 'function'
            ? options.applyResolvedThemeTokens
            : (() => null);
        const root = options.root ?? null;
        const sampleRoot = options.sampleRoot ?? null;
        const extraTargets = options.extraTargets ?? [];
        const modeInput = options.modeInput ?? null;
        const getMode = options.getMode;
        const trackEvent = options.trackEvent;
        const reasonPrefix = String(options.reasonPrefix || 'surface');
        const applyDelayMs = Number.isFinite(Number(options.applyDelayMs))
            ? Math.max(0, Number(options.applyDelayMs))
            : 48;
        const onApply = typeof options.onApply === 'function' ? options.onApply : null;
        let timer = null;
        let unsubscribe = null;
        let bound = false;

        const runApply = (reason = 'initial') => {
            const snapshot = applyResolvedThemeTokens(`${reasonPrefix}:${reason}`, {
                root,
                sampleRoot,
                extraTargets,
                modeInput,
                getMode,
                trackEvent,
                document: doc,
                window: win
            });
            onApply?.(snapshot, reason);
            return snapshot;
        };

        const queueApply = (reason = 'theme-change') => {
            if (timer !== null) win.clearTimeout(timer);
            timer = win.setTimeout(() => {
                timer = null;
                runApply(reason);
            }, applyDelayMs);
        };

        const bind = () => {
            runApply('initial');
            if (bound) return;
            bound = true;
            unsubscribe = observeThemeChanges(queueApply, { document:doc, window:win,
                onSuspend:() => { if (timer !== null) win.clearTimeout(timer); timer = null; } });
        };

        const disconnect = () => {
            if (timer !== null) win.clearTimeout(timer);
            timer = null;
            unsubscribe?.(); unsubscribe = null;
            bound = false;
        };

        return Object.freeze({ bind, runApply, queueApply, disconnect });
    };

    return Object.freeze({ diagnosticMessages, sanitizeDiagnostics, isDiagnosticCheckName:name => THEME_CHECK_NAMES.has(name), readNativeControls, controlTokens, applyControlState, applySystemColors, readAuroraEnvironment, readHostIdentity, describeIntegration, readComputedPalette, resolveSurfaceContrast, observeThemeChanges, createBinding });
}));
