import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const dockerRuntimeActionsModule = require(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js')
);

const normalizeFolderParentId = (value) => String(value || '').trim();
const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const createActionsApi = (deps = {}) => dockerRuntimeActionsModule.createApi({
    window: {
        prompt: () => '',
        crypto: null,
        msCrypto: null,
        setTimeout: (handler) => {
            handler();
            return 0;
        },
        ...(deps.window || {})
    },
    document: {
        cookie: '',
        ...(deps.document || {})
    },
    $: Object.assign(
        () => ({
            show: () => {},
            hide: () => {}
        }),
        {
            post: () => ({
                promise: async () => ({})
            }),
            ...(deps.$ || {})
        }
    ),
    swal: deps.swal || (() => {}),
    openDocker: deps.openDocker || (() => {}),
    hideAllTips: deps.hideAllTips || (() => {}),
    getGlobalFolders: deps.getGlobalFolders || (() => ({})),
    getFolderChildren: deps.getFolderChildren || (() => []),
    getFolderDescendants: deps.getFolderDescendants || (() => []),
    isDockerFolderLocked: deps.isDockerFolderLocked || (() => false),
    ensureDockerFolderUnlocked: deps.ensureDockerFolderUnlocked || (() => true),
    normalizeFolderParentId,
    escapeHtml: (value) => String(value ?? ''),
    getSafeWebuiUrl: deps.getSafeWebuiUrl || ((value) => String(value || '').trim()),
    openWebuiPopupWindow: deps.openWebuiPopupWindow || (() => true),
    getScopedRuntimeContainersForFolder: deps.getScopedRuntimeContainersForFolder || (() => ({})),
    runDockerGuardedAction: deps.runDockerGuardedAction || (async (_actionName, action) => ({ ok: true, value: await action() })),
    getDockerMenuLabel: deps.getDockerMenuLabel || ((_key, fallback) => fallback),
    loadlist: deps.loadlist || (() => {}),
    queueLoadlistRefresh: deps.queueLoadlistRefresh || (() => {}),
    refreshDockerRuntimeState: deps.refreshDockerRuntimeState || (() => {}),
    eventURL: deps.eventURL || '/plugins/dynamix.docker.manager/include/Events.php',
    generateDockerFolderCloneId: deps.generateDockerFolderCloneId,
    persistDockerFolderClonePayload: deps.persistDockerFolderClonePayload,
    rollbackClonedDockerFolders: deps.rollbackClonedDockerFolders,
    debugEnabled: false,
    console: deps.console || console
});

test('docker clone payload builder deep-clones mutable folder fields', () => {
    const source = {
        name: 'Media',
        parentId: ' root-parent ',
        icon: 'icon.svg',
        settings: {
            layout: 'grid',
            nested: { enabled: true }
        },
        regex: '^media',
        containers: ['plex'],
        actions: [
            {
                name: 'Restart',
                params: { mode: 'safe' }
            }
        ]
    };

    const actionsApi = createActionsApi();
    const payload = actionsApi.buildDockerFolderClonePayload(source, {
        name: 'Media Copy',
        parentId: ' child-parent '
    });

    assert.equal(payload.name, 'Media Copy');
    assert.equal(payload.parentId, 'child-parent');
    assert.notStrictEqual(payload.settings, source.settings);
    assert.notStrictEqual(payload.settings.nested, source.settings.nested);
    assert.notStrictEqual(payload.containers, source.containers);
    assert.notStrictEqual(payload.actions, source.actions);
    assert.notStrictEqual(payload.actions[0], source.actions[0]);
    assert.notStrictEqual(payload.actions[0].params, source.actions[0].params);

    payload.settings.nested.enabled = false;
    payload.containers.push('sonarr');
    payload.actions[0].params.mode = 'forced';

    assert.equal(source.settings.nested.enabled, true);
    assert.deepEqual(source.containers, ['plex']);
    assert.equal(source.actions[0].params.mode, 'safe');
});

