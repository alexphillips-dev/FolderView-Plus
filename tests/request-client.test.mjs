import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const requestScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.request.js'
);
const requestScript = fs.readFileSync(requestScriptPath, 'utf8');

const createJQueryMock = (plan = []) => {
    const ajaxSetupCalls = [];
    const ajaxPrefilters = [];
    const ajaxCalls = [];
    let callCount = 0;
    let plannedCallCount = 0;

    const ajax = (options) => {
        callCount += 1;
        ajaxCalls.push(options);
        const isNonceRequest = options?.url === '/plugins/folderview.plus/server/security.php';
        const step = isNonceRequest
            ? { type: 'success', data: { ok: true, nonce: 'a'.repeat(64) } }
            : (plan[plannedCallCount++] || { type: 'success', data: '{}' });
        let doneHandler = null;
        let failHandler = null;
        let settled = false;
        let settledValue = null;

        const runDone = () => {
            if (!doneHandler || !settled || settledValue?.type !== 'success') {
                return;
            }
            const jqXHR = settledValue.jqXHR || { status: 200, statusText: 'OK' };
            doneHandler(settledValue.data, 'success', jqXHR);
        };

        const runFail = () => {
            if (!failHandler || !settled || settledValue?.type !== 'error') {
                return;
            }
            const jqXHR = settledValue.jqXHR || { status: settledValue.status || 0, statusText: settledValue.statusText || '' };
            failHandler(jqXHR, settledValue.textStatus || 'error', settledValue.errorThrown || '');
        };

        setTimeout(() => {
            settled = true;
            settledValue = step;
            runDone();
            runFail();
        }, 0);

        const chain = {
            done(fn) {
                doneHandler = fn;
                runDone();
                return chain;
            },
            fail(fn) {
                failHandler = fn;
                runFail();
                return chain;
            }
        };
        return chain;
    };

    return {
        $: {
            ajaxSetup: (payload) => ajaxSetupCalls.push(payload),
            ajaxPrefilter: (handler) => ajaxPrefilters.push(handler),
            ajax
        },
        getCallCount: () => callCount,
        getAjaxSetupCalls: () => ajaxSetupCalls,
        getAjaxPrefilters: () => ajaxPrefilters,
        getAjaxCalls: () => ajaxCalls
    };
};

const loadRequestClient = ({ token = '', plan = [], metaToken = '' } = {}) => {
    const { $, getCallCount, getAjaxSetupCalls, getAjaxPrefilters, getAjaxCalls } = createJQueryMock(plan);
    const storage = new Map();
    const effectiveMetaToken = metaToken || token;
    const context = {
        window: {},
        document: {
            querySelector: (selector) => {
                if (selector === 'meta[name="fv-request-token"]' && effectiveMetaToken) {
                    return { content: effectiveMetaToken };
                }
                return null;
            }
        },
        localStorage: {
            getItem: (key) => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, String(value))
        },
        setTimeout,
        clearTimeout,
        console,
        Error,
        JSON,
        Promise,
        String,
        Number,
        URL,
        URLSearchParams
    };
    context.window.$ = $;
    context.window.document = context.document;
    context.window.localStorage = context.localStorage;
    context.$ = $;

    vm.createContext(context);
    new vm.Script(requestScript).runInContext(context);
    return {
        api: context.window.FolderViewPlusRequest,
        getCallCount,
        getAjaxSetupCalls,
        getAjaxPrefilters,
        getAjaxCalls
    };
};

test('request client scopes compatibility headers to plugin-owned URLs', () => {
    const { api, getAjaxSetupCalls, getAjaxPrefilters } = loadRequestClient({ token: 'abc123' });
    assert.ok(api);
    assert.equal(getAjaxSetupCalls().length, 0);
    assert.equal(getAjaxPrefilters().length, 1);
    const pluginOptions = { url: '/plugins/folderview.plus/server/read.php', headers: {} };
    const hostOptions = { url: '/plugins/dynamix.vm.manager/include/VMajax.php', headers: {} };
    getAjaxPrefilters()[0](pluginOptions);
    getAjaxPrefilters()[0](hostOptions);
    assert.equal(pluginOptions.headers['X-FV-Request'], '1');
    assert.equal(pluginOptions.headers['X-FV-Token'], 'abc123');
    assert.deepEqual(hostOptions.headers, {});
});

test('request client generates trace IDs and sends them on mutation payload + headers', async () => {
    const { api, getAjaxCalls } = loadRequestClient({
        token: 'tok-123',
        plan: [{ type: 'success', data: '{"ok":true}' }]
    });

    const response = await api.postJson('/plugins/folderview.plus/server/prefs.php', {
        type: 'docker',
        prefs: '{}'
    });
    assert.equal(response.ok, true);

    const nonceCall = getAjaxCalls()[0] || {};
    const call = getAjaxCalls()[1] || {};
    assert.equal(nonceCall.url, '/plugins/folderview.plus/server/security.php');
    assert.equal(call.method, 'POST');
    assert.match(String(call.headers?.['X-FV-Trace'] || ''), /^fv-/);
    assert.match(String(call.headers?.['X-FV-Transaction'] || ''), /^tx-/);
    assert.equal(call.data._fv_request, '1');
    assert.equal(call.data.token, 'tok-123');
    assert.equal(call.data._fv_trace, call.headers?.['X-FV-Trace']);
    assert.equal(call.data._fv_transaction, call.headers?.['X-FV-Transaction']);
    assert.equal(call.data._fv_nonce, 'a'.repeat(64));
    assert.equal(call.headers?.['X-FV-Nonce'], 'a'.repeat(64));
    assert.equal(response.transactionId, call.headers?.['X-FV-Transaction']);
});

