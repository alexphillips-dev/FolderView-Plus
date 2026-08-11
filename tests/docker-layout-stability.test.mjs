import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const pluginRoot = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const dockerJs = read(`${pluginRoot}/scripts/docker.js`);
const previewActionsJs = read(`${pluginRoot}/scripts/docker.runtime.preview-actions.js`);
const runtimeInfoJs = read(`${pluginRoot}/scripts/docker.runtime.info.js`);
const diagnosticsJs = read(`${pluginRoot}/scripts/docker.runtime.diagnostics.js`);
const columnLayoutJs = read(`${pluginRoot}/scripts/runtime.column-layout.js`);
const dockerColumnControllerJs = read(`${pluginRoot}/scripts/docker.runtime.column-controller.js`);
const dockerPage = read(`${pluginRoot}/folderview.plus.Docker.page`);
const dockerLayoutBootstrap = read(`${pluginRoot}/scripts/docker.layout-bootstrap.js`);
const dockerCss = read(`${pluginRoot}/styles/docker.css`);
const serverLib = `${read(`${pluginRoot}/server/lib.php`)}\n${read(`${pluginRoot}/server/lib.runtime-info.php`)}`;
const dockerRuntimeServerLib = read(`${pluginRoot}/server/lib.docker-runtime.php`);
const snapshotLib = read(`${pluginRoot}/server/lib.runtime-snapshot.php`);

test('lightweight Docker state exposes safe WebUI capability and hydration metadata', () => {
    assert.match(serverLib, /require_once\(__DIR__ \. '\/lib\.docker-runtime\.php'\)/);
    assert.match(dockerRuntimeServerLib, /function resolveDockerLightweightWebuiMetadata\(array \$labels,\s*string \$manager\): array/);
    assert.match(dockerRuntimeServerLib, /'webuiCapability'\s*=>\s*\$capability/);
    assert.match(dockerRuntimeServerLib, /'webuiHydrationPending'\s*=>\s*\$capability !== false/);
    assert.match(serverLib, /'WebUi'\s*=>\s*\$webuiMetadata\['WebUi'\]/);
    assert.match(serverLib, /'TSWebUi'\s*=>\s*\$webuiMetadata\['TSWebUi'\]/);
    assert.match(serverLib, /'Shell'\s*=>\s*\$webuiMetadata\['Shell'\]/);
    assert.match(serverLib, /WebUiCapability/);
    assert.match(serverLib, /WebUiHydrationPending/);
    assert.doesNotMatch(snapshotLib, /'webuiCapability'\s*=>/);
    assert.match(runtimeInfoJs, /WebUiCapability:\s*resolvedWebuiCapability/);
    assert.match(runtimeInfoJs, /WebUiHydrationPending:\s*sourceWebuiHydrationPending/);
    assert.match(runtimeInfoJs, /webuiCapability,/);
    assert.match(runtimeInfoJs, /webuiHydrating:/);
});

