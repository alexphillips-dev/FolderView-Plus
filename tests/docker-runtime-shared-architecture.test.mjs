import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const folderContractJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js');
const dockerSharedJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const runtimeSharedCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css');

test('docker runtime page loads shared runtime module before docker modules/runtime', () => {
    const contractIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js');
    const sharedIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.runtime.shared.js');
    const stateObserverIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/folder.runtime.state-observers.js');
    const modulesIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.modules.js');
    const menuIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.member-menu.js');
    const runtimeIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.js');
    const sharedCssIndex = dockerPage.indexOf('/plugins/folderview.plus/styles/runtime.shared.css');
    const dockerCssIndex = dockerPage.indexOf('/plugins/folderview.plus/styles/docker.css');
    assert.equal(dockerPage.includes('/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js'), false, 'docker page should not load settings fatal banner');
    assert.ok(contractIndex >= 0, 'shared folder contract include is missing');
    assert.ok(sharedIndex >= 0, 'shared runtime script include is missing');
    assert.ok(stateObserverIndex >= 0, 'runtime state observer script include is missing');
    assert.ok(modulesIndex >= 0, 'docker modules script include is missing');
    assert.ok(menuIndex >= 0, 'docker member menu script include is missing');
    assert.ok(runtimeIndex >= 0, 'docker runtime script include is missing');
    assert.ok(sharedCssIndex >= 0, 'shared runtime stylesheet include is missing');
    assert.ok(dockerCssIndex >= 0, 'docker stylesheet include is missing');
    assert.ok(contractIndex < sharedIndex, 'shared contract must load before docker.runtime.shared.js');
    assert.ok(sharedIndex < modulesIndex, 'shared runtime must load before docker.modules.js');
    assert.ok(sharedIndex < stateObserverIndex, 'shared runtime must load before runtime state observer module');
    assert.ok(stateObserverIndex < runtimeIndex, 'runtime state observer module must load before docker.js');
    assert.ok(menuIndex < runtimeIndex, 'docker member menu module must load before docker.js');
    assert.ok(sharedIndex < runtimeIndex, 'shared runtime must load before docker.js');
    assert.ok(sharedCssIndex < dockerCssIndex, 'shared runtime stylesheet must load before docker.css');
});

