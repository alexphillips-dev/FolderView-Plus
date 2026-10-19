// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFolderSettingsMenu = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const menuT = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params)
        || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
    const labels = () => ({ appearance: menuT('docker.transfer.appearance', 'Appearance'),
        layout: menuT('docker.transfer.layout', 'Layout and previews'), behavior: menuT('docker.transfer.behavior', 'Behavior'),
        actions: menuT('docker.transfer.actions', 'Custom actions') });
    const createApi = (deps = {}) => {
        const win = deps.window || globalThis, doc = win.document, transfer = deps.transfer;
        const ui = deps.ui || win.FolderViewPlusUI;
        const escape = deps.escapeHtml || (value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
        const ids = Object.keys(labels()), bindings = new Map(), decorated = new WeakSet(), hoverTimers = new Map();
        let toast = null, timer = null, busy = false, disposed = false;
        const selected = category => category === 'all' ? [...ids] : [category];
        const names = categories => categories.map(category => labels()[category]).join(', ');
        const stamp = entry => {
            const date = new Date(entry.copiedAt);
            if (Number.isNaN(date.getTime())) return menuT('docker.transfer.unknown-time', 'Unknown copy time');
            const options = { dateStyle: 'short', timeStyle: 'short' };
            const absolute = win.FolderViewPlusI18n?.formatDate?.(date, options) || date.toLocaleString('en', options);
            const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
            const relative = win.FolderViewPlusI18n?.formatRelativeTime?.(-minutes, 'minute', { numeric: 'auto' })
                || new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-minutes, 'minute');
            return `${absolute} (${relative})`;
        };
        const notify = message => {
            if (disposed) return;
            ui?.announce?.({ message });
            if (!doc?.body) return;
            toast?.remove();
            if (timer !== null) win.clearTimeout(timer);
            toast = doc.createElement('div');
            toast.className = 'fv-settings-transfer-toast';
            toast.setAttribute('role', 'status');
            toast.textContent = message;
            doc.body.append(toast);
            timer = win.setTimeout(() => { toast?.remove(); toast = null; timer = null; }, 4000);
        };
        const guarded = async action => {
            if (busy || disposed) return;
            busy = true;
            try { return await action(); }
            catch (error) {
                if (disposed) return;
                await ui?.alert?.({ title: menuT('docker.transfer.failed', 'Settings transfer failed'),
                    message: menuT('docker.transfer.retry', 'The folder or copied settings may have changed. Refresh and try again.'), tone: 'danger' });
                deps.onError?.(error);
            } finally { busy = false; }
        };
        const reason = category => {
            const entry = transfer.readClipboardEntry('docker');
            if (!entry) return menuT('docker.transfer.copy-first', 'Copy settings from a Docker folder first.');
            if (category !== 'all' && !entry.categories.includes(category)) return menuT('docker.transfer.category-missing', 'This category was not included in the copied settings.');
            return '';
        };
        const copy = (id, category = 'all') => guarded(async () => {
            if (!deps.ensureUnlocked(id, menuT('docker.transfer.copy', 'Copy folder settings'))) return;
            const source = deps.getFolder(id);
            if (!source) return;
            await transfer.loadSchema();
            if (disposed) return;
            const entry = transfer.buildClipboardEntry('docker', source, { sourceId: id, sourceName: source.name,
                sourceContext: 'docker-runtime', categories: selected(category) });
            if (!transfer.writeClipboardEntry(entry)) throw new Error('Clipboard storage unavailable.');
            notify(menuT('docker.transfer.copied', '$1 copied.', names(entry.categories)));
        });
        const paste = (id, category = 'all') => guarded(async () => {
            const unavailable = reason(category);
            if (unavailable) { notify(unavailable); return; }
            if (!deps.ensureUnlocked(id, menuT('docker.transfer.paste', 'Paste folder settings'))) return;
            await transfer.loadSchema();
            if (disposed) return;
            const entry = transfer.readClipboardEntry('docker');
            if (!entry || reason(category)) return;
            const categories = category === 'all' ? entry.categories : selected(category);
            const request = { type: 'docker', targetIds: JSON.stringify([id]), categories: JSON.stringify(categories), settings: JSON.stringify(transfer.selectPayload(entry.payload, categories)) };
            const preview = (await deps.post('/plugins/folderview.plus/server/apply_folder_settings.php', { ...request, preview: '1' })).result;
            if (disposed) return;
            if (!preview.updatedCount) { notify(menuT('docker.transfer.matches', '$1 already matches. No changes needed.', names(categories))); return; }
            const changed = preview.changes[id] || categories;
            const accepted = await ui.confirm({ title: menuT('docker.transfer.paste', 'Paste folder settings'),
                message: menuT('docker.transfer.preview', 'Apply $1 to $2?', names(changed), deps.getFolder(id)?.name || ''),
                detail: menuT('docker.transfer.source', 'Copied from $1 · $2. Other settings, members, matching rules, and WebUI profiles will be kept. A safety backup will be created.', entry.sourceName, stamp(entry)),
                confirmLabel: menuT('docker.transfer.apply', 'Paste'), cancelLabel: menuT('common.cancel', 'Cancel') });
            if (!accepted || disposed || !deps.ensureUnlocked(id, menuT('docker.transfer.paste', 'Paste folder settings'))) return;
            const current = transfer.readClipboardEntry('docker');
            if (JSON.stringify(current) !== JSON.stringify(entry)) throw new Error('Clipboard changed during confirmation.');
            const result = (await deps.post('/plugins/folderview.plus/server/apply_folder_settings.php', { ...request, expectedRevision: preview.folderRevision })).result;
            if (disposed) return;
            if (!result.updatedCount) { notify(menuT('docker.transfer.matches', '$1 already matches. No changes needed.', names(categories))); return; }
            notify(menuT('docker.transfer.applied', '$1 applied. A safety backup was created.', names(changed)));
            deps.refresh();
        });
        const view = () => {
            const entry = transfer.readClipboardEntry();
            if (!entry) { notify(reason('all')); return; }
            return ui.alert({ title: menuT('docker.transfer.view', 'Copied settings'),
                message: menuT('docker.transfer.details', 'Source: $1 ($2). Copied: $3. Categories: $4. Settings: $5. Script actions: $6. Member-bound actions skipped: $7.',
                    entry.sourceName, entry.type === 'docker' ? 'Docker' : 'VM', stamp(entry), names(entry.categories), Object.keys(entry.payload.settings).length,
                    entry.payload.actions.length, entry.meta.droppedMemberBoundActionCount), tone: 'info' });
        };
        const clear = () => {
            if (!transfer.clearClipboardEntry()) return notify(menuT('docker.transfer.clear-failed', 'Copied settings could not be cleared.'));
            notify(menuT('docker.transfer.cleared', 'Copied settings cleared.'));
        };
        const item = (key, text, icon, action, disabledReason = () => '') => {
            bindings.set(key, { disabledReason });
            return { text: escape(text), icon: `${icon} fv-transfer-marker fv-transfer-${key}`, disabled: !!disabledReason(),
                action: event => { event?.preventDefault?.(); const why = disabledReason(); if (why) notify(why); else return action(); } };
        };
        const buildMenuItems = id => {
            const groupLabels = labels();
            const entry = transfer.readClipboardEntry('docker');
            const title = entry ? menuT('docker.transfer.paste-from', 'Paste settings from $1', String(entry.sourceName || '').slice(0, 48))
                : menuT('docker.transfer.paste-menu', 'Paste Folder Settings');
            return [
                { text: escape(menuT('docker.transfer.copy-menu', 'Copy Folder Settings')), icon: 'fa-files-o', subMenu: ['all', ...ids].map(category =>
                    item(`copy-${category}`, category === 'all' ? menuT('docker.transfer.all', 'All settings') : menuT('docker.transfer.only', '$1 only', groupLabels[category]), 'fa-copy', () => copy(id, category))) },
                { text: escape(title), icon: 'fa-clipboard', subMenu: ['all', ...ids].map(category =>
                    item(`paste-${category}`, category === 'all' ? menuT('docker.transfer.all-copied', 'All copied settings…') : menuT('docker.transfer.paste-only', '$1 only…', groupLabels[category]), 'fa-clipboard', () => paste(id, category), () => reason(category))) },
                { divider: true },
                item('view', menuT('docker.transfer.view-menu', 'View copied settings…'), 'fa-info-circle', view, () => transfer.readClipboardEntry() ? '' : reason('all')),
                item('clear', menuT('docker.transfer.clear', 'Clear copied settings'), 'fa-eraser', clear, () => transfer.readClipboardEntry() ? '' : reason('all'))
            ];
        };
        const decorate = (menus = null) => {
            if (!doc) return;
            const icons = menus ? new Set(menus.flatMap(menu => [...menu.querySelectorAll('.fv-transfer-marker')])) : doc.querySelectorAll('.fv-transfer-marker');
            for (const icon of icons) {
                const key = [...icon.classList].find(value => value.startsWith('fv-transfer-') && value !== 'fv-transfer-marker')?.slice(12);
                const row = icon.closest('li'), link = row?.querySelector(':scope > a');
                if (!link || !bindings.has(key)) continue;
                const disabled = bindings.get(key).disabledReason();
                row.classList.toggle('disabled', !!disabled);
                link.setAttribute('aria-disabled', String(!!disabled));
                link.title = disabled || link.textContent.trim();
                link.tabIndex = disabled ? -1 : 0;
                let menu = row.parentElement;
                while (menu?.tagName === 'UL') {
                    menu.setAttribute('role', 'group');
                    menu.style.backdropFilter = 'none';
                    for (const sibling of menu.children) {
                        const anchor = sibling.querySelector(':scope > a'), child = sibling.querySelector(':scope > ul');
                        sibling.setAttribute('role', anchor ? 'none' : 'separator');
                        if (!anchor || decorated.has(anchor)) continue;
                        decorated.add(anchor);
                        if (!anchor.hasAttribute('role')) anchor.setAttribute('role', 'button');
                        if (child) anchor.setAttribute('aria-expanded', 'false');
                        const cancelClose = () => { if (hoverTimers.has(child)) win.clearTimeout(hoverTimers.get(child)); hoverTimers.delete(child); };
                        const open = () => {
                            if (!child) return;
                            cancelClose();
                            for (const peer of sibling.parentElement.children) if (peer !== sibling) {
                                const list = peer.querySelector(':scope > ul'), trigger = peer.querySelector(':scope > a');
                                if (list) { list.style.display = 'none'; trigger?.setAttribute('aria-expanded', 'false'); }
                            }
                            sibling.classList.remove('fvplus-context-submenu-open-up', 'fvplus-context-submenu-open-left');
                            child.classList.add('fv-settings-transfer-menu', 'fvplus-docker-context-menu');
                            Object.assign(child.style, { display: 'block', position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto' });
                            child.style.maxHeight = 'calc(100vh - 20px)';
                            let box = child.getBoundingClientRect();
                            const trigger = anchor.getBoundingClientRect();
                            const fitsRight = trigger.right + box.width <= win.innerWidth - 10;
                            const fitsLeft = trigger.left - box.width >= 10;
                            let top = Math.max(10, Math.min(trigger.top, win.innerHeight - box.height - 10));
                            if (!fitsRight && !fitsLeft) {
                                const below = win.innerHeight - trigger.bottom - 10, above = trigger.top - 10;
                                child.style.maxHeight = `min(${Math.max(0, below >= above ? below : above)}px, calc(100vh - 20px))`;
                                box = child.getBoundingClientRect();
                                top = below >= above ? trigger.bottom : trigger.top - box.height;
                            }
                            const left = trigger.right + box.width <= win.innerWidth - 10 ? trigger.right : trigger.left - box.width;
                            child.style.left = `${Math.max(10, Math.min(left, win.innerWidth - box.width - 10))}px`;
                            child.style.top = `${top}px`;
                            anchor.setAttribute('aria-expanded', 'true'); deps.reflow?.();
                        };
                        const close = () => { if (!child) return; cancelClose(); child.style.display = 'none'; anchor.setAttribute('aria-expanded', 'false'); };
                        if (child) {
                            sibling.addEventListener('mouseenter', open);
                            child.addEventListener('mouseenter', cancelClose);
                            sibling.addEventListener('mouseleave', () => {
                                cancelClose();
                                hoverTimers.set(child, win.setTimeout(() => { hoverTimers.delete(child); if (!child.matches(':hover') && !child.contains(doc.activeElement) && doc.activeElement !== anchor) close(); }, 180));
                            });
                        }
                        anchor.addEventListener('click', event => {
                            if (anchor.getAttribute('aria-disabled') === 'true') { event.preventDefault(); event.stopImmediatePropagation(); return; }
                            if (child) { event.preventDefault(); event.stopImmediatePropagation(); open(); anchor.focus({ preventScroll: true }); }
                        }, true);
                        anchor.addEventListener('keydown', event => {
                            const currentMenu = anchor.parentElement.parentElement;
                            const peers = [...currentMenu.querySelectorAll(':scope > li > a')].filter(node => node.getAttribute('aria-disabled') !== 'true');
                            const index = peers.indexOf(anchor);
                            let target = null;
                            if (event.key === 'ArrowDown') target = peers[(index + 1) % peers.length];
                            if (event.key === 'ArrowUp') target = peers[(index - 1 + peers.length) % peers.length];
                            if (event.key === 'Home') target = peers[0];
                            if (event.key === 'End') target = peers.at(-1);
                            if (['ArrowRight', 'Enter', ' '].includes(event.key) && child) { open(); target = child.querySelector('li:not(.disabled) > a'); }
                            if (['Enter', ' '].includes(event.key) && !child) { event.preventDefault(); event.stopPropagation(); anchor.click(); return; }
                            if (['ArrowLeft', 'Escape'].includes(event.key)) {
                                const parent = currentMenu.parentElement;
                                if (parent?.tagName === 'LI') { currentMenu.style.display = 'none'; target = parent.querySelector(':scope > a'); target?.setAttribute('aria-expanded', 'false'); }
                            }
                            if (target) { event.preventDefault(); event.stopPropagation(); target.focus(); }
                        });
                    }
                    menu = menu.parentElement?.closest('ul');
                }
            }
        };
        win.addEventListener?.('pagehide', () => { disposed = true; toast?.remove(); if (timer !== null) win.clearTimeout(timer); for (const pending of hoverTimers.values()) win.clearTimeout(pending); hoverTimers.clear(); }, { once: true });
        return Object.freeze({ copy, paste, view, clear, buildMenuItems, decorate });
    };
    return Object.freeze({ createApi });
}));
