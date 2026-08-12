import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'
);
const runtimeSharedCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css'
);
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const dockerColumnControllerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.column-controller.js'
);

const dockerCss = fs.readFileSync(dockerCssPath, 'utf8');
const runtimeSharedCss = fs.readFileSync(runtimeSharedCssPath, 'utf8');
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const dockerColumnControllerJs = fs.readFileSync(dockerColumnControllerJsPath, 'utf8');

test('docker mobile app-name width contract keeps long names visible before ellipsis', () => {
    assert.match(dockerCss, /--fvplus-docker-app-column-width-mobile:\s*118px/);
    assert.match(dockerCss, /@media \(max-width: 980px\)[\s\S]*\.folder-name\s*\{[\s\S]*width:\s*var\(--fvplus-docker-app-column-width-mobile\)/);
    assert.match(dockerCss, /@media \(max-width: 980px\)[\s\S]*\.folder-outer\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-docker-app-column-width-mobile\)\s*-\s*88px\)/);
    assert.match(dockerCss, /@media \(max-width: 980px\)[\s\S]*\.folder-element \.ct-name \.inner > span\.appname\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-docker-app-column-width-mobile\)\s*-\s*24px\)/);
});

test('docker folder dropdown keeps right gutter to avoid version-column clipping', () => {
    assert.match(runtimeSharedCss, /\.folder-dropdown\s*\{[\s\S]*min-width:\s*var\(--fvplus-folder-dropdown-min-width,\s*12px\)/);
    assert.match(runtimeSharedCss, /\.folder-dropdown\s*\{[\s\S]*margin:\s*0 var\(--fvplus-folder-dropdown-right-margin,\s*16px\) 0 auto/);
    assert.match(dockerCss, /td\.ct-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*right:\s*28px/);
    assert.match(runtimeSharedCss, /\.folder-dropdown > i\s*\{[\s\S]*font-size:\s*var\(--fvplus-folder-dropdown-icon-size,\s*12px\) !important/);
    assert.match(dockerCss, /--fvplus-folder-dropdown-icon-size:\s*12px/);
});

test('docker runtime keeps width-gap guardrails for long-name and version alignment balance', () => {
    assert.match(dockerJs, /const DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN = 136;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_MIN = 8;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_MAX = 26;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP = 64;/);
    assert.match(dockerColumnControllerJs, /const applyDockerRuntimeGapContract = \(widthPx, metrics = null\) =>/);
    assert.match(dockerColumnControllerJs, /const adjustDockerRuntimeAppWidthForRenderedOverflow = \(baseWidth = null\) =>/);
    assert.match(dockerColumnControllerJs, /const buildDockerRuntimeWidthDecision = \(\) =>/);
    assert.match(dockerColumnControllerJs, /Math\.min\(rawOverflow, DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX\)/);
    assert.match(dockerColumnControllerJs, /auxSelectors:\s*\['\.folder-state'\]/);
    assert.match(dockerColumnControllerJs, /const floorLimit = clampDockerRuntimeColumnWidth\(\s*estimatedAppWidth \+ DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,\s*1\s*\) \|\| estimatedAppWidth;/);
});
