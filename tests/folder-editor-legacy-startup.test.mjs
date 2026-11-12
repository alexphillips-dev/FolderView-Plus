import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js', 'utf8');
const start = source.indexOf('    // iterate over the folders');
const end = source.indexOf('    choose.sort(', start);
assert.ok(start > 0 && end > start);
const applyOtherFolders = new Function('folders', 'choose', source.slice(start, end));

test('invalid saved legacy regex does not prevent editing and still reserves explicit members', () => {
    const folders = { broken: { regex: '[', containers: ['owned'] }, valid: { regex: '^auto-', containers: [] } };
    const choose = ['owned', 'auto-one', 'available'].map(Name => ({ Name }));
    assert.doesNotThrow(() => applyOtherFolders(folders, choose));
    assert.deepEqual(choose.map(member => member.Name), ['available']);
    assert.equal(folders.broken.regex, '[');
    assert.deepEqual(folders.broken.containers, ['owned']);
    assert.deepEqual(folders.valid.containers, ['auto-one']);
});

test('valid and empty legacy patterns retain their existing membership behavior', () => {
    const folders = { explicit: { regex: '', containers: ['owned'] }, valid: { regex: '^auto-', containers: [] } };
    const choose = ['owned', 'auto-one', 'auto-two', 'available'].map(Name => ({ Name }));
    applyOtherFolders(folders, choose);
    assert.deepEqual(choose.map(member => member.Name), ['available']);
    assert.deepEqual(folders.valid.containers, ['auto-one', 'auto-two']);
});
