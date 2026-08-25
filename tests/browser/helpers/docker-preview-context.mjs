import assert from 'node:assert/strict';

export const exerciseDockerPreviewContextDiagnostics = async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const snapshot = () => page.evaluate(() => window.fixtureNativePreviewContext.snapshot());
    const exercise = async (selector, key = '') => {
        await page.evaluate(() => window.fixtureNativePreviewContext.reset());
        const target = page.locator(selector);
        key ? await target.press(key) : await target.click();
        return snapshot();
    };
    let result = await exercise('#fixture-context-preview-rows-2 .folder-preview-row:first-of-type .hand');
    assert.deepEqual(
        [result.attachCount, result.openCount, result.lastKey, result.menuVisible],
        [1, 1, 'rows-2', true]
    );
    assert.ok(result.lastPoint.clientX > 0);
    assert.ok(result.lastPoint.clientY > 0);
    assert.deepEqual(
        [result.diagnostics.lastEvent.type, result.diagnostics.lastEvent.outcome, result.diagnostics.lastEvent.rowMode,
            result.diagnostics.lastEvent.rowIndex, result.diagnostics.lastEvent.triggerSource, result.diagnostics.lastEvent.inputMethod],
        ['dispatch', 'success', '2', 1, 'icon', 'mouse']
    );
    result = await exercise('#fixture-context-preview-unlimited .folder-preview-row:first-of-type .appname');
    assert.deepEqual([result.openCount, result.editCount, result.lastKey], [1, 0, 'unlimited']);
    assert.deepEqual(
        [result.diagnostics.lastEvent.rowMode, result.diagnostics.lastEvent.rowIndex, result.diagnostics.lastEvent.triggerSource],
        ['unlimited', 1, 'name']
    );
    result = await exercise('#fixture-context-preview-rows-2 .folder-preview-row:nth-of-type(2) .state');
    assert.deepEqual([result.openCount, result.lastKey], [1, 'rows-2']);
    assert.deepEqual(
        [result.diagnostics.lastEvent.rowMode, result.diagnostics.lastEvent.rowIndex, result.diagnostics.lastEvent.triggerSource],
        ['2', 2, 'status']
    );
    result = await exercise('#fixture-context-preview-rows-2 .folder-preview-row:first-of-type [data-fv-preview-context="native"]', 'Enter');
    assert.deepEqual([result.openCount, result.lastKey], [1, 'rows-2']);
    assert.equal(result.diagnostics.lastEvent.inputMethod, 'keyboard');
    result = await exercise('#fixture-context-preview-unlimited .folder-preview-row:nth-of-type(2) [data-fv-preview-context="native"]', 'Space');
    assert.deepEqual([result.openCount, result.lastKey], [1, 'unlimited']);
    result = await exercise('#fixture-context-preview-rows-2 .folder-preview-row:first-of-type .fixture-context-quick-action');
    assert.deepEqual(
        [result.quickActionCount, result.openCount, result.sourceRows2IdCount, result.sourceUnlimitedIdCount,
            result.previewNativeIdCount, result.previewInlineHandlerCount, result.startedClassCount, result.bridgeCount,
            result.previewRowCount],
        [1, 0, 1, 1, 0, 0, 4, 4, 4]
    );
    assert.deepEqual(
        [result.diagnostics.counters.bindAttempts, result.diagnostics.counters.boundTargets,
            result.diagnostics.counters.bindFailures, result.diagnostics.counters.finalizationPasses,
            result.diagnostics.counters.eligibleTargetsAudited, result.diagnostics.counters.boundTargetsAudited,
            result.diagnostics.counters.missingBridgeTargets, result.diagnostics.counters.handlerIntegrityFailures,
            result.diagnostics.counters.dispatchAttempts, result.diagnostics.counters.dispatchSuccesses,
            result.diagnostics.counters.dispatchFailures],
        [4, 4, 0, 4, 8, 8, 0, 0, 5, 5, 0]
    );
    assert.equal(result.diagnostics.rowModes['2'].dispatchSuccesses, 3);
    assert.equal(result.diagnostics.rowModes.unlimited.dispatchSuccesses, 2);
    assert.equal(result.diagnostics.rowIndexes['2'].dispatchSuccesses, 2);
    assert.equal(result.diagnostics.triggerSources.status, 1);
    assert.equal(result.diagnostics.inputMethods.keyboard, 2);
    assert.doesNotMatch(JSON.stringify(result.diagnostics), /rows-2|fixture-native|fixture-context|clientX|clientY/);
    const persisted = await page.evaluate(() => window.FolderViewPlusDockerPreviewActions.createApi({
        window,
        $: window.jQuery
    }).getPreviewContextDiagnosticsSnapshot());
    assert.deepEqual(
        [persisted.counters.dispatchSuccesses, persisted.rowModes['2'].dispatchSuccesses,
            persisted.rowModes.unlimited.dispatchSuccesses, persisted.rowIndexes['2'].dispatchSuccesses],
        [5, 3, 2, 2]
    );
    const failedAudit = await page.evaluate(() => window.fixtureNativePreviewContext.breakRows2HandlersAndAudit());
    result = await snapshot();
    assert.deepEqual(
        [failedAudit.eligibleTargetsAudited, failedAudit.boundTargetsAudited, failedAudit.missingBridgeTargets,
            failedAudit.handlerIntegrityFailures],
        [2, 2, 0, 2]
    );
    assert.deepEqual(
        [result.diagnostics.lastEvent.type, result.diagnostics.lastEvent.outcome, result.diagnostics.lastEvent.rowMode,
            result.diagnostics.lastEvent.reason],
        ['finalization', 'failure', '2', 'handler-missing']
    );
    assert.equal(result.diagnostics.failureReasons['handler-missing'], 2);
};

