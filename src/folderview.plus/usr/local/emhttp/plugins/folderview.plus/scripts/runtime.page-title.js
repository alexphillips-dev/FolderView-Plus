// Shared appearance for the Settings preview and the Docker page title.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-normalization.js'));
        return;
    }
    root.FolderViewPlusFoundationModules.pageTitle = factory(root.FolderViewPlusFoundationModules.utilityNormalization);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(normalization) {
    'use strict';
    const registeredFonts = new WeakMap();
    const applyFont = (element, font) => {
        const bundled = Object.hasOwn(normalization.PAGE_TITLE_FONTS, font);
        const doc = element.ownerDocument, win = doc?.defaultView;
        if (bundled && doc?.fonts && typeof win?.FontFace === 'function') {
            let registered = registeredFonts.get(doc);
            if (!registered) { registered = new Set(); registeredFonts.set(doc, registered); }
            if (!registered.has(font)) {
                const face = new win.FontFace(`FV Title ${font}`, `url("/plugins/folderview.plus/fonts/page-title/${font}.woff2")`,
                    { weight: normalization.PAGE_TITLE_FONTS[font][1], display: 'swap' });
                doc.fonts.add(face); registered.add(font);
            }
        }
        element.style.fontFamily = bundled ? `"FV Title ${font}", sans-serif` : font === 'theme' ? 'inherit' : font;
    };
    const applyAppearance = (element, value) => {
        const prefs = normalization.normalizePageTitle(value);
        element.textContent = prefs.text;
        applyFont(element, prefs.font);
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
        let fontList = null, fontAnchor = null, activeFont = 0, search = '', searchedAt = 0;
        const syncFont = () => {
            const select = field('font'), button = field('font-picker');
            if (!button) return;
            if (select.options.length === 4) for (const [id, [name]] of Object.entries(normalization.PAGE_TITLE_FONTS)) {
                const option = doc.createElement('option'); option.value = id; option.textContent = name; select.append(option);
            }
            button.textContent = select.selectedOptions[0]?.textContent || '';
            applyFont(button, select.value);
        };
        const closeFont = () => {
            fontList?.remove(); fontList = null; search = '';
            field('font-picker')?.setAttribute('aria-expanded', 'false');
            field('font-picker')?.removeAttribute('aria-activedescendant');
        };
        const highlightFont = index => {
            activeFont = Math.max(0, Math.min(fontList.children.length - 1, index));
            for (const [i, option] of [...fontList.children].entries()) option.classList.toggle('is-active', i === activeFont);
            const option = fontList.children[activeFont];
            field('font-picker').setAttribute('aria-activedescendant', option.id);
            if (option.offsetTop < fontList.scrollTop) fontList.scrollTop = option.offsetTop;
            else if (option.offsetTop + option.offsetHeight > fontList.scrollTop + fontList.clientHeight) fontList.scrollTop = option.offsetTop + option.offsetHeight - fontList.clientHeight;
        };
        const openFont = () => {
            if (fontList) return;
            syncFont();
            const select = field('font'), button = field('font-picker'), bounds = button.getBoundingClientRect();
            fontAnchor = bounds;
            fontList = doc.createElement('div'); fontList.id = 'docker-page-title-font-list';
            fontList.className = 'fv-page-title-font-list'; fontList.setAttribute('role', 'listbox');
            fontList.setAttribute('aria-labelledby', 'docker-page-title-font-label');
            for (const [i, entry] of [...select.options].entries()) {
                const option = doc.createElement('div'); option.id = `docker-page-title-font-option-${i}`;
                option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(entry.value === select.value));
                option.dataset.fvFont = entry.value; option.textContent = entry.textContent;
                applyFont(option, entry.value); fontList.append(option);
            }
            doc.getElementById('fv-settings-root').append(fontList);
            const below = win.innerHeight - bounds.bottom - 12, above = bounds.top - 12, up = below < 220 && above > below;
            fontList.style.width = `${Math.min(Math.max(bounds.width, 220), win.innerWidth - 16)}px`;
            fontList.style.left = `${Math.max(8, Math.min(bounds.left, win.innerWidth - fontList.offsetWidth - 8))}px`;
            fontList.style.maxHeight = `${Math.max(36, Math.min(340, up ? above : below))}px`;
            fontList.style.top = `${up ? bounds.top - fontList.offsetHeight - 4 : bounds.bottom + 4}px`;
            button.setAttribute('aria-expanded', 'true'); highlightFont(select.selectedIndex);
        };
        const chooseFont = value => {
            const select = field('font'), changed = select.value !== value;
            select.value = value; closeFont(); syncFont(); preview(); field('font-picker').focus();
            if (changed) select.dispatchEvent(new win.Event('change', { bubbles: true }));
        };
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
            if (!prefs.enabled) closeFont();
            if (!field('text')) return;
            syncFont();
            for (const key of ['text', 'font', 'size']) if (!drafts.has(key)) field(key).value = prefs[key];
            syncFont();
            if (fontList) for (const option of fontList.children) option.setAttribute('aria-selected', String(option.dataset.fvFont === prefs.font));
            for (const key of ['bold', 'italic']) if (!drafts.has(key)) field(key).checked = prefs[key];
            applyAppearance(field('preview'), prefs);
            const rgb = win.getComputedStyle(field('preview')).color.match(/\d+/g);
            if (!drafts.has('color')) field('color').value = prefs.color === 'theme'
                ? (rgb?.length >= 3 ? '#' + rgb.slice(0, 3).map(part => Number(part).toString(16).padStart(2, '0')).join('') : '#ffffff') : prefs.color;
            preview();
        };
        const change = event => {
            const key = event.target?.dataset?.fvTitleField;
            if (key) { drafts.delete(key); if (key === 'font') syncFont(); onChange(key, event.target.type === 'checkbox' ? event.target.checked : event.target.value); }
        };
        const input = event => { const key = event.target?.dataset?.fvTitleField; if (key) { drafts.add(key); preview(); } };
        const click = event => {
            if (event.target?.closest?.('#docker-page-title-font-picker')) { if (fontList) closeFont(); else openFont(); }
            const option = event.target?.closest?.('[data-fv-font]');
            if (option && fontList?.contains(option)) chooseFont(option.dataset.fvFont);
            if (event.target?.closest?.('[data-fv-page-title-reset]')) { closeFont(); drafts.clear(); onReset(); }
            if (event.target?.closest?.('[data-fv-page-title-theme]')) { drafts.delete('color'); onChange('color', 'theme'); }
        };
        const keydown = event => {
            if (event.target !== field('font-picker')) return;
            const key = event.key;
            if (key === 'Tab' || key === 'Escape') { closeFont(); if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); } return; }
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key) && key.length !== 1) return;
            event.preventDefault(); event.stopPropagation();
            if (key === 'Enter' || key === ' ') { if (fontList) chooseFont(fontList.children[activeFont].dataset.fvFont); else openFont(); return; }
            const wasOpen = !!fontList; openFont();
            if (key === 'Home' || key === 'End') highlightFont(key === 'Home' ? 0 : fontList.children.length - 1);
            else if (key === 'ArrowDown' || key === 'ArrowUp') { if (wasOpen) highlightFont(activeFont + (key === 'ArrowDown' ? 1 : -1)); }
            else {
                const now = Date.now(); search = now - searchedAt > 700 ? key : search + key; searchedAt = now;
                const prefix = [...search].every(char => char.toLowerCase() === search[0].toLowerCase()) ? search[0] : search;
                const options = [...fontList.children];
                const match = options.map((_, i) => (activeFont + i + (prefix.length === 1 ? 1 : 0)) % options.length)
                    .find(i => options[i].textContent.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()));
                if (match !== undefined) highlightFont(match);
            }
        };
        const pointerdown = event => {
            if (!fontList) return;
            if (fontList.contains(event.target)) { if (event.pointerType === 'mouse') event.preventDefault(); }
            else if (event.target !== field('font-picker')) closeFont();
        };
        const scroll = event => {
            if (!fontList || event.target === fontList) return;
            const bounds = field('font-picker').getBoundingClientRect();
            if (bounds.top !== fontAnchor.top || bounds.left !== fontAnchor.left) closeFont();
        };
        doc?.addEventListener('change', change); doc?.addEventListener('input', input); doc?.addEventListener('click', click);
        doc?.addEventListener('keydown', keydown); doc?.addEventListener('pointerdown', pointerdown); doc?.addEventListener('scroll', scroll, true);
        win?.addEventListener?.('resize', closeFont);
        const dispose = () => {
            closeFont();
            doc?.removeEventListener('change', change); doc?.removeEventListener('input', input); doc?.removeEventListener('click', click);
            doc?.removeEventListener('keydown', keydown); doc?.removeEventListener('pointerdown', pointerdown); doc?.removeEventListener('scroll', scroll, true);
            win?.removeEventListener?.('resize', closeFont);
        };
        return Object.freeze({ sync, dispose });
    };
    return Object.freeze({ applyAppearance, createController, createSettingsController });
}));
