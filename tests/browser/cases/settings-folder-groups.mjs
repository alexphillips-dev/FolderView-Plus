import assert from 'node:assert/strict';

const setup = async (page, baseUrl, type = 'docker') => {
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    await page.evaluate((type) => {
        const modules = window.FolderViewPlusFoundationModules;
        const utils = { ...modules.utilityFoundation, ...modules.utilityPrefs };
        if (matchMedia('(prefers-color-scheme: light)').matches) document.getElementById('fv-settings-root').dataset.fvThemeClass = 'light';
        const store = { docker: [], vm: [] }, created = [];
        let failSave = false, failCreate = false, resolveSave;
        const api = modules.folderGroups.createApi({
            document, ui: window.FolderViewPlusUI, utils,
            getGroups: type => store[type], getIcons: () => [], ensureAllowed: () => true,
            getBlueprints: () => [
                { name: 'Media', icon: '/plugin/images/icons/folder-media.svg', categories: ['media'] },
                { name: 'Monitoring', icon: '/plugin/images/icons/folder-cloud.svg', categories: ['homelab'] }
            ], getSmartIndexes: () => new Set([0]), categoryLabel: category => category,
            async saveGroups(type, groups) {
                if (failSave) { store[type] = utils.normalizeFolderGroups(groups); throw new Error('Synthetic save failure'); }
                if (window.fixtureGroups.delaySave) await new Promise(resolve => { resolveSave = resolve; });
                store[type] = utils.normalizeFolderGroups(groups);
            }, async createFolders(type, folders) {
                if (failCreate) throw new Error('Synthetic transaction conflict');
                created.push({ type, folders }); return { created: folders.length, skipped: 0 };
            }, onCreated() {}
        });
        window.fixtureGroups = { api, store, created, delaySave: false,
            failSave: value => { failSave = value; }, failCreate: value => { failCreate = value; }, releaseSave: () => resolveSave?.() };
        const opener = document.createElement('button'); opener.textContent = 'Add folder/group'; opener.id = 'group-opener';
        opener.addEventListener('click', () => { opener.focus(); api.open(type); }); document.getElementById('fv-settings-root').append(opener); opener.focus();
    }, type);
    await page.locator('#group-opener').click();
};
const action = (page, name) => page.locator(`.fv-folder-create-modal [data-fv-ui-action="${name}"]`);
const saved = page => page.locator('.fv-group-feedback').filter({ hasText: 'Group saved' }).waitFor();

