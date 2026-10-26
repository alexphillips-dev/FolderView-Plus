import assert from 'node:assert/strict';

export const registerRulesPreviewCase = ({test, withRulesFixture}) => {
test('Rules simulator reviews authoritative rows and applies only the reviewed digest', async ({page}) => {
    const missing = [];
    page.on('response', response => { if (response.status() === 404) missing.push(new URL(response.url()).pathname); });
    await withRulesFixture(page, async () => {
        const digest = 'a'.repeat(64), posts = [];
        let applied = false;
        await page.route('**/server/rule_preview.php*', async route => {
            if (route.request().method() === 'POST') {
                const payload = new URLSearchParams(route.request().postData() || '');
                assert.equal(payload.get('type'), 'docker');
                assert.equal(payload.get('expectedDigest'), digest);
                assert.equal(payload.has('assignments'), false);
                posts.push(payload); applied = true;
                return route.fulfill({json:{ok:true, result:{assignedCount:1, skippedInvalidCount:0, backup:{name:'docker-reviewed-preview.json'}}}});
            }
            return route.fulfill({json:{ok:true, preview:{digest, ready:true, issues:[],
                assignments:applied ? [] : [{folderId:'fixture-folder-0', items:['server-reviewed-item']}],
                rows:[{item:'server-reviewed-item', result:'assigned', folderId:'fixture-folder-0', folderName:'Authoritative destination', matchedRule:null, apply:!applied}]}}});
        });
        await page.route('**/server/diagnostics.php*', route => route.fulfill({json:{ok:true}}));
        await page.route('**/server/backup.php*', route => route.fulfill({json:{ok:true, backups:[]}}));
        await page.evaluate(() => {
            window.fixturePreviewConfirmations = [];
            window.swal = (options, callback) => { window.fixturePreviewConfirmations.push(options); window.fixturePreviewConfirm = callback; };
            window.swal.close = () => {};
        });
        await page.locator('[data-rule-tester="open"]').click();
        await page.locator('[data-fv-onclick="runRuleSimulator(\'docker\')"]').click();
        await page.waitForFunction(() => document.querySelector('#docker-rule-sim-output').textContent.includes('server-reviewed-item'));
        assert.match(await page.locator('#docker-rule-sim-output').textContent(), /Authoritative destination/);
        await page.locator('[data-fv-onclick="applyRuleSimulatorAssignments(\'docker\')"]').click();
        assert.match(await page.evaluate(() => window.fixturePreviewConfirmations.at(-1).text), /Existing manual assignments/);
        await page.evaluate(() => window.fixturePreviewConfirm(true));
        await page.waitForFunction(() => document.body.textContent.includes('Recovery backup created: docker-reviewed-preview.json.'));
        assert.equal(posts.length, 1);
        assert.deepEqual(missing, [], 'Fixture must serve all apply/recovery requests');
        assert.match(await page.locator('body').textContent(), /Recovery backup created: docker-reviewed-preview/);
        await page.unroute('**/server/rule_preview.php*');
        await page.unroute('**/server/backup.php*');
        await page.unroute('**/server/diagnostics.php*');
    });
});

};
