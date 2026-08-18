<?php
function normalizeEnvironmentSnapshotPayload($payload): array {
        if (!is_array($payload)) {
            throw new RuntimeException('Environment snapshot must be a JSON object.');
        }

        $typesIncoming = is_array($payload['types'] ?? null) ? $payload['types'] : null;
        if (!is_array($typesIncoming)) {
            throw new RuntimeException('Environment snapshot is missing required type data.');
        }

        $normalizedTypes = [];
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $entry = is_array($typesIncoming[$type] ?? null) ? $typesIncoming[$type] : [];
            $folders = normalizeFolderMapPayload(is_array($entry['folders'] ?? null) ? $entry['folders'] : []);
            $prefs = normalizeTypePrefs(is_array($entry['prefs'] ?? null) ? $entry['prefs'] : []);
            $normalizedTypes[$type] = [
                'folders' => $folders,
                'prefs' => $prefs
            ];
        }

        return [
            'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
            'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
            'pluginVersion' => trim((string)($payload['pluginVersion'] ?? '')),
            'exportedAt' => trim((string)($payload['exportedAt'] ?? '')),
            'types' => $normalizedTypes,
            'themeWorkspace' => normalizeThemeWorkspacePayload($payload['themeWorkspace'] ?? [])
        ];
    }

    function buildEnvironmentSnapshotSummary(array $snapshot, string $sourceName = ''): array {
        $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
        $dockerFolders = is_array($normalized['types']['docker']['folders'] ?? null) ? $normalized['types']['docker']['folders'] : [];
        $vmFolders = is_array($normalized['types']['vm']['folders'] ?? null) ? $normalized['types']['vm']['folders'] : [];
        $dockerPrefs = is_array($normalized['types']['docker']['prefs'] ?? null) ? $normalized['types']['docker']['prefs'] : [];
        $vmPrefs = is_array($normalized['types']['vm']['prefs'] ?? null) ? $normalized['types']['vm']['prefs'] : [];
        $themeWorkspace = is_array($normalized['themeWorkspace'] ?? null) ? $normalized['themeWorkspace'] : defaultThemeWorkspace();
        $activeThemeId = trim((string)($themeWorkspace['activeThemeId'] ?? ''));
        $activeThemeName = '';
        foreach ((array)($themeWorkspace['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === $activeThemeId) {
                $activeThemeName = trim((string)($theme['name'] ?? $activeThemeId));
                break;
            }
        }

        $warnings = [];
        $currentVersion = trim(readInstalledVersion());
        $snapshotVersion = trim((string)($normalized['pluginVersion'] ?? ''));
        if ($snapshotVersion !== '' && $currentVersion !== '' && $snapshotVersion !== $currentVersion) {
            $warnings[] = "Snapshot was exported by FolderView Plus $snapshotVersion and will be applied to $currentVersion.";
        }

        return [
            'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
            'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
            'pluginVersion' => $snapshotVersion,
            'currentPluginVersion' => $currentVersion,
            'exportedAt' => trim((string)($normalized['exportedAt'] ?? '')),
            'sourceName' => trim($sourceName),
            'docker' => [
                'folderCount' => count($dockerFolders),
                'sortMode' => trim((string)($dockerPrefs['sortMode'] ?? 'created'))
            ],
            'vm' => [
                'folderCount' => count($vmFolders),
                'sortMode' => trim((string)($vmPrefs['sortMode'] ?? 'created'))
            ],
            'themeWorkspace' => [
                'managedThemeCount' => count((array)($themeWorkspace['themes'] ?? [])),
                'activeThemeId' => $activeThemeId,
                'activeThemeName' => $activeThemeName,
                'customCssBytes' => strlen((string)($themeWorkspace['customCss'] ?? ''))
            ],
            'warnings' => array_values(array_unique(array_filter($warnings, static function($value): bool {
                return trim((string)$value) !== '';
            })))
        ];
    }

    function exportEnvironmentSnapshotPayload(): array {
        $snapshot = [
            'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
            'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
            'pluginVersion' => readInstalledVersion(),
            'exportedAt' => gmdate('c'),
            'types' => [
                'docker' => [
                    'folders' => readRawFolderMap('docker'),
                    'prefs' => readTypePrefs('docker'),
                    'configurationMetadata' => readConfigMetadata('docker', true)
                ],
                'vm' => [
                    'folders' => readRawFolderMap('vm'),
                    'prefs' => readTypePrefs('vm'),
                    'configurationMetadata' => readConfigMetadata('vm', true)
                ]
            ],
            'themeWorkspace' => readThemeWorkspace()
        ];
        return normalizeEnvironmentSnapshotPayload($snapshot);
    }

    function decodeEnvironmentSnapshotPayloadString(string $rawPayload): array {
        $trimmed = trim($rawPayload);
        if ($trimmed === '') {
            throw new RuntimeException('Environment snapshot payload is empty.');
        }
        $decoded = @json_decode($trimmed, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Environment snapshot is not valid JSON.');
        }
        return normalizeEnvironmentSnapshotPayload($decoded);
    }

    function previewEnvironmentSnapshotPayload(array $snapshot, string $sourceName = ''): array {
        $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
        return [
            'summary' => buildEnvironmentSnapshotSummary($normalized, $sourceName)
        ];
    }

    function importEnvironmentSnapshotPayload(array $snapshot, string $sourceName = ''): array {
        $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
        $result = applyEnvironmentSnapshotTransaction($normalized, $sourceName, ['reason' => 'environment-import']);
        $summary = (array)$result['summary'];

        try {
            appendDiagnosticsHistoryEvent('environment_import', null, [
                'sourceName' => trim($sourceName),
                'dockerCount' => (int)($summary['docker']['folderCount'] ?? 0),
                'vmCount' => (int)($summary['vm']['folderCount'] ?? 0),
                'managedThemeCount' => (int)($summary['themeWorkspace']['managedThemeCount'] ?? 0),
                'rollbackName' => (string)($result['rollback']['name'] ?? '')
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep import non-fatal if diagnostics logging fails.
        }

        return $result;
    }
