(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    const modules = root.FolderViewPlusFoundationModules ||= {};
    if (modules.folderEditorDiagnostics) return;
    modules.folderEditorDiagnostics = api;
    let controller;
    const start = () => {
        const form = root.document.querySelector('.folder-editor-form');
        if (form && !controller) controller = api.createApi({ window: root, form });
    };
    root.addEventListener('pagehide', () => { controller?.capture('leave'); controller?.destroy(); controller = null; });
    root.addEventListener('pageshow', start);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const states = new WeakMap();
    const createApi = ({ window: win, form }) => {
        const doc = form.ownerDocument, store = win.FolderViewPlusUiStateDiagnostics;
        const listeners = [];
        let timer = null, destroyed = false;
        const state = states.get(form) || { phase: 'ready', source: 'builtin', applyCount: 0, cancelCount: 0, discardedCompletions: 0, uploadErrorCount: 0 };
        states.set(form, state);
        const on = (node, event, callback) => { node.addEventListener(event, callback); listeners.push(() => node.removeEventListener(event, callback)); };
        const capture = (captureReason = 'form') => {
            if (destroyed || !store) return;
            try {
                const type = form.dataset.type || win.FolderViewPlusFolderEditorPageType;
                const parent = form.querySelector('[data-editor-panel="parent"]'), icon = form.querySelector('[data-editor-panel="icon"]');
                const picker = form.querySelector('#fv-icon-library-home');
                const measure = node => store.measure?.(node, win) || { available: false };
                const parentPanel = measure(parent), iconPanel = measure(icon);
                const scope = form.querySelector(state.source === 'collections' ? '#fv-third-party-icon-panel' : (state.source === 'uploads' ? '#fv-custom-icon-panel' : '#fv-icon-picker-panel'));
                const cards = scope?.querySelectorAll('.fv-icon-picker-item,.fv-third-party-icon-item,.fv-custom-icon-row') || [];
                const sample = Array.from({ length: Math.min(cards.length, 32) }, (_, index) => cards[index]).filter(node => node.getBoundingClientRect().width > 0), widths = [], sizes = [];
                let overflowingCards = 0, overflowingButtonRows = 0;
                for (const card of sample) {
                    const box = card.getBoundingClientRect(), image = card.querySelector('img')?.getBoundingClientRect();
                    widths.push(box.width); if (image) sizes.push(Math.max(image.width, image.height));
                    if (card.scrollWidth > card.clientWidth + 1) overflowingCards++;
                    const buttons = Array.from(card.querySelectorAll('.fv-custom-icon-actions button:not([data-action="use"])')).map(node => node.getBoundingClientRect());
                    if (buttons.some(rect => rect.left < box.left || rect.right > box.right || Math.abs(rect.top - buttons[0].top) > 1)) overflowingButtonRows++;
                }
                const disabled = Array.from(form.querySelectorAll('.fv-dependent-disabled'));
                const previewDisabledRows = disabled.filter(node => /(?:^|\s)preview-/.test(node.getAttribute('constraint') || '')).length;
                const contextDisabledRows = disabled.filter(node => /(?:^|\s)context-/.test(node.getAttribute('constraint') || '')).length;
                const help = Array.from(form.querySelectorAll('[data-fv-setting-info]'));
                const theme = doc.documentElement.dataset.fvplusHostTheme || doc.body?.dataset.fvplusHostTheme;
                store.record('editor', type, { ...state, captureReason,
                    section: form.querySelector('.fv-section-nav .is-active')?.getAttribute('data-target') || 'general',
                    parentPanel, iconPanel, picker: measure(picker), toolbar: measure(form.querySelector('.fv-icon-source-bar')),
                    panelsSideBySide: parentPanel.visible === true && iconPanel.visible === true && Math.abs(parent.getBoundingClientRect().top - icon.getBoundingClientRect().top) < 2 && Math.abs(parent.getBoundingClientRect().left - icon.getBoundingClientRect().left) > 2,
                    panelHeightDifferencePx: Math.abs((parentPanel.heightPx || 0) - (iconPanel.heightPx || 0)),
                    cardCount: cards.length, sampledCards: sample.length, truncated: cards.length > sample.length, overflowingCards, overflowingButtonRows,
                    minCardWidthPx: widths.length ? Math.min(...widths) : 0, maxCardWidthPx: widths.length ? Math.max(...widths) : 0,
                    minIconSizePx: sizes.length ? Math.min(...sizes) : 0, maxIconSizePx: sizes.length ? Math.max(...sizes) : 0,
                    disabledRows: disabled.length, previewDisabledRows, contextDisabledRows, otherDisabledRows: disabled.filter(node => !/(?:^|\s)(?:preview|context)-/.test(node.getAttribute('constraint') || '')).length,
                    disabledControls: form.querySelectorAll('.fv-dependent-disabled :is(input,select,textarea,button):disabled').length,
                    helpButtons: help.length, missingHelpTargets: help.filter(node => !doc.getElementById(node.dataset.fvSettingInfo)).length,
                    pickerModuleLoaded: typeof win.FolderViewPlusFoundationModules?.iconBrowser?.createApi === 'function', pickerInitialized: !!picker?.querySelector('.fv-icon-browser-footer button'),
                    helpModuleLoaded: typeof win.FolderViewPlusFoundationModules?.folderEditorHelp?.createApi === 'function', helpInitialized: help.length > 0,
                    theme: theme === 'white' ? 'light' : (theme === 'black' ? 'dark' : (win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')),
                    direction: win.getComputedStyle(form).direction, viewportWidthPx: win.innerWidth, viewportHeightPx: win.innerHeight, devicePixelRatio: win.devicePixelRatio,
                    coarsePointer: win.matchMedia?.('(pointer: coarse)').matches === true, reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
                });
            } catch (_error) { /* A snapshot must never interfere with the editor. */ }
        };
        const schedule = reason => { win.clearTimeout(timer); timer = win.setTimeout(() => capture(reason), 100); };
        on(form, 'fvplus:editor-icon-diagnostics', event => {
            const data = event.detail || {};
            for (const key of ['phase', 'source', 'reason', 'draftMatchesField', 'rollbackAvailable', 'cancelRestorationAttempted', 'cancelRestored', 'fieldIsEmpty', 'uploadPending']) {
                if (Object.prototype.hasOwnProperty.call(data, key)) state[key] = data[key];
            }
            if (data.phase === 'applied') state.applyCount++;
            if (data.phase === 'cancelled') state.cancelCount++;
            if (data.phase === 'stale-completion') state.discardedCompletions++;
            if (data.phase === 'upload-error') state.uploadErrorCount++;
            if (data.phase !== 'source-changed') capture('icon');
            schedule('icon');
        });
        on(form, 'input', () => schedule('form')); on(form, 'change', () => schedule('form'));
        on(doc, 'fvplus:editor-section-change', () => schedule('section'));
        on(win, 'resize', () => schedule('resize'));
        schedule('initial');
        return Object.freeze({ capture, destroy: () => { destroyed = true; win.clearTimeout(timer); listeners.forEach(remove => remove()); } });
    };
    return Object.freeze({ createApi });
}));
