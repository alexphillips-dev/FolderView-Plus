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
const fatalBannerSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js'
), 'utf8');

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

test('support bundle browser telemetry exports only allowlisted native organizer diagnostics', () => {
    const rawStatus = {
        schemaVersion: 2,
        checkedAt: '2026-07-16T18:00:00.000Z',
        ok: false,
        skipped: true,
        requested: false,
        source: 'diagnostics',
        reason: 'organizer_unsupported',
        failureCategory: 'schema_unsupported',
        failureStage: 'organizer_capability_probe',
        httpStatus: 0,
        apiAvailable: true,
        organizerApiAvailable: false,
        created: 0,
        updated: 0,
        unsupportedField: 'https://tower.local/private',
        rawMessage: 'Cannot query /mnt/private and https://tower.local/graphql'
    };
    const collectors = loadBrowserModule({}).createCollectors({
        storageKeys: { nativeOrganizer: 'fv.native.organizer.status.v1' },
        readClientDiagnosticsStorageRecord(key) {
            return key === 'fv.native.organizer.status.v1' ? rawStatus : null;
        }
    });

    const exported = collectors.collectClientStorageDiagnostics().nativeOrganizer;
    assert.equal(exported.available, true);
    assert.equal(exported.failureCategory, 'schema_unsupported');
    assert.equal(exported.failureStage, 'organizer_capability_probe');
    assert.equal(Object.prototype.hasOwnProperty.call(exported, 'rawMessage'), false);
    assert.equal(JSON.stringify(exported).includes('/mnt/private'), false);
    assert.equal(JSON.stringify(exported).includes('tower.local'), false);
});

test('support bundle browser telemetry drops free-form values from legacy native organizer records', () => {
    const collectors = loadBrowserModule({}).createCollectors({
        storageKeys: { nativeOrganizer: 'fv.native.organizer.status.v1' },
        readClientDiagnosticsStorageRecord() {
            return {
                checkedAt: '/mnt/private',
                source: 'https://tower.local/settings',
                reason: 'GraphQL failed at /mnt/private',
                failureCategory: 'secret-container-name',
                failureStage: 'https://tower.local/graphql'
            };
        }
    });

    const exported = collectors.collectClientStorageDiagnostics().nativeOrganizer;
    assert.equal(exported.checkedAt, '');
    assert.equal(exported.source, 'detect');
    assert.equal(exported.reason, '');
    assert.equal(exported.failureCategory, '');
    assert.equal(exported.failureStage, '');
    assert.equal(JSON.stringify(exported).includes('/mnt/private'), false);
    assert.equal(JSON.stringify(exported).includes('tower.local'), false);
});

test('support bundle browser telemetry includes aggregate preference save health without values', () => {
    const root = {
        FolderViewPlusPrefsStore: {
            getDefaultCoordinator() {
                return {
                    getDiagnostics() {
                        return {
                            schemaVersion: 1,
                            types: {
                                docker: { status: 'sync-pending', pendingFieldCount: 2, failures: 1 },
                                vm: { status: 'saved', pendingFieldCount: 0, failures: 0 }
                            }
                        };
                    }
                };
            }
        }
    };
    const clientStorage = loadBrowserModule(root).createCollectors().collectClientStorageDiagnostics();
    assert.equal(clientStorage.preferenceSaves.types.docker.status, 'sync-pending');
    assert.equal(clientStorage.preferenceSaves.types.docker.pendingFieldCount, 2);
    assert.equal(JSON.stringify(clientStorage.preferenceSaves).includes('privacyMode'), false);
});

test('browser error telemetry separates current-session failures from historical records', () => {
    const root = {
        FolderViewPlusFatalBanner: {
            getBrowserConsoleErrorSnapshot() {
                return {
                    storageKey: 'fv.support.bundle.consoleErrors.v1',
                    maxEntries: 30,
                    sessionId: 'current-session',
                    sessionStartedAt: '2026-07-13T18:00:00.000Z',
                    entries: [
                        {
                            at: '2026-05-21T19:09:29.870Z',
                            sessionId: 'old-session',
                            observedPluginVersion: '2026.05.21.01',
                            message: 'Historical failure'
                        },
                        {
                            at: '2026-07-13T18:01:00.000Z',
                            sessionId: 'current-session',
                            observedPluginVersion: '2026.07.13.06',
                            message: 'Current failure'
                        }
                    ]
                };
            }
        }
    };
    const browserModule = loadBrowserModule(root);
    const snapshot = browserModule.createCollectors().collectBrowserConsoleErrors({
        pluginVersion: '2026.07.13.06'
    });

    assert.equal(snapshot.count, 2);
    assert.equal(snapshot.collectionPluginVersion, '2026.07.13.06');
    assert.equal(snapshot.firstSeenAt, '2026-05-21T19:09:29.870Z');
    assert.equal(snapshot.lastSeenAt, '2026-07-13T18:01:00.000Z');
    assert.equal(snapshot.currentSessionCount, 1);
    assert.equal(snapshot.historicalCount, 1);
    assert.equal(snapshot.entries[0].currentSession, false);
    assert.equal(snapshot.entries[0].observedPluginVersion, '2026.05.21.01');
    assert.equal(snapshot.entries[1].currentSession, true);
    assert.equal(snapshot.entries[1].observedPluginVersion, '2026.07.13.06');
});

