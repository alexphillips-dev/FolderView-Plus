import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const settingsTreeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js');
const settingsRuntimeJs = `${settingsTreeJs}\n${settingsJs}`;
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

test('settings runtime keeps centralized dirty tracking and baseline capture without a staged save dock', () => {
    assert.match(settingsJs, /const dirtyTracker = window\.FolderViewPlusDirtyTracker \|\| null;/);
    assert.match(settingsJs, /const getSectionBehaviorHint = \(sectionOrKey = null\) =>/);
    assert.match(settingsJs, /const getChangedTrackedInputs = \(\) =>/);
    assert.match(settingsJs, /dirtyTracker\.getChangedInputs\(/);
    assert.match(settingsJs, /const captureSettingsBaseline = \(\) =>/);
    assert.match(settingsJs, /dirtyTracker\.captureBaseline\(/);
    assert.doesNotMatch(settingsJs, /const saveActionBarChanges = async \(\) =>/);
    assert.doesNotMatch(settingsJs, /const cancelActionBarChanges = \(\) =>/);
    assert.doesNotMatch(settingsJs, /const resetCurrentSectionToBaseline = \(\) =>/);
    assert.doesNotMatch(settingsJs, /fv-settings-action-bar/);
    assert.doesNotMatch(settingsJs, /fv-action-save-close/);
});

test('folder reordering remains instant-persist and outside staged save/cancel dock', () => {
    assert.match(settingsRuntimeJs, /const moveFolderRow = async \(type, folderId, direction\) =>/);
    assert.match(settingsRuntimeJs, /const applyOptimisticManualOrder = \(type, order\) =>/);
    assert.match(settingsRuntimeJs, /const createFolderReorderQueueState = \(\) => \(\{/);
    assert.match(settingsRuntimeJs, /const queueFolderReorderPersist = \(type, \{/);
    assert.match(settingsRuntimeJs, /const flushQueuedFolderReorderPersist = async \(type\) => \{/);
    assert.match(settingsRuntimeJs, /applyOptimisticManualOrder\(resolvedType, nextOrder\);/);
    assert.match(settingsRuntimeJs, /focusFolderRow\(resolvedType, safeFolderId\);[\s\S]*queueFolderReorderPersist\(resolvedType, \{/);
    const moveBlockMatch = settingsRuntimeJs.match(/const moveFolderRow = async \(type, folderId, direction\) => \{([\s\S]*?)\n\};/);
    assert.ok(moveBlockMatch, 'Expected moveFolderRow function block to exist.');
    const moveBlock = moveBlockMatch?.[1] || '';
    assert.ok(!/updateActionBarSaveState\(\)/.test(moveBlock), 'moveFolderRow should not touch staged save/cancel state.');
    assert.ok(!/captureSettingsBaseline\(\)/.test(moveBlock), 'moveFolderRow should stay instant-persist.');
    assert.ok(!/await createBackup\(/.test(moveBlock), 'moveFolderRow should not create backups inline.');
    assert.ok(!/await persistManualOrder\(/.test(moveBlock), 'moveFolderRow should not persist order inline.');
    const persistBlockMatch = settingsRuntimeJs.match(/const persistManualOrder = async \(type, order, \{ refresh = true \} = \{\}\) => \{([\s\S]*?)\n\};/);
    assert.ok(persistBlockMatch, 'Expected persistManualOrder function block to exist.');
    const persistBlock = persistBlockMatch?.[1] || '';
    assert.match(persistBlock, /const persistedOrder = sanitizeManualOrderList\(/);
    assert.match(persistBlock, /prefsByType\[resolvedType\] = nextPrefs;/);
    assert.ok(!/await postPrefs\(resolvedType, nextPrefs\)/.test(persistBlock), 'persistManualOrder should not issue a duplicate prefs save.');
    const flushBlockMatch = settingsRuntimeJs.match(/const flushQueuedFolderReorderPersist = async \(type\) => \{([\s\S]*?)\n\};/);
    assert.ok(flushBlockMatch, 'Expected flushQueuedFolderReorderPersist function block to exist.');
    const flushBlock = flushBlockMatch?.[1] || '';
    assert.match(flushBlock, /session\.backupPromise = createBackup\(resolvedType, backupReason\)/);
    assert.match(flushBlock, /await persistManualOrder\(resolvedType, orderToPersist, \{ refresh: false \}\);/);
    assert.match(flushBlock, /await recordTreeMoveHistoryFromBackup\(/);
    assert.match(flushBlock, /prefsByType\[resolvedType\] = baselinePrefs;\s*renderTable\(resolvedType\);/);
    assert.match(flushBlock, /await refreshType\(resolvedType\);/);
});

test('legacy staged-save dock helpers stay removed from the settings runtime', () => {
    assert.doesNotMatch(settingsJs, /saveActionBarChanges/);
    assert.doesNotMatch(settingsJs, /cancelActionBarChanges/);
    assert.doesNotMatch(settingsJs, /resetCurrentSectionToBaseline/);
    assert.doesNotMatch(settingsJs, /#fv-action-save/);
    assert.doesNotMatch(settingsJs, /#fv-action-cancel/);
    assert.doesNotMatch(settingsJs, /#fv-action-reset-section/);
});

test('bulk assignment helpers stay out of staged save tracking', () => {
    assert.match(dirtyTrackerJs, /String\(input\.dataset\?\.fvTrackSave \|\| ''\) === '0'/);
    assert.match(settingsJs, /const shouldTrackSettingsInput = \(input, section = null\) =>/);
    assert.match(settingsJs, /if \(getSectionBehaviorHint\(ownerSection\) === 'instant'\) \{/);
    assert.match(settingsJs, /shouldTrackInput:\s*shouldTrackSettingsInput/);
    assert.match(settingsJs, /filter\(\(input\) => shouldTrackSettingsInput\(input, section\)\)/);
});
