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
            const lastSubmit = { checkedAt: new Date().toISOString(), ok: details.ok === true, unchanged: details.unchanged === true };
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
        const leave = (destination = win.location.pathname.split('/').slice(0, -1).join('/')) => {
            deps.setSuppressUnloadPrompt(true);
            win.location.href = destination;
        };
        return async (e, saveAsCopy = false) => {
            const startedAt = Date.now();
            if (!validateForm()) return false;
            const { activeFolderEditorFolderId, folderId, allFoldersById, editingFolderDefaults,
                initialSnapshot, folderEditorExpectedFolderRevision, type } = deps.getState();
            const folder = buildFolderPayloadFromForm(e);
            const currentFolderId = String(activeFolderEditorFolderId || folderId || '').trim();
            const previousFolder = !saveAsCopy && currentFolderId && allFoldersById[currentFolderId]
                ? normalizeFolderRecordForEditor(allFoldersById[currentFolderId]) : null;
            if (saveAsCopy) folder.name = generateCopyName(folder.name, folder.parentId);
            if (!folder.name && !editingFolderDefaults) {
                setFieldError('name', surfaceT('common.runtime.folder-name-is-required', 'Folder name is required.'));
                return false;
            }
            const timings = { preparationMs: Date.now() - startedAt, requestMs: 0, syncMs: 0 };
            // Untouched editors need no persistence, including default-expanded legacy records.
            if (!editingFolderDefaults && !saveAsCopy && folderId && previousFolder
                && initialSnapshot && computeFormSnapshot() === initialSnapshot) {
                recordDiagnostics({ ...timings, unchanged: true, ok: true, durationMs: Date.now() - startedAt });
                leave();
                return false;
            }
            let phaseStartedAt = Date.now();
            let phase = 'request';
            try {
                if (editingFolderDefaults) {
                    await deps.saveDefaults(folder);
                    timings.requestMs = Date.now() - phaseStartedAt;
                    recordDiagnostics({ ...timings, unchanged: false, ok: true, durationMs: Date.now() - startedAt });
                    leave('/Settings/FolderViewPlus');
                    return false;
                } else if (folderId && !saveAsCopy) {
                    const saveResponse = await securePost('/plugins/folderview.plus/server/update.php', {
                        type, content: JSON.stringify(folder), id: folderId,
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
                }
                timings.requestMs = Date.now() - phaseStartedAt;
                phase = 'sync';
                phaseStartedAt = Date.now();
                await flushPostSaveTypeSync({ force: saveAsCopy || !currentFolderId,
                    folder, folderId: currentFolderId, previousFolder });
                timings.syncMs = Date.now() - phaseStartedAt;
                recordDiagnostics({ ...timings, unchanged: false, ok: true, durationMs: Date.now() - startedAt });
            } catch (error) {
                timings[phase === 'sync' ? 'syncMs' : 'requestMs'] = Date.now() - phaseStartedAt;
                recordDiagnostics({ ...timings, unchanged: false, ok: false, durationMs: Date.now() - startedAt });
                const message = extractAjaxErrorMessage(error, 'folder save');
                if (typeof win.swal === 'function') win.swal({ title: 'Save failed', text: message, type: 'error' });
                else win.alert(win.FolderViewPlusI18n?.message?.(message) || message);
                return false;
            }
            leave();
            return false;
        };
    };
    return Object.freeze({ createSubmitHandler, recordSubmitDiagnostics });
}));