test('docker folder update dialog callback preserves host loadlist and schedules runtime refresh follow-up', async () => {
    const openDockerCalls = [];
    let loadlistCalls = 0;
    const queuedRefreshCalls = [];
    const runtimeRefreshCalls = [];
    const folderEvents = new EventTarget();
    const windowContext = {
        prompt: () => '',
        crypto: null,
        msCrypto: null,
        setTimeout: (handler) => {
            handler();
            return 0;
        }
    };
    const actionsApi = dockerRuntimeActionsModule.createApi({
        window: windowContext,
        document: { cookie: '' },
        $: Object.assign(
            () => ({
                show: () => {},
                hide: () => {}
            }),
            {
                post: () => ({
                    promise: async () => ({})
                })
            }
        ),
        swal: () => {},
        openDocker: (...args) => {
            openDockerCalls.push(args);
        },
        hideAllTips: () => {},
        getGlobalFolders: () => ({
            media: { name: 'Media' }
        }),
        getFolderChildren: () => [],
        getFolderDescendants: () => [],
        isDockerFolderLocked: () => false,
        ensureDockerFolderUnlocked: () => true,
        normalizeFolderParentId,
        escapeHtml: (value) => String(value ?? ''),
        getSafeWebuiUrl: (value) => String(value || '').trim(),
        openWebuiPopupWindow: () => true,
        getScopedRuntimeContainersForFolder: () => ({
            sonarr: { managed: true, update: true },
            radarr: { managed: true, update: false }
        }),
        runDockerGuardedAction: async (_actionName, action) => ({ ok: true, value: await action() }),
        getDockerMenuLabel: (_key, fallback) => fallback,
        folderEvents,
        loadlist: () => {
            loadlistCalls += 1;
        },
        queueLoadlistRefresh: (options = {}) => {
            queuedRefreshCalls.push(options);
        },
        refreshDockerRuntimeState: (options = {}) => {
            runtimeRefreshCalls.push(options);
            return Promise.resolve(true);
        },
        eventURL: '/plugins/dynamix.docker.manager/include/Events.php',
        debugEnabled: false,
        console
    });

    actionsApi.updateFolder('media');

    assert.equal(openDockerCalls.length, 1);
    assert.equal(openDockerCalls[0][0], 'update_container sonarr');
    assert.equal(openDockerCalls[0][3], '__fvplusDockerDialogRefresh');
    assert.equal(typeof windowContext.__fvplusDockerDialogRefresh, 'function');
    assert.deepEqual(queuedRefreshCalls, []);
    assert.deepEqual(runtimeRefreshCalls, [{ followupDelayMs: 650 }, { followupDelayMs: 650 }]);

    folderEvents.dispatchEvent(new Event('docker-post-folders-creation'));
    assert.deepEqual(runtimeRefreshCalls, [
        { followupDelayMs: 650 },
        { followupDelayMs: 650 },
        { followupDelayMs: 650 }
    ]);

    await Promise.resolve(windowContext.__fvplusDockerDialogRefresh());

    assert.equal(loadlistCalls, 1);
    assert.deepEqual(runtimeRefreshCalls, [
        { followupDelayMs: 650 },
        { followupDelayMs: 650 },
        { followupDelayMs: 650 },
        { followupDelayMs: 650 }
    ]);
});

test('docker branch clone order keeps parent folders ahead of nested descendants', () => {
    const folders = {
        root: { name: 'Root' },
        childA: { name: 'Child A', parentId: 'root' },
        grand: { name: 'Grand', parentId: 'childA' },
        childB: { name: 'Child B', parentId: 'root' }
    };
    const getFolderChildren = (folderId) => Object.keys(folders).filter((candidateId) => {
        const parentId = normalizeFolderParentId(folders[candidateId]?.parentId || folders[candidateId]?.parent_id || '');
        return parentId === String(folderId || '').trim();
    });

    const actionsApi = createActionsApi({
        getGlobalFolders: () => folders,
        getFolderChildren
    });

    assert.deepEqual(actionsApi.getDockerFolderBranchCloneOrder('root'), ['root', 'childA', 'grand', 'childB']);
});

