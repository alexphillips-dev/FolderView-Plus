<?php
    require_once(__DIR__ . '/../langs/registry.php');

    function diagnosticsCurrentTraceId(): string {
        return function_exists('getRequestTraceId') ? getRequestTraceId() : '';
    }

    function diagnosticsCurrentTransactionId(): string {
        return function_exists('getRequestTransactionId') ? getRequestTransactionId() : '';
    }

    function normalizeDiagnosticsPrivacyMode(string $mode): string {
        return strtolower(trim($mode)) === 'full' ? 'full' : FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY;
    }

    function diagnosticsHistoryPath(): string {
        global $configDir;
        return "$configDir/diagnostics.history.json";
    }

    function diagnosticsNormalizeEventDetails($value, int $depth = 0) {
        if ($depth > 4) {
            return null;
        }
        if (is_array($value)) {
            $normalized = [];
            $count = 0;
            foreach ($value as $key => $item) {
                if ($count >= 50) {
                    break;
                }
                $normalized[(string)$key] = diagnosticsNormalizeEventDetails($item, $depth + 1);
                $count++;
            }
            return $normalized;
        }
        if (is_string($value)) {
            return substr($value, 0, 256);
        }
        if (is_bool($value) || is_int($value) || is_float($value) || is_null($value)) {
            return $value;
        }
        return (string)$value;
    }

    function readDiagnosticsHistoryEvents(int $limit = 50): array {
        $path = diagnosticsHistoryPath();
        if (!file_exists($path)) {
            return [];
        }
        $decoded = readJsonObjectFile($path);
        if (!is_array($decoded)) {
            $decoded = recoverJsonObjectFromLastGood($path);
        }
        if (!is_array($decoded)) {
            return [];
        }
        $events = array_values(array_filter($decoded, function($row) {
            return is_array($row) && !empty($row['timestamp']) && !empty($row['action']);
        }));
        usort($events, function($a, $b) {
            return strcmp((string)($b['timestamp'] ?? ''), (string)($a['timestamp'] ?? ''));
        });
        return array_slice($events, 0, max(1, $limit));
    }

    function buildDiagnosticsTimeline(array $events, int $limit = 25): array {
        $rows = [];
        $max = max(1, $limit);
        $count = 0;
        foreach ($events as $event) {
            if (!is_array($event) || $count >= $max) {
                continue;
            }
            $details = is_array($event['details'] ?? null) ? $event['details'] : [];
            $summaryParts = [];
            foreach (['reason', 'name', 'folderId', 'folderCount', 'itemCount'] as $key) {
                if (array_key_exists($key, $details) && $details[$key] !== null && $details[$key] !== '') {
                    $summaryParts[] = $key . '=' . (is_scalar($details[$key]) ? (string)$details[$key] : json_encode($details[$key]));
                }
            }
            $rows[] = [
                'timestamp' => (string)($event['timestamp'] ?? ''),
                'action' => (string)($event['action'] ?? ''),
                'type' => $event['type'] ?? null,
                'status' => (string)($event['status'] ?? 'ok'),
                'summary' => implode(', ', $summaryParts)
            ];
            $count++;
        }
        return $rows;
    }

    function appendDiagnosticsHistoryEvent(string $action, ?string $type = null, array $details = [], string $status = 'ok', string $source = 'server'): array {
        $action = trim($action);
        if ($action === '') {
            throw new RuntimeException('Diagnostics event action is required.');
        }

        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }

        $path = diagnosticsHistoryPath();
        $decoded = readJsonObjectFile($path);
        if (!is_array($decoded)) {
            $decoded = recoverJsonObjectFromLastGood($path);
        }
        $events = is_array($decoded) ? $decoded : [];

        $event = [
            'id' => generateId(16),
            'timestamp' => gmdate('c'),
            'action' => $action,
            'type' => $type ? ensureType($type) : null,
            'status' => trim($status) === '' ? 'ok' : substr(trim($status), 0, 32),
            'source' => trim($source) === '' ? 'server' : substr(trim($source), 0, 64),
            'traceId' => diagnosticsCurrentTraceId(),
            'transactionId' => diagnosticsCurrentTransactionId(),
            'details' => diagnosticsNormalizeEventDetails($details)
        ];

        $events[] = $event;
        if (count($events) > FVPLUS_DIAGNOSTICS_HISTORY_MAX) {
            $events = array_slice($events, -FVPLUS_DIAGNOSTICS_HISTORY_MAX);
        }
        writeJsonObjectWithLastGood($path, array_values($events));
        return $event;
    }

    require_once(__DIR__ . '/lib.diagnostics-redaction.php');
    require_once(__DIR__ . '/lib.diagnostics-integrity.php');

    require_once(__DIR__ . '/lib.diagnostics-summary.php');

    function getDiagnosticsSnapshot(string $privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY): array {
        $privacyMode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $types = ['docker', 'vm'];
        $typesData = [];
        foreach ($types as $type) {
            $folderPath = getFolderFilePath($type);
            $prefsPath = getTypePrefsPath($type);
            $folders = readRawFolderMap($type);
            $prefs = readTypePrefs($type);
            $backups = listBackupSnapshots($type);
            $templates = readFolderTemplates($type);
            $infoByName = readInfo($type);
            $configMetadataIntegrity = diagnosticsBuildConfigMetadataIntegrity($type);
            $integrityChecks = diagnosticsBuildIntegrityChecks($type, $folders, $prefs, $infoByName, $privacyMode, $configMetadataIntegrity);
            $stateSnapshot = diagnosticsBuildStateSnapshot($type, $folders, $prefs, $infoByName, $privacyMode);
            $typesData[$type] = [
                'folderPath' => $privacyMode === 'full' ? $folderPath : basename($folderPath),
                'prefsPath' => $privacyMode === 'full' ? $prefsPath : basename($prefsPath),
                'foldersExists' => file_exists($folderPath),
                'prefsExists' => file_exists($prefsPath),
                'folderCount' => count($folders),
                'sortMode' => $prefs['sortMode'] ?? 'created',
                'ruleCount' => count($prefs['autoRules'] ?? []),
                'manualOrderCount' => count($prefs['manualOrder'] ?? []),
                'pinnedFolderCount' => count($prefs['pinnedFolderIds'] ?? []),
                'pinnedFolderIds' => normalizeStringIdList($prefs['pinnedFolderIds'] ?? []),
                'expandedFolderState' => normalizeExpandedStateMap($prefs['expandedFolderState'] ?? []),
                'hideEmptyFolders' => normalizeBool($prefs['hideEmptyFolders'] ?? false, false),
                'appColumnWidth' => normalizeAppColumnWidth($prefs['appColumnWidth'] ?? 'standard'),
                'setupWizardCompleted' => normalizeBool($prefs['setupWizardCompleted'] ?? false, false),
                'settingsMode' => (($prefs['settingsMode'] ?? 'basic') === 'advanced') ? 'advanced' : 'basic',
                'runtimePrefsSchema' => normalizeIntInRange($prefs['runtimePrefsSchema'] ?? FVPLUS_RUNTIME_PREFS_SCHEMA, 0, FVPLUS_RUNTIME_PREFS_SCHEMA, FVPLUS_RUNTIME_PREFS_SCHEMA),
                'liveRefreshEnabled' => normalizeBool($prefs['liveRefreshEnabled'] ?? false, false),
                'liveRefreshSeconds' => normalizeIntInRange($prefs['liveRefreshSeconds'] ?? 20, 10, 300, 20),
                'performanceProfile' => normalizePerformanceProfile($prefs['performanceProfile'] ?? '', normalizeBool($prefs['performanceMode'] ?? false, false)),
                'performanceMode' => normalizeBool($prefs['performanceMode'] ?? false, false),
                'lazyPreviewEnabled' => normalizeBool($prefs['lazyPreviewEnabled'] ?? false, false),
                'lazyPreviewThreshold' => normalizeIntInRange($prefs['lazyPreviewThreshold'] ?? 30, 10, 200, 30),
                'pageViewMode' => normalizeRuntimePageViewMode($prefs['pageViewMode'] ?? 'folderview'),
                'themeCompatibilityMode' => normalizeThemeCompatibilityMode($prefs['themeCompatibilityMode'] ?? 'auto'),
                'dashboard' => [
                    'layout' => normalizeDashboardLayout($prefs['dashboard']['layout'] ?? 'classic'),
                    'expandToggle' => !array_key_exists('expandToggle', is_array($prefs['dashboard'] ?? null) ? $prefs['dashboard'] : [])
                        ? true
                        : normalizeBool($prefs['dashboard']['expandToggle'] ?? true, true),
                    'greyscale' => normalizeBool($prefs['dashboard']['greyscale'] ?? false, false),
                    'folderLabel' => !array_key_exists('folderLabel', is_array($prefs['dashboard'] ?? null) ? $prefs['dashboard'] : [])
                        ? true
                        : normalizeBool($prefs['dashboard']['folderLabel'] ?? true, true)
                ],
                'health' => [
                    'cardsEnabled' => normalizeBool($prefs['health']['cardsEnabled'] ?? true, true),
                    'runtimeBadgeEnabled' => normalizeBool($prefs['health']['runtimeBadgeEnabled'] ?? false, false),
                    'warnStoppedPercent' => normalizeIntInRange($prefs['health']['warnStoppedPercent'] ?? 60, 0, 100, 60),
                    'criticalStoppedPercent' => normalizeIntInRange($prefs['health']['criticalStoppedPercent'] ?? 90, 0, 100, 90),
                    'profile' => in_array(strtolower(trim((string)($prefs['health']['profile'] ?? 'balanced'))), ['strict', 'balanced', 'lenient'], true)
                        ? strtolower(trim((string)($prefs['health']['profile'] ?? 'balanced')))
                        : 'balanced',
                    'updatesMode' => in_array(strtolower(trim((string)($prefs['health']['updatesMode'] ?? 'maintenance'))), ['maintenance', 'warn', 'ignore'], true)
                        ? strtolower(trim((string)($prefs['health']['updatesMode'] ?? 'maintenance')))
                        : 'maintenance',
                    'allStoppedMode' => in_array(strtolower(trim((string)($prefs['health']['allStoppedMode'] ?? 'critical'))), ['critical', 'warn'], true)
                        ? strtolower(trim((string)($prefs['health']['allStoppedMode'] ?? 'critical')))
                        : 'critical',
                    'vmResourceWarnVcpus' => normalizeIntInRange($prefs['health']['vmResourceWarnVcpus'] ?? 16, 1, 512, 16),
                    'vmResourceCriticalVcpus' => normalizeIntInRange($prefs['health']['vmResourceCriticalVcpus'] ?? 32, 1, 512, 32),
                    'vmResourceWarnGiB' => normalizeIntInRange($prefs['health']['vmResourceWarnGiB'] ?? 32, 1, 1024, 32),
                    'vmResourceCriticalGiB' => normalizeIntInRange($prefs['health']['vmResourceCriticalGiB'] ?? 64, 1, 1024, 64)
                ],
                'status' => [
                    'mode' => in_array(strtolower(trim((string)($prefs['status']['mode'] ?? 'summary'))), ['summary', 'dominant'], true)
                        ? strtolower(trim((string)($prefs['status']['mode'] ?? 'summary')))
                        : 'summary',
                    'displayMode' => in_array(strtolower(trim((string)($prefs['status']['displayMode'] ?? 'balanced'))), ['simple', 'balanced', 'detailed'], true)
                        ? strtolower(trim((string)($prefs['status']['displayMode'] ?? 'balanced')))
                        : 'balanced',
                    'trendEnabled' => normalizeBool($prefs['status']['trendEnabled'] ?? true, true),
                    'attentionAccent' => normalizeBool($prefs['status']['attentionAccent'] ?? true, true),
                    'warnStoppedPercent' => normalizeIntInRange($prefs['status']['warnStoppedPercent'] ?? 60, 0, 100, 60)
                ],
                'backupSchedule' => getTypeBackupSchedule($type),
                'lastBackup' => $backups[0] ?? null,
                'backupCount' => count($backups),
                'templateCount' => count($templates),
                'configurationMetadata' => $configMetadataIntegrity['metadata'] ?? null,
                'integrityChecks' => $integrityChecks,
                'stateSnapshot' => $stateSnapshot
            ];
        }

        $historyEvents = readDiagnosticsHistoryEvents(80);
        $customIcons = diagnosticsBuildCustomIconStorage($privacyMode);
        $update = checkRemotePluginUpdate();
        $runtimeIntegrity = fvplus_get_runtime_integrity_snapshot($privacyMode);
        $securityAudit = fvplus_get_security_audit_snapshot();
        return [
            'schemaVersion' => FVPLUS_DIAGNOSTICS_SCHEMA_VERSION,
            'privacyMode' => $privacyMode,
            'checkedAt' => gmdate('c'),
            'pluginVersion' => readInstalledVersion(),
            'environment' => getEnvironmentSnapshot($privacyMode),
            'durableStorage' => getDurableStorageRuntimeSnapshot(),
            'runtimeIntegrity' => $runtimeIntegrity,
            'securityAudit' => $securityAudit,
            'requestSecurity' => getMutationRequestSecurityDiagnostics(),
            'hashes' => getDiagnosticsKeyFileHashes($privacyMode),
            'customIcons' => $customIcons,
            'importExportHistory' => [
                'retained' => count(readDiagnosticsHistoryEvents(FVPLUS_DIAGNOSTICS_HISTORY_MAX)),
                'returned' => count($historyEvents),
                'events' => $historyEvents
            ],
            'recentTimeline' => buildDiagnosticsTimeline($historyEvents, 25),
            'update' => $update,
            'summary' => diagnosticsBuildOverviewSummary($typesData, $customIcons, $update, $runtimeIntegrity, $securityAudit),
            'types' => $typesData
        ];
    }

    require_once(__DIR__ . '/lib.diagnostics-support-bundle.php');
