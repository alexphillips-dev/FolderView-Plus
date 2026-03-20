import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const dockerSharedJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');

test('docker runtime page loads shared runtime module before docker modules/runtime', () => {
    const sharedIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.runtime.shared.js');
    const modulesIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.modules.js');
    const runtimeIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.js');
    assert.ok(sharedIndex >= 0, 'shared runtime script include is missing');
    assert.ok(modulesIndex >= 0, 'docker modules script include is missing');
    assert.ok(runtimeIndex >= 0, 'docker runtime script include is missing');
    assert.ok(sharedIndex < modulesIndex, 'shared runtime must load before docker.modules.js');
    assert.ok(sharedIndex < runtimeIndex, 'shared runtime must load before docker.js');
});

test('docker shared runtime module exports state store, async boundary, quick strip adapter, and telemetry', () => {
    assert.match(dockerSharedJs, /^\/\/ @ts-check/m);
    assert.match(dockerSharedJs, /const createRuntimeStateStore =/);
    assert.match(dockerSharedJs, /const createAsyncActionBoundary =/);
    assert.match(dockerSharedJs, /const createContextMenuQuickStripAdapter =/);
    assert.match(dockerSharedJs, /const createRuntimePerfTelemetry =/);
    assert.match(dockerSharedJs, /window\.FolderViewDockerRuntimeShared =/);
});

test('docker runtime consumes shared state store and guarded async action wrappers', () => {
    assert.match(dockerJs, /const dockerRuntimeShared = window\.FolderViewDockerRuntimeShared \|\| \{\};/);
    assert.match(dockerJs, /const dockerRuntimeStateStore = createDockerRuntimeStateStore\(/);
    assert.match(dockerJs, /const dockerActionBoundary = createDockerAsyncActionBoundary\(/);
    assert.match(dockerJs, /const runDockerGuardedAction = async \(actionName, action, context = \{\}\) =>/);
    assert.match(dockerJs, /window\.getDockerRuntimePerfTelemetrySnapshot =/);
});

test('docker CSS exposes centralized layout tokens with compatibility fallbacks', () => {
    assert.match(dockerCss, /--fvplus-docker-folder-right-gutter:\s*28px/);
    assert.match(dockerCss, /--fvplus-docker-folder-outer-reserved-width:\s*106px/);
    assert.match(dockerCss, /--fvplus-docker-folder-dropdown-right-margin:\s*16px/);
    assert.match(dockerCss, /right:\s*var\(--fvplus-docker-folder-right-gutter,\s*28px\)/);
    assert.match(dockerCss, /max-width:\s*calc\(var\(--fvplus-docker-app-column-width\)\s*-\s*var\(--fvplus-docker-folder-outer-reserved-width,\s*106px\)\)/);
    assert.match(dockerCss, /margin:\s*0 var\(--fvplus-docker-folder-dropdown-right-margin,\s*16px\) 0 auto/);
});
