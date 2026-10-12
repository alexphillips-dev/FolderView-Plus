import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

export const registerBrowserStorageCases = ({ test }) => {
    for (const surface of ['settings', 'docker', 'vm', 'dashboard']) {
        test('Browser storage restrictions preserve production startup and server saves: ' + surface, async ({ page }) => {
            const root = process.cwd(), plugin = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
            const host = createProductionPerfFixture(root, { folders: 0, members: 0 });
            await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
            const origin = `http://127.0.0.1:${host.server.address().port}`;
            const saves = [];
            let serverPrefs = { setupWizardCompleted: true, dashboard: { names: true }, _metadata: { prefsRevision: 1 } };
            await page.route('**/server/prefs.php**', async route => {
                const payload = Object.fromEntries(new URLSearchParams(route.request().postData() || ''));
                if (route.request().method() === 'POST') {
                    const patch = JSON.parse(payload.prefs);
                    saves.push(patch);
                    serverPrefs = { ...serverPrefs, ...patch, _metadata: { prefsRevision: serverPrefs._metadata.prefsRevision + 1 } };
                }
                await route.fulfill({ json: { ok: true, prefs: serverPrefs, metadata: serverPrefs._metadata, clientMutationId: payload.clientMutationId } });
            });
            if (surface === 'vm' || surface === 'dashboard') {
                const source = fs.readFileSync(path.join(plugin, `folderview.plus.${surface === 'vm' ? 'VMs' : 'Dashboard'}.page`), 'utf8');
                const assets = [...source.matchAll(/fvplus_asset\('([^']+)'\)/g)].map(match => match[1]);
                await page.route(origin + '/' + surface + '?**', route => route.fulfill({ contentType: 'text/html', body:
                    '<!doctype html><html><head><meta name="fv-request-token" content="fixture-request-token-1234567890"></head><body>'
                    + '<div id="docker_view"></div><div id="vm_view"></div><table id="kvm_table"><thead><tr><th>Name</th></tr></thead><tbody id="kvm_list"></tbody></table>'
                    + '<script src="/vendor/jquery.js"></script><script src="/fixture-host.js"></script>'
                    + assets.map(file => file.endsWith('.js') ? `<script src="${file}"></script>` : `<link rel="stylesheet" href="${file}">`).join('')
                    + '</body></html>' }));
            }
            await page.addInitScript(() => {
                const mode = new URL(location.href).searchParams.get('storage');
                Object.defineProperty(window, 'localStorage', { configurable: true, get() {
                    const error = () => { throw new DOMException('Synthetic storage restriction', 'SecurityError'); };
                    if (mode === 'getter') return error();
                    if (mode === 'null') return null;
                    if (mode === 'methods') return { getItem: error, setItem: error, removeItem: error };
                    return { getItem: () => null, removeItem: () => {}, setItem() { throw new DOMException('Synthetic full storage', 'QuotaExceededError'); } };
                } });
            });
            try {
                for (const mode of ['getter', 'null', 'methods', 'quota']) {
                    await page.goto(origin + '/' + surface + '?storage=' + mode, { waitUntil: 'networkidle' });
                    // These hooks are installed near the end of the real entry scripts.
                    await page.waitForFunction(surface => surface === 'settings'
                        ? window.FolderViewPlusSettingsBootstrapState?.ready === true
                        : surface === 'dashboard' ? typeof window.getFolderViewPlusDashboardHostSnapshot === 'function'
                        : typeof window.loadlist_original === 'function', surface);
                    const before = saves.length;
                    const saved = await page.evaluate(async () => {
                        const coordinator = window.FolderViewPlusPrefsStore.getDefaultCoordinator();
                        await coordinator.hydrateFromServer('docker');
                        await coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
                        window.dispatchEvent(new Event('pagehide'));
                        return coordinator.getDiagnostics().types.docker.status;
                    });
                    assert.equal(saved, 'saved', surface + '/' + mode);
                    assert.equal(saves.length, before + 1, 'real request client must POST the preference');
                    assert.equal(serverPrefs.dashboard.names, false);
                    serverPrefs.dashboard.names = true;
                }
            } finally { await new Promise(resolve => host.server.close(resolve)); }
        }, { skipAccessibility: true });
    }
};
