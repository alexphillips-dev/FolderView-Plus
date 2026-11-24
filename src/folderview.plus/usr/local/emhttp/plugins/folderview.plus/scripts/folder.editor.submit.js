// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderEditorSubmit = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const recordSubmitDiagnostics = (win, storageKey, details) => {
        try {
            const lastSubmit = { checkedAt: new Date().toISOString(), ok: details.ok === true,
                unchanged: details.unchanged === true, ...(details.syncFailed === true ? { syncFailed: true } : {}) };
            for (const key of ['preparationMs', 'requestMs', 'syncMs', 'durationMs', 'bootstrapMs', 'guardMs', 'saveMs']) {
                if (typeof details[key] === 'number' && Number.isFinite(details[key])) {
                    lastSubmit[key] = Math.max(0, Math.min(600000, Math.round(details[key])));
                }
            }
            const previous = JSON.parse(win.localStorage.getItem(storageKey) || '{}');
            win.localStorage.setItem(storageKey, JSON.stringify({
                ...(previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}),
                lastSubmit
            }));
        } catch (_error) {
            // Saving must remain available when browser diagnostics storage is blocked.
        }
    };

    const createSubmitHandler = (deps) => {
        const win = deps.window;
        const { validateForm, buildFolderPayloadFromForm, normalizeFolderRecordForEditor,
            generateCopyName, setFieldError, surfaceT, computeFormSnapshot, securePost,
            flushPostSaveTypeSync, extractAjaxErrorMessage } = deps;
        const recordDiagnostics = deps.recordDiagnostics
            || (details => recordSubmitDiagnostics(win, deps.storageKey, details));
        let submission = 'idle';
        const leave = (destination = win.location.pathname.split('/').slice(0, -1).join('/')) => {
            deps.setSuppressUnloadPrompt(true);
            win.location.href = destination;
        };
        const syncSavedFolder = async (options) => {
            for (;;) {
                try {
                    await flushPostSaveTypeSync(options);
                    return true;
                } catch (error) {
                    const title = surfaceT('common.repair.docker-start-order-sync-failed-5c0ab5', 'Docker start order sync failed');
                    const message = extractAjaxErrorMessage(error, title);
                    if (typeof win.swal !== 'function') {
                        win.alert(`${title}: ${win.FolderViewPlusI18n?.message?.(message) || message}`);
                        return false;
                    }
                    const retry = await new Promise((resolve) => win.swal({
                        title, text: message, type: 'warning', showCancelButton: true,
                        confirmButtonText: surfaceT('diagnostics.actions.retry', 'Retry'),
                        cancelButtonText: surfaceT('common.close', 'Close')
                    }, resolve));
                    if (!retry) return false;
                }
            }
        };
        return async (e, saveAsCopy = false) => {
            const startedAt = Date.now();
            if (submission !== 'idle') return false;
            const { activeFolderEditorFolderId, folderId, allFoldersById, editingFolderDefaults,
                initialSnapshot, folderEditorExpectedFolderRevision, missingEditTarget, type } = deps.getState();
            const currentFolderId = String(activeFolderEditorFolderId || '').trim();
            if (!editingFolderDefaults && folderEditorExpectedFolderRevision === null) return false;
            if (missingEditTarget || (folderId && !currentFolderId)) {
                setFieldError('name', surfaceT('common.server.folder-not-found-ccbf07', 'Folder not found.'));
                return false;
            }
            if (!validateForm()) return false;
            const folder = buildFolderPayloadFromForm(e);
            const previousFolder = !saveAsCopy && currentFolderId && allFoldersById[currentFolderId]
                ? normalizeFolderRecordForEditor(allFoldersById[currentFolderId]) : null;
            if (saveAsCopy) folder.name = generateCopyName(folder.name, folder.parentId);
            if (!folder.name && !editingFolderDefaults) {
                setFieldError('name', surfaceT('common.runtime.folder-name-is-required', 'Folder name is required.'));
                return false;
            }
            const timings = { preparationMs: Date.now() - startedAt, requestMs: 0, syncMs: 0 };
            // Untouched editors need no persistence, including default-expanded legacy records.
            if (!editingFolderDefaults && !saveAsCopy && currentFolderId && previousFolder
                && initialSnapshot && computeFormSnapshot() === initialSnapshot) {
                recordDiagnostics({ ...timings, unchanged: true, ok: true, durationMs: Date.now() - startedAt });
                leave();
                return false;
            }
            submission = 'saving';
            const requestStartedAt = Date.now();
            try {
                try {
                    if (editingFolderDefaults) {
                        await deps.saveDefaults(folder);
                    } else if (currentFolderId && !saveAsCopy) {
                        const saveResponse = await securePost('/plugins/folderview.plus/server/update.php', {
                            type, content: JSON.stringify(folder), id: currentFolderId,
                            expectedRevision: folderEditorExpectedFolderRevision
                        });
                        const savedRevision = Number.parseInt(String(saveResponse?.metadata?.folderRevision ?? ''), 10);
                        if (Number.isFinite(savedRevision) && savedRevision >= 0) deps.setExpectedRevision(savedRevision);
                        for (const key of ['bootstrapMs', 'guardMs', 'saveMs']) {
                            const value = saveResponse?.timings?.[key];
                            if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
                                timings[key] = Math.min(600000, Math.round(value));
                            }
                        }
                    } else {
                        await securePost('/plugins/folderview.plus/server/create.php', { type, content: JSON.stringify(folder) });
                        submission = 'created';
                    }
                } catch (error) {
                    timings.requestMs = Date.now() - requestStartedAt;
                    recordDiagnostics({ ...timings, unchanged: false, ok: false, durationMs: Date.now() - startedAt });
                    const message = extractAjaxErrorMessage(error, 'folder save');
                    if (typeof win.swal === 'function') win.swal({ title: 'Save failed', text: message, type: 'error' });
                    else win.alert(win.FolderViewPlusI18n?.message?.(message) || message);
                    return false;
                }
                timings.requestMs = Date.now() - requestStartedAt;
                let syncFailed = false;
                if (!editingFolderDefaults) {
                    const syncStartedAt = Date.now();
                    syncFailed = !await syncSavedFolder({ force: saveAsCopy || !currentFolderId,
                        folder, folderId: currentFolderId, previousFolder });
                    timings.syncMs = Date.now() - syncStartedAt;
                }
                recordDiagnostics({ ...timings, unchanged: false, ok: true, syncFailed, durationMs: Date.now() - startedAt });
                leave(editingFolderDefaults ? '/Settings/FolderViewPlus' : undefined);
                return false;
            } finally {
                if (submission === 'saving') submission = 'idle';
            }
        };
    };
    return Object.freeze({ createSubmitHandler, recordSubmitDiagnostics });
}));
