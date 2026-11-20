import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const require = createRequire(import.meta.url);
const actionBarModule = require(path.join(repoRoot, pluginRoot, 'scripts/docker.runtime.action-bar.js'));
const actionBarJs = read(`${pluginRoot}/scripts/docker.runtime.action-bar.js`);
const dockerJs = read(`${pluginRoot}/scripts/docker.js`);

// Example data. A row is { name, folderId?, ownerId?, rows? }; `rows` are the rows nested inside a
// collapsed folder's storage, which the browser returns right after the folder's own name cell.
const flattenRows = (rows) => rows.flatMap((row) => [row, ...flattenRows(row.rows || [])]);
const makeCell = (row) => ({
    closest: () => row,
    querySelectorAll: () => [{ textContent: row.folderId ? `folder-${row.folderId}` : row.name }]
});
const nestedRows = () => [
    { folderId: 'media', rows: [
        { name: 'example-plex', ownerId: 'media' },
        { name: 'example-sonarr', ownerId: 'media' }
    ] },
    { folderId: 'downloads', rows: [
        { name: 'example-qbit', ownerId: 'downloads' }
    ] },
    { name: 'example-nginx' }
];
const nestedContainers = ['example-plex', 'example-sonarr', 'example-qbit', 'example-nginx'];

const createHarness = ({ rows = nestedRows(), reads = [], save = async () => {}, decision = 'confirm', prefs = {} } = {}) => {
    const state = { rows, saves: [], alerts: [], modals: [], readCount: 0, errors: [] };
    const document = {
        addEventListener() {},
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: (selector) => selector === '#docker_list td.ct-name' ? flattenRows(state.rows).map(makeCell) : []
    };
    const ui = {
        button: ({ label, action }) => `<button data-fv-ui-action="${action}">${label}</button>`,
        alert: (options) => { state.alerts.push(options); },
        openModal: (options) => {
            state.modals.push(options);
            const closed = Promise.resolve().then(() => {
                if (typeof decision === 'function') return decision(state);
                return decision;
            });
            return { element: { querySelector: () => null }, closed, close() {} };
        }
    };
    const api = actionBarModule.createApi({
        window: { addEventListener() {}, Element: null, HTMLElement: null, FolderViewPlusUI: ui },
        document,
        utils: { normalizePrefs: (value) => value || {} },
        getPrefs: () => prefs,
        getFolders: () => ({ media: { name: 'Media' }, downloads: { name: 'Downloads' } }),
        getScopedContainers: (id) => id === 'media'
            ? { 'example-plex': {}, 'example-sonarr': {}, 'example-qbit': {} }
            : { 'example-qbit': {} },
        readFolderIdFromRow: (row) => row?.folderId || '',
        readFolderOwnerFromRow: (row) => row?.ownerId || '',
        showError: (message) => state.errors.push(message),
        nativeOrder: {
            read: async () => {
                const next = reads[Math.min(state.readCount, reads.length - 1)];
                state.readCount += 1;
                if (next instanceof Error) throw next;
                return next;
            },
            save: async (data) => {
                state.saves.push(data);
                return save(data, state);
            }
        }
    });
    return { api, state };
};

test('nested folders are flattened in page order with every member in place', () => {
    const { api } = createHarness();
    assert.deepEqual(api.collectNativeOrder(), [
        { name: 'folder-media', folderId: 'media', ownerId: '' },
        { name: 'example-plex', folderId: '', ownerId: 'media' },
        { name: 'example-sonarr', folderId: '', ownerId: 'media' },
        { name: 'folder-downloads', folderId: 'downloads', ownerId: '' },
        { name: 'example-qbit', folderId: '', ownerId: 'downloads' },
        { name: 'example-nginx', folderId: '', ownerId: '' }
    ]);
});

