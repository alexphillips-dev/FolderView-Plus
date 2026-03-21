import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');

const parityContracts = [
    {
        name: 'runtime quick-state store keys',
        docker: /focusedFolderId:\s*''/,
        vm: /focusedFolderId:\s*''/
    },
    {
        name: 'focus toggle handler',
        docker: /const toggleDockerFolderFocus =/,
        vm: /const toggleVmFolderFocus =/
    },
    {
        name: 'pin toggle handler',
        docker: /const toggleDockerFolderPin = async/,
        vm: /const toggleVmFolderPin = async/
    },
    {
        name: 'lock toggle handler',
        docker: /const toggleDockerFolderLock =/,
        vm: /const toggleVmFolderLock =/
    },
    {
        name: 'lock guard helper',
        docker: /const ensureDockerFolderUnlocked =/,
        vm: /const ensureVmFolderUnlocked =/
    },
    {
        name: 'clone-folder menu flow',
        docker: /const cloneDockerFolderFromMenu = async/,
        vm: /const cloneVmFolderFromMenu = async/
    },
    {
        name: 'branch-aware folder action signature',
        docker: /const actionFolder = async \(id, action, \{ includeDescendants = true \} = \{\}\) =>/,
        vm: /const actionFolder = async \(id, action, \{ includeDescendants = true \} = \{\}\) =>/
    },
    {
        name: 'scope-aware menu wiring',
        docker: /const appendScopeAwareAction =/,
        vm: /const appendScopeAwareAction =/
    },
    {
        name: 'context quick-strip adapter',
        docker: /const dockerContextQuickStripAdapter =/,
        vm: /const vmContextQuickStripAdapter =/
    },
    {
        name: 'runtime overflow width adjust helper',
        docker: /const adjustDockerRuntimeAppWidthForRenderedOverflow = \(baseWidth = null\) =>/,
        vm: /const adjustVmRuntimeAppWidthForRenderedOverflow = \(baseWidth = null\) =>/
    },
    {
        name: 'runtime width reflow scheduler',
        docker: /const scheduleDockerRuntimeWidthReflow = \(reason = 'event', delayMs = DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS\) =>/,
        vm: /const scheduleVmRuntimeWidthReflow = \(reason = 'event', delayMs = VM_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS\) =>/
    },
    {
        name: 'context menu contains Branch actions',
        docker: /text:\s*'Branch actions'/,
        vm: /text:\s*'Branch actions'/
    }
];

test('docker/vm runtime parity contracts remain aligned for core folder capabilities', () => {
    for (const contract of parityContracts) {
        assert.match(dockerJs, contract.docker, `Docker missing parity contract: ${contract.name}`);
        assert.match(vmJs, contract.vm, `VM missing parity contract: ${contract.name}`);
    }
});

test('docker/vm css parity contracts include quick-state visuals and quick-strip classes', () => {
    assert.match(dockerCss, /tr\.fv-folder-focused td\.ct-name\.folder-name/);
    assert.match(vmCss, /tr\.fv-folder-focused td\.vm-name\.folder-name/);

    assert.match(dockerCss, /\.fv-folder-focus-hidden/);
    assert.match(vmCss, /\.fv-folder-focus-hidden/);

    assert.match(dockerCss, /\.fvplus-docker-context-menu > li\.fvplus-docker-quick-item/);
    assert.match(vmCss, /\.fvplus-vm-context-menu > li\.fvplus-vm-quick-item/);
});
