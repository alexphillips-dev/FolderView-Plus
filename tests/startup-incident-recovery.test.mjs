import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const sourcePath = path.join(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js'
);
const source = fs.readFileSync(sourcePath, 'utf8');

const createStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
        values
    };
};

const createClassList = () => {
    const values = new Set();
    return {
        add: (...names) => names.forEach((name) => values.add(name)),
        remove: (...names) => names.forEach((name) => values.delete(name)),
        contains: (name) => values.has(name),
        values
    };
};

const createButton = () => ({
    textContent: '',
    innerHTML: '',
    disabled: false,
    listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
    setAttribute() {}
});

const createHarness = () => {
    const nodes = new Map();
    const globalListeners = {};
    const sessionStorage = createStorage();
    const localStorage = createStorage();
    const root = {
        id: 'fv-settings-root',
        classList: createClassList(),
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
        prepend(node) {
            node.parentNode = this;
            this.firstChild = node;
            nodes.set(node.id, node);
        }
    };
    root.classList.add('fv-settings-bootstrap-pending');
    const shell = { id: 'fv-settings-bootstrap-shell', hidden: false };
    nodes.set(root.id, root);
    nodes.set(shell.id, shell);
    const body = {
        appendChild(node) { node.parentNode = this; },
        prepend(node) { node.parentNode = this; nodes.set(node.id, node); }
    };
    const document = {
        body,
        documentElement: body,
        head: { appendChild() {} },
        createElement(tag) {
            if (tag === 'textarea') {
                return { value: '', style: {}, setAttribute() {}, select() {}, remove() {} };
            }
            if (tag === 'a') {
                return { style: {}, click() {}, remove() {} };
            }
            const buttons = new Map();
            return {
                id: '',
                className: '',
                dataset: {},
                attributes: {},
                parentNode: null,
                firstChild: null,
                innerHTML: '',
                tabIndex: 0,
                setAttribute(name, value) { this.attributes[name] = String(value); },
                querySelector(selector) {
                    if (!buttons.has(selector)) buttons.set(selector, createButton());
                    return buttons.get(selector);
                },
                focus() { this.focused = true; },
                remove() { this.parentNode = null; }
            };
        },
        getElementById: (id) => nodes.get(id) || null,
        querySelector(selector) {
            if (selector === '#fv-settings-root') return root;
            if (selector === 'body') return body;
            return null;
        },
        execCommand: () => true
    };
    const window = {
        document,
        location: {
            href: 'https://private-host.example/Settings/FolderViewPlus?token=secret',
            origin: 'https://private-host.example',
            reload() { this.reloaded = true; }
        },
        navigator: { userAgent: 'Test browser' },
        localStorage,
        sessionStorage,
        crypto: { randomUUID: () => 'incident-test-id' },
        URL: {
            createObjectURL: () => 'blob:startup-report',
            revokeObjectURL() {}
        },
        Blob,
        FolderViewPlusFatalRuntimeContext: {
            page: 'Settings',
            hostSelector: '#fv-settings-root',
            pluginVersion: '2026.08.10.01',
            unraidVersion: '7.3.2'
        },
        addEventListener(name, handler) { globalListeners[name] = handler; },
        setTimeout(handler) { handler(); return 1; },
        requestAnimationFrame(handler) { handler(); }
    };
    window.window = window;
    vm.runInNewContext(source, {
        window,
        globalThis: window,
        URL,
        Blob,
        Date,
        JSON,
        Object,
        String,
        Number,
        Array,
        Set,
        Map,
        Math,
        Error,
        Promise,
        Uint8Array
    }, { filename: sourcePath });
    return { window, root, shell, nodes, globalListeners, sessionStorage };
};

test('fatal incidents keep technical evidence while sanitizing copied startup reports', () => {
    const { window, root, shell, nodes, sessionStorage } = createHarness();
    const api = window.FolderViewPlusFatalBanner;
    api.recordModuleEvent({
        name: 'folderviewplus.activity-diagnostics.js',
        stage: 'workspace',
        outcome: 'failed',
        durationMs: 42,
        detail: 'https://private-host.example/mnt/user/private/config'
    });
    api.reportFatalError(new Error('Request failed at https://private-host.example for 10.0.0.25 /mnt/user/private/config'), {
        code: 'FVPLUS-SET-LOADER-001',
        category: 'missing-asset',
        phase: 'bootstrap-module-load'
    });

    const snapshot = api.getStartupIncidentSnapshot();
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.code, 'FVPLUS-SET-LOADER-001');
    assert.equal(snapshot.route, '/Settings/FolderViewPlus');
    assert.equal(snapshot.modules.at(-1).durationMs, 42);
    assert.equal(root.classList.contains('fv-settings-bootstrap-failed'), true);
    assert.equal(root.attributes['aria-busy'], 'false');
    assert.equal(shell.hidden, true);
    assert.equal(nodes.get('fvplus-fatal-banner').attributes.role, 'alert');
    assert.equal(nodes.get('fvplus-fatal-banner').attributes['aria-live'], 'assertive');
    assert.equal(nodes.get('fvplus-fatal-banner').focused, true);

    const report = api.buildSupportReport();
    assert.match(report, /\[module-events\]/);
    assert.match(report, /\[recovery-attempts\]/);
    assert.doesNotMatch(report, /private-host\.example/);
    assert.doesNotMatch(report, /10\.0\.0\.25/);
    assert.doesNotMatch(report, /\/mnt\/user\/private/);
    assert.ok(sessionStorage.values.has('fv.support.bundle.startupIncident.v1'));
});

test('fatal recovery is bounded by the registered loader and records its result', async () => {
    const { window } = createHarness();
    const api = window.FolderViewPlusFatalBanner;
    let attempts = 0;
    api.registerRecoveryHandler('retry', async () => { attempts += 1; });
    api.reportFatalError(new Error('Failed to load Settings module: missing.js'), {
        code: 'FVPLUS-SET-LOADER-001',
        category: 'missing-asset',
        phase: 'bootstrap-module-load'
    });

    assert.equal(await api.runRecovery('retry'), true);
    assert.equal(attempts, 1);
    const snapshot = api.getStartupIncidentSnapshot();
    assert.equal(snapshot.status, 'recovered');
    assert.equal(snapshot.recoveryAttempts.at(-1).status, 'succeeded');
});

test('plugin-related CSP violations become classified startup incidents', () => {
    const { window, globalListeners } = createHarness();
    globalListeners.securitypolicyviolation({
        blockedURI: 'https://private-host.example/plugins/folderview.plus/scripts/missing.js',
        sourceFile: '',
        effectiveDirective: 'script-src'
    });
    const snapshot = window.FolderViewPlusFatalBanner.getStartupIncidentSnapshot();
    assert.equal(snapshot.category, 'csp-violation');
    assert.equal(snapshot.phase, 'bootstrap');
});

test('shared error classification distinguishes request, response, server, and cache failures', () => {
    const { window } = createHarness();
    const classify = window.FolderViewPlusFatalBanner.classifyError;
    assert.equal(classify({ status: 401, message: 'Unauthorized' }), 'auth-failed');
    assert.equal(classify({ status: 403, message: 'Forbidden' }), 'request-guard');
    assert.equal(classify({ status: 404, message: 'Missing' }), 'missing-endpoint');
    assert.equal(classify({ status: 503, message: 'Unavailable' }), 'server-error');
    assert.equal(classify(new Error('Invalid JSON response')), 'invalid-response');
    assert.equal(classify(new Error('Asset version mismatch')), 'version-mismatch');
    assert.equal(classify(new Error('Preferences could not be read')), 'prefs-corrupt');
});
