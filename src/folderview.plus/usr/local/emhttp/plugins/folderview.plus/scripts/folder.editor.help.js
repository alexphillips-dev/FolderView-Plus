(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    if (modules.folderEditorHelp) return;
    modules.folderEditorHelp = factory(root);
    let controller;
    const start = () => {
        const form = root.document.querySelector('.folder-editor-form');
        if (form && !controller) controller = modules.folderEditorHelp.createApi({ form });
    };
    root.addEventListener('pagehide', () => { controller?.destroy(); controller = null; });
    root.addEventListener('pageshow', start);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}(typeof globalThis !== 'undefined' ? globalThis : this, function(host) {
    const createApi = ({ form, window: win = host, ui = win.FolderViewPlusUI } = {}) => {
        const doc = form.ownerDocument;
        const listeners = [];
        let active = null, closeTimer = null, sequence = 0;
        const surfaceT = (key, fallback, ...params) => win.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (_, n) => String(params[Number(n) - 1] ?? ''));
        const on = (target, name, handler) => { target.addEventListener(name, handler); listeners.push(() => target.removeEventListener(name, handler)); };
        const cancelClose = () => { win.clearTimeout(closeTimer); closeTimer = null; };
        const close = () => { cancelClose(); active?.popover.close('dismiss', { restoreFocus: false }); };
        const labelFor = button => button.parentElement.querySelector('.fv-setting-label')?.textContent?.trim().replace(/:\s*$/, '') || '';
        const describe = button => button.setAttribute('aria-label', surfaceT('editor.settings.information-about', 'Information about $1', labelFor(button)));
        const scheduleClose = () => {
            cancelClose();
            closeTimer = win.setTimeout(() => {
                if (!active?.pinned && !active?.button.matches(':focus') && !active?.popover.element.contains(doc.activeElement)) close();
            }, 160);
        };
        const open = button => {
            cancelClose();
            if (active?.button === button) return;
            const help = doc.getElementById(button.dataset.fvSettingInfo);
            if (!help || !ui?.openPopover) return;
            close(); describe(button);
            const content = help.cloneNode(true);
            content.removeAttribute('id'); content.removeAttribute('hidden'); content.className = 'fv-setting-help-copy';
            content.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            const popover = ui.openPopover({ trigger: button, content, className: 'fv-setting-help-tip', role: 'tooltip', focus: false, returnFocus: false,
                placement: doc.documentElement.dir === 'rtl' ? 'bottom-end' : 'bottom-start',
                onClose: () => { button.removeAttribute('aria-describedby'); active = null; cancelClose(); } });
            if (!popover) return;
            popover.reposition();
            button.setAttribute('aria-describedby', popover.element.id);
            active = { button, help, popover, pinned: false };
            popover.element.addEventListener('pointerenter', cancelClose);
            popover.element.addEventListener('pointerleave', scheduleClose);
            popover.element.addEventListener('focusout', scheduleClose);
        };
        const refresh = () => {
            form.querySelectorAll('[data-fv-setting-info]').forEach(button => { if (!doc.getElementById(button.dataset.fvSettingInfo)) button.remove(); });
            form.querySelectorAll('.fv-setting-help').forEach(help => {
                const row = help.closest('.basic');
                const label = row?.querySelector(':scope > dl > dt');
                const panel = row?.closest('.fv-editor-panel');
                const usePanelHeading = panel?.hasAttribute('data-fv-heading-label') && row === panel.querySelector('.basic');
                const heading = usePanelHeading ? panel.querySelector('.fv-editor-panel-head h4') : label;
                if (!heading) return;
                if (usePanelHeading && label) {
                    label.classList.add('fv-panel-label'); label.hidden = true;
                    if (!heading.id) heading.id = `fv-panel-${panel.dataset.editorPanelSection}-${panel.dataset.editorPanel}-heading`;
                    panel.setAttribute('aria-labelledby', `${heading.id}-text`);
                    row.querySelectorAll('input, select, textarea').forEach(field => {
                        if (!field.labels?.length && !field.hasAttribute('aria-label') && !field.hasAttribute('aria-labelledby')) field.setAttribute('aria-labelledby', `${heading.id}-text`);
                    });
                }
                help.hidden = true;
                if (!help.id) { do { help.id = `fv-setting-help-${++sequence}`; } while (doc.querySelectorAll(`#${help.id}`).length > 1); }
                if (heading.querySelector(`[data-fv-setting-info="${help.id}"]`)) return;
                if (!heading.querySelector('.fv-setting-label')) {
                    const text = doc.createElement('span'); text.className = 'fv-setting-label';
                    while (heading.firstChild) text.appendChild(heading.firstChild);
                    Array.from(heading.attributes).filter(attr => attr.name.startsWith('data-i18n')).forEach(attr => { text.setAttribute(attr.name, attr.value); heading.removeAttribute(attr.name); });
                    heading.appendChild(text);
                }
                if (usePanelHeading) heading.querySelector('.fv-setting-label').id = `${heading.id}-text`;
                const button = doc.createElement('button'); button.type = 'button'; button.className = 'fv-setting-info';
                button.dataset.fvSettingInfo = help.id; button.setAttribute('aria-disabled', 'false'); button.setAttribute('data-i18n-ignore', '');
                button.innerHTML = ui.svgIcon('info-circle'); heading.appendChild(button); describe(button);
                heading.classList.add('fv-setting-heading');
            });
        };
        on(form, 'pointerover', event => { const button = event.target.closest('[data-fv-setting-info]'); if (button && event.pointerType !== 'touch') open(button); });
        on(form, 'pointerout', event => { const button = event.target.closest('[data-fv-setting-info]'); if (button && !button.contains(event.relatedTarget)) scheduleClose(); });
        on(form, 'focusin', event => { const button = event.target.closest('[data-fv-setting-info]'); if (button) open(button); });
        on(form, 'focusout', scheduleClose);
        on(form, 'click', event => {
            const button = event.target.closest('[data-fv-setting-info]'); if (!button) return;
            event.preventDefault(); event.stopPropagation();
            if (active?.button === button && active.pinned) close();
            else { open(button); if (active) active.pinned = true; }
        });
        on(form, 'fvplus:editor-section-change', close);
        on(form, 'submit', close);
        const observer = new win.MutationObserver(records => {
            if (active && (!active.button.isConnected || !active.help.isConnected)) close();
            if (records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1 && (node.matches('.fv-setting-help') || node.querySelector('.fv-setting-help'))))) refresh();
        });
        observer.observe(form, { childList: true, subtree: true });
        refresh();
        return Object.freeze({ refresh, destroy: () => { close(); observer.disconnect(); listeners.splice(0).forEach(remove => remove()); } });
    };
    return Object.freeze({ createApi });
}));
