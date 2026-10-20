import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

const require = createRequire(import.meta.url);
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const utils = require(path.join(plugin, 'scripts/folderviewplus.utils.js'));
const store = require(path.join(plugin, 'scripts/folderviewplus.prefs-store.js'));

export const createFilterViewSettingsHost = async page => {
    const host = createProductionPerfFixture(path.resolve('.'), { folders: 1, members: 2 });
    host.folders.empty = { name: 'Empty fixture', containers: [], settings: {}, actions: [] };
    const prefs = Object.fromEntries(['docker', 'vm'].map(type => [type, utils.normalizePrefs({
        setupWizardCompleted: true, _metadata: { prefsRevision: 1 }
    })]));
    const runtime = Object.fromEntries(['docker', 'vm'].map(type => [type, Object.fromEntries(host.names.map((name, index) => [name, {
        name, Name: name, uuid: `fixture-vm-${index}`, id: (index + 1).toString(16).padStart(12, '0').padEnd(64, '0'),
        running: index === 0, state: index === 0 ? (type === 'vm' ? 'running' : 'started') : (type === 'vm' ? 'shutoff' : 'stopped'),
        State: { Running: index === 0, Paused: false }, info: { State: { Running: index === 0 }, Config: { Labels: {} }, HostConfig: {} },
        vcpus: 4, memoryKiB: 4 * 1024 * 1024, autostart: false, icon: '/plugins/folderview.plus/images/folder-icon.png'
    }]))]));
    const snapshot = type => ({ ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type,
        folders: host.folders, runtime: runtime[type], runtimeIncluded: true,
        order: Object.keys(host.folders).map(id => 'folder-' + id).concat(host.names), unraidOrder: host.names,
        prefs: prefs[type], metadata: prefs[type]._metadata, revision: 'a'.repeat(64) });
    await page.route('**/server/runtime_snapshot.php?**', route => {
        const type = new URL(route.request().url()).searchParams.get('type');
        return route.fulfill({ json: type === 'all'
            ? { ok: true, kind: 'runtime_config_bootstrap', schemaVersion: 1, snapshots: { docker: snapshot('docker'), vm: snapshot('vm') } }
            : snapshot(type) });
    });
    await page.route('**/server/prefs.php**', route => {
        const request = route.request(), payload = Object.fromEntries(new URLSearchParams(request.postData() || ''));
        const type = payload.type || new URL(request.url()).searchParams.get('type') || 'docker';
        if (request.method() === 'POST') {
            prefs[type] = utils.normalizePrefs(store.mergePatch(prefs[type], JSON.parse(payload.prefs)));
            prefs[type]._metadata.prefsRevision++;
        }
        return route.fulfill({ json: { ok: true, prefs: prefs[type], metadata: prefs[type]._metadata, clientMutationId: payload.clientMutationId } });
    });
    await page.route('**/server/backup.php?**', route => route.fulfill({ json: { ok: true, backups: [] } }));
    await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
    return { url: `http://127.0.0.1:${host.server.address().port}/settings`, folders: host.folders, runtime, names: host.names,
        prefs: type => prefs[type],
        close: async () => { host.server.closeAllConnections(); await new Promise(resolve => host.server.close(resolve)); } };
};

// Execute the shipped VM page with synthetic native rows and the native AJAX lifecycle.
export const mountFilterViewVmHost = async (page, host) => {
    const prefix = '/plugins/folderview.plus/';
    const script = file => `<script src="${file}"></script>`;
    const source = fs.readFileSync(path.join(plugin, 'folderview.plus.VMs.page'), 'utf8');
    const body = source.slice(source.indexOf('---') + 3).replace(/<\?(?:php|=)[\s\S]*?\?>/g, php => {
        const asset = php.match(/fvplus_asset\('([^']+)'\)/);
        return asset ? asset[1] : '';
    });
    const langs = fs.readFileSync(path.join(plugin, 'langs/script.php'), 'utf8');
    const langScripts = [...langs.matchAll(/<script[^>]*src="[^"\n]*?fvplus_asset\('([^']+)'\)[^"\n]*"[^>]*><\/script>/g)].map(m => script(m[1])).join('');
    const rows = host.names.map((name, index) => `<tr class="sortable" id="fixture-vm-${index}"><td class="vm-name"><span class="outer"><span class="hand"><img class="img" src="${prefix}images/folder-icon.png"></span><span class="inner"><a>${name}</a><i class="fa fa-play started"></i><span class="state">running</span></span></span></td><td>Linux</td><td>4 vCPU</td><td>4 GB</td><td><input class="autostart" type="checkbox"></td></tr>`).join('');
    const native = `<table id="kvm_table"><thead><tr><th>Name</th><th>OS</th><th>CPU</th><th>RAM</th><th>Autostart</th></tr></thead><tbody id="kvm_list">${rows}</tbody></table>`;
    const config = { requestedLocale: 'en', resolvedLocale: 'en', direction: 'ltr', namespaces: ['common', 'legacy-surface', 'vm', 'diagnostics'], assets: [
        { locale: 'en', namespace: 'legacy', url: prefix + 'langs/en.json' },
        ...['common', 'legacy-surface', 'diagnostics'].map(namespace => ({ locale: 'en', namespace, url: prefix + `langs/namespaces/en/${namespace}.json` }))
    ] };
    const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="fv-request-token" content="fixture-request-token-1234567890">'
        + `<meta name="fvplus-i18n-config" content='${JSON.stringify(config)}'><meta name="fvplus-page-i18n" content='{"mode":"vms"}'>`
        + '</head><body>' + native + script('/vendor/jquery.js') + script('/fixture-host.js') + langScripts
        + ['runtime.image-fallbacks', 'folderviewplus.csp-events', 'folderviewplus.safe-dom'].map(file => script(prefix + 'scripts/' + file + '.js')).join('') + body + '</body></html>';
    await page.route('**/audit-vm', route => route.fulfill({ contentType: 'text/html', body: html }));
    const hostSource = fs.readFileSync('tests/browser/fixtures/production-performance-host.js', 'utf8')
        .replace('window.loadlist = () => window.listview();', `const nativeRows = document.getElementById('kvm_list').innerHTML;
window.fixtureNativeRefreshCount = 0;
window.loadlist = () => {
    window.fixtureNativeRefreshCount++;
    return window.jQuery.get('/plugins/dynamix.vm.manager/include/VMMachines.php').done(() => {
        document.getElementById('kvm_list').innerHTML = nativeRows;
    });
};`)
        + '\ndocument.addEventListener("DOMContentLoaded", () => window.loadlist());';
    await page.route('**/fixture-host.js*', route => route.fulfill({ contentType: 'text/javascript', body: hostSource }));
    await page.route('**/plugins/dynamix.vm.manager/include/VMMachines.php*', route => route.fulfill({ contentType: 'text/html', body: rows }));
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
    await page.route('**/server/read.php?**', route => route.fulfill({ json: host.folders }));
    await page.route('**/server/read_info.php?**', route => route.fulfill({ json: host.runtime.vm }));
    await page.route('**/server/reconcile_member_identities.php', route => route.fulfill({ json: { ok: true, result: { updatedCount: 0 } } }));
    await page.goto(new URL('/audit-vm', host.url).href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('tr.folder-id-fixture-folder-0'));
};
