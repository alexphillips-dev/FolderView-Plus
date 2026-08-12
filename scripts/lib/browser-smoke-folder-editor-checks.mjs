export const createFolderEditorSmokeChecks = ({
    timeoutMs, sanitizeToken, scenarioLabel, resolveFolderEditorUrl, requireFolderEditorCoverage
}) => {
const waitForSettingsShell = async (page) => {
    await page.locator('#fv-settings-topbar').waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator('#fv-settings-search').waitFor({ state: 'visible', timeout: timeoutMs });
};

const waitForFolderEditorReady = async (page, { type, expectedMode }) => {
    await page.waitForFunction(({ expectedType, expectedMode: mode }) => {
        const pageType = String(window.FolderViewPlusFolderEditorPageType || '').trim().toLowerCase();
        const pageMode = String(window.FolderViewPlusFolderEditorPageMode || '').trim().toLowerCase();
        const resolvedMode = String(window.FolderViewPlusFolderEditorResolvedMode || '').trim().toLowerCase();
        const stage = String(window.FolderViewPlusFolderEditorRuntimeBootStage || '').trim().toLowerCase();
        const form = document.querySelector('div.canvas > form.folder-editor-form');
        if (pageType !== expectedType || pageMode !== mode || resolvedMode !== mode || !form) {
            return false;
        }
        if (mode !== 'modern') {
            return true;
        }
        return window.FolderViewPlusFolderEditorRuntimeLoaded === true
            && document.querySelector('#fvEditorChrome')
            && stage === 'runtime-ready';
    }, { expectedType: type, expectedMode }, { timeout: timeoutMs });

    return page.evaluate(() => ({
        pageType: String(window.FolderViewPlusFolderEditorPageType || '').trim().toLowerCase(),
        pageMode: String(window.FolderViewPlusFolderEditorPageMode || '').trim().toLowerCase(),
        resolvedMode: String(window.FolderViewPlusFolderEditorResolvedMode || '').trim().toLowerCase(),
        source: String(window.FolderViewPlusFolderEditorModeSource || '').trim().toLowerCase(),
        stage: String(window.FolderViewPlusFolderEditorRuntimeBootStage || '').trim().toLowerCase(),
        runtimeLoaded: window.FolderViewPlusFolderEditorRuntimeLoaded === true
    }));
};

const setFolderEditorFieldValue = async (page, fieldName, {
    value = '',
    checked = undefined
} = {}) => {
    await page.evaluate(({ fieldName: targetFieldName, value: nextValue, checked: nextChecked }) => {
        const form = document.querySelector('div.canvas > form.folder-editor-form');
        const field = form?.elements?.[targetFieldName] || form?.querySelector(`[name="${targetFieldName}"]`);
        if (!(field instanceof HTMLElement)) {
            throw new Error(`Missing folder editor field: ${targetFieldName}`);
        }
        if (field instanceof HTMLInputElement && field.type === 'checkbox') {
            field.checked = nextChecked === undefined ? Boolean(nextValue) : Boolean(nextChecked);
        } else {
            field.value = nextValue;
        }
        if (window.jQuery) {
            window.jQuery(field).trigger('input');
            window.jQuery(field).trigger('change');
        } else {
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, { fieldName, value, checked });
};

const readFoldersFromSettingsPage = async (page, type) => page.evaluate(async (expectedType) => {
    const request = window.FolderViewPlusRequest;
    if (!request || typeof request.getJson !== 'function') {
        throw new Error('FolderViewPlusRequest.getJson is unavailable on the settings page.');
    }
    const response = await request.getJson(`/plugins/folderview.plus/server/read.php?type=${encodeURIComponent(expectedType)}&nocache=1&_=${Date.now()}`);
    return response && typeof response === 'object' ? response : {};
}, type);

const deleteFolderFromSettingsPage = async (page, { type, id }) => {
    await page.evaluate(async ({ expectedType, folderId }) => {
        const request = window.FolderViewPlusRequest;
        if (!request || typeof request.postJson !== 'function') {
            throw new Error('FolderViewPlusRequest.postJson is unavailable on the settings page.');
        }
        await request.postJson('/plugins/folderview.plus/server/delete.php', {
            type: expectedType,
            id: folderId
        });
    }, { expectedType: type, folderId: id });
};

const findFolderEntriesByName = (folders, folderName) => Object.entries(folders || {})
    .filter(([, folder]) => String(folder?.name || '').trim() === folderName)
    .map(([id, folder]) => ({ id, folder }));

const cleanupSmokeFolder = async (page, { settingsUrl, type, folderName }) => {
    await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSettingsShell(page);
    const foldersBefore = await readFoldersFromSettingsPage(page, type);
    const matches = findFolderEntriesByName(foldersBefore, folderName);
    if (matches.length === 0) {
        return {
            deletedIds: [],
            remainingIds: []
        };
    }
    for (const entry of matches) {
        await deleteFolderFromSettingsPage(page, {
            type,
            id: entry.id
        });
    }
    const foldersAfter = await readFoldersFromSettingsPage(page, type);
    const remainingMatches = findFolderEntriesByName(foldersAfter, folderName);
    if (remainingMatches.length > 0) {
        throw new Error(`Smoke cleanup failed for ${folderName}; remaining ids: ${remainingMatches.map((entry) => entry.id).join(', ')}`);
    }
    return {
        deletedIds: matches.map((entry) => entry.id),
        remainingIds: []
    };
};

const openFolderEditorSection = async (page, sectionKey, mode = null) => {
    if (mode) {
        await page.locator(`.fv-editor-mode > button[data-mode="${mode}"]`).first().click({ timeout: timeoutMs });
    }
    await page.locator(`.fv-section-nav > button[data-target="${sectionKey}"]`).first().click({ timeout: timeoutMs });
    await page.waitForFunction((targetSectionKey) => {
        const shell = document.querySelector(`.fv-section-shell[data-section-shell="${targetSectionKey}"]`);
        return shell instanceof HTMLElement && window.getComputedStyle(shell).display !== 'none';
    }, sectionKey, { timeout: timeoutMs });
};

const runFolderEditorInteractionSmoke = async (page, {
    browserName,
    settingsUrl,
    type
}) => {
    const folderName = `Smoke ${type} ${browserName} ${Date.now()}`;
    const removedActionName = `Smoke action removed ${Date.now()}`;
    const savedActionName = `Smoke action saved ${Date.now()}`;
    const screenshotName = `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-${sanitizeToken(type)}-folder-editor.png`;
    const screenshotPath = captureLiveArtifacts ? path.join(artifactRoot, screenshotName) : '';
    let cleanupDetails;
    let reorderSkippedReason = '';
    let selectedMembers = [];
    let previewOrder = [];

    const addCustomAction = async (actionName) => {
        const launchLink = page.locator('.fv-section-shell[data-section-shell="actions"] .fv-custom-action-link, .fv-section-shell[data-section-shell="actions"] a.custom-action').first();
        if (await launchLink.count() === 0) {
            throw new Error('Custom action launch link is missing from the Actions section.');
        }
        await launchLink.click({ timeout: timeoutMs });
        await page.locator('.dialogCustomAction [name="action_name"]').waitFor({ state: 'visible', timeout: timeoutMs });
        await page.locator('.dialogCustomAction [name="action_name"]').fill(actionName, { timeout: timeoutMs });
        await page.locator('.ui-dialog-buttonpane button').first().click({ timeout: timeoutMs });
        await page.waitForFunction((expectedActionName) => {
            const labels = Array.from(document.querySelectorAll('.custom-action-wrapper > div > span'))
                .map((entry) => String(entry.textContent || '').trim())
                .filter(Boolean);
            return labels.some((label) => label.includes(expectedActionName));
        }, actionName, { timeout: timeoutMs });
    };

    const removeFirstCustomAction = async () => {
        const removed = await page.evaluate(() => {
            const actionRow = document.querySelector('.custom-action-wrapper > div');
            if (!(actionRow instanceof HTMLElement)) {
                return false;
            }
            const buttons = actionRow.querySelectorAll('button');
            if (buttons.length < 2) {
                return false;
            }
            buttons[1].click();
            return true;
        });
        if (!removed) {
            throw new Error('Unable to locate the custom action remove button.');
        }
        await page.waitForFunction(() => document.querySelectorAll('input[name="custom_action[]"]').length === 0, undefined, { timeout: timeoutMs });
    };

    try {
        await openFolderEditorSection(page, 'preview', 'basic');

        const initialPreviewState = await page.evaluate(() => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return {
                previewRows: String(form?.elements?.preview_rows?.value || ''),
                previewBorder: Boolean(form?.elements?.preview_border?.checked)
            };
        });

        await setFolderEditorFieldValue(page, 'name', { value: folderName });
        await setFolderEditorFieldValue(page, 'preview', { value: '1' });
        await setFolderEditorFieldValue(page, 'preview_rows', { value: '4' });
        await setFolderEditorFieldValue(page, 'preview_border', { checked: false });
        await page.waitForFunction(() => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return String(form?.elements?.preview_rows?.value || '') === '4'
                && Boolean(form?.elements?.preview_border?.checked) === false;
        }, undefined, { timeout: timeoutMs });

        await page.locator('button[data-section-action="revert"][data-section="preview"]').first().click({ timeout: timeoutMs });
        await page.waitForFunction((snapshot) => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return String(form?.elements?.preview_rows?.value || '') === snapshot.previewRows
                && Boolean(form?.elements?.preview_border?.checked) === snapshot.previewBorder;
        }, initialPreviewState, { timeout: timeoutMs });

        await setFolderEditorFieldValue(page, 'preview', { value: '1' });
        await setFolderEditorFieldValue(page, 'preview_rows', { value: '4' });
        await setFolderEditorFieldValue(page, 'preview_border', { checked: false });
        await page.locator('button[data-section-action="defaults"][data-section="preview"]').first().click({ timeout: timeoutMs });
        await page.waitForFunction(() => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return String(form?.elements?.preview_rows?.value || '') !== '4'
                && Boolean(form?.elements?.preview_border?.checked) === true;
        }, undefined, { timeout: timeoutMs });
        await setFolderEditorFieldValue(page, 'preview', { value: '1' });

        await openFolderEditorSection(page, 'members', 'basic');
        const memberSelection = await page.evaluate(() => {
            const $ = window.jQuery || null;
            const rows = Array.from(document.querySelectorAll('table.sortable > tbody > tr'));
            const unlockedRows = rows.filter((row) => {
                const input = row.querySelector('input.container-switch');
                return input instanceof HTMLInputElement && input.disabled !== true;
            });
            const chosenRows = unlockedRows.slice(0, 2);
            chosenRows.forEach((row) => {
                const input = row.querySelector('input.container-switch');
                if (!(input instanceof HTMLInputElement)) {
                    return;
                }
                input.checked = true;
                if ($) {
                    $(input).trigger('change');
                } else {
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            return {
                availableCount: unlockedRows.length,
                selectedNames: chosenRows.map((row) => {
                    const input = row.querySelector('input.container-switch');
                    return input instanceof HTMLInputElement ? String(input.value || '').trim() : '';
                }).filter(Boolean)
            };
        });
        selectedMembers = memberSelection.selectedNames;

        if (memberSelection.selectedNames.length >= 2) {
            await page.waitForFunction((expectedNames) => {
                const previewNames = Array.from(document.querySelectorAll('#fvLivePreviewCanvas .fv-live-member-name'))
                    .map((entry) => String(entry.textContent || '').trim())
                    .filter(Boolean)
                    .slice(0, expectedNames.length);
                return previewNames.length === expectedNames.length
                    && previewNames.every((entry, index) => entry === expectedNames[index]);
            }, memberSelection.selectedNames, { timeout: timeoutMs });

            const reorderClicked = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table.sortable > tbody > tr'));
                const selectedRows = rows.filter((row) => {
                    const input = row.querySelector('input.container-switch');
                    return input instanceof HTMLInputElement && input.checked === true && input.disabled !== true;
                });
                const secondRow = selectedRows[1];
                const moveButton = secondRow?.querySelector('.member-move[data-direction="up"]');
                if (!(moveButton instanceof HTMLElement)) {
                    return false;
                }
                moveButton.click();
                return true;
            });
            if (!reorderClicked) {
                throw new Error('Unable to trigger member reordering for the modern editor smoke.');
            }
            const expectedPreviewOrder = [memberSelection.selectedNames[1], memberSelection.selectedNames[0]];
            await page.waitForFunction((expectedNames) => {
                const previewNames = Array.from(document.querySelectorAll('#fvLivePreviewCanvas .fv-live-member-name'))
                    .map((entry) => String(entry.textContent || '').trim())
                    .filter(Boolean)
                    .slice(0, expectedNames.length);
                return previewNames.length === expectedNames.length
                    && previewNames.every((entry, index) => entry === expectedNames[index]);
            }, expectedPreviewOrder, { timeout: timeoutMs });
            previewOrder = expectedPreviewOrder;
        } else {
            reorderSkippedReason = memberSelection.availableCount === 0
                ? 'No available members were exposed by the editor.'
                : 'Only one member was available, so reorder coverage could not run.';
            previewOrder = memberSelection.selectedNames;
        }

        await openFolderEditorSection(page, 'actions', 'advanced');
        await addCustomAction(removedActionName);
        await removeFirstCustomAction();
        await addCustomAction(savedActionName);

        if (screenshotPath) {
            await page.screenshot({ path: screenshotPath, fullPage: true });
        }

        await page.waitForFunction(() => {
            const submit = document.querySelector('.folder-btn-submit');
            return submit instanceof HTMLInputElement && submit.disabled !== true;
        }, undefined, { timeout: timeoutMs });

        const runtimeUrlPattern = type === 'vm' ? /\/VMs(?:[/?#]|$)/i : /\/Docker(?:[/?#]|$)/i;
        await Promise.all([
            page.waitForURL((url) => runtimeUrlPattern.test(url.toString()), { timeout: timeoutMs }),
            page.locator('.folder-btn-submit').first().click({ timeout: timeoutMs })
        ]);

        await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await waitForSettingsShell(page);
        const savedFolders = await readFoldersFromSettingsPage(page, type);
        const savedFolderEntry = findFolderEntriesByName(savedFolders, folderName)[0] || null;
        if (!savedFolderEntry) {
            throw new Error(`Saved smoke folder was not found after create: ${folderName}`);
        }
        const savedFolder = savedFolderEntry.folder || {};
        const savedActions = Array.isArray(savedFolder.actions) ? savedFolder.actions : [];
        if (savedActions.length !== 1 || String(savedActions[0]?.name || '').trim() !== savedActionName) {
            throw new Error(`Saved smoke folder actions mismatch: ${JSON.stringify(savedActions)}`);
        }
        const expectedSavedOrder = previewOrder.length > 0 ? previewOrder : selectedMembers;
        if (expectedSavedOrder.length > 0) {
            const savedContainers = Array.isArray(savedFolder.containers) ? savedFolder.containers.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
            const savedLeadingOrder = savedContainers.slice(0, expectedSavedOrder.length);
            if (savedLeadingOrder.length !== expectedSavedOrder.length
                || !savedLeadingOrder.every((entry, index) => entry === expectedSavedOrder[index])) {
                throw new Error(`Saved member order mismatch. expected=${JSON.stringify(expectedSavedOrder)} actual=${JSON.stringify(savedContainers)}`);
            }
        }

        cleanupDetails = await cleanupSmokeFolder(page, {
            settingsUrl,
            type,
            folderName
        });

        return {
            skipped: false,
            pass: true,
            folderName,
            selectedMembers,
            previewOrder,
            reorderSkippedReason,
            savedActionName,
            cleanupDetails,
            screenshotPath
        };
    } catch (error) {
        try {
            if (screenshotPath) {
                await page.screenshot({ path: screenshotPath, fullPage: true });
            }
        } catch {
            // best effort
        }
        try {
            cleanupDetails = await cleanupSmokeFolder(page, {
                settingsUrl,
                type,
                folderName
            });
        } catch (cleanupError) {
            throw new Error(
                `Folder editor interaction smoke failed for ${type} (${browserName}): ${error.message}. `
                + `Cleanup also failed: ${cleanupError.message}. Screenshot: ${screenshotPath}`
            );
        }
        throw new Error(
            `Folder editor interaction smoke failed for ${type} (${browserName}): ${error.message}. `
            + `Cleanup: ${JSON.stringify(cleanupDetails)}. Screenshot: ${screenshotPath}`
        );
    }
};

const runFolderEditorToggleSmoke = async (page, { browserName, settingsUrl, type }) => {
    const settingId = `#${type}-folder-editor-modern`;
    const expectedPageType = type === 'vm' ? 'vm' : 'docker';
    const editorUrlBase = resolveFolderEditorUrl(settingsUrl, expectedPageType);
    if (!editorUrlBase) {
        const message = `Folder editor mode smoke skipped for ${type} (${browserName}): could not derive folder editor URL from ${settingsUrl}`;
        if (requireFolderEditorCoverage) {
            throw new Error(`${message} [required by FVPLUS_BROWSER_SMOKE_REQUIRE_FOLDER_EDITOR=1]`);
        }
        console.warn(message);
        return {
            browserName,
            type,
            skipped: true,
            pass: false,
            reason: 'Could not derive folder editor URL.'
        };
    }

    const statesVisited = [];
    const verifyEditorMode = async (expectedMode) => {
        const editorUrl = `${editorUrlBase}${editorUrlBase.includes('?') ? '&' : '?'}smoke=${Date.now()}`;
        await page.goto(editorUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const details = await waitForFolderEditorReady(page, {
            type: expectedPageType,
            expectedMode
        });
        if (details.pageType !== expectedPageType) {
            throw new Error(`Folder editor page type mismatch for ${type} (${browserName}). Got ${JSON.stringify(details)}.`);
        }
        if (details.pageMode !== expectedMode || details.resolvedMode !== expectedMode) {
            throw new Error(`Folder editor mode mismatch for ${type} (${browserName}). Expected ${expectedMode}, got ${JSON.stringify(details)}.`);
        }
        statesVisited.push(details);
        return details;
    };

    await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSettingsShell(page);
    const setting = page.locator(settingId).first();
    if (await setting.count() !== 0) {
        throw new Error(`Legacy folder editor toggle should not be present for ${type} (${browserName}): ${settingId}`);
    }

    await verifyEditorMode('modern');
    const interactionReport = await runFolderEditorInteractionSmoke(page, {
        browserName,
        settingsUrl,
        type: expectedPageType
    });

    return {
        browserName,
        type,
        skipped: false,
        pass: true,
        statesVisited,
        interactionReport
    };
};
    return { waitForSettingsShell, runFolderEditorToggleSmoke };
};
