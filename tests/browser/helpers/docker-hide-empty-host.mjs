import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createDockerConfigFixtureState } from './docker-config-fixture-state.mjs';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';
export const openDockerToolsAfterRefresh = async page => {
    await page.waitForFunction(() => document.querySelector('#fvplus-docker-action-bar')?.getAttribute('aria-busy') === 'false'
        && document.querySelector('[data-fvplus-docker-menu="tools"]')?.disabled === false);
    await page.locator('[data-fvplus-docker-menu="tools"]').focus();
    await page.evaluate(() => { const sync = window.FolderViewPlusDockerRuntimeInternals.renderDockerRuntimeActionBar; sync('host'); sync('folderview'); });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-fvplus-docker-menu')), 'tools', 'background refresh retains the menu trigger focus');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-fvplus-docker-tool') === 'toggle-empty');
    await page.evaluate(() => { const sync = window.FolderViewPlusDockerRuntimeInternals.renderDockerRuntimeActionBar; sync('host'); sync('folderview'); });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-fvplus-docker-tool')), 'toggle-empty', 'open menu keeps its focused item after refresh');
};
export const createDockerHideEmptyHost = async (page, deep = false) => {
    const host = createProductionPerfFixture(path.resolve(process.cwd()), { folders: 0, members: deep ? 2 : 29 });
    const folder = (name, parentId = '', containers = []) => ({ name, parentId, containers,
        icon: '/plugins/folderview.plus/images/folder-icon.png',
        settings: { preview: 1, preview_hover: false, expand_tab: false }, actions: [] });
    const folders = deep ? {
        parent: folder('A populated branch'),
        branch: folder('Intermediate branch', 'parent'),
        leaf: { ...folder('Regex leaf', 'branch'), regex: '^fixture-app-0$' },
        direct: folder('Direct members', '', [host.names[1]]),
        collision: folder('Z claimed elsewhere', '', [host.names[0]]),
        stale: folder('Z missing member', '', ['fixture-unavailable']),
        empty: folder('Empty branch'), emptyChild: folder('Empty child', 'empty')
    } : {
        parent: folder('A populated branch'),
        childA: folder('First child', 'parent', host.names.slice(0, 17)),
        childB: folder('Second child', 'parent', host.names.slice(17, 20)),
        childC: folder('Third child', 'parent', host.names.slice(20)),
        empty: folder('Empty branch'), emptyChild: folder('Empty child', 'empty')
    };
    Object.assign(host.folders, folders);
    const hostScript = fs.readFileSync('tests/browser/fixtures/production-performance-host.js', 'utf8')
        .replace('window.loadlist = () => window.listview();', `const nativeRows = document.getElementById('docker_list').innerHTML;
window.loadlist = () => {
    window.fixtureNativeRefreshCount = (window.fixtureNativeRefreshCount || 0) + 1;
    const list = document.getElementById('docker_list');
    list.innerHTML = nativeRows;
    return window.listview();
};`);
    await page.route('**/fixture-host.js*', route => route.fulfill({ body: hostScript, contentType: 'text/javascript' }));
    const runtime = Object.fromEntries(host.names.map((name, index) => [name, {
        id: (index + 1).toString(16).padStart(12, '0').padEnd(64, '0'), name, Name: name,
        running: true, state: 'started', State: { Running: true, Paused: false }, autostart: false,
        icon: '/plugins/folderview.plus/images/folder-icon.png',
        info: { Name: '/' + name, State: { Running: true }, Config: { Labels: {} }, HostConfig: {} }
    }]));
    const config = createDockerConfigFixtureState({ folders, runtime, names: host.names });
    await page.route('**/server/runtime_snapshot.php?**', route => route.fulfill({ json: config.snapshot() }));
    await page.route('**/server/read.php?**', route => route.fulfill({ json: folders }));
    await page.route('**/server/read_info.php?**', route => route.fulfill({ json: runtime }));
    await page.route('**/server/prefs.php**', async route => {
        const request = route.request(), payload = Object.fromEntries(new URLSearchParams(request.postData() || ''));
        try {
            const response = request.method() === 'POST' ? config.savePrefs(payload)
                : { ok: true, prefs: config.prefs(), metadata: config.metadata() };
            await route.fulfill({ json: response });
        } catch (error) { await route.fulfill({ status: error.status || 500, json: { ok: false, error: error.message } }); }
    });
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        if (!window.display) return;
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        window.display.theme = dark ? 'black' : 'white';
        document.body.style.backgroundColor = dark ? '#1d1d1f' : '#f5f6f8';
        document.body.style.color = dark ? '#eee' : '#2b3441';
    }));
    await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
    return { url: `http://127.0.0.1:${host.server.address().port}/docker`, memberCount: host.names.length,
        populated: deep ? ['parent', 'branch', 'leaf', 'direct'] : ['parent', 'childA', 'childB', 'childC'],
        all: Object.keys(folders), folders, runtime, prefs: config.prefs, revisions: config.revisions, applyBatch: config.applyBatch,
        close: async () => { host.server.closeAllConnections(); await new Promise(resolve => host.server.close(resolve)); } };
};
