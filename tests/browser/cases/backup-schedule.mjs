import assert from 'node:assert/strict';
import { runBackupScheduleFixture } from '../../helpers/backup-schedule-fixture.mjs';

export function registerBackupScheduleCases({ test, baseUrl }) {
    test('Scheduled backup skips show clear reasons and status in Advanced Logs after reload', async ({ page }) => {
        const docker = runBackupScheduleFixture('docker', 'unchanged');
        const vm = runBackupScheduleFixture('vm', 'empty');
        const events = [docker.state.events.at(-1), vm.state.events.at(-1)];
        const mount = async () => {
            await page.goto(`${baseUrl}/settings`);
            await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
            await page.addStyleTag({ url: `${baseUrl}/plugin/styles/folderviewplus.css` });
            await page.evaluate(async () => {
                const parsed = new DOMParser().parseFromString(await fetch('/plugin/FolderViewPlus.page').then(r => r.text()), 'text/html');
                document.getElementById('fv-settings-root').innerHTML = parsed.getElementById('fv-activity-feed-panel').outerHTML;
                window.activityFeedEntries = [];
                Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
            });
            for (const script of ['folderviewplus.activity-detail', 'folderviewplus.activity-diagnostics']) {
                await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${script}.js` });
            }
            await page.evaluate(events => {
                delete document.readyState;
                window.FolderViewPlusDiagnostics.renderChangeHistory({ importExportHistory: { events } });
                window.FolderViewPlusDiagnostics.renderChangeHistory({ importExportHistory: { events } });
            }, events);
        };
        await mount();
        for (const width of [1180, 390]) for (const theme of ['dark', 'light']) {
            await page.setViewportSize({ width, height: 844 });
            await page.locator('#fv-settings-root').evaluate((root, theme) => { root.dataset.fvThemeClass = theme; }, theme);
            assert.equal(await page.locator('.fv-activity-item.is-skipped.is-info').count(), 2);
            assert.deepEqual(await page.locator('.fv-activity-level').allTextContents(), ['Skipped', 'Skipped']);
            const text = (await page.locator('.fv-activity-text').allTextContents()).join('\n');
            assert.match(text, /Docker.*Folders and preferences match.*No duplicate file.*existing backups were kept/);
            assert.match(text, /VM.*No folders are configured.*No backup file was written/);
            assert.match(text, /memory.*server restart/);
            assert.match(text, /every 1 h/);
            assert.doesNotMatch(text, /Private fixture|fingerprint|backupName/);
            assert.equal(await page.locator('.fv-activity-text').evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth + 2)), false);
        }
        await mount();
        assert.equal(await page.locator('.fv-activity-item.is-skipped.is-info').count(), 2);
        assert.match((await page.locator('.fv-activity-detail').allTextContents()).join(' '), /memory.*restart/);
    });
}
