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
    'docker.runtime.command-view.js',
    'docker.runtime.tree-explorer.js',
    'docker.runtime.orbit-view.js'
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
    assert.match(dockerJs, /window\.loadlist = \(\) => \{[\s\S]*folderReq = ensureDockerFolderReqForHostRender\(\);/);
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
    assert.match(dockerJs, /dockerRuntimeResizerObserver = new MutationObserver\(\(\) => \{[\s\S]*isDockerRuntimeWidthBootstrapActive\(\)[\s\S]*resizerBindPending = true/);
    assert.match(dockerJs, /bindDockerRuntimeColumnResizers\(\{ scheduleReflow: false \}\);[\s\S]*runDockerRuntimeWidthReflow\('bootstrap-stable', \{[\s\S]*force: true,[\s\S]*minimumDelta: DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX/);
    assert.match(dockerJs, /const widthBootstrapGeneration = beginDockerRuntimeWidthBootstrap\(\);/);
    assert.match(dockerJs, /dockerRuntimeWidthState\.pendingRenderGeneration = widthBootstrapGeneration;/);
    assert.match(dockerJs, /const widthBootstrapGeneration = dockerRuntimeWidthState\.pendingRenderGeneration[\s\S]*\|\| beginDockerRuntimeWidthBootstrap\(\);/);
    assert.match(dockerJs, /completeDockerRuntimeWidthBootstrap\(widthBootstrapGeneration, \{[\s\S]*stabilize: foldersRenderedSuccessfully/);
});

test('Docker folder rendering yields by elapsed work instead of a fixed folder count', () => {
    assert.match(dockerJs, /const DOCKER_RENDER_TIME_BUDGET_MS = 10;/);
    assert.match(dockerJs, /const readDockerRenderClock = \(\) =>/);
    assert.match(dockerJs, /const elapsed = readDockerRenderClock\(\) - Number\(sliceStartedAt \|\| 0\);/);
    assert.match(dockerJs, /if \(elapsed < DOCKER_RENDER_TIME_BUDGET_MS\) \{\s*return sliceStartedAt;/);
    assert.match(dockerJs, /await waitForDockerRenderFrame\(\);\s*return readDockerRenderClock\(\);/);
    assert.doesNotMatch(dockerJs, /DOCKER_RENDER_YIELD_BATCH_SIZE/);
});

test('Docker folder rendering keeps yielded mutations hidden until one atomic visual commit', () => {
    assert.match(dockerJs, /const beginDockerFolderRenderCommit = \(\) => \{[\s\S]*classList\.add\('fvplus-docker-render-staging'\);[\s\S]*setAttribute\('aria-busy', 'true'\);/);
    assert.match(dockerJs, /const finishDockerFolderRenderCommit = \(dockerList\) => \{[\s\S]*classList\.remove\('fvplus-docker-render-staging'\);[\s\S]*removeAttribute\('aria-busy'\);/);
    assert.match(dockerJs, /const createFolders = async \(\) => \{\s*dockerPerf\.begin\('createFolders\.total'\);\s*const stagedDockerList = beginDockerFolderRenderCommit\(\);/);
    assert.match(dockerJs, /finally \{[\s\S]*completeDockerRuntimeWidthBootstrap\([\s\S]*finishDockerFolderRenderCommit\(stagedDockerList\);[\s\S]*hideDockerRuntimeLoadingOverlay\(\);/);
    assert.match(dockerCss, /#docker_list\.fvplus-docker-render-staging\s*\{\s*visibility:\s*hidden;\s*pointer-events:\s*none;\s*\}/);
});
