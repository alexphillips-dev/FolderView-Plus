import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'
);
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);

const dockerCss = fs.readFileSync(dockerCssPath, 'utf8');
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');

test('docker mobile app-name width contract keeps long names visible before ellipsis', () => {
    assert.match(dockerCss, /--fvplus-docker-app-column-width-mobile:\s*118px/);
    assert.match(dockerCss, /@media \(max-width: 980px\)[\s\S]*\.folder-name\s*\{[\s\S]*width:\s*var\(--fvplus-docker-app-column-width-mobile\)/);
    assert.match(dockerCss, /@media \(max-width: 980px\)[\s\S]*\.folder-outer\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-docker-app-column-width-mobile\)\s*-\s*88px\)/);
    assert.match(dockerCss, /@media \(max-width: 980px\)[\s\S]*\.folder-element \.ct-name \.inner > span\.appname\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-docker-app-column-width-mobile\)\s*-\s*24px\)/);
});

test('docker folder dropdown keeps right gutter to avoid version-column clipping', () => {
    assert.match(dockerCss, /\.folder-dropdown\s*\{[\s\S]*min-width:\s*18px/);
    assert.match(dockerCss, /\.folder-dropdown\s*\{[\s\S]*margin:\s*0 12px 0 4px/);
    assert.match(dockerCss, /\.fv-folder-row-actions\s*\{[\s\S]*margin-left:\s*auto/);
    assert.match(dockerCss, /\.folder-dropdown > i\s*\{[\s\S]*font-size:\s*12px/);
});

test('docker runtime keeps width-gap guardrails for long-name and version alignment balance', () => {
    assert.match(dockerJs, /const DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN = 136;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_MIN = 8;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_MAX = 26;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP = 64;/);
    assert.match(dockerJs, /const applyDockerRuntimeGapContract = \(widthPx, metrics = null\) =>/);
    assert.match(dockerJs, /const adjustDockerRuntimeAppWidthForRenderedOverflow = \(baseWidth = null\) =>/);
    assert.match(dockerJs, /const buildDockerRuntimeWidthDecision = \(\) =>/);
    assert.match(dockerJs, /Math\.min\(rawOverflow, DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX\)/);
    assert.match(dockerJs, /const floorLimit = clampDockerRuntimeColumnWidth\(\s*estimatedAppWidth \+ DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,\s*1\s*\) \|\| estimatedAppWidth;/);
});
