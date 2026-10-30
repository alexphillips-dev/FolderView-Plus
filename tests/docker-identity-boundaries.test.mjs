import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repo = process.cwd();
const sourceRoot = process.env.FVPLUS_DRAFT_SCRIPTS_DIR || path.join(repo, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const require = createRequire(import.meta.url);
const grouping = require(path.join(sourceRoot, 'docker.runtime.folder-grouping.js'));
const infoModule = require(path.join(sourceRoot, 'docker.runtime.info.js'));
const commandModule = require(path.join(sourceRoot, 'docker.runtime.command-view.js'));
const source = name => fs.readFileSync(path.join(sourceRoot, name), 'utf8');
const loadFunction = (name, from, until, scope) => {
    const text = source(name), start = text.indexOf('const ' + from + ' =');
    const end = text.indexOf(until, start);
    assert.ok(start >= 0 && end > start);
    return new Function(...Object.keys(scope), text.slice(start, end) + '\nreturn ' + from + ';')(...Object.values(scope));
};
const runtime = {
    first: { name: 'first', id: 'a'.repeat(64), info: { Name: '/first' } },
    middle: { name: 'middle', id: 'b'.repeat(64), info: { Name: '/middle' } },
    last: { name: 'last', id: 'c'.repeat(64), info: { Name: '/last' } }
};
class ElementFixture {
    constructor(id = '', name = '') {
        this.id = id; this.name = name; this.dataset = {}; this.style = {}; this.attributes = {};
        this.isConnected = true; this.tagName = 'TR'; this.className = 'sortable'; this.events = new Map();
        this.classList = {
            contains: token => this.className.split(/\s+/).includes(token),
            add: (...tokens) => { this.className = [...new Set([...this.className.split(/\s+/), ...tokens])].filter(Boolean).join(' '); },
            remove: (...tokens) => { this.className = this.className.split(/\s+/).filter(token => !tokens.includes(token)).join(' '); }
        };
    }
    querySelector(selector) {
        if (selector.includes('.appname')) return { textContent: this.name, dataset: {} };
        return null;
    }
    querySelectorAll() { return []; }
    closest() { return this; }
    getAttribute(key) { return this.attributes[key] || ''; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(key, fn) { this.events.set(key, fn); }
    removeEventListener(key) { this.events.delete(key); }
}
const withDomGlobals = async callback => {
    const saved = Object.fromEntries(['Node', 'Element', 'HTMLElement'].map(key => [key, globalThis[key]]));
    for (const key of Object.keys(saved)) globalThis[key] = ElementFixture;
    try { return await callback(); }
    finally {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
        }
    }
};

test('shared identity index preserves triple collisions and refuses ambiguous prefix inference', () => {
    const index = grouping.buildIdentityIndex({
        one: { names: ['shared-alias', 'abcdef123456'], id: 'sha256:abcdef123456' + '0'.repeat(52) },
        two: { names: ['shared-alias', 'abcdef123456'] },
        three: { names: ['shared-alias'] }
    });
    assert.equal(index.resolve('shared-alias'), '');
    assert.equal(index.resolve('abcdef123456'), '');
    for (const name of ['one', 'two', 'three']) assert.equal(index.resolve(name), name);
});

test('native action row index resolves canonical names, short IDs and renamed text, refusing conflicts, duplicates and detached rows', () => {
    const first = new ElementFixture('ct-' + 'a'.repeat(12), 'old-first-name');
    const middle = new ElementFixture('ct-middle', 'middle');
    const conflict = new ElementFixture('ct-' + 'c'.repeat(12), 'middle');
    const index = grouping.createNativeRowIndex({ document: { querySelectorAll: () => [first, middle, conflict] }, containersInfo: runtime });
    assert.equal(index.find('first'), first);
    assert.equal(index.find('a'.repeat(12)), first);
    assert.equal(index.find('middle'), middle);
    assert.equal(index.resolveRowName(conflict), '');
    assert.equal(index.find('last'), null);
    first.isConnected = false;
    assert.equal(index.find('first'), null);
    const duplicate = new ElementFixture('ct-middle', 'middle');
    const duplicateIndex = grouping.createNativeRowIndex({ document: { querySelectorAll: () => [middle, duplicate] }, containersInfo: runtime });
    assert.equal(duplicateIndex.find('middle'), null);
});

test('strict action lookup retains grouping first-row and first-folder claims', () => {
    const first = new ElementFixture('ct-' + 'a'.repeat(12), 'first');
    const duplicate = new ElementFixture('ct-first', 'first');
    const session = grouping.createSession({ document: { querySelectorAll: () => [first, duplicate] }, containersInfo: runtime });
    session.beginFolder('owner', {}, 1); session.beginFolder('other', {}, 1);
    assert.equal(session.claim('owner', 'first'), first);
    assert.equal(session.claim('other', 'first'), null);
    assert.equal(session.snapshot().hostRows.duplicateCanonical, 1);
});

test('native action lookup recovers a replacement node without a new runtime snapshot', () => {
    const original = new ElementFixture('ct-' + 'a'.repeat(12), 'first');
    let rows = [original];
    const index = grouping.createNativeRowIndex({ document: { querySelectorAll: () => rows }, containersInfo: runtime });
    assert.equal(index.find('first'), original);
    const replacement = new ElementFixture('ct-' + 'a'.repeat(12), 'first');
    original.isConnected = false;
    rows = [replacement];
    assert.equal(index.find('first'), replacement);
});

test('Info caches row lookup for the accepted inventory, rejects conflicting candidates and replaces stale identity state', async () => withDomGlobals(() => {
    let accepted = runtime;
    const row = new ElementFixture('ct-' + 'a'.repeat(12), 'first');
    const api = infoModule.createApi({ window: {}, grouping, document: { querySelectorAll: () => [row] }, getDockerRuntimeInfoMap: () => accepted });
    const original = api.getDockerNativeRowIndex();
    assert.equal(original.find('first'), row);
    assert.equal(api.getDockerNativeRowIndex(), original);
    assert.equal(api.getDockerHostRowContainerName(row), 'first');
    row.name = 'middle';
    assert.equal(api.getDockerHostRowContainerName(row), '');
    row.name = 'renamed';
    accepted = { renamed: { name: 'renamed', id: 'a'.repeat(64) } };
    const replacement = api.getDockerNativeRowIndex();
    assert.notEqual(replacement, original);
    assert.equal(replacement.find('renamed'), row);
    assert.equal(replacement.find('first'), null);
}));

test('direct-member recovery accepts short-ID rows without stealing another folder owner', () => {
    const row = new ElementFixture('ct-' + 'a'.repeat(12), 'first');
    row.className = 'folder-fixture-element folder-element';
    const rows = [row];
    const wrap = items => ({
        length: items.length,
        first() { return this; }, find: () => wrap([]), children: () => wrap([]),
        each(fn) { items.forEach((entry, index) => fn(index, entry)); return this; },
        filter(fn) { return wrap(items.filter((entry, index) => fn(index, entry))); }
    });
    const doc = { querySelectorAll: () => rows, getElementById: () => null };
    const rowIndex = grouping.createNativeRowIndex({ document: doc, containersInfo: runtime });
    const find = loadFunction('docker.js', 'getDirectMemberRowsForFolder', 'const buildRuntimeContainerMapForFolder =', {
        $: selector => wrap(typeof selector === 'string' && selector.startsWith('tr.folder-fixture-element') ? rows.filter(entry => entry.classList.contains('folder-fixture-element')) : []),
        document: doc,
        buildRuntimeContainerMapForFolder: () => ({ first: runtime.first }),
        getDockerRuntimeInfoApi: () => ({ getDockerNativeRowIndex: () => rowIndex })
    });
    assert.equal(find('fixture').length, 1);
    row.className = 'sortable';
    assert.equal(find('fixture').length, 1, 'missing class can be recovered by canonical short-ID lookup');
    row.className = 'folder-other-element folder-element';
    assert.equal(find('fixture').length, 0, 'recovery cannot steal a row claimed by another folder');
});

test('incremental preview actions follow rendered identity after any hidden member, preserving complete membership', () => {
    const noop = () => {};
    const empty = { length: 0, each: noop, css: noop, remove: noop, removeClass() { return this; }, first() { return this; } };
    for (const hidden of Object.keys(runtime)) for (const mode of [1, 2, 3, 4]) for (const compact of [false, true]) {
        const actions = [], updated = [];
        const owner = (name, id = runtime[name]?.id) => ({ attr: key => key === 'data-fv-container-name' ? name : id, find: () => empty, first() { return this; } });
        const targets = Object.keys(runtime).filter(name => name !== hidden).map(name => ({
            length: 1, identity: name, hasClass: () => false, closest: () => owner(name)
        }));
        targets.push({ length: 1, identity: 'unknown', closest: () => owner('unknown', ''), hasClass: () => false });
        targets.push({ length: 1, identity: 'conflict', closest: () => owner('first', runtime.last.id), hasClass: () => false });
        const preview = { length: 1, find: () => empty };
        const sync = loadFunction('docker.runtime.preview-actions.js', 'syncDockerLeafFolderPreviewActions', '\n        return Object.freeze({', {
            grouping, jq: () => preview, collectDockerPreviewActionTargets: () => targets,
            syncDockerFolderMemberRows: (_id, all) => updated.push(Object.keys(all)),
            getSafeWebuiUrl: value => value, normalizePreviewStatusMode: () => 'none',
            hideDockerPreviewStatus: noop, syncDockerPreviewUpdateHighlight: noop,
            reconcileDockerPreviewActionButtons: (target, _settings, name) => actions.push([target.identity, name]),
            applyFolderPreviewLayout: noop, layoutFolderPreviewRows: noop, auditDockerPreviewContextBridges: noop
        });
        sync('fixture', { settings: { preview: mode, preview_rows: compact ? 2 : 1 }, hiddenPreviewMembers: [hidden] }, runtime);
        assert.deepEqual(actions, Object.keys(runtime).filter(name => name !== hidden).map(name => [name, name]));
        assert.deepEqual(updated, [Object.keys(runtime)], 'hidden previews remain part of full member/native reconciliation');
    }
});

test('Command native actions use the accepted render index and stop targeting detached or unmounted rows', async () => withDomGlobals(async () => {
    const row = new ElementFixture('ct-' + 'a'.repeat(12), 'first');
    const trigger = new ElementFixture();
    trigger.click = () => calls.push('first');
    const baseQuery = row.querySelector.bind(row);
    row.querySelector = selector => selector.includes('span.outer') ? trigger : baseQuery(selector);
    const calls = [], surface = new ElementFixture(), root = new ElementFixture(), table = new ElementFixture(), body = new ElementFixture();
    surface.setAttribute('data-member-name', 'first');
    root.querySelectorAll = selector => selector.includes('member-surface') ? [surface] : [];
    root.parentNode = { removeChild: () => {} };
    const doc = {
        body, getElementById: id => id === 'fvplus-docker-command-view-root' ? root : null,
        querySelector: () => table, querySelectorAll: () => [row]
    };
    const api = commandModule.createApi({ window: {}, document: doc, grouping,
        resolveRequestBundle: () => ({ render: [{ fixture: {} }, [], runtime, { prefs: {} }], generation: 1 }),
        getScopedRuntimeContainersForFolder: () => ({ first: runtime.first })
    });
    assert.equal((await api.mount()).ok, true);
    const event = { preventDefault() {}, stopPropagation() {} };
    surface.events.get('click')(event);
    assert.deepEqual(calls, ['first']);
    row.isConnected = false;
    surface.events.get('click')(event);
    assert.deepEqual(calls, ['first'], 'detached native nodes must not receive actions');
    row.isConnected = true;
    api.unmount();
    surface.events.get('click')(event);
    assert.deepEqual(calls, ['first'], 'unmounted closures must not keep a usable native-row index');
}));
