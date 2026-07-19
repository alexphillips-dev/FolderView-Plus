import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const scriptsRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts'
);
const dockerJs = fs.readFileSync(path.join(scriptsRoot, 'docker.js'), 'utf8');
const dockerCss = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'),
    'utf8'
);
const isolatedViewSources = [
    'docker.runtime.command-view.js'
].map((file) => fs.readFileSync(path.join(scriptsRoot, file), 'utf8'));

test('Docker bootstrap reuses its coherent request bundle instead of issuing a second startup snapshot', () => {
    assert.match(dockerJs, /const ensureDockerFolderReqForHostRender = \(options = \{\}\) =>/);
    assert.match(dockerJs, /const hasReusableBundle = folderReq[\s\S]*folderReq\.render\.length >= 4/);
    assert.match(dockerJs, /const resolveDockerBootstrapPrefsFromRequestBundle = async \(requestBundle\) =>/);
    assert.match(dockerJs, /const prefsRequest = requestBundle\?\.render\?\.\[3\];/);
    assert.match(dockerJs, /const requestBundle = ensureDockerFolderReqForHostRender\(\{/);
    assert.match(dockerJs, /resolveDockerBootstrapPrefsFromRequestBundle\(requestBundle\)/);
    assert.doesNotMatch(dockerJs, /ensureDockerBootstrapPrefs\(\{ forceRefresh: true \}\)/);
    assert.doesNotMatch(dockerJs, /rebuildDockerFolderReqForHostRender/);
    assert.match(dockerJs, /wrapHostHook\?\.\('loadlist',[\s\S]*folderReq = ensureDockerFolderReqForHostRender\(\);/);
    assert.match(dockerJs, /\/\/ Prime requests for environments where loadlist isn't called first\.[\s\S]*folderReq = ensureDockerFolderReqForHostRender\(\);/);
});

test('full Docker runtime details begin only after the lightweight folder render', () => {
    assert.match(dockerJs, /fullInfo: legacyFullInfoFactory\s*\n\s*\};/);
    assert.match(dockerJs, /fullInfo: \(\) => runtimeSnapshotApi\.projectRequest\(/);
    assert.match(dockerJs, /const suppliedRequest = typeof fullInfoSource === 'function'[\s\S]*fullInfoSource\(\)/);
    assert.match(dockerJs, /scheduleDockerPostRenderPolish\(Object\.keys\(globalFolders\)\);[\s\S]*queueDockerDeferredRuntimeInfoHydration/);
    for (const source of isolatedViewSources) {
        assert.match(source, /const fullInfoRequest = typeof requestBundle\.fullInfo === 'function'[\s\S]*requestBundle\.fullInfo\(\)/);
    }
});

test('Docker folder construction suppresses intermediate width measurements and performs one stabilized pass', () => {
    assert.match(dockerJs, /const DOCKER_RUNTIME_WIDTH_BOOTSTRAP_SETTLE_MS = 280;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX = 3;/);
    assert.match(dockerJs, /const beginDockerRuntimeWidthBootstrap = \(\) =>/);
    assert.match(dockerJs, /const completeDockerRuntimeWidthBootstrap = \(generation, options = \{\}\) =>/);
    assert.match(dockerJs, /if \(isDockerRuntimeWidthBootstrapActive\(\)\) \{\s*dockerRuntimeWidthState\.deferredReason/);
    assert.match(dockerJs, /const disconnect = dockerHostAdapter\.observeRows\(\(\) => \{[\s\S]*isDockerRuntimeWidthBootstrapActive\(\)[\s\S]*resizerBindPending = true/);
    assert.match(dockerJs, /dockerRuntimeResizerObserver = \{ disconnect \};/);
    assert.match(dockerJs, /bindDockerRuntimeColumnResizers\(\{ scheduleReflow: false \}\);[\s\S]*runDockerRuntimeWidthReflow\('bootstrap-stable', \{[\s\S]*force: true,[\s\S]*minimumDelta: DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX/);
    assert.match(dockerJs, /const widthBootstrapGeneration = beginDockerRuntimeWidthBootstrap\(\);/);
    assert.match(dockerJs, /dockerRuntimeWidthState\.pendingRenderGeneration = widthBootstrapGeneration;/);
    assert.match(dockerJs, /const widthBootstrapGeneration = dockerRuntimeWidthState\.pendingRenderGeneration[\s\S]*\|\| beginDockerRuntimeWidthBootstrap\(\);/);
    assert.match(dockerJs, /completeDockerRuntimeWidthBootstrap\(widthBootstrapGeneration, \{[\s\S]*stabilize: foldersRenderedSuccessfully/);
});

test('Docker folder construction completes without yielding partial rows to the browser', () => {
    assert.doesNotMatch(dockerJs, /DOCKER_RENDER_TIME_BUDGET_MS/);
    assert.doesNotMatch(dockerJs, /yieldDockerRenderLoop/);
    assert.doesNotMatch(dockerJs, /readDockerRenderClock/);
    const renderStart = dockerJs.indexOf('// Draw the folders in the order');
    const renderEnd = dockerJs.indexOf("dockerPerf.end('createFolders.renderRemaining'", renderStart);
    assert.ok(renderStart >= 0 && renderEnd > renderStart);
    assert.doesNotMatch(dockerJs.slice(renderStart, renderEnd), /\bawait\b/);
});

test('Docker leaves Unraid native rows visible until one uninterrupted folder conversion', () => {
    assert.doesNotMatch(dockerJs, /DockerFolderRenderSnapshot|DockerFolderRenderCommit/);
    assert.doesNotMatch(dockerJs, /fvplus-docker-render-staging|fvplus-docker-render-snapshot/);
    assert.doesNotMatch(dockerCss, /fvplus-docker-render-staging|fvplus-docker-render-snapshot/);
    assert.match(dockerJs, /wrapHostHook\?\.\('loadlist',[\s\S]*folderReq = ensureDockerFolderReqForHostRender\(\);[\s\S]*invokeOriginal\(\);/);
    assert.match(dockerJs, /wrapHostHook\?\.\('listview',[\s\S]*invokeOriginal\(\);[\s\S]*queueDockerRuntimeRenderForPageViewMode\(\);/);
    assert.match(dockerJs, /const createFolders = async \(\) => \{[\s\S]*dockerPerf\.begin\('createFolders\.total'\);\s*const widthBootstrapGeneration/);
});
