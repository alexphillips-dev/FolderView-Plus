(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerRuntimeActionBar = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const ACTION_BAR_ID = 'fvplus-docker-action-bar';
    const MENU_VALUES = new Set(['view', 'tools']);
    const FILTER_VALUES = new Set(['all', 'unassigned', 'updates', 'empty', 'health']);
    const SETTINGS_ROUTES = Object.freeze({
        folders: '/Settings/FolderViewPlus?fvMode=basic&fvSection=docker',
        bulk: '/Settings/FolderViewPlus?fvMode=advanced&fvAdvancedTab=automation&fvSection=bulk-assignment',
        rules: '/Settings/FolderViewPlus?fvMode=advanced&fvAdvancedTab=rules&fvSection=auto-assignment&fvRulesType=docker'
    });
    const VIEW_OPTIONS = Object.freeze([
        Object.freeze({ value: 'folderview', label: 'FolderView', icon: 'fa-folder-open' }),
        Object.freeze({ value: 'host', label: 'Host list', icon: 'fa-list' }),
        Object.freeze({ value: 'command', label: 'Command', icon: 'fa-terminal' }),
        Object.freeze({ value: 'tree-explorer', label: 'Tree Explorer', icon: 'fa-sitemap' }),
        Object.freeze({ value: 'orbit', label: 'Orbit', icon: 'fa-circle-o' })
    ]);

    const createApi = (deps = {}) => {
        const win = deps.window || (typeof window !== 'undefined' ? window : null);
        const doc = deps.document || win?.document || null;
        const utils = deps.utils || { normalizePrefs: (value) => value || {} };
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value || ''));
        const normalizePageViewMode = typeof deps.normalizePageViewMode === 'function'
            ? deps.normalizePageViewMode
            : ((value) => ['host', 'command', 'tree-explorer', 'orbit'].includes(String(value || '')) ? String(value) : 'folderview');
        const resolvePageViewMode = typeof deps.resolvePageViewMode === 'function'
            ? deps.resolvePageViewMode
            : ((prefs) => normalizePageViewMode(prefs?.pageViewMode));
        const getPrefs = typeof deps.getPrefs === 'function' ? deps.getPrefs : (() => ({}));
        const setPrefs = typeof deps.setPrefs === 'function' ? deps.setPrefs : (() => {});
        const applyPrefs = typeof deps.applyPrefs === 'function' ? deps.applyPrefs : (() => {});
        const savePrefs = typeof deps.savePrefs === 'function' ? deps.savePrefs : (async (_patch, prefs) => prefs);
        const queueRuntimeRender = typeof deps.queueRuntimeRender === 'function' ? deps.queueRuntimeRender : (async () => {});
        const getFolders = typeof deps.getFolders === 'function' ? deps.getFolders : (() => ({}));
        const getScopedContainers = typeof deps.getScopedContainers === 'function' ? deps.getScopedContainers : (() => ({}));
        const readFolderIdFromRow = typeof deps.readFolderIdFromRow === 'function' ? deps.readFolderIdFromRow : (() => '');
        const readFolderOwnerFromRow = typeof deps.readFolderOwnerFromRow === 'function' ? deps.readFolderOwnerFromRow : (() => '');
        const getFolderAncestors = typeof deps.getFolderAncestors === 'function' ? deps.getFolderAncestors : (() => []);
        const getFolderDescendants = typeof deps.getFolderDescendants === 'function' ? deps.getFolderDescendants : (() => []);
        const applyFocusedFolderState = typeof deps.applyFocusedFolderState === 'function' ? deps.applyFocusedFolderState : (() => {});
        const getFocusedFolderId = typeof deps.getFocusedFolderId === 'function' ? deps.getFocusedFolderId : (() => '');
        const clearFocusedFolder = typeof deps.clearFocusedFolder === 'function' ? deps.clearFocusedFolder : (() => {});
        const scheduleWidthReflow = typeof deps.scheduleWidthReflow === 'function' ? deps.scheduleWidthReflow : (() => {});
        const buildFolderHierarchy = typeof deps.buildFolderHierarchy === 'function'
            ? deps.buildFolderHierarchy
            : ((folders) => ({ parentById: Object.fromEntries(Object.keys(folders || {}).map((id) => [id, ''])) }));
        const expandFolderBranch = typeof deps.expandFolderBranch === 'function' ? deps.expandFolderBranch : (() => {});
        const collapseFolderBranch = typeof deps.collapseFolderBranch === 'function' ? deps.collapseFolderBranch : (() => {});
        const createFolder = typeof deps.createFolder === 'function' ? deps.createFolder : (() => {});
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        let actionMenuOpen = '';
        let folderFilterMode = 'all';
        let eventsBound = false;
        let busy = false;
        let menuPositionFrame = 0;

        const getListRows = () => Array.from(doc?.querySelectorAll?.('#docker_list > tr') || []);
        const isElement = (value) => !win?.Element || value instanceof win.Element;
        const isHtmlElement = (value) => !win?.HTMLElement || value instanceof win.HTMLElement;
        const isUnassignedContainerRow = (row) => {
            if (!isHtmlElement(row) || readFolderIdFromRow(row) || readFolderOwnerFromRow(row)) return false;
            if (row.classList?.contains('fv-runtime-loading-row')) return false;
            return !!row.querySelector?.('.ct-name, .appname, [data-name]');
        };

        const getFolderHealthPolicy = (folder = {}) => {
            const normalizedPrefs = utils.normalizePrefs(getPrefs() || {});
            const health = normalizedPrefs.health || {};
            const settings = folder?.settings && typeof folder.settings === 'object' ? folder.settings : {};
            const readThreshold = (folderValue, globalValue, fallback) => {
                const raw = folderValue === '' || folderValue === null || folderValue === undefined ? globalValue : folderValue;
                const parsed = Number(raw);
                return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : fallback;
            };
            return {
                warnThreshold: readThreshold(settings.health_warn_stopped_percent, health.warnStoppedPercent, 60),
                updatesMode: String(settings.health_updates_mode || health.updatesMode || 'maintenance').trim().toLowerCase(),
                allStoppedMode: String(settings.health_all_stopped_mode || health.allStoppedMode || 'critical').trim().toLowerCase()
            };
        };

        const summarize = () => {
            const summaries = {};
            let updates = 0;
            let empty = 0;
            let health = 0;
            for (const [id, folder] of Object.entries(getFolders() || {})) {
                const memberCount = Object.keys(getScopedContainers(id) || {}).length;
                const status = folder?.status || {};
                const started = Math.max(0, Number(status.started) || 0);
                const paused = Math.max(0, Number(status.paused) || 0);
                const stopped = Math.max(0, Number(status.stopped) || 0);
                const total = Math.max(memberCount, started + paused + stopped);
                const hasUpdates = status.upToDate === false;
                const policy = getFolderHealthPolicy(folder);
                const stoppedPercent = total > 0 ? Math.round((stopped / total) * 100) : 0;
                const allStopped = total > 0 && started === 0 && paused === 0 && stopped > 0;
                const hasHealthIssue = total > 0 && (
                    paused > 0
                    || stoppedPercent >= policy.warnThreshold
                    || (allStopped && policy.allStoppedMode !== 'ignore')
                    || (hasUpdates && policy.updatesMode === 'warn')
                );
                summaries[id] = { memberCount, hasUpdates, isEmpty: memberCount === 0, hasHealthIssue };
                if (hasUpdates) updates += 1;
                if (memberCount === 0) empty += 1;
                if (hasHealthIssue) health += 1;
            }
            return {
                folders: Object.keys(summaries).length,
                unassigned: getListRows().filter(isUnassignedContainerRow).length,
                updates,
                empty,
                health,
                summaries
            };
        };

        const matchesFilter = (mode, summary) => (mode === 'updates' && summary.hasUpdates)
            || (mode === 'empty' && summary.isEmpty)
            || (mode === 'health' && summary.hasHealthIssue);

        const getVisibleFolderIds = (mode, summaries) => {
            const visible = new Set();
            if (mode === 'all' || mode === 'unassigned') return visible;
            for (const [id, summary] of Object.entries(summaries || {})) {
                if (!matchesFilter(mode, summary)) continue;
                visible.add(id);
                getFolderAncestors(id).forEach((folderId) => visible.add(folderId));
                getFolderDescendants(id).forEach((folderId) => visible.add(folderId));
            }
            return visible;
        };

        const getMatchingFolderIds = (mode, summaries) => new Set(
            Object.entries(summaries || {}).filter(([, summary]) => matchesFilter(mode, summary)).map(([id]) => id)
        );

        const applyFilterState = () => {
            if (!FILTER_VALUES.has(folderFilterMode)) folderFilterMode = 'all';
            const rows = getListRows();
            rows.forEach((row) => row.classList?.remove('fv-toolbar-filter-hidden'));
            if (folderFilterMode !== 'all') {
                const state = summarize();
                const visibleFolders = getVisibleFolderIds(folderFilterMode, state.summaries);
                const matchingFolders = getMatchingFolderIds(folderFilterMode, state.summaries);
                rows.forEach((row) => {
                    const folderId = readFolderIdFromRow(row);
                    const ownerId = readFolderOwnerFromRow(row);
                    let visible = false;
                    if (folderFilterMode === 'unassigned') {
                        visible = isUnassignedContainerRow(row);
                    } else if (folderId) {
                        visible = visibleFolders.has(folderId);
                    } else if (ownerId) {
                        visible = matchingFolders.has(ownerId)
                            || getFolderAncestors(ownerId).some((ancestorId) => matchingFolders.has(ancestorId));
                    }
                    row.classList?.toggle('fv-toolbar-filter-hidden', !visible);
                });
            }
            applyFocusedFolderState();
            scheduleWidthReflow('toolbar-filter', 24);
        };

        const buildActionButtonHtml = ({ action, label, icon, count = null, active = false, disabled = false, title = '' }) => `
            <button type="button" class="fvplus-docker-action-button${active ? ' is-active' : ''}"
                data-fvplus-docker-action="${escapeHtml(action)}" ${disabled ? 'disabled' : ''}
                ${title ? `title="${escapeHtml(title)}"` : ''} aria-pressed="${active ? 'true' : 'false'}">
                <i class="fa ${escapeHtml(icon)}" aria-hidden="true"></i><span>${escapeHtml(label)}</span>
                ${count === null ? '' : `<span class="fvplus-docker-action-count">${Number(count) || 0}</span>`}
            </button>`;

        const buildViewMenuHtml = (currentMode) => VIEW_OPTIONS.map((option) => `
            <button type="button" role="menuitemradio" aria-checked="${option.value === currentMode ? 'true' : 'false'}"
                class="fvplus-docker-action-menu-item${option.value === currentMode ? ' is-selected' : ''}"
                data-fvplus-docker-view="${escapeHtml(option.value)}">
                <i class="fa ${escapeHtml(option.icon)}" aria-hidden="true"></i><span>${escapeHtml(option.label)}</span>
                <i class="fa fa-check fvplus-docker-action-menu-check" aria-hidden="true"></i>
            </button>`).join('');

        const buildToolsMenuHtml = () => {
            const hideEmpty = utils.normalizePrefs(getPrefs() || {}).hideEmptyFolders === true;
            const focusActive = !!String(getFocusedFolderId() || '').trim();
            return `
                <button type="button" class="fvplus-docker-action-menu-item" data-fvplus-docker-tool="toggle-empty">
                    <i class="fa ${hideEmpty ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i><span>${hideEmpty ? 'Show empty folders' : 'Hide empty folders'}</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item" data-fvplus-docker-tool="clear-focus" ${focusActive ? '' : 'disabled'}>
                    <i class="fa fa-crosshairs" aria-hidden="true"></i><span>Clear folder focus</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item" data-fvplus-docker-tool="refresh">
                    <i class="fa fa-refresh" aria-hidden="true"></i><span>Refresh folder state</span>
                </button>
                <span class="fvplus-docker-action-menu-divider" role="separator"></span>
                <button type="button" class="fvplus-docker-action-menu-item" data-fvplus-docker-route="bulk">
                    <i class="fa fa-tasks" aria-hidden="true"></i><span>Bulk assignment</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item" data-fvplus-docker-route="rules">
                    <i class="fa fa-code" aria-hidden="true"></i><span>Rules workspace</span>
                </button>
                <span class="fvplus-docker-action-menu-divider" role="separator"></span>
                <button type="button" class="fvplus-docker-action-menu-item" data-fvplus-docker-tool="reset">
                    <i class="fa fa-undo" aria-hidden="true"></i><span>Reset view</span>
                </button>`;
        };

        const reconcileFilterWithPrefs = () => {
            const hideEmptyFolders = utils.normalizePrefs(getPrefs() || {}).hideEmptyFolders === true;
            if (!hideEmptyFolders || folderFilterMode !== 'empty') return false;
            folderFilterMode = 'all';
            return true;
        };

        const ensureHost = () => {
            let bar = doc?.getElementById?.(ACTION_BAR_ID);
            const legacyButton = doc?.getElementById?.('fvplus-docker-add-folder-btn');
            if (!bar && legacyButton?.parentNode) {
                bar = doc.createElement('div');
                bar.id = ACTION_BAR_ID;
                bar.className = 'fvplus-docker-action-bar';
                legacyButton.parentNode.replaceChild(bar, legacyButton);
            }
            if (!bar) {
                const table = doc?.querySelector?.('table#docker_containers');
                if (!table?.parentNode) return null;
                bar = doc.createElement('div');
                bar.id = ACTION_BAR_ID;
                bar.className = 'fvplus-docker-action-bar';
                table.insertAdjacentElement('afterend', bar);
            }
            bar.setAttribute('aria-label', 'FolderView actions');
            return bar;
        };

        const sync = (mode = resolvePageViewMode(getPrefs())) => {
            const bar = ensureHost();
            if (!bar) return;
            const resolvedMode = normalizePageViewMode(mode);
            const isFolderView = resolvedMode === 'folderview';
            const hideEmpty = utils.normalizePrefs(getPrefs() || {}).hideEmptyFolders === true;
            if (reconcileFilterWithPrefs()) applyFilterState();
            const state = summarize();
            const folderControls = isFolderView ? `
                ${buildActionButtonHtml({ action: 'add-folder', label: 'Add Folder', icon: 'fa-plus' })}
                ${buildActionButtonHtml({ action: 'expand-all', label: 'Expand All', icon: 'fa-expand' })}
                ${buildActionButtonHtml({ action: 'collapse-all', label: 'Collapse All', icon: 'fa-compress' })}
                <span class="fvplus-docker-action-separator" aria-hidden="true"></span>
                ${buildActionButtonHtml({ action: 'filter-unassigned', label: 'Unassigned', icon: 'fa-inbox', count: state.unassigned, active: folderFilterMode === 'unassigned' })}
                ${buildActionButtonHtml({ action: 'filter-updates', label: 'Updates', icon: 'fa-download', count: state.updates, active: folderFilterMode === 'updates' })}
                ${buildActionButtonHtml({ action: 'filter-empty', label: 'Empty', icon: 'fa-folder-o', count: state.empty, active: folderFilterMode === 'empty', disabled: hideEmpty, title: hideEmpty ? 'Show empty folders from Tools before filtering them.' : '' })}
                ${buildActionButtonHtml({ action: 'filter-health', label: 'Health Issues', icon: 'fa-heartbeat', count: state.health, active: folderFilterMode === 'health' })}` : '';
            bar.dataset.mode = resolvedMode;
            bar.classList.toggle('is-busy', busy);
            bar.setAttribute('aria-busy', busy ? 'true' : 'false');
            bar.innerHTML = `
                <div class="fvplus-docker-action-primary">${folderControls}</div>
                <div class="fvplus-docker-action-secondary">
                    ${buildActionButtonHtml({ action: 'manage-folders', label: 'Manage Folders', icon: 'fa-folder' })}
                    <span class="fvplus-docker-action-menu-shell">
                        <button type="button" class="fvplus-docker-action-button${actionMenuOpen === 'view' ? ' is-active' : ''}" data-fvplus-docker-menu="view" aria-haspopup="menu" aria-expanded="${actionMenuOpen === 'view' ? 'true' : 'false'}">
                            <i class="fa fa-eye" aria-hidden="true"></i><span>View</span><i class="fa fa-caret-down fvplus-docker-action-menu-caret" aria-hidden="true"></i>
                        </button>
                        <span class="fvplus-docker-action-menu${actionMenuOpen === 'view' ? ' is-open' : ''}" role="menu">${buildViewMenuHtml(resolvedMode)}</span>
                    </span>
                    <span class="fvplus-docker-action-menu-shell">
                        <button type="button" class="fvplus-docker-action-button${actionMenuOpen === 'tools' ? ' is-active' : ''}" data-fvplus-docker-menu="tools" aria-haspopup="menu" aria-expanded="${actionMenuOpen === 'tools' ? 'true' : 'false'}">
                            <i class="fa fa-wrench" aria-hidden="true"></i><span>Tools</span><i class="fa fa-caret-down fvplus-docker-action-menu-caret" aria-hidden="true"></i>
                        </button>
                        <span class="fvplus-docker-action-menu${actionMenuOpen === 'tools' ? ' is-open' : ''}" role="menu">${buildToolsMenuHtml()}</span>
                    </span>
                </div>`;
            Array.from(bar.querySelectorAll('button')).forEach((button) => {
                button.disabled = button.disabled || busy;
            });
            queueOpenMenuPosition();
        };

        const positionOpenMenu = () => {
            menuPositionFrame = 0;
            if (!actionMenuOpen) return;
            const bar = doc?.getElementById?.(ACTION_BAR_ID);
            const menu = bar?.querySelector?.('.fvplus-docker-action-menu.is-open');
            const trigger = bar?.querySelector?.(`[data-fvplus-docker-menu="${actionMenuOpen}"]`);
            if (!menu || !trigger?.getBoundingClientRect) return;
            const triggerRect = trigger.getBoundingClientRect();
            const viewportWidth = Math.max(0, Number(win?.innerWidth) || Number(doc?.documentElement?.clientWidth) || 0);
            const viewportHeight = Math.max(0, Number(win?.innerHeight) || Number(doc?.documentElement?.clientHeight) || 0);
            const margin = 8;
            const gap = 6;
            const menuWidth = Math.max(210, Number(menu.offsetWidth) || 0);
            const menuHeight = Math.max(0, Number(menu.offsetHeight) || 0);
            const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - margin - gap);
            const spaceAbove = Math.max(0, triggerRect.top - margin - gap);
            const opensUp = menuHeight > spaceBelow && spaceAbove > spaceBelow;
            const availableHeight = Math.max(120, opensUp ? spaceAbove : spaceBelow);
            const left = Math.max(margin, Math.min(triggerRect.right - menuWidth, viewportWidth - menuWidth - margin));
            const top = opensUp
                ? Math.max(margin, triggerRect.top - Math.min(menuHeight, availableHeight) - gap)
                : Math.min(viewportHeight - margin, triggerRect.bottom + gap);
            menu.classList.toggle('opens-up', opensUp);
            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
            menu.style.maxHeight = `${Math.round(availableHeight)}px`;
            menu.classList.add('is-positioned');
            const caret = trigger.querySelector?.('.fvplus-docker-action-menu-caret');
            caret?.classList?.toggle('fa-caret-up', opensUp);
            caret?.classList?.toggle('fa-caret-down', !opensUp);
        };

        function queueOpenMenuPosition() {
            if (!actionMenuOpen || menuPositionFrame) return;
            if (typeof win?.requestAnimationFrame === 'function') {
                menuPositionFrame = win.requestAnimationFrame(positionOpenMenu);
                return;
            }
            win?.setTimeout?.(positionOpenMenu, 0);
        }

        const setMenuOpen = (menu = '') => {
            actionMenuOpen = MENU_VALUES.has(menu) ? menu : '';
            sync();
        };

        const runTask = async (task) => {
            if (busy || typeof task !== 'function') return;
            busy = true;
            sync();
            try {
                await task();
            } catch (error) {
                showError(String(error?.message || 'The action could not be completed.'));
            } finally {
                busy = false;
                sync();
            }
        };

        const setFolderFilter = (mode) => {
            const normalized = FILTER_VALUES.has(mode) ? mode : 'all';
            folderFilterMode = folderFilterMode === normalized ? 'all' : normalized;
            if (folderFilterMode !== 'all' && getFocusedFolderId()) clearFocusedFolder();
            applyFilterState();
            sync();
        };

        const setPageViewMode = async (mode) => {
            const normalizedMode = normalizePageViewMode(mode);
            const previousPrefs = utils.normalizePrefs(getPrefs() || {});
            if (resolvePageViewMode(previousPrefs) === normalizedMode) {
                setMenuOpen('');
                return;
            }
            const nextPrefs = utils.normalizePrefs({ ...previousPrefs, pageViewMode: normalizedMode });
            setPrefs(nextPrefs);
            applyPrefs(nextPrefs);
            try {
                const savedPrefs = await savePrefs({ pageViewMode: normalizedMode }, nextPrefs);
                setPrefs(savedPrefs || nextPrefs);
                applyPrefs(getPrefs());
                folderFilterMode = 'all';
                await queueRuntimeRender();
            } catch (error) {
                setPrefs(previousPrefs);
                applyPrefs(previousPrefs);
                throw error;
            }
        };

        const toggleEmptyFolders = async () => {
            const previousPrefs = utils.normalizePrefs(getPrefs() || {});
            const hideEmptyFolders = previousPrefs.hideEmptyFolders !== true;
            const nextPrefs = utils.normalizePrefs({ ...previousPrefs, hideEmptyFolders });
            setPrefs(nextPrefs);
            if (reconcileFilterWithPrefs()) applyFilterState();
            applyPrefs(nextPrefs);
            try {
                const savedPrefs = await savePrefs({ hideEmptyFolders }, nextPrefs);
                setPrefs(savedPrefs || nextPrefs);
                applyPrefs(getPrefs());
                await queueRuntimeRender();
            } catch (error) {
                setPrefs(previousPrefs);
                applyPrefs(previousPrefs);
                throw error;
            }
        };

        const resetView = () => {
            actionMenuOpen = '';
            folderFilterMode = 'all';
            clearFocusedFolder();
            applyFilterState();
            sync();
        };

        const getRootFolderIds = () => {
            const folders = getFolders() || {};
            const hierarchy = buildFolderHierarchy(folders);
            return Object.keys(folders).filter((id) => !String(hierarchy?.parentById?.[id] || '').trim());
        };

        const handleClick = (event) => {
            const target = isElement(event.target) ? event.target : null;
            if (!target) return;
            const menuButton = target.closest?.('[data-fvplus-docker-menu]');
            if (menuButton) {
                event.preventDefault();
                const menu = String(menuButton.getAttribute('data-fvplus-docker-menu') || '');
                setMenuOpen(actionMenuOpen === menu ? '' : menu);
                return;
            }
            const viewButton = target.closest?.('[data-fvplus-docker-view]');
            if (viewButton) {
                event.preventDefault();
                const mode = String(viewButton.getAttribute('data-fvplus-docker-view') || '');
                actionMenuOpen = '';
                runTask(() => setPageViewMode(mode));
                return;
            }
            const routeButton = target.closest?.('[data-fvplus-docker-route]');
            if (routeButton) {
                event.preventDefault();
                const route = String(routeButton.getAttribute('data-fvplus-docker-route') || '');
                if (SETTINGS_ROUTES[route] && win?.location) win.location.href = SETTINGS_ROUTES[route];
                return;
            }
            const toolButton = target.closest?.('[data-fvplus-docker-tool]');
            if (toolButton && !toolButton.disabled) {
                event.preventDefault();
                const tool = String(toolButton.getAttribute('data-fvplus-docker-tool') || '');
                actionMenuOpen = '';
                if (tool === 'toggle-empty') runTask(toggleEmptyFolders);
                if (tool === 'clear-focus') {
                    clearFocusedFolder();
                    applyFilterState();
                    sync();
                }
                if (tool === 'refresh') runTask(queueRuntimeRender);
                if (tool === 'reset') resetView();
                return;
            }
            const actionButton = target.closest?.('[data-fvplus-docker-action]');
            if (!actionButton || actionButton.disabled) return;
            event.preventDefault();
            const action = String(actionButton.getAttribute('data-fvplus-docker-action') || '');
            if (action === 'add-folder') createFolder();
            if (action === 'manage-folders' && win?.location) win.location.href = SETTINGS_ROUTES.folders;
            if (action === 'expand-all' || action === 'collapse-all') {
                const branchAction = action === 'expand-all' ? expandFolderBranch : collapseFolderBranch;
                getRootFolderIds().forEach((id) => branchAction(id));
                applyFilterState();
                sync();
            }
            if (action.startsWith('filter-')) setFolderFilter(action.slice('filter-'.length));
        };

        const bindEvents = () => {
            if (eventsBound || !doc?.addEventListener) return;
            eventsBound = true;
            doc.addEventListener('click', (event) => {
                const target = isElement(event.target) ? event.target : null;
                const bar = doc.getElementById(ACTION_BAR_ID);
                if (target && bar?.contains(target)) {
                    handleClick(event);
                } else if (actionMenuOpen) {
                    setMenuOpen('');
                }
            });
            doc.addEventListener('keydown', (event) => {
                const target = isElement(event.target) ? event.target : null;
                const closedMenuButton = target?.closest?.('[data-fvplus-docker-menu]');
                if (event.key === 'ArrowDown' && closedMenuButton && !actionMenuOpen) {
                    event.preventDefault();
                    const menu = String(closedMenuButton.getAttribute('data-fvplus-docker-menu') || '');
                    setMenuOpen(menu);
                    const focusFirst = () => doc.querySelector(`#${ACTION_BAR_ID} .fvplus-docker-action-menu.is-open .fvplus-docker-action-menu-item:not(:disabled)`)?.focus();
                    if (typeof win?.requestAnimationFrame === 'function') win.requestAnimationFrame(focusFirst);
                    else win?.setTimeout?.(focusFirst, 0);
                    return;
                }
                if (event.key === 'Escape' && actionMenuOpen) {
                    event.preventDefault();
                    const openMenu = actionMenuOpen;
                    setMenuOpen('');
                    doc.querySelector(`[data-fvplus-docker-menu="${openMenu}"]`)?.focus();
                    return;
                }
                if (!actionMenuOpen || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                const menu = doc.querySelector(`#${ACTION_BAR_ID} .fvplus-docker-action-menu.is-open`);
                const items = Array.from(menu?.querySelectorAll('.fvplus-docker-action-menu-item:not(:disabled)') || []);
                if (!items.length || !menu?.contains(target)) return;
                event.preventDefault();
                const currentIndex = Math.max(0, items.indexOf(target.closest('.fvplus-docker-action-menu-item')));
                let nextIndex = currentIndex;
                if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
                if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = items.length - 1;
                items[nextIndex]?.focus();
            });
            win?.addEventListener?.('resize', queueOpenMenuPosition);
            win?.addEventListener?.('scroll', queueOpenMenuPosition, true);
        };

        bindEvents();
        return Object.freeze({
            sync,
            summarize,
            applyFilterState,
            setFilterMode: setFolderFilter,
            setPageViewMode,
            resetView,
            getFilterMode: () => folderFilterMode
        });
    };

    return Object.freeze({ createApi, VIEW_OPTIONS, SETTINGS_ROUTES });
}));
