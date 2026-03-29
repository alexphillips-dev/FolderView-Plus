import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const extractArrowFunctionBody = (source, signature) => {
    const startIndex = source.indexOf(signature);
    assert.ok(startIndex >= 0, `Missing function signature: ${signature}`);
    const braceStart = source.indexOf('{', startIndex + signature.length);
    assert.ok(braceStart >= 0, `Missing opening brace for: ${signature}`);
    let depth = 0;
    for (let index = braceStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart + 1, index);
            }
        }
    }
    throw new Error(`Failed to extract function body for: ${signature}`);
};

const normalizeFolderParentId = (value) => String(value || '').trim();
const clonePayloadBody = extractArrowFunctionBody(
    dockerJs,
    'const buildDockerFolderClonePayload = (source, overrides = {}) => '
);
const branchOrderBody = extractArrowFunctionBody(
    dockerJs,
    'const getDockerFolderBranchCloneOrder = (rootId) => '
);
const rollbackBody = extractArrowFunctionBody(
    dockerJs,
    'const rollbackClonedDockerFolders = async (createdIds = []) => '
);
const deleteBranchBody = extractArrowFunctionBody(
    dockerJs,
    'const deleteDockerFolderBranch = async (id) => '
);
const cloneBranchBody = extractArrowFunctionBody(
    dockerJs,
    'const cloneDockerFolderBranchFromMenu = async (id) => '
);

const buildDockerFolderClonePayload = new Function(
    'source',
    'overrides',
    'normalizeFolderParentId',
    clonePayloadBody
);
const getDockerFolderBranchCloneOrder = new Function(
    'rootId',
    'globalFolders',
    'getFolderChildren',
    branchOrderBody
);
const rollbackClonedDockerFolders = new AsyncFunction(
    'createdIds',
    '$',
    rollbackBody
);
const deleteDockerFolderBranch = new AsyncFunction(
    'id',
    'getFolderDescendants',
    '$',
    deleteBranchBody
);
const cloneDockerFolderBranchFromMenu = new AsyncFunction(
    'id',
    'runDockerGuardedAction',
    'ensureDockerFolderUnlocked',
    'globalFolders',
    'getDockerFolderBranchCloneOrder',
    'cloneDockerFolderFromMenu',
    'window',
    'normalizeFolderParentId',
    'generateDockerFolderCloneId',
    'buildDockerFolderClonePayload',
    'persistDockerFolderClonePayload',
    'rollbackClonedDockerFolders',
    '$',
    'loadlist',
    'getDockerMenuLabel',
    cloneBranchBody
);

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

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

    const payload = buildDockerFolderClonePayload(source, {
        name: 'Media Copy',
        parentId: ' child-parent '
    }, normalizeFolderParentId);

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

    const order = getDockerFolderBranchCloneOrder('root', folders, getFolderChildren);

    assert.deepEqual(order, ['root', 'childA', 'grand', 'childB']);
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

    const persistDockerFolderClonePayload = async (payload, folderId = '') => {
        const record = {
            id: String(folderId || '').trim(),
            payload: cloneJson(payload)
        };
        persistCalls.push(record);
        currentFolders[record.id] = cloneJson(payload);
    };

    const runDockerGuardedAction = async (_actionKey, action) => action();
    const generateDockerFolderCloneId = () => {
        const nextId = generatedIds.shift();
        assert.ok(nextId, 'expected deterministic clone id');
        return nextId;
    };
    const getBranchOrder = (rootId) => getDockerFolderBranchCloneOrder(rootId, currentFolders, getFolderChildren);
    const windowStub = {
        prompt: () => promptResponses.shift(),
        crypto: null,
        msCrypto: null
    };

    await cloneDockerFolderBranchFromMenu(
        'root',
        runDockerGuardedAction,
        () => true,
        currentFolders,
        getBranchOrder,
        async () => {
            throw new Error('single-folder fallback should not be used for nested branch clones');
        },
        windowStub,
        normalizeFolderParentId,
        generateDockerFolderCloneId,
        (source, overrides) => buildDockerFolderClonePayload(source, overrides, normalizeFolderParentId),
        persistDockerFolderClonePayload,
        async () => {
            throw new Error('rollback should not run during successful branch clones');
        },
        $,
        () => { loadlistCalls += 1; },
        (_key, fallback) => fallback
    );

    await cloneDockerFolderBranchFromMenu(
        'copyRoot1',
        runDockerGuardedAction,
        () => true,
        currentFolders,
        getBranchOrder,
        async () => {
            throw new Error('single-folder fallback should not be used for second-generation branch clones');
        },
        windowStub,
        normalizeFolderParentId,
        generateDockerFolderCloneId,
        (source, overrides) => buildDockerFolderClonePayload(source, overrides, normalizeFolderParentId),
        persistDockerFolderClonePayload,
        async () => {
            throw new Error('rollback should not run during successful clone-of-clone branches');
        },
        $,
        () => { loadlistCalls += 1; },
        (_key, fallback) => fallback
    );

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
    const $ = {
        post: (url, payload) => ({
            promise: async () => {
                calls.push({ url, payload: cloneJson(payload) });
                return {};
            }
        })
    };

    await deleteDockerFolderBranch('root', () => ['childA', 'childB', 'grandChild'], $);

    assert.deepEqual(
        calls.map((entry) => entry.payload.id),
        ['grandChild', 'childB', 'childA', 'root']
    );
    assert.ok(calls.every((entry) => entry.url === '/plugins/folderview.plus/server/delete.php'));
});

test('docker branch clone rollback helper deletes partial clones in reverse order before syncing order', async () => {
    const calls = [];
    const $ = {
        post: (url, payload) => ({
            promise: async () => {
                calls.push({ url, payload: cloneJson(payload) });
                return {};
            }
        })
    };

    await rollbackClonedDockerFolders(['copyRoot', 'copyChild', 'copyGrand'], $);

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
    const persistDockerFolderClonePayload = async (payload, folderId = '') => {
        const safeFolderId = String(folderId || '').trim();
        if (safeFolderId === 'copyGrand') {
            throw new Error('Simulated persist failure');
        }
        currentFolders[safeFolderId] = cloneJson(payload);
    };
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

    await assert.rejects(
        cloneDockerFolderBranchFromMenu(
            'root',
            async (_actionKey, action) => action(),
            () => true,
            currentFolders,
            (rootId) => getDockerFolderBranchCloneOrder(rootId, currentFolders, getFolderChildren),
            async () => {
                throw new Error('single-folder fallback should not run for nested branches');
            },
            { prompt: () => 'Root Copy', crypto: null, msCrypto: null },
            normalizeFolderParentId,
            () => {
                const nextId = generatedIds.shift();
                assert.ok(nextId, 'expected deterministic clone id');
                return nextId;
            },
            (source, overrides) => buildDockerFolderClonePayload(source, overrides, normalizeFolderParentId),
            persistDockerFolderClonePayload,
            async (createdIds) => {
                rollbackCalls.push([...createdIds]);
            },
            $,
            () => {},
            (_key, fallback) => fallback
        ),
        /Simulated persist failure/
    );

    assert.deepEqual(rollbackCalls, [['copyRoot', 'copyChild']]);
});
