import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dockerEditor = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-docker.js');
const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const nonce = 'a'.repeat(64);
const endpoint = '/plugins/folderview.plus/server/upload_custom_icon.php';

function load({ csrf = 'fixture-unraid-token', token = 'fixture-plugin-token', beacon = true, result = 'ok' } = {}) {
    const ajax = [], beacons = [], fetches = [], uploads = [], prefilters = [];
    class Xhr {
        headers = {};
        listeners = {};
        upload = { addEventListener: (name, fn) => { this.listeners[name] = fn; }, removeEventListener() {} };
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(key, value) { this.headers[key] = value; }
        getResponseHeader() { return 'application/json'; }
        send(body) {
            this.body = body; uploads.push(this);
            this.listeners.progress?.({ lengthComputable: true, loaded: 3, total: 7 });
            queueMicrotask(() => {
                if (this.aborted || result === 'pending') return;
                if (result === 'timeout') { this.ontimeout(); return; }
                if (result === 'network') { this.onerror(); return; }
                this.status = result === 'forbidden' ? 403 : result === 'no-file' ? 400 : 200;
                this.responseText = result === 'forbidden' ? '{"error":"wrong csrf_token"}'
                    : result === 'no-file' ? '{"error":"No icon file uploaded."}'
                        : result === 'empty' ? '' : '{"ok":true,"url":"/fixture.png"}';
                this.onload();
            });
        }
        abort() { this.aborted = true; this.onabort?.(); }
    }
    const context = {
        URL, URLSearchParams, FormData, File, console, setTimeout, clearTimeout,
        FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,Zml4dHVyZQ=='; queueMicrotask(() => this.onload()); } },
        navigator: { sendBeacon: (url, body) => { beacons.push({ url, body }); if (beacon === 'throw') throw Error('fixture'); return beacon; } },
        document: { querySelector: () => token ? { content: token } : null },
        window: {
            csrf_token: csrf, location: { origin: 'http://fixture.test' }, XMLHttpRequest: Xhr,
            fetch: async (url, options) => { fetches.push({ url, ...options }); return { ok: true, status: 200 }; }
        }
    };
    context.window.$ = {
        ajaxPrefilter: fn => prefilters.push(fn),
        ajax(options) {
            ajax.push(options);
            const request = { done(fn) { queueMicrotask(() => fn({ ok: true, nonce, url: '/fixture.png' }, 'success', { status: 200 })); return request; }, fail() { return request; }, abort() {} };
            return request;
        }
    };
    vm.createContext(context);
    for (const name of ['request-diagnostics', 'request-transport', 'request']) {
        const file = `${root}folderviewplus.${name}.js`;
        vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    }
    return { api: context.window.FolderViewPlusRequest, context, ajax, beacons, fetches, uploads, prefilters };
}

test('beacon includes the current Unraid token and plugin nonce without duplicate token fields', () => {
    for (const kind of ['object', 'params', 'form']) {
        const h = load();
        const data = kind === 'object' ? { type: 'docker', csrf_token: 'stale' }
            : kind === 'params' ? new URLSearchParams('type=docker&csrf_token=stale&csrf_token=duplicate') : new FormData();
        if (kind === 'form') { data.append('type', 'docker'); data.append('csrf_token', 'stale'); }
        assert.equal(h.api.sendKeepalive('/plugins/folderview.plus/server/sync_order.php', data, { nonce }), true);
        const body = h.beacons[0].body;
        assert.deepEqual(body.getAll('csrf_token'), ['fixture-unraid-token']);
        assert.equal(body.get('token'), 'fixture-plugin-token');
        assert.equal(body.get('_fv_request'), '1');
        assert.equal(body.get('_fv_nonce'), nonce);
        assert.match(body.get('_fv_transaction'), /^tx-/);
        assert.equal(h.api.diagnostics()[0].outcome, 'queued');
    }
});

test('beacon rejection or exception uses one authenticated fetch fallback', async () => {
    for (const beacon of [false, 'throw']) {
        const h = load({ beacon });
        assert.equal(h.api.sendKeepalive('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' }, { nonce }), true);
        await Promise.resolve();
        assert.equal(h.beacons.length, 1);
        assert.equal(h.fetches.length, 1);
        const request = h.fetches[0];
        assert.equal(request.headers['X-CSRF-Token'], 'fixture-unraid-token');
        assert.equal(request.headers['X-FV-Token'], 'fixture-plugin-token');
        assert.equal(request.headers['X-FV-Nonce'], nonce);
        assert.equal(request.credentials, 'same-origin');
        assert.equal(request.keepalive, true);
        assert.equal(request.body.get('_fv_nonce'), nonce);
    }
});

test('missing CSRF, missing plugin token, missing nonce and foreign URLs never queue a mutation', () => {
    for (const [options, url, credentials] of [
        [{ csrf: '' }, endpoint, { nonce }], [{ token: '' }, endpoint, { nonce }],
        [{}, endpoint, {}], [{}, 'https://foreign.test' + endpoint, { nonce }],
        [{}, '//foreign.test' + endpoint, { nonce }], [{}, 'http://user:pass@fixture.test' + endpoint, { nonce }]
    ]) {
        const h = load(options);
        assert.equal(h.api.sendKeepalive(url, {}, credentials), false);
        assert.equal(h.beacons.length + h.fetches.length, 0);
        assert.doesNotMatch(JSON.stringify(h.api.diagnostics()), /fixture-unraid-token|fixture-plugin-token|user:pass|foreign/);
    }
});

