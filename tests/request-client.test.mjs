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
    let callCount = 0;

    const ajax = (_options) => {
        callCount += 1;
        const step = plan[callCount - 1] || { type: 'success', data: '{}' };
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
            ajax
        },
        getCallCount: () => callCount,
        getAjaxSetupCalls: () => ajaxSetupCalls
    };
};

const loadRequestClient = ({ token = '', plan = [], metaToken = '' } = {}) => {
    const { $, getCallCount, getAjaxSetupCalls } = createJQueryMock(plan);
    const storage = new Map();
    if (token) {
        storage.set('fv.request.token', token);
    }
    const context = {
        window: {},
        document: {
            querySelector: (selector) => {
                if (selector === 'meta[name="fv-request-token"]' && metaToken) {
                    return { content: metaToken };
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
        Number
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
        getAjaxSetupCalls
    };
};

test('request client configures ajax headers with token', () => {
    const { api, getAjaxSetupCalls } = loadRequestClient({ token: 'abc123' });
    assert.ok(api);
    const setupCalls = getAjaxSetupCalls();
    assert.ok(setupCalls.length >= 1);
    const lastHeaders = setupCalls[setupCalls.length - 1]?.headers || {};
    assert.equal(lastHeaders['X-FV-Request'], '1');
    assert.equal(lastHeaders['X-FV-Token'], 'abc123');
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
        plan: [
            { type: 'error', status: 0, textStatus: 'abort', errorThrown: 'abort' }
        ]
    });

    await assert.rejects(
        () => api.postJson('/plugins/folderview.plus/server/test.php', { ok: 1 }, { retries: 3 }),
        /Request failed/
    );
    assert.equal(getCallCount(), 1);
});
