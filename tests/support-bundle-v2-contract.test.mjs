import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libDiagnosticsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php'
);

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildFixturePhp = (manifestPath) => `<?php
const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 80;
const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 7;
const FVPLUS_DEFAULT_FOLDER_STATUS_COLORS = [
    'started' => '#00ff00',
    'paused' => '#f5c100',
    'stopped' => '#ff4d4f'
];

function readInstalledManifestPathCandidates(): array {
    return [${phpSingleQuote(manifestPath)}];
}

function readInstalledVersion(): string {
    return '2026.04.04.10';
}

function fvplus_detect_runtime_plugin_conflicts(): array {
    return [
        [
            'key' => 'folder.view3',
            'name' => 'FolderView',
            'runtimeDir' => '/usr/local/emhttp/plugins/folder.view3'
        ]
    ];
}

function normalizeFolderParentIdValue($value): string {
    return trim((string)$value);
}

function normalizeFolderMembers($members): array {
    return array_values(array_map('strval', is_array($members) ? $members : []));
}

function getFolderLabelValueFromLabels(array $labels): string {
    return '';
}

function dockerInfoLabelsForName(array $infoByName, string $name): array {
    return [];
}

function autoRuleDecision(array $rules, string $name, array $infoByName, string $type): array {
    return ['assignedRule' => null];
}

require_once ${phpSingleQuote(libDiagnosticsPath)};

$diagnostics = [
    'schemaVersion' => 7,
    'pluginVersion' => '2026.04.04.10',
    'environment' => [
        'unraidVersion' => '6.12.10',
        'phpVersion' => '8.3.30',
        'os' => 'Linux 6.1.99-Unraid',
        'timezone' => 'America/New_York',
        'serverSoftware' => 'nginx',
        'request' => [
            'privacyMode' => 'full',
            'userAgent' => 'Mozilla/5.0 SecretHost-Agent',
            'userAgentHash' => 'ua-static',
            'clientIp' => '192.168.6.25',
            'clientIpHash' => 'ip-static'
        ]
    ],
    'hashes' => [
        'dockerFolders' => [
            'file' => 'docker.folder.json',
            'path' => '/boot/config/plugins/folderview.plus/docker.folder.json',
            'exists' => true,
            'size' => 20,
            'modifiedAt' => '2026-04-04T00:00:00+00:00',
            'sha256' => 'hash-a'
        ],
        'dockerPrefs' => [
            'file' => 'docker.prefs.json',
            'path' => '/boot/config/plugins/folderview.plus/docker.prefs.json',
            'exists' => true,
            'size' => 30,
            'modifiedAt' => '2026-04-04T00:00:00+00:00',
            'sha256' => 'hash-b'
        ],
        'vmFolders' => [
            'file' => 'vm.folder.json',
            'path' => '/boot/config/plugins/folderview.plus/vm.folder.json',
            'exists' => true,
            'size' => 10,
            'modifiedAt' => '2026-04-04T00:00:00+00:00',
            'sha256' => 'hash-c'
        ],
        'vmPrefs' => [
            'file' => 'vm.prefs.json',
            'path' => '/boot/config/plugins/folderview.plus/vm.prefs.json',
            'exists' => true,
            'size' => 15,
            'modifiedAt' => '2026-04-04T00:00:00+00:00',
            'sha256' => 'hash-d'
        ]
    ],
    'customIcons' => [
        'path' => [
            'path' => '/boot/config/plugins/folderview.plus/images/custom/PlexSecretIcon.png',
            'exists' => true,
            'readable' => true,
            'writable' => true
        ],
        'issues' => [],
        'repairHint' => 'Delete /boot/config/plugins/folderview.plus/images/custom/PlexSecretIcon.png if unused.',
        'fileCount' => 2,
        'orphanedIconCount' => 1,
        'topReferences' => [
            [
                'name' => 'PlexMediaServer',
                'referenceCount' => 4
            ]
        ]
    ],
    'summary' => [
        'status' => 'healthy',
        'headline' => 'No major plugin health issues detected.',
        'detail' => 'Use support exports only if needed.',
        'errorCount' => 0,
        'warningCount' => 0,
        'totalIssues' => 0,
        'recommendedActions' => [
            [
                'action' => 'normalize_prefs',
                'label' => 'Validate and normalize prefs',
                'reason' => 'Recommended based on the latest health check.'
            ]
        ],
        'cards' => []
    ],
    'recentTimeline' => [
        [
            'timestamp' => '2026-04-04T12:00:00+00:00',
            'action' => 'create_folder',
            'type' => 'docker',
            'status' => 'ok',
            'summary' => 'name=PlexMediaServer, folderId=root01, itemCount=2'
        ]
    ],
    'importExportHistory' => [
        'retained' => 1,
        'returned' => 1,
        'events' => [
            [
                'id' => 'evt-1',
                'timestamp' => '2026-04-04T12:00:00+00:00',
                'action' => 'support_bundle_export',
                'type' => 'docker',
                'status' => 'ok',
                'source' => 'ui',
                'details' => [
                    'name' => 'PlexMediaServer',
                    'folderName' => 'Plex Root Secret',
                    'path' => '/boot/config/plugins/folderview.plus/docker.folder.json',
                    'ip' => '192.168.6.25',
                    'url' => 'https://tower-main.local/Docker',
                    'userAgent' => 'Mozilla/5.0 SecretHost-Agent'
                ]
            ]
        ]
    ],
    'update' => [
        'ok' => true,
        'updateAvailable' => false,
        'currentVersion' => '2026.04.04.10',
        'remoteVersion' => '2026.04.04.10'
    ],
    'types' => [
        'docker' => [
            'folderPath' => '/boot/config/plugins/folderview.plus/docker.folder.json',
            'prefsPath' => '/boot/config/plugins/folderview.plus/docker.prefs.json',
            'foldersExists' => true,
            'prefsExists' => true,
            'folderCount' => 2,
            'sortMode' => 'manual',
            'ruleCount' => 1,
            'manualOrderCount' => 2,
            'pinnedFolderCount' => 1,
            'pinnedFolderIds' => ['root01'],
            'expandedFolderState' => ['root01' => true, 'child01' => false],
            'hideEmptyFolders' => false,
            'appColumnWidth' => 'standard',
            'setupWizardCompleted' => true,
            'settingsMode' => 'advanced',
            'runtimePrefsSchema' => 3,
            'liveRefreshEnabled' => true,
            'liveRefreshSeconds' => 20,
            'performanceMode' => false,
            'lazyPreviewEnabled' => false,
            'lazyPreviewThreshold' => 30,
            'themeCompatibilityMode' => 'auto',
            'dashboard' => ['layout' => 'full-width', 'expandToggle' => true, 'greyscale' => false, 'folderLabel' => true],
            'health' => ['cardsEnabled' => true],
            'status' => ['displayMode' => 'balanced'],
            'backupSchedule' => ['enabled' => true, 'intervalHours' => 24, 'retention' => 25],
            'lastBackup' => ['name' => 'docker-2026-04-04.json', 'createdAt' => '2026-04-04T00:00:00+00:00', 'reason' => 'manual-diagnostics', 'count' => 2],
            'backupCount' => 1,
            'templateCount' => 1,
            'integrityChecks' => [
                'duplicateFolderNames' => [
                    'count' => 1,
                    'examples' => [
                        [
                            'name' => 'Plex Root Secret',
                            'folderIds' => ['root01', 'root02']
                        ]
                    ]
                ],
                'orphanedMembers' => [
                    'count' => 1,
                    'folders' => [
                        [
                            'folderId' => 'root01',
                            'count' => 1,
                            'items' => ['PlexMediaServer']
                        ]
                    ]
                ],
                'duplicateAssignments' => [
                    'explicit' => [
                        'count' => 1,
                        'examples' => [
                            [
                                'item' => 'PlexMediaServer',
                                'folderIds' => ['root01', 'root02'],
                                'folderCount' => 2
                            ]
                        ]
                    ],
                    'regex' => ['count' => 0, 'examples' => []],
                    'effective' => ['count' => 0, 'examples' => []]
                ],
                'pathHealth' => [
                    'paths' => [
                        'configDir' => ['path' => '/boot/config/plugins/folderview.plus', 'exists' => true],
                        'sourceDir' => ['path' => '/usr/local/emhttp/plugins/folderview.plus', 'exists' => true],
                        'folderFile' => ['path' => '/boot/config/plugins/folderview.plus/docker.folder.json', 'exists' => true],
                        'prefsFile' => ['path' => '/boot/config/plugins/folderview.plus/docker.prefs.json', 'exists' => true],
                        'backupDir' => ['path' => '/boot/config/plugins/folderview.plus/backups/docker', 'exists' => true]
                    ],
                    'issues' => ['Missing /boot/config/plugins/folderview.plus/docker.folder.json'],
                    'legacyRemnants' => [
                        ['path' => '/boot/config/plugins/folder.view3/private.json']
                    ]
                ]
            ],
            'stateSnapshot' => [
                'totalItems' => 3,
                'assignedItems' => 2,
                'unassignedItems' => 1,
                'stateCounts' => ['started' => 2, 'paused' => 0, 'stopped' => 1],
                'rootFolderCount' => 1,
                'nestedFolderCount' => 1,
                'maxDepth' => 1,
                'updateCounts' => ['available' => 1, 'upToDate' => 1, 'unknown' => 1, 'total' => 3],
                'folders' => [
                    [
                        'folderId' => 'root01',
                        'folderName' => 'Plex Root Secret',
                        'parentId' => '',
                        'depth' => 0,
                        'members' => [
                            'count' => 2,
                            'items' => ['PlexMediaServer', 'SonarrStack']
                        ]
                    ],
                    [
                        'folderId' => 'child01',
                        'folderName' => 'Child Stack Secret',
                        'parentId' => 'root01',
                        'depth' => 1,
                        'members' => [
                            'count' => 1,
                            'items' => ['SonarrStack']
                        ]
                    ]
                ]
            ]
        ],
        'vm' => [
            'folderPath' => '/boot/config/plugins/folderview.plus/vm.folder.json',
            'prefsPath' => '/boot/config/plugins/folderview.plus/vm.prefs.json',
            'foldersExists' => true,
            'prefsExists' => true,
            'folderCount' => 0,
            'sortMode' => 'manual',
            'ruleCount' => 0,
            'manualOrderCount' => 0,
            'pinnedFolderCount' => 0,
            'pinnedFolderIds' => [],
            'expandedFolderState' => [],
            'hideEmptyFolders' => false,
            'appColumnWidth' => 'standard',
            'setupWizardCompleted' => false,
            'settingsMode' => 'basic',
            'runtimePrefsSchema' => 3,
            'liveRefreshEnabled' => false,
            'liveRefreshSeconds' => 20,
            'performanceMode' => false,
            'lazyPreviewEnabled' => false,
            'lazyPreviewThreshold' => 30,
            'themeCompatibilityMode' => 'auto',
            'dashboard' => ['layout' => 'classic', 'expandToggle' => true, 'greyscale' => false, 'folderLabel' => true],
            'health' => ['cardsEnabled' => true],
            'status' => ['displayMode' => 'balanced'],
            'backupSchedule' => ['enabled' => false, 'intervalHours' => 24, 'retention' => 25],
            'lastBackup' => null,
            'backupCount' => 0,
            'templateCount' => 0,
            'integrityChecks' => [
                'duplicateFolderNames' => ['count' => 0, 'examples' => []],
                'orphanedMembers' => ['count' => 0, 'folders' => []],
                'duplicateAssignments' => [
                    'explicit' => ['count' => 0, 'examples' => []],
                    'regex' => ['count' => 0, 'examples' => []],
                    'effective' => ['count' => 0, 'examples' => []]
                ],
                'pathHealth' => [
                    'paths' => [
                        'configDir' => ['path' => '/boot/config/plugins/folderview.plus', 'exists' => true],
                        'sourceDir' => ['path' => '/usr/local/emhttp/plugins/folderview.plus', 'exists' => true],
                        'folderFile' => ['path' => '/boot/config/plugins/folderview.plus/vm.folder.json', 'exists' => true],
                        'prefsFile' => ['path' => '/boot/config/plugins/folderview.plus/vm.prefs.json', 'exists' => true],
                        'backupDir' => ['path' => '/boot/config/plugins/folderview.plus/backups/vm', 'exists' => true]
                    ],
                    'issues' => [],
                    'legacyRemnants' => []
                ]
            ],
            'stateSnapshot' => [
                'totalItems' => 1,
                'assignedItems' => 0,
                'unassignedItems' => 1,
                'stateCounts' => ['started' => 0, 'paused' => 0, 'stopped' => 1],
                'rootFolderCount' => 0,
                'nestedFolderCount' => 0,
                'maxDepth' => 0,
                'updateCounts' => ['available' => 0, 'upToDate' => 0, 'unknown' => 1, 'total' => 1],
                'folders' => []
            ]
        ]
    ]
];

$integrityFindings = [
    'docker' => $diagnostics['types']['docker']['integrityChecks'],
    'vm' => $diagnostics['types']['vm']['integrityChecks']
];

$sanitizedRedactor = diagnosticsCreateSupportBundleRedactor('sanitized');
$fullRedactor = diagnosticsCreateSupportBundleRedactor('full');

$payload = [
    'sanitized' => [
        'bundleMeta' => diagnosticsBuildSupportBundleMetaSection($diagnostics, $sanitizedRedactor),
        'system' => diagnosticsBuildSupportBundleSystemSection($diagnostics, $integrityFindings, $sanitizedRedactor),
        'pluginState' => diagnosticsBuildSupportBundlePluginStateSection($diagnostics, $sanitizedRedactor),
        'runtimeState' => diagnosticsBuildSupportBundleRuntimeStateSection($diagnostics, $sanitizedRedactor),
        'uiTelemetry' => new stdClass(),
        'healthAndHistory' => diagnosticsBuildSupportBundleHealthAndHistorySection($diagnostics, $integrityFindings, $sanitizedRedactor),
        'redactionManifest' => diagnosticsBuildSupportBundleRedactionManifestSection($sanitizedRedactor)
    ],
    'full' => [
        'bundleMeta' => diagnosticsBuildSupportBundleMetaSection($diagnostics, $fullRedactor),
        'system' => diagnosticsBuildSupportBundleSystemSection($diagnostics, $integrityFindings, $fullRedactor),
        'pluginState' => diagnosticsBuildSupportBundlePluginStateSection($diagnostics, $fullRedactor),
        'runtimeState' => diagnosticsBuildSupportBundleRuntimeStateSection($diagnostics, $fullRedactor),
        'uiTelemetry' => new stdClass(),
        'healthAndHistory' => diagnosticsBuildSupportBundleHealthAndHistorySection($diagnostics, $integrityFindings, $fullRedactor),
        'redactionManifest' => diagnosticsBuildSupportBundleRedactionManifestSection($fullRedactor)
    ],
    'vmStateSnapshot' => diagnosticsBuildStateSnapshot(
        'vm',
        [],
        [],
        ['Orion VM Secret' => ['name' => 'Orion VM Secret', 'state' => 'stopped']],
        'sanitized'
    )
];

echo json_encode($payload, JSON_UNESCAPED_SLASHES);
`;

