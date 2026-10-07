import assert from 'node:assert/strict';

const search = async (page, query) => {
    await page.locator('[data-finder-toggle]').click();
    await page.locator('.fv-quickfinder input').fill(query);
    await page.waitForFunction(expected => document.querySelector('.fv-quickfinder-name')?.textContent === expected, query);
    await page.locator('.fv-quickfinder-popover').evaluate(n => Promise.all(n.getAnimations().map(a => a.finished)));
};
const settle = page => page.waitForFunction(() => document.querySelector('.fv-quickfinder')?.getAttribute('aria-busy') !== 'true');

export const registerQuickFinderSafetyCases = ({ test, baseUrl }) => {
    test('Quick finder Enter resolves the current query before a pending debounce', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            await search(page, 'Assistant');
            await page.evaluate(() => {
                const input = document.querySelector('.fv-quickfinder input');
                input.value = 'Mosquitto'; input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            });
            await page.waitForFunction(() => document.querySelector('tr.fv-quickfinder-highlight')?.dataset.name === 'Mosquitto');
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
            await search(page, 'Assistant');
            await page.evaluate(() => {
                const input = document.querySelector('.fv-quickfinder input');
                input.value = 'not-a-match'; input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            });
            assert.equal(await page.locator('.fv-quickfinder-result').count(), 0);
            assert.equal(await page.locator('.fv-quickfinder input').inputValue(), 'not-a-match');
            assert.equal(await page.locator('tr.fv-quickfinder-highlight').getAttribute('data-name'), 'Mosquitto');
        }
    });

    test('Quick finder stale reveal and menu preparation cannot alter a reopened search', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            for (const action of ['reveal', 'focus', 'actions']) {
                await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
                await search(page, action === 'focus' ? 'Home Automation' : 'Assistant');
                await page.evaluate(() => window.fixtureFinder.deferPrepare());
                await page.locator(action === 'reveal' ? '[data-finder-select]' : `[data-finder-action="${action}"]`).first().click();
                await page.waitForFunction(() => document.querySelector('.fv-quickfinder').getAttribute('aria-busy') === 'true');
                if (action === 'reveal') { await page.locator('.fv-quickfinder input').focus(); await page.keyboard.press('Escape'); }
                await search(page, 'Mosquitto');
                await page.evaluate(() => window.fixtureFinder.releasePrepare());
                await settle(page);
                // Allow the released continuation to finish before checking for late effects.
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                assert.equal(await page.locator('.fv-quickfinder input').inputValue(), 'Mosquitto');
                assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), true);
                assert.equal(await page.locator('tr.fv-quickfinder-highlight').count(), 0);
                assert.deepEqual(await page.evaluate(() => window.fixtureFinder.events), []);
                assert.equal(await page.locator('.fv-quickfinder input').evaluate(n => n === document.activeElement), true);
                await page.locator('.fv-quickfinder-popover').evaluate(n => Promise.all(n.getAnimations().map(a => a.finished)));
            }
        }
    });

    test('Quick finder shortcuts preserve focus inside the existing plugin modal', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.ui.js` });
            await page.addStyleTag({ url: `${baseUrl}/plugin/styles/ui.primitives.css` });
            await page.evaluate(() => { window.testModal = window.FolderViewPlusUI.openModal({ title: 'Test modal', content: '<input aria-label="Modal input">', initialFocus: 'input' }); });
            await page.waitForFunction(() => document.activeElement.closest('.fv-ui-modal'));
            for (const shortcut of ['Control+k', 'Meta+k']) {
                await page.keyboard.press(shortcut);
                assert.equal(await page.locator('.fv-quickfinder input').isDisabled(), true);
                assert.equal(await page.locator('.fv-ui-modal input').evaluate(n => n === document.activeElement), true);
            }
            await page.evaluate(() => window.testModal.close());
            await page.keyboard.press('Control+k');
            assert.equal(await page.locator('.fv-quickfinder input').isEnabled(), true);
            await page.keyboard.press('Escape');
        }
    });

    test('Quick finder composition confirmation leaves text input and results intact', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            await search(page, 'Assistant');
            const prevented = await page.evaluate(() => {
                const input = document.querySelector('.fv-quickfinder input');
                input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
                input.value = 'Mosquitto'; input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
                const events = [new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }),
                    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })];
                events.forEach(event => input.dispatchEvent(event));
                input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
                return events.map(event => event.defaultPrevented);
            });
            assert.deepEqual(prevented, [false, false]);
            await page.waitForFunction(() => document.querySelector('.fv-quickfinder-name')?.textContent === 'Mosquitto');
            assert.equal(await page.locator('.fv-quickfinder input').inputValue(), 'Mosquitto');
            assert.equal(await page.locator('.fv-quickfinder-name').textContent(), 'Mosquitto');
            assert.equal(await page.locator('tr.fv-quickfinder-highlight').count(), 0);
            assert.deepEqual(await page.evaluate(() => window.fixtureFinder.events), []);
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => document.querySelector('tr.fv-quickfinder-highlight')?.dataset.name === 'Mosquitto');
        }
    });

    test('Quick finder results stay inside the viewport near the bottom and after resizing', async ({ page }) => {
        const viewport = page.viewportSize();
        for (const type of ['docker', 'vm']) {
            await page.setViewportSize(viewport);
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            await page.evaluate(() => document.querySelector('.ToggleViewMode').style.cssText = 'position:fixed;bottom:20px;right:20px');
            await search(page, 'Assistant');
            await page.locator('.fv-quickfinder-field').evaluate(n => Promise.all(n.getAnimations().map(a => a.finished)));
            await page.locator('.fv-quickfinder-popover').evaluate(n => Promise.all(n.getAnimations().map(a => a.finished)));
            const panel = await page.locator('.fv-quickfinder-popover').boundingBox();
            const field = await page.locator('.fv-quickfinder-field').boundingBox();
            assert.ok(panel.y >= 0 && panel.y + panel.height <= field.y);
            assert.ok(panel.x >= 0 && panel.x + panel.width <= page.viewportSize().width + 1);
            await page.setViewportSize({ width: 320, height: 240 });
            await page.waitForFunction(() => { const r = document.querySelector('.fv-quickfinder-popover').getBoundingClientRect(); return r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
            const resized = await page.locator('.fv-quickfinder-popover').boundingBox();
            assert.ok(resized.y >= 0 && resized.y + resized.height <= 240);
            await page.locator('.fv-quickfinder input').fill('');
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
        }
    });
};
