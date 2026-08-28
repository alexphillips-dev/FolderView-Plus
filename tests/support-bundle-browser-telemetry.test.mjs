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
const runtimePageDiagnosticsSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.page-diagnostics.js'
), 'utf8');
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

const loadRuntimePageDiagnostics = (root = {}) => {
    const context = { globalThis: root, module: { exports: {} }, exports: {}, console };
    vm.runInNewContext(runtimePageDiagnosticsSource, context, { filename: 'runtime.page-diagnostics.js' });
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

test('support bundle browser telemetry exports fresh privacy-safe Dashboard visual evidence', () => {
    const capturedAt = new Date(Date.now() - 60_000).toISOString();
    const record = {
        schemaVersion: 1,
        type: 'docker',
        latest: {
            schemaVersion: 1,
            type: 'docker',
            capturedAt,
            pluginVersion: '2026.07.23.01',
            origin: { route: '/Dashboard', surface: 'dashboard' },
            environment: {
                viewport: { width: 390, height: 844 },
                viewportClass: 'phone-size',
                input: { touchPoints: 5, coarsePointer: true, mobileHint: true }
            },
            overflow: {
                labels: {
                    unexpectedClipCount: 0,
                    samples: [{
                        labelFingerprint: '0123456789abcdef',
                        labelLengthBucket: '25-40',
                        overflowPx: 12,
                        intentionalEllipsis: true
                    }]
                }
            },
            verdict: { status: 'healthy', codes: ['intentional-ellipsis-only'] }
        },
        snapshots: []
    };
    record.snapshots.push(record.latest);
    const root = {
        innerWidth: 390,
        innerHeight: 844,
        devicePixelRatio: 3,
        navigator: { maxTouchPoints: 5, userAgentData: { mobile: true } },
        location: { pathname: '/Settings/FolderViewPlus' },
        matchMedia: () => ({ matches: true })
    };
    const collectors = loadBrowserModule(root).createCollectors({
        storageKeys: {
            dashboardVisualDocker: 'dashboard-visual-docker',
            dashboardVisualVm: 'dashboard-visual-vm'
        },
        readClientDiagnosticsStorageRecord(key) {
            return key === 'dashboard-visual-docker' ? record : null;
        }
    });
    const visual = collectors.collectDashboardVisualDiagnostics(null, {
        pluginVersion: '2026.07.23.01'
    });

    assert.equal(visual.docker.available, true);
    assert.equal(visual.docker.freshness, 'fresh');
    assert.equal(visual.docker.captureQuality.status, 'ready');
    assert.equal(visual.docker.environmentComparison.differs, false);
    assert.equal(visual.docker.latest.verdict.status, 'healthy');
    assert.equal(visual.docker.historyCount, 1);
    assert.equal(visual.vm.available, false);
    assert.equal(JSON.stringify(visual).includes('private-container'), false);
});

test('support bundle browser telemetry re-allowlists shared runtime page diagnostics', () => {
    const capturedAt = new Date().toISOString();
    const collectors = loadBrowserModule({}).createCollectors({
        runtimePageDiagnostics: loadRuntimePageDiagnostics(),
        storageKeys: { runtimePageDiagnostics: 'runtime-pages' },
        readClientDiagnosticsStorageRecord(key) {
            return key === 'runtime-pages' ? {
                surfaces: {
                    docker: [{
                        capturedAt,
                        surface: 'docker',
                        variant: 'folderview',
                        trigger: 'manual',
                        privateUrl: 'http://private-host/',
                        state: { visibleRows: 5, spinningControls: 2, rawDom: '<secret>' }
                    }]
                }
            } : null;
        }
    });
    const result = collectors.collectRuntimePageDiagnostics(null);
    assert.equal(result.available, true);
    assert.equal(result.surfaces.docker[0].state.visibleRows, 5);
    assert.equal(result.surfaces.docker[0].state.spinningControls, 2);
    assert.equal(JSON.stringify(result).includes('private-host'), false);
    assert.equal(JSON.stringify(result).includes('rawDom'), false);
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
        pluginVersion: '2026.07.13.06',
        nowMs: Date.parse('2026-07-13T18:02:00.000Z')
    });

    assert.equal(snapshot.count, 1);
    assert.equal(snapshot.retainedCount, 2);
    assert.equal(snapshot.collectionPluginVersion, '2026.07.13.06');
    assert.equal(snapshot.firstSeenAt, '2026-05-21T19:09:29.870Z');
    assert.equal(snapshot.lastSeenAt, '2026-07-13T18:01:00.000Z');
    assert.equal(snapshot.currentSessionCount, 1);
    assert.equal(snapshot.historicalCount, 1);
    assert.equal(snapshot.last30DaysCount, 0);
    assert.equal(snapshot.olderCount, 1);
    assert.equal(snapshot.olderByCategory.unknown, 1);
    assert.equal(snapshot.entries[0].currentSession, true);
    assert.equal(snapshot.entries[0].observedPluginVersion, '2026.07.13.06');
});

