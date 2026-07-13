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

test('support bundle browser telemetry includes persisted docker page snapshot and bulk-update trace records', () => {
    const root = {
        document: {
            cookie: 'docker_listview_mode=advanced',
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
    const collectors = browserModule.createCollectors({
        readClientDiagnosticsStorageRecord(storageKey) {
            if (storageKey === 'docker-page-key') {
                return {
                    capturedAt: '2026-04-12T16:00:00+00:00',
                    reason: 'runtime-sync',
                    currentPage: '/Docker',
                    listViewMode: 'basic',
                    correlation: {
                        stateSignature: 'vaultwarden:r:1:dockerman:true:private-label',
                        orderReconciliation: {
                            liveOrderFingerprint: 'private-live-order',
                            savedOrderFingerprint: 'private-saved-order',
                            reconciledOrderFingerprint: 'private-reconciled-order'
                        }
                    },
                    topLevelRows: {
                        count: 2,
                        entries: [
                            { domIndex: 0, rowType: 'folder', folderId: 'networking', folderName: 'Networking' },
                            { domIndex: 1, rowType: 'standaloneContainer', containerName: 'vaultwarden' }
                        ]
                    },
                    summary: {
                        visibleFolderRows: 1,
                        visibleMemberRows: 5,
                        memberMissingFolderClassCount: 2
                    }
                };
            }
            if (storageKey === 'docker-trace-key') {
                return {
                    updatedAt: '2026-04-12T16:01:00+00:00',
                    count: 2,
                    entries: [
                        {
                            at: '2026-04-12T16:00:30+00:00',
                            eventType: 'dialogOpened',
                            details: { title: 'Updating Networking', containerCount: 1, containerNames: ['vaultwarden'] }
                        }
                    ]
                };
            }
            if (storageKey === 'docker-request-key') {
                return {
                    updatedAt: '2026-04-12T16:01:10+00:00',
                    count: 3,
                    entries: [
                        {
                            at: '2026-04-12T16:00:31+00:00',
                            eventType: 'buildDockerFolderReq',
                            details: { generation: 9, liveUpdateStatus: true, hostSyncSuspended: true }
                        }
                    ]
                };
            }
            if (storageKey === 'docker-trace-health-key') {
                return {
                    updatedAt: '2026-04-12T16:01:20+00:00',
                    bulkUpdateTrace: {
                        lastWriteAt: '2026-04-12T16:01:00+00:00',
                        lastWriteSucceeded: true,
                        failureCount: 0
                    },
                    requestBundleTrace: {
                        lastWriteAt: '2026-04-12T16:01:10+00:00',
                        lastWriteSucceeded: true,
                        failureCount: 0
                    }
                };
            }
            return null;
        },
        storageKeys: {
            dockerPage: 'docker-page-key',
            dockerBulkUpdateTrace: 'docker-trace-key',
            dockerRequestBundleTrace: 'docker-request-key',
            dockerTraceHealth: 'docker-trace-health-key'
        }
    });

    const pageSnapshot = collectors.collectDockerPageDiagnostics();
    const bulkUpdateTrace = collectors.collectDockerBulkUpdateTrace();
    const requestBundleTrace = collectors.collectDockerRequestBundleTrace();
    const traceHealth = collectors.collectDockerTraceHealth();

    assert.equal(pageSnapshot.available, true);
    assert.equal(pageSnapshot.summary.memberMissingFolderClassCount, 2);
    assert.equal(bulkUpdateTrace.available, true);
    assert.equal(bulkUpdateTrace.count, 2);
    assert.equal(bulkUpdateTrace.entries[0].eventType, 'dialogOpened');
    assert.equal(requestBundleTrace.available, true);
    assert.equal(requestBundleTrace.entries[0].eventType, 'buildDockerFolderReq');
    assert.equal(requestBundleTrace.entries[0].details.liveUpdateStatus, true);
    assert.equal(traceHealth.available, true);
    assert.equal(traceHealth.bulkUpdateTrace.lastWriteSucceeded, true);
    assert.equal(traceHealth.requestBundleTrace.lastWriteSucceeded, true);

    const bundle = {
        bundleMeta: { privacyMode: 'sanitized', bundleSaltHash: 'bundle-salt' },
        redactionManifest: {}
    };
    const redactor = loadTelemetryModule(root).createUiTelemetryRedactor(bundle, 'sanitized');
    const sanitizedPageSnapshot = collectors.collectDockerPageDiagnostics(redactor);
    const serializedSnapshot = JSON.stringify(sanitizedPageSnapshot);
    assert.doesNotMatch(serializedSnapshot, /vaultwarden|private-label|private-live-order|private-saved-order|private-reconciled-order|Networking/);
    assert.match(sanitizedPageSnapshot.correlation.stateSignature, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedPageSnapshot.correlation.orderReconciliation.liveOrderFingerprint, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedPageSnapshot.topLevelRows.entries[0].folderId, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedPageSnapshot.topLevelRows.entries[1].containerName, /^ui-[0-9a-f]{16}$/);
});
