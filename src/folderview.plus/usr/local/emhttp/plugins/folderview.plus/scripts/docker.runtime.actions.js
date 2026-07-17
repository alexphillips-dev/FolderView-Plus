// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerRuntimeActions = factory();
    root.FolderViewPlusDockerRuntimeActionsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const EDITOR_PREFILL_STORAGE_KEY = 'fv.folder.editor.prefill.v1';
    const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv.folder.editor.prefill.persist.v1';
    const EDITOR_WINDOW_NAME_PREFIX = 'fv.folder.editor.v1:';
    const EDITOR_BOOTSTRAP_COOKIE_NAME = 'fv_folder_editor_bootstrap';
    const EDITOR_DEBUG_LAUNCH_STORAGE_KEY = 'fv.folder.editor.debug.launch.v1';
    const DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY = 'fv.support.bundle.docker.bulkUpdateTrace.v1';
    const DOCKER_BULK_UPDATE_TRACE_LIMIT = 30;

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || (typeof document !== 'undefined' ? document : null);
        const jq = deps.$ || win?.jQuery || win?.$;
        const swalFn = typeof deps.swal === 'function'
            ? deps.swal
            : (typeof win?.swal === 'function' ? win.swal : (() => {}));
        const openDockerDialog = typeof deps.openDocker === 'function' ? deps.openDocker : (() => {});
        const hideAllTips = typeof deps.hideAllTips === 'function' ? deps.hideAllTips : (() => {});
        const getGlobalFolders = typeof deps.getGlobalFolders === 'function' ? deps.getGlobalFolders : (() => ({}));
        const getFolderChildren = typeof deps.getFolderChildren === 'function' ? deps.getFolderChildren : (() => []);
        const getFolderDescendants = typeof deps.getFolderDescendants === 'function' ? deps.getFolderDescendants : (() => []);
        const isDockerFolderLocked = typeof deps.isDockerFolderLocked === 'function' ? deps.isDockerFolderLocked : (() => false);
        const ensureDockerFolderUnlocked = typeof deps.ensureDockerFolderUnlocked === 'function'
            ? deps.ensureDockerFolderUnlocked
            : (() => true);
        const normalizeFolderParentId = typeof deps.normalizeFolderParentId === 'function'
            ? deps.normalizeFolderParentId
            : ((value) => String(value || '').trim());
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;'));
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function'
            ? deps.getSafeWebuiUrl
            : ((value) => String(value || '').trim());
        const openWebuiPopupWindow = typeof deps.openWebuiPopupWindow === 'function'
            ? deps.openWebuiPopupWindow
            : (() => false);
        const getScopedRuntimeContainersForFolder = typeof deps.getScopedRuntimeContainersForFolder === 'function'
            ? deps.getScopedRuntimeContainersForFolder
            : (() => ({}));
        const runDockerGuardedAction = typeof deps.runDockerGuardedAction === 'function'
            ? deps.runDockerGuardedAction
            : (async (_actionName, action) => ({ ok: true, value: await action() }));
        const getDockerMenuLabel = typeof deps.getDockerMenuLabel === 'function'
            ? deps.getDockerMenuLabel
            : ((_key, fallback) => String(fallback || _key || '').trim());
        const requestClient = deps.requestClient || win?.FolderViewPlusRequest || null;
        const folderSettingsTransfer = deps.folderSettingsTransfer
            || (typeof win?.FolderViewPlusFolderSettingsTransfer?.createApi === 'function'
                ? win.FolderViewPlusFolderSettingsTransfer.createApi({ window: win })
                : null);
        const refreshDockerList = typeof deps.loadlist === 'function' ? deps.loadlist : (() => {});
        const queueDockerListRefresh = typeof deps.queueLoadlistRefresh === 'function' ? deps.queueLoadlistRefresh : (() => {});
        const refreshDockerRuntimeState = typeof deps.refreshDockerRuntimeState === 'function'
            ? deps.refreshDockerRuntimeState
            : refreshDockerList;
        const armDockerPostUpdateRuntimeReconcileWindow = typeof deps.armDockerPostUpdateRuntimeReconcileWindow === 'function'
            ? deps.armDockerPostUpdateRuntimeReconcileWindow
            : null;
        const suspendDockerHostUpdateSync = typeof deps.suspendDockerHostUpdateSync === 'function'
            ? deps.suspendDockerHostUpdateSync
            : (() => 0);
        const eventUrl = String(deps.eventURL || win?.eventURL || '').trim();
        const debugEnabled = deps.debugEnabled === true;
        const consoleRef = deps.console || win?.console || null;
        const defer = typeof win?.setTimeout === 'function'
            ? win.setTimeout.bind(win)
            : ((handler, delay) => setTimeout(handler, delay));
        const promptFn = typeof win?.prompt === 'function' ? win.prompt.bind(win) : (() => '');
        const writeDockerBulkUpdateTrace = (eventType, details = {}) => {
            try {
                if (typeof win?.localStorage === 'undefined') {
                    return;
                }
                const existingRaw = String(win.localStorage.getItem(DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY) || '').trim();
                let existing = {};
                if (existingRaw) {
                    try {
                        existing = JSON.parse(existingRaw);
                    } catch (_parseError) {
                        existing = {};
                    }
                }
                const entries = Array.isArray(existing?.entries) ? existing.entries.slice(-DOCKER_BULK_UPDATE_TRACE_LIMIT) : [];
                entries.push({
                    at: new Date().toISOString(),
                    eventType: String(eventType || '').trim() || 'unknown',
                    details: details && typeof details === 'object' && !Array.isArray(details) ? details : {}
                });
                while (entries.length > DOCKER_BULK_UPDATE_TRACE_LIMIT) {
                    entries.shift();
                }
                win.localStorage.setItem(DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY, JSON.stringify({
                    updatedAt: new Date().toISOString(),
                    count: entries.length,
                    entries
                }));
            } catch (_error) {}
        };

        const debugLog = (...args) => {
            if (debugEnabled && consoleRef && typeof consoleRef.log === 'function') {
                consoleRef.log(...args);
            }
        };

        const debugWarn = (...args) => {
            if (debugEnabled && consoleRef && typeof consoleRef.warn === 'function') {
                consoleRef.warn(...args);
            }
        };

        const debugError = (...args) => {
            if (debugEnabled && consoleRef && typeof consoleRef.error === 'function') {
                consoleRef.error(...args);
            }
        };

        const getFolderMap = () => {
            const folders = getGlobalFolders();
            return folders && typeof folders === 'object' ? folders : {};
        };

        const getFolderById = (id) => {
            const folders = getFolderMap();
            return folders[String(id || '').trim()] || null;
        };

        const getSpinner = () => (typeof jq === 'function' ? jq('div.spinner.fixed') : null);
        const DOCKER_DIALOG_REFRESH_CALLBACK_NAME = '__fvplusDockerDialogRefresh';
        const DOCKER_DIALOG_RUNTIME_REFRESH_DELAY_MS = 180;
        const DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS = 650;
        const DOCKER_DIALOG_BACKSTOP_REFRESH_DELAYS_MS = [3200, 9000];
        const DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS = 120000;

        const formatI18nFallback = (message, params = []) => {
            let formatted = String(message || '');
            params.forEach((param, index) => {
                formatted = formatted.replace(new RegExp(`\\$${index + 1}`, 'g'), String(param ?? ''));
            });
            return formatted;
        };

        const i18nLabel = (key, fallback = '', ...params) => {
            const safeKey = String(key || '').trim();
            const safeFallback = String(fallback || safeKey || '').trim();
            try {
                if (typeof jq?.i18n !== 'function') {
                    return formatI18nFallback(safeFallback, params);
                }
                const localized = String(jq.i18n(safeKey, ...params) || '').trim();
                return localized && localized !== safeKey
                    ? formatI18nFallback(localized, params)
                    : formatI18nFallback(safeFallback, params);
            } catch (_error) {
                return formatI18nFallback(safeFallback, params);
            }
        };

        const runDockerDialogRefresh = () => {
            writeDockerBulkUpdateTrace('dialogCallback', {
                reconcileWindowMs: DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS
            });
            try {
                refreshDockerList();
            } catch (error) {
                debugWarn('[FV3_DEBUG] Docker dialog refresh: host loadlist refresh failed.', error);
                writeDockerBulkUpdateTrace('dialogCallbackLoadlistFailed', {
                    message: String(error?.message || 'loadlist failed')
                });
            }
            defer(() => {
                Promise.resolve(refreshDockerRuntimeState({
                    followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS,
                    liveUpdateStatus: true
                })).catch((error) => {
                    debugWarn('[FV3_DEBUG] Docker dialog refresh: runtime state refresh failed.', error);
                    writeDockerBulkUpdateTrace('dialogCallbackRuntimeRefreshFailed', {
                        message: String(error?.message || 'runtime refresh failed')
                    });
                });
            }, DOCKER_DIALOG_RUNTIME_REFRESH_DELAY_MS);
        };

        const scheduleDockerDialogRefreshBackstops = () => {
            DOCKER_DIALOG_BACKSTOP_REFRESH_DELAYS_MS.forEach((delayMs) => {
                defer(() => {
                    writeDockerBulkUpdateTrace('backstopRefresh', {
                        delayMs
                    });
                    Promise.resolve(refreshDockerRuntimeState({
                        followupDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_FOLLOWUP_DELAY_MS,
                        liveUpdateStatus: true
                    })).catch((error) => {
                        debugWarn('[FV3_DEBUG] Docker dialog refresh: runtime-state backstop failed.', error);
                        writeDockerBulkUpdateTrace('backstopRefreshFailed', {
                            delayMs,
                            message: String(error?.message || 'runtime-state backstop failed')
                        });
                        try {
                            queueDockerListRefresh({ suppressLoadingUi: true });
                        } catch (_queueError) {
                            try {
                                refreshDockerList();
                            } catch (_refreshError) {}
                        }
                    });
                }, delayMs);
            });
        };

        const getDockerDialogRefreshCallbackName = () => {
            if (!win || (typeof win !== 'object' && typeof win !== 'function')) {
                return 'loadlist';
            }
            if (typeof win[DOCKER_DIALOG_REFRESH_CALLBACK_NAME] !== 'function') {
                win[DOCKER_DIALOG_REFRESH_CALLBACK_NAME] = () => {
                    runDockerDialogRefresh();
                };
            }
            return DOCKER_DIALOG_REFRESH_CALLBACK_NAME;
        };

        const openDockerFolderUpdateDialog = (containersToUpdate, title) => {
            if (armDockerPostUpdateRuntimeReconcileWindow) {
                armDockerPostUpdateRuntimeReconcileWindow(DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS, {
                    initialDelayMs: DOCKER_DIALOG_RUNTIME_REFRESH_DELAY_MS,
                    pollDelayMs: Math.max(...DOCKER_DIALOG_BACKSTOP_REFRESH_DELAYS_MS)
                });
            } else {
                suspendDockerHostUpdateSync(DOCKER_DIALOG_POST_RENDER_RECONCILE_WINDOW_MS);
            }
            const containerNames = String(containersToUpdate || '')
                .split('*')
                .map((entry) => String(entry || '').trim())
                .filter(Boolean);
            writeDockerBulkUpdateTrace('dialogOpened', {
                title: String(title || '').trim(),
                containerCount: containerNames.length,
                containerNames: containerNames.slice(0, 10)
            });
            scheduleDockerDialogRefreshBackstops();
            openDockerDialog('update_container ' + containersToUpdate, title, '', getDockerDialogRefreshCallbackName());
        };

        const postJsonWithFallback = async (url, payload, options = {}) => {
            if (!requestClient || typeof requestClient.postJson !== 'function') {
                throw new Error('FolderView Plus request client is unavailable.');
            }
            return requestClient.postJson(url, payload, options);
        };

        const summarizeFolderActionCounts = (containersMap) => {
            const entries = Object.values(containersMap || {});
            let startable = 0;
            let stoppable = 0;
            let pausable = 0;
            let resumable = 0;
            let restartable = 0;
            let managed = 0;
            let updateReady = 0;
            for (const entry of entries) {
                const isRunning = entry?.state === true;
                const isPaused = entry?.pause === true;
                const isManaged = entry?.managed === true;
                const hasUpdate = entry?.update === true;
                if (!isRunning) {
                    startable += 1;
                }
                if (isRunning) {
                    stoppable += 1;
                }
                if (isRunning && !isPaused) {
                    pausable += 1;
                }
                if (isRunning && isPaused) {
                    resumable += 1;
                }
                restartable += 1;
                if (isManaged) {
                    managed += 1;
                    if (hasUpdate) {
                        updateReady += 1;
                    }
                }
            }
            return {
                total: entries.length,
                startable,
                stoppable,
                pausable,
                resumable,
                restartable,
                managed,
                updateReady
            };
        };

        const rmFolder = (id) => {
            debugLog(`[FV3_DEBUG] rmFolder (id: ${id}): Entry.`);
            if (!ensureDockerFolderUnlocked(id, 'Delete folder')) {
                return;
            }
            const folder = getFolderById(id) || {};
            const folderName = escapeHtml(String(folder.name || id));
            const parentId = normalizeFolderParentId(folder.parentId || folder.parent_id || '');
            const parentFolder = parentId ? getFolderById(parentId) : null;
            const parentName = parentId && parentFolder
                ? escapeHtml(String(parentFolder.name || parentId))
                : 'root';
            const directChildren = getFolderChildren(id);
            const directChildCount = directChildren.length;
            const descendantCount = getFolderDescendants(id).length;
            const impactLines = [`${i18nLabel('remove-folder', 'Remove folder')}: ${folderName}`];
            if (directChildCount > 0) {
                impactLines.push(
                    `This folder has <strong>${directChildCount}</strong> direct child folder${directChildCount === 1 ? '' : 's'} (${descendantCount} nested in branch).`,
                    `Children will be re-parented under <strong>${parentName}</strong>.`
                );
            }
            swalFn({
                title: i18nLabel('are-you-sure', 'Are you sure?'),
                text: impactLines.join('<br>'),
                type: 'warning',
                html: true,
                showCancelButton: true,
                confirmButtonText: i18nLabel('yes-delete', 'Yes, delete'),
                cancelButtonText: i18nLabel('cancel', 'Cancel'),
                showLoaderOnConfirm: true
            },
            async (c) => {
                debugLog(`[FV3_DEBUG] rmFolder (id: ${id}): Swal callback. Confirmed: ${c}`);
                if (!c) {
                    defer(refreshDockerList, 0);
                    return;
                }
                getSpinner()?.show('slow');
                debugLog(`[FV3_DEBUG] rmFolder (id: ${id}): Calling delete API.`);
                await requestClient.postJson('/plugins/folderview.plus/server/delete.php', { type: 'docker', id });
                debugLog(`[FV3_DEBUG] rmFolder (id: ${id}): Delete API call finished. Reloading list.`);
                defer(refreshDockerList, 500);
            });
        };

        const getLockedDockerBranchFolderIds = (id) => {
            const branchIds = [id, ...getFolderDescendants(id)];
            return branchIds.filter((folderId) => isDockerFolderLocked(folderId));
        };

        const ensureDockerBranchUnlocked = (id, actionLabel = 'This action') => {
            const lockedIds = getLockedDockerBranchFolderIds(id);
            if (!lockedIds.length) {
                return true;
            }
            const folders = getFolderMap();
            const previewNames = lockedIds
                .slice(0, 4)
                .map((folderId) => escapeHtml(String(folders?.[folderId]?.name || folderId)))
                .join(', ');
            const hiddenCount = Math.max(0, lockedIds.length - Math.min(4, lockedIds.length));
            const lockedLabel = lockedIds.length === 1
                ? 'A folder in this branch is locked.'
                : `${lockedIds.length} folders in this branch are locked.`;
            const hiddenSuffix = hiddenCount > 0 ? ` (+${hiddenCount} more)` : '';
            const detailsLine = previewNames ? `<br><strong>Locked:</strong> ${previewNames}${hiddenSuffix}` : '';
            swalFn({
                title: 'Folder branch locked',
                text: `${escapeHtml(actionLabel)} is blocked while ${lockedLabel}${detailsLine}<br>Unlock the locked folder rows first and try again.`,
                type: 'info',
                html: true,
                confirmButtonText: 'OK'
            });
            return false;
        };

        const deleteDockerFolderBranch = async (id) => {
            const deleteIds = [...getFolderDescendants(id)].reverse();
            deleteIds.push(id);
            for (const deleteId of deleteIds) {
                await requestClient.postJson('/plugins/folderview.plus/server/delete.php', { type: 'docker', id: deleteId });
            }
        };

        const rmFolderBranch = (id) => {
            debugLog(`[FV3_DEBUG] rmFolderBranch (id: ${id}): Entry.`);
            if (!ensureDockerBranchUnlocked(id, 'Delete branch folders')) {
                return;
            }
            const folders = getFolderMap();
            const folder = folders[id] || {};
            const folderName = escapeHtml(String(folder.name || id));
            const descendantIds = getFolderDescendants(id);
            const branchIds = [id, ...descendantIds];
            const previewNames = branchIds
                .slice(0, 5)
                .map((folderId) => escapeHtml(String(folders?.[folderId]?.name || folderId)))
                .join(', ');
            const hiddenCount = Math.max(0, branchIds.length - Math.min(5, branchIds.length));
            const impactLines = [
                `Delete branch folders: ${folderName}`,
                `This will permanently delete <strong>${branchIds.length}</strong> folder${branchIds.length === 1 ? '' : 's'} in this branch.`,
                'Nested child folders will be deleted with the root folder and will <strong>not</strong> be re-parented.'
            ];
            if (previewNames) {
                impactLines.push(`<strong>Branch:</strong> ${previewNames}${hiddenCount > 0 ? ` (+${hiddenCount} more)` : ''}`);
            }
            swalFn({
                title: i18nLabel('are-you-sure', 'Are you sure?'),
                text: impactLines.join('<br>'),
                type: 'warning',
                html: true,
                showCancelButton: true,
                confirmButtonText: i18nLabel('yes-delete', 'Yes, delete'),
                cancelButtonText: i18nLabel('cancel', 'Cancel'),
                showLoaderOnConfirm: true
            },
            async (confirmed) => {
                debugLog(`[FV3_DEBUG] rmFolderBranch (id: ${id}): Swal callback. Confirmed: ${confirmed}`);
                if (!confirmed) {
                    defer(refreshDockerList, 0);
                    return;
                }
                getSpinner()?.show('slow');
                try {
                    const result = await runDockerGuardedAction('delete-folder-branch', async () => {
                        await deleteDockerFolderBranch(id);
                        defer(refreshDockerList, 500);
                    }, {
                        userMessage: getDockerMenuLabel('delete-branch-folders-failed', 'Failed to delete branch folders.'),
                        userVisible: true
                    });
                    if (!result.ok) {
                        defer(refreshDockerList, 0);
                    }
                } finally {
                    getSpinner()?.hide('slow');
                }
            });
        };

        const clearFolderEditorPrefill = () => {
            try {
                if (typeof win?.sessionStorage !== 'undefined') {
                    win.sessionStorage.removeItem(EDITOR_PREFILL_STORAGE_KEY);
                }
                if (typeof win?.localStorage !== 'undefined') {
                    win.localStorage.removeItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY);
                }
                if (String(win?.name || '').startsWith(EDITOR_WINDOW_NAME_PREFIX)) {
                    win.name = '';
                }
                if (doc) {
                    doc.cookie = `${EDITOR_BOOTSTRAP_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
                }
            } catch (_error) {
                // Editor prefill cleanup is best-effort only.
            }
        };

        const recordFolderEditorLaunchDebug = (sourcePage, folderType, id, targetUrl) => {
            try {
                if (typeof win?.localStorage === 'undefined') {
                    return;
                }
                const normalizedId = String(id || '').trim();
                const folder = getFolderById(normalizedId);
                win.localStorage.setItem(EDITOR_DEBUG_LAUNCH_STORAGE_KEY, JSON.stringify({
                    storedAt: new Date().toISOString(),
                    source: String(sourcePage || 'docker').trim() || 'docker',
                    type: String(folderType || '').trim() === 'vm' ? 'vm' : 'docker',
                    id: normalizedId,
                    folderName: String(folder?.name || normalizedId || '').trim(),
                    currentUrl: String(win?.location?.href || ''),
                    targetUrl: String(targetUrl || '').trim(),
                    hasFolderRecord: Boolean(folder && typeof folder === 'object'),
                    sessionStorageAvailable: typeof win?.sessionStorage !== 'undefined',
                    localStorageAvailable: typeof win?.localStorage !== 'undefined',
                    cookiePresent: String(doc?.cookie || '').includes(`${EDITOR_BOOTSTRAP_COOKIE_NAME}=`)
                }));
            } catch (_error) {
                // Folder editor launch diagnostics are best-effort only.
            }
        };

        const seedFolderEditorPrefill = (folderType, id) => {
            try {
                const normalizedId = String(id || '').trim();
                const folder = getFolderById(normalizedId);
                if (!normalizedId || !folder) {
                    return;
                }
                const payload = JSON.stringify({
                    type: folderType,
                    id: normalizedId,
                    folder,
                    storedAt: Date.now()
                });
                if (typeof win?.sessionStorage !== 'undefined') {
                    win.sessionStorage.setItem(EDITOR_PREFILL_STORAGE_KEY, payload);
                }
                if (typeof win?.localStorage !== 'undefined') {
                    win.localStorage.setItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY, payload);
                }
                if (win) {
                    win.name = `${EDITOR_WINDOW_NAME_PREFIX}${payload}`;
                }
                if (doc) {
                    doc.cookie = `${EDITOR_BOOTSTRAP_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({
                        type: folderType,
                        id: normalizedId,
                        storedAt: Date.now()
                    }))}; path=/; max-age=900; SameSite=Lax`;
                }
            } catch (_error) {
                // Editor prefill is best-effort only.
            }
        };

        const buildDockerFolderEditorUrl = (id = '', options = {}) => {
            const params = new URLSearchParams();
            const hashParams = new URLSearchParams();
            params.set('type', 'docker');
            hashParams.set('type', 'docker');
            if (String(id || '').trim()) {
                params.set('id', String(id || '').trim());
                hashParams.set('id', String(id || '').trim());
            }
            const parentId = normalizeFolderParentId(options?.parentId || '');
            if (parentId) {
                params.set('parentId', parentId);
                hashParams.set('parentId', parentId);
            }
            params.set('_', String(Date.now()));
            return `/Docker/Folder?${params.toString()}#${hashParams.toString()}`;
        };

        const editFolder = (id) => {
            if (!ensureDockerFolderUnlocked(id, 'Edit folder')) {
                return;
            }
            debugLog(`[FV3_DEBUG] editFolder (id: ${id}): Redirecting to edit page.`);
            seedFolderEditorPrefill('docker', id);
            const targetUrl = buildDockerFolderEditorUrl(id);
            recordFolderEditorLaunchDebug('docker', 'docker', id, targetUrl);
            if (win?.location) {
                win.location.href = targetUrl;
            }
        };

        const createChildFolder = (parentId) => {
            const safeParentId = normalizeFolderParentId(parentId);
            if (!safeParentId || !getFolderById(safeParentId)) {
                return;
            }
            if (!ensureDockerFolderUnlocked(safeParentId, 'Add child folder')) {
                return;
            }
            clearFolderEditorPrefill();
            const targetUrl = buildDockerFolderEditorUrl('', { parentId: safeParentId });
            recordFolderEditorLaunchDebug('docker', 'docker', '', targetUrl);
            if (win?.location) {
                win.location.href = targetUrl;
            }
        };

        const forceUpdateFolder = (id, { includeDescendants = true } = {}) => {
            debugLog(`[FV3_DEBUG] forceUpdateFolder (id: ${id}, includeDescendants: ${includeDescendants}): Entry.`);
            hideAllTips();
            const folder = getFolderById(id);
            if (!folder) {
                return;
            }
            debugLog(`[FV3_DEBUG] forceUpdateFolder (id: ${id}): Folder data:`, { ...folder });
            const containersMap = getScopedRuntimeContainersForFolder(id, includeDescendants);
            const containersToUpdate = Object.entries(containersMap)
                .filter(([, value]) => value.managed)
                .map((entry) => entry[0])
                .join('*');
            if (!containersToUpdate) {
                debugLog(`[FV3_DEBUG] forceUpdateFolder (id: ${id}): No managed containers in selected scope.`);
                return;
            }
            debugLog(`[FV3_DEBUG] forceUpdateFolder (id: ${id}): Containers to force update: ${containersToUpdate}. Calling openDocker.`);
            openDockerFolderUpdateDialog(containersToUpdate, i18nLabel('updating', 'Updating $1 folder containers', folder.name));
        };

        const updateFolder = (id, { includeDescendants = true } = {}) => {
            debugLog(`[FV3_DEBUG] updateFolder (id: ${id}, includeDescendants: ${includeDescendants}): Entry.`);
            hideAllTips();
            const folder = getFolderById(id);
            if (!folder) {
                return;
            }
            debugLog(`[FV3_DEBUG] updateFolder (id: ${id}): Folder data:`, { ...folder });
            const containersMap = getScopedRuntimeContainersForFolder(id, includeDescendants);
            const containersToUpdate = Object.entries(containersMap)
                .filter(([, value]) => value.managed && value.update)
                .map((entry) => entry[0])
                .join('*');
            if (!containersToUpdate) {
                debugLog(`[FV3_DEBUG] updateFolder (id: ${id}): No updatable managed containers in selected scope.`);
                return;
            }
            debugLog(`[FV3_DEBUG] updateFolder (id: ${id}): Containers to update (ready): ${containersToUpdate}. Calling openDocker.`);
            openDockerFolderUpdateDialog(containersToUpdate, i18nLabel('updating', 'Updating $1 folder containers', folder.name));
        };

        const collectFolderWebuiTargets = (id, includeDescendants = true, runningOnly = true) =>
            Object.values(getScopedRuntimeContainersForFolder(id, includeDescendants) || {}).reduce((out, entry) => {
                const url = getSafeWebuiUrl(entry?.webui);
                if (url && (!runningOnly || (entry?.state === true && entry?.pause !== true))) {
                    out.push(url);
                }
                return out;
            }, []);

        const showFolderWebuiPopupWarning = (openedCount, totalCount, blockedUrls) => {
            const popupTextColor = 'var(--fvplus-runtime-menu-fg, var(--fvplus-theme-foreground, currentColor))';
            const popupMutedColor = 'var(--fvplus-runtime-menu-muted, var(--fvplus-runtime-menu-fg, currentColor))';
            const popupPanelBorder = 'var(--fvplus-runtime-menu-divider, var(--fvplus-runtime-menu-border, currentColor))';
            const popupPanelBg = 'var(--fvplus-runtime-menu-header-bg, transparent)';
            const popupLinkColor = 'var(--link, var(--fvplus-status-started, var(--fvplus-runtime-menu-fg, currentColor)))';
            const popupOpenedColor = 'var(--fvplus-status-started, var(--fvplus-runtime-menu-fg, currentColor))';
            const popupBlockedColor = 'var(--orange, var(--fvplus-runtime-menu-fg, currentColor))';
            const popupTotalColor = 'var(--fvplus-runtime-menu-fg, currentColor)';
            const blockedList = Array.isArray(blockedUrls) ? blockedUrls.slice(0, 6) : [];
            const linkHtml = blockedList
                .map((url) => `<li style="margin:0 0 8px; line-height:1.35;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:${popupLinkColor}; text-decoration:none;">${escapeHtml(url)}</a></li>`)
                .join('');
            const overflowCount = Math.max(0, (blockedUrls?.length || 0) - blockedList.length);
            const overflowHint = overflowCount > 0
                ? `<div style="margin-top:2px; opacity:.75;">+${overflowCount} more blocked link${overflowCount === 1 ? '' : 's'} not shown</div>`
                : '';
            const host = escapeHtml(String(win?.location?.host || '').trim() || 'this Unraid server');
            const blockedCount = Math.max(0, totalCount - openedCount);
            const popupBody = [
                `<div style="text-align:left; max-width:640px; margin:0 auto; color:${popupTextColor};">`,
                `<div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin:8px 0 12px;">`,
                `<span style="display:inline-flex; align-items:center; border:1px solid ${popupOpenedColor}; background:${popupPanelBg}; color:${popupOpenedColor}; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:600;">Opened ${openedCount}</span>`,
                `<span style="display:inline-flex; align-items:center; border:1px solid ${popupBlockedColor}; background:${popupPanelBg}; color:${popupBlockedColor}; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:600;">Blocked ${blockedCount}</span>`,
                `<span style="display:inline-flex; align-items:center; border:1px solid ${popupPanelBorder}; background:${popupPanelBg}; color:${popupTotalColor}; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:600;">Total ${totalCount}</span>`,
                `</div>`,
                `<div style="border:1px solid ${popupPanelBorder}; background:${popupPanelBg}; border-radius:10px; padding:10px 12px; margin:0 0 12px;">`,
                `<div style="font-size:11px; opacity:.75; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; color:${popupMutedColor};">Current Unraid Host</div>`,
                `<div style="font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; word-break:break-all;">${host}</div>`,
                `</div>`,
                `<div style="border:1px solid ${popupPanelBorder}; background:${popupPanelBg}; border-radius:10px; padding:10px 12px; margin:0 0 12px;">`,
                `<div style="font-weight:700; margin:0 0 6px;">Allow Popups Once</div>`,
                `<ol style="margin:0; padding-left:18px; line-height:1.45;">`,
                `<li>Click the popup-blocked icon in your browser address bar.</li>`,
                `<li>Choose to always allow popups/redirects for this Unraid host.</li>`,
                `<li>Run <strong>Open all WebUIs</strong> again.</li>`,
                `</ol>`,
                `</div>`,
                `<div style="border:1px solid ${popupPanelBorder}; background:${popupPanelBg}; border-radius:10px; padding:10px 12px; margin:0 0 12px;">`,
                `<div style="font-weight:700; margin:0 0 6px;">Browser Quick Guide</div>`,
                `<ul style="margin:0; padding-left:18px; line-height:1.45;">`,
                `<li><strong>Chrome / Edge:</strong> address bar popup icon -> <em>Always allow pop-ups and redirects</em>.</li>`,
                `<li><strong>Firefox:</strong> address bar popup indicator -> allow popups for this site.</li>`,
                `<li><strong>Safari (iPhone):</strong> Settings -> Safari -> turn off <em>Block Pop-ups</em>.</li>`,
                `</ul>`,
                `</div>`,
                linkHtml
                    ? `<div style="border:1px solid ${popupPanelBorder}; background:${popupPanelBg}; border-radius:10px; padding:10px 12px;">`
                        + `<div style="font-weight:700; margin:0 0 6px;">Blocked WebUIs (manual open)</div>`
                        + `<ul style="max-height:140px; overflow:auto; margin:0; padding-left:18px;">${linkHtml}</ul>${overflowHint}`
                        + `</div>`
                    : '',
                `</div>`
            ].join('');
            swalFn({
                title: 'Popup blocked',
                text: popupBody,
                type: 'warning',
                html: true,
                confirmButtonText: 'Got it'
            });
        };

        const openFolderWebuisFromMenu = (id, runningOnly = true, includeDescendants = false) => {
            runDockerGuardedAction('open-folder-webuis', async () => {
                hideAllTips();
                const urls = Array.from(new Set(collectFolderWebuiTargets(id, includeDescendants, runningOnly)));
                if (!urls.length) {
                    return;
                }
                const blocked = [];
                const stamp = Date.now();
                for (let index = 0; index < urls.length; index += 1) {
                    try {
                        if (!openWebuiPopupWindow(urls[index], `fvw-${stamp}-${index}`)) {
                            blocked.push(urls[index]);
                        }
                    } catch {
                        blocked.push(urls[index]);
                    }
                }
                if (blocked.length > 0) {
                    showFolderWebuiPopupWarning(urls.length - blocked.length, urls.length, blocked);
                }
            }, {
                userVisible: false
            });
        };

        const buildDockerFolderClonePayload = (source, overrides = {}) => {
            const sourceName = String(source?.name || '').trim() || 'Folder';
            const sourceParentId = normalizeFolderParentId(source?.parentId || source?.parent_id || '');
            const overrideName = overrides && Object.prototype.hasOwnProperty.call(overrides, 'name')
                ? overrides.name
                : undefined;
            const overrideParentId = overrides && Object.prototype.hasOwnProperty.call(overrides, 'parentId')
                ? overrides.parentId
                : undefined;
            const resolvedName = String(overrideName ?? sourceName).trim() || 'Folder';
            const resolvedParentId = normalizeFolderParentId(overrideParentId ?? sourceParentId);
            return {
                name: resolvedName,
                icon: String(source?.icon || ''),
                parentId: resolvedParentId,
                settings: JSON.parse(JSON.stringify((source?.settings && typeof source.settings === 'object') ? source.settings : {})),
                regex: String(source?.regex || ''),
                containers: Array.isArray(source?.containers) ? [...source.containers] : [],
                actions: Array.isArray(source?.actions) ? JSON.parse(JSON.stringify(source.actions)) : []
            };
        };

        const buildFolderSettingsSummaryHtml = (entry) => {
            const summary = folderSettingsTransfer?.summarizeClipboardEntry(entry) || {
                sourceName: 'Copied folder settings',
                copiedActionCount: 0,
                droppedMemberBoundActionCount: 0,
                labels: ['Folder settings']
            };
            const labelHtml = summary.labels.map((label) => `<span class="fv-folder-settings-pill">${escapeHtml(label)}</span>`).join(' ');
            const skippedHint = summary.droppedMemberBoundActionCount > 0
                ? `<div style="margin-top:8px;">Skipped ${summary.droppedMemberBoundActionCount} member-bound custom action${summary.droppedMemberBoundActionCount === 1 ? '' : 's'} to avoid copying source-specific targets.</div>`
                : '';
            return [
                `<div><strong>Source:</strong> ${escapeHtml(summary.sourceName)}</div>`,
                `<div style="margin-top:8px;"><strong>Will apply:</strong> ${labelHtml || '<span class="fv-folder-settings-pill">Folder settings</span>'}</div>`,
                skippedHint
            ].join('');
        };

        const copyDockerFolderSettingsFromMenu = async (id) => {
            await runDockerGuardedAction('copy-folder-settings', async () => {
                if (!ensureDockerFolderUnlocked(id, 'Copy folder settings')) {
                    return;
                }
                if (!folderSettingsTransfer) {
                    throw new Error('Folder settings transfer module is unavailable.');
                }
                const source = getFolderById(id);
                if (!source || typeof source !== 'object') {
                    return;
                }
                const clipboardEntry = folderSettingsTransfer.buildClipboardEntry('docker', source, {
                    sourceId: id,
                    sourceName: String(source?.name || id).trim(),
                    sourceContext: 'docker-runtime'
                });
                if (!clipboardEntry || folderSettingsTransfer.writeClipboardEntry(clipboardEntry) !== true) {
                    throw new Error('Unable to copy folder settings into the clipboard.');
                }
                swalFn({
                    title: 'Folder settings copied',
                    text: buildFolderSettingsSummaryHtml(clipboardEntry),
                    type: 'success',
                    html: true,
                    confirmButtonText: 'OK'
                });
            }, {
                userMessage: getDockerMenuLabel('copy-folder-settings-failed', 'Failed to copy folder settings.'),
                userVisible: true
            });
        };

        const pasteDockerFolderSettingsFromMenu = async (id) => {
            await runDockerGuardedAction('paste-folder-settings', async () => {
                if (!ensureDockerFolderUnlocked(id, 'Paste folder settings')) {
                    return;
                }
                if (!folderSettingsTransfer) {
                    throw new Error('Folder settings transfer module is unavailable.');
                }
                const targetFolder = getFolderById(id);
                if (!targetFolder || typeof targetFolder !== 'object') {
                    return;
                }
                const clipboardEntry = folderSettingsTransfer.readClipboardEntry('docker');
                if (!clipboardEntry) {
                    swalFn({
                        title: 'No folder settings copied',
                        text: 'Copy folder settings from another Docker folder first.',
                        type: 'info',
                        confirmButtonText: 'OK'
                    });
                    return;
                }
                const summaryHtml = [
                    `<div><strong>Target:</strong> ${escapeHtml(String(targetFolder?.name || id).trim() || id)}</div>`,
                    `<div style="margin-top:10px;">${buildFolderSettingsSummaryHtml(clipboardEntry)}</div>`
                ].join('');
                swalFn({
                    title: 'Paste folder settings',
                    text: summaryHtml,
                    type: 'warning',
                    html: true,
                    showCancelButton: true,
                    confirmButtonText: 'Paste',
                    cancelButtonText: 'Cancel',
                    closeOnConfirm: false,
                    showLoaderOnConfirm: true
                }, async (confirmed) => {
                    if (!confirmed) {
                        return;
                    }
                    try {
                        getSpinner()?.show('slow');
                        await postJsonWithFallback('/plugins/folderview.plus/server/apply_folder_settings.php', {
                            type: 'docker',
                            targetIds: JSON.stringify([id]),
                            settings: JSON.stringify(clipboardEntry.payload)
                        }, {
                            retries: 0,
                            retryDelayMs: 260
                        });
                        swal.close();
                        refreshDockerList();
                    } finally {
                        getSpinner()?.hide('slow');
                    }
                });
            }, {
                userMessage: getDockerMenuLabel('paste-folder-settings-failed', 'Failed to paste folder settings.'),
                userVisible: true
            });
        };

        const buildDockerFolderCloneIdFallback = (reservedIds = new Set()) => {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const reserved = reservedIds instanceof Set ? reservedIds : new Set();
            const cryptoObject = win?.crypto || win?.msCrypto || null;
            const folders = getFolderMap();
            for (let attempt = 0; attempt < 16; attempt += 1) {
                let nextId = '';
                if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
                    const bytes = new Uint8Array(20);
                    cryptoObject.getRandomValues(bytes);
                    nextId = Array.from(bytes, (value) => alphabet.charAt(value % alphabet.length)).join('');
                } else {
                    nextId = Array.from({ length: 20 }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join('');
                }
                if (!reserved.has(nextId) && !Object.prototype.hasOwnProperty.call(folders, nextId)) {
                    return nextId;
                }
            }
            return `fvclone${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 20);
        };

        const generateDockerFolderCloneId = typeof deps.generateDockerFolderCloneId === 'function'
            ? deps.generateDockerFolderCloneId
            : buildDockerFolderCloneIdFallback;

        const getDockerFolderBranchCloneOrder = (rootId) => {
            const folders = getFolderMap();
            const orderedIds = [];
            const seen = new Set();
            const visit = (folderId) => {
                const safeFolderId = String(folderId || '').trim();
                if (!safeFolderId || seen.has(safeFolderId) || !folders[safeFolderId]) {
                    return;
                }
                seen.add(safeFolderId);
                orderedIds.push(safeFolderId);
                getFolderChildren(safeFolderId).forEach(visit);
            };
            visit(rootId);
            return orderedIds;
        };

        const persistDockerFolderClonePayloadFallback = async (payload, folderId = '') => {
            const safeFolderId = String(folderId || '').trim();
            const request = {
                type: 'docker',
                content: JSON.stringify(payload)
            };
            if (safeFolderId) {
                request.id = safeFolderId;
            }
            await requestClient.postJson(
                safeFolderId
                    ? '/plugins/folderview.plus/server/update.php'
                    : '/plugins/folderview.plus/server/create.php',
                request
            );
        };

        const persistDockerFolderClonePayload = typeof deps.persistDockerFolderClonePayload === 'function'
            ? deps.persistDockerFolderClonePayload
            : persistDockerFolderClonePayloadFallback;

        const rollbackClonedDockerFoldersFallback = async (createdIds = []) => {
            const ids = Array.isArray(createdIds)
                ? createdIds.filter((entry) => String(entry || '').trim() !== '')
                : [];
            for (const createdId of ids.slice().reverse()) {
                try {
                    await requestClient.postJson('/plugins/folderview.plus/server/delete.php', {
                        type: 'docker',
                        id: createdId
                    });
                } catch (_error) {
                    // Best-effort rollback only.
                }
            }
            if (ids.length > 0) {
                try {
                    await requestClient.postJson('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' });
                } catch (_error) {
                    // Best-effort rollback only.
                }
            }
        };

        const rollbackClonedDockerFolders = typeof deps.rollbackClonedDockerFolders === 'function'
            ? deps.rollbackClonedDockerFolders
            : rollbackClonedDockerFoldersFallback;

        const cloneDockerFolderFromMenu = async (id) => {
            await runDockerGuardedAction('clone-folder', async () => {
                if (!ensureDockerFolderUnlocked(id, 'Clone folder')) {
                    return;
                }
                const source = getFolderById(id);
                if (!source || typeof source !== 'object') {
                    return;
                }
                const defaultName = `${String(source?.name || 'Folder').trim() || 'Folder'} (Copy)`;
                const nextName = String(promptFn('Clone folder name', defaultName) || '').trim();
                if (!nextName) {
                    return;
                }
                const clonePayload = buildDockerFolderClonePayload(source, { name: nextName });
                getSpinner()?.show('slow');
                try {
                    await persistDockerFolderClonePayload(clonePayload);
                    await requestClient.postJson('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' });
                    refreshDockerList();
                } finally {
                    getSpinner()?.hide('slow');
                }
            }, {
                userMessage: getDockerMenuLabel('clone-folder-failed', 'Failed to clone folder.'),
                userVisible: true
            });
        };

        const cloneDockerFolderBranchFromMenu = async (id) => {
            await runDockerGuardedAction('clone-branch', async () => {
                if (!ensureDockerFolderUnlocked(id, 'Clone branch')) {
                    return;
                }
                const source = getFolderById(id);
                if (!source || typeof source !== 'object') {
                    return;
                }
                const branchIds = getDockerFolderBranchCloneOrder(id);
                if (branchIds.length <= 1) {
                    await cloneDockerFolderFromMenu(id);
                    return;
                }
                const defaultName = `${String(source?.name || 'Folder').trim() || 'Folder'} (Copy)`;
                const nextName = String(promptFn('Clone branch root name', defaultName) || '').trim();
                if (!nextName) {
                    return;
                }
                const sourceParentId = normalizeFolderParentId(source?.parentId || source?.parent_id || '');
                const reservedIds = new Set(Object.keys(getFolderMap()));
                const cloneIdMap = new Map();
                branchIds.forEach((sourceId) => {
                    const cloneId = generateDockerFolderCloneId(reservedIds);
                    reservedIds.add(cloneId);
                    cloneIdMap.set(sourceId, cloneId);
                });
                const createdIds = [];
                getSpinner()?.show('slow');
                try {
                    for (const sourceId of branchIds) {
                        const sourceFolder = getFolderById(sourceId);
                        if (!sourceFolder || typeof sourceFolder !== 'object') {
                            continue;
                        }
                        const rawParentId = normalizeFolderParentId(sourceFolder?.parentId || sourceFolder?.parent_id || '');
                        const clonedParentId = sourceId === id
                            ? sourceParentId
                            : String(cloneIdMap.get(rawParentId) || '').trim();
                        if (sourceId !== id && !clonedParentId) {
                            throw new Error(`Clone branch failed because parent mapping was missing for nested folder "${sourceFolder?.name || sourceId}".`);
                        }
                        const clonePayload = buildDockerFolderClonePayload(sourceFolder, {
                            name: sourceId === id ? nextName : String(sourceFolder?.name || '').trim() || 'Folder',
                            parentId: clonedParentId
                        });
                        const cloneId = String(cloneIdMap.get(sourceId) || '').trim();
                        if (!cloneId) {
                            throw new Error(`Clone branch failed because a clone id was not generated for folder "${sourceFolder?.name || sourceId}".`);
                        }
                        await persistDockerFolderClonePayload(clonePayload, cloneId);
                        createdIds.push(cloneId);
                    }
                    await requestClient.postJson('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' });
                    refreshDockerList();
                } catch (error) {
                    await rollbackClonedDockerFolders(createdIds);
                    throw error;
                } finally {
                    getSpinner()?.hide('slow');
                }
            }, {
                userMessage: getDockerMenuLabel('clone-branch-failed', 'Failed to clone branch.'),
                userVisible: true
            });
        };

        const actionFolder = async (id, action, { includeDescendants = true } = {}) => {
            debugLog(`[FV3_DEBUG] actionFolder (id: ${id}, action: ${action}, includeDescendants: ${includeDescendants}): Entry.`);
            const spinner = getSpinner();
            try {
                const folder = getFolderById(id);
                const containersMap = getScopedRuntimeContainersForFolder(id, includeDescendants);
                if (!folder || !containersMap || Object.keys(containersMap).length === 0) {
                    debugError(`[FV3_DEBUG] actionFolder (id: ${id}): Folder or scoped containers not found in globalFolders.`);
                    return;
                }
                const cts = Object.keys(containersMap);
                const proms = [];

                debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Folder data:`, { ...folder }, 'Containers to act on:', cts);

                if (typeof jq === 'function') {
                    jq(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
                }
                spinner?.show('slow');

                for (let index = 0; index < cts.length; index += 1) {
                    const containerName = cts[index];
                    const ct = containersMap[containerName];
                    if (!ct) {
                        debugWarn(`[FV3_DEBUG] actionFolder (id: ${id}): Container data for '${containerName}' not found in scoped containers.`);
                        continue;
                    }
                    const cid = ct.id;
                    let pass = false;
                    debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Processing container ${containerName} (cid: ${cid}). State: ${ct.state}, Paused: ${ct.pause}.`);
                    switch (action) {
                        case 'start':
                            pass = !ct.state;
                            break;
                        case 'stop':
                            pass = ct.state;
                            break;
                        case 'pause':
                            pass = ct.state && !ct.pause;
                            break;
                        case 'resume':
                            pass = ct.state && ct.pause;
                            break;
                        case 'restart':
                            pass = true;
                            break;
                        default:
                            pass = false;
                            debugWarn(`[FV3_DEBUG] actionFolder (id: ${id}): Unknown action '${action}'.`);
                            break;
                    }
                    debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Container ${containerName} - action '${action}', pass condition: ${pass}.`);
                    if (pass) {
                        debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Pushing POST request for container ${cid}, action ${action}.`);
                        proms.push(jq.post(eventUrl, { action, container: cid }, null, 'json').promise());
                    }
                }

                if (proms.length === 0) {
                    debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): No matching containers for action '${action}' in selected scope.`);
                    return;
                }

                debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Awaiting ${proms.length} promises.`);
                const results = await Promise.all(proms);
                debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Promises resolved. Results:`, results);

                const errors = results.filter((entry) => entry?.success !== true);
                debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Filtered errors:`, errors);
                if (errors.length > 0) {
                    const errorMessages = errors.map((entry) => entry?.text || JSON.stringify(entry));
                    debugError(`[FV3_DEBUG] actionFolder (id: ${id}): Execution errors occurred:`, errorMessages);
                    swalFn({
                        title: i18nLabel('exec-error', 'Execution error'),
                        text: errorMessages.join('<br>'),
                        type: 'error',
                        html: true,
                        confirmButtonText: 'Ok'
                    }, () => refreshDockerRuntimeState({ followupDelayMs: 650 }));
                } else {
                    debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): No errors. Refreshing runtime state in place.`);
                    await Promise.resolve(refreshDockerRuntimeState({ followupDelayMs: 650 }));
                }
            } catch (error) {
                if (consoleRef && typeof consoleRef.error === 'function') {
                    consoleRef.error('folderview.plus: actionFolder failed', error);
                }
                swalFn({
                    title: i18nLabel('exec-error', 'Execution error'),
                    text: escapeHtml(String(error?.message || 'Unknown folder action error.')),
                    type: 'error',
                    html: true,
                    confirmButtonText: 'Ok'
                });
            } finally {
                spinner?.hide('slow');
                debugLog(`[FV3_DEBUG] actionFolder (id: ${id}): Exit.`);
            }
        };

        return Object.freeze({
            summarizeFolderActionCounts,
            rmFolder,
            getLockedDockerBranchFolderIds,
            ensureDockerBranchUnlocked,
            deleteDockerFolderBranch,
            rmFolderBranch,
            clearFolderEditorPrefill,
            recordFolderEditorLaunchDebug,
            seedFolderEditorPrefill,
            buildDockerFolderEditorUrl,
            editFolder,
            createChildFolder,
            forceUpdateFolder,
            updateFolder,
            collectFolderWebuiTargets,
            showFolderWebuiPopupWarning,
            openFolderWebuisFromMenu,
            copyDockerFolderSettingsFromMenu,
            pasteDockerFolderSettingsFromMenu,
            cloneDockerFolderFromMenu,
            buildDockerFolderClonePayload,
            generateDockerFolderCloneId,
            getDockerFolderBranchCloneOrder,
            persistDockerFolderClonePayload,
            rollbackClonedDockerFolders,
            cloneDockerFolderBranchFromMenu,
            actionFolder
        });
    };

    return Object.freeze({
        createApi
    });
}));