export const exerciseChildFolderPreviewContext = async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const chip = page.locator('#fixture-child-folder-preview .fv-folder-preview-child');
    const snapshot = () => page.evaluate(() => window.fixtureChildFolderPreviewContext.snapshot());

    let result = await snapshot();
    assert.deepEqual([result.chipCount, result.rowCount], [1, 3]);

    await chip.click();
    result = await snapshot();
    assert.equal(result.menuCount, 1, 'normal click must open the child-folder menu');
    assert.ok(result.menuLeft > 0);
    assert.ok(result.menuTop > 0);
    assert.deepEqual(result.menuActions, ['Expand to folder', 'Edit folder', 'Open folder actions']);
    await page.getByRole('menuitem', { name: 'Edit folder' }).click();
    result = await snapshot();
    assert.deepEqual([result.menuCount, result.editCount], [0, 1]);

    await chip.focus();
    await chip.press('Enter');
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Expand to folder'));
    result = await snapshot();
    assert.equal(result.menuCount, 1, 'keyboard activation must open the child-folder menu');
    assert.equal(result.focusedAction, 'Expand to folder');
    assert.ok(result.menuLeft > 0, 'keyboard activation must use the chip geometry');
    assert.ok(result.menuTop > 0, 'keyboard activation must use the chip geometry');
    await page.keyboard.press('Escape');

    await chip.click({ button: 'right' });
    result = await snapshot();
    assert.equal(result.menuCount, 1, 'right-click must keep opening the child-folder menu');
    await page.getByRole('menuitem', { name: 'Open folder actions' }).click();
    result = await snapshot();
    assert.deepEqual([result.menuCount, result.actionCount], [0, 1]);

    await page.evaluate(() => window.fixtureChildFolderPreviewContext.dispatchTouchClick());
    result = await snapshot();
    assert.equal(result.menuCount, 1, 'touch-like activation must open the child-folder menu');
    assert.deepEqual([result.menuLeft, result.menuTop], [321, 145]);
    assert.deepEqual(
        [result.diagnostics.childFolderPreview.counters.chipsRendered,
            result.diagnostics.childFolderPreview.counters.bindings,
            result.diagnostics.childFolderPreview.counters.menuOpenAttempts,
            result.diagnostics.childFolderPreview.counters.menuOpens,
            result.diagnostics.childFolderPreview.counters.menuOpenFailures],
        [1, 1, 4, 4, 0]
    );
    assert.deepEqual(
        result.diagnostics.childFolderPreview.inputMethods,
        { mouse: 1, keyboard: 1, contextmenu: 1, touch: 1, unknown: 0 }
    );
    assert.doesNotMatch(
        JSON.stringify(result.diagnostics.childFolderPreview),
        /Private parent fixture|Private child fixture|fixture-parent|fixture-child/
    );
};
