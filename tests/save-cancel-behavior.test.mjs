import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const dirtyTrackerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.dirty.js');

test('dirty tracker module exports reusable staged-save helpers', () => {
    assert.match(dirtyTrackerJs, /window\.FolderViewPlusDirtyTracker = Object\.freeze\(\{/);
    assert.match(dirtyTrackerJs, /DEFAULT_INSTANT_PERSIST_ONCHANGE_TOKENS/);
    assert.match(dirtyTrackerJs, /const isInstantPersistInput = \(input, options = \{\}\) =>/);
    assert.match(dirtyTrackerJs, /const getTrackedInputs = \(root = document, options = \{\}\) =>/);
    assert.match(dirtyTrackerJs, /const getChangedInputs = \(inputs, baselineByInputId, serializeValue = getInputSerializedValue\) =>/);
    assert.match(dirtyTrackerJs, /const captureBaseline = \(inputs, baselineByInputId, serializeValue = getInputSerializedValue\) =>/);
    assert.match(dirtyTrackerJs, /const applyBaselineValues = \(inputs, baselineByInputId\) =>/);
});

test('settings save/cancel flow uses centralized dirty tracking and baseline restore', () => {
    assert.match(settingsJs, /const dirtyTracker = window\.FolderViewPlusDirtyTracker \|\| null;/);
    assert.match(settingsJs, /const getChangedTrackedInputs = \(\) =>/);
    assert.match(settingsJs, /dirtyTracker\.getChangedInputs\(/);
    assert.match(settingsJs, /const saveActionBarChanges = async \(closeAfterSave = false\) =>/);
    assert.match(settingsJs, /const changedInputs = getChangedTrackedInputs\(\);/);
    assert.match(settingsJs, /const cancelActionBarChanges = \(\) =>/);
    assert.match(settingsJs, /dirtyTracker && typeof dirtyTracker\.applyBaselineValues === 'function'/);
    assert.match(settingsJs, /\$\(input\)\.trigger\('input'\);/);
    assert.match(settingsJs, /\$\(input\)\.trigger\('change'\);/);
    assert.match(settingsJs, /const captureSettingsBaseline = \(\) =>/);
    assert.match(settingsJs, /dirtyTracker\.captureBaseline\(/);
});

test('folder reordering remains instant-persist and outside staged save/cancel dock', () => {
    assert.match(settingsJs, /const moveFolderRow = async \(type, folderId, direction\) =>/);
    assert.match(settingsJs, /await persistManualOrder\(resolvedType, nextOrder, \{ refresh: false \}\);/);
    assert.match(settingsJs, /await refreshType\(resolvedType\);/);
    assert.match(settingsJs, /await createBackup\(resolvedType, `before-reorder-\$\{safeFolderId\}`\);/);
    const moveBlockMatch = settingsJs.match(/const moveFolderRow = async \(type, folderId, direction\) => \{([\s\S]*?)\n\};/);
    assert.ok(moveBlockMatch, 'Expected moveFolderRow function block to exist.');
    const moveBlock = moveBlockMatch?.[1] || '';
    assert.ok(!/updateActionBarSaveState\(\)/.test(moveBlock), 'moveFolderRow should not touch staged save/cancel state.');
    assert.ok(!/captureSettingsBaseline\(\)/.test(moveBlock), 'moveFolderRow should stay instant-persist.');
});