test('docker branch cloning preserves nested hierarchy across clone-of-clone generations', async () => {
    const currentFolders = {
        outside: { name: 'Outside', parentId: '' },
        root: {
            name: 'Root',
            parentId: 'outside',
            settings: { preview: 1, nested: { enabled: true } },
            regex: '^root',
            containers: ['alpha'],
            actions: [{ name: 'Action Root' }]
        },
        child: {
            name: 'Child',
            parentId: 'root',
            settings: { preview: 2 },
            regex: '^child',
            containers: ['beta'],
            actions: [{ name: 'Action Child' }]
        },
        grand: {
            name: 'Grand',
            parentId: 'child',
            settings: { preview: 3 },
            regex: '^grand',
            containers: ['gamma'],
            actions: []
        }
    };
    const persistCalls = [];
    const syncCalls = [];
    let loadlistCalls = 0;
    const generatedIds = ['copyRoot1', 'copyChild1', 'copyGrand1', 'copyRoot2', 'copyChild2', 'copyGrand2'];
    const promptResponses = ['Root Clone 1', 'Root Clone 2'];
    const getFolderChildren = (folderId) => Object.keys(currentFolders).filter((candidateId) => {
        const parentId = normalizeFolderParentId(currentFolders[candidateId]?.parentId || currentFolders[candidateId]?.parent_id || '');
        return parentId === String(folderId || '').trim();
    });
    const $ = Object.assign(
        () => ({
            show: () => {},
            hide: () => {}
        }),
        {
            post: (url, payload) => ({
                promise: async () => {
                    syncCalls.push({ url, payload: cloneJson(payload) });
                    return {};
                }
            })
        }
    );
    const actionsApi = createActionsApi({
        window: {
            prompt: () => promptResponses.shift(),
            crypto: null,
            msCrypto: null
        },
        getGlobalFolders: () => currentFolders,
        getFolderChildren,
        $,
        generateDockerFolderCloneId: () => {
            const nextId = generatedIds.shift();
            assert.ok(nextId, 'expected deterministic clone id');
            return nextId;
        },
        persistDockerFolderClonePayload: async (payload, folderId = '') => {
            const record = {
                id: String(folderId || '').trim(),
                payload: cloneJson(payload)
            };
            persistCalls.push(record);
            currentFolders[record.id] = cloneJson(payload);
        },
        loadlist: () => {
            loadlistCalls += 1;
        }
    });

    await actionsApi.cloneDockerFolderBranchFromMenu('root');
    await actionsApi.cloneDockerFolderBranchFromMenu('copyRoot1');

    assert.equal(loadlistCalls, 2);
    assert.equal(syncCalls.length, 2);
    assert.ok(syncCalls.every((entry) => entry.url === '/plugins/folderview.plus/server/sync_order.php'));
    assert.deepEqual(
        persistCalls.map((entry) => entry.id),
        ['copyRoot1', 'copyChild1', 'copyGrand1', 'copyRoot2', 'copyChild2', 'copyGrand2']
    );

    assert.equal(currentFolders.copyRoot1.parentId, 'outside');
    assert.equal(currentFolders.copyChild1.parentId, 'copyRoot1');
    assert.equal(currentFolders.copyGrand1.parentId, 'copyChild1');
    assert.equal(currentFolders.copyRoot2.parentId, 'outside');
    assert.equal(currentFolders.copyChild2.parentId, 'copyRoot2');
    assert.equal(currentFolders.copyGrand2.parentId, 'copyChild2');
    assert.equal(currentFolders.copyRoot2.name, 'Root Clone 2');
    assert.equal(currentFolders.copyChild2.name, 'Child');
    assert.equal(currentFolders.copyGrand2.name, 'Grand');
    assert.equal(currentFolders.copyChild2.parentId !== 'root', true);
    assert.equal(currentFolders.copyGrand2.parentId !== 'child', true);
    assert.equal(currentFolders.copyGrand2.parentId !== 'copyChild1', true);
});