const loadSupportBundleFixture = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-support-bundle-v2-'));
    const harnessPath = path.join(tempDir, 'fixture.php');
    const manifestPath = path.join(tempDir, 'folderview.plus.plg');
    fs.writeFileSync(
        manifestPath,
        [
            '<!DOCTYPE PLUGIN [',
            '<!ENTITY github "alexphillips-dev/FolderView-Plus">',
            '<!ENTITY pluginURL "https://raw.githubusercontent.com/&github;/dev/folderview.plus.plg">',
            ']>',
            '<PLUGIN pluginURL="&pluginURL;"></PLUGIN>'
        ].join('\n'),
        'utf8'
    );
    fs.writeFileSync(harnessPath, buildFixturePhp(manifestPath), 'utf8');
    try {
        const raw = execFileSync('php', [harnessPath], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000
        });
        return JSON.parse(raw);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const fixture = loadSupportBundleFixture();

test('support bundle v2 fixture exposes the exact top-level contract', () => {
    const expectedTopLevelKeys = [
        'bundleMeta',
        'healthAndHistory',
        'pluginState',
        'redactionManifest',
        'runtimeState',
        'system',
        'uiTelemetry'
    ];
    for (const mode of ['sanitized', 'full']) {
        const bundle = fixture[mode];
        assert.deepEqual(Object.keys(bundle).sort(), expectedTopLevelKeys);
        assert.equal(bundle.bundleMeta.bundleType, 'FolderViewPlusSupportBundle');
        assert.equal(bundle.bundleMeta.bundleVersion, 2);
        assert.equal(bundle.bundleMeta.schemaVersion, 7);
        assert.equal(bundle.bundleMeta.pluginVersion, '2026.04.04.10');
        assert.equal(bundle.bundleMeta.channel, 'dev');
        assert.equal(bundle.bundleMeta.privacyMode, mode);
        assert.equal(bundle.redactionManifest.mode, mode);
        assert.equal(bundle.uiTelemetry && typeof bundle.uiTelemetry, 'object');
        assert.ok(bundle.system && typeof bundle.system === 'object');
        assert.ok(bundle.pluginState?.docker && bundle.pluginState?.vm);
        assert.ok(bundle.runtimeState?.docker && bundle.runtimeState?.vm);
        assert.ok(bundle.healthAndHistory?.summary && typeof bundle.healthAndHistory.summary === 'object');
        assert.ok(bundle.pluginState.docker.prefs?.dashboard && typeof bundle.pluginState.docker.prefs.dashboard === 'object');
        assert.equal(bundle.runtimeState.docker.entitySummary.total, 3);
        assert.equal(bundle.runtimeState.docker.entitySummary.assigned, 2);
        assert.equal(bundle.runtimeState.docker.entitySummary.unassigned, 1);
        assert.equal(bundle.runtimeState.vm.entitySummary.total, 1);
        assert.equal(bundle.runtimeState.vm.entitySummary.unassigned, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.rootFolderCount, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.nestedFolderCount, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.maxDepth, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].parentId, '');
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].depth, 0);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].depth, 1);
        assert.equal(bundle.runtimeState.docker.updateStateSummary.available, 1);
        assert.equal(bundle.runtimeState.docker.updateStateSummary.total, 3);
        assert.equal(bundle.runtimeState.vm.updateStateSummary.unknown, 1);
        assert.equal(bundle.runtimeState.vm.updateStateSummary.total, 1);
        if (mode === 'full') {
            assert.deepEqual(bundle.pluginState.docker.prefs.expandedFolderState, { root01: true, child01: false });
            assert.deepEqual(bundle.pluginState.docker.prefs.pinnedFolders, ['root01']);
            assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId, 'root01');
            assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].folderId, 'child01');
            assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].parentId, 'root01');
        } else {
            const expandedState = bundle.pluginState.docker.prefs.expandedFolderState || {};
            const expandedKeys = Object.keys(expandedState);
            assert.equal(expandedKeys.length, 2);
            for (const key of expandedKeys) {
                assert.match(key, /^[0-9a-f]{16}$/);
            }
            assert.deepEqual(Object.values(expandedState), [true, false]);
            assert.equal(bundle.pluginState.docker.prefs.pinnedFolders.length, 1);
            assert.match(bundle.pluginState.docker.prefs.pinnedFolders[0], /^[0-9a-f]{16}$/);
            assert.equal(
                bundle.pluginState.docker.prefs.pinnedFolders[0],
                bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId
            );
            assert.match(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId, /^[0-9a-f]{16}$/);
            assert.match(bundle.runtimeState.docker.folderHierarchySummary.folders[1].folderId, /^[0-9a-f]{16}$/);
            assert.equal(
                bundle.runtimeState.docker.folderHierarchySummary.folders[1].parentId,
                bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId
            );
        }
        assert.equal(Object.prototype.hasOwnProperty.call(bundle, 'diagnostics'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(bundle, 'clientTelemetry'), false);
    }
});

