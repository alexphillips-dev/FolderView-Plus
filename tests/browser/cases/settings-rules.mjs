import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createProductionPerfFixture} from '../../../scripts/lib/production-perf-fixture.mjs';

const withRulesFixture = async (page, run) => {
    const {server, folders, names} = createProductionPerfFixture(process.cwd(), {members:12, folders:4, nestedFolders:0});
    const initial = ['fixture', 'media', 'db', 'dev', 'project', '^test-'].map((pattern, index) => ({
        id:`rule-${index}`, folderId:`fixture-folder-${index % 4}`, enabled:index !== 5,
        effect:index === 4 ? 'exclude' : 'include', kind:'name_regex', pattern, labelKey:'', labelValue:''
    }));
    const state = {saved:{docker:{autoRules:initial}, vm:{autoRules:[]}}, revisions:{docker:1, vm:1}, writes:[], fail:false, delay:null};
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await page.route('**/server/prefs.php', async route => {
        const response = await route.fetch(), body = await response.json(), request = route.request();
        const payload = new URLSearchParams(request.postData() || '');
        const type = payload.get('type') || new URL(request.url()).searchParams.get('type') || 'docker';
        if (request.method() === 'POST') {
            const patch = JSON.parse(payload.get('prefs'));
            if (patch.autoRules) state.writes.push({type, payload});
            if (state.delay) await state.delay;
            if (state.fail) return route.fulfill({json:{ok:false, error:'Synthetic save failure'}});
            assert.equal(Number(payload.get('expectedRevision')), state.revisions[type], 'writes must retain the preference revision guard');
            Object.assign(state.saved[type], JSON.parse(payload.get('prefs')));
            state.revisions[type]++;
        }
        body.prefs = {...body.prefs, ...state.saved[type]};
        body.metadata = {prefsRevision:state.revisions[type]};
        await route.fulfill({response, json:body});
    });
    await page.route('**/server/templates.php?*', route => route.fulfill({json:{ok:true, templates:[]}}));
    await page.route('**/server/runtime_snapshot.php?*', async route => {
        const response = await route.fetch(), body = await response.json();
        const apply = (snapshot, type) => {
            snapshot.prefs = {...snapshot.prefs, ...state.saved[type]};
            snapshot.metadata = {...snapshot.metadata, prefsRevision:state.revisions[type]};
            if (type === 'vm') {
                snapshot.folders = folders;
                snapshot.runtime = Object.fromEntries(names.map(name => [name, {name, state:'running'}]));
            }
            for (const info of Object.values(snapshot.runtime)) {
                info.Image = 'linuxserver/media';
                info.Labels = {'com.docker.compose.project':'Media', project:'Media-stack'};
            }
        };
        if (body.snapshots) for (const type of ['docker', 'vm']) apply(body.snapshots[type], type);
        else apply(body, new URL(route.request().url()).searchParams.get('type') || 'docker');
        await route.fulfill({response, json:body});
    });
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/settings`);
        await page.waitForFunction(() => !document.getElementById('fv-settings-root').classList.contains('fv-settings-bootstrap-pending'));
        await page.locator('[data-mode="advanced"]').click();
        await page.locator('[data-fv-advanced-tab="rules"]').click();
        await page.waitForFunction(() => document.querySelectorAll('#docker-rules [data-fv-rule-id]').length === 6);
        await page.evaluate(() => { document.title = 'FolderView Plus Settings fixture'; });
        await page.evaluate(() => { if (matchMedia('(prefers-color-scheme: light)').matches) document.getElementById('fv-settings-root').dataset.fvThemeClass = 'light'; });
        await run(state);
    } finally {
        await page.unroute('**/server/prefs.php');
        await page.unroute('**/server/runtime_snapshot.php?*');
        await page.unroute('**/server/templates.php?*');
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
};
const waitWrites = async (page, state, count) => {
    await page.waitForFunction(() => !document.querySelector('.fv-rules-workspace:not([hidden]) .rules-add-btn')?.disabled);
    const deadline = Date.now() + 5000;
    while (state.writes.length < count && Date.now() < deadline) await page.waitForTimeout(20);
    assert.equal(state.writes.length, count);
};
export const registerSettingsRulesCases = ({test}) => {
test('Rules workspace creates, edits, filters and reorders through guarded production saves', async ({page}) => {
    await withRulesFixture(page, async state => {
        const panel = page.locator('.fv-rules-workspace[data-fv-rules-type="docker"]');
        const submit = panel.locator('.rules-add-btn');
        assert.deepEqual(await panel.locator('.fv-rules-stat-value').allTextContents(), ['6','5','1','4']);
        assert.equal(await submit.isDisabled(), true);
        await page.locator('#docker-rule-pattern').fill('fixture');
        assert.equal(await page.locator('#docker-rule-live-match').textContent(), 'Matches 12 containers');
        await panel.locator('[data-rule-value="exact"]').click();
        assert.equal(await page.locator('#docker-rule-live-match').textContent(), 'Matches 0 containers');
        await page.locator('#docker-rule-pattern').fill('fixture-app-1');
        assert.equal(await page.locator('#docker-rule-live-match').textContent(), 'Matches 1 containers');
        let release;
        state.delay = new Promise(resolve => {release = resolve;});
        await submit.dblclick();
        assert.equal(await page.locator('#docker-rule-pattern').isDisabled(), true);
        release(); state.delay = null;
        await page.waitForFunction(() => document.getElementById('docker-rule-pattern').value === '');
        assert.equal(state.writes.length, 1, 'repeated submit must create one rule');
        assert.equal(state.saved.docker.autoRules.at(-1).pattern, '^fixture-app-1$');
        const row = id => page.locator(`#docker-rules [data-fv-rule-id="${id}"]`);
        await row('rule-5').locator('[data-rule-menu]').click();
        await page.locator('[data-rule-menu-action="edit"]').click();
        assert.equal(await page.locator('#docker-rule-pattern').inputValue(), 'test-');
        assert.equal(await page.locator('#docker-rule-submit-copy').textContent(), 'Save changes');
        await page.locator('#docker-rule-pattern').fill('vm-');
        await submit.click();
        await page.waitForFunction(() => document.getElementById('docker-rule-editing').value === '');
        assert.equal(state.saved.docker.autoRules[5].id, 'rule-5');
        assert.equal(state.saved.docker.autoRules[5].enabled, false, 'editing must retain status and priority');
        assert.equal(state.saved.docker.autoRules[5].pattern, '^vm-');
        await row('rule-1').locator('[data-rule-drag]').focus();
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(() => document.querySelector('#docker-rules [data-fv-rule-id]').dataset.fvRuleId === 'rule-1');
        const moveDeadline = Date.now() + 5000;
        while (state.saved.docker.autoRules[0].id !== 'rule-1' && Date.now() < moveDeadline) await page.waitForTimeout(20);
        assert.equal(state.saved.docker.autoRules[0].id, 'rule-1');
        await page.waitForFunction(() => document.activeElement?.matches('[data-rule-drag]') && document.activeElement.closest('[data-fv-rule-id]')?.dataset.fvRuleId === 'rule-1');
        assert.equal(await page.evaluate(() => document.activeElement.matches('[data-rule-drag]') && document.activeElement.closest('[data-fv-rule-id]').dataset.fvRuleId === 'rule-1'), true);
        const transfer = await page.evaluateHandle(() => new DataTransfer());
        await row('rule-1').locator('[data-rule-drag]').dispatchEvent('dragstart', {dataTransfer:transfer});
        await row('rule-3').dispatchEvent('drop', {dataTransfer:transfer, clientY:0});
        await page.waitForFunction(() => document.querySelector('#docker-rules [data-fv-rule-id]').dataset.fvRuleId === 'rule-0');
        const dragDeadline = Date.now() + 5000;
        while (state.saved.docker.autoRules.slice(0,4).map(rule => rule.id).join(',') !== 'rule-0,rule-2,rule-1,rule-3' && Date.now() < dragDeadline) await page.waitForTimeout(20);
        assert.deepEqual(state.saved.docker.autoRules.slice(0,4).map(rule => rule.id), ['rule-0','rule-2','rule-1','rule-3']);
        await row('rule-0').locator('input').focus();
        await page.keyboard.press('Space');
        assert.equal(await page.evaluate(() => document.activeElement.matches('input[type="checkbox"]') && document.activeElement.closest('[data-fv-rule-id]').dataset.fvRuleId === 'rule-0'), true);
        assert.equal(await page.locator('#docker-rules-select-all').evaluate(el => el.indeterminate), true);
        await page.locator('#docker-rules-filter').fill('vm-');
        assert.equal(await page.locator('#docker-rules [data-fv-rule-id]').count(), 1);
        await page.locator('#docker-rules-select-all').check();
        assert.equal(await panel.locator('[data-rule-bulk]').first().isEnabled(), true);
        assert.match(await page.locator('#docker-rules-selection-summary').textContent(), /2 selected \(1 shown\)/);
        const downloaded = page.waitForEvent('download');
        await panel.locator('[data-rule-bulk][data-fv-onclick*="export"]').click();
        const exportBody = JSON.parse(await fs.readFile(await (await downloaded).path(), 'utf8'));
        assert.deepEqual(exportBody.rules.map(rule => rule.id), ['rule-0', 'rule-5']);
        await panel.locator('[data-rule-bulk][data-fv-onclick*="disable"]').click();
        await page.waitForFunction(() => !document.querySelector('#docker-rules [data-fv-rule-id="rule-5"] .fv-rule-status.is-active'));
        await page.locator('#docker-rules-filter').fill('');
        await page.waitForFunction(() => !document.querySelector('#docker-rules [data-fv-rule-id="rule-0"] .fv-rule-status.is-active'));
        const bulkDeadline = Date.now() + 5000;
        while (state.saved.docker.autoRules.find(rule => rule.id === 'rule-0').enabled && Date.now() < bulkDeadline) await page.waitForTimeout(20);
        assert.equal(state.saved.docker.autoRules.find(rule => rule.id === 'rule-0').enabled, false);
        await page.locator('.fv-rules-redesign [data-fv-rules-source-toggle="vm"]').click();
        assert.equal(await page.locator('#docker-rule-pattern').isHidden(), true);
        assert.deepEqual(await page.locator('.fv-rules-workspace[data-fv-rules-type="vm"] .fv-rules-stat-value').allTextContents(), ['0','0','0','0']);
        await page.locator('#vm-rule-pattern').fill('fixture');
        assert.equal(await page.locator('#vm-rule-live-match').textContent(), 'Matches 12 VMs');
        await page.locator('.fv-rules-workspace[data-fv-rules-type="vm"] .rules-add-btn').click();
        await page.waitForFunction(() => document.querySelectorAll('#vm-rules [data-fv-rule-id]').length === 1);
        assert.equal(state.saved.vm.autoRules.length, 1);
        assert.equal(state.saved.docker.autoRules.length, 7);
        await page.locator('[data-rule-tester="open"]').click();
        assert.equal(await page.locator('#fv-rules-tester').evaluate(el => el.open), true);
        await page.locator('#vm-rule-test-name').fill('fixture-app-1');
        await page.locator('[data-fv-onclick="testAutoRule(\'vm\')"]').click();
        assert.match(await page.locator('#vm-rule-test-output').textContent(), /Fixture folder 0/);
        await page.locator('[data-rule-tester="close"]').click();
        assert.equal(await page.locator('#fv-rules-tester').evaluate(el => el.open), false);
        await page.reload();
        await page.waitForFunction(() => !document.getElementById('fv-settings-root').classList.contains('fv-settings-bootstrap-pending'));
        assert.equal(await page.locator('#vm-rules [data-fv-rule-id]').count(), 1);
        assert.equal(await page.locator('#docker-rules [data-fv-rule-id]').count(), 7);
        await page.evaluate(() => { document.title = 'FolderView Plus Settings fixture'; });
    });
});
test('Rules workspace respects theme, touch widths, advanced fields and failed saves', async ({page}) => {
    await withRulesFixture(page, async state => {
        const panel = page.locator('.fv-rules-workspace[data-fv-rules-type="docker"]');
        await page.locator('#docker-rule-field').selectOption('label');
        assert.equal(await page.locator('#docker-rule-label-key').isVisible(), true);
        assert.equal(await panel.locator('[data-rule-value="ends_with"]').isDisabled(), true);
        await panel.locator('[data-rule-value="exact"]').click();
        await page.locator('#docker-rule-label-key').fill('project');
        assert.equal(await page.locator('#docker-rule-live-match').textContent(), 'Matches 12 containers');
        await page.locator('#docker-rule-field').selectOption('image');
        await page.locator('#docker-rule-pattern').fill('linuxserver');
        await panel.locator('[data-rule-value="contains"]').click();
        assert.equal(await page.locator('#docker-rule-live-match').textContent(), 'Matches 12 containers');
        await page.locator('#docker-rule-regex').check();
        await page.locator('#docker-rule-pattern').fill('[');
        assert.equal(await panel.locator('.rules-add-btn').isDisabled(), true);
        await page.locator('#docker-rule-pattern').fill('linuxserver/');
        state.fail = true;
        await panel.locator('.rules-add-btn').click();
        await waitWrites(page, state, 1);
        assert.equal(await page.locator('#docker-rule-pattern').inputValue(), 'linuxserver/');
        assert.equal(state.saved.docker.autoRules.length, 6, 'failed saves must retain the draft without changing stored rules');
        await page.locator('.fv-ui-modal-close').click();
        state.fail = false;
        const pendingId = await page.locator('#docker-rule-editing').inputValue();
        assert.ok(pendingId, 'the retained preference queue must retry the original rule ID');
        await panel.locator('.rules-add-btn').click();
        await page.waitForFunction(() => document.getElementById('docker-rule-editing').value === '');
        assert.equal(state.saved.docker.autoRules.length, 7, 'retry must save the pending rule once');
        assert.equal(state.saved.docker.autoRules.at(-1).id, pendingId);
        assert.equal(await page.locator('#docker-rules-save-suggestions').isDisabled(), true);
        await page.locator('[data-fv-onclick="scanSmartRuleSuggestions(\'docker\')"]').click();
        const suggestions = page.locator('#docker-rule-suggestions input');
        assert.ok(await suggestions.count() > 0);
        assert.equal(await page.locator('#docker-rules-save-suggestions').isEnabled(), true);
        for (const checkbox of await suggestions.all()) await checkbox.uncheck();
        assert.equal(await page.locator('#docker-rules-save-suggestions').isDisabled(), true);
        await suggestions.first().check();
        await page.locator('#docker-rules-save-suggestions').click();
        await page.waitForFunction(() => document.querySelectorAll('#docker-rules [data-fv-rule-id]').length === 8);
        assert.equal(state.saved.docker.autoRules.length, 8);
        await page.locator('#docker-rule-regex').uncheck();
        await page.locator('#docker-rule-advanced').evaluate(el => {el.open = false;});
        await page.emulateMedia({reducedMotion:'reduce'});
        for (const width of [1700,1180,390]) {
            await page.setViewportSize({width,height:900});
            const layout = await panel.evaluate(el => {
                const rect = el.getBoundingClientRect();
                return {pageOverflow:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                    outside:[...el.querySelectorAll('.fv-rule-create input:not([type="hidden"]), .fv-rule-create select, .fv-rule-create button')]
                        .filter(el => el.getClientRects().length).some(el => el.getBoundingClientRect().right > rect.right + 1)};
            });
            assert.equal(layout.pageOverflow, false);
            assert.equal(layout.outside, false, 'the builder must stay inside the panel on touch widths');
        }
        await page.setViewportSize({width:1180,height:900});
        await page.locator('#docker-rule-pattern').fill('fixture');
        await page.locator('#docker-rule-field').selectOption('name');
    });
});
};