test('an expanded nested folder yields the same flat order as a collapsed one', () => {
    // Expanding moves the member rows out of the folder storage to follow the folder row as siblings.
    const expanded = [
        { folderId: 'media' },
        { name: 'example-plex', ownerId: 'media' },
        { name: 'example-sonarr', ownerId: 'media' },
        { folderId: 'downloads' },
        { name: 'example-qbit', ownerId: 'downloads' },
        { name: 'example-nginx' }
    ];
    assert.deepEqual(
        createHarness({ rows: expanded }).api.collectNativeOrder().map((entry) => entry.name),
        createHarness().api.collectNativeOrder().map((entry) => entry.name)
    );
});

test('a confirmed save sends the request a drag sends and reports saved only after the read-back matches', async () => {
    const { api, state } = createHarness({ reads: [
        ['example-nginx', 'example-plex', 'example-qbit', 'example-sonarr'],
        ['example-nginx', 'example-plex', 'example-qbit', 'example-sonarr'],
        nestedContainers
    ] });
    assert.equal(await api.saveNativeOrder(), true);
    assert.deepEqual(state.saves, [{
        names: 'folder-media;example-plex;example-sonarr;folder-downloads;example-qbit;example-nginx;',
        index: '0;1;2;3;4;5;'
    }]);
    assert.equal(state.modals.length, 1);
    const preview = state.modals[0].content;
    assert.ok(preview.indexOf('example-plex') < preview.indexOf('example-sonarr'));
    assert.ok(preview.indexOf('example-sonarr') < preview.indexOf('example-qbit'));
    assert.ok(preview.indexOf('example-qbit') < preview.indexOf('example-nginx'));
    assert.match(preview, /example-qbit<\/span> <span class="fvplus-native-order-folder">Folder: Downloads</);
    assert.doesNotMatch(preview, /<li>[^<]*<span[^>]*>folder-media/);
    assert.match(preview, /change the order containers start in/);
    assert.match(preview, /applies its own setting for the order in which containers start/);
    assert.equal(state.alerts.length, 1);
    assert.equal(state.alerts[0].tone, 'success');
    assert.equal(state.alerts[0].title, 'The order of the containers was saved');
});

test('the preview says what happens to the start order when FolderView Plus leaves it unmanaged', async () => {
    const { api, state } = createHarness({
        reads: [nestedContainers],
        decision: 'cancel',
        prefs: { dockerStartOrder: { mode: 'unmanaged' } }
    });
    assert.equal(await api.saveNativeOrder(), false);
    assert.match(state.modals[0].content, /is set to leave the start order to Unraid/);
    assert.doesNotMatch(state.modals[0].content, /applies its own setting for the order in which containers start/);
});

