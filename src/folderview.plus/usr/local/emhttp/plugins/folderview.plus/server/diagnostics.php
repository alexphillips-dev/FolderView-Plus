<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

function fvplus_resolve_support_bundle_channel(): string {
    foreach (readInstalledManifestPathCandidates() as $manifestPath) {
        $contents = (string)@file_get_contents($manifestPath);
        if ($contents === '') {
            continue;
        }
        if (preg_match('/<PLUGINURL>[^<]*\\/FolderView-Plus\\/(dev|main)\\/folderview\\.plus\\.plg<\\/PLUGINURL>/i', $contents, $match)) {
            return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
        }
        if (preg_match('/<!ENTITY\\s+pluginURL\\s+"[^"]*\\/FolderView-Plus\\/(dev|main)\\/folderview\\.plus\\.plg"\\s*>/i', $contents, $match)) {
            return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
        }
    }
    return 'main';
}

function fvplus_build_support_bundle_v2(array $diagnostics, string $privacyMode): array {
    $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
    $environment = is_array($diagnostics['environment'] ?? null) ? $diagnostics['environment'] : [];
    $hashes = is_array($diagnostics['hashes'] ?? null) ? $diagnostics['hashes'] : [];
    $summary = is_array($diagnostics['summary'] ?? null) ? $diagnostics['summary'] : [];
    $recentTimeline = array_values(is_array($diagnostics['recentTimeline'] ?? null) ? $diagnostics['recentTimeline'] : []);
    $history = is_array($diagnostics['importExportHistory'] ?? null) ? $diagnostics['importExportHistory'] : [];
    $update = is_array($diagnostics['update'] ?? null) ? $diagnostics['update'] : [];
    $customIcons = is_array($diagnostics['customIcons'] ?? null) ? $diagnostics['customIcons'] : [];
    $detectedConflicts = fvplus_detect_runtime_plugin_conflicts();

    $pluginState = [];
    $runtimeState = [];
    $integrityFindings = [];

    foreach (['docker', 'vm'] as $type) {
        $typeData = is_array($types[$type] ?? null) ? $types[$type] : [];
        $integrityChecks = is_array($typeData['integrityChecks'] ?? null) ? $typeData['integrityChecks'] : [];
        $stateSnapshot = is_array($typeData['stateSnapshot'] ?? null) ? $typeData['stateSnapshot'] : [];
        $backupSchedule = is_array($typeData['backupSchedule'] ?? null) ? $typeData['backupSchedule'] : [];
        $lastBackup = is_array($typeData['lastBackup'] ?? null) ? $typeData['lastBackup'] : null;

        $pluginState[$type] = [
            'prefs' => [
                'sortMode' => (string)($typeData['sortMode'] ?? 'created'),
                'hideEmptyFolders' => (bool)($typeData['hideEmptyFolders'] ?? false),
                'appColumnWidth' => (string)($typeData['appColumnWidth'] ?? 'standard'),
                'setupWizardCompleted' => (bool)($typeData['setupWizardCompleted'] ?? false),
                'settingsMode' => (string)($typeData['settingsMode'] ?? 'basic'),
                'runtimePrefsSchema' => (int)($typeData['runtimePrefsSchema'] ?? 0),
                'liveRefreshEnabled' => (bool)($typeData['liveRefreshEnabled'] ?? false),
                'liveRefreshSeconds' => (int)($typeData['liveRefreshSeconds'] ?? 0),
                'performanceMode' => (bool)($typeData['performanceMode'] ?? false),
                'lazyPreviewEnabled' => (bool)($typeData['lazyPreviewEnabled'] ?? false),
                'lazyPreviewThreshold' => (int)($typeData['lazyPreviewThreshold'] ?? 0),
                'themeCompatibilityMode' => (string)($typeData['themeCompatibilityMode'] ?? 'auto'),
                'health' => is_array($typeData['health'] ?? null) ? $typeData['health'] : [],
                'status' => is_array($typeData['status'] ?? null) ? $typeData['status'] : [],
                'backupSchedule' => $backupSchedule
            ],
            'folders' => [
                'path' => (string)($typeData['folderPath'] ?? ''),
                'exists' => (bool)($typeData['foldersExists'] ?? false),
                'count' => (int)($typeData['folderCount'] ?? 0),
                'manualOrderCount' => (int)($typeData['manualOrderCount'] ?? 0),
                'pinnedFolderCount' => (int)($typeData['pinnedFolderCount'] ?? 0)
            ],
            'templates' => [
                'count' => (int)($typeData['templateCount'] ?? 0)
            ],
            'fileHashes' => [
                'folders' => is_array($hashes[$type . 'Folders'] ?? null) ? $hashes[$type . 'Folders'] : [],
                'prefs' => is_array($hashes[$type . 'Prefs'] ?? null) ? $hashes[$type . 'Prefs'] : []
            ],
            'counts' => [
                'folders' => (int)($typeData['folderCount'] ?? 0),
                'rules' => (int)($typeData['ruleCount'] ?? 0),
                'manualOrder' => (int)($typeData['manualOrderCount'] ?? 0),
                'pinnedFolders' => (int)($typeData['pinnedFolderCount'] ?? 0),
                'templates' => (int)($typeData['templateCount'] ?? 0),
                'backups' => (int)($typeData['backupCount'] ?? 0)
            ],
            'lastBackup' => $lastBackup
        ];

        $runtimeState[$type] = [
            'hostPageDetected' => true,
            'entitySummary' => [
                'total' => (int)($stateSnapshot['totalItems'] ?? 0),
                'assigned' => (int)($stateSnapshot['assignedItems'] ?? 0),
                'unassigned' => (int)($stateSnapshot['unassignedItems'] ?? 0),
                'states' => is_array($stateSnapshot['stateCounts'] ?? null) ? $stateSnapshot['stateCounts'] : []
            ],
            'folderHierarchySummary' => [
                'rootFolderCount' => (int)($stateSnapshot['rootFolderCount'] ?? 0),
                'nestedFolderCount' => (int)($stateSnapshot['nestedFolderCount'] ?? 0),
                'maxDepth' => (int)($stateSnapshot['maxDepth'] ?? 0),
                'folders' => array_values(is_array($stateSnapshot['folders'] ?? null) ? $stateSnapshot['folders'] : [])
            ],
            'updateStateSummary' => is_array($stateSnapshot['updateCounts'] ?? null) ? $stateSnapshot['updateCounts'] : [],
            'preflight' => [
                'foldersPath' => (string)($typeData['folderPath'] ?? ''),
                'prefsPath' => (string)($typeData['prefsPath'] ?? ''),
                'foldersExists' => (bool)($typeData['foldersExists'] ?? false),
                'prefsExists' => (bool)($typeData['prefsExists'] ?? false)
            ]
        ];

        $integrityFindings[$type] = $integrityChecks;
    }

    return [
        'bundleMeta' => [
            'bundleType' => 'FolderViewPlusSupportBundle',
            'bundleVersion' => 2,
            'schemaVersion' => (int)($diagnostics['schemaVersion'] ?? 0),
            'generatedAt' => gmdate('c'),
            'pluginVersion' => (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'channel' => fvplus_resolve_support_bundle_channel(),
            'privacyMode' => normalizeDiagnosticsPrivacyMode($privacyMode),
            'redactionPolicyVersion' => 1,
            'bundleSaltScope' => 'static-v1'
        ],
        'system' => [
            'unraidVersion' => $environment['unraidVersion'] ?? null,
            'phpVersion' => $environment['phpVersion'] ?? null,
            'kernel' => $environment['os'] ?? null,
            'timezone' => $environment['timezone'] ?? null,
            'serverSoftware' => $environment['serverSoftware'] ?? null,
            'request' => is_array($environment['request'] ?? null) ? $environment['request'] : [],
            'pathHealth' => [
                'docker' => is_array($integrityFindings['docker']['pathHealth'] ?? null) ? $integrityFindings['docker']['pathHealth'] : [],
                'vm' => is_array($integrityFindings['vm']['pathHealth'] ?? null) ? $integrityFindings['vm']['pathHealth'] : [],
                'customIcons' => $customIcons
            ],
            'phpExtensions' => array_values(get_loaded_extensions())
        ],
        'pluginState' => $pluginState,
        'runtimeState' => [
            'docker' => $runtimeState['docker'] ?? [],
            'vm' => $runtimeState['vm'] ?? [],
            'conflicts' => [
                'runtimeSafeMode' => count($detectedConflicts) > 0,
                'detected' => $detectedConflicts
            ]
        ],
        'uiTelemetry' => new stdClass(),
        'healthAndHistory' => [
            'summary' => $summary,
            'integrityFindings' => $integrityFindings,
            'recommendedActions' => array_values(is_array($summary['recommendedActions'] ?? null) ? $summary['recommendedActions'] : []),
            'recentTimeline' => $recentTimeline,
            'recentMutations' => [
                'retained' => (int)($history['retained'] ?? 0),
                'returned' => (int)($history['returned'] ?? 0),
                'events' => array_values(is_array($history['events'] ?? null) ? $history['events'] : [])
            ],
            'update' => $update
        ],
        'redactionManifest' => [
            'mode' => normalizeDiagnosticsPrivacyMode($privacyMode),
            'hashedFields' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? [] : [
                'system.request.userAgentHash',
                'system.request.clientIpHash',
                'pluginState.*.folders.items',
                'runtimeState.*.folderHierarchySummary.folders.*.folderNameHash'
            ],
            'maskedFields' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? [] : [
                'system.request.clientIp'
            ],
            'omittedFields' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? [] : [
                'system.request.userAgent',
                'pluginState.*.folders.path',
                'pluginState.*.fileHashes.*.path'
            ],
            'truncatedFields' => [
                'healthAndHistory.recentTimeline',
                'healthAndHistory.recentMutations.events',
                'runtimeState.*.folderHierarchySummary.folders'
            ]
        ]
    ];
}

fvplus_json_try(function (): array {
    $action = (string)($_REQUEST['action'] ?? 'report');
    $privacyMode = normalizeDiagnosticsPrivacyMode((string)($_REQUEST['privacy'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY));
    $mutatingActions = ['track_event', 'sync_docker_order', 'normalize_prefs', 'repair_paths', 'create_backup'];
    if (in_array($action, $mutatingActions, true)) {
        requireMutationRequestGuard();
    }

    if ($action === 'track_event') {
        $eventType = substr(trim((string)($_POST['eventType'] ?? '')), 0, 80);
        if ($eventType === '') {
            throw new RuntimeException('Event type is required.');
        }
        $type = null;
        if (isset($_POST['type']) && $_POST['type'] !== '') {
            $type = ensureType((string)$_POST['type']);
        }
        $status = substr((string)($_POST['status'] ?? 'ok'), 0, 32);
        $source = substr((string)($_POST['source'] ?? 'ui'), 0, 32);
        $detailsRaw = $_POST['details'] ?? null;
        if (is_string($detailsRaw) && strlen($detailsRaw) > 32768) {
            throw new RuntimeException('Details payload is too large.');
        }
        $details = [];
        if (is_string($detailsRaw) && $detailsRaw !== '') {
            $parsed = json_decode($detailsRaw, true);
            if (is_array($parsed)) {
                $details = $parsed;
            }
        } elseif (is_array($detailsRaw)) {
            $details = $detailsRaw;
        }
        $event = appendDiagnosticsHistoryEvent($eventType, $type, $details, $status, $source);
        return [
            'event' => $event
        ];
    }

    if ($action === 'report') {
        return [
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'support_bundle') {
        return [
            'bundle' => fvplus_build_support_bundle_v2(getDiagnosticsSnapshot($privacyMode), $privacyMode)
        ];
    }

    if ($action === 'sync_docker_order') {
        syncContainerOrder('docker');
        return [
            'message' => 'Docker order sync completed.',
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'normalize_prefs') {
        $types = ['docker', 'vm'];
        foreach ($types as $type) {
            $prefs = readTypePrefs($type);
            writeTypePrefs($type, $prefs);
        }
        return [
            'message' => 'Preferences normalized and rewritten.',
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'repair_paths') {
        $repair = repairPluginPaths();
        return [
            'message' => 'Plugin paths repaired.',
            'repair' => $repair,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    if ($action === 'create_backup') {
        $type = ensureType((string)($_POST['type'] ?? ''));
        $backup = createBackupSnapshot($type, 'manual-diagnostics');
        return [
            'backup' => $backup,
            'diagnostics' => getDiagnosticsSnapshot($privacyMode)
        ];
    }

    throw new RuntimeException('Unsupported action.');
});
