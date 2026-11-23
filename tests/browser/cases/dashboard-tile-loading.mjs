import assert from 'node:assert/strict';

const installDashboardLoadingFixture = async (page, baseUrl) => {
    const types = ['docker', 'vm'];
    const idFor = (type) => type === 'vm' ? 'vm_view' : 'docker_view';
    const nameFor = (type) => `fixture-${type}`;
    const makeFolder = (type, revision) => ({
        id: `${type}-group`,
        name: `${type} folder ${revision}`,
        containers: [nameFor(type)],
        settings: { expand_dashboard: true },
        actions: []
    });
    const pageMarkup = await page.request.get(`${baseUrl}/plugin/folderview.plus.Dashboard.page`);
    assert.ok(pageMarkup.ok());
    const assetTags = Array.from((await pageMarkup.text()).matchAll(/fvplus_asset\('\/plugins\/folderview\.plus\/([^']+)'\)/g), ([, asset]) => (
        asset.endsWith('.js')
            ? `<script src="/plugin/${asset}"></script>`
            : `<link rel="stylesheet" href="/plugin/${asset}">`
    )).join('');
    const nativeRows = types.map((type) => `<tr class="updated"><td><span class="outer ${type === 'vm' ? 'vms' : 'apps'} started"><span class="inner">${nameFor(type)}</span></span></td></tr>`);
    await page.route('**/webGui/include/DashboardApps.php', (route) => route.fulfill({
        contentType: 'text/plain', body: nativeRows.join('\0')
    }));
    await page.route('**/graphql', (route) => route.fulfill({ json: { data: {} } }));
    const pending = { docker: [], vm: [] };
    await page.route('**/plugins/folderview.plus/server/**', async (route) => {
        const url = new URL(route.request().url());
        const type = url.searchParams.get('type');
        if (url.pathname.endsWith('/runtime_snapshot.php') && url.searchParams.get('mode') === 'full') {
            const reply = await new Promise((resolve) => pending[type].push(resolve));
            await route.fulfill({ json: reply });
            return;
        }
        if (url.pathname.endsWith('/read.php')) {
            await route.fulfill({ contentType: 'text/html', body: '<p>Fixture invalid folder reply</p>' });
            return;
        }
        if (url.pathname.endsWith('/cpu.php')) {
            await route.fulfill({ contentType: 'text/plain', body: '2' });
            return;
        }
        await route.fulfill({ json: {} });
    });
    const fixtureUrl = `${baseUrl}/dashboard-widget-loading`;
    await page.route(fixtureUrl, (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard loading fixture</title>
        <style>body{font:16px Arial;color:#eee;background:#181818}table{width:100%;table-layout:fixed}main{max-width:980px}.folder-showcase-outer img{max-width:44px}</style></head><body><main><h1>Dashboard</h1>
        <div class="spinner fixed" aria-label="Loading Dashboard">Loading</div>
        ${types.map((type) => `<section aria-label="${type === 'vm' ? 'VM' : 'Docker'} overview"><table><tbody id="${idFor(type)}"><tr><th scope="col">${type === 'vm' ? 'VMs' : 'Docker'}</th></tr></tbody></table></section>`).join('')}
        </main><script src="/vendor/jquery.js"></script><script>
        $.i18n = key => key;
        window.loadlist = () => $.post('/webGui/include/DashboardApps.php', { docker: '1', vms: '1' }, (text) => {
            const [docker, vm] = text.split(String.fromCharCode(0));
            for (const [id, rows] of [['docker_view', docker], ['vm_view', vm]]) {
                $('#' + id).children('tr.updated').remove();
                $('#' + id).append(rows);
            }
        });
        </script>${assetTags}</body></html>`
    }));
    await page.goto(fixtureUrl);
    const load = async () => {
        const seen = types.map((type) => page.waitForRequest((request) => request.url().includes('runtime_snapshot.php') && new URL(request.url()).searchParams.get('type') === type));
        await page.evaluate(() => { window.loadlist(); });
        await Promise.all(seen);
        await page.waitForFunction(() => {
            const widgets = window.getFolderViewPlusDashboardHostSnapshot?.().widgetRenderStates;
            return widgets?.docker === 'pending' && widgets?.vm === 'pending';
        });
    };
    const settle = (type, index, revision, failed = false) => {
        const folder = makeFolder(type, revision);
        const name = nameFor(type);
        const runtime = type === 'vm'
            ? { [name]: { name, uuid: 'fixture-uuid', state: 'running', autostart: true } }
            : { [name]: { shortId: 'abc123def456', info: { Name: name, State: { Running: true, Paused: false, Autostart: true, manager: 'dockerman' } } } };
        assert.equal(typeof pending[type][index], 'function');
        pending[type][index](failed ? { ok: false } : {
            ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type,
            folders: { [folder.id]: folder }, order: [`folder-${folder.id}`],
            runtime, unraidOrder: [name], prefs: { dashboard: { layout: 'fullwidth' } },
            revisions: { folder: revision, prefs: revision }, metadata: { prefsRevision: revision }
        });
    };
    const widget = (type) => page.locator(`#${idFor(type)}`);
    const waitForState = (type, state) => page.waitForFunction(({ type, state }) => (
        window.getFolderViewPlusDashboardHostSnapshot()?.widgetRenderStates[type] === state
    ), { type, state });
    return { load, settle, widget, waitForState };
};

const checkIndependentTile = async (page, baseUrl, readyType) => {
    const fixture = await installDashboardLoadingFixture(page, baseUrl);
    const sibling = readyType === 'docker' ? 'vm' : 'docker';
    await fixture.load();
    assert.equal(await page.locator('.spinner.fixed').isVisible(), false);
    assert.equal(await fixture.widget(sibling).locator('.fv-runtime-loading-row').count(), 1);
    fixture.settle(readyType, 0, 1);
    await fixture.waitForState(readyType, 'ready');
    const ready = fixture.widget(readyType);
    assert.equal(await ready.getByText(`${readyType} folder 1`, { exact: true }).isVisible(), true);
    await ready.and(page.locator('.fv-dashboard-layout-fullwidth')).waitFor();
    const toggle = ready.locator('[data-fv-dashboard-folder-toggle]').first();
    await toggle.focus();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    fixture.settle(sibling, 0, 1, true);
    await fixture.waitForState(sibling, 'failed');
    assert.equal(await fixture.widget(sibling).locator('.fv-runtime-loading-row').count(), 0);
    assert.equal(await fixture.widget(sibling).getByText('Some folders could not be displayed.').isVisible(), true);
    assert.equal(await fixture.widget(sibling).getByText(`fixture-${sibling}`, { exact: true }).isVisible(), true);
    assert.equal(await toggle.evaluate((node) => document.activeElement === node), true);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
};

export const registerDashboardTileLoadingFixtureCases = ({ test, baseUrl }) => {
    test('Dashboard lifecycle renders docker full-width folders while the other tile is delayed', ({ page }) => checkIndependentTile(page, baseUrl, 'docker'));
    test('Dashboard lifecycle renders vm full-width folders while the other tile is delayed', ({ page }) => checkIndependentTile(page, baseUrl, 'vm'));
    test('Dashboard lifecycle ignores old widget data after a newer native refresh', async ({ page }) => {
        const fixture = await installDashboardLoadingFixture(page, baseUrl);
        await fixture.load();
        fixture.settle('docker', 0, 1);
        await fixture.waitForState('docker', 'ready');
        await fixture.load();
        fixture.settle('vm', 1, 2);
        fixture.settle('docker', 1, 2);
        await fixture.waitForState('vm', 'ready');
        await fixture.waitForState('docker', 'ready');
        const staleReply = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.pathname.endsWith('/runtime_snapshot.php') && url.searchParams.get('type') === 'vm';
        });
        fixture.settle('vm', 0, 1);
        await staleReply;
        assert.equal(await fixture.widget('vm').locator('.folder-showcase-outer').count(), 1);
        assert.equal(await fixture.widget('vm').getByText('vm folder 2', { exact: true }).isVisible(), true);
        assert.equal(await fixture.widget('vm').getByText('vm folder 1', { exact: true }).count(), 0);
    });
};
