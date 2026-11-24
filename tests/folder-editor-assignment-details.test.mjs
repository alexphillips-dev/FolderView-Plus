import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const base = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts';
const { buildAssignmentDetails } = require(`${base}/folder.editor.members.js`);
const utils = require(`${base}/folderviewplus.utils.js`);
const ordering = require(`${base}/runtime.folder-ordering.js`);
const memberIdentity = require(`${base}/folder.member-identity.js`);

const rule = (id, folderId, pattern, effect = 'include') => ({ id, folderId, pattern, effect, kind: 'name_regex' });
const makeDetails = (type, folders, infoByName, options = {}) => buildAssignmentDetails({
    utils, ordering, memberIdentity, type, folders, infoByName, folderId: 'active',
    draft: { name: folders.active.name, regex: folders.active.regex || '', containers: folders.active.containers || [] },
    prefs: { autoRules: [], sortMode: 'created' }, order: ['folder-other', 'folder-active'],
    ...options
});
const matches = (result, name) => result.rows.get(name)?.matches.map(({ id, reason }) => [id, reason]);

test('folder editor explains native matches, effective saved order and excluded rule precedence', () => {
    const folders = {
        active: { name: 'Alpha', regex: '^regex', containers: ['manual', 'disconnected'] },
        other: { name: 'Other', containers: ['manual'] }
    };
    const facts = {
        manual: { Labels: { 'folderview.plus': 'Alpha' } },
        labeled: { Labels: { 'folderview.plus': 'Alpha' }, Config: { Env: ['PRIVATE_ENV=requires-redaction'] } },
        regex: {},
        scripted: { Labels: { 'example.private': 'sensitive-label-value' } },
        excluded: {},
        constructor: {}
    };
    const prefs = { autoRules: [
        rule('exclude-first', 'active', '^excluded$', 'exclude'),
        rule('include-second', 'other', '^excluded$'),
        { id: 'include-label', kind: 'label', folderId: 'active', labelKey: 'example.private', labelValue: 'sensitive-label-value' },
        rule('include-constructor', 'active', '^constructor$')
    ] };
    const result = makeDetails('docker', folders, facts, { prefs });
    assert.equal(result.preview, false);
    assert.deepEqual(matches(result, 'manual'), [['active', 'manual'], ['other', 'manual']]);
    assert.equal(result.rows.get('manual').owner.id, 'other');
    assert.equal(result.rows.get('labeled').owner.reason, 'label');
    assert.equal(result.rows.get('regex').owner.reason, 'regex');
    assert.equal(result.rows.get('scripted').owner.reason, 'rule');
    assert.equal(result.rows.get('constructor').owner.reason, 'rule');
    assert.equal(result.rows.has('excluded'), false);
    assert.equal(result.rows.get('disconnected').owner, null);
    assert.equal(result.rows.get('disconnected').active.reason, 'manual');
    assert.doesNotMatch(JSON.stringify([...result.rows]), /PRIVATE_ENV|sensitive-label-value|example\.private|include-label/);
    const noOrder = makeDetails('docker', folders, facts, { prefs, order: null });
    assert.equal(noOrder.rows.get('manual').owner, null);
    assert.equal(noOrder.rows.get('labeled').owner.id, 'active');
});

