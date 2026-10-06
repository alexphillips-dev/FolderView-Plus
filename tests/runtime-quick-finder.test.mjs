import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { buildIndex, searchIndex, RESULT_LIMIT } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.quick-finder.js');

test('Quick finder resolves direct and aggregated membership to the deepest nested owner', () => {
    const folders = {
        home: { name: 'Home', containers: { assistant: {}, mqtt: {} } },
        services: { name: 'Services', parentId: 'home', containers: { assistant: {} } }
    };
    const index = buildIndex(folders, { assistant: { state: true }, mqtt: {}, unassigned: {} });
    assert.equal(index.find(item => item.id === 'assistant').path, 'Home › Services');
    assert.deepEqual(index.find(item => item.id === 'assistant').ancestors, ['home', 'services']);
    assert.equal(index.find(item => item.id === 'mqtt').path, 'Home');
    assert.equal(index.find(item => item.id === 'unassigned').path, '');
    assert.equal(searchIndex(index, 'HOME services', 'item').length, 1);
    assert.equal(searchIndex(index, 'home', 'folder').length, 2);
    assert.deepEqual(searchIndex(index), []);
    assert.deepEqual(searchIndex(index, '   '), []);
});

test('Quick finder handles persisted member arrays, cycles, accents, and special names as plain data', () => {
    const folders = {
        a: { name: 'Média', parentId: 'b', containers: ['<img onerror=alert(1)>'] },
        b: { name: 'Archive', parent_id: 'a' }
    };
    const index = buildIndex(folders, { '<img onerror=alert(1)>': {} });
    assert.equal(searchIndex(index, 'media', 'item').length, 1);
    assert.equal(searchIndex(index, 'onerror')[0].name, '<img onerror=alert(1)>');
    assert.ok(index.every(item => item.ancestors.length <= 2));
    assert.equal(searchIndex(index, 'missing').length, 0);
});

test('Quick finder builds independently scoped Docker and VM indexes and refreshes removed items', () => {
    const docker = buildIndex({}, { Plex: {} });
    const vm = buildIndex({}, { Ubuntu: {} });
    assert.equal(searchIndex(docker, 'Ubuntu').length, 0);
    assert.equal(searchIndex(vm, 'Plex').length, 0);
    assert.equal(buildIndex({}, {}).length, 0);
});

test('Quick finder supports large indexes without truncating matching counts', () => {
    const runtime = Object.fromEntries(Array.from({ length: 5000 }, (_, index) => [`Service ${index}`, {}]));
    const index = buildIndex({}, runtime);
    assert.equal(searchIndex(index, 'service').length, 5000);
    assert.equal(searchIndex(index, 'service 4999').length, 1);
    assert.ok(RESULT_LIMIT <= 50);
});
