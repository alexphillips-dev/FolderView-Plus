import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const require = createRequire(import.meta.url);
const recovery = require(root + 'runtime.folder-render-recovery.js');
const state = require(root + 'folder.runtime.state-observers.js');
const dockerFolderGroupingModule = require(root + 'docker.runtime.folder-grouping.js');
const { isDashboardFolderToken } = require(root + 'dashboard.folder-match-cache.js').createApi();
const read = (file) => fs.readFileSync(new URL(root + file, import.meta.url), 'utf8');
const createRecovery = () => recovery.create({
    window: { MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } } },
    document: { body: {}, activeElement: null }, getRoot: () => ({})
});

for (const [file, type, suffix, index] of [
    ['docker.js', 'docker', '', 0], ['vm.js', 'vm', '', 0],
    ['dashboard.js', 'docker', 'Docker', 0], ['dashboard.js', 'vm', 'VM', 1]
]) {
    test(`${file} ${type} ordered loop continues after a renderer throws`, () => {
        const source = read(file);
        const loop = [...source.matchAll(/^( {4}| {8})for \(let key = 0; key < order.length; key\+\+\) \{[\s\S]*?^\1\}/gm)][index]?.[0];
        assert.ok(loop, 'Extract the actual ordered render loop');
        const wrapper = source.match(new RegExp('^const createFolder' + suffix + ' = \\(\\.\\.\\.args\\).*$', 'm'))?.[0];
        assert.ok(wrapper, 'Use the production recovery wrapper');
        const vmFolderToken = file === 'vm.js' ? source.match(/^const isVmSavedFolderToken = .*;$/m)?.[0] : '';
        const dockerFolderToken = file === 'docker.js' ? source.match(/^const isKnownDockerFolderToken = [\s\S]*?;\r?$/m)?.[0] : '';
        if (file === 'vm.js') assert.ok(vmFolderToken, 'Use the production VM folder-token matcher');
        if (file === 'docker.js') assert.ok(dockerFolderToken, 'Use the production Docker folder-token matcher');
        const controller = createRecovery();
        const attempts = [];
        const folders = { broken: { name: 'Private folder', status: { expanded: true } }, healthy: { name: 'Healthy' } };
        const broken = folders.broken;
        const context = {
            folders, foldersDone: {}, order: ['folder-broken', 'folder-healthy'], folderRegex: /^folder-/, isDashboardFolderToken, dockerFolderGroupingModule,
            captureDebug: false,
            containersInfo: {}, vmInfo: {}, newOnes: [], folderMatchCache: {}, folderDepthById: {},
            dockerChildrenByParent: {}, vmChildrenByParent: {}, dockerFullMatchCache: {}, dockerMatchCache: {},
            vmFullMatchCache: {}, vmMatchCache: {}, createdRootIds: [], createdRootVmIds: [],
            dockerFolderRenderRecovery: controller, vmFolderRenderRecovery: controller,
            dashboardFolderRenderRecovery: { docker: controller, vm: controller },
            [suffix ? 'renderFolder' + suffix : (type === 'docker' ? 'renderDockerFolder' : 'renderVmFolder')]: (folder, id) => {
                attempts.push(id);
                if (id === 'broken') { folder.status.expanded = false; throw new Error('private failure detail'); }
                return 0;
            }
        };
        vm.runInNewContext([vmFolderToken, dockerFolderToken, wrapper, loop].join('\n'), context);
        assert.deepEqual(attempts, ['broken', 'healthy']);
        assert.deepEqual(Object.keys(context.foldersDone), ['healthy']);
        assert.deepEqual(context.order, ['folder-healthy']);

        if (file === 'docker.js') {
            controller.begin();
            context.order = ['folder-slot:broken', 'folder-broken'];
            vm.runInNewContext("createFolder({ status: { expanded: true } }, 'broken', 0, order, { 'folder-broken': {} });", context);
            assert.deepEqual(context.order, ['folder-broken'], 'A failed folder render removes only the internal anchor and preserves a colliding native name');
        }

        assert.equal(broken.status.expanded, true);
        assert.deepEqual(controller.snapshot(), { failedFolderCount: 1, recoveredFolderCount: 1 });
        assert.doesNotMatch(JSON.stringify(controller.snapshot()), /Private|broken|failure detail/);
        const remaining = [...source.matchAll(/^( {4}| {8})for \(const \[id, value\] of remaining(?:Docker|Vm)?Folders\) \{[\s\S]*?^\1\}/gm)][index]?.[0];
        assert.ok(remaining, 'Extract the actual remaining-folder loop');
        controller.begin();
        attempts.length = 0;
        context.order = [];
        context.folders = { broken, healthy: { name: 'Healthy' } };
        context.foldersDone = {};
        context.FOLDER_VIEW_DEBUG_MODE = false;
        for (const key of ['remainingFolders', 'remainingDockerFolders', 'remainingVmFolders']) {
            context[key] = Object.entries(context.folders);
        }
        vm.runInNewContext(remaining, context);
        assert.deepEqual(attempts, ['broken', 'healthy']);
        assert.deepEqual(Object.keys(context.foldersDone), ['healthy']);
        assert.deepEqual(context.order, ['folder-healthy']);

        if (file === 'dashboard.js') {
            controller.begin();
            context.order = ['folder-broken'];
            vm.runInNewContext(`createFolder${suffix}({ status: { expanded: true } }, 'broken', 0, order, { 'folder-broken': {} });`, context);
            assert.deepEqual(context.order, ['folder-broken'], 'A failed folder render preserves the live name that matches its token');
        }
    });
}

