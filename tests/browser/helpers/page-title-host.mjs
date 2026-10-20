import path from 'node:path';
import { createRequire } from 'node:module';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';
const require = createRequire(import.meta.url);
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const utils = require(path.join(plugin, 'folderviewplus.utils.js'));
const store = require(path.join(plugin, 'folderviewplus.prefs-store.js'));

export const createPageTitleHost = async (page, nativeToolbar = true) => {
    const host = createProductionPerfFixture(path.resolve('.'), { folders: 2, members: 4 });
    let prefs = utils.normalizePrefs({ setupWizardCompleted: true, _metadata: { prefsRevision: 1 } });
    const snapshot = type => ({ ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type,
        folders: type === 'docker' ? host.folders : {}, runtime: type === 'docker' ? host.runtime : {}, runtimeIncluded: true,
        order: [], prefs: type === 'docker' ? prefs : utils.normalizePrefs({ setupWizardCompleted: true }), metadata: {}, revision: 'a'.repeat(64) });
    await page.route('**/server/runtime_snapshot.php?**', route => {
        const type = new URL(route.request().url()).searchParams.get('type');
        return route.fulfill({ json: type === 'all' ? { ok: true, kind: 'runtime_config_bootstrap', schemaVersion: 1, snapshots: { docker: snapshot('docker'), vm: snapshot('vm') } } : snapshot(type) });
    });
    await page.route('**/server/prefs.php**', async route => {
        const request = route.request();
        const payload = Object.fromEntries(new URLSearchParams(request.postData() || ''));
        if (request.method() === 'POST' && payload.type === 'docker') {
            prefs = utils.normalizePrefs(store.mergePatch(prefs, JSON.parse(payload.prefs)));
            prefs._metadata.prefsRevision++;
        }
        await route.fulfill({ json: { ok: true, prefs, metadata: prefs._metadata, clientMutationId: payload.clientMutationId } });
    });
    await page.addInitScript(nativeToolbar => document.addEventListener('DOMContentLoaded', () => {
        if (!window.display) return;
        // Native control typography: unraid/webgui's dynamix/styles/default-base.css.
        const typography = document.createElement('style');
        typography.textContent = 'input[type="text"]{font-family:inherit;font-size:13px}button{font-family:inherit;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}';
        document.head.prepend(typography);
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        window.display.theme = dark ? 'black' : 'white';
        document.body.style.backgroundColor = dark ? '#1d1d1f' : '#f5f6f8';
        document.body.style.color = dark ? '#eeeeee' : '#2b3441';
        const table = document.getElementById('docker_containers');
        if (!table || !nativeToolbar) return;
        const native = document.createElement('div');
        native.className = 'ToggleViewMode'; native.style.cssText = 'display:flex;justify-content:flex-end;align-items:center;gap:.5rem;margin-bottom:1rem';
        native.innerHTML = '<label id="fixture-basic"><input type="checkbox">Basic view</label><button id="fixture-menu" type="button">Menu</button>';
        table.before(native);
    }), nativeToolbar);
    await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${host.server.address().port}`;
    return { baseUrl, prefs: () => prefs, close: async () => { host.server.closeAllConnections(); await new Promise(resolve => host.server.close(resolve)); } };
};
