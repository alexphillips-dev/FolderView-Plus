import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(process.cwd());
const dockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);
const dockerRuntimeActionsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js'),
    'utf8'
);
const runtimeSharedControlsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.shared-controls.js'),
    'utf8'
);
const runtimeSharedControls = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.shared-controls.js'
));

test('docker folder context supports open-all-webui actions with scoped options', () => {
    assert.match(dockerScript, /const collectFolderWebuiTargets = \(id, includeDescendants = true, runningOnly = true\) => \{/);
    assert.match(dockerRuntimeActionsScript, /const collectFolderWebuiTargets = \(id, includeDescendants = true, runningOnly = true\) =>/);
    assert.match(runtimeSharedControlsScript, /const openWebuiPopupWindow = \(url, targetName = '_blank'\) =>/);
    assert.match(dockerScript, /const openFolderWebuisFromMenu = \(id, runningOnly = true, includeDescendants = false\) => \{/);
    assert.match(dockerRuntimeActionsScript, /const openFolderWebuisFromMenu = \(id, runningOnly = true, includeDescendants = false\) =>/);
    assert.match(dockerScript, /Open all WebUIs/);
    assert.match(dockerScript, /collectFolderWebuiTargets\(id, false, true\)/);
    assert.match(dockerRuntimeActionsScript, /entry\?\.state === true && entry\?\.pause !== true/);
    assert.match(dockerRuntimeActionsScript, /openWebuiPopupWindow\(urls\[index\], `fvw-\$\{stamp\}-\$\{index\}`\)/);
    assert.doesNotMatch(dockerScript, /window\.open\('about:blank', `fvw-\$\{stamp\}-\$\{index\}`\)/);
    assert.match(dockerRuntimeActionsScript, /showFolderWebuiPopupWarning/);
    assert.match(dockerRuntimeActionsScript, /Browser Quick Guide/);
    assert.match(dockerRuntimeActionsScript, /Blocked WebUIs \(manual open\)/);
    assert.match(dockerScript, /dockerRuntimeInfoByName/);
    assert.match(dockerScript, /openFolderWebuisFromMenu\(id, true, false\)/);
});

test('open-all WebUI popup detection uses a secured blank handle before navigation', () => {
    const calls = [];
    const popup = {
        opener: {},
        location: {
            replace(url) {
                calls.push(['replace', url]);
            }
        }
    };
    const window = {
        open(url, target, features) {
            calls.push(['open', url, target, features]);
            return popup;
        }
    };
    const api = runtimeSharedControls.createSecureNavigationApi({ window });

    assert.equal(api.openWebuiPopupWindow('http://10.0.0.2:8080/', 'fvw-test-0'), true);
    assert.deepEqual(calls, [
        ['open', '', 'fvw-test-0', undefined],
        ['replace', 'http://10.0.0.2:8080/']
    ]);
    assert.equal(popup.opener, null);
});

test('open-all WebUI popup detection reports only a missing browser handle as blocked', () => {
    const api = runtimeSharedControls.createSecureNavigationApi({
        window: { open: () => null }
    });

    assert.equal(api.openWebuiPopupWindow('https://example.test/', 'fvw-test-1'), false);
});

test('docker folder context supports clone-folder action flow', () => {
    assert.match(dockerScript, /const cloneDockerFolderFromMenu = async \(id\) => \{/);
    assert.match(dockerScript, /const cloneDockerFolderBranchFromMenu = async \(id\) => \{/);
    assert.match(dockerScript, /const copyDockerFolderSettingsFromMenu = async \(id\) => \{/);
    assert.match(dockerScript, /const pasteDockerFolderSettingsFromMenu = async \(id\) => \{/);
    assert.match(dockerRuntimeActionsScript, /const cloneDockerFolderFromMenu = async \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /const cloneDockerFolderBranchFromMenu = async \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /const copyDockerFolderSettingsFromMenu = async \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /const pasteDockerFolderSettingsFromMenu = async \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /const getDockerFolderBranchCloneOrder = \(rootId\) =>/);
    assert.match(dockerRuntimeActionsScript, /const buildDockerFolderCloneIdFallback = \(reservedIds = new Set\(\)\) =>/);
    assert.match(dockerRuntimeActionsScript, /const generateDockerFolderCloneId = typeof deps\.generateDockerFolderCloneId === 'function'/);
    assert.match(dockerRuntimeActionsScript, /const rollbackClonedDockerFoldersFallback = async \(createdIds = \[\]\) =>/);
    assert.match(dockerRuntimeActionsScript, /const rollbackClonedDockerFolders = typeof deps\.rollbackClonedDockerFolders === 'function'/);
    assert.match(dockerRuntimeActionsScript, /promptFn\('Clone folder name'/);
    assert.match(dockerRuntimeActionsScript, /promptFn\('Clone branch root name'/);
    assert.match(dockerRuntimeActionsScript, /\/server\/create\.php/);
    assert.match(dockerRuntimeActionsScript, /\/server\/update\.php/);
    assert.match(dockerRuntimeActionsScript, /\/server\/apply_folder_settings\.php/);
    assert.match(dockerScript, /text:\s*getDockerMenuLabel\('clone-folder',\s*'Clone folder'\)/);
    assert.match(dockerScript, /text:\s*getDockerMenuLabel\('clone-menu',\s*'Clone'\)/);
    assert.match(dockerScript, /text:\s*getDockerMenuLabel\('clone-branch',\s*'Clone branch'\)/);
    assert.match(dockerScript, /text:\s*getDockerMenuLabel\('copy-folder-settings',\s*'Copy Folder Settings'\)/);
    assert.match(dockerScript, /text:\s*getDockerMenuLabel\('paste-folder-settings',\s*'Paste Folder Settings'\)/);
    assert.match(dockerScript, /subMenu:\s*cloneSubMenu/);
});

test('docker branch actions support deleting whole folder branches without reparenting children', () => {
    assert.doesNotMatch(dockerScript, /const getLockedDockerBranchFolderIds = \(id\) => \{/);
    assert.doesNotMatch(dockerScript, /const ensureDockerBranchUnlocked = \(id,\s*actionLabel = 'This action'\) => \{/);
    assert.doesNotMatch(dockerScript, /const deleteDockerFolderBranch = async \(id\) => \{/);
    assert.match(dockerScript, /const rmFolderBranch = \(id\) => \{/);
    assert.match(dockerRuntimeActionsScript, /const getLockedDockerBranchFolderIds = \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /const ensureDockerBranchUnlocked = \(id,\s*actionLabel = 'This action'\) =>/);
    assert.match(dockerRuntimeActionsScript, /const deleteDockerFolderBranch = async \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /const rmFolderBranch = \(id\) =>/);
    assert.match(dockerRuntimeActionsScript, /Nested child folders will be deleted with the root folder and will <strong>not<\/strong> be re-parented\./);
    assert.match(dockerScript, /text:\s*'Delete branch folders'/);
    assert.match(dockerScript, /rmFolderBranch\(id\);/);
});