test('multipart upload uses native XHR, preserves the file, nonce and progress, and avoids jQuery', async () => {
    const h = load();
    const file = new Blob(['file-content']);
    const body = new FormData(); body.append('action', 'upload'); body.append('icon', file, 'fixture.png');
    const progress = [];
    const result = await h.api.uploadJson(endpoint, body, { onProgress: (loaded, total) => progress.push([loaded, total]) });
    assert.equal(result.ok, true);
    assert.equal(h.ajax.length, 1, 'only nonce acquisition uses jQuery');
    const xhr = h.uploads[0];
    assert.equal(xhr.body, body);
    assert.equal(await body.get('icon').text(), 'file-content');
    assert.equal(xhr.headers['X-CSRF-Token'], 'fixture-unraid-token');
    assert.equal(body.get('csrf_token'), 'fixture-unraid-token', 'Unraid 7.0 requires the POST field');
    assert.equal(xhr.headers['X-FV-Nonce'], nonce);
    assert.equal(body.get('_fv_nonce'), nonce);
    assert.equal(body.get('token'), 'fixture-plugin-token');
    assert.equal(Object.keys(xhr.headers).some(key => key.toLowerCase() === 'content-type'), false);
    assert.deepEqual(progress, [[3, 7]]);
});

test('an upload cancelled as its XHR handle is provided sends no body', async () => {
    const h = load();
    const body = new FormData(); body.append('action', 'upload');
    await assert.rejects(h.api.uploadJson(endpoint, body, { onRequest: xhr => xhr.abort() }), error => error.reasonCode === 'aborted');
    assert.equal(h.uploads.length, 0);
});

test('multipart HTTP, timeout, network and cancellation failures retain diagnostics without replay', async () => {
    for (const [result, reason] of [['forbidden', 'csrf-invalid'], ['timeout', 'timeout'], ['network', 'http-error'], ['pending', 'aborted']]) {
        const h = load({ result });
        const body = new FormData(); body.append('action', 'upload');
        let active;
        const promise = h.api.uploadJson(endpoint, body, { onRequest: xhr => { active = xhr; if (result === 'pending') queueMicrotask(() => xhr.abort()); } });
        await assert.rejects(promise, error => error.reasonCode === reason);
        assert.ok(active);
        assert.equal(h.uploads.length, 1);
        assert.equal(h.ajax.length, 1);
        assert.doesNotMatch(JSON.stringify(h.api.diagnostics()), /fixture-unraid-token|fixture-plugin-token/);
    }
});

test('missing CSRF blocks POST before nonce bootstrap and leaves GET requests available', async () => {
    const h = load({ csrf: '' });
    await assert.rejects(h.api.postJson(endpoint, {}), error => error.reasonCode === 'csrf-missing');
    assert.equal(h.ajax.length, 0);
    await h.api.getJson(endpoint);
    assert.equal(h.ajax.length, 1);
    assert.equal(h.ajax[0].headers['X-CSRF-Token'], undefined);
});

test('foreign plugin-shaped URLs receive neither prefilter credentials nor request credentials', async () => {
    const h = load();
    const foreign = 'https://foreign.test' + endpoint;
    const options = { url: foreign, headers: {} };
    h.prefilters[0](options);
    assert.deepEqual(options.headers, {});
    await assert.rejects(h.api.postJson(foreign, {}), error => error.reasonCode === 'origin-mismatch');
    await assert.rejects(h.api.getJson(foreign));
    assert.equal(h.ajax.length, 0);
});

test('Docker editor awaits one nonce-protected synchronization and propagates failure', async () => {
    let complete;
    const calls = [];
    const api = dockerEditor.createApi({
        queueBackgroundMutationPost: () => { throw Error('must not use an unconfirmed beacon'); },
        securePost: (url, body) => { calls.push({ url, body }); return new Promise(resolve => { complete = resolve; }); }
    });
    let finished = false;
    const save = api.flushPostSaveSync({ force: true }).then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(finished, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/plugins/folderview.plus/server/sync_order.php');
    complete({ ok: true }); await save;
    const failing = dockerEditor.createApi({ securePost: async () => { throw Error('sync rejected'); } });
    await assert.rejects(failing.flushPostSaveSync({ force: true }), /sync rejected/);
    await api.flushPostSaveSync({ folderId: 'same', folder: { name: 'same' }, previousFolder: { name: 'same' } });
    assert.equal(calls.length, 1, 'unchanged appearance saves do not resynchronize');
});

test('inline upload fallback only follows an explicit no-file refusal, never ambiguous success or timeout', async () => {
    for (const result of ['no-file', 'empty', 'timeout', 'forbidden', 'pending']) {
        const h = load({ result });
        vm.runInContext(fs.readFileSync(root + 'folder.editor.icon-api.js', 'utf8'), h.context);
        const iconApi = h.context.FolderViewPlusFolderIconApi.createApi({ window: h.context.window, requestClient: h.api,
            iconUploadApiPath: endpoint, allowedExtensions: ['png'] });
        const file = new File(['fixture'], 'fixture.png', { type: 'image/png' });
        const upload = iconApi.uploadCustomIconFile(file, { setActiveRequest: xhr => { if (xhr && result === 'pending') queueMicrotask(() => xhr.abort()); } });
        if (result === 'no-file') {
            assert.equal((await upload).url, '/fixture.png');
            assert.equal(h.ajax.length, 3, 'each transport gets its own nonce and the fallback uses a plain POST');
            assert.equal(h.ajax[2].data.icon_inline_name, 'fixture.png');
            assert.equal(h.ajax[2].headers['X-CSRF-Token'], 'fixture-unraid-token');
        } else { await assert.rejects(upload); assert.equal(h.ajax.length, 1, 'uncertain or denied uploads must not be replayed'); }
        assert.equal(h.uploads.length, 1);
    }
});