test('preview actions reserve fixed slots and reconcile hydration in place', () => {
    assert.match(previewActionsJs, /const ensureDockerPreviewActionSlot =/);
    assert.match(previewActionsJs, /const syncDockerPreviewWebuiSlot =/);
    assert.match(previewActionsJs, /const reconcileDockerPreviewActionButtons =/);
    assert.match(previewActionsJs, /data-fv-preview-action-slot/);
    assert.match(previewActionsJs, /is-ready is-pending is-unavailable/);
    assert.doesNotMatch(
        previewActionsJs,
        /children\('span\.folder-element-webui, span\.folder-element-console, span\.folder-element-logs/
    );
    assert.match(dockerCss, /\.folder-preview \.fv-preview-action-slot \{[\s\S]*width:\s*13px;[\s\S]*min-width:\s*13px;/);
    assert.match(dockerCss, /\.folder-preview \.fv-preview-action-slot\.is-pending,[\s\S]*visibility:\s*hidden;/);
});

test('content-aware width bootstrap rejects narrow-cache authority before first paint', () => {
    const bodyStyle = new Map();
    const context = {
        window: {},
        document: {
            body: {
                style: {
                    setProperty: (key, value) => bodyStyle.set(key, value),
                    removeProperty: (key) => bodyStyle.delete(key)
                }
            }
        }
    };
    context.window.document = context.document;
    vm.runInNewContext(columnLayoutJs, context, { filename: 'runtime.column-layout.js' });
    const engine = context.window.FolderViewPlusRuntimeColumnLayout.createColumnLayoutEngine({
        minWidth: 118,
        maxWidth: 1280,
        presetWidths: { compact: 128, standard: 142, wide: 188 },
        mobileScale: 1,
        mobileMin: 136
    });
    const width = engine.resolveBootstrapWidth({
        baseline: 142,
        cached: 142,
        estimated: 286,
        floor: 142
    });
    assert.equal(width, 286);
    engine.applyCssWidthVars(width);
    assert.equal(bodyStyle.get('--fvplus-docker-app-column-width'), '286px');
    const storage = {
        value: JSON.stringify({
            schemaVersion: 2,
            algorithmVersion: 'content-aware-v2',
            lastMode: 'standard',
            widths: {
                standard: {
                    width: 142,
                    contentSignature: 'stale-signature',
                    capturedAt: '2026-07-01T00:00:00.000Z'
                }
            }
        }),
        getItem() {
            return this.value;
        },
        setItem(_key, value) {
            this.value = value;
        }
    };
    const cacheEngine = context.window.FolderViewPlusRuntimeColumnLayout.createColumnLayoutEngine({
        minWidth: 118,
        maxWidth: 1280,
        cacheKey: 'layout-cache',
        cacheSchemaVersion: 2,
        algorithmVersion: 'content-aware-v2',
        storage
    });
    assert.equal(cacheEngine.readCachedWidth('standard', 'current-signature'), null);
    assert.equal(cacheEngine.readCachedWidth('standard'), 142);
    assert.equal(cacheEngine.writeCachedWidth('standard', 286, 'current-signature'), true);
    assert.equal(JSON.parse(storage.value).widths.standard.contentSignature, 'current-signature');
    assert.equal(JSON.parse(storage.value).widths.standard.width, 286);
    assert.match(dockerJs, /DOCKER_RUNTIME_APP_WIDTH_CACHE_KEY = 'fvplus\.runtime\.docker\.appWidth\.v2'/);
    assert.match(columnLayoutJs, /const hashInput =/);
    assert.match(columnLayoutJs, /const resolveFolderBootstrap =/);
    assert.match(dockerColumnControllerJs, /controllerState\.widthContentSignature = String\(bootstrap\.contentSignature/);
    assert.match(dockerJs, /runDockerRuntimeWidthReflow\('pre-visible-folder-commit'/);
    assert.match(dockerPage, /scripts\/docker\.layout-bootstrap\.js/);
    assert.match(dockerLayoutBootstrap, /localStorage\?\.getItem\('fvplus\.runtime\.docker\.appWidth\.v2'\)/);
});

test('Docker support snapshots include sanitized temporal layout telemetry', () => {
    assert.match(diagnosticsJs, /const createLayoutStabilityTracker =/);
    assert.match(diagnosticsJs, /const captureActionGeometry =/);
    assert.match(diagnosticsJs, /const compareActionGeometry =/);
    assert.match(diagnosticsJs, /relativeShiftedTargetCount/);
    assert.match(diagnosticsJs, /maximumRelativeShiftPx/);
    assert.match(diagnosticsJs, /maximumRowShiftPx/);
    assert.match(diagnosticsJs, /unavailableWebuiSlotCount/);
    assert.match(diagnosticsJs, /new win\.PerformanceObserver/);
    assert.match(dockerJs, /markDockerRuntimeLayoutPhase\('full-info-requested'/);
    assert.match(dockerJs, /markDockerRuntimeLayoutPhase\('full-info-ready'/);
    assert.doesNotMatch(dockerJs, /window\.getDockerRuntimeLayoutStabilitySnapshot/);
    assert.match(diagnosticsJs, /getLayoutStabilityDiagnostics/);
    assert.match(diagnosticsJs, /layoutStability:\s*cloneValue\(getLayoutStabilityDiagnostics\(\)\)/);
    assert.doesNotMatch(dockerJs, /previewActions:\s*\{[\s\S]{0,600}containerName/);
});
