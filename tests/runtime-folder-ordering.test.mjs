import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ordering = require(path.join(process.cwd(), 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.folder-ordering.js'));

test('shared folder ordering retains completed/current folders and non-folder members', () => {
    const result = ordering.buildCustomOrder({
        order: ['alpha', 'folder-one', 'beta', 'folder-two', 'folder-three'],
        completedFolderIds: ['one'],
        currentFolderId: 'three'
    });
    assert.deepEqual(result, ['alpha', 'folder-one', 'beta', 'folder-three']);
});

test('order cursor removal is stable and never removes the last item for an unknown member', () => {
    const cursor = ordering.createOrderCursor({ order: ['alpha', 'beta', 'gamma'] });
    assert.equal(cursor.indexOf('beta'), 1);
    assert.equal(cursor.remove('missing'), -1);
    assert.deepEqual(cursor.snapshot(), ['alpha', 'beta', 'gamma']);
    assert.equal(cursor.remove('beta'), 1);
    assert.deepEqual(cursor.snapshot(), ['alpha', 'gamma']);
    cursor.destroy();
    assert.equal(cursor.indexOf('alpha'), -1);
    assert.deepEqual(cursor.snapshot(), []);
});
