import assert from 'node:assert/strict';

export const registerImportFixtureCases = ({ test, baseUrl }) => {
test('Import selection applies group choices without mutating unrelated operations', async ({ page }) => {
    await page.goto(`${baseUrl}/import`, { waitUntil: 'load' });
    const operations = {
        mode: 'replace',
        creates: [{ folder: { name: 'New Media' } }],
        upserts: [{ id: 'media', folder: { name: 'Media' } }],
        deletes: ['old'],
        pathMappings: [],
        pathConflicts: []
    };
    await page.evaluate((value) => window.fixtureImport.renderSelection(value, { old: { name: 'Old folder' } }), operations);
    assert.equal(await page.locator('#import-preview-selection .import-selection-item').count(), 3);
    await page.locator('input[data-group-toggle="creates"]').uncheck();
    const filtered = await page.evaluate((value) => window.fixtureImport.filteredSelection(value), operations);
    assert.equal(filtered.creates.length, 0);
    assert.equal(filtered.upserts.length, 1);
    assert.equal(filtered.deletes.length, 1);
});

test('Import progress dialog reports deterministic progress and closes cleanly', async ({ page }) => {
    await page.goto(`${baseUrl}/import`, { waitUntil: 'load' });
    assert.equal(await page.locator('#import-apply-progress-overlay').isHidden(), true);
    assert.equal(await page.locator('#import-apply-progress-dialog').isHidden(), true);
    assert.equal(await page.locator('#import-apply-progress-dialog').getAttribute('aria-hidden'), 'true');
    await page.evaluate(() => window.fixtureImport.openProgress('docker', 4, { title: 'Applying Docker changes' }));
    assert.equal(await page.locator('#import-apply-progress-overlay').isVisible(), true);
    assert.equal(await page.locator('#import-apply-progress-dialog').isVisible(), true);
    assert.equal(await page.locator('#import-apply-progress-dialog').getAttribute('aria-hidden'), 'false');
    await page.evaluate(() => window.fixtureImport.updateProgress({ completed: 2, total: 4, label: 'Updating Media' }));
    assert.equal(await page.locator('#import-apply-progress-step').textContent(), 'Step 2 of 4');
    assert.equal(await page.locator('#import-apply-progress-percent').textContent(), 'Progress 50%');
    assert.equal(await page.locator('#import-apply-progress-bar').getAttribute('style'), 'width: 50%;');
    await page.evaluate(() => window.fixtureImport.closeProgress());
    assert.equal(await page.locator('#import-apply-progress-dialog').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#import-apply-progress-overlay').isHidden(), true);
    assert.equal(await page.locator('#import-apply-progress-dialog').isHidden(), true);
});

test('Export download diagnostics report a missing file and retry from a direct user action', async ({ page }) => {
    await page.goto(`${baseUrl}/import`, { waitUntil: 'load' });
    await page.evaluate(() => window.fixtureImport.requestDownload());
    const status = page.locator('#docker-download-status');
    assert.equal(await status.isVisible(), true);
    assert.equal(await status.locator('strong').textContent(), 'Download requested');
    assert.match(
        String(await status.locator('small').textContent()),
        /Browsers do not provide a save-completion signal/
    );

    await status.locator('.fv-download-status-report').click();
    await page.waitForFunction(() => (
        window.fixtureImport.downloadAttempts().attempts[0]?.lifecycle === 'user-reported-missing'
    ));
    assert.equal(await status.locator('strong').textContent(), 'Download was not received');
    assert.equal(await status.locator('.fv-download-status-retry').count(), 1);
    assert.equal(
        await page.evaluate(() => window.fixtureDiagnosticEvents.at(-1)?.eventType),
        'export_download_missing'
    );

    const retryDownload = page.waitForEvent('download');
    await status.locator('.fv-download-status-retry').click();
    const download = await retryDownload;
    assert.equal(download.suggestedFilename(), 'FolderView Plus Docker.json');
    await page.waitForFunction(() => window.fixtureImport.downloadAttempts().attempts.length === 2);
    assert.equal(await status.locator('strong').textContent(), 'Download retry requested');
    const attempts = await page.evaluate(() => window.fixtureImport.downloadAttempts().attempts);
    assert.equal(attempts[1].fallback.used, true);
    assert.equal(attempts[1].fallback.retryOf, attempts[0].attemptId);
});
};
