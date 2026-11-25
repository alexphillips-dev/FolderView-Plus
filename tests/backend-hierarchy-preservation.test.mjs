import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.resolve('tests/fixtures/backend-hierarchy-preservation.php');
const run = (scenario) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-hierarchy-preservation-'));
    try {
        return JSON.parse(execFileSync('php', [fixture, server, root, scenario], { encoding: 'utf8', timeout: 30000 }));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
};

test('Global Undo restores saved orphan and cycle links without projecting them away during verification', () => {
    const result = run('rollback');
    assert.deepEqual(result.originalParents, ['', 'missing-parent', 'cycle-b', 'cycle-a']);
    assert.equal(result.exportParents[1], '');
    assert.deepEqual(result.capturedParents, result.originalParents);
    assert.equal(result.importParents[1], '');
    assert.match(result.failedVerification, /verification failed for vm folders/);
    assert.deepEqual(result.failedRestoreParents, result.importParents);
    assert.equal(result.failedRestoreNative, 'fixture-second 20\n');
    assert.deepEqual(result.restoredVmParents, result.originalParents);
    assert.deepEqual(result.restoredDockerParents, result.originalParents);
    assert.equal(result.restoredNative, 'fixture-first 14\n');
    assert.equal(result.restoredName, 'Original');
    assert.equal(result.result.verified, true);
    assert.deepEqual(result.historical, { verified: true, parents: result.exportParents });
});

test('Rule Preview and apply tolerate unrelated hierarchy issues and fence stale saved links', () => {
    const result = run('rule');
    assert.equal(result.previewIsReadOnly, true);
    assert.equal(result.preview.ready, true);
    assert.deepEqual(result.preview.assignments, [{ folderId: 'target', items: ['fixture-member'] }]);
    assert.equal(result.stale, true);
    assert.equal(result.assigned, 1);
    assert.deepEqual(result.containers, ['fixture-member']);
    assert.deepEqual(result.parents, ['', 'different-missing-parent', 'cycle-b', 'cycle-a']);
    assert.deepEqual(result.backupParents, result.parents);
    assert.match(result.malformedRejected, /Configuration is unavailable/);
});

test('Operations templates preserve destination-owned child order and WebUI profiles, including historical templates', () => {
    const result = run('template');
    assert.equal(result.createdSettings.fixtureBehavior, 'portable');
    for (const setting of ['child_folder_order', 'childFolderOrder', 'webui_profiles', 'webuiProfiles']) {
        assert.equal(Object.hasOwn(result.createdSettings, setting), false, setting);
    }
    assert.equal(result.settings.fixtureBehavior, 'portable');
    assert.deepEqual(result.settings.child_folder_order, ['target-b', 'target-a']);
    assert.deepEqual(result.settings.childFolderOrder, result.settings.child_folder_order);
    assert.equal(result.settings.webui_profiles[0].id, 'target-profile');
    assert.deepEqual(result.traversal, ['source', 'source-b', 'source-a', 'target', 'target-b', 'target-a']);
});

test('Batch creation and hierarchy traversal preserve distinct ordered children through the 128-byte ID limit', () => {
    const result = run('child-order');
    assert.deepEqual(result.expectedOrder.slice(0, 3).map(id => id.length), [128, 65, 64]);
    assert.deepEqual(result.savedOrder, result.expectedOrder);
    assert.deepEqual(result.alias, result.expectedOrder);
    assert.deepEqual(result.createdIds, [...result.expectedOrder.slice(0, 3)].reverse());
    assert.deepEqual(result.traversal, ['parent', ...result.expectedOrder]);
});
