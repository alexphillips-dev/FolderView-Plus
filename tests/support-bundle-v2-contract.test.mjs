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

const buildFixturePhp = (manifestPath, sourceDir, apiErrorLogPath) => `<?php
$sourceDir = ${phpSingleQuote(sourceDir)};

const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 80;
const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 7;
const FVPLUS_API_ERROR_LOG = ${phpSingleQuote(apiErrorLogPath)};
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
    'requestSecurity' => [
        'schemaVersion' => 1,
        'enforcementMode' => 'strict',
        'trustedContext' => true,
        'authoritySource' => 'forwarded',
        'forwardedAuthorityStatus' => 'valid',
        'originStatus' => 'forwarded',
        'refererStatus' => 'forwarded'
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
                'managerCounts' => ['composeman' => 1, 'dockerman' => 1, 'unclassified' => 1],
                'entityDetails' => [
                    'total' => 3,
                    'maxEntries' => 200,
                    'truncated' => false,
                    'entries' => [
                        [
                            'name' => 'PlexMediaServer',
                            'state' => 'started',
                            'assigned' => true,
                            'manager' => 'dockerman',
                            'managed' => true,
                            'updated' => false,
                            'updateState' => 'available',
                            'provenance' => ['managerSource' => 'infoState', 'updateSource' => 'infoState'],
                            'renderExpectations' => ['statusToken' => 'updateReady', 'action' => 'applyUpdate', 'forceUpdateEligible' => false]
                        ],
                        [
                            'name' => 'SonarrStack',
                            'state' => 'started',
                            'assigned' => true,
                            'manager' => 'composeman',
                            'managed' => false,
                            'updated' => null,
                            'updateState' => 'unknown',
                            'provenance' => ['managerSource' => 'infoState', 'updateSource' => 'missing'],
                            'renderExpectations' => ['statusToken' => 'compose', 'action' => 'none', 'forceUpdateEligible' => false]
                        ],
                        [
                            'name' => 'LegacyTool',
                            'state' => 'stopped',
                            'assigned' => false,
                            'manager' => null,
                            'managed' => false,
                            'updated' => true,
                            'updateState' => 'upToDate',
                            'provenance' => ['managerSource' => 'missing', 'updateSource' => 'topLevelFallback'],
                            'renderExpectations' => ['statusToken' => 'upToDate', 'action' => 'forceUpdate', 'forceUpdateEligible' => true]
                        ]
                    ]
                ],
                'folders' => [
                    [
                        'folderId' => 'root01',
                        'folderName' => 'Plex Root Secret',
                        'parentId' => '',
                        'depth' => 0,
                        'members' => [
                            'count' => 2,
                            'items' => ['PlexMediaServer', 'SonarrStack']
                        ],
                        'settings' => ['previewUpdate' => true, 'hideUpdateColumn' => false],
                        'renderExpectations' => [
                            'updateColumnVisible' => true,
                            'statusToken' => 'updateReady',
                            'action' => 'applyUpdate',
                            'actionRequiresAdvancedView' => true,
                            'forceUpdateEligible' => false,
                            'managerTypes' => ['composeman', 'dockerman']
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
                        ],
                        'settings' => ['previewUpdate' => false, 'hideUpdateColumn' => true],
                        'renderExpectations' => [
                            'updateColumnVisible' => false,
                            'statusToken' => 'compose',
                            'action' => 'none',
                            'actionRequiresAdvancedView' => false,
                            'forceUpdateEligible' => false,
                            'managerTypes' => ['composeman']
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
                'managerCounts' => [],
                'entityDetails' => [
                    'total' => 1,
                    'maxEntries' => 200,
                    'truncated' => false,
                    'entries' => [
                        [
                            'name' => 'Orion VM Secret',
                            'state' => 'stopped',
                            'assigned' => false,
                            'manager' => null,
                            'managed' => false,
                            'updated' => null,
                            'updateState' => 'unknown',
                            'provenance' => ['managerSource' => 'missing', 'updateSource' => 'missing'],
                            'renderExpectations' => ['statusToken' => 'unknown', 'action' => 'none', 'forceUpdateEligible' => false]
                        ]
                    ]
                ],
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
    const sourceDir = path.join(tempDir, 'plugin-source');
    const apiErrorLogPath = path.join(tempDir, 'folderview.plus.api-error.log');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(
        path.join(sourceDir, 'build-metadata.json'),
        JSON.stringify({
            sourceCommitSha: '',
            headCommitSha: '17429e6caebc02894c461354fcea2ce973adbc72',
            sourceTreeSha: '91dbe96e1e1f0c149c81cc26ed5e3f05d182df1e',
            sourceContentSha256: '6c8a4eb42462b0b86d9c8647849f0c5f48edafa252858f19d91b0d8d59d75c22',
            sourceSnapshotMode: 'index',
            sourceCommitExact: false,
            sourceBranch: 'dev',
            manifestUrl: 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg',
            archiveUrl: 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/archive/folderview.plus-2026.04.04.10.txz',
            packageVersion: '2026.04.04.10',
            iconAssetPackVersion: '1.0.0',
            iconAssetPackSha256: '992f6c3544a8a3c1db80b861472fdd8b3d499f20f81796ed71405a10beb750bd',
            iconAssetPackUrl: 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/asset-packs/folderview.plus-icons-1.0.0.txz'
        }, null, 2),
        'utf8'
    );
    fs.writeFileSync(
        apiErrorLogPath,
        [
            '[2026-04-04T12:00:00+00:00] [trace:trace-123] RuntimeException in /boot/config/plugins/folderview.plus/docker.folder.json:44 | Failed for 192.168.6.25',
            '[2026-04-04T12:01:00+00:00] [trace:trace-456] RuntimeException in /usr/local/emhttp/plugins/folderview.plus/server/lib.php:910 | Request failed for https://tower-main.local/Docker'
        ].join('\n') + '\n',
        'utf8'
    );
    fs.writeFileSync(
        manifestPath,
        [
            '<!DOCTYPE PLUGIN [',
            '<!ENTITY name "folderview.plus">',
            '<!ENTITY version "2026.04.04.10">',
            '<!ENTITY github "alexphillips-dev/FolderView-Plus">',
            '<!ENTITY pluginURL "https://raw.githubusercontent.com/&github;/dev/folderview.plus.plg">',
            '<!ENTITY md5 "f9d807ddc1613bd63b665e7f9804c6a0">',
            '<!ENTITY iconPackVersion "1.0.0">',
            '<!ENTITY iconPackSha256 "992f6c3544a8a3c1db80b861472fdd8b3d499f20f81796ed71405a10beb750bd">',
            '<!ENTITY iconPackURL "https://raw.githubusercontent.com/&github;/dev/asset-packs/folderview.plus-icons-&iconPackVersion;.txz">',
            ']>',
            '<PLUGIN pluginURL="&pluginURL;"><FILE><URL>&iconPackURL;</URL></FILE><FILE><URL>https://raw.githubusercontent.com/&github;/dev/archive/&name;-&version;.txz</URL></FILE></PLUGIN>'
        ].join('\n'),
        'utf8'
    );
    fs.writeFileSync(harnessPath, buildFixturePhp(manifestPath, sourceDir, apiErrorLogPath), 'utf8');
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
        assert.ok(bundle.bundleMeta.buildIdentity && typeof bundle.bundleMeta.buildIdentity === 'object');
        assert.equal(bundle.bundleMeta.buildIdentity.pluginVersion, '2026.04.04.10');
        assert.equal(bundle.bundleMeta.buildIdentity.channel, 'dev');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceBranch, 'dev');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceCommitSha, null);
        assert.equal(bundle.bundleMeta.buildIdentity.headCommitSha, '17429e6caebc02894c461354fcea2ce973adbc72');
        assert.equal(bundle.bundleMeta.buildIdentity.headCommitRole, 'buildBaseCommit');
        assert.equal(bundle.bundleMeta.buildIdentity.buildBaseCommitSha, '17429e6caebc02894c461354fcea2ce973adbc72');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceTreeSha, '91dbe96e1e1f0c149c81cc26ed5e3f05d182df1e');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceContentSha256, '6c8a4eb42462b0b86d9c8647849f0c5f48edafa252858f19d91b0d8d59d75c22');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceContentFingerprint, 'sha256:6c8a4eb42462b0b86d9c8647849f0c5f48edafa252858f19d91b0d8d59d75c22');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceSnapshotMode, 'index');
        assert.equal(bundle.bundleMeta.buildIdentity.sourceCommitExact, false);
        assert.equal(bundle.bundleMeta.buildIdentity.provenanceStatus, 'sourceSnapshot');
        assert.equal(bundle.bundleMeta.buildIdentity.packageVersion, '2026.04.04.10');
        assert.equal(bundle.bundleMeta.buildIdentity.manifestPath, 'folderview.plus.plg');
        assert.match(bundle.bundleMeta.buildIdentity.manifestPathHash, /^[0-9a-f]{12}$/);
        assert.match(bundle.bundleMeta.buildIdentity.manifestSha256, /^[0-9a-f]{64}$/);
        assert.equal(bundle.bundleMeta.buildIdentity.manifestMd5, 'f9d807ddc1613bd63b665e7f9804c6a0');
        assert.equal(bundle.bundleMeta.buildIdentity.archiveMd5, 'f9d807ddc1613bd63b665e7f9804c6a0');
        assert.equal(bundle.bundleMeta.buildIdentity.manifestUrl, 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg');
        assert.equal(bundle.bundleMeta.buildIdentity.archiveUrl, 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/archive/folderview.plus-2026.04.04.10.txz');
        assert.equal(bundle.bundleMeta.buildIdentity.iconAssetPackVersion, '1.0.0');
        assert.equal(bundle.bundleMeta.buildIdentity.iconAssetPackSha256, '992f6c3544a8a3c1db80b861472fdd8b3d499f20f81796ed71405a10beb750bd');
        assert.equal(bundle.bundleMeta.buildIdentity.iconAssetPackUrl, 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/asset-packs/folderview.plus-icons-1.0.0.txz');
        assert.equal(bundle.redactionManifest.mode, mode);
        assert.equal(bundle.uiTelemetry && typeof bundle.uiTelemetry, 'object');
        assert.ok(bundle.system && typeof bundle.system === 'object');
        assert.ok(bundle.pluginState?.docker && bundle.pluginState?.vm);
        assert.ok(bundle.runtimeState?.docker && bundle.runtimeState?.vm);
        assert.ok(bundle.healthAndHistory?.summary && typeof bundle.healthAndHistory.summary === 'object');
        assert.ok(Array.isArray(bundle.healthAndHistory.recentActions));
        assert.ok(bundle.healthAndHistory.serverLogTail && typeof bundle.healthAndHistory.serverLogTail === 'object');
        assert.equal(bundle.healthAndHistory.serverLogTail.exists, true);
        assert.equal(bundle.healthAndHistory.serverLogTail.lineCount, 2);
        assert.equal(bundle.healthAndHistory.serverLogTail.maxLines, 40);
        assert.ok(bundle.pluginState.docker.prefs?.dashboard && typeof bundle.pluginState.docker.prefs.dashboard === 'object');
        assert.equal(bundle.runtimeState.docker.runtimeSnapshotAvailable, true);
        assert.equal(bundle.runtimeState.docker.snapshotSource, 'serverDiagnostics');
        assert.equal(bundle.runtimeState.docker.entitySummary.total, 3);
        assert.equal(bundle.runtimeState.docker.entitySummary.assigned, 2);
        assert.equal(bundle.runtimeState.docker.entitySummary.unassigned, 1);
        assert.equal(bundle.runtimeState.vm.runtimeSnapshotAvailable, true);
        assert.equal(bundle.runtimeState.vm.snapshotSource, 'serverDiagnostics');
        assert.equal(bundle.runtimeState.vm.entitySummary.total, 1);
        assert.equal(bundle.runtimeState.vm.entitySummary.unassigned, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.rootFolderCount, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.nestedFolderCount, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.maxDepth, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].parentId, '');
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].depth, 0);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].depth, 1);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].settings.previewUpdate, true);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].settings.hideUpdateColumn, false);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].renderExpectations.statusToken, 'updateReady');
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].renderExpectations.action, 'applyUpdate');
        assert.deepEqual(bundle.runtimeState.docker.folderHierarchySummary.folders[0].renderExpectations.managerTypes, ['composeman', 'dockerman']);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].settings.hideUpdateColumn, true);
        assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].renderExpectations.updateColumnVisible, false);
        assert.equal(bundle.runtimeState.docker.entityDetails.total, 3);
        assert.equal(bundle.runtimeState.docker.entityDetails.maxEntries, 200);
        assert.equal(bundle.runtimeState.docker.entityDetails.truncated, false);
        assert.equal(bundle.runtimeState.docker.entityDetails.managerCounts.dockerman, 1);
        assert.equal(bundle.runtimeState.docker.entityDetails.managerCounts.composeman, 1);
        assert.equal(bundle.runtimeState.docker.entityDetails.managerCounts.unclassified, 1);
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].state, 'started');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].assigned, true);
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].manager, 'dockerman');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].managed, true);
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].updated, false);
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].updateState, 'available');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].provenance.managerSource, 'infoState');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].provenance.updateSource, 'infoState');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].renderExpectations.statusToken, 'updateReady');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].renderExpectations.action, 'applyUpdate');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].renderExpectations.actionRequiresAdvancedView, false);
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].provenance.updateSource, 'topLevelFallback');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].renderExpectations.action, 'forceUpdate');
        assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].renderExpectations.actionRequiresAdvancedView, true);
        assert.equal(bundle.runtimeState.vm.entityDetails.total, 1);
        assert.deepEqual(bundle.runtimeState.vm.entityDetails.managerCounts, []);
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].state, 'stopped');
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].assigned, false);
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].manager, null);
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].updated, null);
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].updateState, 'unknown');
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].provenance.managerSource, 'missing');
        assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].renderExpectations.statusToken, 'unknown');
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
            assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].name, 'PlexMediaServer');
            assert.match(bundle.runtimeState.docker.entityDetails.entries[0].nameHash, /^[0-9a-f]{12}$/);
            assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].name, 'Orion VM Secret');
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
            assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].name, null);
            assert.match(bundle.runtimeState.docker.entityDetails.entries[0].nameHash, /^[0-9a-f]{16}$/);
            assert.equal(bundle.runtimeState.vm.entityDetails.entries[0].name, null);
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
    assert.deepEqual(bundle.system.requestSecurity, {
        schemaVersion: 1,
        enforcementMode: 'strict',
        trustedContext: true,
        authoritySource: 'forwarded',
        forwardedAuthorityStatus: 'valid',
        originStatus: 'forwarded',
        refererStatus: 'forwarded'
    });
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
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].settings.previewUpdate, true);
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].renderExpectations.action, 'applyUpdate');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].name, null);
    assert.match(bundle.runtimeState.docker.entityDetails.entries[0].nameHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].provenance.managerSource, 'infoState');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].provenance.updateSource, 'topLevelFallback');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].manager, null);
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].updateState, 'upToDate');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].renderExpectations.action, 'forceUpdate');
    assert.equal(bundle.healthAndHistory.integrityFindings.docker.duplicateFolderNames.examples[0].name, null);
    assert.match(bundle.healthAndHistory.integrityFindings.docker.duplicateFolderNames.examples[0].nameHash, /^[0-9a-f]{16}$/);
    assert.deepEqual(bundle.healthAndHistory.integrityFindings.docker.orphanedMembers.folders[0].items, []);
    assert.match(bundle.healthAndHistory.integrityFindings.docker.orphanedMembers.folders[0].itemHashes[0], /^[0-9a-f]{16}$/);
    assert.equal(
        bundle.healthAndHistory.recentTimeline[0].summary.includes('nameHash='),
        true
    );
    assert.equal(bundle.healthAndHistory.recentActions[0].target, null);
    assert.match(bundle.healthAndHistory.recentActions[0].targetHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.healthAndHistory.serverLogTail.path, 'folderview.plus.api-error.log');
    assert.match(bundle.healthAndHistory.serverLogTail.pathHash, /^[0-9a-f]{16}$/);
    assert.equal(bundle.healthAndHistory.serverLogTail.lines[0].includes('docker.folder.json'), true);
    assert.equal(bundle.healthAndHistory.serverLogTail.lines[0].includes('[path-hash:'), true);
    assert.equal(bundle.healthAndHistory.serverLogTail.lines[0].includes('192.168.x.x'), true);
    assert.equal(bundle.healthAndHistory.serverLogTail.lines[1].includes('[url-hash:'), true);
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
    assert.equal(bundle.redactionManifest.hashedFields.includes('runtimeState.docker.entityDetails.entries.*.nameHash'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('healthAndHistory.integrityFindings.docker.orphanedMembers.folders.*.folderId'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('healthAndHistory.recentActions.*.targetHash'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('healthAndHistory.serverLogTail.pathHash'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('healthAndHistory.serverLogTail.lines.*.urlHash'), true);
    assert.equal(bundle.redactionManifest.hashedFields.includes('healthAndHistory.serverLogTail.lines.*.pathHash'), true);
    assert.equal(bundle.redactionManifest.maskedFields.includes('system.request.clientIp'), true);
    assert.equal(bundle.redactionManifest.maskedFields.includes('healthAndHistory.serverLogTail.lines.*.ip'), true);
    assert.equal(bundle.redactionManifest.omittedFields.includes('system.pathHealth.customIcons.repairHint'), true);
    assert.equal(bundle.redactionManifest.omittedFields.includes('healthAndHistory.recentActions.*.target'), true);
    assert.equal(bundle.redactionManifest.omittedFields.includes('healthAndHistory.serverLogTail.lines.*.url'), true);
    assert.equal(bundle.redactionManifest.omittedFields.includes('healthAndHistory.serverLogTail.lines.*.path'), true);
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
    assert.equal(bundle.system.requestSecurity.forwardedAuthorityStatus, 'valid');
    assert.equal(bundle.system.requestSecurity.authoritySource, 'forwarded');
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
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].settings.previewUpdate, true);
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[1].settings.hideUpdateColumn, true);
    assert.equal(bundle.runtimeState.docker.folderHierarchySummary.folders[0].renderExpectations.action, 'applyUpdate');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].name, 'PlexMediaServer');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].manager, 'dockerman');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].updated, false);
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].provenance.managerSource, 'infoState');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[0].renderExpectations.action, 'applyUpdate');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].manager, null);
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].updateState, 'upToDate');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].provenance.updateSource, 'topLevelFallback');
    assert.equal(bundle.runtimeState.docker.entityDetails.entries[2].renderExpectations.action, 'forceUpdate');
    assert.equal(bundle.healthAndHistory.integrityFindings.docker.duplicateFolderNames.examples[0].name, 'Plex Root Secret');
    assert.deepEqual(bundle.healthAndHistory.integrityFindings.docker.orphanedMembers.folders[0].items, ['PlexMediaServer']);
    assert.equal(bundle.healthAndHistory.recentTimeline[0].summary, 'name=PlexMediaServer, folderId=root01, itemCount=2');
    assert.equal(bundle.healthAndHistory.recentActions[0].target, 'name:PlexMediaServer');
    assert.match(bundle.healthAndHistory.recentActions[0].targetHash, /^[0-9a-f]{12}$/);
    assert.equal(bundle.healthAndHistory.serverLogTail.path.endsWith('folderview.plus.api-error.log'), true);
    assert.match(bundle.healthAndHistory.serverLogTail.pathHash, /^[0-9a-f]{12}$/);
    assert.equal(
        bundle.healthAndHistory.serverLogTail.lines[0],
        '[2026-04-04T12:00:00+00:00] [trace:trace-123] RuntimeException in /boot/config/plugins/folderview.plus/docker.folder.json:44 | Failed for 192.168.6.25'
    );
    assert.equal(
        bundle.healthAndHistory.serverLogTail.lines[1],
        '[2026-04-04T12:01:00+00:00] [trace:trace-456] RuntimeException in /usr/local/emhttp/plugins/folderview.plus/server/lib.php:910 | Request failed for https://tower-main.local/Docker'
    );
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
    assert.equal(fixture.vmStateSnapshot.entityDetails.total, 1);
    assert.equal(fixture.vmStateSnapshot.entityDetails.truncated, false);
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].name, null);
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].state, 'stopped');
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].managed, false);
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].updateState, 'unknown');
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].provenance.managerSource, 'missing');
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].renderExpectations.statusToken, 'unknown');
    assert.equal(fixture.vmStateSnapshot.entityDetails.entries[0].renderExpectations.action, 'none');
});
