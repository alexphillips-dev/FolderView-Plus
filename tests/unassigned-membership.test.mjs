import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const utils = require(root + 'folderviewplus.utils.js');
const { getNames } = require(root + 'runtime.unassigned-group.js');

for (const type of ['docker', 'vm']) {
    test(`Unassigned ${type} membership comes from verified inventory and every real assignment source`, () => {
        const names = ['loose', 'manual', 'regex', 'rule', 'excluded', 'label'];
        const facts = Object.fromEntries(names.map(name => [name, {
            id: name,
            Labels: name === 'label' ? { 'folder.view3': 'Label folder' } : {}
        }]));
        const folders = {
            hidden: { name: 'Hidden', containers: ['manual', 'missing'] },
            matched: { name: 'Matched', regex: '^(regex|manual)$' },
            rule: { name: 'Rule' },
            label: { name: 'Label folder' }
        };
        const rules = [
            { id: 'exclude', kind: 'name_regex', effect: 'exclude', pattern: '^excluded$' },
            { id: 'include', kind: 'name_regex', folderId: 'rule', pattern: '^(rule|excluded)$' }
        ];
        const base = { type, infoByName: facts, folders, rules, names: [...names, 'unknown'], displayFolderIds: ['matched', 'rule', 'label'] };
        const uncovered = type === 'docker' ? ['loose', 'excluded'] : ['loose', 'excluded', 'label'];
        const snapshot = utils.buildMembershipSnapshot(base);
        assert.deepEqual(getNames(snapshot), uncovered);
        assert.equal(snapshot.primaryOwnerByName.manual, 'matched');
        const changedFolders = { ...folders, hidden: { ...folders.hidden, containers: ['loose'] } };
        const changed = utils.buildMembershipSnapshot({ ...base, folders: changedFolders });
        assert.deepEqual(getNames(changed), uncovered.slice(1));
        assert.deepEqual(getNames(utils.buildMembershipSnapshot({ ...base, infoByName: {} })), []);
        assert.deepEqual(getNames(null), []);
    });
}
