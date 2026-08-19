import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const bridgePath = path.join(pluginRoot, 'scripts/folderviewplus.csp-events.js');
const bridgeSource = fs.readFileSync(bridgePath, 'utf8');
const imageFallbackSource = fs.readFileSync(path.join(pluginRoot, 'scripts/runtime.image-fallbacks.js'), 'utf8');

const sourceFiles = [];
const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        const relative = absolute.replaceAll('\\', '/');
        if (relative.includes('/third-party-icons/')
            || relative.includes('/langs/')
            || relative.includes('/scripts/include/')) {
            continue;
        }
        if (entry.isDirectory()) walk(absolute);
        else if (/\.(?:js|page|php)$/i.test(entry.name) && !entry.name.endsWith('.min.js')) sourceFiles.push(absolute);
    }
};
walk(pluginRoot);

const createBridge = () => {
    const listeners = new Map();
    const document = {
        addEventListener(type, handler, capture) {
            listeners.set(type, { handler, capture });
        }
    };
    const locationCalls = [];
    const window = {
        document,
        console: { warn() {} },
        location: {
            assign(value) {
                locationCalls.push(value);
            }
        }
    };
    window.window = window;
    const context = vm.createContext({ window, globalThis: window, URL });
    vm.runInContext(imageFallbackSource, context, { filename: 'runtime.image-fallbacks.js' });
    vm.runInContext(bridgeSource, context, { filename: bridgePath });
    return { api: window.FolderViewPlusCspEvents, listeners, locationCalls, window };
};

const createElement = () => {
    const attributes = new Map();
    return {
        checked: true,
        dataset: {},
        form: { id: 'form' },
        value: 'balanced',
        getAttribute(name) {
            return attributes.get(name) ?? null;
        },
        hasAttribute(name) {
            return attributes.has(name);
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        }
    };
};

