// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.themeSurface = factory(root);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(defaultWindow) {
    'use strict';

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
        let observer = null;
        let media = null;
        let mediaListener = null;
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
            const Observer = win.MutationObserver
                || (typeof MutationObserver === 'function' ? MutationObserver : null);
            const attributes = [
                'class',
                'style',
                'data-theme',
                'theme',
                'data-color-scheme',
                'data-bs-theme',
                'data-fv-host-theme',
                'data-fvplus-host-theme'
            ];
            if (Observer) {
                observer = new Observer((mutations) => {
                    if ((mutations || []).some((mutation) => (
                        mutation.type === 'attributes'
                        && (!mutation.attributeName || attributes.includes(String(mutation.attributeName).toLowerCase()))
                    ))) queueApply('observer');
                });
                for (const target of [doc?.documentElement, doc?.body].filter(Boolean)) {
                    observer.observe(target, { attributes: true, attributeFilter: attributes });
                }
            }
            if (typeof win.matchMedia === 'function') {
                media = win.matchMedia('(prefers-color-scheme: dark)');
                mediaListener = () => queueApply('prefers-color-scheme');
                if (typeof media?.addEventListener === 'function') media.addEventListener('change', mediaListener);
                else if (typeof media?.addListener === 'function') media.addListener(mediaListener);
            }
        };

        const disconnect = () => {
            if (timer !== null) win.clearTimeout(timer);
            timer = null;
            observer?.disconnect();
            observer = null;
            if (media && mediaListener && typeof media.removeEventListener === 'function') {
                media.removeEventListener('change', mediaListener);
            } else if (media && mediaListener && typeof media.removeListener === 'function') {
                media.removeListener(mediaListener);
            }
            media = null;
            mediaListener = null;
            bound = false;
        };

        return Object.freeze({ bind, runApply, queueApply, disconnect });
    };

    return Object.freeze({ createBinding });
}));