test('a different stored order on read-back is reported as not saved', async () => {
    // Example of a concurrent native reorder: another Docker page saves between this save and the read-back.
    const concurrent = ['example-nginx', 'example-qbit', 'example-plex', 'example-sonarr'];
    const { api, state } = createHarness({ reads: [nestedContainers, nestedContainers, concurrent] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 1);
    assert.equal(state.alerts.length, 1);
    assert.equal(state.alerts[0].tone, 'danger');
    assert.equal(state.alerts[0].title, 'The order of the containers was not saved');
    assert.match(state.alerts[0].message, /differs from the order that was sent/);
});

test('a native reorder while the preview is open leaves the stored order untouched', async () => {
    const concurrent = ['example-nginx', 'example-qbit', 'example-plex', 'example-sonarr'];
    const { api, state } = createHarness({ reads: [nestedContainers, concurrent] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 0);
    assert.equal(state.alerts[0].tone, 'danger');
    assert.match(state.alerts[0].message, /changed while the preview was open\. Nothing was changed\./);
});

test('rows that change while the preview is open are not sent', async () => {
    const { api, state } = createHarness({
        reads: [nestedContainers],
        decision: (current) => {
            current.rows = [{ name: 'example-nginx' }, ...nestedRows().slice(0, 2)];
            return 'confirm';
        }
    });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 0);
    assert.match(state.alerts[0].message, /Nothing was changed/);
});

test('cancelling or dismissing the preview sends nothing and shows no result', async () => {
    for (const decision of ['cancel', 'escape', 'close']) {
        const { api, state } = createHarness({ reads: [nestedContainers], decision });
        assert.equal(await api.saveNativeOrder(), false);
        assert.equal(state.saves.length, 0);
        assert.equal(state.alerts.length, 0);
        assert.equal(state.readCount, 1);
    }
});

test('a container missing from the page blocks the save and is named', async () => {
    const { api, state } = createHarness({ reads: [[...nestedContainers, 'example-new']] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.modals.length, 0);
    assert.equal(state.saves.length, 0);
    assert.match(state.alerts[0].message, /not in the list on this page: example-new\./);
    assert.match(state.alerts[0].message, /nothing was changed/);
});

test('undrawn folder rows, duplicate names, rows of removed containers and an empty list block the save', async () => {
    const cases = [
        [{ name: 'example-plex' }, { name: 'example-sonarr' }, { name: 'example-qbit' }, { name: 'example-nginx' }],
        [...nestedRows(), { name: 'example-nginx' }],
        [...nestedRows(), { name: 'example-removed' }],
        []
    ];
    for (const rows of cases) {
        const { api, state } = createHarness({ rows, reads: [nestedContainers] });
        assert.equal(await api.saveNativeOrder(), false);
        assert.equal(state.modals.length, 0);
        assert.equal(state.saves.length, 0);
        assert.match(state.alerts[0].message, /Nothing was changed/);
    }
});

test('failed requests are reported with their cause and never as saved', async () => {
    const unreadable = createHarness({ reads: [Object.assign(new Error('Request failed'), { status: 503 })] });
    assert.equal(await unreadable.api.saveNativeOrder(), false);
    assert.equal(unreadable.state.saves.length, 0);
    assert.match(unreadable.state.alerts[0].message, /could not be read from Unraid \(HTTP 503\)/);

    const rejected = createHarness({
        reads: [nestedContainers],
        save: async () => { throw { status: 500, statusText: 'error' }; }
    });
    assert.equal(await rejected.api.saveNativeOrder(), false);
    assert.equal(rejected.state.alerts.length, 1);
    assert.equal(rejected.state.alerts[0].tone, 'danger');
    assert.match(rejected.state.alerts[0].message, /did not confirm the save request \(HTTP 500\)/);
    // The request may or may not have landed, so the title must not say "not saved".
    assert.equal(rejected.state.alerts[0].title, 'The save could not be confirmed');

    const malformed = createHarness({ reads: [{ ok: false, error: 'example failure' }] });
    assert.equal(await malformed.api.saveNativeOrder(), false);
    assert.equal(malformed.state.modals.length, 0);
    assert.match(malformed.state.alerts[0].message, /could not be read from Unraid \(unexpected response\)/);
    assert.equal(malformed.state.alerts[0].title, 'The order of the containers was not saved');

    const unverified = createHarness({ reads: [nestedContainers, nestedContainers, new Error('timeout')] });
    assert.equal(await unverified.api.saveNativeOrder(), false);
    assert.equal(unverified.state.saves.length, 1);
    assert.equal(unverified.state.alerts[0].tone, 'danger');
    assert.match(unverified.state.alerts[0].message, /could not be read back from Unraid \(timeout\), so the save is not confirmed/);
    assert.equal(unverified.state.alerts[0].title, 'The save could not be confirmed');
});

test('the Tools menu action releases the action bar after a failed save', async () => {
    const listeners = {};
    const attributes = {};
    let markup = '';
    const bar = {
        dataset: {},
        classList: { toggle() {} },
        setAttribute: (name, value) => { attributes[name] = value; },
        contains: () => true,
        querySelectorAll: () => [],
        querySelector: () => null
    };
    Object.defineProperty(bar, 'innerHTML', { set(value) { markup = value; }, get: () => markup });
    const toolButton = { disabled: false, getAttribute: () => 'save-native-order' };
    const target = { closest: (selector) => selector === '[data-fvplus-docker-tool]' ? toolButton : null };
    const alerts = [];
    let settle;
    const settled = new Promise((resolve) => { settle = resolve; });
    actionBarModule.createApi({
        window: {
            addEventListener() {},
            Element: null,
            HTMLElement: null,
            FolderViewPlusUI: { openModal() {}, button: () => '', alert: (options) => { alerts.push(options); settle(); } }
        },
        document: {
            activeElement: null,
            addEventListener: (type, handler) => { listeners[type] = handler; },
            getElementById: (id) => id === 'fvplus-docker-action-bar' ? bar : null,
            querySelector: () => null,
            querySelectorAll: () => []
        },
        nativeOrder: { read: async () => { throw new Error('offline'); }, save: async () => {} }
    });
    listeners.click({ target, preventDefault() {} });
    assert.equal(attributes['aria-busy'], 'true');
    await settled;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(attributes['aria-busy'], 'false');
    assert.equal(alerts[0].tone, 'danger');
    assert.match(markup, /data-fvplus-docker-tool="save-native-order" >/);
});

test('the save is offered only in the FolderView view and runs only from its menu item', () => {
    assert.match(actionBarJs, /const canSaveOrder = currentMode === 'folderview';/);
    assert.match(actionBarJs, /data-fvplus-docker-tool="save-native-order" \$\{canSaveOrder \? '' : `disabled title=/);
    assert.match(actionBarJs, /if \(tool === 'save-native-order'\) runTask\(saveNativeOrder\);/);
    assert.equal(actionBarJs.match(/saveNativeOrder/g).length, 3, 'definition, menu handler and module API only');
    assert.doesNotMatch(dockerJs, /saveNativeOrder/);
});

test('the native order keeps one writer, so the saved order outlives the plugin', () => {
    // The page sends Unraid's own request; the existing UserPrefs.php hooks in docker.js apply to it.
    assert.match(dockerJs, /save: \(data\) => \$\.ajax\(\{ type: 'POST', url: '\/plugins\/dynamix\.docker\.manager\/include\/UserPrefs\.php', data, timeout: 15000 \}\)/);
    assert.match(dockerJs, /read: \(\) => pluginRequestClient\.getJson\('\/plugins\/folderview\.plus\/server\/read_unraid_order\.php'/);
    assert.equal(dockerJs.match(/dynamix\.docker\.manager\/include\/UserPrefs\.php/g).length, 3, 'prefilter, completion hook and the save');

    // No plugin PHP writes or is allowed to write Unraid's Docker order file.
    const serverDir = path.join(repoRoot, pluginRoot, 'server');
    for (const file of fs.readdirSync(serverDir).filter((name) => name.endsWith('.php'))) {
        const source = fs.readFileSync(path.join(serverDir, file), 'utf8');
        for (const line of source.split('\n').filter((entry) => /userprefs\.cfg/.test(entry))) {
            assert.doesNotMatch(line, /file_put_contents|writeDurableFileAtomic|fwrite|rename\(|unlink\(/, `${file} must only read userprefs.cfg`);
        }
    }
    assert.doesNotMatch(read(`${pluginRoot}/server/lib.filesystem-security.php`), /dockerMan/);

    // Uninstalling removes only the plugin's own files, never Unraid's Docker configuration.
    const removeScript = read('folderview.plus.plg').match(/<FILE Run="\/bin\/bash" Method="remove">([\s\S]*?)<\/FILE>/);
    assert.ok(removeScript, 'the plugin manifest declares a remove script');
    assert.doesNotMatch(removeScript[1], /dockerMan|userprefs|unraid-autostart/);
    assert.match(removeScript[1], /rm -rf \/boot\/config\/plugins\/&name;\s/);
});
