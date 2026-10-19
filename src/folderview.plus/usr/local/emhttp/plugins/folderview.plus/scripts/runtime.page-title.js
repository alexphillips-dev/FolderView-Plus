// Shared appearance for the Settings preview and the Docker page title.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-normalization.js'));
        return;
    }
    root.FolderViewPlusFoundationModules.pageTitle = factory(root.FolderViewPlusFoundationModules.utilityNormalization);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(normalization) {
    'use strict';
    const applyAppearance = (element, value) => {
        const prefs = normalization.normalizePageTitle(value);
        element.textContent = prefs.text;
        element.style.fontFamily = prefs.font === 'theme' ? 'inherit' : prefs.font;
        element.style.fontSize = `${prefs.size}px`;
        element.style.fontWeight = prefs.bold ? '700' : '400';
        element.style.fontStyle = prefs.italic ? 'italic' : 'normal';
        element.style.color = prefs.color === 'theme' ? '' : prefs.color;
    };
    const createController = ({ window: win = globalThis.window, document: doc = win?.document, resolveHost = () => null, getPrefs = () => ({}) } = {}) => {
        let host = null, title = null, observer = null, frame = 0, disposed = false;
        const measure = () => {
            if (!host || !title) return;
            const bounds = host.getBoundingClientRect();
            let left = bounds.right;
            // Include native text nodes as well as the plugin's search and toggle shells.
            for (const node of host.childNodes) {
                if (node === title || (node.nodeType === 3 && !node.textContent.trim())) continue;
                const range = doc.createRange();
                range.selectNode(node);
                for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) left = Math.min(left, rect.left);
            }
            title.style.width = `${Math.max(0, win.matchMedia('(max-width: 600px)').matches ? bounds.width : left - bounds.left - 12)}px`;
        };
        const queueMeasure = () => {
            if (disposed || frame) return;
            frame = win.requestAnimationFrame(() => { frame = 0; measure(); });
        };
        const unmount = () => {
            observer?.disconnect(); observer = null;
            title?.remove(); title = null;
            host?.classList.remove('fvplus-page-title-host');
            host?.style.removeProperty('--fv-page-title-height');
            host = null;
        };
        const sync = () => {
            if (disposed) return;
            const prefs = normalization.normalizePageTitle(getPrefs());
            const nextHost = prefs.enabled ? resolveHost() : null;
            if (host !== nextHost || !title?.isConnected) unmount();
            if (!nextHost) return;
            host = nextHost;
            if (!title) {
                title = doc.createElement('span'); title.id = 'fvplus-docker-page-title';
                title.className = 'fvplus-docker-page-title';
                host.classList.add('fvplus-page-title-host');
                host.prepend(title);
            }
            applyAppearance(title, prefs);
            host.style.setProperty('--fv-page-title-height', `${Math.ceil(prefs.size * 1.2)}px`);
            observer?.disconnect();
            if (typeof win.ResizeObserver === 'function') {
                observer = new win.ResizeObserver(queueMeasure);
                observer.observe(host);
                for (const child of host.children) if (child !== title) observer.observe(child);
            }
            measure();
        };
        win?.addEventListener('resize', queueMeasure);
        const dispose = () => {
            disposed = true;
            if (frame) win.cancelAnimationFrame(frame);
            win?.removeEventListener('resize', queueMeasure);
            unmount();
        };
        return Object.freeze({ sync, dispose });
    };
    const createSettingsController = ({ window: win = globalThis.window, document: doc = win?.document, getPrefs = () => ({}), onChange = () => {}, onReset = () => {} } = {}) => {
        const field = key => doc?.getElementById(`docker-page-title-${key}`);
        const drafts = new Set();
        const preview = () => {
            const element = field('preview');
            if (element) applyAppearance(element, { ...getPrefs(), text: field('text').value, font: field('font').value,
                size: field('size').value, bold: field('bold').checked, italic: field('italic').checked,
                color: drafts.has('color') ? field('color').value : getPrefs().color });
        };
        const sync = () => {
            const prefs = normalization.normalizePageTitle(getPrefs());
            if (!field('enabled')) return;
            field('enabled').checked = prefs.enabled;
            const template = field('template');
            if (prefs.enabled && !field('fields') && template) {
                template.after(template.content.cloneNode(true));
                win.FolderViewPlusI18n?.translate(field('fields'));
            }
            if (field('fields')) field('fields').hidden = !prefs.enabled;
            if (!field('text')) return;
            for (const key of ['text', 'font', 'size']) if (!drafts.has(key)) field(key).value = prefs[key];
            for (const key of ['bold', 'italic']) if (!drafts.has(key)) field(key).checked = prefs[key];
            applyAppearance(field('preview'), prefs);
            const rgb = win.getComputedStyle(field('preview')).color.match(/\d+/g);
            if (!drafts.has('color')) field('color').value = prefs.color === 'theme'
                ? (rgb?.length >= 3 ? '#' + rgb.slice(0, 3).map(part => Number(part).toString(16).padStart(2, '0')).join('') : '#ffffff') : prefs.color;
            preview();
        };
        const change = event => {
            const key = event.target?.dataset?.fvTitleField;
            if (key) { drafts.delete(key); onChange(key, event.target.type === 'checkbox' ? event.target.checked : event.target.value); }
        };
        const input = event => { const key = event.target?.dataset?.fvTitleField; if (key) { drafts.add(key); preview(); } };
        const click = event => {
            if (event.target?.closest?.('[data-fv-page-title-reset]')) { drafts.clear(); onReset(); }
            if (event.target?.closest?.('[data-fv-page-title-theme]')) { drafts.delete('color'); onChange('color', 'theme'); }
        };
        doc?.addEventListener('change', change); doc?.addEventListener('input', input); doc?.addEventListener('click', click);
        const dispose = () => {
            doc?.removeEventListener('change', change); doc?.removeEventListener('input', input); doc?.removeEventListener('click', click);
        };
        return Object.freeze({ sync, dispose });
    };
    return Object.freeze({ applyAppearance, createController, createSettingsController });
}));
