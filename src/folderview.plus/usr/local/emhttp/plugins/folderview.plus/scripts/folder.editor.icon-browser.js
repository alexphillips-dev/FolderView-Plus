// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules ||= {};
    root.FolderViewPlusFoundationModules.iconBrowser = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const surfaceT = (key, fallback) => globalThis.FolderViewPlusI18n?.t?.(key, fallback) || fallback;
    const labels = () => ({
        builtin: surfaceT('legacy.surface.c55a471f24b6805c', 'Built-in icons'),
        collections: surfaceT('common.icon-browser.collections', 'Collections'),
        uploads: surfaceT('common.icon-browser.uploads', 'My uploads')
    });
    // The editor field remains authoritative. Browsing only writes it on confirmation.
    const createApi = ({ window: win = globalThis, getValue = () => '', setValue = () => {},
        defaultIcon = '', sanitizeImageUrl = (_value, fallback) => fallback,
        describe = () => null, activate = () => {}, onCommit = () => {} } = {}) => {
        const doc = win.document;
        const home = doc?.getElementById('fv-icon-library-home');
        const library = doc?.getElementById('fv-icon-library');
        const ui = win.FolderViewPlusUI;
        const workspace = home ? { element: home, body: home.querySelector('.fv-icon-browser-body'), footer: home.querySelector('.fv-icon-browser-footer') } : null;
        let draft = '';
        let committed = getValue();
        let source = 'builtin';
        let generation = 0;
        const scroll = new Map();
        const sourceIds = { builtin: 'fv-icon-picker', collections: 'fv-third-party-icon', uploads: 'fv-custom-icon' };
        const tabs = { builtin: 'fv-icon-picker-toggle', collections: 'fv-icon-third-party-toggle', uploads: 'fv-icon-custom-manager-toggle' };
        const enabled = Boolean(library && workspace?.body && workspace?.footer && ui?.openModal);
        const byId = (id) => doc?.getElementById(id);
        const text = (id, value) => { const node = byId(id); if (node) node.textContent = value; };
        const info = (value) => {
            const known = describe(value);
            if (known) return known;
            if (!value || value === defaultIcon) return { name: surfaceT('common.icons.default-folder', 'Default Folder'), source: labels().builtin };
            try {
                const url = new URL(value, win.location.href);
                const file = url.searchParams.get('file');
                if (url.pathname.includes('/third_party_icons.php') && file) return { name: file, source: url.searchParams.get('folder') || labels().collections };
                if (url.pathname.includes('/images/custom/')) return { name: decodeURIComponent(url.pathname.split('/').pop()), source: labels().uploads };
            } catch (_error) { /* A pasted data image or incomplete URL still gets a readable label. */ }
            return { name: surfaceT('common.icon-browser.external', 'External icon'), source: surfaceT('common.icon-browser.path', 'Icon URL or path') };
        };
        const updateImage = (image, value) => {
            if (!image) return;
            image.src = sanitizeImageUrl(value, defaultIcon);
            image.onerror = () => { image.onerror = null; image.src = defaultIcon; };
        };
        const sync = () => {
            if (!enabled) return;
            const value = getValue();
            if (value !== committed) {
                committed = value;
                generation++;
                draft = value || defaultIcon;
                paintDraft();
            }
            const meta = info(value);
            updateImage(byId('fvIconPanelPreview'), value);
            text('fv-icon-selection-name', meta.name);
            text('fv-icon-selection-source', meta.source);
        };
        const paintDraft = () => {
            if (!enabled) return;
            const meta = info(draft);
            updateImage(workspace.footer.querySelector('img'), draft);
            workspace.footer.querySelector('[data-icon-draft-name]').textContent = meta.name;
            workspace.footer.querySelector('[data-icon-draft-source]').textContent = meta.source;
            // Update selection affordances without rebuilding or reordering a gallery under the pointer.
            library.querySelectorAll('[data-icon-value], [data-icon-url]').forEach((item) => {
                const selected = (item.dataset.iconValue || item.dataset.iconUrl) === draft;
                item.classList.toggle('is-selected', selected);
                const button = item.matches('button') ? item : item.querySelector('[data-icon-select], [data-action="use"]');
                button?.setAttribute('aria-pressed', String(selected));
            });
        };
        const stage = (value) => {
            if (!enabled) return;
            generation++;
            draft = String(value || '');
            paintDraft();
        };
        const changeSource = (next, remember = true) => {
            if (!enabled || !sourceIds[next]) return;
            if (remember) scroll.set(source, workspace.body.scrollTop);
            source = next;
            Object.entries(tabs).forEach(([key, id]) => {
                const tab = byId(id);
                tab?.setAttribute('aria-selected', String(key === source));
                if (tab) tab.tabIndex = key === source ? 0 : -1;
            });
            workspace.body.scrollTop = scroll.get(source) || 0;
        };
        const activateSource = (next, remember = true) => {
            const position = scroll.get(next) || 0;
            changeSource(next, remember);
            const token = generation;
            Promise.resolve(activate(next)).then(() => {
                if (token === generation && source === next) { workspace.body.scrollTop = position; paintDraft(); }
            });
        };
        const open = (next = source) => {
            if (!enabled) return;
            activateSource(next);
        };
        const reset = () => {
            generation++;
            draft = getValue() || defaultIcon;
            paintDraft();
        };
        const matchPanelHeight = () => {
            const panel = home.closest('[data-editor-panel="icon"]');
            const parent = panel?.parentElement.querySelector('[data-editor-panel="parent"]');
            if (!panel || !parent) return;
            const rect = parent.getBoundingClientRect();
            const iconRect = panel.getBoundingClientRect();
            const beside = rect.height > 0 && Math.abs(rect.top - iconRect.top) < 2 && Math.abs(rect.left - iconRect.left) > 2;
            panel.style.height = beside ? `${rect.height}px` : '';
            panel.classList.toggle('fv-icon-panel-bounded', beside);
        };
        if (enabled) {
            const actions = workspace.footer;
            const summary = doc.createElement('div');
            summary.className = 'fv-icon-draft';
            summary.innerHTML = '<img alt=""><div><strong data-icon-draft-name></strong><span data-icon-draft-source></span></div>';
            actions.appendChild(summary);
            const cancel = doc.createElement('button');
            cancel.type = 'button';
            cancel.className = 'fv-ui-button';
            cancel.textContent = surfaceT('legacy.surface.19766ed6ccb2f4a3', 'Cancel');
            cancel.addEventListener('click', reset);
            actions.appendChild(cancel);
            const use = doc.createElement('button');
            use.type = 'button';
            use.className = 'fv-ui-button is-primary';
            use.textContent = surfaceT('legacy.surface.5a6a57b41fdbaac9', 'Use icon');
            use.addEventListener('click', () => { const value = draft; onCommit(value); setValue(value); reset(); sync(); });
            actions.appendChild(use);
            workspace.body.addEventListener('scroll', () => scroll.set(source, workspace.body.scrollTop));
            doc.addEventListener('fvplus:editor-section-change', (event) => {
                if (event.detail?.section === 'general') { open('builtin'); win.requestAnimationFrame(matchPanelHeight); }
            });
            win.addEventListener('resize', matchPanelHeight);
            win.requestAnimationFrame(() => {
                const parent = home.closest('[data-editor-panel="icon"]')?.parentElement.querySelector('[data-editor-panel="parent"]');
                if (parent && win.ResizeObserver) new win.ResizeObserver(matchPanelHeight).observe(parent);
                matchPanelHeight();
            });
            reset();
        }
        const invalidate = (value) => {
            if (enabled && draft.split(/[?#]/, 1)[0] === String(value).split(/[?#]/, 1)[0]) stage(defaultIcon);
            sync();
        };
        const showDialog = (options, callback = () => {}) => {
            const content = doc.createElement('div');
            if (options.html) content.innerHTML = options.text;
            else content.textContent = options.text || '';
            const actions = doc.createElement('div');
            const child = ui.openModal({ title: options.title, content, actions, onClose: (reason) => callback(reason === 'confirm') });
            if (options.showCancelButton) {
                const cancel = doc.createElement('button');
                cancel.type = 'button'; cancel.className = 'fv-ui-button';
                cancel.textContent = options.cancelButtonText || surfaceT('legacy.surface.19766ed6ccb2f4a3', 'Cancel');
                cancel.onclick = () => child.close('cancel'); actions.appendChild(cancel);
            }
            const confirm = doc.createElement('button');
            confirm.type = 'button'; confirm.className = 'fv-ui-button';
            confirm.textContent = options.confirmButtonText || surfaceT('common.close', 'Close');
            confirm.onclick = () => child.close('confirm'); actions.appendChild(confirm);
        };
        const resolveCollision = () => new Promise((resolve) => {
            const content = doc.createElement('p');
            content.textContent = surfaceT('common.icon-browser.replace-message', 'An icon with this name already exists. Keep both files or replace the existing file.');
            const actions = doc.createElement('div');
            actions.className = 'fv-icon-collision-actions';
            const child = ui.openModal({ title: surfaceT('common.icon-browser.replace-title', 'Replace this icon?'), content, actions,
                onClose: (reason) => resolve(['keep', 'replace'].includes(reason) ? reason : null) });
            for (const [reason, label] of [['cancel', surfaceT('legacy.surface.19766ed6ccb2f4a3', 'Cancel')],
                ['replace', surfaceT('legacy.surface.95e154398a4bc009', 'Replace')], ['keep', surfaceT('common.icon-browser.keep-both', 'Keep both')]]) {
                const button = doc.createElement('button'); button.type = 'button'; button.className = 'fv-ui-button';
                button.textContent = label; button.onclick = () => child.close(reason); actions.appendChild(button);
            }
        });
        if (enabled) {
            library.querySelectorAll('button').forEach((button) => button.classList.add('fv-ui-button'));
            Object.entries(tabs).forEach(([key, id]) => {
                const tab = byId(id);
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-controls', `${sourceIds[key]}-panel`);
                const panel = byId(`${sourceIds[key]}-panel`);
                panel?.setAttribute('role', 'tabpanel');
                panel?.setAttribute('aria-labelledby', id);
                tab.onkeydown = (event) => {
                    const keys = Object.keys(tabs);
                    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                    if (!step && event.key !== 'Home' && event.key !== 'End') return;
                    event.preventDefault();
                    const index = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (keys.indexOf(key) + step * (doc.dir === 'rtl' ? -1 : 1) + keys.length) % keys.length;
                    byId(tabs[keys[index]]).click(); byId(tabs[keys[index]]).focus();
                };
            });
            sync();
        }
        return Object.freeze({ enabled, open, changeSource, stage, sync, invalidate, showDialog, resolveCollision,
            isOpen: () => enabled, getSelection: () => enabled ? draft : getValue(),
            token: () => generation, isCurrent: (token) => enabled && token === generation });
    };
    return Object.freeze({ createApi });
}));