test('first-party plugin source has no inline event attributes, eval, or Function constructor', () => {
    for (const file of sourceFiles) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /\son(?:click|change|input|keydown|submit|error)\s*=\s*['"]/i, file);
        assert.doesNotMatch(source, /\beval\s*\(/, file);
        assert.doesNotMatch(source, /\bnew\s+Function\s*\(/, file);
    }
});

test('declarative event bridge supports existing argument forms without evaluating source', () => {
    const { api, window } = createBridge();
    const element = createElement();
    const calls = [];
    const event = {
        prevented: false,
        preventDefault() {
            this.prevented = true;
        }
    };
    window.changeStatusPref = (...args) => calls.push(['changeStatusPref', ...args]);
    window.hideAllTips = () => calls.push(['hideAllTips']);
    window.updateContainer = (...args) => calls.push(['updateContainer', ...args]);
    window.runTreeIntegrityCheck = (...args) => calls.push(['runTreeIntegrityCheck', ...args]);
    window.submitForm = (...args) => calls.push(['submitForm', ...args]);

    api.execute("changeStatusPref('docker', 'mode', this.value)", element, event);
    api.execute("hideAllTips(); updateContainer('safe-container');", element, event);
    api.execute("runTreeIntegrityCheck('docker', { repair: true })", element, event);
    api.execute('submitForm(this.form, true); return false;', element, event);

    assert.deepEqual(calls[0], ['changeStatusPref', 'docker', 'mode', 'balanced']);
    assert.deepEqual(calls[1], ['hideAllTips']);
    assert.deepEqual(calls[2], ['updateContainer', 'safe-container']);
    assert.equal(calls[3][0], 'runTreeIntegrityCheck');
    assert.deepEqual({ ...calls[3][2] }, { repair: true });
    assert.deepEqual(calls[4], ['submitForm', element.form, true]);
    assert.equal(event.prevented, true);
});

test('declarative action registry owns handlers, takes precedence over legacy globals, and supports teardown', () => {
    const { api, window } = createBridge();
    const element = createElement();
    const calls = [];
    window.changeStatusPref = () => calls.push('legacy');

    const registered = api.registerActions({
        changeStatusPref: (...args) => calls.push(['registry', ...args])
    }, { owner: 'settings' });

    assert.deepEqual([...registered], ['changeStatusPref']);
    assert.equal(api.snapshot().count, 1);
    assert.deepEqual([...api.snapshot().owners], ['settings']);
    api.execute("changeStatusPref('docker', 'mode', this.value)", element, { preventDefault() {} });
    assert.deepEqual(calls, [['registry', 'docker', 'mode', 'balanced']]);
    assert.equal(api.unregisterOwner('settings'), 1);
    api.execute("changeStatusPref('docker', 'mode', this.value)", element, { preventDefault() {} });
    assert.deepEqual(calls, [['registry', 'docker', 'mode', 'balanced'], 'legacy']);
});

test('declarative action registry rejects invalid handlers and cross-owner collisions', () => {
    const { api } = createBridge();
    assert.throws(() => api.registerActions({}, {}), /owner is required/);
    assert.throws(() => api.registerActions({ 'unsafe-name': () => {} }, { owner: 'settings' }), /Invalid declarative action name/);
    assert.throws(() => api.registerActions({ changeStatusPref: true }, { owner: 'settings' }), /must be a function/);
    api.registerActions({ changeStatusPref: () => {} }, { owner: 'settings' });
    assert.throws(
        () => api.registerActions({ hideAllTips: () => {}, changeStatusPref: () => {} }, { owner: 'docker' }),
        /already owned by settings/
    );
    assert.equal(api.getAction('hideAllTips'), null);
});

test('declarative event bridge blocks arbitrary globals and unsafe image fallbacks', () => {
    const { api, window } = createBridge();
    const element = createElement();
    const event = { preventDefault() {} };
    assert.throws(() => api.execute("alert('no')", element, event), /not allowlisted/);
    assert.throws(() => api.execute("this.src='https://attacker.invalid/icon.png'", element, event), /Unsafe image fallback/);
    element.setAttribute('src', 'https://icons.example.invalid/missing.png');
    api.execute("this.src='/plugins/folderview.plus/folder-icon.png'", element, event);
    assert.equal(element.getAttribute('src'), '/plugins/folderview.plus/folder-icon.png');
    assert.equal(element.dataset.fvplusFallbackApplied, 'true');
    assert.equal(window.FolderViewPlusFoundationModules.imageFallbacks.has('https://icons.example.invalid/missing.png'), true);
});

test('event bridge installs delegated handlers including capture-phase image errors', () => {
    const { listeners, locationCalls, api } = createBridge();
    assert.deepEqual([...listeners.keys()], ['click', 'change', 'input', 'keydown', 'submit', 'error']);
    assert.equal(listeners.get('error').capture, true);
    assert.equal(listeners.get('click').capture, false);
    const event = { preventDefault() {} };
    api.execute("window.location.href='/Plugins'", createElement(), event);
    assert.deepEqual(locationCalls, ['/Plugins']);
});

test('image fallback cache loads before the CSP event bridge on every loader path', () => {
    for (const pageName of ['FolderViewPlus.page', 'Folder.page']) {
        const page = fs.readFileSync(path.join(pluginRoot, pageName), 'utf8');
        const cacheIndex = page.indexOf('runtime.image-fallbacks.js');
        const bridgeIndex = page.indexOf('folderviewplus.csp-events.js');
        assert.ok(cacheIndex >= 0 && cacheIndex < bridgeIndex, pageName);
    }
    const customLoader = fs.readFileSync(path.join(pluginRoot, 'scripts/custom.php'), 'utf8');
    const cacheIndex = customLoader.indexOf('runtime.image-fallbacks.js');
    const bridgeIndex = customLoader.indexOf('folderviewplus.csp-events.js');
    assert.ok(cacheIndex >= 0 && cacheIndex < bridgeIndex);
});

test('image fallback cache stays bounded and ignores inline image payloads', () => {
    const { window } = createBridge();
    const cache = window.FolderViewPlusFoundationModules.imageFallbacks;
    assert.equal(cache.record('data:image/png;base64,AAAA'), false);
    for (let index = 0; index < 129; index += 1) {
        assert.equal(cache.record(`https://icons.example.invalid/missing-${index}.png`), true);
    }
    assert.deepEqual({ ...cache.snapshot() }, { count: 128, limit: 128 });
    assert.equal(cache.has('https://icons.example.invalid/missing-0.png'), false);
    assert.equal(cache.has('https://icons.example.invalid/missing-128.png'), true);
});

test('all runtime handler names represented in declarative source remain allowlisted', () => {
    const { api } = createBridge();
    const discovered = new Set();
    for (const file of sourceFiles) {
        const source = fs.readFileSync(file, 'utf8');
        for (const attribute of source.matchAll(/data-fv-on(?:click|change|input|keydown|submit|error)\s*=\s*(['"])([\s\S]*?)\1/gi)) {
            for (const call of attribute[2].matchAll(/(?:^|[;`\s])(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g)) {
                if (call[1] === 'event') continue;
                discovered.add(call[1]);
            }
        }
    }
    for (const handler of discovered) {
        assert.equal(api.allowedHandlers.has(handler), true, `${handler} must remain in the declarative handler allowlist`);
    }
    assert.equal(api.allowedHandlers.has('openFolderTreeMoveDialog'), true);
});
