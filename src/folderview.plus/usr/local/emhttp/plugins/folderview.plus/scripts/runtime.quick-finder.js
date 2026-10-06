// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeQuickFinder = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const controllers = new WeakMap();
    const RESULT_LIMIT = 40;
    const fold = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const memberNames = (members) => Array.isArray(members) ? members.map(String) : Object.keys(members || {});

    const buildIndex = (folders = {}, runtime = {}, getMembers = (id) => folders[id]?.containers) => {
        const parents = new Map();
        const ancestors = (id) => {
            if (parents.has(id)) return parents.get(id);
            const path = [];
            const seen = new Set([id]);
            let parent = String(folders[id]?.parentId || folders[id]?.parent_id || '');
            while (parent && folders[parent] && !seen.has(parent)) {
                seen.add(parent);
                path.unshift(parent);
                parent = String(folders[parent]?.parentId || folders[parent]?.parent_id || '');
            }
            parents.set(id, path);
            return path;
        };
        const owners = new Map();
        const folderItems = Object.entries(folders).filter(([, folder]) => folder && typeof folder === 'object').map(([id, folder]) => ({
            key: `folder:${id}`, kind: 'folder', id, name: String(folder.name || id),
            ancestors: ancestors(id), entry: folder
        }));
        // Prefer the deepest owner if an ancestor exposes aggregated membership.
        folderItems.slice().sort((a, b) => a.ancestors.length - b.ancestors.length).forEach((item) => {
            memberNames(getMembers(item.id)).forEach((name) => owners.set(name, item.id));
        });
        const itemEntries = Object.entries(runtime).filter(([, entry]) => entry && typeof entry === 'object').map(([name, entry]) => {
            const owner = owners.get(name) || '';
            return {
                key: `item:${name}`, kind: 'item', id: name, name,
                ancestors: owner ? [...ancestors(owner), owner] : [], entry
            };
        });
        return [...folderItems, ...itemEntries].map((item) => {
            const path = item.ancestors.map((id) => String(folders[id]?.name || id)).join(' › ');
            return { ...item, path, search: fold(`${item.name} ${path}`) };
        });
    };
    const searchIndex = (items, query = '', filter = 'all') => {
        const terms = fold(query).trim().split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        return items.filter((item) => (filter === 'all' || item.kind === filter) && terms.every((term) => item.search.includes(term)));
    };

    const createApi = (deps = {}) => {
        const win = deps.window || globalThis;
        const doc = deps.document || win.document;
        const type = deps.type === 'vm' ? 'vm' : 'docker';
        const translate = (key, fallback, ...params) => win.FolderViewPlusI18n?.t?.(key, fallback, ...params)
            || fallback.replace(/\$(\d+)/g, (token, number) => String(params[Number(number) - 1] ?? token));
        const labels = {
            title: translate('legacy.surface.16ab51cd6d22c5cc', 'Quick finder'),
            placeholder: type === 'docker'
                ? translate('legacy.surface.ed6115e340fa8101', 'Find folder or container…')
                : translate('legacy.surface.da4264c9ced11596', 'Find folder or VM…'),
            all: translate('legacy.surface.a52ace420f2175d0', 'All'),
            folders: translate('legacy.surface.c4d6bb200f4c058a', 'Folders'),
            items: type === 'docker'
                ? translate('legacy.surface.a22daa7f02a26cc2', 'Containers')
                : translate('legacy.surface.0e39459d272d7f5f', 'Virtual machines'),
            root: translate('legacy.surface.0f416c84f4af17c6', 'Root level'),
            close: translate('legacy.surface.55656b5e434f4c06', 'Close search'),
            reveal: translate('legacy.surface.36b830bdb447f8c7', 'Reveal'),
            select: translate('legacy.surface.2a78025de6aae5e7', 'Select'),
            closed: translate('legacy.surface.7d9eb7acb13e2462', 'Close')
        };
        const actionLabels = {
            focus: translate('legacy.surface.d46681a9c5a875c4', 'Focus folder'),
            edit: translate('legacy.surface.fe82f5a54ad3a3dd', 'Edit folder'),
            webui: translate('legacy.surface.771dded9e684868e', 'Open WebUI'),
            logs: translate('legacy.surface.9ec41ffd7797fa24', 'View logs'),
            console: translate('legacy.surface.f4063d1b2a07230d', 'Open console'),
            actions: translate('legacy.surface.ff8059dc6752afdd', 'Actions')
        };
        const actionIcons = { focus: 'fa-bullseye', edit: 'fa-pencil', webui: 'fa-globe', logs: 'fa-bars', console: 'fa-terminal', actions: 'fa-ellipsis-h' };
        const prefix = `fvplus-${type}-quick-finder`;
        let shell = null, input = null, popover = null, results = null, count = null, trigger = null;
        let open = false, disposed = false, busy = false, filter = 'all', selected = '', entries = [], matches = [];
        let queryTimer = null, highlightTimer = null, highlightedRow = null;
        const listeners = [];
        const listen = (target, event, callback) => {
            target.addEventListener(event, callback);
            listeners.push(() => target.removeEventListener(event, callback));
        };
        const icon = (className) => {
            const node = doc.createElement('i');
            node.className = `fa ${className}`;
            node.setAttribute('aria-hidden', 'true');
            return node;
        };
        const button = (label, iconClass = '') => {
            const node = doc.createElement('button');
            node.type = 'button';
            if (iconClass) node.append(icon(iconClass));
            node.append(doc.createTextNode(label));
            return node;
        };
        const resultIcon = (item) => {
            const wrap = doc.createElement('span'); wrap.className = 'fv-quickfinder-icon'; wrap.setAttribute('aria-hidden', 'true');
            const fallback = icon(item.kind === 'folder' ? 'fa-folder-o' : type === 'vm' ? 'fa-desktop' : 'fa-cube');
            wrap.append(fallback);
            const source = deps.getIcon?.(item);
            if (source) {
                const image = doc.createElement('img'); image.alt = ''; image.decoding = 'async'; image.loading = 'lazy';
                fallback.hidden = true;
                image.addEventListener('error', () => {
                    win.FolderViewPlusFoundationModules?.imageFallbacks?.record?.(source);
                    image.remove(); fallback.hidden = false;
                }, { once: true });
                image.src = source; wrap.append(image);
            }
            return wrap;
        };
        const select = (key) => {
            selected = key;
            results?.querySelectorAll('[data-result-index]').forEach((row) => {
                row.setAttribute('aria-current', entries[Number(row.dataset.resultIndex)]?.key === key ? 'true' : 'false');
            });
        };
        const positionPopover = () => {
            if (!open || !shell?.isConnected) return;
            const bounds = shell.getBoundingClientRect();
            const width = Math.min(560, win.innerWidth - 24);
            const left = Math.max(12, Math.min(bounds.right - width, win.innerWidth - width - 12));
            const top = bounds.bottom + 7;
            popover.style.setProperty('--fv-finder-left', `${left}px`);
            popover.style.setProperty('--fv-finder-top', `${top}px`);
            popover.style.setProperty('--fv-finder-width', `${width}px`);
            popover.style.setProperty('--fv-finder-height', `${Math.max(80, Math.min(600, win.innerHeight - top - 12))}px`);
        };
        const close = (restoreFocus = false) => {
            open = false;
            clearTimeout(queryTimer);
            shell?.classList.remove('is-open');
            trigger?.setAttribute('aria-expanded', 'false');
            if (popover) popover.hidden = true;
            if (input) { input.value = ''; input.disabled = true; input.tabIndex = -1; }
            results?.replaceChildren(); selected = ''; matches = []; entries = [];
            shell?.querySelector('[data-finder-close]')?.setAttribute('hidden', '');
            if (restoreFocus) trigger?.focus({ preventScroll: true });
        };
        const runAction = async (item, action) => {
            if (busy || disposed) return;
            // Resolve again at click time; removed items and newly unavailable actions cannot use stale results.
            const current = deps.getEntries().find((candidate) => candidate.key === item.key);
            if (!current || !deps.getActions(current).includes(action) || deps.isActionEnabled?.(current, action) === false) { refresh(); return; }
            busy = true;
            shell.setAttribute('aria-busy', 'true');
            try {
                if (action === 'reveal') {
                    await deps.prepareReveal(current);
                    if (disposed) return;
                    const row = deps.findRow(current);
                    if (!row || !row.isConnected) throw new Error('unavailable');
                    close();
                    highlightedRow?.classList.remove('fv-quickfinder-highlight');
                    clearTimeout(highlightTimer);
                    highlightedRow = row;
                    row.classList.add('fv-quickfinder-highlight');
                    const previousTabIndex = row.getAttribute('tabindex');
                    row.setAttribute('tabindex', '-1');
                    row.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                    row.focus({ preventScroll: true });
                    if (previousTabIndex === null) row.removeAttribute('tabindex');
                    else row.setAttribute('tabindex', previousTabIndex);
                    highlightTimer = win.setTimeout(() => { row.classList.remove('fv-quickfinder-highlight'); highlightedRow = null; }, 2600);
                } else {
                    close(true);
                    await deps.runAction(current, action);
                }
            } catch (_error) {
                if (!disposed) {
                    const message = translate('legacy.surface.7013b0cddf5e6532', 'Search action failed.');
                    if (deps.onError) deps.onError(message);
                    else win.FolderViewPlusUI?.alert?.({ title: labels.title, message, tone: 'danger' });
                }
            } finally {
                busy = false;
                shell?.removeAttribute('aria-busy');
            }
        };
        const render = () => {
            if (!open || disposed) return;
            results.replaceChildren();
            matches = searchIndex(entries, input.value, filter);
            popover.hidden = !input.value.trim();
            trigger.setAttribute('aria-expanded', String(!popover.hidden));
            if (popover.hidden) { selected = ''; count.textContent = ''; return; }
            const visible = matches.slice(0, RESULT_LIMIT);
            count.textContent = translate('legacy.surface.477b5fc5edb6cb02', 'Results: $1', matches.length);
            for (const [kind, label] of [['folder', labels.folders], ['item', labels.items]]) {
                const group = visible.filter((item) => item.kind === kind);
                if (!group.length) continue;
                const heading = doc.createElement('h3'); heading.textContent = label; results.append(heading);
                group.forEach((item) => {
                    const row = doc.createElement('div'); row.className = 'fv-quickfinder-result'; row.dataset.resultIndex = String(entries.indexOf(item));
                    const title = button(''); title.append(resultIcon(item));
                    title.className = 'fv-quickfinder-result-title'; title.dataset.finderSelect = '';
                    const copy = doc.createElement('span'); copy.className = 'fv-quickfinder-copy';
                    const name = doc.createElement('strong'); name.className = 'fv-quickfinder-name'; name.textContent = item.name;
                    const path = doc.createElement('span'); path.className = 'fv-quickfinder-path'; path.textContent = item.path || labels.root;
                    copy.append(name, path); title.append(copy);
                    if (kind === 'item') {
                        const status = doc.createElement('span'); status.className = 'fv-quickfinder-status';
                        const state = deps.getState(item);
                        status.textContent = state === 'running' ? translate('legacy.surface.f4ccae29e1bb0c20', 'Running')
                            : state === 'paused' ? translate('legacy.surface.e159b06187d369a0', 'Paused')
                                : translate('legacy.surface.1a4f630ac1b69fd0', 'Stopped');
                        status.dataset.state = state; title.append(status);
                    }
                    row.append(title);
                    const actions = doc.createElement('div'); actions.className = 'fv-quickfinder-actions';
                    deps.getActions(item).filter((action) => actionLabels[action]).forEach((action) => {
                        const control = button(actionLabels[action], actionIcons[action]); control.dataset.finderAction = action;
                        control.disabled = deps.isActionEnabled?.(item, action) === false; actions.append(control);
                    });
                    row.append(actions); results.append(row);
                });
            }
            if (!visible.length || matches.length > RESULT_LIMIT) {
                const message = doc.createElement('p'); message.className = 'fv-quickfinder-message';
                message.textContent = !visible.length ? translate('legacy.surface.bb155c8458855d30', 'No matching folders or items.')
                    : translate('legacy.surface.fa7f6e591471d6be', 'Showing $1 of $2', visible.length, matches.length);
                results.append(message);
            }
            if (!visible.some((item) => item.key === selected)) selected = visible[0]?.key || '';
            select(selected);
            positionPopover();
        };
        const refresh = () => {
            if (!open || disposed) return;
            const focused = doc.activeElement?.closest?.('[data-result-index]');
            const focusedKey = focused ? entries[Number(focused.dataset.resultIndex)]?.key : '';
            const focusedAction = doc.activeElement?.dataset?.finderAction;
            entries = input.value.trim() ? deps.getEntries() : [];
            render();
            if (focusedKey) {
                const index = entries.findIndex((item) => item.key === focusedKey);
                const row = results.querySelector(`[data-result-index="${index}"]`);
                (focusedAction ? row?.querySelector(`[data-finder-action="${focusedAction}"]`) : row?.querySelector('[data-finder-select]'))?.focus();
                if (!shell.contains(doc.activeElement)) input.focus();
            }
        };
        const show = () => {
            if (disposed || !shell?.isConnected) return;
            open = true; shell.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true');
            input.disabled = false; input.tabIndex = 0; popover.hidden = false;
            shell.querySelector('[data-finder-close]').hidden = false;
            refresh(); input.focus({ preventScroll: true });
        };
        const mount = () => {
            if (disposed) return;
            const target = deps.resolveMount();
            if (!target?.host) return;
            if (shell?.isConnected && shell.parentElement === target.host) { refresh(); return; }
            close();
            if (shell) { listeners.splice(0).forEach((remove) => remove()); shell.remove(); }
            shell = doc.createElement('span'); shell.id = prefix; shell.className = 'fv-quickfinder';
            const field = doc.createElement('span'); field.className = 'fv-quickfinder-field';
            trigger = button('', 'fa-search'); trigger.setAttribute('aria-label', labels.title); trigger.title = labels.title;
            trigger.dataset.finderToggle = ''; trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', `${prefix}-popover`);
            input = doc.createElement('input'); input.type = 'search'; input.placeholder = labels.placeholder; input.setAttribute('aria-label', labels.placeholder);
            input.setAttribute('aria-controls', `${prefix}-results`); input.autocomplete = 'off'; input.spellcheck = false; input.disabled = true; input.tabIndex = -1;
            const dismiss = button('', 'fa-times'); dismiss.dataset.finderClose = ''; dismiss.setAttribute('aria-label', labels.close); dismiss.hidden = true;
            field.append(trigger, input, dismiss); shell.append(field);
            popover = doc.createElement('section'); popover.id = `${prefix}-popover`; popover.className = 'fv-quickfinder-popover'; popover.hidden = true; popover.setAttribute('aria-label', labels.title);
            const toolbar = doc.createElement('div'); toolbar.className = 'fv-quickfinder-filters';
            for (const [value, label] of [['all', labels.all], ['folder', labels.folders], ['item', labels.items]]) {
                const control = button(label); control.dataset.finderFilter = value; control.setAttribute('aria-pressed', value === filter ? 'true' : 'false'); toolbar.append(control);
            }
            count = doc.createElement('span'); count.className = 'fv-quickfinder-count'; count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); toolbar.append(count);
            results = doc.createElement('div'); results.id = `${prefix}-results`; results.className = 'fv-quickfinder-results';
            const footer = doc.createElement('div'); footer.className = 'fv-quickfinder-footer';
            footer.textContent = `↑ ↓ ${labels.select} · Enter ${labels.reveal} · Esc ${labels.closed}`;
            popover.append(toolbar, results, footer); shell.append(popover);
            target.host.classList.add('fv-quickfinder-mount');
            target.host.insertBefore(shell, target.anchor || target.host.firstChild);
            listen(shell, 'input', (event) => { if (event.target === input) { clearTimeout(queryTimer); if (!input.value.trim()) refresh(); else queryTimer = win.setTimeout(refresh, 60); } });
            listen(shell, 'click', (event) => {
                const control = event.target.closest?.('button');
                if (!control) return;
                event.preventDefault();
                if (control.hasAttribute('data-finder-toggle')) { open ? close(true) : show(); return; }
                if (control.hasAttribute('data-finder-close')) { close(true); return; }
                if (control.dataset.finderFilter) {
                    filter = control.dataset.finderFilter;
                    toolbar.querySelectorAll('[data-finder-filter]').forEach((node) => node.setAttribute('aria-pressed', node === control ? 'true' : 'false'));
                    render(); input.focus(); return;
                }
                const row = control.closest('[data-result-index]'); const item = entries[Number(row?.dataset.resultIndex)];
                if (item) runAction(item, control.dataset.finderAction || 'reveal');
            });
            listen(shell, 'focusin', (event) => {
                const row = event.target.closest?.('[data-result-index]');
                if (row) select(entries[Number(row.dataset.resultIndex)]?.key || '');
            });
            listen(doc, 'pointerdown', (event) => { if (open && !shell.contains(event.target)) close(); });
            listen(doc, 'focusin', (event) => { if (open && !shell.contains(event.target)) close(); });
            listen(win, 'resize', positionPopover);
            listen(win, 'scroll', () => {
                if (!open) return;
                const bounds = shell.getBoundingClientRect();
                if (bounds.bottom < 0 || bounds.top > win.innerHeight) close();
                else positionPopover();
            });
            listen(doc, 'keydown', (event) => {
                if (event.defaultPrevented || !shell.isConnected) return;
                if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
                    if (doc.querySelector('dialog[open], .sweet-alert.showSweetAlert')) return;
                    event.preventDefault(); show(); return;
                }
                if (!open || !shell.contains(event.target)) return;
                if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
                if (event.target === input && event.key === 'Enter') {
                    event.preventDefault(); const item = entries.find((candidate) => candidate.key === selected);
                    if (item) runAction(item, 'reveal'); return;
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    const titles = Array.from(results.querySelectorAll('[data-finder-select]'));
                    if (!titles.length) return;
                    event.preventDefault();
                    const current = titles.indexOf(event.target.closest?.('[data-result-index]')?.querySelector('[data-finder-select]'));
                    const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : titles.length - 1)
                        : (current + (event.key === 'ArrowDown' ? 1 : -1) + titles.length) % titles.length;
                    titles[next].focus();
                }
            });
        };
        const dispose = () => {
            close(); disposed = true;
            deps.onDispose?.();
            clearTimeout(highlightTimer); highlightedRow?.classList.remove('fv-quickfinder-highlight');
            listeners.splice(0).forEach((remove) => remove());
            const host = shell?.parentElement; shell?.remove();
            if (!host?.querySelector('.fv-quickfinder')) host?.classList.remove('fv-quickfinder-mount');
            if (controllers.get(doc) === api) controllers.delete(doc);
        };
        const api = Object.freeze({ mount, refresh, dispose, close });
        controllers.get(doc)?.dispose(); controllers.set(doc, api);
        return api;
    };
    return Object.freeze({ buildIndex, searchIndex, createApi, RESULT_LIMIT });
}));