test('docker shared runtime module binds to the shared folder contract and exports runtime primitives', () => {
    assert.match(dockerSharedJs, /^\/\/ @ts-check/m);
    assert.match(folderContractJs, /window\.FolderViewPlusFolderContract = \{/);
    assert.match(dockerSharedJs, /const folderContract = window\.FolderViewPlusFolderContract \|\| null;/);
    assert.match(dockerSharedJs, /folderContract\?\.DEFAULT_PREVIEW_BORDER_COLOR \|\| '#afa89e'/);
    assert.match(dockerSharedJs, /const extractDropdownStyleValue = typeof folderContract\?\.extractDropdownStyleValue === 'function'/);
    assert.match(dockerSharedJs, /const normalizeDropdownStyle = typeof folderContract\?\.normalizeDropdownStyle === 'function'/);
    assert.match(dockerSharedJs, /const getDropdownStyleTokens = typeof folderContract\?\.getDropdownStyleTokens === 'function'/);
    assert.match(dockerSharedJs, /const createRuntimeStateStore =/);
    assert.match(dockerSharedJs, /const createDebugLogger = \(enabled = false, namespace = 'folderview\.plus'\) =>/);
    assert.match(dockerSharedJs, /const createAsyncActionBoundary =/);
    assert.match(dockerSharedJs, /const createContextMenuQuickStripAdapter =/);
    assert.match(dockerSharedJs, /const createRuntimePerfTelemetry =/);
    assert.match(dockerSharedJs, /const createSafeUiActionRunner =/);
    assert.match(dockerSharedJs, /const resolveRuntimePerformanceProfile =/);
    assert.match(dockerSharedJs, /const applyFolderDropdownStyle =/);
    assert.match(dockerSharedJs, /const runtimeContracts = Object\.freeze\(/);
    assert.match(dockerSharedJs, /window\.FolderViewDockerRuntimeShared =/);
});

test('docker runtime consumes shared state store and guarded async action wrappers', () => {
    assert.match(dockerJs, /const dockerRuntimeShared = window\.FolderViewDockerRuntimeShared \|\| \{\};/);
    assert.match(dockerJs, /dockerBootstrapMissingModules\.push\('folderviewplus\.utils\.js'\)/);
    assert.match(dockerJs, /dockerBootstrapMissingModules\.push\('folderviewplus\.request\.js'\)/);
    assert.match(dockerJs, /dockerBootstrapMissingModules\.push\('docker\.runtime\.shared\.js'\)/);
    assert.match(dockerJs, /FolderView Plus Docker runtime bootstrap failed/);
    assert.match(dockerJs, /const runtimeStateObserverModule = window\.FolderViewPlusRuntimeStateObservers \|\| null;/);
    assert.match(dockerJs, /const dockerPreviewMemberMenuModule = window\.FolderViewDockerPreviewMemberMenu \|\| null;/);
    assert.match(dockerJs, /dockerRuntimeShared\.createDebugLogger/);
    assert.match(dockerJs, /const dockerRuntimeStateStore = createDockerRuntimeStateStore\(/);
    assert.match(dockerJs, /const dockerActionBoundary = createDockerAsyncActionBoundary\(/);
    assert.match(dockerJs, /const dockerExpandedStateController = runtimeStateObserverModule/);
    assert.match(dockerJs, /const dockerRuntimeThemeReflowController = runtimeStateObserverModule/);
    assert.match(dockerJs, /dockerPreviewMemberMenuModule\.createController/);
    assert.match(dockerJs, /const runDockerGuardedAction = async \(actionName, action, context = \{\}\) =>/);
    assert.match(dockerJs, /window\.getDockerRuntimePerfTelemetrySnapshot =/);
});

test('docker CSS keeps docker-specific layout tokens while shared stylesheet owns shared dropdown geometry', () => {
    assert.match(dockerCss, /--fvplus-docker-folder-right-gutter:\s*28px/);
    assert.match(dockerCss, /--fvplus-docker-folder-outer-reserved-width:\s*106px/);
    assert.match(dockerCss, /--fvplus-docker-folder-dropdown-right-margin:\s*16px/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-right-margin:\s*var\(--fvplus-docker-folder-dropdown-right-margin,\s*16px\)/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-icon-size:\s*12px/);
    assert.match(dockerCss, /--fvplus-preview-wrapper-margin-top:\s*6px/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-color:\s*#ff9a3c/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-hover-color:\s*#ff9a3c/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-hover-bg:\s*rgba\(255,\s*154,\s*60,\s*0\.18\)/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-min-width:\s*12px/);
    assert.match(dockerCss, /right:\s*var\(--fvplus-docker-folder-right-gutter,\s*28px\)/);
    assert.match(dockerCss, /max-width:\s*calc\(var\(--fvplus-docker-app-column-width\)\s*-\s*var\(--fvplus-docker-folder-outer-reserved-width,\s*106px\)\)/);
    assert.doesNotMatch(dockerCss, /^\.folder-dropdown\s*\{/m);
    assert.match(runtimeSharedCss, /margin:\s*0 var\(--fvplus-folder-dropdown-right-margin,\s*16px\) 0 auto/);
    assert.match(runtimeSharedCss, /border:\s*var\(--fvplus-folder-dropdown-border-width,\s*1px\) solid var\(--fvplus-folder-dropdown-border-color/);
    assert.match(runtimeSharedCss, /\.folder-dropdown:hover,\s*[\s\S]*visibility:\s*visible !important/);
    assert.match(runtimeSharedCss, /\.folder-dropdown:hover > i,\s*[\s\S]*opacity:\s*1 !important/);
    assert.match(dockerCss, /border-right:\s*var\(--fvplus-preview-divider-width,\s*1px\) solid/);
});
