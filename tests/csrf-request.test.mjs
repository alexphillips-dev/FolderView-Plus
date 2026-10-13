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

function load({ csrf = 'fixture-unraid-token', token = 'fixture-plugin-token', beacon = true, result = 'ok', reading = false, noncePending = false, failChunk = null } = {}) {
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
        URL, URLSearchParams, FormData, File, AbortController, console, setTimeout, clearTimeout,
        FileReader: class {
            readAsDataURL(file) {
                if (reading) return;
                file.arrayBuffer().then(bytes => {
                    if (this.aborted) return;
                    this.result = 'data:image/png;base64,' + Buffer.from(bytes).toString('base64');
                    this.onload?.();
                });
            }
            abort() { this.aborted = true; this.onabort?.(); }
        },
        navigator: { sendBeacon: (url, body) => { beacons.push({ url, body }); if (beacon === 'throw') throw Error('fixture'); return beacon; } },
        document: { querySelector: () => token ? { content: token } : null },
        window: {
            csrf_token: csrf, crypto: globalThis.crypto, location: { origin: 'http://fixture.test' }, XMLHttpRequest: Xhr,
            fetch: async (url, options) => { fetches.push({ url, ...options }); return { ok: true, status: 200 }; }
        }
    };
    context.window.$ = {
        ajaxPrefilter: fn => prefilters.push(fn),
        ajax(options) {
            ajax.push(options);
            const isNonce = options.url.endsWith('/security.php');
            const requestResult = !isNonce && failChunk !== null && Number(options.data?.icon_chunk_index) !== failChunk ? 'ok' : result;
            let done, fail, completed = false, failure = '';
            const response = { status: 200, responseText: '{"ok":true,"url":"/fixture.png"}' };
            const notify = () => {
                if (!completed) return;
                if (failure) fail?.(response, failure, '');
                else done?.(isNonce ? { ok: true, nonce } : requestResult === 'empty' ? ''
                    : options.data?.icon_upload_id && Number(options.data.icon_chunk_index) < Number(options.data.icon_chunk_count) - 1
                        ? { ok: true, chunkAccepted: true, nextChunk: Number(options.data.icon_chunk_index) + 1 }
                        : { ok: true, url: '/fixture.png' }, 'success', response);
            };
            const request = {
                done(fn) { done = fn; return request; },
                fail(fn) { fail = fn; if (completed) queueMicrotask(notify); return request; },
                abort() { if (!completed) { completed = true; failure = 'abort'; response.status = 0; queueMicrotask(notify); } }
            };
            const native = options.xhr?.();
            queueMicrotask(() => {
                if (completed || (isNonce && noncePending) || (!isNonce && requestResult === 'pending')) return;
                native?.listeners.progress?.({ lengthComputable: true, loaded: 3, total: 7 });
                completed = true;
                if (!isNonce && requestResult === 'timeout') { failure = 'timeout'; response.status = 0; }
                if (!isNonce && requestResult === 'network') { failure = 'error'; response.status = 0; }
                if (!isNonce && requestResult === 'forbidden') { failure = 'error'; response.status = 403; response.responseJSON = { error: 'wrong csrf_token' }; }
                notify();
            });
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

function iconApiFor(h) {
    vm.runInContext(fs.readFileSync(root + 'folder.editor.icon-api.js', 'utf8'), h.context);
    return h.context.FolderViewPlusFolderIconApi.createApi({ window: h.context.window, requestClient: h.api,
        iconUploadApiPath: endpoint, allowedExtensions: ['png'] });
}

test('custom icons use one form upload with URL-safe bytes, security markers, options and file-size progress', async () => {
    const h = load();
    const api = iconApiFor(h);
    const bytes = Buffer.alloc(22528, 255);
    const file = new File([bytes], 'fixture.png', { type: 'image/png' });
    const progress = [], handles = [];
    assert.equal((await api.uploadCustomIconFile(file, { replace: true, dedupe: false,
        onProgress: (loaded, total) => progress.push([loaded, total]), setActiveRequest: handle => handles.push(handle) })).url, '/fixture.png');
    assert.equal(h.uploads.length, 0, 'the custom icon path must never send multipart');
    assert.equal(h.ajax.length, 2, 'one nonce and one upload, without fallback');
    const upload = h.ajax[1];
    assert.equal(upload.contentType, 'application/x-www-form-urlencoded; charset=UTF-8');
    assert.equal(upload.processData, true);
    assert.equal(upload.headers['X-CSRF-Token'], 'fixture-unraid-token');
    assert.equal(upload.data._fv_nonce, nonce);
    assert.equal(upload.data.token, 'fixture-plugin-token');
    assert.equal(upload.data.replace, '1'); assert.equal(upload.data.dedupe, '0');
    assert.doesNotMatch(upload.data.icon_inline_data, /[+/]/);
    assert.deepEqual(Buffer.from(upload.data.icon_inline_data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), bytes);
    assert.deepEqual(progress, [[Math.round(file.size * 3 / 7), file.size]]);
    assert.equal(typeof handles[0].abort, 'function'); assert.equal(handles.at(-1), null);
    assert.doesNotMatch(JSON.stringify(h.api.diagnostics()), /fixture-unraid-token|fixture-plugin-token/);
});

test('custom icon form failures and cancellation are never replayed', async () => {
    for (const result of ['empty', 'timeout', 'network', 'forbidden', 'pending']) {
        const h = load({ result });
        const iconApi = iconApiFor(h);
        const file = new File(['fixture'], 'fixture.png', { type: 'image/png' });
        let handle;
        const upload = iconApi.uploadCustomIconFile(file, { setActiveRequest: value => { if (value) handle = value; } });
        if (result === 'pending') { await new Promise(resolve => setTimeout(resolve, 0)); handle.abort(); }
        await assert.rejects(upload);
        assert.equal(h.ajax.length, 2, 'one nonce and one form request only');
        assert.equal(h.uploads.length, 0);
    }
});

test('custom icon cancellation covers file reading and nonce acquisition', async () => {
    for (const options of [{ reading: true }, { noncePending: true }]) {
        const h = load(options); const api = iconApiFor(h);
        let handle, cleared;
        const upload = api.uploadCustomIconFile(new File(['fixture'], 'fixture.png'), {
            setActiveRequest: value => { if (value) handle = value; else cleared = true; }
        });
        await new Promise(resolve => setTimeout(resolve, 0)); handle.abort();
        await assert.rejects(upload, /Upload cancelled/);
        assert.equal(h.ajax.length, options.reading ? 0 : 1);
        assert.equal(cleared, true);
    }
});

test('custom icon cap permits 16 MiB and rejects one byte above before reading or requesting', async () => {
    const h = load(); const api = iconApiFor(h);
    const file = new File([new Uint8Array(16777216)], 'large.png');
    api.validateCustomIconFileBeforeUpload(file);
    await assert.rejects(api.uploadCustomIconFile(new File([file, 'x'], 'large.png')), /16MB limit/);
    assert.equal(h.ajax.length, 0);
});

test('16 MiB custom icons send ordered bounded parts with a nonce per part and preserve every byte', async () => {
    const h = load(); const api = iconApiFor(h);
    const bytes = Buffer.alloc(16777216, 255), progress = [];
    await api.uploadCustomIconFile(new File([bytes], 'large.png'), { onProgress: loaded => progress.push(loaded) });
    const parts = h.ajax.filter(request => !request.url.endsWith('/security.php'));
    assert.equal(parts.length, 33); assert.equal(h.ajax.length, 66);
    const decoded = parts.map((request, index) => {
        assert.equal(request.data.icon_chunk_index, String(index));
        assert.equal(request.data.icon_chunk_count, '33');
        assert.equal(request.data.icon_total_bytes, String(bytes.length));
        assert.match(request.data.icon_upload_id, /^[a-f0-9]{32}$/);
        assert.equal(request.data._fv_nonce, nonce);
        assert.ok(new URLSearchParams(request.data).toString().length < 1024 * 1024);
        return Buffer.from(request.data.icon_inline_data, 'base64url');
    });
    assert.deepEqual(Buffer.concat(decoded), bytes);
    assert.equal(progress.every((value, index) => index === 0 || value >= progress[index - 1]), true);
});

test('failure or cancellation after an accepted icon part stops the sequence without replay', async () => {
    for (const result of ['timeout', 'network', 'forbidden', 'empty', 'pending']) {
        const h = load({ result, failChunk: 1 }); const api = iconApiFor(h);
        let handle;
        const upload = api.uploadCustomIconFile(new File([new Uint8Array(2097152)], 'large.png'), {
            setActiveRequest: value => { if (value) handle = value; }
        });
        if (result === 'pending') {
            for (let attempt = 0; attempt < 500 && h.ajax.length < 4; attempt++) await new Promise(resolve => setTimeout(resolve, 1));
            assert.equal(h.ajax.length, 4); handle.abort();
        }
        await assert.rejects(upload);
        assert.equal(h.ajax.length, 4, 'only two authorized parts, with no retry or restart');
        assert.equal(h.uploads.length, 0);
    }
});
