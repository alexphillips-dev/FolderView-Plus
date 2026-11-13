import path from 'node:path';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

export const waitForSettingsRuntimeHydration = async page => {
    await page.waitForFunction(() => window.FolderViewPlusSettingsBootstrapState?.ready === true
        && window.FolderViewPlusSettingsBootstrapState.failed !== true
        && typeof window.FolderViewPlusSettingsRuntimeHydrationPromise?.then === 'function', undefined, { timeout: 10000 });
    await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
};

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
        if (location.pathname !== '/settings') return;
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        window.display.theme = dark ? 'black' : 'white';
        document.body.style.backgroundColor = dark ? '#1d1d1f' : '#f5f6f8';
        document.body.style.color = dark ? '#eeeeee' : '#2b3441';
    }));
    await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${host.server.address().port}/settings`;
    return { url, releaseRuntime,
        prefs: () => prefs, close: async () => {
            releaseRuntime();
            try {
                if (!page.isClosed() && page.url().startsWith(url)) {
                    await waitForSettingsRuntimeHydration(page);
                    await page.waitForLoadState('networkidle', { timeout: 10000 });
                }
            } finally {
                try {
                    if (!page.isClosed()) await page.goto('about:blank', { timeout: 5000 });
                } finally {
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            host.server.closeAllConnections();
                            reject(new Error('Settings fixture server did not close after page exit'));
                        }, 5000);
                        host.server.close(error => {
                            clearTimeout(timeout);
                            if (error) reject(error); else resolve();
                        });
                    });
                }
            }
        } };
};
