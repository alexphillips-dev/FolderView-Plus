import assert from 'node:assert/strict';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

export const withRulesFixture = async (page, run) => {
    const {server, folders, names} = createProductionPerfFixture(process.cwd(), {members:12, folders:4, nestedFolders:0});
    const initial = ['fixture', 'media', 'db', 'dev', 'project', '^test-'].map((pattern, index) => ({
        id:`rule-${index}`, folderId:`fixture-folder-${index % 4}`, enabled:index !== 5,
        effect:index === 4 ? 'exclude' : 'include', kind:'name_regex', pattern, labelKey:'', labelValue:''
    }));
    const state = {saved:{docker:{autoRules:initial}, vm:{autoRules:[]}}, revisions:{docker:1, vm:1}, writes:[], predicateChecks:[], fail:false, delay:null};
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
    await page.route('**/server/rule_preview.php', route => {
        const payload = new URLSearchParams(route.request().postData() || '');
        if (payload.get('action') !== 'validate_predicate') return route.fallback();
        state.predicateChecks.push(payload);
        const valid = payload.get('pattern') !== '(?<=fixture-.*)app-0';
        return route.fulfill({json:{ok:true, valid}});
    });
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
        await page.unrouteAll({behavior:'wait'});
        page.once('close', () => {
            server.closeAllConnections();
            server.close();
        });
    }
};