test('browser error telemetry does not misattribute legacy records to the collection plugin version', () => {
    const browserModule = loadBrowserModule({});
    const snapshot = browserModule.createCollectors({
        readClientDiagnosticsStorageRecord() {
            return [{ at: '2026-05-21T19:09:29.870Z', message: 'Legacy failure' }];
        }
    }).collectBrowserConsoleErrors({
        pluginVersion: '2026.07.13.06',
        nowMs: Date.parse('2026-05-21T19:10:00.000Z')
    });

    assert.equal(snapshot.collectionPluginVersion, '2026.07.13.06');
    assert.equal(snapshot.entries[0].observedPluginVersion, 'unknown');
    assert.equal(snapshot.entries[0].currentSession, false);
});

test('startup incident telemetry remains available after recovery and is redacted by support-bundle export', () => {
    const root = {
        FolderViewPlusFatalBanner: {
            getStartupIncidentSnapshot() {
                return {
                    available: true,
                    schemaVersion: 1,
                    incidentId: 'private-incident-id',
                    status: 'recovered',
                    surface: 'Settings',
                    code: 'FVPLUS-SET-LOADER-001',
                    category: 'missing-asset',
                    route: 'https://tower.local/Settings/FolderViewPlus',
                    modules: [{ name: 'folderviewplus.js', outcome: 'loaded', durationMs: 12 }],
                    recoveryAttempts: [{ action: 'retry', status: 'succeeded', durationMs: 24 }]
                };
            }
        },
        document: { querySelectorAll: () => [], cookie: '' },
        navigator: {},
        location: {
            origin: 'https://tower.local',
            pathname: '/Settings/FolderViewPlus',
            href: 'https://tower.local/Settings/FolderViewPlus'
        }
    };
    const browserModule = loadBrowserModule(root);
    root.FolderViewPlusSupportBundleBrowser = browserModule;
    const raw = browserModule.createCollectors().collectStartupIncident(null);
    assert.equal(raw.status, 'recovered');
    assert.equal(raw.recoveryAttempts[0].status, 'succeeded');

    const telemetryModule = loadTelemetryModule(root);
    const payload = telemetryModule.createApi({
        normalizeSupportBundleV2Payload: (bundle) => ({
            ...bundle,
            bundleMeta: { ...(bundle.bundleMeta || {}) },
            uiTelemetry: { ...(bundle.uiTelemetry || {}) },
            healthAndHistory: { ...(bundle.healthAndHistory || {}) },
            redactionManifest: { ...(bundle.redactionManifest || {}) }
        })
    }).collectSupportBundleUiTelemetry({
        bundleMeta: { privacyMode: 'sanitized', redactionSalt: 'test-salt' },
        uiTelemetry: {},
        healthAndHistory: {},
        redactionManifest: {}
    });
    assert.equal(payload.uiTelemetry.startupIncident.available, true);
    assert.match(payload.uiTelemetry.startupIncident.incidentId, /^ui-[0-9a-f]{16}$/);
    assert.notEqual(payload.uiTelemetry.startupIncident.route, 'https://tower.local/Settings/FolderViewPlus');
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
        readClientDiagnosticsStorageRecord: (key) => key === 'runtime-performance-docker-key' ? {
            schemaVersion: 1,
            surface: 'docker',
            operations: { folderGrouping: { count: 2, p95Ms: 51.7 } }
        } : null,
        storageKeys: {
            runtimePerformance: {
                docker: 'runtime-performance-docker-key',
                settings: 'runtime-performance-settings-key'
            }
        },
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
    assert.equal(payload.uiTelemetry.runtimePerformance.available, true);
    assert.equal(payload.uiTelemetry.runtimePerformance.surfaces.docker.operations.folderGrouping.p95Ms, 51.7);
    assert.equal(payload.uiTelemetry.runtimePerformance.surfaces.settings.available, false);
    assert.equal(payload.uiTelemetry.dashboardVisual.docker.available, false);
    assert.equal(payload.healthAndHistory.diagnosticDomains.domains.layoutRendering.status, 'unavailable');
    assert.equal(payload.healthAndHistory.diagnosticDomains.domains.runtimeRequests.status, 'healthy');
    assert.equal(payload.redactionManifest.privacySelfCheck.status, 'passed');
    assert.equal(payload.redactionManifest.privacySelfCheck.scope, 'uiTelemetry');
    assert.equal(payload.redactionManifest.privacySelfCheck.violationCount, 0);
});

