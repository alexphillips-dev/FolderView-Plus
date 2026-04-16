import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');

test('vm runtime includes docker-parity quick state actions and branch-aware folder actions', () => {
    assert.match(vmJs, /const createVmContextMenuQuickStripAdapter =/);
    assert.match(vmJs, /const VM_CONTEXT_QUICK_ACTION_LABELS = new Set\(/);
    assert.match(vmJs, /focusedFolderId:\s*''/);
    assert.match(vmJs, /lockedFolderIds:\s*\[\]/);
    assert.match(vmJs, /pinnedFolderIds:\s*\[\]/);
    assert.match(vmJs, /const toggleVmFolderFocus =/);
    assert.match(vmJs, /const toggleVmFolderLock =/);
    assert.match(vmJs, /const toggleVmFolderPin = async/);
    assert.match(vmJs, /const actionFolder = async \(id, action, \{ includeDescendants = true \} = \{\}\) =>/);
    assert.match(vmJs, /const cloneVmFolderFromMenu = async/);
});

test('vm runtime keeps native expanded detail rows attached to their folder-managed VM rows', () => {
    assert.match(vmJs, /const collectVmMemberRowGroup = \(row\) => \{/);
    assert.match(vmJs, /const applyVmMemberRowGroupOwnership = \(row,\s*folderId\) => \{/);
    assert.match(vmJs, /const placeVmManagedDetailRowsAfterOwner = \(ownerRow,\s*detailRows,\s*folderId\) => \{/);
    assert.match(vmJs, /let vmPendingExpandedDetailOwner = null;/);
    assert.match(vmJs, /let vmFolderDetailObserver = null;/);
    assert.match(vmJs, /const ensureVmFolderDetailObserver = \(\) => \{/);
    assert.match(vmJs, /rememberPendingVmDetailOwner\(this\.closest\('tr'\)\);/);
    assert.match(vmJs, /placeVmManagedDetailRowsAfterOwner\(pendingOwner\.row,\s*addedRows,\s*pendingOwner\.folderId\);/);
    assert.match(vmJs, /\$vmTR\.addClass\('fv-vm-member-row'\)/);
    assert.match(vmJs, /const vmRowGroup = applyVmMemberRowGroupOwnership\(\$vmTR\.get\(0\),\s*id\);/);
});

test('vm runtime context menu keeps focus/pin/lock and clone actions in vm folder menu', () => {
    assert.match(vmJs, /Focus folder/);
    assert.match(vmJs, /Pin folder/);
    assert.match(vmJs, /Lock folder/);
    assert.match(vmJs, /Clone folder/);
    assert.match(vmJs, /Branch actions/);
});

test('vm css includes parity selectors for quick action row and folder quick state styles', () => {
    assert.match(vmCss, /tr\.fv-folder-focused td\.vm-name\.folder-name/);
    assert.match(vmCss, /tr\.fv-folder-pinned td\.vm-name\.folder-name/);
    assert.match(vmCss, /tr\.fv-folder-locked \.mover/);
    assert.match(vmCss, /\.fv-folder-focus-hidden/);
    assert.match(vmCss, /\.fvplus-vm-context-menu > li\.fvplus-vm-quick-item/);
    assert.match(vmCss, /\.fvplus-vm-context-menu > li\.fvplus-vm-quick-clear/);
});
