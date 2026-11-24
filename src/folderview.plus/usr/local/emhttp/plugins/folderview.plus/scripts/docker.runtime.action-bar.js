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
        Object.freeze({ value: 'folderview', label: 'FolderView', i18nKey: 'docker.views.folderview', icon: 'fa-folder-open' }),
        Object.freeze({ value: 'host', label: 'Host list', i18nKey: 'docker.views.host', icon: 'fa-list' }),
        Object.freeze({ value: 'command', label: 'Command', i18nKey: 'docker.views.command', icon: 'fa-terminal' })
    ]);

    const createApi = (deps = {}) => {
        const win = deps.window || (typeof window !== 'undefined' ? window : null);
        const doc = deps.document || win?.document || null;
        const hostAdapter = deps.hostAdapter || null;
        const utils = deps.utils || { normalizePrefs: (value) => value || {} };
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value || ''));
        const normalizePageViewMode = typeof deps.normalizePageViewMode === 'function'
            ? deps.normalizePageViewMode
            : ((value) => ['host', 'command'].includes(String(value || '')) ? String(value) : 'folderview');
        const resolvePageViewMode = typeof deps.resolvePageViewMode === 'function'
            ? deps.resolvePageViewMode
            : ((prefs) => normalizePageViewMode(prefs?.pageViewMode));
        const getPrefs = typeof deps.getPrefs === 'function' ? deps.getPrefs : (() => ({}));
        const setPrefs = typeof deps.setPrefs === 'function' ? deps.setPrefs : (() => {});
        const applyPrefs = typeof deps.applyPrefs === 'function' ? deps.applyPrefs : (() => {});
        const savePrefs = typeof deps.savePrefs === 'function' ? deps.savePrefs : (async (_patch, prefs) => prefs);
        const refreshRuntimeView = typeof deps.refreshRuntimeView === 'function' ? deps.refreshRuntimeView : (async () => {});
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
        const hiddenFolders = deps.hiddenFolders || {};
        const getHiddenVisibilitySummary = typeof hiddenFolders.getSummary === 'function'
            ? hiddenFolders.getSummary
            : (() => ({ explicitCount: 0, effectiveCount: 0, totalFolderCount: 0, revealHiddenFolders: false }));
        const applyHiddenFolderState = typeof hiddenFolders.applyVisibility === 'function' ? hiddenFolders.applyVisibility : (() => {});
        const setRevealHiddenFolders = typeof hiddenFolders.setReveal === 'function' ? hiddenFolders.setReveal : (() => false);
        const restoreHiddenFolder = typeof hiddenFolders.restoreFolder === 'function' ? hiddenFolders.restoreFolder : (async () => false);
        const restoreAllHiddenFolders = typeof hiddenFolders.restoreAll === 'function' ? hiddenFolders.restoreAll : (async () => false);
        const svgIcon = typeof hiddenFolders.svgIcon === 'function'
            ? hiddenFolders.svgIcon
            : ((name, options = {}) => `<i class="fa ${name === 'eye-off' ? 'fa-eye-slash' : 'fa-eye'} ${escapeHtml(options.className || '')}" aria-hidden="true"></i>`);
        const nativeOrder = deps.nativeOrder || {};
        const getUnassignedRows = deps.getUnassignedRows || (() => null);
        const isUnassignedHeader = deps.isUnassignedHeader || (() => false);
        const translate = typeof deps.translate === 'function'
            ? deps.translate
            : ((key, fallback = '', ...params) => win?.FolderViewPlusI18n?.t?.(key, fallback, ...params)
                || params.reduce((text, value, index) => text.split(`$${index + 1}`).join(String(value)), fallback || key));
        const pageDiagnostics = win?.FolderViewPlusFoundationModules?.runtimePageDiagnostics?.createController?.({
            window: win,
            document: doc,
            surface: 'docker'
        }) || null;
        let actionMenuOpen = '';
        let folderFilterMode = 'all';
        let eventsBound = false;
        let busy = false;
        let menuPositionFrame = 0;
        let renderedBar = null;
        let renderedMarkup = '';
        let renderedBusy = false;
        let hiddenFolderUndo = null;
        let hiddenFolderUndoTimer = 0;

        const getListRows = () => hostAdapter && typeof hostAdapter.queryRows === 'function'
            ? hostAdapter.queryRows('all')
            : Array.from(doc?.querySelectorAll?.('#docker_list > tr') || []);
        const isElement = (value) => !win?.Element || value instanceof win.Element;
        const isHtmlElement = (value) => !win?.HTMLElement || value instanceof win.HTMLElement;
        const isUnassignedContainerRow = (row) => {
            if (!isHtmlElement(row) || readFolderIdFromRow(row) || readFolderOwnerFromRow(row)) return false;
            if (row.classList?.contains('fv-runtime-loading-row')) return false;
            const verifiedRows = getUnassignedRows();
            if (verifiedRows) return verifiedRows.has(row);
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
                        visible = isUnassignedHeader(row) || isUnassignedContainerRow(row);
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
            applyHiddenFolderState();
            scheduleWidthReflow('toolbar-filter', 24);
        };

        const buildActionButtonHtml = ({ action, label, icon, count = null, active = false, disabled = false, title = '' }) => `
            <button type="button" class="fvplus-docker-action-button fv-ui-button${active ? ' is-active' : ''}"
                data-fvplus-docker-action="${escapeHtml(action)}" ${disabled ? 'disabled' : ''}
                ${title ? `title="${escapeHtml(title)}"` : ''} aria-pressed="${active ? 'true' : 'false'}">
                <i class="fa ${escapeHtml(icon)}" aria-hidden="true"></i><span>${escapeHtml(label)}</span>
                ${count === null ? '' : `<span class="fvplus-docker-action-count fv-ui-badge">${Number(count) || 0}</span>`}
            </button>`;

        const buildViewMenuHtml = (currentMode) => {
            const hiddenState = getHiddenVisibilitySummary();
            const hiddenCount = Math.max(0, Number(hiddenState?.explicitCount) || 0);
            const revealHidden = hiddenState?.revealHiddenFolders === true;
            const modeOptions = VIEW_OPTIONS.map((option) => `
            <button type="button" role="menuitemradio" aria-checked="${option.value === currentMode ? 'true' : 'false'}"
                class="fvplus-docker-action-menu-item fv-ui-button${option.value === currentMode ? ' is-selected' : ''}"
                data-fvplus-docker-view="${escapeHtml(option.value)}">
                <i class="fa ${escapeHtml(option.icon)}" aria-hidden="true"></i><span>${escapeHtml(translate(option.i18nKey, option.label))}</span>
                <i class="fa fa-check fvplus-docker-action-menu-check" aria-hidden="true"></i>
            </button>`).join('');
            const hiddenLabel = `${translate('docker.visibility.hidden-folders', 'Hidden folders')} (${hiddenCount})`;
            return `${modeOptions}
                <span class="fvplus-docker-action-menu-divider" role="separator"></span>
                <button type="button" role="menuitemcheckbox" aria-checked="${revealHidden ? 'true' : 'false'}"
                    class="fvplus-docker-action-menu-item fv-ui-button${revealHidden ? ' is-selected' : ''}"
                    data-fvplus-docker-hidden="toggle-reveal" ${hiddenCount > 0 ? '' : 'disabled'}>
                    ${svgIcon(revealHidden ? 'eye-off' : 'eye', { className: 'fvplus-docker-action-svg' })}<span>${escapeHtml(hiddenLabel)}</span>
                    <i class="fa fa-check fvplus-docker-action-menu-check" aria-hidden="true"></i>
                </button>
                <button type="button" role="menuitem" class="fvplus-docker-action-menu-item fv-ui-button"
                    data-fvplus-docker-hidden="restore-all" ${hiddenCount > 0 ? '' : 'disabled'}>
                    <i class="fa fa-undo" aria-hidden="true"></i><span>${escapeHtml(translate('docker.visibility.restore-all', 'Restore all hidden folders'))}</span>
                </button>`;
        };

        const buildToolsMenuHtml = (currentMode) => {
            const canSaveOrder = currentMode === 'folderview';
            const hideEmpty = utils.normalizePrefs(getPrefs() || {}).hideEmptyFolders === true;
            const focusActive = !!String(getFocusedFolderId() || '').trim();
            return `
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-tool="toggle-empty">
                    <i class="fa ${hideEmpty ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i><span>${escapeHtml(hideEmpty ? translate('docker.actions.show-empty', 'Show empty folders') : translate('docker.actions.hide-empty', 'Hide empty folders'))}</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-tool="clear-focus" ${focusActive ? '' : 'disabled'}>
                    <i class="fa fa-crosshairs" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.clear-focus', 'Clear folder focus'))}</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-tool="refresh">
                    <i class="fa fa-refresh" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.refresh-state', 'Refresh folder state'))}</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-tool="save-native-order" ${canSaveOrder ? '' : `disabled title="${escapeHtml(translate('docker.native-order.folderview-only', 'Switch to the FolderView view to save the order of its containers.'))}"`}>
                    <i class="fa fa-floppy-o" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.save-native-order', 'Save current order to Unraid'))}</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-tool="capture-diagnostics">
                    <i class="fa fa-camera" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.capture-diagnostics', 'Capture page diagnostics'))}</span>
                </button>
                <span class="fvplus-docker-action-menu-divider" role="separator"></span>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-route="bulk">
                    <i class="fa fa-tasks" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.bulk-assignment', 'Bulk assignment'))}</span>
                </button>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-route="rules">
                    <i class="fa fa-code" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.rules-workspace', 'Rules workspace'))}</span>
                </button>
                <span class="fvplus-docker-action-menu-divider" role="separator"></span>
                <button type="button" class="fvplus-docker-action-menu-item fv-ui-button" data-fvplus-docker-tool="reset">
                    <i class="fa fa-undo" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.reset-view', 'Reset view'))}</span>
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
            bar.setAttribute('aria-label', translate('docker.actions.label', 'FolderView actions'));
            return bar;
        };
        const sync = (mode = resolvePageViewMode(getPrefs())) => {
            const bar = ensureHost();
            if (!bar) return;
            const focused = bar.contains?.(doc.activeElement) ? doc.activeElement : null;
            const focusedAction = Array.from(focused?.attributes || []).find((attribute) => attribute.name.startsWith('data-fvplus-docker-'));
            const resolvedMode = normalizePageViewMode(mode);
            const isFolderView = resolvedMode === 'folderview';
            const hideEmpty = utils.normalizePrefs(getPrefs() || {}).hideEmptyFolders === true;
            if (reconcileFilterWithPrefs()) applyFilterState();
            const state = summarize();
            const hiddenState = getHiddenVisibilitySummary();
            const allFoldersHidden = isFolderView
                && hiddenState?.revealHiddenFolders !== true
                && Number(hiddenState?.totalFolderCount || 0) > 0
                && Number(hiddenState?.effectiveCount || 0) >= Number(hiddenState?.totalFolderCount || 0);
            const undoActive = !!hiddenFolderUndo && Number(hiddenFolderUndo.expiresAt || 0) > Date.now();
            const folderControls = isFolderView ? `
                ${buildActionButtonHtml({ action: 'add-folder', label: translate('docker.actions.add-folder', 'Add Folder'), icon: 'fa-plus' })}
                ${buildActionButtonHtml({ action: 'expand-all', label: translate('docker.actions.expand-all', 'Expand All'), icon: 'fa-expand' })}
                ${buildActionButtonHtml({ action: 'collapse-all', label: translate('docker.actions.collapse-all', 'Collapse All'), icon: 'fa-compress' })}
                <span class="fvplus-docker-action-separator" aria-hidden="true"></span>
                ${buildActionButtonHtml({ action: 'filter-unassigned', label: translate('docker.actions.unassigned', 'Unassigned'), icon: 'fa-inbox', count: state.unassigned, active: folderFilterMode === 'unassigned' })}
                ${buildActionButtonHtml({ action: 'filter-updates', label: translate('docker.actions.updates', 'Updates'), icon: 'fa-download', count: state.updates, active: folderFilterMode === 'updates' })}
                ${buildActionButtonHtml({ action: 'filter-empty', label: translate('docker.actions.empty', 'Empty'), icon: 'fa-folder-o', count: state.empty, active: folderFilterMode === 'empty', disabled: hideEmpty, title: hideEmpty ? translate('docker.actions.empty-filter-help', 'Show empty folders from Tools before filtering them.') : '' })}
                ${buildActionButtonHtml({ action: 'filter-health', label: translate('docker.actions.health-issues', 'Health Issues'), icon: 'fa-heartbeat', count: state.health, active: folderFilterMode === 'health' })}` : '';
            bar.dataset.mode = resolvedMode;
            bar.classList.toggle('is-busy', busy);
            bar.setAttribute('aria-busy', busy ? 'true' : 'false');
            const markup = `
                <div class="fvplus-docker-action-primary">${folderControls}</div>
                <div class="fvplus-docker-action-secondary">
                    ${buildActionButtonHtml({ action: 'manage-folders', label: translate('docker.actions.manage-folders', 'Manage Folders'), icon: 'fa-folder' })}
                    <span class="fvplus-docker-action-menu-shell">
                        <button type="button" class="fvplus-docker-action-button fv-ui-button${actionMenuOpen === 'view' ? ' is-active' : ''}" data-fvplus-docker-menu="view" aria-haspopup="menu" aria-expanded="${actionMenuOpen === 'view' ? 'true' : 'false'}">
                            <i class="fa fa-eye" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.view', 'View'))}</span><i class="fa fa-caret-down fvplus-docker-action-menu-caret" aria-hidden="true"></i>
                        </button>
                        <span class="fvplus-docker-action-menu${actionMenuOpen === 'view' ? ' is-open' : ''}" role="menu">${buildViewMenuHtml(resolvedMode)}</span>
                    </span>
                    <span class="fvplus-docker-action-menu-shell">
                        <button type="button" class="fvplus-docker-action-button fv-ui-button${actionMenuOpen === 'tools' ? ' is-active' : ''}" data-fvplus-docker-menu="tools" aria-haspopup="menu" aria-expanded="${actionMenuOpen === 'tools' ? 'true' : 'false'}">
                            <i class="fa fa-wrench" aria-hidden="true"></i><span>${escapeHtml(translate('docker.actions.tools', 'Tools'))}</span><i class="fa fa-caret-down fvplus-docker-action-menu-caret" aria-hidden="true"></i>
                        </button>
                        <span class="fvplus-docker-action-menu${actionMenuOpen === 'tools' ? ' is-open' : ''}" role="menu">${buildToolsMenuHtml(resolvedMode)}</span>
                    </span>
                </div>
                ${undoActive ? `<div class="fvplus-docker-visibility-notice is-undo" role="status">
                    ${svgIcon('eye-off', { className: 'fvplus-docker-visibility-notice-icon' })}
                    <span><strong>${escapeHtml(translate('docker.visibility.hidden-title', 'Folder hidden'))}</strong> ${escapeHtml(String(hiddenFolderUndo.folderName || translate('docker.visibility.folder-fallback', 'Folder')))} ${escapeHtml(translate('docker.visibility.hidden-message', 'was hidden from the Docker view.'))}</span>
                    <button type="button" class="fv-ui-button is-sm fvplus-docker-visibility-button" data-fvplus-docker-hidden="undo">${escapeHtml(translate('docker.visibility.undo', 'Undo'))}</button>
                </div>` : ''}
                ${allFoldersHidden ? `<div class="fvplus-docker-visibility-notice is-empty" role="status">
                    ${svgIcon('eye-off', { className: 'fvplus-docker-visibility-notice-icon' })}
                    <span><strong>${escapeHtml(translate('docker.visibility.all-hidden-title', 'All folder rows are hidden.'))}</strong> ${escapeHtml(translate('docker.visibility.all-hidden-help', 'Reveal them temporarily or restore every hidden folder.'))}</span>
                    <button type="button" class="fv-ui-button is-sm fvplus-docker-visibility-button" data-fvplus-docker-hidden="toggle-reveal">${escapeHtml(translate('docker.visibility.show-hidden', 'Show hidden folders'))}</button>
                    <button type="button" class="fv-ui-button is-sm fvplus-docker-visibility-button" data-fvplus-docker-hidden="restore-all">${escapeHtml(translate('docker.visibility.restore-all', 'Restore all hidden folders'))}</button>
                </div>` : ''}`;
            if (renderedBar === bar && renderedMarkup === markup && renderedBusy === busy) {
                queueOpenMenuPosition();
                return;
            }
            bar.innerHTML = markup;
            renderedBar = bar;
            renderedMarkup = markup;
            renderedBusy = busy;
            let focusTarget = null;
            Array.from(bar.querySelectorAll('button')).forEach((button) => {
                button.disabled = button.disabled || busy;
                if (focusedAction && button.getAttribute(focusedAction.name) === focusedAction.value) focusTarget = button;
            });
            if (focusTarget && !focusTarget.disabled) {
                if (actionMenuOpen) positionOpenMenu();
                focusTarget.focus({ preventScroll: true });
            }
            queueOpenMenuPosition();
        };

        const positionOpenMenu = () => {
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
                menuPositionFrame = win.requestAnimationFrame(() => { menuPositionFrame = 0; positionOpenMenu(); });
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
            if (folderFilterMode === 'unassigned') deps.setUnassignedExpanded?.(true);
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
                await refreshRuntimeView();
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
                await refreshRuntimeView();
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
            setRevealHiddenFolders(false);
            applyFilterState();
            sync();
        };

        // Unraid's Docker page stores one flat order through its own UserPrefs.php when a row is dragged.
        // The save below sends that same request with the rows as this page shows them.
        const collectNativeOrder = () => Array.from(nativeOrder.collectCells?.() ?? doc?.querySelectorAll?.('#docker_list td.ct-name') ?? []).map((cell) => {
            const row = cell.closest?.('tr') || null;
            const folderId = String(readFolderIdFromRow(row) || '');
            return {
                name: Array.from(cell.querySelectorAll?.('.appname') || []).map((node) => String(node.textContent || '')).join('').trim(),
                folderId,
                ownerId: folderId ? '' : String(readFolderOwnerFromRow(row) || '')
            };
        });
        const nativeOrderContainers = (entries) => entries.filter((entry) => !entry.folderId).map((entry) => entry.name);
        const sameNativeOrder = (left, right) => left.length === right.length && left.every((name, index) => name === right[index]);
        // `order`: every container in the order Unraid uses for it, with a name order fallback and unlisted
        // containers added. `stored`: the entries in userprefs.cfg as written, and whether the file could be read.
        // Anything else is a failed read.
        const storedStatuses = ['ok', 'missing', 'unreadable', 'invalid'];
        const readNativeOrderState = async () => {
            const state = await nativeOrder.read();
            const stored = state?.stored;
            if (!Array.isArray(state?.order) || !storedStatuses.includes(stored?.status) || !Array.isArray(stored?.entries)
                || stored.entries.some((entry) => typeof entry?.index !== 'string' || typeof entry?.name !== 'string')) {
                throw new Error('unexpected response');
            }
            return { order: state.order.map(String), status: stored.status, entries: stored.entries.map((entry) => `${entry.index}=${entry.name}`) };
        };
        const describeStoredStatus = (status) => {
            if (status === 'missing') return translate('docker.native-order.stored-missing', 'userprefs.cfg not found');
            if (status === 'unreadable') return translate('docker.native-order.stored-unreadable', 'userprefs.cfg could not be read');
            if (status === 'invalid') return translate('docker.native-order.stored-invalid', 'userprefs.cfg is not in the format Unraid writes');
            return status;
        };
        const findNativeOrderProblem = (entries, inventory) => {
            const names = entries.map((entry) => entry.name);
            const containers = nativeOrderContainers(entries);
            const drawnFolders = new Set(entries.map((entry) => entry.folderId).filter(Boolean));
            const folderRowsPending = Object.keys(getFolders() || {}).some((id) => !drawnFolders.has(id)
                && Object.keys(getScopedContainers(id) || {}).length > 0);
            if (!containers.length || folderRowsPending || new Set(names).size !== names.length
                || names.some((name) => !name || name.includes(';')) || containers.some((name) => !inventory.includes(name))) {
                return translate('docker.native-order.not-ready', 'The Docker list on this page is incomplete or out of date. Nothing was changed. Reload the Docker tab and try again.');
            }
            const missing = inventory.filter((name) => !containers.includes(name));
            return missing.length
                ? translate('docker.native-order.incomplete', 'These containers are not in the list on this page: $1. Unraid moves any container that is left out when the order of the containers is saved to the top of its list, so nothing was changed. Reload the Docker tab and try again.', missing.join(', '))
                : '';
        };
        const buildNativeOrderPreviewHtml = (entries) => {
            const folders = getFolders() || {};
            const managed = String(utils.normalizePrefs(getPrefs() || {})?.dockerStartOrder?.mode || 'docker-page') !== 'unmanaged';
            const items = entries.filter((entry) => !entry.folderId).map((entry) => {
                const folderName = entry.ownerId ? String(folders[entry.ownerId]?.name || entry.ownerId) : '';
                return `<li><span class="fvplus-native-order-name">${escapeHtml(entry.name)}</span>${folderName
                    ? ` <span class="fvplus-native-order-folder">${escapeHtml(translate('docker.native-order.folder', 'Folder: $1', folderName))}</span>` : ''}</li>`;
            }).join('');
            return `<div class="fvplus-native-order-preview">
                <p>${escapeHtml(translate('docker.native-order.intro', 'Unraid will save the containers in the order below. Unraid uses that order on the Docker tab when FolderView Plus is not installed, and it sorts its autostart list by it, so this can change the order containers start in.'))}</p>
                <p>${escapeHtml(managed
                    ? translate('docker.native-order.start-managed', 'FolderView Plus then applies its own setting for the order in which containers start, as it does after a row is dragged.')
                    : translate('docker.native-order.start-unmanaged', 'FolderView Plus is set to leave the start order to Unraid, so nothing adjusts the result afterwards: containers with autostart on will start in the order below.'))}</p>
                <ol class="fvplus-native-order-list">${items}</ol>
            </div>`;
        };
        const describeRequestError = (error) => String(error?.status ? `HTTP ${error.status}` : (error?.message || error?.statusText || 'no response'));
        const showNativeOrderResult = (saved, message, unconfirmed = false) => {
            let title = translate('docker.native-order.not-saved-title', 'The order of the containers was not saved');
            if (saved) title = translate('docker.native-order.saved-title', 'The order of the containers was saved');
            // The request went out but nothing shows what Unraid stored, so the title must not claim either outcome.
            else if (unconfirmed) title = translate('docker.native-order.unconfirmed-title', 'The save could not be confirmed');
            const ui = win?.FolderViewPlusUI;
            if (typeof ui?.alert === 'function') ui.alert({ title, message, tone: saved ? 'success' : 'danger' });
            else if (!saved) showError(message);
            return saved;
        };
        const saveNativeOrder = async () => {
            const ui = win?.FolderViewPlusUI;
            if (typeof nativeOrder.read !== 'function' || typeof nativeOrder.save !== 'function' || typeof ui?.openModal !== 'function') {
                return showNativeOrderResult(false, translate('docker.native-order.not-ready', 'The Docker list on this page is incomplete or out of date. Nothing was changed. Reload the Docker tab and try again.'));
            }
            const readFailed = (error) => showNativeOrderResult(false, translate('docker.native-order.read-failed', 'The container list could not be read from Unraid ($1), so the order of the containers could not be checked. Nothing was changed.', describeRequestError(error)));
            const entries = collectNativeOrder();
            let before;
            try {
                before = await readNativeOrderState();
            } catch (error) {
                return readFailed(error);
            }
            const problem = findNativeOrderProblem(entries, before.order);
            if (problem) return showNativeOrderResult(false, problem);
            const modal = ui.openModal({
                title: translate('docker.actions.save-native-order', 'Save current order to Unraid'),
                content: buildNativeOrderPreviewHtml(entries),
                actions: `${ui.button({ label: translate('common.cancel', 'Cancel'), action: 'modal-cancel' })}${ui.button({ label: translate('docker.actions.save-native-order', 'Save current order to Unraid'), tone: 'primary', action: 'modal-confirm' })}`,
                tone: 'warning',
                closeOnBackdrop: false,
                initialFocus: '[data-fv-ui-action="modal-cancel"]'
            });
            if (!modal) return false;
            modal.element.querySelector('[data-fv-ui-action="modal-cancel"]')?.addEventListener('click', () => modal.close('cancel'));
            modal.element.querySelector('[data-fv-ui-action="modal-confirm"]')?.addEventListener('click', () => modal.close('confirm'));
            if (await modal.closed !== 'confirm') return false;
            // The preview may have been open for a while: send only what was previewed, and only if neither
            // the page nor Unraid's stored order moved in the meantime.
            let now;
            try {
                now = await readNativeOrderState();
            } catch (error) {
                return readFailed(error);
            }
            const names = entries.map((entry) => entry.name);
            // The stored entries are compared too: a save elsewhere that moved only folder entries, or created the
            // file with the order Unraid already used, leaves the effective order as it was.
            if (!sameNativeOrder(collectNativeOrder().map((entry) => entry.name), names)
                || !sameNativeOrder(now.order, before.order) || now.status !== before.status
                || !sameNativeOrder(now.entries, before.entries)) {
                return showNativeOrderResult(false, translate('docker.native-order.changed', 'The Docker list, or the order of the containers saved in Unraid, changed while the preview was open. Nothing was changed. Check the list and try again.'));
            }
            try {
                await nativeOrder.save({ names: `${names.join(';')};`, index: `${names.map((_, index) => index).join(';')};` });
            } catch (error) {
                return showNativeOrderResult(false, translate('docker.native-order.request-failed', 'Unraid did not confirm the save request ($1). Reload the Docker tab to see the order of the containers that is saved in Unraid.', describeRequestError(error)), true);
            }
            const unverified = (cause) => showNativeOrderResult(false, translate('docker.native-order.unverified', 'The save request was sent, but the order of the containers could not be read back from Unraid ($1), so the save is not confirmed. Reload the Docker tab to check it.', cause), true);
            let after;
            try {
                after = await readNativeOrderState();
            } catch (error) {
                return unverified(describeRequestError(error));
            }
            // UserPrefs.php answers without saying whether it wrote the file, and the effective order can match the
            // preview without any write (name order fallback, unlisted containers). Only the stored entries count:
            // every name sent, folder entries included, under the index sent, in the order sent, and nothing else.
            if (after.status !== 'ok') return unverified(describeStoredStatus(after.status));
            return sameNativeOrder(after.entries, names.map((name, index) => `${index}=${name}`))
                ? showNativeOrderResult(true, translate('docker.native-order.saved', 'Unraid now has the containers saved in the order shown in the preview.'))
                : showNativeOrderResult(false, translate('docker.native-order.mismatch', 'The order of the containers saved in Unraid now differs from the order that was sent. Either Unraid did not store it, or another Docker page saved its own order of the containers at the same moment. Check the Docker tab and save again.'));
        };

        const clearHiddenFolderUndo = (folderId = '') => {
            const expectedId = String(folderId || '').trim();
            if (expectedId && String(hiddenFolderUndo?.folderId || '') !== expectedId) return false;
            if (hiddenFolderUndoTimer) {
                win?.clearTimeout?.(hiddenFolderUndoTimer);
                hiddenFolderUndoTimer = 0;
            }
            hiddenFolderUndo = null;
            return true;
        };

        const offerHiddenFolderUndo = ({ folderId = '', folderName = '' } = {}) => {
            clearHiddenFolderUndo();
            const id = String(folderId || '').trim();
            if (!id) return;
            hiddenFolderUndo = {
                folderId: id,
                folderName: String(folderName || translate('docker.visibility.folder-fallback', 'Folder')),
                expiresAt: Date.now() + 10000
            };
            hiddenFolderUndoTimer = win?.setTimeout?.(() => {
                hiddenFolderUndoTimer = 0;
                hiddenFolderUndo = null;
                sync();
            }, 10000) || 0;
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
            const hiddenButton = target.closest?.('[data-fvplus-docker-hidden]');
            if (hiddenButton && !hiddenButton.disabled) {
                event.preventDefault();
                const action = String(hiddenButton.getAttribute('data-fvplus-docker-hidden') || '');
                actionMenuOpen = '';
                if (action === 'toggle-reveal') {
                    folderFilterMode = 'all';
                    clearFocusedFolder();
                    const current = getHiddenVisibilitySummary()?.revealHiddenFolders === true;
                    setRevealHiddenFolders(!current);
                    applyFilterState();
                    sync();
                }
                if (action === 'restore-all') {
                    runTask(async () => {
                        await restoreAllHiddenFolders();
                        clearHiddenFolderUndo();
                        setRevealHiddenFolders(false);
                        applyFilterState();
                    });
                }
                if (action === 'undo' && hiddenFolderUndo?.folderId) {
                    const undoId = hiddenFolderUndo.folderId;
                    clearHiddenFolderUndo(undoId);
                    runTask(async () => {
                        await restoreHiddenFolder(undoId);
                        applyFilterState();
                    });
                }
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
                if (tool === 'refresh') runTask(refreshRuntimeView);
                if (tool === 'save-native-order') runTask(saveNativeOrder);
                if (tool === 'capture-diagnostics') {
                    const snapshot = pageDiagnostics?.capture?.({
                        variant: resolvePageViewMode(getPrefs()),
                        trigger: 'manual',
                        root: doc?.querySelector?.('#docker_list, #docker_view')
                    });
                    win?.FolderViewPlusUI?.announce?.({
                        title: snapshot ? 'Docker diagnostics captured' : 'Docker diagnostics unavailable',
                        message: snapshot ? 'The sanitized snapshot is ready for the next support bundle.' : 'The Docker page was not ready to capture.'
                    });
                }
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
                deps.setUnassignedExpanded?.(action === 'expand-all');
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
            getFilterMode: () => folderFilterMode,
            offerHiddenFolderUndo,
            clearHiddenFolderUndo,
            collectNativeOrder,
            saveNativeOrder
        });
    };

    return Object.freeze({ createApi, VIEW_OPTIONS, SETTINGS_ROUTES });
}));
