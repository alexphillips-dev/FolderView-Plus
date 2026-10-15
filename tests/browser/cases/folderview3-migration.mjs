import assert from 'node:assert/strict';
import { migrationFixture } from '../../helpers/folderview3-fixture.mjs';
import { withFolderView3Host } from '../helpers/folderview3-host.mjs';
export const registerFolderView3MigrationCases = ({ test, baseUrl }) => {
    test('FolderView3 full-backup file selection previews, cancels, applies, refreshes and reloads actual storage', async ({ page }) => {
        await withFolderView3Host(page, baseUrl, async (call, editorBlock) => {
            const before = call({ action: 'fixture_read' });
            const picker = page.waitForEvent('filechooser');
            await page.getByRole('button', { name: 'Preview full backup' }).click();
            await (await picker).setFiles({ name: 'synthetic-v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(migrationFixture)) });
            await page.getByRole('button', { name: 'Apply verified migration' }).waitFor();
            assert.deepEqual(call({ action: 'fixture_read' }), before);
            const report = await page.locator('#fv-recovery-folderview3-summary').innerText();
            assert.match(report, /Explicit assignments: Docker/); assert.match(report, /Global settings converted/); assert.match(report, /recovery metadata/);
            page.once('dialog', dialog => dialog.dismiss());
            await page.getByRole('button', { name: 'Apply verified migration' }).click();
            await page.getByRole('button', { name: 'Apply verified migration' }).waitFor();
            assert.deepEqual(call({ action: 'fixture_read' }), before);
            page.once('dialog', dialog => dialog.accept());
            await page.getByRole('button', { name: 'Apply verified migration' }).click();
            await page.waitForFunction(() => window.migrationRefreshCount === 1);
            assert.match(await page.locator('#fixture-result').innerText(), /verified/);
            const stored = call({ action: 'fixture_read' });
            assert.equal(stored.docker.regex.settings.preview_overflow, 'expand_row');
            assert.deepEqual(stored.docker.regex.hiddenPreviewMembers, ['service-hidden']);
            assert.equal(stored.vm.lab.memberIdentities['Synthetic VM'].uuid, '11111111-2222-3333-4444-555555555555');
            const hidden = await page.evaluate(block => {
                const fixture = document.createElement('div');
                fixture.innerHTML = '<table class="sortable"><tbody><tr data-name="service-hidden"><td><input name="containers[]" value="service-hidden"><input class="member-preview-switch" type="checkbox" disabled></td></tr></tbody></table>';
                document.body.append(fixture);
                const result = new Function('$', 'hiddenPreviewMembers', block + '\nreturn preservedHiddenPreviewMembers;')(window.jQuery, new Set(['service-hidden', 'temporarily-missing']));
                fixture.remove(); return result;
            }, editorBlock);
            assert.deepEqual(hidden, ['service-hidden', 'temporarily-missing']);
            await page.reload(); assert.deepEqual(call({ action: 'fixture_read' }), stored);
        });
    });
    test('FolderView3 malformed full backup reports rejection and leaves existing storage intact', async ({ page }) => {
        await withFolderView3Host(page, baseUrl, async call => {
            const before = call({ action: 'fixture_read' });
            const error = await page.evaluate(async () => {
                try { await window.migrationApi.previewSelection({ name: 'damaged.json', text: '{"fv3_export_version":1}' }); return ''; }
                catch (e) { return e.message; }
            });
            assert.match(error, /missing required/); assert.deepEqual(call({ action: 'fixture_read' }), before);
            assert.equal(await page.getByRole('button', { name: 'Apply verified migration' }).count(), 0);
            for (const buffer of [Buffer.from('{'), Buffer.from([0xff])]) {
                const picker = page.waitForEvent('filechooser');
                const previous = await page.evaluate(() => window.migrationErrors.length);
                await page.getByRole('button', { name: 'Preview full backup' }).click();
                await (await picker).setFiles({ name: 'damaged.json', mimeType: 'application/json', buffer });
                await page.waitForFunction(count => window.migrationErrors.length > count, previous);
                assert.match(await page.evaluate(() => window.migrationErrors.at(-1)), /not valid JSON/);
                assert.deepEqual(call({ action: 'fixture_read' }), before);
            }
        });
    });
};
