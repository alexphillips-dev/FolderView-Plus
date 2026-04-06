import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerRuntimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('docker runtime actions refresh visible state in place instead of forcing a full reload', () => {
    assert.match(dockerJs, /refreshDockerRuntimeState:\s*\(options = \{\}\) => refreshDockerRuntimeStateInPlace\(options\)/);
    assert.match(dockerJs, /const refreshDockerRuntimeStateInPlace = async \(options = \{\}\) => \{/);
    assert.match(dockerJs, /queueLoadlistRefresh\(\{ suppressLoadingUi: true \}\);/);
    assert.match(dockerJs, /await refreshDockerRuntimeStateInPlace\(\{ followupDelayMs: 650 \}\);/);
    assert.match(dockerRuntimeActionsJs, /const refreshDockerRuntimeState = typeof deps\.refreshDockerRuntimeState === 'function'/);
    assert.match(dockerRuntimeActionsJs, /refreshDockerRuntimeState\(\{ followupDelayMs: 650 \}\)/);
    assert.doesNotMatch(
        dockerRuntimeActionsJs,
        /const actionFolder = async \(id,\s*action,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*?const errors = results\.filter\(\(entry\) => entry\?\.success !== true\);[\s\S]*?refreshDockerList\(\);[\s\S]*?\};/
    );
});

test('vm runtime and folder settings actions use the debounced reload queue instead of direct loadlist calls', () => {
    assert.match(vmJs, /const actionFolder = async \(id,\s*action,\s*\{ includeDescendants = true \} = \{\}\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const folderCustomAction = async \(id,\s*action\) => \{[\s\S]*?await Promise\.all\(prom\);[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const cloneVmFolderFromMenu = async \(id\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.match(vmJs, /const pasteVmFolderSettingsFromMenu = async \(id\) => \{[\s\S]*?queueLoadlistRefresh\(\);[\s\S]*?\};/);
    assert.ok(vmJs.includes("await $.post('/plugins/folderview.plus/server/sync_order.php', { type: 'vm' }).promise();"));
    assert.ok(vmJs.includes('swal.close();'));
});
