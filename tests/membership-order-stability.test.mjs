import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const runtimeInfo = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.info.js');
const reverseMap = map => Object.fromEntries(Object.entries(map).reverse());
const fixture = () => {
    const raw = {
        'fixture-z': { id: 'aaaaaaaaaaaa', Image: 'fixture/z:latest', Labels: { scope: 'fixture' } },
        'fixture-a': { id: 'bbbbbbbbbbbb', Image: 'fixture/a:latest', Labels: { scope: 'fixture' } }
    };
    const normalizer = runtimeInfo.createApi({ window: {} });
    const folders = {
        first: { name: 'First', containers: ['fixture-z', 'fixture-a'] },
        second: { name: 'Second', containers: [], regex: '^fixture-' }
    };
    const rules = [{ id: 'scope', folderId: 'first', kind: 'label', labelKey: 'scope', labelValue: 'fixture' }];
    return { raw, normalizer, options: { type: 'docker', folders, rules,
        names: ['fixture-z', 'fixture-a'], displayFolderIds: ['second', 'first'],
        infoByName: normalizer.normalizeDockerRuntimeInfoMap(raw, {}) } };
};

test('membership signatures ignore resource-map order with explicit and inferred names', () => {
    const { options } = fixture();
    for (const names of [options.names, []]) {
        const input = { ...options, names };
        assert.equal(utils.getMembershipSignature(input), utils.getMembershipSignature({ ...input, infoByName: reverseMap(input.infoByName) }));
    }
    assert.deepEqual(Object.keys(options.infoByName), ['fixture-z', 'fixture-a'], 'canonicalization must not mutate the runtime map');
});

test('canonical facts preserve explicit member, display and rule priority order', () => {
    const { options } = fixture(), snapshot = utils.buildMembershipSnapshot(options);
    const reordered = utils.buildMembershipSnapshot({ ...options, infoByName: reverseMap(options.infoByName) });
    assert.equal(reordered.signature, snapshot.signature);
    assert.deepEqual(reordered.names, ['fixture-z', 'fixture-a']);
    assert.deepEqual(reordered.byFolder.first.manualMembers, ['fixture-z', 'fixture-a']);
    assert.deepEqual(reordered.byFolder.second.liveMembers, ['fixture-z', 'fixture-a']);
    assert.deepEqual(reordered.displayFolderIds, ['second', 'first']);
    assert.equal(reordered.primaryOwnerByName['fixture-z'], 'second');
    const displayChanged = utils.buildMembershipSnapshot({ ...options, displayFolderIds: ['first', 'second'] });
    assert.notEqual(displayChanged.signature, snapshot.signature);
    assert.equal(displayChanged.primaryOwnerByName['fixture-z'], 'first');
    for (const change of [
        { names: [...options.names].reverse() },
        { folders: { ...options.folders, first: { ...options.folders.first, containers: ['fixture-a', 'fixture-z'] } } },
        { folders: { ...options.folders, second: { ...options.folders.second, parentId: 'first' } } }
    ]) assert.notEqual(utils.getMembershipSignature({ ...options, ...change }), snapshot.signature);
    const rules = ['first', 'second'].map(folderId => ({ id: folderId, folderId, kind: 'name_regex', pattern: '^fixture-' }));
    const first = utils.buildMembershipSnapshot({ ...options, rules });
    const second = utils.buildMembershipSnapshot({ ...options, rules: [...rules].reverse() });
    assert.notEqual(first.signature, second.signature);
    assert.equal(first.decisionsByName['fixture-z'].assignedRule.folderId, 'first');
    assert.equal(second.decisionsByName['fixture-z'].assignedRule.folderId, 'second');
});

test('repeated lightweight and reversed detail hydration retain accepted Docker membership', () => {
    const { options, raw, normalizer } = fixture();
    const checker = runtimeInfo.createApi({ window: {}, utils });
    const detailed = Object.fromEntries(Object.keys(raw).reverse().map(name => [name, {
        Id: raw[name].id.padEnd(64, '0'), Image: raw[name].Image, Labels: raw[name].Labels,
        info: { Id: raw[name].id.padEnd(64, '0'), Name: name,
            Config: { Image: raw[name].Image, Labels: raw[name].Labels }, State: { Running: false } }
    }]));
    let map = options.infoByName;
    for (let cycle = 0; cycle < 4; cycle++) {
        const light = normalizer.normalizeDockerRuntimeInfoMap(raw, map);
        const snapshot = utils.buildMembershipSnapshot({ ...options, infoByName: light });
        checker.setMembershipSnapshot(snapshot);
        map = normalizer.normalizeDockerRuntimeInfoMap(detailed, light);
        assert.equal(checker.membershipInputsChanged(map), false, `detail hydration cycle ${cycle}`);
        assert.equal(checker.membershipInputsChanged(normalizer.normalizeDockerRuntimeInfoMap(raw, map)), false, `state refresh cycle ${cycle}`);
    }
});

test('real identity, image, relevant label and inventory changes still invalidate membership', () => {
    const { options } = fixture(), checker = runtimeInfo.createApi({ window: {}, utils });
    checker.setMembershipSnapshot(utils.buildMembershipSnapshot(options));
    const current = options.infoByName['fixture-z'];
    const changes = [
        { ...current, id: 'cccccccccccc', shortId: 'cccccccccccc' },
        { ...current, image: 'fixture/z:changed', Image: 'fixture/z:changed' },
        { ...current, Labels: { scope: 'changed' } }
    ];
    for (const entry of changes) assert.equal(checker.membershipInputsChanged({ ...options.infoByName, 'fixture-z': entry }), true);
    assert.equal(checker.membershipInputsChanged({ 'fixture-a': options.infoByName['fixture-a'] }), true);
    assert.equal(checker.membershipInputsChanged({ ...options.infoByName, 'fixture-new': { id: 'dddddddddddd' } }), true);
    assert.equal(checker.membershipInputsChanged({ ...options.infoByName, 'fixture-z': {
        ...current, Labels: { ...current.Labels, unrelated: 'changed' },
        info: { ...current.info, State: { ...current.info.State, Running: true, Updated: false } }
    } }), false, 'status and unrelated labels are not membership changes');
});

test('VM and Dashboard-style signature comparisons ignore inventory order and retain UUID changes', () => {
    const infoByName = { 'fixture-vm-z': { uuid: '00000000-0000-4000-8000-000000000001' },
        'fixture-vm-a': { uuid: '00000000-0000-4000-8000-000000000002' } };
    const options = { type: 'vm', infoByName };
    assert.equal(utils.getMembershipSignature(options), utils.getMembershipSignature({ ...options, infoByName: reverseMap(infoByName) }));
    assert.notEqual(utils.getMembershipSignature(options), utils.getMembershipSignature({ ...options,
        infoByName: { ...infoByName, 'fixture-vm-z': { uuid: '00000000-0000-4000-8000-000000000003' } } }));
});