for (const [type, title, func] of [['docker', 'Docker', 'Docker'], ['vm', 'Vm', 'VM']]) {
    test(`Dashboard ${type} children survive failures in their ancestors`, () => {
        const source = read('dashboard.js');
        const renderer = source.match(new RegExp('        const render' + title + 'Children = [\\s\\S]*?^        };', 'm'))?.[0];
        assert.ok(renderer);
        const controller = createRecovery();
        const folders = { child: {}, failedChild: {}, grandchild: {} };
        const children = { parent: ['child', 'failedChild'], failedChild: ['grandchild'] };
        const order = [];
        controller.render({}, 'parent', order, () => { throw new Error('parent failed'); });
        const targets = {};
        const context = {
            dashboardFolderRenderRecovery: { [type]: controller },
            [type + 'ChildrenByParent']: children,
            ['all' + title + 'Folders']: folders,
            ['createdNested' + (type === 'vm' ? 'Vm' : '') + 'Ids']: new Set(),
            folderTypePrefs: { [type]: {} }, sortFolderIdsByPrefs: (ids) => ids,
            [type + 'FullMatchCache']: {}, order, containersInfo: {}, vmInfo: {}, foldersDone: {},
            captureDebug: false,
            ['createFolder' + func]: (folder, id, _position, liveOrder, _info, _done, _cache, options) =>
                controller.render(folder, id, liveOrder, () => {
                    if (id === 'failedChild') throw new Error('child failed');
                    targets[id] = options.appendTo;
                })
        };
        vm.runInNewContext(renderer + '\nrender' + title + 'Children("parent");', context);
        assert.deepEqual(Object.keys(context.foldersDone), ['child', 'grandchild']);
        assert.deepEqual(targets, { child: undefined, grandchild: undefined });
    });
}

test('expanding a healthy folder preserves failed folder preferences until a successful rebuild', () => {
    let saved = { broken: true, healthy: false, deleted: true };
    let failed = ['broken'];
    const controller = state.createExpandedStateController({
        window: {}, readServerMap: () => saved, writeServerMap: (next) => { saved = next; },
        readFolders: () => ({ healthy: { status: { expanded: true } } }),
        readPreservedIds: () => failed
    });
    controller.persistStateFromGlobal(false);
    assert.deepEqual(saved, { broken: true, healthy: true });
    failed = [];
    controller.persistStateFromGlobal(false);
    assert.deepEqual(saved, { healthy: true });
});

test('rollback cleanup is isolated to the active failed render', () => {
    const controller = createRecovery();
    const calls = [];
    controller.render({}, 'healthy', [], () => recovery.registerCleanup(() => calls.push('healthy')));
    controller.render({}, 'broken', [], () => {
        recovery.registerCleanup(() => calls.push('broken'));
        recovery.registerCleanup(() => { throw new Error('cleanup failure'); });
        throw new Error('render failure');
    });
    assert.deepEqual(calls, ['broken']);
    controller.begin();
    assert.deepEqual(controller.snapshot(), { failedFolderCount: 0, recoveredFolderCount: 0 });
});