test('browser error telemetry does not misattribute legacy records to the collection plugin version', () => {
    const browserModule = loadBrowserModule({});
    const snapshot = browserModule.createCollectors({
        readClientDiagnosticsStorageRecord() {
            return [{ at: '2026-05-21T19:09:29.870Z', message: 'Legacy failure' }];
        }
    }).collectBrowserConsoleErrors({ pluginVersion: '2026.07.13.06' });

    assert.equal(snapshot.collectionPluginVersion, '2026.07.13.06');
    assert.equal(snapshot.entries[0].observedPluginVersion, 'unknown');
    assert.equal(snapshot.entries[0].currentSession, false);
});

test('fatal banner persists browser session and plugin-version context for future exports', () => {
    assert.match(fatalBannerSource, /sessionId: browserErrorSessionId/);
    assert.match(fatalBannerSource, /observedPluginVersion: trimString\(state\.environment\.pluginVersion/);
    assert.match(fatalBannerSource, /currentSession: trimString\(entry\?\.sessionId\) === browserErrorSessionId/);
    assert.match(fatalBannerSource, /firstSeenAt: timestamps\[0\] \|\| null/);
    assert.match(fatalBannerSource, /historicalCount: Math\.max\(0, entries\.length - currentSessionCount\)/);
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
        normalizeSupportBundleV2Payload: (bundle) => (bundle && typeof bundle === 'object' ? { ...bundle } : {}),
        getStandardRequestDiagnosticsSnapshot: () => ({
            count: 1,
            failures: 0,
            retries: 0,
            entries: [{ method: 'GET', endpoint: '/plugins/folderview.plus/server/read.php', outcome: 'ok' }]
        })
    });

    const payload = api.collectSupportBundleUiTelemetry({
        bundleMeta: {
            privacyMode: 'sanitized',
            pluginVersion: '2026.04.08.04'
        },
        uiTelemetry: {}
    });

    assert.equal(payload.uiTelemetry.clientStorage.dockerListViewModeCookie, 'basic');
    assert.equal(payload.uiTelemetry.requestActivity.count, 1);
    assert.equal(payload.uiTelemetry.requestActivity.entries[0].endpoint, '/plugins/folderview.plus/server/read.php');
    assert.equal(payload.redactionManifest.privacySelfCheck.status, 'passed');
    assert.equal(payload.redactionManifest.privacySelfCheck.scope, 'uiTelemetry');
    assert.equal(payload.redactionManifest.privacySelfCheck.violationCount, 0);
});

