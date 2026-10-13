import path from 'node:path';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

export const createHideEmptySettingsHost = async (page, type) => {
    const host = createProductionPerfFixture(path.resolve(process.cwd()), { folders: 0, members: 0 }, 'en');
    const folder = (name, parentId = '', containers = []) => ({ name, parentId, containers,
        icon: '/plugins/folderview.plus/images/folder-icon.png', settings: {}, actions: [] });
    const folders = {
        parent: folder('Populated branch'),
        child: folder('Child branch', 'parent'),
        leaf: folder('Manual leaf', 'child', ['fixture-manual']),
        regex: { ...folder('Regex leaf', 'parent'), regex: '^fixture-regex$' },
        empty: folder('Empty branch'),
        emptyChild: folder('Empty child', 'empty'),
        direct: folder('Direct members', '', ['fixture-direct'])
    };
    const runtime = Object.fromEntries(['fixture-manual', 'fixture-regex', 'fixture-direct'].map((name, index) => [name, {
        name, Name: name, id: String(index + 1).padStart(64, '0'), state: type === 'vm' ? 'running' : 'started',
        running: true, State: { Running: true, Paused: false }, icon: '/plugins/folderview.plus/images/folder-icon.png'
    }]));
    let prefs = { hideEmptyFolders: true, sortMode: 'alpha', setupWizardCompleted: true,
        performanceProfile: 'standard', lazyPreviewEnabled: false, autoRules: [], _metadata: { prefsRevision: 1 } };
    let releaseRuntime;
    const runtimeGate = new Promise(resolve => { releaseRuntime = resolve; });
    const snapshot = (target, configOnly = false) => ({ ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type: target,
        folders: target === type ? folders : {}, runtime: target === type && !configOnly ? runtime : {}, runtimeIncluded: !configOnly, order: [],
        prefs: target === type ? prefs : { setupWizardCompleted: true }, metadata: {}, revision: 'a'.repeat(64) });
    await page.route('**/server/runtime_snapshot.php?**', async route => {
        const url = new URL(route.request().url());
        const target = url.searchParams.get('type');
        const configOnly = url.searchParams.get('mode') === 'config';
        if (!configOnly) await runtimeGate;
        const json = target === 'all'
            ? { ok: true, kind: 'runtime_config_bootstrap', schemaVersion: 1,
                snapshots: { docker: snapshot('docker', true), vm: snapshot('vm', true) } }
            : snapshot(target, configOnly);
        await route.fulfill({ json });
    });
    await page.route('**/server/prefs.php**', async route => {
        const request = route.request();
        const payload = request.method() === 'POST' ? Object.fromEntries(new URLSearchParams(request.postData())) : {};
        if (request.method() === 'POST' && payload.type === type) {
            prefs = { ...prefs, ...JSON.parse(payload.prefs), _metadata: { prefsRevision: prefs._metadata.prefsRevision + 1 } };
        }
        await route.fulfill({ json: { ok: true, prefs, metadata: prefs._metadata, clientMutationId: payload.clientMutationId } });
    });
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        window.display.theme = dark ? 'black' : 'white';
        document.body.style.backgroundColor = dark ? '#1d1d1f' : '#f5f6f8';
        document.body.style.color = dark ? '#eeeeee' : '#2b3441';
    }));
    await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
    return { url: `http://127.0.0.1:${host.server.address().port}/settings`, releaseRuntime,
        prefs: () => prefs, close: async () => {
            releaseRuntime();
            await new Promise(resolve => host.server.close(resolve));
        } };
};
