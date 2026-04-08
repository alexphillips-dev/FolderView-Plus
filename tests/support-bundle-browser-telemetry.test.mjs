import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const browserModulePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-browser.js'
);
const browserModuleSource = fs.readFileSync(browserModulePath, 'utf8');
const telemetryModulePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js'
);
const telemetryModuleSource = fs.readFileSync(telemetryModulePath, 'utf8');

const loadBrowserModule = (root = {}) => {
    const context = {
        globalThis: root,
        module: { exports: {} },
        exports: {},
        URL,
        console
    };
    vm.runInNewContext(browserModuleSource, context, {
        filename: browserModulePath
    });
    return context.module.exports;
};

const loadTelemetryModule = (root = {}) => {
    const context = {
        globalThis: root,
        module: { exports: {} },
        exports: {},
        URL,
        console
    };
    vm.runInNewContext(telemetryModuleSource, context, {
        filename: telemetryModulePath
    });
    return context.module.exports;
};

test('support bundle browser telemetry resolves useful asset version tokens when host autov returns v=0', () => {
    const root = {
        location: {
            origin: 'https://tower.local'
        },
        document: {
            querySelectorAll() {
                return [
                    { tagName: 'SCRIPT', src: '/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js?v=0' },
                    { tagName: 'LINK', href: '/plugins/folderview.plus/styles/folderviewplus.css?v=2026.04.04.18', rel: 'stylesheet', sheet: {} },
                    { tagName: 'SCRIPT', src: '/plugins/folderview.plus/scripts/folderviewplus.request.js' }
                ];
            }
        }
    };
    const browserModule = loadBrowserModule(root);
    const collectors = browserModule.createCollectors();
    const loadedAssets = collectors.collectLoadedAssetTelemetry(null, {
        pluginVersion: '2026.04.04.18'
    });

    assert.equal(loadedAssets.count, 3);

    assert.equal(loadedAssets.entries[0].rawVersionQuery, '0');
    assert.equal(loadedAssets.entries[0].versionQuery, '2026.04.04.18');
    assert.equal(loadedAssets.entries[0].versionSource, 'bundleMeta.pluginVersion');

    assert.equal(loadedAssets.entries[1].rawVersionQuery, '2026.04.04.18');
    assert.equal(loadedAssets.entries[1].versionQuery, '2026.04.04.18');
    assert.equal(loadedAssets.entries[1].versionSource, 'query');

    assert.equal(loadedAssets.entries[2].rawVersionQuery, '');
    assert.equal(loadedAssets.entries[2].versionQuery, '2026.04.04.18');
    assert.equal(loadedAssets.entries[2].versionSource, 'bundleMeta.pluginVersion');
});

test('support bundle browser telemetry captures the persisted docker list view mode cookie', () => {
    const root = {
        document: {
            cookie: 'foo=bar; docker_listview_mode=advanced; theme=gray'
        }
    };
    const browserModule = loadBrowserModule(root);
    const collectors = browserModule.createCollectors();
    const clientStorage = collectors.collectClientStorageDiagnostics();

    assert.equal(clientStorage.dockerListViewModeCookie, 'advanced');
});

test('support bundle export telemetry keeps the docker list view mode in uiTelemetry client storage', () => {
    const root = {
        document: {
            cookie: 'docker_listview_mode=basic',
            querySelectorAll() {
                return [];
            }
        },
        navigator: {
            cookieEnabled: true
        },
        location: {
            origin: 'https://tower.local',
            pathname: '/Settings/FolderViewPlus',
            href: 'https://tower.local/Settings/FolderViewPlus'
        }
    };
    const browserModule = loadBrowserModule(root);
    root.FolderViewPlusSupportBundleBrowser = browserModule;
    const telemetryModule = loadTelemetryModule(root);
    const api = telemetryModule.createApi({
        normalizeSupportBundleV2Payload: (bundle) => (bundle && typeof bundle === 'object' ? { ...bundle } : {})
    });

    const payload = api.collectSupportBundleUiTelemetry({
        bundleMeta: {
            privacyMode: 'sanitized',
            pluginVersion: '2026.04.08.04'
        },
        uiTelemetry: {}
    });

    assert.equal(payload.uiTelemetry.clientStorage.dockerListViewModeCookie, 'basic');
});