test('docker branch delete helper deletes descendants before deleting the root folder', async () => {
    const calls = [];
    const actionsApi = createActionsApi({
        getFolderDescendants: () => ['childA', 'childB', 'grandChild'],
        $: {
            post: (url, payload) => ({
                promise: async () => {
                    calls.push({ url, payload: cloneJson(payload) });
                    return {};
                }
            })
        }
    });

    await actionsApi.deleteDockerFolderBranch('root');

    assert.deepEqual(
        calls.map((entry) => entry.payload.id),
        ['grandChild', 'childB', 'childA', 'root']
    );
    assert.ok(calls.every((entry) => entry.url === '/plugins/folderview.plus/server/delete.php'));
});

test('docker branch clone rollback helper deletes partial clones in reverse order before syncing order', async () => {
    const calls = [];
    const actionsApi = createActionsApi({
        $: {
            post: (url, payload) => ({
                promise: async () => {
                    calls.push({ url, payload: cloneJson(payload) });
                    return {};
                }
            })
        }
    });

    await actionsApi.rollbackClonedDockerFolders(['copyRoot', 'copyChild', 'copyGrand']);

    assert.deepEqual(
        calls.map((entry) => entry.url),
        [
            '/plugins/folderview.plus/server/delete.php',
            '/plugins/folderview.plus/server/delete.php',
            '/plugins/folderview.plus/server/delete.php',
            '/plugins/folderview.plus/server/sync_order.php'
        ]
    );
    assert.deepEqual(
        calls.slice(0, 3).map((entry) => entry.payload.id),
        ['copyGrand', 'copyChild', 'copyRoot']
    );
    assert.deepEqual(calls[3].payload, { type: 'docker' });
});

test('docker branch clone triggers rollback with only the clones created before a persist failure', async () => {
    const currentFolders = {
        root: { name: 'Root', parentId: '' },
        child: { name: 'Child', parentId: 'root' },
        grand: { name: 'Grand', parentId: 'child' }
    };
    const generatedIds = ['copyRoot', 'copyChild', 'copyGrand'];
    const rollbackCalls = [];
    const getFolderChildren = (folderId) => Object.keys(currentFolders).filter((candidateId) => {
        const parentId = normalizeFolderParentId(currentFolders[candidateId]?.parentId || currentFolders[candidateId]?.parent_id || '');
        return parentId === String(folderId || '').trim();
    });
    const $ = Object.assign(
        () => ({
            show: () => {},
            hide: () => {}
        }),
        {
            post: () => ({
                promise: async () => ({})
            })
        }
    );
    const actionsApi = createActionsApi({
        window: {
            prompt: () => 'Root Copy',
            crypto: null,
            msCrypto: null
        },
        getGlobalFolders: () => currentFolders,
        getFolderChildren,
        $,
        generateDockerFolderCloneId: () => {
            const nextId = generatedIds.shift();
            assert.ok(nextId, 'expected deterministic clone id');
            return nextId;
        },
        persistDockerFolderClonePayload: async (payload, folderId = '') => {
            const safeFolderId = String(folderId || '').trim();
            if (safeFolderId === 'copyGrand') {
                throw new Error('Simulated persist failure');
            }
            currentFolders[safeFolderId] = cloneJson(payload);
        },
        rollbackClonedDockerFolders: async (createdIds) => {
            rollbackCalls.push([...createdIds]);
        }
    });

    await assert.rejects(
        actionsApi.cloneDockerFolderBranchFromMenu('root'),
        /Simulated persist failure/
    );

    assert.deepEqual(rollbackCalls, [['copyRoot', 'copyChild']]);
});
