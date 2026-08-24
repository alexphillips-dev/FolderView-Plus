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