test('support bundle privacy self-check reports aggregate violations without leaking values', () => {
    const telemetryModule = loadTelemetryModule({});
    const failed = telemetryModule.buildUiTelemetryPrivacySelfCheck({
        currentPage: { href: 'https://tower.local/Docker' },
        dockerDiagnostics: {
            pageSnapshot: {
                topLevelRows: {
                    entries: [{ containerName: 'private-container' }]
                }
            }
        }
    }, 'sanitized');
    const full = telemetryModule.buildUiTelemetryPrivacySelfCheck({
        currentPage: { href: 'https://tower.local/Docker' }
    }, 'full');

    assert.equal(failed.status, 'failed');
    assert.equal(failed.rawIdentityViolations, 1);
    assert.equal(failed.rawUrlViolations, 1);
    assert.equal(failed.violationCount, 2);
    assert.deepEqual(Object.keys(failed).sort(), [
        'checkedFieldCount',
        'privacyMode',
        'rawIdentityViolations',
        'rawPrivateNetworkAddressViolations',
        'rawSensitivePathViolations',
        'rawUrlViolations',
        'scope',
        'status',
        'violationCount'
    ]);
    assert.equal(full.status, 'not-applicable');
    assert.equal(full.violationCount, 0);

    const safeThemeMetadata = telemetryModule.buildUiTelemetryPrivacySelfCheck({
        theme: {
            resolver: {
                hostThemeName: 'black',
                contrastChecks: [{ name: 'body-text' }]
            }
        }
    }, 'sanitized');
    assert.equal(safeThemeMetadata.status, 'passed');
    assert.equal(safeThemeMetadata.violationCount, 0);
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
                        hookStates: {
                            window: {
                                openDocker: {
                                    notes: ['captured', 'wrapped', 'update_container CloudBerryBackup*radarr', 'inspect vaultwarden'],
                                    lastInvocation: {
                                        commandType: 'update_container',
                                        containerCount: 2,
                                        containerNames: ['CloudBerryBackup', 'radarr']
                                    }
                                }
                            }
                        },
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
                            details: {
                                title: 'Updating Networking',
                                containerCount: 1,
                                containerNames: ['vaultwarden'],
                                hookStates: {
                                    window: {
                                        openDocker: {
                                            notes: ['update_container CloudBerryBackup*radarr']
                                        }
                                    }
                                }
                            }
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
                            details: {
                                generation: 9,
                                liveUpdateStatus: true,
                                hostSyncSuspended: true,
                                hookStates: {
                                    window: {
                                        openDocker: {
                                            notes: ['update_container CloudBerryBackup*radarr']
                                        }
                                    }
                                }
                            }
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
            if (storageKey === 'dashboard-layout-docker-key') {
                return {
                    schemaVersion: 1,
                    type: 'docker',
                    layout: 'compactmatrix',
                    widgetWidthPx: 900,
                    folderCount: 5,
                    folderColumns: 2,
                    folderRows: 3,
                    estimatedFolderWidthPx: 446,
                    memberColumns: 2,
                    estimatedMemberWidthPx: 219
                };
            }
            return null;
        },
        storageKeys: {
            dockerPage: 'docker-page-key',
            dockerBulkUpdateTrace: 'docker-trace-key',
            dockerRequestBundleTrace: 'docker-request-key',
            dockerTraceHealth: 'docker-trace-health-key',
            dashboardLayoutDocker: 'dashboard-layout-docker-key',
            dashboardLayoutVm: 'dashboard-layout-vm-key'
        }
    });

    const pageSnapshot = collectors.collectDockerPageDiagnostics();
    const bulkUpdateTrace = collectors.collectDockerBulkUpdateTrace();
    const requestBundleTrace = collectors.collectDockerRequestBundleTrace();
    const traceHealth = collectors.collectDockerTraceHealth();
    const dashboardLayout = collectors.collectDashboardLayoutDiagnostics();

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
    assert.equal(dashboardLayout.docker.available, true);
    assert.equal(dashboardLayout.docker.folderColumns, 2);
    assert.equal(dashboardLayout.vm.available, false);

    const bundle = {
        bundleMeta: { privacyMode: 'sanitized', bundleSaltHash: 'bundle-salt' },
        redactionManifest: {}
    };
    const redactor = loadTelemetryModule(root).createUiTelemetryRedactor(bundle, 'sanitized');
    const sanitizedPageSnapshot = collectors.collectDockerPageDiagnostics(redactor);
    const sanitizedBulkUpdateTrace = collectors.collectDockerBulkUpdateTrace(redactor);
    const sanitizedRequestBundleTrace = collectors.collectDockerRequestBundleTrace(redactor);
    const serializedDockerTelemetry = JSON.stringify({
        pageSnapshot: sanitizedPageSnapshot,
        bulkUpdateTrace: sanitizedBulkUpdateTrace,
        requestBundleTrace: sanitizedRequestBundleTrace
    });
    assert.doesNotMatch(serializedDockerTelemetry, /vaultwarden|CloudBerryBackup|radarr|private-label|private-live-order|private-saved-order|private-reconciled-order|Networking/);
    assert.match(sanitizedPageSnapshot.correlation.stateSignature, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedPageSnapshot.correlation.orderReconciliation.liveOrderFingerprint, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedPageSnapshot.topLevelRows.entries[0].folderId, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedPageSnapshot.topLevelRows.entries[1].containerName, /^ui-[0-9a-f]{16}$/);
    assert.match(
        sanitizedPageSnapshot.correlation.hookStates.window.openDocker.notes[2],
        /^update_container ui-[0-9a-f]{16}\*ui-[0-9a-f]{16}$/
    );
    assert.match(
        sanitizedPageSnapshot.correlation.hookStates.window.openDocker.lastInvocation.containerNames[0],
        /^ui-[0-9a-f]{16}$/
    );
    assert.match(
        sanitizedPageSnapshot.correlation.hookStates.window.openDocker.notes[3],
        /^note-[0-9a-f]{16}$/
    );
    assert.match(sanitizedBulkUpdateTrace.entries[0].details.title, /^ui-[0-9a-f]{16}$/);
    assert.match(
        sanitizedBulkUpdateTrace.entries[0].details.hookStates.window.openDocker.notes[0],
        /^update_container ui-[0-9a-f]{16}\*ui-[0-9a-f]{16}$/
    );
    assert.match(
        sanitizedRequestBundleTrace.entries[0].details.hookStates.window.openDocker.notes[0],
        /^update_container ui-[0-9a-f]{16}\*ui-[0-9a-f]{16}$/
    );

    const fullBundle = {
        bundleMeta: { privacyMode: 'full' },
        redactionManifest: {}
    };
    const fullRedactor = loadTelemetryModule(root).createUiTelemetryRedactor(fullBundle, 'full');
    const fullPageSnapshot = collectors.collectDockerPageDiagnostics(fullRedactor);
    assert.equal(
        fullPageSnapshot.correlation.hookStates.window.openDocker.notes[2],
        'update_container CloudBerryBackup*radarr'
    );
    assert.deepEqual(
        fullPageSnapshot.correlation.hookStates.window.openDocker.lastInvocation.containerNames,
        ['CloudBerryBackup', 'radarr']
    );
});
