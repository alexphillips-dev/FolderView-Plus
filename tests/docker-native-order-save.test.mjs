import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
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
// What the save sends for nestedRows(), folder entries included.
const sentNames = ['folder-media', 'example-plex', 'example-sonarr', 'folder-downloads', 'example-qbit', 'example-nginx'];
// A read of read_unraid_order.php?type=docker&stored=1: `order` is the effective order (Unraid's sort, name order
// fallback, unlisted containers added), `stored` the entries of userprefs.cfg as written.
const orderState = ({ order = nestedContainers, entries = [], status = 'ok', indexes } = {}) => ({
    ok: true,
    order,
    stored: { status, entries: entries.map((name, index) => ({ index: String(indexes ? indexes[index] : index), name })) }
});
const byName = ['example-nginx', 'example-plex', 'example-qbit', 'example-sonarr'];
// Before the save: userprefs.cfg holds an older order without folder entries.
const storedBefore = orderState({ order: byName, entries: byName });
const storedSaved = orderState({ entries: sentNames });

const createHarness = ({ rows = nestedRows(), reads = [], save = async () => {}, decision = 'confirm', prefs = {}, translate } = {}) => {
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
        ...(translate ? { translate } : {}),
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
    const { api, state } = createHarness({ reads: [storedBefore, storedBefore, storedSaved] });
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
        reads: [storedBefore],
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
    const { api, state } = createHarness({ reads: [storedBefore, storedBefore, orderState({ order: concurrent, entries: concurrent })] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 1);
    assert.equal(state.alerts.length, 1);
    assert.equal(state.alerts[0].tone, 'danger');
    assert.equal(state.alerts[0].title, 'The order of the containers was not saved');
    assert.match(state.alerts[0].message, /differs from the order that was sent/);
});

