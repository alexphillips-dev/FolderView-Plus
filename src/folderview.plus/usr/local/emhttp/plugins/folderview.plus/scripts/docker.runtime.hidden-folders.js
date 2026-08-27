(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.dockerHiddenFolders = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const QUICK_LABELS = Object.freeze(['hide folder', 'restore folder', 'restore hidden branch']);
    const QUICK_ICON_CLASSES = Object.freeze(['fa-eye', 'fa-eye-slash']);
    const createApi = (deps = {}) => {
        const win = deps.window || (typeof window !== 'undefined' ? window : null);
        const doc = deps.document || win?.document || null;
        const $ = deps.$;
        const getFolders = typeof deps.getFolders === 'function' ? deps.getFolders : (() => ({}));
        const getPrefs = typeof deps.getPrefs === 'function' ? deps.getPrefs : (() => ({}));
        const setPrefs = typeof deps.setPrefs === 'function' ? deps.setPrefs : (() => {});
        const normalizePrefs = typeof deps.normalizePrefs === 'function' ? deps.normalizePrefs : ((value) => value || {});
        const normalizeParentId = typeof deps.normalizeParentId === 'function' ? deps.normalizeParentId : ((value) => String(value || '').trim());
        const readFolderIdFromRow = typeof deps.readFolderIdFromRow === 'function' ? deps.readFolderIdFromRow : (() => '');
        const readFolderOwnerFromRow = typeof deps.readFolderOwnerFromRow === 'function' ? deps.readFolderOwnerFromRow : (() => '');
        const runtimeStateStore = deps.runtimeStateStore || { set: () => {} };
        const safeActionRunner = deps.safeActionRunner || { run: async (_key, action) => ({ ok: true, value: await action({ isLatest: () => true }) }) };
        const runGuardedAction = typeof deps.runGuardedAction === 'function'
            ? deps.runGuardedAction
            : (async (_name, action) => {
                try { return { ok: true, value: await action() }; } catch (error) { return { ok: false, error }; }
            });
        const savePrefs = typeof deps.savePrefs === 'function' ? deps.savePrefs : (async (_patch, current) => current || {});
        const fetchPrefs = typeof deps.fetchPrefs === 'function' ? deps.fetchPrefs : (async () => getPrefs());
        const syncDependentUi = typeof deps.syncDependentUi === 'function' ? deps.syncDependentUi : (() => {});
        const getFocusedFolderId = typeof deps.getFocusedFolderId === 'function' ? deps.getFocusedFolderId : (() => '');
        const clearFocusedFolder = typeof deps.clearFocusedFolder === 'function' ? deps.clearFocusedFolder : (() => {});
        const offerUndo = typeof deps.offerUndo === 'function' ? deps.offerUndo : (() => {});
        const translate = typeof deps.translate === 'function' ? deps.translate : ((_key, fallback) => fallback || '');
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value || ''));
        const svgIcon = typeof deps.svgIcon === 'function' ? deps.svgIcon : (() => '');
        let revealHiddenFolders = false;
        let pendingIdsOverride = null;

        const normalizeIds = (value) => Array.isArray(value)
            ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
            : [];
        const getExplicitIds = () => normalizeIds(getPrefs()?.hiddenFolderIds);
        const reconcilePrefs = (prefs = {}) => {
            const normalized = normalizePrefs(prefs || {});
            if (!pendingIdsOverride || Date.now() > pendingIdsOverride.expiresAt) {
                pendingIdsOverride = null;
                return normalized;
            }
            return normalizePrefs({ ...normalized, hiddenFolderIds: pendingIdsOverride.ids });
        };
        const getOwnerId = (folderId) => {
            const id = String(folderId || '').trim();
            if (!id) return '';
            const explicitHidden = new Set(getExplicitIds());
            const folders = getFolders();
            let cursor = id;
            const visited = new Set();
            while (cursor && !visited.has(cursor)) {
                if (explicitHidden.has(cursor)) return cursor;
                visited.add(cursor);
                const folder = folders?.[cursor] || {};
                cursor = normalizeParentId(folder?.parentId || folder?.parent_id || '');
            }
            return '';
        };
        const getEffectiveIds = () => {
            const hidden = new Set();
            for (const id of Object.keys(getFolders() || {})) {
                if (getOwnerId(id)) hidden.add(id);
            }
            return hidden;
        };
        const getSummary = () => {
            const folders = getFolders() || {};
            const explicitIds = getExplicitIds().filter((id) => !!folders[id]);
            const effectiveIds = Array.from(getEffectiveIds());
            return {
                explicitIds,
                effectiveIds,
                explicitCount: explicitIds.length,
                effectiveCount: effectiveIds.length,
                totalFolderCount: Object.keys(folders).length,
                revealHiddenFolders
            };
        };
        const syncIndicator = ($row, hidden) => {
            if (!$row?.length || !$row.hasClass('folder')) return;
            const $existing = $row.find('.fv-folder-hidden-indicator').first();
            if (!hidden || !revealHiddenFolders) {
                $existing.remove();
                return;
            }
            if ($existing.length) return;
            const label = translate('docker.folder.hidden-indicator', 'Hidden');
            const icon = svgIcon('eye-off', { className: 'fv-folder-hidden-indicator-icon' })
                || '<i class="fa fa-eye-slash" aria-hidden="true"></i>';
            const $indicator = $(`<span class="fv-folder-hidden-indicator" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon}<span>${escapeHtml(label)}</span></span>`);
            const $name = $row.find('.folder-appname').first();
            if ($name.length) $name.after($indicator);
        };
        const applyVisibility = () => {
            const effectiveHidden = getEffectiveIds();
            const summary = getSummary();
            $('body').toggleClass('fvplus-docker-reveal-hidden', revealHiddenFolders);
            doc?.body?.setAttribute?.('data-fvplus-docker-hidden-explicit', String(summary.explicitCount));
            doc?.body?.setAttribute?.('data-fvplus-docker-hidden-effective', String(effectiveHidden.size));
            doc?.body?.setAttribute?.('data-fvplus-docker-hidden-reveal', revealHiddenFolders ? 'true' : 'false');
            $('#docker_list > tr').each((_, row) => {
                if (!row) return;
                const folderId = readFolderIdFromRow(row);
                const ownerId = folderId || readFolderOwnerFromRow(row);
                const hidden = !!ownerId && effectiveHidden.has(ownerId);
                const $row = $(row);
                $row.toggleClass('fv-folder-user-hidden', hidden);
                $row.toggleClass('fv-folder-hidden-revealed', hidden && revealHiddenFolders);
                if (folderId) syncIndicator($row, hidden);
            });
            runtimeStateStore.set({ hiddenFolderIds: getExplicitIds(), revealHiddenFolders });
            return summary;
        };
        const applyIds = (nextHiddenIds) => {
            const hiddenFolderIds = normalizeIds(nextHiddenIds);
            setPrefs(normalizePrefs({ ...(getPrefs() || {}), hiddenFolderIds }));
            runtimeStateStore.set({ hiddenFolderIds });
        };
        const syncUi = () => {
            applyVisibility();
            syncDependentUi();
        };
        const persistIds = async (nextHiddenIds) => {
            const folders = getFolders() || {};
            const hiddenFolderIds = normalizeIds(nextHiddenIds).filter((id) => !!folders[id]);
            const savedPrefs = await savePrefs({ hiddenFolderIds }, getPrefs() || {});
            return normalizeIds(savedPrefs?.hiddenFolderIds || hiddenFolderIds).filter((id) => !!folders[id]);
        };
        const recoverLatestFailure = async (fallbackIds) => {
            try {
                applyIds((await fetchPrefs())?.hiddenFolderIds);
            } catch (_error) {
                applyIds(fallbackIds);
            }
            syncUi();
        };
        const updateFolder = async (folderId, requestedHidden, options = {}) => {
            const id = String(folderId || '').trim();
            const folders = getFolders() || {};
            if (!id || !folders[id]) return false;
            const previousIds = getExplicitIds();
            const hidden = requestedHidden === true;
            const nextIds = hidden
                ? (previousIds.includes(id) ? previousIds : [...previousIds, id])
                : previousIds.filter((entry) => entry !== id);
            return safeActionRunner.run('docker-hidden-folders', async (intent) => {
                const result = await runGuardedAction('toggle-folder-visibility', async () => {
                    const confirmedIds = await persistIds(nextIds);
                    if (!intent.isLatest()) return;
                    pendingIdsOverride = null;
                    applyIds(confirmedIds);
                    syncUi();
                    if (hidden && options.offerUndo !== false) {
                        offerUndo({ folderId: id, folderName: String(folders[id]?.name || translate('docker.folder.unnamed', 'Folder')) });
                    }
                }, {
                    userMessage: translate('docker.folder.visibility-failed', 'The folder visibility preference could not be saved.'),
                    userVisible: true
                });
                if (!result.ok && intent.isLatest()) {
                    pendingIdsOverride = null;
                    await recoverLatestFailure(previousIds);
                }
                return result.ok;
            }, {
                queueIfBusy: true,
                onIntent: () => {
                    pendingIdsOverride = { ids: normalizeIds(nextIds), expiresAt: Date.now() + 10000 };
                    applyIds(nextIds);
                    if (hidden && getOwnerId(getFocusedFolderId())) clearFocusedFolder();
                    syncUi();
                }
            });
        };
        const hideFolder = (folderId) => updateFolder(folderId, true);
        const restoreFolder = (folderId) => updateFolder(folderId, false, { offerUndo: false });
        const restoreAll = async () => {
            const previousIds = getExplicitIds();
            if (!previousIds.length) return true;
            return safeActionRunner.run('docker-hidden-folders', async (intent) => {
                const result = await runGuardedAction('restore-hidden-folders', async () => {
                    const confirmedIds = await persistIds([]);
                    if (!intent.isLatest()) return;
                    pendingIdsOverride = null;
                    applyIds(confirmedIds);
                    revealHiddenFolders = false;
                    syncUi();
                }, {
                    userMessage: translate('docker.folder.visibility-failed', 'The folder visibility preference could not be saved.'),
                    userVisible: true
                });
                if (!result.ok && intent.isLatest()) {
                    pendingIdsOverride = null;
                    await recoverLatestFailure(previousIds);
                }
                return result.ok;
            }, {
                queueIfBusy: true,
                onIntent: () => { pendingIdsOverride = { ids: [], expiresAt: Date.now() + 10000 }; applyIds([]); syncUi(); }
            });
        };
        const setReveal = (enabled) => {
            revealHiddenFolders = enabled === true && getExplicitIds().length > 0;
            applyVisibility();
            return revealHiddenFolders;
        };
        const buildQuickAction = (folderId) => {
            const id = String(folderId || '').trim();
            const hiddenOwnerId = getOwnerId(id);
            const hiddenByAncestor = !!hiddenOwnerId && hiddenOwnerId !== id;
            return {
                text: hiddenOwnerId
                    ? translate(hiddenByAncestor ? 'docker.folder.restore-hidden-branch' : 'docker.folder.restore', hiddenByAncestor ? 'Restore hidden branch' : 'Restore folder')
                    : translate('docker.folder.hide', 'Hide folder'),
                icon: hiddenOwnerId ? 'fa-eye' : 'fa-eye-slash',
                action: (event) => {
                    event?.preventDefault?.();
                    void (hiddenOwnerId ? restoreFolder(hiddenOwnerId) : hideFolder(id));
                }
            };
        };
        const decorateQuickIcon = (selectors, attempt = 0) => {
            if (!$ || typeof svgIcon !== 'function') return false;
            let decorated = false;
            for (const selector of selectors || []) {
                $(`${selector}:visible`).each((_, menu) => {
                    $(menu).children('li.fvplus-docker-quick-item').each((__, item) => {
                        const $item = $(item);
                        const $icon = $item.find('i.fa-eye, i.fa-eye-slash').first();
                        if (!$icon.length || $item.find('svg[data-fv-icon="eye"], svg[data-fv-icon="eye-off"]').length) return;
                        $icon.replaceWith(svgIcon($icon.hasClass('fa-eye-slash') ? 'eye-off' : 'eye', { className: 'fvplus-docker-quick-svg' }));
                        decorated = true;
                    });
                });
            }
            if (!decorated && attempt < 8) win?.setTimeout?.(() => decorateQuickIcon(selectors, attempt + 1), 18 * (attempt + 1));
            return decorated;
        };

        return Object.freeze({ normalizeIds, reconcilePrefs, getOwnerId, getSummary, applyVisibility, hideFolder, restoreFolder, restoreAll, setReveal, buildQuickAction, decorateQuickIcon, svgIcon });
    };

    return Object.freeze({ createApi, QUICK_LABELS, QUICK_ICON_CLASSES });
}));
