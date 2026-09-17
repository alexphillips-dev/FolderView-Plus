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
const requestScript = fs.readFileSync(requestScriptPath.replace('request.js', 'request-diagnostics.js'), 'utf8') + '\n' + fs.readFileSync(requestScriptPath, 'utf8');

const createJQueryMock = (plan = [], noncePlan = []) => {
    const ajaxSetupCalls = [];
    const ajaxPrefilters = [];
    const ajaxCalls = [];
    let callCount = 0;
    let plannedCallCount = 0;
    let nonceCallCount = 0;

    const ajax = (options) => {
        callCount += 1;
        ajaxCalls.push(options);
        const isNonceRequest = options?.url === '/plugins/folderview.plus/server/security.php';
        const step = isNonceRequest
            ? (noncePlan[nonceCallCount++] || { type: 'success', data: { ok: true, nonce: 'a'.repeat(64) } })
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

const loadRequestClient = ({ token = '', plan = [], noncePlan = [], metaToken = '', sessionStorage = null, translate = null } = {}) => {
    const { $, getCallCount, getAjaxSetupCalls, getAjaxPrefilters, getAjaxCalls } = createJQueryMock(plan, noncePlan);
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
    context.window.sessionStorage = sessionStorage;
    context.window.FolderViewPlusI18n = translate ? { t: translate } : null;
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

test('nonce guard failures expose safe reason and phase, survive navigation, and never send the mutation', async () => {
    const storage = new Map();
    const sessionStorage = {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key)
    };
    const { api, getAjaxCalls } = loadRequestClient({
        token: 'secret-plugin-token', sessionStorage,
        noncePlan: [{ type: 'error', jqXHR: { status: 403, responseJSON: {
            error: 'Blocked by request guard.',
            requestFailure: { source: 'folderview-plus', reasonCode: 'origin-mismatch', origin: 'https://private.example.test' }
        } } }]
    });
    await assert.rejects(api.postJson('/plugins/folderview.plus/server/update.php?name=PrivateFolder', { name: 'PrivateFolder' }), (error) => {
        assert.equal(error.phase, 'nonce');
        assert.equal(error.reasonCode, 'origin-mismatch');
        assert.equal(error.status, 403);
        assert.match(error.message, /reverse proxy/);
        assert.match(error.message, /FVPLUS\/nonce\/origin-mismatch/);
        return true;
    });
    assert.equal(getAjaxCalls().length, 1);
    assert.equal(getAjaxCalls()[0].url, '/plugins/folderview.plus/server/security.php');
    assert.equal(api.diagnostics()[0].phase, 'nonce');
    assert.equal(api.diagnostics()[0].traceId, getAjaxCalls()[0].headers['X-FV-Trace']);
    const navigated = loadRequestClient({ sessionStorage }).api;
    assert.equal(navigated.failureDiagnostics()[0].reasonCode, 'origin-mismatch');
    assert.doesNotMatch(JSON.stringify([...storage, api.diagnostics(), navigated.failureDiagnostics()]), /secret-plugin-token|PrivateFolder|private\.example/);
    navigated.clearDiagnostics();
    assert.equal(navigated.failureDiagnostics().length, 0);
});

test('missing page token is reported before network access and an updated page can save', async () => {
    const missing = loadRequestClient();
    await assert.rejects(missing.api.postJson('/plugins/folderview.plus/server/update.php', {}), (error) => error.phase === 'token' && error.reasonCode === 'plugin-token-missing');
    assert.equal(missing.getCallCount(), 0);
    assert.equal(missing.api.failureDiagnostics()[0].reasonCode, 'plugin-token-missing');
    const refreshed = loadRequestClient({ token: 'fresh-page-token', plan: [{ type: 'success', data: { ok: true } }] });
    assert.equal((await refreshed.api.postJson('/plugins/folderview.plus/server/update.php', {})).ok, true);
});

test('native Unraid CSRF rejection is distinguished from the plugin guard and translated', async () => {
    for (const [message, reason] of [['missing csrf_token', 'csrf-missing'], ['wrong csrf_token', 'csrf-invalid'], ['uninitialized csrf_token', 'csrf-uninitialized']]) {
        const { api, getCallCount } = loadRequestClient({
            token: 'plugin-token',
            translate: (key, fallback) => key === 'request.failure.session' ? 'Atualize a sessao do Unraid.' : fallback,
            noncePlan: [{ type: 'error', jqXHR: { status: 403, responseText: JSON.stringify({ error: message }) } }]
        });
        await assert.rejects(api.postJson('/plugins/folderview.plus/server/update.php', {}), (error) => {
            assert.equal(error.failureSource, 'unraid');
            assert.equal(error.reasonCode, reason);
            assert.match(error.message, /Atualize a sessao/);
            return true;
        });
        assert.equal(getCallCount(), 1);
    }
});

test('nonce malformed responses and timeouts are diagnosed without retries or mutation replay', async () => {
    for (const [step, reason] of [
        [{ type: 'success', data: { ok: true, nonce: 'invalid-private-value' } }, 'nonce-response-invalid'],
        [{ type: 'error', textStatus: 'timeout' }, 'timeout'],
        [{ type: 'error', status: 401 }, 'authentication-required']
    ]) {
        const { api, getCallCount } = loadRequestClient({ token: 'plugin-token', noncePlan: [step] });
        await assert.rejects(api.postJson('/plugins/folderview.plus/server/update.php', {}, { retries: 2 }), (error) => error.phase === 'nonce' && error.reasonCode === reason);
        assert.equal(getCallCount(), 1);
        assert.doesNotMatch(JSON.stringify(api.failureDiagnostics()), /invalid-private-value|plugin-token/);
    }
});

test('mutation-time guard rejection retains the mutation phase and correct support code', async () => {
    const { api, getCallCount } = loadRequestClient({ token: 'token', plan: [{ type: 'error', jqXHR: { status: 409, responseJSON: {
        error: 'Mutation nonce is expired, invalid, or already used.', requestFailure: { source: 'folderview-plus', reasonCode: 'nonce-stale' }
    } } }] });
    await assert.rejects(api.postJson('/plugins/folderview.plus/server/update.php', {}), (error) => error.phase === 'request' && error.reasonCode === 'nonce-stale');
    assert.equal(getCallCount(), 2);
    assert.equal(api.failureDiagnostics()[0].phase, 'request');
});

test('failure history rejects injected fields, unknown codes, private paths and expired entries', () => {
    const valid = { at: new Date().toISOString(), endpoint: '/plugins/folderview.plus/server/update.php', reasonCode: 'origin-mismatch', phase: 'nonce', failureSource: 'folderview-plus', status: 403 };
    const entries = [
        { ...valid, token: 'private-token', body: 'private-body' },
        { ...valid, reasonCode: 'private-reason' },
        { ...valid, endpoint: '/private/path' },
        { ...valid, at: '2020-01-01T00:00:00Z' }
    ];
    const { api } = loadRequestClient({ sessionStorage: { getItem: () => JSON.stringify(entries) } });
    assert.equal(api.failureDiagnostics().length, 1);
    assert.doesNotMatch(JSON.stringify(api.failureDiagnostics()), /private/);
});
