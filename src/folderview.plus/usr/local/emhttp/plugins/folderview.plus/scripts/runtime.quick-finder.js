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
        const actionIcons = { focus: 'fa-bullseye', edit: 'fa-pencil', webui: 'fa-globe', logs: 'fa-bars', console: 'fa-terminal', actions: 'fa-ellipsis-v' };
        const prefix = `fvplus-${type}-quick-finder`;
        let shell = null, input = null, popover = null, results = null, count = null, trigger = null;
        let open = false, disposed = false, busy = false, filter = 'all', selected = '', entries = [], matches = [];
        let queryTimer = null, highlightTimer = null, highlightedRow = null;
        let actionGeneration = 0, composing = false;
        const listeners = [];
        const collapsed = new Set();
        const listen = (target, event, callback) => {
            target.addEventListener(event, callback);
            listeners.push(() => target.removeEventListener(event, callback));
        };
        const icon = (className) => {
            const paths = {
                'fa-search': 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', 'fa-times': 'M6 6l12 12M6 18L18 6',
                'fa-folder-o': 'M3 5h6l2 3h10v12H3z', 'fa-folder-open-o': 'M3 20V5h6l2 3h10v3M3 20l3-9h17l-3 9z',
                'fa-cube': 'M12 2l10 5v10l-10 5-10-5V7zM2 7l10 5 10-5M12 12v10',
                'fa-desktop': 'M2 3h20v14H2zM12 17v4M7 21h10', 'fa-th-large': 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z',
                'fa-bullseye': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 12h.01',
                'fa-pencil': 'M16 3l5 5-13 13H3v-5zM13 6l5 5', 'fa-globe': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2c-6 6-6 14 0 20 6-6 6-14 0-20M4 6h16M4 18h16',
                'fa-bars': 'M3 5h18M3 12h18M3 19h18', 'fa-terminal': 'M4 5l7 7-7 7M13 19h8',
                'fa-ellipsis-v': 'M12 4h.01M12 12h.01M12 20h.01', 'fa-chevron-up': 'M5 15l7-7 7 7',
                'fa-question-circle-o': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9 8a3 3 0 1 1 5 3c-2 1-2 1-2 3M12 18h.01'
            };
            const node = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('fill', className === 'fa-th-large' ? 'currentColor' : 'none');
            node.setAttribute('stroke', 'currentColor'); node.setAttribute('stroke-width', className === 'fa-ellipsis-v' ? '4' : '1.8');
            node.setAttribute('stroke-linecap', 'round'); node.setAttribute('stroke-linejoin', 'round');
            const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', paths[className] || paths['fa-cube']); node.append(path);
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
                fallback.setAttribute('hidden', '');
                image.addEventListener('error', () => {
                    win.FolderViewPlusFoundationModules?.imageFallbacks?.record?.(source);
                    image.remove(); fallback.removeAttribute('hidden');
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
            popover.style.setProperty('--fv-finder-left', `${left}px`);
            popover.style.setProperty('--fv-finder-width', `${width}px`);
            const below = Math.max(0, win.innerHeight - bounds.bottom - 19);
            const above = Math.max(0, bounds.top - 19);
            const upward = below < Math.min(300, popover.scrollHeight) && above > below;
            const height = Math.min(800, upward ? above : below);
            popover.style.setProperty('--fv-finder-height', `${height}px`);
            const top = upward ? Math.max(12, bounds.top - popover.getBoundingClientRect().height - 7) : Math.min(bounds.bottom + 7, win.innerHeight - height - 12);
            popover.style.setProperty('--fv-finder-top', `${top}px`);
        };
        const invalidateActions = () => {
            actionGeneration += 1;
            busy = false;
            shell?.removeAttribute('aria-busy');
        };
        const close = (restoreFocus = false) => {
            invalidateActions(); composing = false;
            open = false;
            clearTimeout(queryTimer);
            queryTimer = null;
            shell?.classList.remove('is-open');
            trigger?.setAttribute('aria-expanded', 'false');
            if (popover) popover.hidden = true;
            if (input) { input.value = ''; input.disabled = true; input.tabIndex = -1; }
            results?.replaceChildren(); selected = ''; matches = []; entries = [];
            collapsed.clear();
            shell?.querySelector('[data-finder-close]')?.setAttribute('hidden', '');
            if (restoreFocus) trigger?.focus({ preventScroll: true });
        };
        const runAction = async (item, action) => {
            if (busy || disposed) return;
            // Resolve again at click time; removed items and newly unavailable actions cannot use stale results.
            const current = deps.getEntries().find((candidate) => candidate.key === item.key);
            if (!current || !searchIndex([current], input.value, filter).length || !deps.getActions(current).includes(action) || deps.isActionEnabled?.(current, action) === false) { refresh(); return; }
            if (action !== 'reveal') close(true);
            const generation = ++actionGeneration;
            const isCurrent = () => !disposed && generation === actionGeneration;
            busy = true;
            shell.setAttribute('aria-busy', 'true');
            try {
                if (action === 'reveal') {
                    await deps.prepareReveal(current, isCurrent);
                    if (!isCurrent()) return;
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
                    await deps.runAction(current, action, isCurrent);
                }
            } catch (_error) {
                if (isCurrent()) {
                    const message = translate('legacy.surface.7013b0cddf5e6532', 'Search action failed.');
                    if (deps.onError) deps.onError(message);
                    else win.FolderViewPlusUI?.alert?.({ title: labels.title, message, tone: 'danger' });
                }
            } finally {
                if (isCurrent()) { busy = false; shell?.removeAttribute('aria-busy'); }
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
                const section = doc.createElement('section'); section.className = 'fv-quickfinder-group';
                const heading = doc.createElement('h3');
                const groupToggle = button(label, kind === 'folder' ? 'fa-folder-open-o' : type === 'vm' ? 'fa-desktop' : 'fa-cube');
                groupToggle.dataset.finderGroup = kind; groupToggle.setAttribute('aria-expanded', String(!collapsed.has(kind)));
                const groupCount = doc.createElement('span'); groupCount.className = 'fv-quickfinder-group-count';
                const total = matches.filter(item => item.kind === kind).length;
                groupCount.textContent = total === 1 ? translate('legacy.surface.144a0aadbcc56e8d', '$1 result', total)
                    : translate('legacy.surface.7d7d761f8dd42bae', '$1 results', total);
                groupToggle.append(groupCount, icon('fa-chevron-up')); heading.append(groupToggle);
                const groupBody = doc.createElement('div'); groupBody.id = `${prefix}-group-${kind}`; groupBody.hidden = collapsed.has(kind);
                groupToggle.setAttribute('aria-controls', groupBody.id); section.append(heading, groupBody); results.append(section);
                group.forEach((item) => {
                    const row = doc.createElement('div'); row.className = 'fv-quickfinder-result'; row.dataset.resultIndex = String(entries.indexOf(item));
                    const title = button(''); title.append(resultIcon(item));
                    title.className = 'fv-quickfinder-result-title'; title.dataset.finderSelect = '';
                    const copy = doc.createElement('span'); copy.className = 'fv-quickfinder-copy';
                    const name = doc.createElement('strong'); name.className = 'fv-quickfinder-name'; name.textContent = item.name;
                    const path = doc.createElement('span'); path.className = 'fv-quickfinder-path'; path.textContent = item.path || labels.root;
                    copy.append(name, path); title.append(copy);
                    if (kind === 'item') {
                        row.classList.add('fv-quickfinder-item-result');
                        const status = doc.createElement('span'); status.className = 'fv-quickfinder-status';
                        const state = deps.getState(item);
                        status.textContent = state === 'running' ? translate('legacy.surface.f4ccae29e1bb0c20', 'Running')
                            : state === 'paused' ? translate('legacy.surface.e159b06187d369a0', 'Paused')
                                : translate('legacy.surface.1a4f630ac1b69fd0', 'Stopped');
                        status.dataset.state = state; copy.append(status); path.remove();
                    }
                    row.append(title);
                    const actions = doc.createElement('div'); actions.className = 'fv-quickfinder-actions';
                    deps.getActions(item).filter((action) => actionLabels[action]).forEach((action) => {
                        const compact = kind === 'item' || action === 'actions';
                        const control = button(compact ? '' : actionLabels[action], actionIcons[action]); control.dataset.finderAction = action;
                        control.setAttribute('aria-label', actionLabels[action]); control.title = actionLabels[action];
                        control.disabled = deps.isActionEnabled?.(item, action) === false; actions.append(control);
                    });
                    row.append(actions);
                    if (kind === 'item') { path.prepend(icon('fa-folder-o'), doc.createTextNode(' ')); row.append(path); }
                    deps.decorateResult?.(item, { row, title, path, actions });
                    const more = row.querySelector('[data-finder-action="actions"]');
                    if (more) { more.classList.add('fv-quickfinder-more'); row.append(more); }
                    groupBody.append(row);
                });
            }
            if (!visible.length || matches.length > RESULT_LIMIT) {
                const message = doc.createElement('p'); message.className = 'fv-quickfinder-message';
                message.textContent = !visible.length ? translate('legacy.surface.bb155c8458855d30', 'No matching folders or items.')
                    : translate('legacy.surface.fa7f6e591471d6be', 'Showing $1 of $2', visible.length, matches.length);
                results.append(message);
            }
            const expanded = visible.filter(item => !collapsed.has(item.kind));
            if (!expanded.some((item) => item.key === selected)) selected = expanded[0]?.key || '';
            select(selected);
            positionPopover();
        };
        const refresh = () => {
            if (!open || disposed) return;
            clearTimeout(queryTimer); queryTimer = null;
            const focused = doc.activeElement?.closest?.('[data-result-index]');
            const focusedKey = focused ? entries[Number(focused.dataset.resultIndex)]?.key : '';
            const focusedAction = doc.activeElement?.dataset?.finderAction;
            const focusedGroup = doc.activeElement?.dataset?.finderGroup;
            entries = input.value.trim() ? deps.getEntries() : [];
            render();
            if (focusedGroup) results.querySelector(`[data-finder-group="${focusedGroup}"]`)?.focus();
            if (focusedKey) {
                const index = entries.findIndex((item) => item.key === focusedKey);
                const row = results.querySelector(`[data-result-index="${index}"]`);
                (focusedAction ? row?.querySelector(`[data-finder-action="${focusedAction}"]`) : row?.querySelector('[data-finder-select]'))?.focus();
                if (!shell.contains(doc.activeElement)) input.focus();
            }
        };
        const show = () => {
            if (disposed || !shell?.isConnected) return;
            invalidateActions();
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
                const control = button(label, value === 'all' ? 'fa-th-large' : value === 'folder' ? 'fa-folder-o' : type === 'vm' ? 'fa-desktop' : 'fa-cube');
                control.dataset.finderFilter = value; control.setAttribute('aria-pressed', value === filter ? 'true' : 'false'); toolbar.append(control);
            }
            count = doc.createElement('span'); count.className = 'fv-quickfinder-count'; count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); toolbar.append(count);
            results = doc.createElement('div'); results.id = `${prefix}-results`; results.className = 'fv-quickfinder-results';
            const footer = doc.createElement('div'); footer.className = 'fv-quickfinder-footer';
            for (const [key, label] of [['↑ ↓', labels.select], ['Enter', labels.reveal], ['Esc', labels.closed]]) {
                const shortcut = doc.createElement('span'); const keycap = doc.createElement('kbd'); keycap.textContent = key;
                shortcut.append(keycap, doc.createTextNode(` ${label}`)); footer.append(shortcut);
            }
            const hint = doc.createElement('span'); hint.className = 'fv-quickfinder-hint';
            hint.append(icon('fa-question-circle-o'), doc.createTextNode(type === 'docker'
                ? translate('legacy.surface.dcf146dd21027242', 'Search Docker objects') : translate('legacy.surface.8ee0f7f8dad57e25', 'Search VM objects')));
            footer.append(hint);
            popover.append(toolbar, results, footer); shell.append(popover);
            target.host.classList.add('fvplus-finder-mount');
            target.host.insertBefore(shell, target.anchor || target.host.firstChild);
            listen(input, 'compositionstart', () => { composing = true; invalidateActions(); clearTimeout(queryTimer); queryTimer = null; });
            listen(input, 'compositionend', () => {
                composing = false; collapsed.clear(); clearTimeout(queryTimer);
                queryTimer = win.setTimeout(refresh, 60);
            });
            listen(shell, 'input', (event) => {
                if (event.target !== input) return;
                invalidateActions(); collapsed.clear(); clearTimeout(queryTimer); queryTimer = null;
                if (composing || event.isComposing) return;
                if (!input.value.trim()) refresh(); else queryTimer = win.setTimeout(refresh, 60);
            });
            listen(shell, 'click', (event) => {
                const control = event.target.closest?.('button, [data-finder-icon], [data-finder-select], [data-finder-action]');
                if (!control) return;
                event.preventDefault();
                if (control.hasAttribute('data-finder-toggle')) { open ? close(true) : show(); return; }
                if (control.hasAttribute('data-finder-close')) { close(true); return; }
                if (control.dataset.finderGroup) {
                    invalidateActions();
                    const kind = control.dataset.finderGroup; collapsed.has(kind) ? collapsed.delete(kind) : collapsed.add(kind);
                    render(); results.querySelector(`[data-finder-group="${kind}"]`)?.focus(); return;
                }
                if (control.dataset.finderFilter) {
                    invalidateActions();
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
            listen(field, 'transitionend', positionPopover);
            listen(win, 'resize', positionPopover);
            listen(win, 'scroll', () => {
                if (!open) return;
                const bounds = shell.getBoundingClientRect();
                if (bounds.bottom < 0 || bounds.top > win.innerHeight) close();
                else positionPopover();
            });
            listen(doc, 'keydown', (event) => {
                if (event.defaultPrevented || !shell.isConnected || event.isComposing || composing || event.keyCode === 229) return;
                if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
                    if (doc.querySelector('dialog[open], .sweet-alert.showSweetAlert, .fv-ui-modal[aria-modal="true"]')) return;
                    event.preventDefault(); show(); return;
                }
                if (!open || !shell.contains(event.target)) return;
                if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
                if (event.target === input && event.key === 'Enter') {
                    if (queryTimer !== null) refresh();
                    event.preventDefault(); const item = entries.find((candidate) => candidate.key === selected);
                    if (item) runAction(item, 'reveal'); return;
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    const titles = Array.from(results.querySelectorAll('[data-finder-select]')).filter(node => !node.closest('[hidden]'));
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
            if (!host?.querySelector('.fv-quickfinder')) host?.classList.remove('fvplus-finder-mount');
            if (controllers.get(doc) === api) controllers.delete(doc);
        };
        const api = Object.freeze({ mount, refresh, dispose, close });
        controllers.get(doc)?.dispose(); controllers.set(doc, api);
        return api;
    };
    return Object.freeze({ buildIndex, searchIndex, createApi, RESULT_LIMIT });
}));
