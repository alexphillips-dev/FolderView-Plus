import assert from 'node:assert/strict';

export const registerSettingsPredicateValidationCase = ({ test, withRulesFixture }) => {
    test('Rules workspace checks regex on the server and handles restored cached navigation', async ({page}) => {
        await withRulesFixture(page, async state => {
            const panel = page.locator('.fv-rules-workspace[data-fv-rules-type="docker"]');
            const submit = panel.locator('.rules-add-btn');
            const pattern = page.locator('#docker-rule-pattern');
            const preview = page.locator('#docker-rule-live-match');
            await panel.locator('[data-rule-value="starts_with"]').click();
            for (const value of ['ends_with', 'starts_with']) {
                await page.evaluate(() => {
                    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
                    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
                });
                await panel.locator(`[data-rule-value="${value}"]`).click();
                assert.equal(await page.locator('#docker-rule-operator').inputValue(), value);
            }
            await page.locator('#docker-rule-advanced > summary').click();
            await page.locator('#docker-rule-regex').check();
            await pattern.fill('(?<=fixture-.*)app-0');
            await page.waitForFunction(() => document.getElementById('docker-rule-live-match').textContent === 'Enter a valid match value.');
            assert.equal(await submit.isDisabled(), true);
            assert.equal(state.writes.length, 0);
            const rejected = state.predicateChecks.at(-1);
            assert.equal(rejected.get('pattern'), '(?<=fixture-.*)app-0');
            assert.equal(rejected.has('_fv_nonce'), false);
            await pattern.fill('^fixture-app-0$');
            await page.waitForFunction(() => !document.querySelector('.fv-rules-workspace[data-fv-rules-type="docker"] .rules-add-btn').disabled);
            assert.equal(await preview.textContent(), 'Matches 1 containers');
            await submit.click();
            await page.waitForFunction(() => document.getElementById('docker-rule-pattern').value === '');
            assert.equal(state.saved.docker.autoRules.at(-1).pattern, '^fixture-app-0$');
        });
    });
};
