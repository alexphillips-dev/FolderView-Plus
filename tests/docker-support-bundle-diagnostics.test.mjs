import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const diagnosticsModule = require(path.join(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.diagnostics.js'
));
const hostGuardsModule = require(path.join(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.host-guards.js'
));

const textElement = (value) => ({ textContent: String(value || '') });
const updateElement = (value) => ({
    nodeType: 1,
    tagName: 'DIV',
    hidden: false,
    parentElement: null,
    getAttribute: () => '',
    childNodes: [{ nodeType: 3, textContent: String(value || '') }]
});

const createJQuery = (rows) => {
    const wrap = (items) => ({
        length: items.length,
        each(callback) {
            items.forEach((item, index) => callback(index, item));
            return this;
        },
        is(selector) {
            return selector === ':visible' ? items[0]?.visible !== false : false;
        },
        find(selector) {
            const row = items[0] || {};
            if (selector === 'td.updatecolumn') {
                return wrap(row.updateCell ? [row.updateCell] : []);
            }
            if (selector === 'td.ct-name .appname') {
                return wrap([textElement(row.appName)]);
            }
            if (selector === 'td.ct-name .state') {
                return wrap([textElement(row.state)]);
            }
            return wrap([]);
        },
        first() {
            return wrap(items.slice(0, 1));
        },
        text() {
            return String(items[0]?.textContent || '');
        },
        get(index) {
            return items[index] || null;
        },
        attr(name) {
            return name === 'active' ? String(items[0]?.active || 'false') : '';
        }
    });

    return (selector) => {
        if (selector === '#docker_list > tr') {
            return wrap(rows);
        }
        if (typeof selector === 'string' && selector.startsWith('.dropDown-')) {
            return wrap([{ active: 'false' }]);
        }
        return wrap(selector ? [selector] : []);
    };
};

const folderRow = (id, name) => ({
    visible: true,
    className: `folder folder-id-${id}`,
    id: '',
    appName: name,
    state: 'started',
    updateCell: updateElement('up-to-date')
});
const containerRow = (name, folderId = '') => ({
    visible: true,
    className: folderId ? `folder-${folderId}-element` : '',
    id: `ct-${name}`,
    appName: name,
    state: 'started',
    updateCell: updateElement('up-to-date')
});

test('Docker support snapshot records standalone containers after folders and page asset versions', () => {
    const rows = [folderRow('apps', 'Apps'), folderRow('services', 'Services'), containerRow('new-container')];
    const scripts = [
        { src: '/plugins/folderview.plus/scripts/docker.runtime.diagnostics.js?v=2026.07.13.04', defer: false },
        { src: '/plugins/folderview.plus/scripts/docker.js?v=2026.07.13.04', defer: true }
    ];
    const window = {
        location: { pathname: '/Docker', origin: 'http://tower.local' },
        FolderViewPlusFatalRuntimeContext: { pluginVersion: '2026.07.13.04' },
        getComputedStyle: () => ({ display: 'table-row', visibility: 'visible' })
    };
    const api = diagnosticsModule.createApi({
        window,
        document: { querySelectorAll: () => scripts },
        $: createJQuery(rows),
        readDockerListViewMode: () => 'basic',
        getCorrelationContext: () => ({
            stateSignature: 'new-container:r:1:dockerman:true:',
            stateEntityCount: 1,
            orderReconciliation: { available: true, missingContainerCount: 1 }
        })
    });

    const snapshot = api.collectPageSnapshot('regression');

    assert.equal(snapshot.topLevelRows.count, 3);
    assert.equal(snapshot.topLevelRows.folderCount, 2);
    assert.equal(snapshot.topLevelRows.standaloneContainerCount, 1);
    assert.equal(snapshot.topLevelRows.foldersBeforeStandalone, true);
    assert.equal(snapshot.topLevelRows.firstOrderingViolationDomIndex, null);
    assert.deepEqual(snapshot.topLevelRows.entries.map((entry) => entry.rowType), [
        'folder',
        'folder',
        'standaloneContainer'
    ]);
    assert.equal(snapshot.correlation.stateEntityCount, 1);
    assert.equal(snapshot.correlation.orderReconciliation.missingContainerCount, 1);
    assert.equal(snapshot.dockerAssets.pluginVersion, '2026.07.13.04');
    assert.deepEqual(snapshot.dockerAssets.entries.map((entry) => entry.versionQuery), [
        '2026.07.13.04',
        '2026.07.13.04'
    ]);
});

test('Docker support snapshot reports a top-level ordering violation', () => {
    const rows = [containerRow('new-container'), folderRow('apps', 'Apps')];
    const api = diagnosticsModule.createApi({
        window: {
            location: { pathname: '/Docker', origin: 'http://tower.local' },
            getComputedStyle: () => ({ display: 'table-row', visibility: 'visible' })
        },
        document: { querySelectorAll: () => [] },
        $: createJQuery(rows)
    });

    const snapshot = api.collectPageSnapshot('regression');
    assert.equal(snapshot.topLevelRows.foldersBeforeStandalone, false);
    assert.equal(snapshot.topLevelRows.firstStandaloneDomIndex, 0);
    assert.equal(snapshot.topLevelRows.firstOrderingViolationDomIndex, 1);
});

test('Docker host guard stores invocation arguments as structured diagnostic details', () => {
    const api = hostGuardsModule.createApi({ window: {}, document: {} });
    const details = {
        commandType: 'update_container',
        containerCount: 2,
        containerNames: ['CloudBerryBackup', 'radarr']
    };

    api.noteHookInvocation('window.openDocker', {
        note: 'update_container invoked',
        details
    });
    details.containerNames[0] = 'mutated-after-recording';

    const state = api.getHookStates()['window.openDocker'];
    assert.equal(state.callCount, 1);
    assert.equal(state.notes[0], 'update_container invoked');
    assert.deepEqual(state.lastInvocation, {
        commandType: 'update_container',
        containerCount: 2,
        containerNames: ['CloudBerryBackup', 'radarr']
    });
});