test('support bundle preview uses the latest completed health summary without changing full exports', () => {
    const diagnosticsSummary = {
        cards: [
            { key: 'docker', status: 'healthy', count: 0 },
            { key: 'vm', status: 'healthy', count: 0 },
            { key: 'storage', status: 'healthy', count: 0 },
            { key: 'custom_icons', status: 'warning', count: 2 },
            { key: 'update', status: 'healthy', count: 0 }
        ]
    };
    const telemetryModule = loadTelemetryModule({});
    const api = telemetryModule.createApi({
        normalizeSupportBundleV2Payload: (bundle) => ({
            ...bundle,
            bundleMeta: { ...(bundle.bundleMeta || {}) },
            uiTelemetry: { ...(bundle.uiTelemetry || {}) },
            healthAndHistory: { ...(bundle.healthAndHistory || {}) },
            redactionManifest: { ...(bundle.redactionManifest || {}) }
        }),
        getDiagnosticsSummary: () => diagnosticsSummary
    });

    const preview = api.collectSupportBundleUiTelemetry({
        bundleMeta: { privacyMode: 'sanitized', previewOnly: true },
        healthAndHistory: { summary: {} }
    });
    const full = api.collectSupportBundleUiTelemetry({
        bundleMeta: { privacyMode: 'sanitized', previewOnly: false },
        healthAndHistory: {
            summary: {
                cards: [{ key: 'storage', status: 'error', count: 1 }]
            }
        }
    });

    assert.equal(preview.healthAndHistory.diagnosticDomains.domains.configurationIntegrity.status, 'healthy');
    assert.equal(preview.healthAndHistory.diagnosticDomains.domains.storage.status, 'healthy');
    assert.equal(preview.healthAndHistory.diagnosticDomains.domains.customIcons.status, 'warning');
    assert.equal(preview.healthAndHistory.diagnosticDomains.domains.customIcons.issueCount, 2);
    assert.equal(preview.healthAndHistory.diagnosticDomains.domains.update.status, 'healthy');
    assert.equal(full.healthAndHistory.diagnosticDomains.domains.storage.status, 'error');
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
            if (storageKey === 'docker-refresh-key') {
                return {
                    schemaVersion: 1,
                    verdict: { status: 'healthy', source: null, fullReloads: 1, renders: 1, reference: 'FVPLUS-DKR-REFRESH-001' },
                    totals: { loadlist: 1, listview: 1, renders: 1, requests: 1, busyPasses: 0, foldersRestored: 0 },
                    apiMismatch: { observedCount: 2, providerOnlyCount: 1, runtimeOnlyCount: 1, policy: 'native-structure-authoritative', hostReloadRequested: false },
                    completedSessionCount: 2
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
            if (storageKey === 'dashboard-lifecycle-key') {
                return {
                    schemaVersion: 1,
                    strategy: 'state-aware-incremental',
                    capturedAt: '2026-04-12T16:02:00+00:00',
                    latest: {
                        eventType: 'lifecycleRefreshResult',
                        containerId: 'private-container-id',
                        action: 'start',
                        settled: false,
                        observedState: { state: 'stopped', active: false, paused: false }
                    },
                    surface: {
                        containerId: 'private-container-id',
                        busyIconCount: 4,
                        capturedIconCount: 4,
                        statusIconClasses: 'fa fa-refresh fa-spin stopped red-text'
                    }
                };
            }
            if (storageKey === 'vm-lifecycle-key') {
                return {
                    schemaVersion: 1,
                    strategy: 'state-aware-incremental',
                    latest: {
                        eventType: 'lifecycleSurfaceFinalized',
                        uuid: 'private-vm-uuid',
                        action: 'domain-start',
                        settled: true
                    },
                    surface: {
                        busyIconCount: 0,
                        capturedIconCount: 0
                    }
                };
            }
            if (storageKey === 'runtime-performance-docker-key') {
                return {
                    schemaVersion: 1,
                    surface: 'docker',
                    milestones: {
                        nativeRowsVisible: { count: 1, lastMs: 31.4 }
                    },
                    operations: {
                        folderGrouping: { count: 2, averageMs: 44.1, p95Ms: 51.7 }
                    },
                    events: [{ type: 'operation', name: 'folderGrouping', durationMs: 51.7 }]
                };
            }
            return null;
        },
        storageKeys: {
            dockerPage: 'docker-page-key',
            dockerBulkUpdateTrace: 'docker-trace-key',
            dockerRequestBundleTrace: 'docker-request-key',
            dockerTraceHealth: 'docker-trace-health-key',
            dockerRefreshDiagnostics: 'docker-refresh-key',
            dashboardLayoutDocker: 'dashboard-layout-docker-key',
            dashboardLayoutVm: 'dashboard-layout-vm-key',
            dashboardLifecycle: 'dashboard-lifecycle-key',
            vmLifecycle: 'vm-lifecycle-key',
            runtimePerformance: {
                docker: 'runtime-performance-docker-key',
                settings: 'runtime-performance-settings-key'
            }
        }
    });

    const pageSnapshot = collectors.collectDockerPageDiagnostics();
    const bulkUpdateTrace = collectors.collectDockerBulkUpdateTrace();
    const requestBundleTrace = collectors.collectDockerRequestBundleTrace();
    const traceHealth = collectors.collectDockerTraceHealth();
    const refreshDiagnostics = collectors.collectDockerRefreshDiagnostics();
    const dashboardLayout = collectors.collectDashboardLayoutDiagnostics();
    const dashboardLifecycle = collectors.collectDashboardLifecycleDiagnostics();
    const vmLifecycle = collectors.collectVmLifecycleDiagnostics();

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
    assert.equal(refreshDiagnostics.available, true);
    assert.equal(refreshDiagnostics.verdict.status, 'healthy');
    assert.equal(refreshDiagnostics.apiMismatch.hostReloadRequested, false);
    assert.equal(dashboardLayout.docker.available, true);
    assert.equal(dashboardLayout.docker.folderColumns, 2);
    assert.equal(dashboardLayout.vm.available, false);
    assert.equal(dashboardLifecycle.available, true);
    assert.equal(dashboardLifecycle.latest.action, 'start');
    assert.equal(dashboardLifecycle.surface.busyIconCount, 4);
    assert.equal(vmLifecycle.available, true);
    assert.equal(vmLifecycle.latest.action, 'domain-start');
    assert.equal(vmLifecycle.latest.settled, true);

    const bundle = {
        bundleMeta: { privacyMode: 'sanitized', bundleSaltHash: 'bundle-salt' },
        redactionManifest: {}
    };
    const redactor = loadTelemetryModule(root).createUiTelemetryRedactor(bundle, 'sanitized');
    const sanitizedPageSnapshot = collectors.collectDockerPageDiagnostics(redactor);
    const sanitizedBulkUpdateTrace = collectors.collectDockerBulkUpdateTrace(redactor);
    const sanitizedRequestBundleTrace = collectors.collectDockerRequestBundleTrace(redactor);
    const sanitizedDashboardLifecycle = collectors.collectDashboardLifecycleDiagnostics(redactor);
    const sanitizedVmLifecycle = collectors.collectVmLifecycleDiagnostics(redactor);
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
    assert.match(sanitizedDashboardLifecycle.latest.containerId, /^ui-[0-9a-f]{16}$/);
    assert.match(sanitizedDashboardLifecycle.surface.containerId, /^ui-[0-9a-f]{16}$/);
    assert.doesNotMatch(JSON.stringify(sanitizedDashboardLifecycle), /private-container-id/);
    assert.match(sanitizedVmLifecycle.latest.uuid, /^ui-[0-9a-f]{16}$/);
    assert.doesNotMatch(JSON.stringify(sanitizedVmLifecycle), /private-vm-uuid/);
    assert.match(
        sanitizedBulkUpdateTrace.entries[0].details.hookStates.window.openDocker.notes[0],
        /^update_container ui-[0-9a-f]{16}\*ui-[0-9a-f]{16}$/
    );
    assert.match(
        sanitizedRequestBundleTrace.entries[0].details.hookStates.window.openDocker.notes[0],
        /^update_container ui-[0-9a-f]{16}\*ui-[0-9a-f]{16}$/
    );
    assert.match(telemetryModuleSource, /previewContextBridge:\s*collectDockerPreviewContextDiagnostics\(uiRedactor\)/);

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

test('support bundle telemetry exports privacy-safe persisted preview context bridge evidence', () => {
    const telemetryModule = loadTelemetryModule({});
    const api = telemetryModule.createApi({
        normalizeSupportBundleV2Payload: (bundle) => ({
            ...bundle,
            bundleMeta: { ...(bundle.bundleMeta || {}) },
            uiTelemetry: { ...(bundle.uiTelemetry || {}) },
            healthAndHistory: { ...(bundle.healthAndHistory || {}) },
            redactionManifest: { ...(bundle.redactionManifest || {}) }
        }),
        readClientDiagnosticsStorageRecord: (key) => key === 'docker-preview-context-key' ? {
            schemaVersion: 1,
            counters: { handlerIntegrityFailures: 0, dispatchAttempts: 2, dispatchSuccesses: 2 },
            rowModes: { '2': { bindings: 6 }, unlimited: { bindings: 6 } },
            rowIndexes: { '1': { bound: 6 }, '2': { bound: 6 } },
            childFolderPreview: {
                counters: { chipsRendered: 1, bindings: 1, menuOpenAttempts: 3, menuOpens: 3, menuOpenFailures: 0 },
                inputMethods: { mouse: 1, keyboard: 1, contextmenu: 1, touch: 0, unknown: 0 },
                lastEvent: {
                    type: 'menu-open',
                    outcome: 'success',
                    inputMethod: 'contextmenu',
                    folderName: 'private-folder'
                }
            },
            lastEvent: {
                type: 'dispatch',
                outcome: 'success',
                rowMode: 'unlimited',
                rowIndex: 2,
                triggerSource: 'status',
                inputMethod: 'keyboard',
                containerName: 'private-container'
            }
        } : null,
        storageKeys: { dockerPreviewContext: 'docker-preview-context-key' }
    });

    const payload = api.collectSupportBundleUiTelemetry({
        bundleMeta: { privacyMode: 'sanitized', redactionSalt: 'test-salt' }
    });
    const evidence = payload.uiTelemetry.dockerDiagnostics.previewContextBridge;

    assert.equal(evidence.available, true);
    assert.equal(evidence.counters.handlerIntegrityFailures, 0);
    assert.equal(evidence.lastEvent.rowMode, 'unlimited');
    assert.equal(evidence.lastEvent.rowIndex, 2);
    assert.equal(evidence.lastEvent.triggerSource, 'status');
    assert.equal(evidence.lastEvent.inputMethod, 'keyboard');
    assert.equal(evidence.childFolderPreview.counters.menuOpens, 3);
    assert.equal(evidence.childFolderPreview.inputMethods.contextmenu, 1);
    assert.match(evidence.childFolderPreview.lastEvent.folderName, /^ui-[0-9a-f]{16}$/);
    assert.match(evidence.lastEvent.containerName, /^ui-[0-9a-f]{16}$/);
    assert.doesNotMatch(JSON.stringify(evidence), /private-container|private-folder/);
});
