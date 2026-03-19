import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const runtimeColumnLayoutPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.column-layout.js'
);

const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const runtimeColumnLayoutJs = fs.readFileSync(runtimeColumnLayoutPath, 'utf8');

test('docker runtime width reflow scheduler remains deterministic under rapid events', () => {
    assert.match(dockerJs, /const DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS = 72;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_WIDTH_PHASES = Object\.freeze\(/);
    assert.match(dockerJs, /const scheduleDockerRuntimeWidthReflow = \(reason = 'event', delayMs = DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS\) =>/);
    assert.match(dockerJs, /if \(dockerRuntimeWidthState\.debounceTimer !== null\) \{\s*clearTimeout\(dockerRuntimeWidthState\.debounceTimer\);\s*\}/);
    assert.match(dockerJs, /dockerRuntimeWidthState\.debounceTimer = window\.setTimeout\(\(\) => \{/);
    assert.match(dockerJs, /const pendingReason = dockerRuntimeWidthState\.pendingReason \|\| reason;/);
    assert.match(dockerJs, /runDockerRuntimeWidthReflow\(`debounced:\$\{pendingReason\}`\);/);
    assert.match(dockerJs, /const runDockerRuntimeWidthReflow = \(reason = 'direct'\) =>/);
    assert.match(dockerJs, /dockerRuntimeWidthState\.pendingReason = '';/);
});

test('docker runtime width reflow keeps refresh and resize trigger contracts', () => {
    assert.match(dockerJs, /const reapply = \(\) => scheduleDockerRuntimeWidthReflow\('viewport-change', DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS\)/);
    assert.match(dockerJs, /window\.addEventListener\('resize', reapply,\s*\{\s*passive:\s*true\s*\}\)/);
    assert.match(dockerJs, /window\.addEventListener\('orientationchange', reapply,\s*\{\s*passive:\s*true\s*\}\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('table-bind', 0\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('render-complete', 0\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('folder-toggle', 24\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('prefs-change', 0\)/);
    assert.match(dockerJs, /scheduleDockerRuntimeWidthReflow\('font-ready', 20\)/);
});

test('runtime column layout engine clamps and applies CSS vars deterministically', () => {
    const styleStore = new Map();
    const style = {
        setProperty: (key, value) => styleStore.set(String(key), String(value)),
        removeProperty: (key) => styleStore.delete(String(key)),
        getPropertyValue: (key) => styleStore.get(String(key)) || ''
    };
    const context = {
        window: {},
        document: {
            body: { style },
            createElement: () => ({
                getContext: () => null
            })
        }
    };
    vm.createContext(context);
    vm.runInContext(runtimeColumnLayoutJs, context);

    const api = context.window.FolderViewPlusRuntimeColumnLayout;
    assert.ok(api && typeof api.createColumnLayoutEngine === 'function');
    const engine = api.createColumnLayoutEngine({
        minWidth: 118,
        maxWidth: 280,
        mobileScale: 0.8,
        mobileMin: 108
    });

    assert.equal(engine.clampWidth(80), 118);
    assert.equal(engine.clampWidth(500), 280);
    assert.equal(engine.resolvePresetWidth('compact'), 128);
    assert.equal(engine.resolvePresetWidth('wide'), 188);
    assert.equal(engine.resolvePresetWidth('unknown'), 142);

    engine.applyCssWidthVars(200);
    assert.equal(style.getPropertyValue('--fvplus-docker-app-column-width'), '200px');
    assert.equal(style.getPropertyValue('--fvplus-docker-app-column-width-mobile'), '160px');

    engine.applyCssWidthVars(Number.NaN);
    assert.equal(style.getPropertyValue('--fvplus-docker-app-column-width'), '');
    assert.equal(style.getPropertyValue('--fvplus-docker-app-column-width-mobile'), '');
});