test('a native reorder while the preview is open leaves the stored order untouched', async () => {
    const concurrent = ['example-nginx', 'example-qbit', 'example-plex', 'example-sonarr'];
    const { api, state } = createHarness({ reads: [storedBefore, orderState({ order: concurrent, entries: concurrent })] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 0);
    assert.equal(state.alerts[0].tone, 'danger');
    assert.match(state.alerts[0].message, /changed while the preview was open\. Nothing was changed\./);
});

test('rows that change while the preview is open are not sent', async () => {
    const { api, state } = createHarness({
        reads: [storedBefore],
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
        const { api, state } = createHarness({ reads: [storedBefore], decision });
        assert.equal(await api.saveNativeOrder(), false);
        assert.equal(state.saves.length, 0);
        assert.equal(state.alerts.length, 0);
        assert.equal(state.readCount, 1);
    }
});

test('a container missing from the page blocks the save and is named', async () => {
    const { api, state } = createHarness({ reads: [orderState({ order: [...nestedContainers, 'example-new'] })] });
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
        const { api, state } = createHarness({ rows, reads: [storedBefore] });
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
        reads: [storedBefore],
        save: async () => { throw { status: 500, statusText: 'error' }; }
    });
    assert.equal(await rejected.api.saveNativeOrder(), false);
    assert.equal(rejected.state.alerts.length, 1);
    assert.equal(rejected.state.alerts[0].tone, 'danger');
    assert.match(rejected.state.alerts[0].message, /did not confirm the save request \(HTTP 500\)/);
    // The request may or may not have landed, so the title must not say "not saved".
    assert.equal(rejected.state.alerts[0].title, 'The save could not be confirmed');

    // An error body, the plain list without stored entries, and an unknown file status are all failed reads.
    for (const body of [{ ok: false, error: 'example failure' }, nestedContainers, orderState({ status: 'example' })]) {
        const malformed = createHarness({ reads: [body] });
        assert.equal(await malformed.api.saveNativeOrder(), false);
        assert.equal(malformed.state.modals.length, 0);
        assert.match(malformed.state.alerts[0].message, /could not be read from Unraid \(unexpected response\)/);
        assert.equal(malformed.state.alerts[0].title, 'The order of the containers was not saved');
    }

    const unverified = createHarness({ reads: [storedBefore, storedBefore, new Error('timeout')] });
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
    assert.match(dockerJs, /read: \(\) => pluginRequestClient\.getJson\('\/plugins\/folderview\.plus\/server\/read_unraid_order\.php', \{\s*data: \{ type: 'docker', stored: '1' \},/);
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

test('a silent write failure is not reported as saved although the effective order matches the preview', async () => {
    // userprefs.cfg holds the page's container order but no folder entries, so read_unraid_order.php's effective
    // order equals the preview. UserPrefs.php answers 200 and writes nothing.
    const unchanged = orderState({ entries: nestedContainers });
    const { api, state } = createHarness({ reads: [unchanged, unchanged, unchanged] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 1);
    assert.deepEqual(unchanged.order, nestedContainers, 'the effective order matches the containers sent');
    assert.equal(state.alerts[0].tone, 'danger');
    assert.equal(state.alerts[0].title, 'The order of the containers was not saved');
    assert.match(state.alerts[0].message, /Either Unraid did not store it/);
});

test('a missing, unreadable or invalid userprefs.cfg after the request means the save could not be confirmed', async () => {
    const causes = {
        missing: 'userprefs.cfg not found',
        unreadable: 'userprefs.cfg could not be read',
        invalid: 'userprefs.cfg is not in the format Unraid writes'
    };
    for (const [status, cause] of Object.entries(causes)) {
        // The effective order still matches the preview: without the file Unraid falls back to its own sort.
        const { api, state } = createHarness({ reads: [storedBefore, storedBefore, orderState({ status })] });
        assert.equal(await api.saveNativeOrder(), false, status);
        assert.equal(state.saves.length, 1);
        assert.equal(state.alerts[0].title, 'The save could not be confirmed', status);
        assert.equal(state.alerts[0].tone, 'danger');
        assert.ok(state.alerts[0].message.includes(`could not be read back from Unraid (${cause})`), state.alerts[0].message);
    }
    // No file before and none after: the first save on a server where the write silently fails.
    const never = orderState({ status: 'missing' });
    const { api, state } = createHarness({ reads: [never, never, never] });
    assert.equal(await api.saveNativeOrder(), false);
    assert.equal(state.saves.length, 1);
    assert.equal(state.alerts[0].title, 'The save could not be confirmed');
});

test('the three read-back causes are localized and keep the file name in every locale', async () => {
    const keys = { missing: 'docker.native-order.stored-missing', unreadable: 'docker.native-order.stored-unreadable', invalid: 'docker.native-order.stored-invalid' };
    // Example catalog: every message is its own key, so the result shows which key was used for the cause.
    const translate = (key, fallback = '', ...params) => (key === 'docker.native-order.unverified' ? `${key}($1)` : key).split('$1').join(String(params[0]));
    for (const [status, key] of Object.entries(keys)) {
        const { api, state } = createHarness({ reads: [storedBefore, storedBefore, orderState({ status })], translate });
        assert.equal(await api.saveNativeOrder(), false, status);
        assert.equal(state.alerts[0].message, `docker.native-order.unverified(${key})`, status);
    }
    const namespaces = path.join(repoRoot, pluginRoot, 'langs/namespaces');
    for (const locale of fs.readdirSync(namespaces)) {
        const catalog = JSON.parse(fs.readFileSync(path.join(namespaces, locale, 'docker.json'), 'utf8'));
        for (const key of Object.values(keys)) {
            assert.equal(typeof catalog[key], 'string', `${locale} ${key}`);
            assert.ok(catalog[key].includes('userprefs.cfg'), `${locale} ${key} keeps the file name`);
        }
    }
});

test('saved needs every entry sent, folder entries included, under the index sent and nothing else', async () => {
    const movedFolder = ['example-plex', 'folder-media', 'example-sonarr', 'folder-downloads', 'example-qbit', 'example-nginx'];
    const cases = {
        'folder entry missing': orderState({ entries: sentNames.filter((name) => name !== 'folder-downloads') }),
        'folder entry moved': orderState({ entries: movedFolder }),
        'other folder id': orderState({ entries: sentNames.map((name) => name === 'folder-media' ? 'folder-other' : name) }),
        'extra entry': orderState({ entries: [...sentNames, 'example-old'] }),
        'other indexes': orderState({ entries: sentNames, indexes: [0, 1, 2, 3, 4, 6] })
    };
    for (const [label, after] of Object.entries(cases)) {
        const { api, state } = createHarness({ reads: [storedBefore, storedBefore, after] });
        assert.equal(await api.saveNativeOrder(), false, label);
        assert.equal(state.alerts[0].title, 'The order of the containers was not saved', label);
    }
    const { api, state } = createHarness({ reads: [storedBefore, storedBefore, storedSaved] });
    assert.equal(await api.saveNativeOrder(), true);
    assert.equal(state.alerts[0].title, 'The order of the containers was saved');
});

test('a stored change that leaves the effective order alone still stops the save before sending', async () => {
    // Example: another page moved only a folder entry, or created userprefs.cfg with the order Unraid already used.
    const before = orderState({ entries: ['folder-media', ...nestedContainers] });
    const changes = [
        orderState({ entries: [...nestedContainers, 'folder-media'] }),
        orderState({ status: 'missing' })
    ];
    for (const now of changes) {
        assert.deepEqual(now.order, before.order);
        const { api, state } = createHarness({ reads: [before, now] });
        assert.equal(await api.saveNativeOrder(), false);
        assert.equal(state.saves.length, 0);
        assert.match(state.alerts[0].message, /changed while the preview was open\. Nothing was changed\./);
    }
});

test('the stored order is read from userprefs.cfg as Unraid writes it, without sorting, fallback or writes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-stored-order-'));
    const configDir = path.join(tempDir, 'config');
    const sourceDir = path.join(tempDir, 'runtime');
    const documentRoot = path.join(tempDir, 'document-root');
    for (const dir of [configDir, sourceDir, documentRoot]) fs.mkdirSync(dir, { recursive: true });
    const prefs = path.join(tempDir, 'userprefs.cfg');
    const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    const php = (code) => JSON.parse(execFileSync('php', ['-r', `require_once ${phpString(path.join(repoRoot, pluginRoot, 'server/lib.php'))}; ${code}`], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: configDir, FVPLUS_TEST_SOURCE_DIR: sourceDir, FVPLUS_TEST_DOCUMENT_ROOT: documentRoot }
    }));
    const readStored = (file = prefs) => php(`echo json_encode(readUnraidStoredDockerOrder(${phpString(file)}));`);
    const readFixture = (name, content, options) => {
        const file = path.join(tempDir, name);
        fs.writeFileSync(file, content, options);
        return readStored(file);
    };
    const writtenSnapshot = () => {
        const file = fs.openSync(prefs, 'r');
        try {
            const stat = fs.fstatSync(file);
            return { contents: fs.readFileSync(file, 'utf8'), mtime: stat.mtimeMs };
        } finally {
            fs.closeSync(file);
        }
    };
    try {
        assert.deepEqual(readStored(), { status: 'missing', entries: [] });

        // The write of Unraid 7.4.0's UserPrefs.php, lines 29-34, with the request the save sends.
        php(`$_POST = ['names' => ${phpString(`${sentNames.join(';')};`)}, 'index' => '0;1;2;3;4;5;'];
            $user_prefs = ${phpString(prefs)};
            $names = explode(';',$_POST['names']);
            $index = explode(';',$_POST['index']);
            $save  = []; $i = 0;
            foreach ($names as $name) if ($name) $save[] = $index[$i++]."=\\"".$name."\\""; else $i++;
            file_put_contents($user_prefs, implode("\\n",$save)."\\n");
            echo 'null';`);
        const written = writtenSnapshot();
        assert.deepEqual(readStored(), { status: 'ok', entries: sentNames.map((name, index) => ({ index: String(index), name })) });
        assert.deepEqual(writtenSnapshot(), written, 'reading preserves the file contents and modification time');

        // Stored order is returned as is: no name sort, no containers added.
        const unsorted = readFixture('unsorted.cfg', '0="example-zeta"\n1="example-alpha"\n');
        assert.deepEqual(unsorted.entries.map((entry) => entry.name), ['example-zeta', 'example-alpha']);
        // Saving an empty list makes UserPrefs.php write a single newline.
        assert.deepEqual(readFixture('empty.cfg', '\n'), { status: 'ok', entries: [] });

        const malformed = ['', '0="example-plex"', '0="example-plex"\n1="example-sonarr', 'example-plex\n', '0="example-plex"\r\n', '0="a"b"\n'];
        for (const [index, content] of malformed.entries()) {
            assert.deepEqual(readFixture(`malformed-${index}.cfg`, content), { status: 'invalid', entries: [] }, JSON.stringify(content));
        }

        const directory = path.join(tempDir, 'prefs-directory');
        fs.mkdirSync(directory);
        assert.deepEqual(readStored(directory), { status: 'unreadable', entries: [] });
        if (typeof process.getuid === 'function' && process.getuid() !== 0) {
            const unreadable = readFixture('unreadable.cfg', '0="example-plex"\n', { mode: 0o000 });
            assert.deepEqual(unreadable, { status: 'unreadable', entries: [] });
        }
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('the stored order mode is read-only, Docker-only and keeps the endpoint headers and contract check', () => {
    const endpoint = read(`${pluginRoot}/server/read_unraid_order.php`);
    assert.match(endpoint, /emitNoCachePageHeaders\(\);\s*try \{\s*fvplus_enforce_current_api_contract\(\);/);
    assert.match(endpoint, /if \(\(string\)\(\$_GET\['stored'\] \?\? ''\) === '1'\) \{/);
    assert.match(endpoint, /if \(\$type !== 'docker'\) \{\s*throw new RuntimeException/);
    assert.match(endpoint, /'stored' => readUnraidStoredDockerOrder\(\)/);
    const manifest = JSON.parse(read(`${pluginRoot}/server/api-endpoints.json`));
    assert.deepEqual(manifest.endpoints['read_unraid_order.php'].methods, ['GET']);
    assert.equal(manifest.endpoints['read_unraid_order.php'].access, 'read-only');
    const lib = read(`${pluginRoot}/server/lib.runtime-info.php`);
    const reader = lib.slice(lib.indexOf('function readUnraidStoredDockerOrder'), lib.indexOf('function pathToMultiDimArray'));
    assert.ok(reader.length > 0);
    assert.doesNotMatch(reader, /file_put_contents|fopen|fwrite|rename\(|unlink\(|touch\(|chmod\(|writeDurableFileAtomic/);
});