test('request client retries retryable failures and returns parsed JSON', async () => {
    const { api, getCallCount } = loadRequestClient({
        plan: [
            { type: 'error', status: 503, statusText: 'Service Unavailable', textStatus: 'error' },
            { type: 'success', data: '{"ok":true,"value":7}' }
        ]
    });

    const response = await api.getJson('/plugins/folderview.plus/server/test.php', {
        retries: 1,
        retryDelayMs: 1
    });
    assert.equal(response.ok, true);
    assert.equal(response.value, 7);
    assert.equal(getCallCount(), 2);
});

test('request client does not retry aborted requests', async () => {
    const { api, getCallCount } = loadRequestClient({
        token: 'tok-abort',
        plan: [
            { type: 'error', status: 0, textStatus: 'abort', errorThrown: 'abort' }
        ]
    });

    await assert.rejects(
        () => api.postJson('/plugins/folderview.plus/server/test.php', { ok: 1 }, { retries: 3 }),
        /trace:\s*fv-/
    );
    assert.equal(getCallCount(), 2);
});

test('request client surfaces backend JSON error details in thrown message', async () => {
    const { api, getCallCount } = loadRequestClient({
        token: 'tok-backend-error',
        plan: [
            {
                type: 'error',
                textStatus: 'error',
                jqXHR: {
                    status: 400,
                    statusText: 'Bad Request',
                    responseText: '{"ok":false,"error":"Missing required parameters."}'
                }
            }
        ]
    });

    await assert.rejects(
        () => api.postJson('/plugins/folderview.plus/server/update.php', { type: 'docker' }, { retries: 0 }),
        /Missing required parameters/
    );
    assert.equal(getCallCount(), 2);
});

test('request client preserves HTTP status and response details for conflict recovery', async () => {
    const { api } = loadRequestClient({
        token: 'tok-conflict',
        plan: [{
            type: 'error',
            textStatus: 'error',
            jqXHR: {
                status: 409,
                statusText: 'Conflict',
                responseJSON: { ok: false, error: 'Stale revision.' },
                responseText: '{"ok":false,"error":"Stale revision."}'
            }
        }]
    });

    await assert.rejects(
        () => api.postJson('/plugins/folderview.plus/server/prefs.php', { type: 'docker' }, { retries: 0 }),
        (error) => error.status === 409 && error.httpStatus === 409 && error.response?.error === 'Stale revision.'
    );
});

test('request client appends mutation markers to POST payload for guard compatibility', async () => {
    const { api, getAjaxCalls } = loadRequestClient({
        token: 'tok-123',
        plan: [{ type: 'success', data: '{"ok":true}' }]
    });

    const response = await api.postJson('/plugins/folderview.plus/server/prefs.php', {
        type: 'docker',
        prefs: '{}'
    });

    assert.equal(response.ok, true);
    const call = getAjaxCalls()[1] || {};
    assert.equal(call.method, 'POST');
    assert.equal(call.data._fv_request, '1');
    assert.equal(call.data.token, 'tok-123');
    assert.equal(call.data._fv_nonce, 'a'.repeat(64));
});

test('request client retries reads but never replays mutations by default', async () => {
    const readClient = loadRequestClient({
        plan: [
            { type: 'error', status: 503, statusText: 'Service Unavailable' },
            { type: 'success', data: '{"ok":true}' }
        ]
    });
    assert.equal((await readClient.api.getJson('/plugins/folderview.plus/server/read.php')).ok, true);
    assert.equal(readClient.getCallCount(), 2);

    const mutationClient = loadRequestClient({
        token: 'tok-retry-policy',
        plan: [
            { type: 'error', status: 503, statusText: 'Service Unavailable' },
            { type: 'success', data: '{"ok":true}' }
        ]
    });
    await assert.rejects(
        () => mutationClient.api.postJson('/plugins/folderview.plus/server/update.php', { type: 'docker' }),
        /HTTP 503/
    );
    assert.equal(mutationClient.getCallCount(), 2);
});

test('request client builds encoded URLs and exposes bounded sanitized diagnostics', async () => {
    const { api } = loadRequestClient({
        plan: [{ type: 'success', data: '{"ok":true}' }]
    });
    const url = api.buildUrl('/plugins/folderview.plus/server/read.php', {
        type: 'docker',
        name: 'Media Server',
        tags: ['one', 'two']
    });
    assert.match(url, /^\/plugins\/folderview\.plus\/server\/read\.php\?/);
    assert.match(url, /name=Media\+Server/);
    assert.match(url, /tags=one&tags=two/);

    await api.getJson(`${url}&secret=do-not-export`);
    const diagnostics = api.diagnostics();
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].endpoint, '/plugins/folderview.plus/server/read.php');
    assert.equal(diagnostics[0].outcome, 'ok');
    assert.equal(diagnostics[0].attempts, 1);
    assert.doesNotMatch(JSON.stringify(diagnostics), /do-not-export/);
    api.clearDiagnostics();
    assert.equal(api.diagnostics().length, 0);
});