test('sanitized support bundle fixture redacts paths, names, URLs, IPs, and user agents while recording the manifest', () => {
    const bundle = fixture.sanitized;
    const serialized = JSON.stringify(bundle);

    for (const forbidden of [
        '/boot/config/plugins/folderview.plus',
        '/usr/local/emhttp/plugins/folderview.plus',
        'PlexMediaServer',
        'Plex Root Secret',
        'SonarrStack',
        'root01',
        'root02',
        'child01',
        'https://tower-main.local/Docker',
        'Mozilla/5.0 SecretHost-Agent',
        '192.168.6.25'
    ]) {
        assert.equal(serialized.includes(forbidden), false, `sanitized bundle leaked ${forbidden}`);
    }

    assert.equal(bundle.bundleMeta.bundleSaltScope, 'per-bundle');
    assert.match(bundle.bundleMeta.bundleSaltHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.system.request.userAgent, null);
    assert.match(bundle.system.request.userAgentHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.system.request.clientIp, '192.168.x.x');
    assert.match(bundle.system.request.clientIpHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.system.pathHealth.customIcons.path.path, 'PlexSecretIcon.png');
    assert.match(bundle.system.pathHealth.customIcons.path.pathHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.system.pathHealth.customIcons.topReferences[0].name, null);
    assert.match(bundle.system.pathHealth.customIcons.topReferences[0].nameHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.system.pathHealth.customIcons.repairHint, null);
    assert.equal(bundle.pluginState.docker.folders.path, 'docker.folder.json');
    assert.match(bundle.pluginState.docker.folders.pathHash, /^[0-9a-f]{16}$/);
    assert.match(bundle.pluginState.docker.prefs.pinnedFolders[0], /^[0-9a-f]{16}$/);
    assert.equal(
        Object.keys(bundle.pluginState.docker.prefs.expandedFolderState || {}).every((key) => /^[0-9a-f]{16}$/.test(key)),
        true
    );
    assert.match(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId, /^[0-9a-f]{16}$/);
    assert.equal(
        bundle.runtimeState.docker.folderHierarchySummary.folders[1].parentId,
        bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId
    );
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderName, null);
    assert.match(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderNameHash, /^[0-9a-f]{16}$/);
    assert.deepEqual(bundle.runtimeState.docker.folderHierarchySummary.folders[0].members.items, []);
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].members.itemHashes.length, 2);
    assert.match(bundle.runtimeState.docker.folderHierarchySummary.folders[0].members.itemHashes[0], /^[0-9a-f]{16}$/);
    assert.equal(bundle.healthAndHistory.integrityFindings.docker.duplicateFolderNames.examples[0].name, null);
    assert.match(bundle.healthAndHistory.integrityFindings.docker.duplicateFolderNames.examples[0].nameHash, /^[0-9a-f]{16}$/);
    assert.deepEqual(bundle.healthAndHistory.integrityFindings.docker.orphanedMembers.folders[0].items, []);
    assert.match(bundle.healthAndHistory.integrityFindings.docker.orphanedMembers.folders[0].itemHashes[0], /^[0-9a-f]{16}$/);
    assert.equal(
        bundle.healthAndHistory.recentTimeline[0].summary.includes('nameHash='),
        true
    );
    assert.equal(
        bundle.healthAndHistory.recentMutations.events[0].details.url,
        null
    );
    assert.match(
        bundle.healthAndHistory.recentMutations.events[0].details.urlHash,
        /^[0-9a-f]{16}$/
    );
    assert.equal(bundle.healthAndHistory.recentMutations.events[0].details.ip, '192.168.x.x');
    assert.equal(bundle.redactionManifest.saltScope, 'per-bundle');
    assert.match(bundle.redactionManifest.saltHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.redactionManifest.hashedFields.includes('system.request.userAgentHash'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('pluginState.docker.prefs.expandedFolderState.*'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('runtimeState.docker.folderHierarchySummary.folders.*.folderId'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('healthAndHistory.integrityFindings.docker.orphanedMembers.folders.*.folderId'), true);
    assert.equal(bundle.redactionManifest.maskedFields.includes('system.request.clientIp'), true);
    assert.equal(bundle.redactionManifest.omittedFields.includes('system.pathHealth.customIcons.repairHint'), true);
    assert.equal(
        bundle.redactionManifest.omittedFields.includes('runtimeState.docker.folderHierarchySummary.folders.*.members.items'),
        true
    );
});

test('full support bundle fixture keeps raw troubleshooting fields and disables salt metadata', () => {
    const bundle = fixture.full;

    assert.equal(bundle.bundleMeta.bundleSaltScope, 'none');
    assert.equal(bundle.bundleMeta.bundleSaltHash, null);
    assert.equal(bundle.redactionManifest.saltScope, 'none');
    assert.equal(bundle.redactionManifest.saltHash, null);
    assert.deepEqual(bundle.redactionManifest.hashedFields, []);
    assert.deepEqual(bundle.redactionManifest.maskedFields, []);
    assert.deepEqual(bundle.redactionManifest.omittedFields, []);
    assert.equal(bundle.system.request.userAgent, 'Mozilla/5.0 SecretHost-Agent');
    assert.match(bundle.system.request.userAgentHash, /^[0-9a-f]{12}$/);
    assert.equal(bundle.system.request.clientIp, '192.168.6.25');
    assert.match(bundle.system.request.clientIpHash, /^[0-9a-f]{12}$/);
    assert.equal(bundle.system.pathHealth.customIcons.path.path, '/boot/config/plugins/folderview.plus/images/custom/PlexSecretIcon.png');
    assert.equal(bundle.system.pathHealth.customIcons.topReferences[0].name, 'PlexMediaServer');
    assert.equal(bundle.system.pathHealth.customIcons.repairHint, 'Delete /boot/config/plugins/folderview.plus/images/custom/PlexSecretIcon.png if unused.');
    assert.equal(bundle.pluginState.docker.folders.path, '/boot/config/plugins/folderview.plus/docker.folder.json');
    assert.deepEqual(bundle.pluginState.docker.prefs.expandedFolderState, { root01: true, child01: false });
    assert.deepEqual(bundle.pluginState.docker.prefs.pinnedFolders, ['root01']);
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderId, 'root01');
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].parentId, 'root01');
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].folderName, 'Plex Root Secret');
    assert.deepEqual(bundle.runtimeState.docker.folderHierarchySummary.folders[0].members.items, ['PlexMediaServer', 'SonarrStack']);
    assert.equal(bundle.healthAndHistory.integrityFindings.docker.duplicateFolderNames.examples[0].name, 'Plex Root Secret');
    assert.deepEqual(bundle.healthAndHistory.integrityFindings.docker.orphanedMembers.folders[0].items, ['PlexMediaServer']);
    assert.equal(bundle.healthAndHistory.recentTimeline[0].summary, 'name=PlexMediaServer, folderId=root01, itemCount=2');
    assert.equal(bundle.healthAndHistory.recentMutations.events[0].details.url, 'https://tower-main.local/Docker');
    assert.equal(bundle.healthAndHistory.recentMutations.events[0].details.ip, '192.168.6.25');
});

test('vm state snapshot marks all entities as unknown for update totals', () => {
    assert.equal(fixture.vmStateSnapshot.totalItems, 1);
    assert.equal(fixture.vmStateSnapshot.unassignedItems, 1);
    assert.equal(fixture.vmStateSnapshot.stateCounts.stopped, 1);
    assert.equal(fixture.vmStateSnapshot.updateCounts.available, 0);
    assert.equal(fixture.vmStateSnapshot.updateCounts.upToDate, 0);
    assert.equal(fixture.vmStateSnapshot.updateCounts.unknown, 1);
    assert.equal(fixture.vmStateSnapshot.updateCounts.total, 1);
});