test('folder editor explains only the accepted FolderView3 manual, label and first applicable rule', () => {
    const folders = {
        active: { name: 'Imported', regex: 'phantom', containers: ['manual', 'disconnected'], membershipPolicy: 'folderview3' },
        other: { name: 'Other', membershipPolicy: 'folderview3' }
    };
    const facts = {
        manual: { Labels: { 'folder.view3': 'Other' } },
        labeled: { Labels: { 'folder.view3': 'Imported' } },
        moved: { Labels: { 'folder.view3': 'Other' } },
        ruled: {},
        image: { Image: 'synthetic/advanced:v1' },
        phantom: {}
    };
    const prefs = { autoRules: [
        rule('otherRule', 'other', 'manual|labeled'),
        rule('fv3-regex-docker-fixture', 'active', 'ruled|moved'),
        { id: 'image', kind: 'image_regex', folderId: 'active', pattern: '^synthetic/advanced' }
    ] };
    const original = structuredClone(folders);
    const result = makeDetails('docker', folders, facts, { prefs });
    assert.equal(result.rows.get('manual').owner.reason, 'manual');
    assert.deepEqual(matches(result, 'manual'), [['active', 'manual']]);
    assert.deepEqual(matches(result, 'labeled'), [['active', 'label']]);
    assert.deepEqual(matches(result, 'moved'), [['other', 'label']]);
    assert.deepEqual(matches(result, 'ruled'), [['active', 'regex']]);
    assert.deepEqual(matches(result, 'image'), [['active', 'rule']]);
    assert.deepEqual(matches(result, 'disconnected'), [['active', 'manual']]);
    assert.equal(result.rows.has('phantom'), false);

    const draft = { name: 'Imported', regex: '^moved$', containers: ['labeled'] };
    const preview = makeDetails('docker', folders, facts, { prefs, draft });
    assert.equal(preview.preview, true);
    assert.deepEqual(matches(preview, 'manual'), [['other', 'label']]);
    assert.deepEqual(matches(preview, 'labeled'), [['active', 'manual']]);
    assert.deepEqual(matches(preview, 'moved'), [['other', 'label']]);
    assert.deepEqual(folders, original);
});

test('folder editor honors VM pin order and identity renames without writing saved folders', () => {
    const uuid = '3d0fa0f1-13e7-9945-9e1f-8a131281bbd0';
    const folders = {
        active: { name: 'Alpha', containers: ['old-vm'], memberIdentities: { 'old-vm': { kind: 'vm', uuid } } },
        other: { name: 'Other', regex: '^current-vm$' }
    };
    const facts = { 'current-vm': { name: 'current-vm', uuid, Labels: { 'folder.view3': 'Alpha' } } };
    const saved = makeDetails('vm', folders, facts, { prefs: { pinnedFolderIds: ['active'] } });
    assert.deepEqual(matches(saved, 'current-vm'), [['active', 'manual'], ['other', 'regex']]);
    assert.equal(saved.rows.get('current-vm').owner.id, 'active');
    assert.deepEqual(folders.active.containers, ['old-vm']);
    const unpinned = makeDetails('vm', folders, facts);
    assert.equal(unpinned.rows.get('current-vm').owner.id, 'other');
    const draft = { name: 'Alpha', regex: '', containers: [] };
    assert.deepEqual(matches(makeDetails('vm', folders, facts, { draft }), 'current-vm'), [['other', 'regex']]);
    const imported = { active: { ...folders.active, containers: [], membershipPolicy: 'folderview3' } };
    const almostSameFacts = { ...facts, 'unrelated-vm': {} };
    const importedDetails = makeDetails('vm', imported, almostSameFacts, { prefs: { autoRules: [
        rule('fv3-regex-vm-fixture', 'active', '^current-vm$')
    ] } });
    assert.deepEqual(matches(importedDetails, 'current-vm'), [['active', 'regex']]);
    assert.equal(importedDetails.rows.has('unrelated-vm'), false);
});

test('folder editor shows a new unnamed assignment as preview and ignores member-only reorder', () => {
    const folders = { active: { name: 'Active', containers: ['one', 'two'] } };
    const facts = { one: {}, two: {}, three: {} };
    const reordered = makeDetails('docker', folders, facts, { draft: { name: 'Active', regex: '', containers: ['two', 'one'] } });
    assert.equal(reordered.preview, false);
    const draft = makeDetails('docker', folders, facts, { folderId: '', draft: { name: '', regex: '^three$', containers: [] } });
    assert.equal(draft.preview, true);
    assert.equal(draft.rows.get('three').owner.folderName, '(unnamed)');
    assert.equal(draft.rows.get('three').owner.reason, 'regex');
});