export const registerSettingsFolderGroupCases = ({ test, baseUrl }) => {
    for (const type of ['docker', 'vm']) test(`${type} Basic creation supports a single folder and wizard preconfigured groups`, async ({ page }) => {
        await setup(page, baseUrl, type); await page.locator('[data-fv-group-name]').fill('One folder'); await action(page, 'create').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureGroups.created.map(row => [row.type, row.folders.map(folder => folder.name)])), [[type, ['One folder']]]);
        await page.locator('#group-opener').click(); await action(page, 'mode-templates').click();
        assert.equal(await page.locator('[data-fv-group-template]:checked').count(), 1);
        await page.locator('[data-fv-group-category]').selectOption('homelab'); await action(page, 'create').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureGroups.created.at(-1).folders.map(folder => folder.name)), ['Monitoring']);
        assert.equal(await page.locator('.fv-folder-create-modal').count(), 0);
    });
    test('Basic custom groups save, reopen, edit, create and delete without changing the other type', async ({ page }) => {
        await setup(page, baseUrl); await action(page, 'mode-custom').click();
        await page.locator('[data-fv-group-title]').fill('Home lab'); await page.locator('[data-fv-group-name="0"]').fill('Books');
        await page.locator('[data-fv-group-icon="0"]').selectOption('/plugin/images/icons/folder-media.svg');
        await action(page, 'add-row').click(); await page.locator('[data-fv-group-name="1"]').fill('Downloads'); await action(page, 'save').click(); await saved(page);
        const snapshot = await page.evaluate(() => ({ store: window.fixtureGroups.store, creates: window.fixtureGroups.created.length }));
        assert.equal(snapshot.creates, 0); assert.equal(snapshot.store.docker[0].folders.length, 2); assert.deepEqual(snapshot.store.vm, []);
        assert.equal(snapshot.store.docker[0].folders[0].icon, '/plugin/images/icons/folder-media.svg');
        await action(page, 'cancel').click(); await page.locator('#group-opener').click(); await action(page, 'mode-custom').click();
        await page.locator('[data-fv-group-saved]').selectOption(snapshot.store.docker[0].id);
        assert.equal(await page.locator('[data-fv-group-name="0"]').inputValue(), 'Books');
        await page.locator('[data-fv-group-name="0"]').fill('Audiobooks'); await action(page, 'save').click(); await saved(page); await action(page, 'create').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureGroups.created[0].folders.map(folder => folder.name)), ['Audiobooks', 'Downloads']);
        await page.locator('#group-opener').click(); await action(page, 'mode-custom').click();
        await page.locator('[data-fv-group-saved]').selectOption(snapshot.store.docker[0].id); await action(page, 'delete').click();
        await page.locator('.fv-group-feedback').filter({ hasText: 'Saved group deleted' }).waitFor();
        assert.deepEqual(await page.evaluate(() => window.fixtureGroups.store.docker), []);
        assert.equal(await page.evaluate(() => window.fixtureGroups.created.length), 1); assert.equal(await action(page, 'delete').isDisabled(), true);
    });
    test('Basic group errors preserve drafts and busy saves prevent duplicate requests or premature dismissal', async ({ page }) => {
        await setup(page, baseUrl); await action(page, 'mode-custom').click(); await action(page, 'save').click();
        assert.equal(await page.locator('.fv-group-feedback.is-error').isVisible(), true);
        await page.locator('[data-fv-group-title]').fill('My group'); await page.locator('[data-fv-group-name]').fill('Unique');
        await action(page, 'add-row').click(); await page.locator('[data-fv-group-name="1"]').fill('UNIQUE'); await action(page, 'save').click();
        assert.match(await page.locator('.fv-group-feedback').textContent(), /different name/);
        await page.locator('[data-fv-group-name="1"]').fill('Second'); await page.evaluate(() => window.fixtureGroups.failSave(true)); await action(page, 'save').click();
        assert.match(await page.locator('.fv-group-feedback').textContent(), /Synthetic save failure/); assert.equal(await page.locator('[data-fv-group-name="1"]').inputValue(), 'Second');
        await page.evaluate(() => { window.fixtureGroups.failSave(false); window.fixtureGroups.delaySave = true; }); await action(page, 'save').click(); await page.keyboard.press('Escape');
        assert.equal(await page.locator('.fv-folder-create-modal.is-busy').count(), 1); assert.equal(await action(page, 'save').isDisabled(), true);
        await page.evaluate(() => window.fixtureGroups.releaseSave()); await saved(page);
        await page.evaluate(() => window.fixtureGroups.failCreate(true)); await action(page, 'create').click();
        assert.match(await page.locator('.fv-group-feedback').textContent(), /Synthetic transaction conflict/); assert.equal(await page.locator('[data-fv-group-name="1"]').inputValue(), 'Second');
    });
    test('Basic group popup fits mobile and desktop themes with fixed actions, focus restoration and escaped names', async ({ page }) => {
        await setup(page, baseUrl); await action(page, 'mode-custom').click();
        await page.locator('[data-fv-group-title]').fill('<img src=x onerror=alert(1)>'); await page.locator('[data-fv-group-name]').fill('<script>bad</script>'); await action(page, 'save').click(); await saved(page);
        assert.equal(await page.locator('.fv-group-library img').count(), 0);
        for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 720 }); await page.emulateMedia({ reducedMotion: 'reduce' });
            for (let index = 0; index < 8; index++) await action(page, 'add-row').click();
            const geometry = await page.evaluate(() => {
                const modal = document.querySelector('.fv-folder-create-modal'), box = modal.getBoundingClientRect();
                const footer = modal.querySelector('.fv-ui-modal-footer').getBoundingClientRect(), body = modal.querySelector('.fv-ui-modal-body');
                return { left: box.left, right: box.right, bottom: box.bottom, footerBottom: footer.bottom, viewport: innerWidth, height: innerHeight,
                    bodyOverflow: getComputedStyle(body).overflowY, scrollWidth: modal.scrollWidth, clientWidth: modal.clientWidth };
            });
            assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport + 1); assert.ok(geometry.bottom <= geometry.height + 1 && geometry.footerBottom <= geometry.height + 1);
            assert.equal(geometry.bodyOverflow, 'auto'); assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1);
        }
        await page.keyboard.press('Escape'); assert.equal(await page.locator('.fv-folder-create-modal').count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'group-opener');
        await page.locator('#group-opener').click(); await page.locator('#group-opener').evaluate(element => element.click()); assert.equal(await page.locator('.fv-folder-create-modal').count(), 1);
    });
};
