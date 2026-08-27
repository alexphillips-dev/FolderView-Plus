<?php
function readUnraidVersionString(): ?string {
        $candidates = [
            '/etc/unraid-version',
            '/etc/unraid-version.txt',
            '/etc/version'
        ];
        foreach ($candidates as $path) {
            if (!file_exists($path)) {
                continue;
            }
            $raw = trim((string)@file_get_contents($path));
            if ($raw === '') {
                continue;
            }
            $lines = preg_split('/\R+/', $raw) ?: [];
            foreach ($lines as $line) {
                $line = trim((string)$line);
                if ($line === '') {
                    continue;
                }
                if (preg_match('/([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[-._a-zA-Z0-9]+)?)/', $line, $match)) {
                    return (string)$match[1];
                }
                return $line;
            }
        }
        return null;
    }

    function getEnvironmentSnapshot(string $privacyMode): array {
        $mode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $userAgent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
        $clientIp = (string)($_SERVER['REMOTE_ADDR'] ?? '');
        return [
            'capturedAt' => gmdate('c'),
            'timezone' => @date_default_timezone_get(),
            'phpVersion' => PHP_VERSION,
            'serverSoftware' => (string)($_SERVER['SERVER_SOFTWARE'] ?? ''),
            'os' => php_uname('s') . ' ' . php_uname('r'),
            'unraidVersion' => readUnraidVersionString(),
            'request' => [
                'privacyMode' => $mode,
                'userAgent' => $mode === 'full' ? $userAgent : null,
                'userAgentHash' => $userAgent !== '' ? diagnosticsHashShort($userAgent) : null,
                'clientIp' => $mode === 'full' ? $clientIp : diagnosticsMaskIp($clientIp),
                'clientIpHash' => $clientIp !== '' ? diagnosticsHashShort($clientIp) : null
            ]
        ];
    }

    function diagnosticsFileHashSnapshot(string $path, string $privacyMode): array {
        $exists = file_exists($path);
        $mode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $label = basename($path);
        return [
            'file' => $label,
            'path' => $mode === 'full' ? $path : $label,
            'exists' => $exists,
            'size' => $exists ? (int)@filesize($path) : 0,
            'modifiedAt' => $exists ? gmdate('c', (int)@filemtime($path)) : null,
            'sha256' => $exists ? @hash_file('sha256', $path) : null
        ];
    }

    function getDiagnosticsKeyFileHashes(string $privacyMode): array {
        return [
            'dockerFolders' => diagnosticsFileHashSnapshot(getFolderFilePath('docker'), $privacyMode),
            'vmFolders' => diagnosticsFileHashSnapshot(getFolderFilePath('vm'), $privacyMode),
            'dockerPrefs' => diagnosticsFileHashSnapshot(getTypePrefsPath('docker'), $privacyMode),
            'vmPrefs' => diagnosticsFileHashSnapshot(getTypePrefsPath('vm'), $privacyMode)
        ];
    }

    function diagnosticsNormalizeStatusColor($value, string $fallback): string {
        $value = is_string($value) ? trim($value) : '';
        if (!preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $value)) {
            return $fallback;
        }
        if (strlen($value) === 4) {
            return '#' . strtolower($value[1] . $value[1] . $value[2] . $value[2] . $value[3] . $value[3]);
        }
        return strtolower($value);
    }

    function diagnosticsFolderStatusColors(array $folder): array {
        $settings = is_array($folder['settings'] ?? null) ? $folder['settings'] : [];
        return [
            'started' => diagnosticsNormalizeStatusColor($settings['status_color_started'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['started']),
            'paused' => diagnosticsNormalizeStatusColor($settings['status_color_paused'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['paused']),
            'stopped' => diagnosticsNormalizeStatusColor($settings['status_color_stopped'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['stopped']), 'text' => diagnosticsNormalizeStatusColor($settings['status_color_text'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['text'])
        ];
    }

    function diagnosticsBuildRegex(string $pattern): string {
        return '/' . str_replace('/', '\/', $pattern) . '/';
    }

    function diagnosticsRegexIsValid(string $pattern): bool {
        if (trim($pattern) === '') {
            return true;
        }
        return @preg_match(diagnosticsBuildRegex($pattern), '') !== false;
    }

    function diagnosticsRegexMatches(string $pattern, string $subject): bool {
        if (trim($pattern) === '') {
            return false;
        }
        if (!diagnosticsRegexIsValid($pattern)) {
            return false;
        }
        return @preg_match(diagnosticsBuildRegex($pattern), $subject) === 1;
    }

    function diagnosticsFirstMatchingRule(array $rules, string $name, array $infoByName, string $type): ?array {
        $decision = autoRuleDecision($rules, $name, $infoByName, $type);
        return is_array($decision['assignedRule'] ?? null) ? $decision['assignedRule'] : null;
    }

    function diagnosticsFormatNames(array $names, string $privacyMode): array {
        $names = array_values(array_unique(array_map('strval', $names)));
        if (normalizeDiagnosticsPrivacyMode($privacyMode) === 'full') {
            return array_slice($names, 0, 30);
        }
        return array_slice(array_map('diagnosticsHashShort', $names), 0, 30);
    }

    function diagnosticsPathDescriptor(string $path, string $privacyMode): array {
        $exists = file_exists($path);
        return [
            'path' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? $path : basename($path),
            'exists' => $exists,
            'isDir' => $exists ? is_dir($path) : false,
            'isFile' => $exists ? is_file($path) : false,
            'readable' => $exists ? is_readable($path) : false,
            'writable' => $exists ? is_writable($path) : false
        ];
    }

    function diagnosticsCustomIconExtensions(): array {
        return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
    }

    function diagnosticsCustomIconNameFromIconValue(string $value): string {
        $path = trim($value);
        if ($path === '') {
            return '';
        }
        $hashPos = strpos($path, '#');
        if ($hashPos !== false) {
            $path = substr($path, 0, $hashPos);
        }
        $queryPos = strpos($path, '?');
        if ($queryPos !== false) {
            $path = substr($path, 0, $queryPos);
        }
        $decoded = @rawurldecode($path);
        if (is_string($decoded) && $decoded !== '') {
            $path = $decoded;
        }
        $path = preg_replace('#^https?://[^/]+#i', '', $path);
        $path = str_replace('\\', '/', trim((string)$path));
        if ($path === '') {
            return '';
        }

        $prefixes = [
            '/plugins/folderview.plus/images/custom/',
            '/usr/local/emhttp/plugins/folderview.plus/images/custom/',
            'plugins/folderview.plus/images/custom/',
            'usr/local/emhttp/plugins/folderview.plus/images/custom/'
        ];
        $candidate = '';
        foreach ($prefixes as $prefix) {
            if (strpos($path, $prefix) === 0) {
                $candidate = basename(substr($path, strlen($prefix)));
                break;
            }
        }
        if ($candidate === '') {
            return '';
        }
        $safe = basename(trim($candidate));
        if ($safe === '' || $safe !== $candidate) {
            return '';
        }
        $extension = strtolower((string)pathinfo($safe, PATHINFO_EXTENSION));
        if ($extension === '' || !in_array($extension, diagnosticsCustomIconExtensions(), true)) {
            return '';
        }
        return $safe;
    }

    function diagnosticsBuildCustomIconUsageMap(): array {
        $usage = [];
        foreach (['docker', 'vm'] as $type) {
            $folders = readRawFolderMap($type);
            foreach ($folders as $folderId => $folder) {
                if (!is_array($folder)) {
                    continue;
                }
                $name = diagnosticsCustomIconNameFromIconValue((string)($folder['icon'] ?? ''));
                if ($name === '') {
                    continue;
                }
                if (!isset($usage[$name]) || !is_array($usage[$name])) {
                    $usage[$name] = [];
                }
                $usage[$name][] = [
                    'type' => $type,
                    'folderId' => (string)$folderId,
                    'folderName' => trim((string)($folder['name'] ?? (string)$folderId))
                ];
            }
        }
        return $usage;
    }

    function diagnosticsBuildCustomIconStorage(string $privacyMode): array {
        $privacyMode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $directory = function_exists('fvplusCustomIconDirPath')
            ? fvplusCustomIconDirPath()
            : '/boot/config/plugins/folderview.plus/images/custom';
        $descriptor = diagnosticsPathDescriptor($directory, $privacyMode);
        $extensions = diagnosticsCustomIconExtensions();
        $usageMap = diagnosticsBuildCustomIconUsageMap();
        $existingIcons = [];
        $fileCount = 0;
        $totalBytes = 0;
        $inUseIconCount = 0;
        $orphanedIconCount = 0;
        $referenceCount = 0;
        $topReferences = [];
        $missingReferenceCount = 0;
        $missingReferencedIconCount = 0;
        $missingReferencedIcons = [];
        $metadataPath = "$directory/.metadata.json";
        $metadataPayload = readJsonObjectFile($metadataPath);
        if (!is_array($metadataPayload) && is_file($metadataPath)) {
            $metadataPayload = recoverJsonObjectFromLastGood($metadataPath);
        }
        $metadataItems = is_array($metadataPayload['items'] ?? null)
            ? $metadataPayload['items']
            : [];
        $metadataMissingFileCount = 0;
        $metadataOrphanEntryCount = 0;

        if (is_dir($directory)) {
            foreach ((array)@scandir($directory) as $name) {
                if ($name === '.' || $name === '..' || $name !== basename($name)) {
                    continue;
                }
                $path = "$directory/$name";
                if (!is_file($path)) {
                    continue;
                }
                $extension = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
                if ($extension === '' || !in_array($extension, $extensions, true)) {
                    continue;
                }
                $existingIcons[$name] = true;
                $fileCount++;
                $totalBytes += max(0, (int)@filesize($path));
                $refs = is_array($usageMap[$name] ?? null) ? $usageMap[$name] : [];
                $refCount = count($refs);
                if ($refCount > 0) {
                    $inUseIconCount++;
                    $referenceCount += $refCount;
                    $topReferences[] = [
                        'name' => $privacyMode === 'full' ? $name : diagnosticsHashShort($name),
                        'referenceCount' => $refCount
                    ];
                } else {
                    $orphanedIconCount++;
                }
            }
        }

        foreach ($usageMap as $name => $refs) {
            if (isset($existingIcons[$name])) {
                continue;
            }
            $refList = is_array($refs) ? array_values($refs) : [];
            $refCount = count($refList);
            if ($refCount <= 0) {
                continue;
            }
            $missingReferencedIconCount++;
            $missingReferenceCount += $refCount;
            $missingReferencedIcons[] = [
                'name' => $privacyMode === 'full' ? $name : diagnosticsHashShort($name),
                'referenceCount' => $refCount,
                'references' => array_slice(array_map(static function (array $entry) use ($privacyMode): array {
                    return [
                        'type' => (string)($entry['type'] ?? ''),
                        'folderId' => (string)($entry['folderId'] ?? ''),
                        'folderName' => $privacyMode === 'full'
                            ? trim((string)($entry['folderName'] ?? ($entry['folderId'] ?? '')))
                            : diagnosticsHashShort(trim((string)($entry['folderName'] ?? ($entry['folderId'] ?? ''))))
                    ];
                }, $refList), 0, 20)
            ];
        }

        foreach (array_keys($existingIcons) as $name) {
            if (!is_array($metadataItems[$name] ?? null)) {
                $metadataMissingFileCount++;
            }
        }
        foreach ($metadataItems as $name => $entry) {
            if (!is_string($name) || !is_array($entry) || isset($existingIcons[$name])) {
                continue;
            }
            $metadataOrphanEntryCount++;
        }

        usort($topReferences, static function (array $a, array $b): int {
            $cmp = ((int)($b['referenceCount'] ?? 0)) <=> ((int)($a['referenceCount'] ?? 0));
            if ($cmp !== 0) {
                return $cmp;
            }
            return strcmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
        });

        $issues = [];
        if ($descriptor['exists'] !== true) {
            $issues[] = 'Custom icon directory is missing.';
        } elseif ($descriptor['isDir'] !== true) {
            $issues[] = 'Custom icon path is not a directory.';
        }
        if ($descriptor['exists'] === true && $descriptor['writable'] !== true) {
            $issues[] = 'Custom icon directory is not writable.';
        }
        if ($missingReferenceCount > 0) {
            $issues[] = sprintf(
                '%d folder reference(s) point to missing custom icon file(s).',
                $missingReferenceCount
            );
        }
        if (is_file($metadataPath) && !is_array($metadataPayload)) {
            $issues[] = 'Custom icon metadata index is unreadable.';
        }
        if (is_array($metadataPayload)
            && (int)($metadataPayload['schemaVersion'] ?? 0) !== FVPLUS_CUSTOM_ICON_METADATA_SCHEMA_VERSION) {
            $issues[] = 'Custom icon metadata schema is invalid.';
        }
        if ($metadataMissingFileCount > 0) {
            $issues[] = sprintf('%d custom icon file(s) are missing metadata entries.', $metadataMissingFileCount);
        }
        if ($metadataOrphanEntryCount > 0) {
            $issues[] = sprintf('%d custom icon metadata entry or entries reference missing files.', $metadataOrphanEntryCount);
        }

        $repairHint = 'mkdir -p ' . escapeshellarg($directory) . ' && chmod -R 775 ' . escapeshellarg($directory);
        return [
            'path' => $descriptor,
            'fileCount' => $fileCount,
            'totalBytes' => $totalBytes,
            'inUseIconCount' => $inUseIconCount,
            'orphanedIconCount' => $orphanedIconCount,
            'referenceCount' => $referenceCount,
            'missingReferenceCount' => $missingReferenceCount,
            'missingReferencedIconCount' => $missingReferencedIconCount,
            'missingReferencedIcons' => array_slice($missingReferencedIcons, 0, 20),
            'metadata' => [
                'schemaVersion' => (int)($metadataPayload['schemaVersion'] ?? 0),
                'updatedAt' => (string)($metadataPayload['updatedAt'] ?? ''),
                'trackedCount' => count($metadataItems),
                'missingEntryCount' => $metadataMissingFileCount,
                'orphanEntryCount' => $metadataOrphanEntryCount,
                'atomicRecoveryAvailable' => is_file(getLastGoodJsonPath($metadataPath))
            ],
            'topReferences' => array_slice($topReferences, 0, 15),
            'issues' => $issues,
            'repairHint' => $repairHint
        ];
    }

    function diagnosticsBuildPathHealth(string $type, string $privacyMode): array {
        global $configDir, $sourceDir;
        $folderPath = getFolderFilePath($type);
        $prefsPath = getTypePrefsPath($type);
        $metadataPath = getConfigMetadataPath($type);
        $backupDir = getBackupsDirPath();
        $issues = [];

        $configDesc = diagnosticsPathDescriptor($configDir, $privacyMode);
        $sourceDesc = diagnosticsPathDescriptor($sourceDir, $privacyMode);
        $folderDesc = diagnosticsPathDescriptor($folderPath, $privacyMode);
        $prefsDesc = diagnosticsPathDescriptor($prefsPath, $privacyMode);
        $metadataDesc = diagnosticsPathDescriptor($metadataPath, $privacyMode);
        $backupDesc = diagnosticsPathDescriptor($backupDir, $privacyMode);

        if ($configDesc['exists'] !== true || $configDesc['isDir'] !== true) {
            $issues[] = 'Config directory is missing.';
        } elseif ($configDesc['writable'] !== true) {
            $issues[] = 'Config directory is not writable.';
        }
        if ($sourceDesc['exists'] !== true || $sourceDesc['isDir'] !== true) {
            $issues[] = 'Plugin source directory is missing.';
        }
        if ($folderDesc['exists'] === true && $folderDesc['isFile'] !== true) {
            $issues[] = 'Folder map path is not a file.';
        }
        if ($folderDesc['exists'] === true && $folderDesc['writable'] !== true) {
            $issues[] = 'Folder map file is not writable.';
        }
        if ($prefsDesc['exists'] === true && $prefsDesc['isFile'] !== true) {
            $issues[] = 'Preferences path is not a file.';
        }
        if ($prefsDesc['exists'] === true && $prefsDesc['writable'] !== true) {
            $issues[] = 'Preferences file is not writable.';
        }
        if ($metadataDesc['exists'] === true && $metadataDesc['isFile'] !== true) {
            $issues[] = 'Configuration metadata path is not a file.';
        }
        if ($metadataDesc['exists'] === true && $metadataDesc['writable'] !== true) {
            $issues[] = 'Configuration metadata file is not writable.';
        }
        if ($backupDesc['exists'] === true && $backupDesc['isDir'] !== true) {
            $issues[] = 'Backups path is not a directory.';
        }
        if ($backupDesc['exists'] === true && $backupDesc['writable'] !== true) {
            $issues[] = 'Backups directory is not writable.';
        }

        $legacyRemnants = [];
        foreach (FVPLUS_LEGACY_CONFIG_DIRS as $legacyDir) {
            if (!is_dir($legacyDir)) {
                continue;
            }
            $legacyRemnants[] = [
                'path' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? $legacyDir : basename($legacyDir),
                'dockerExists' => file_exists("$legacyDir/docker.json"),
                'vmExists' => file_exists("$legacyDir/vm.json"),
                'prefsDockerExists' => file_exists("$legacyDir/docker.prefs.json"),
                'prefsVmExists' => file_exists("$legacyDir/vm.prefs.json")
            ];
        }

        return [
            'ok' => count($issues) === 0,
            'issues' => $issues,
            'paths' => [
                'configDir' => $configDesc,
                'sourceDir' => $sourceDesc,
                'folderFile' => $folderDesc,
                'prefsFile' => $prefsDesc,
                'metadataFile' => $metadataDesc,
                'backupDir' => $backupDesc
            ],
            'legacyRemnants' => $legacyRemnants
        ];
    }

    function diagnosticsBuildConfigMetadataIntegrity(string $type): array {
        $safeType = ensureType($type);
        $issues = [];
        try {
            $metadata = readConfigMetadata($safeType, true);
        } catch (Throwable $error) {
            return [
                'ok' => false,
                'issuesCount' => 1,
                'issues' => ['Configuration metadata could not be read or repaired.'],
                'metadata' => null
            ];
        }

        if ((int)($metadata['schemaVersion'] ?? 0) !== FVPLUS_CONFIG_METADATA_SCHEMA_VERSION) {
            $issues[] = 'Configuration metadata schema is invalid.';
        }
        if ((string)($metadata['type'] ?? '') !== $safeType) {
            $issues[] = 'Configuration metadata type does not match its folder type.';
        }
        foreach (['folderRevision', 'prefsRevision'] as $revisionKey) {
            if ((int)($metadata[$revisionKey] ?? -1) < 0) {
                $issues[] = "$revisionKey is invalid.";
            }
        }
        $folderHash = configMetadataHashFromPath(getFolderFilePath($safeType));
        $prefsHash = configMetadataHashFromPath(getTypePrefsPath($safeType));
        if (!hash_equals((string)($metadata['folderSha256'] ?? ''), $folderHash)) {
            $issues[] = 'Folder metadata fingerprint does not match the folder map.';
        }
        if (!hash_equals((string)($metadata['prefsSha256'] ?? ''), $prefsHash)) {
            $issues[] = 'Preferences metadata fingerprint does not match the preferences file.';
        }

        return [
            'ok' => count($issues) === 0,
            'issuesCount' => count($issues),
            'issues' => $issues,
            'metadata' => $metadata
        ];
    }

    function diagnosticsBuildIntegrityChecks(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode, array $configMetadataIntegrity = []): array {
        $validNames = array_keys($infoByName);
        $validSet = array_fill_keys($validNames, true);
        $nameBuckets = [];
        $invalidRegexFolders = [];
        $invalidIconFolders = [];
        $orphanedMembers = [];
        $explicitAssignments = [];
        $regexAssignments = [];
        $effectiveAssignments = [];

        foreach ($folders as $folderId => $folder) {
            $folderName = trim((string)($folder['name'] ?? $folderId));
            $bucketKey = strtolower($folderName);
            if (!isset($nameBuckets[$bucketKey])) {
                $nameBuckets[$bucketKey] = ['name' => $folderName, 'folderIds' => []];
            }
            $nameBuckets[$bucketKey]['folderIds'][] = (string)$folderId;

            $members = normalizeFolderMembers($folder['containers'] ?? []);
            foreach ($members as $member) {
                $explicitAssignments[$member][] = (string)$folderId;
                $effectiveAssignments[$member][] = (string)$folderId;
                if (!isset($validSet[$member])) {
                    if (!isset($orphanedMembers[$folderId])) {
                        $orphanedMembers[$folderId] = [];
                    }
                    $orphanedMembers[$folderId][] = $member;
                }
            }

            $regex = (string)($folder['regex'] ?? '');
            if ($regex !== '') {
                if (!diagnosticsRegexIsValid($regex)) {
                    $invalidRegexFolders[] = (string)$folderId;
                } else {
                    foreach ($validNames as $name) {
                        if (diagnosticsRegexMatches($regex, $name)) {
                            $regexAssignments[$name][] = (string)$folderId;
                            if (!in_array((string)$folderId, $effectiveAssignments[$name] ?? [], true)) {
                                $effectiveAssignments[$name][] = (string)$folderId;
                            }
                        }
                    }
                }
            }

            $icon = trim((string)($folder['icon'] ?? ''));
            if ($icon !== '') {
                $isLocalPath = strpos($icon, '/') === 0;
                $isHttpUrl = stripos($icon, 'http://') === 0 || stripos($icon, 'https://') === 0;
                $isDataUri = stripos($icon, 'data:image/') === 0;
                if (!$isLocalPath && !$isHttpUrl && !$isDataUri) {
                    $invalidIconFolders[] = (string)$folderId;
                }
            }

            if ($type === 'docker') {
                $folderName = trim((string)($folder['name'] ?? ''));
                if ($folderName !== '') {
                    foreach ($validNames as $name) {
                        $labelValue = getFolderLabelValueFromLabels(dockerInfoLabelsForName($infoByName, $name));
                        if ($labelValue === '' || $labelValue !== $folderName) {
                            continue;
                        }
                        if (!in_array((string)$folderId, $effectiveAssignments[$name] ?? [], true)) {
                            $effectiveAssignments[$name][] = (string)$folderId;
                        }
                    }
                }
            }
        }

        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $invalidRules = [];
        foreach ($rules as $idx => $rule) {
            if (!is_array($rule)) {
                $invalidRules[] = ['index' => $idx, 'reason' => 'Rule entry is not an object.'];
                continue;
            }
            $folderId = (string)($rule['folderId'] ?? '');
            $kind = (string)($rule['kind'] ?? 'name_regex');
            $effect = (string)($rule['effect'] ?? 'include');
            if ($folderId === '' || !array_key_exists($folderId, $folders)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule folder target is missing or invalid.'];
            }
            if (!in_array($effect, FVPLUS_RULE_EFFECTS, true)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule effect is invalid.'];
            }
            if (!in_array($kind, FVPLUS_RULE_KINDS, true)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule kind is invalid.'];
                continue;
            }
            if (in_array($kind, ['name_regex', 'image_regex', 'compose_project_regex'], true)) {
                $pattern = (string)($rule['pattern'] ?? '');
                if ($pattern === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Regex-based rule pattern is empty.'];
                } elseif (!diagnosticsRegexIsValid($pattern)) {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Regex-based rule pattern is invalid.'];
                }
            }
            if (in_array($kind, ['label', 'label_contains', 'label_starts_with'], true)) {
                if ($type !== 'docker') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label rules are only valid for docker.'];
                }
                $labelKey = (string)($rule['labelKey'] ?? '');
                if ($labelKey === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label rule key is empty.'];
                }
                if (in_array($kind, ['label_contains', 'label_starts_with'], true) && trim((string)($rule['labelValue'] ?? '')) === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label contains/starts-with rule value is empty.'];
                }
            }
        }

        foreach ($validNames as $name) {
            $rule = diagnosticsFirstMatchingRule($rules, $name, $infoByName, $type);
            if (!$rule) {
                continue;
            }
            $folderId = (string)($rule['folderId'] ?? '');
            if ($folderId !== '' && array_key_exists($folderId, $folders)) {
                if (!in_array($folderId, $effectiveAssignments[$name] ?? [], true)) {
                    $effectiveAssignments[$name][] = $folderId;
                }
            }
        }

        $duplicateNames = [];
        foreach ($nameBuckets as $bucket) {
            $ids = array_values(array_unique(array_map('strval', $bucket['folderIds'] ?? [])));
            if (count($ids) > 1) {
                $duplicateNames[] = [
                    'name' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)($bucket['name'] ?? '') : null,
                    'nameHash' => diagnosticsHashShort((string)($bucket['name'] ?? '')),
                    'folderIds' => $ids
                ];
            }
        }

        $buildConflicts = function(array $assignmentMap) use ($privacyMode): array {
            $examples = [];
            $count = 0;
            foreach ($assignmentMap as $name => $folderIds) {
                $ids = array_values(array_unique(array_map('strval', $folderIds)));
                if (count($ids) <= 1) {
                    continue;
                }
                $count++;
                if (count($examples) < 30) {
                    $examples[] = [
                        'item' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)$name : null,
                        'itemHash' => diagnosticsHashShort((string)$name),
                        'folderIds' => $ids,
                        'folderCount' => count($ids)
                    ];
                }
            }
            return ['count' => $count, 'examples' => $examples];
        };

        $missingManualOrderIds = [];
        foreach (($prefs['manualOrder'] ?? []) as $manualId) {
            $manualId = (string)$manualId;
            if ($manualId !== '' && !array_key_exists($manualId, $folders)) {
                $missingManualOrderIds[] = $manualId;
            }
        }
        $missingPreferenceFolderIds = static fn($ids): array => array_values(array_filter(normalizeStringIdList($ids), static fn($id): bool => !array_key_exists((string)$id, $folders)));
        $missingPinnedFolderIds = $missingPreferenceFolderIds($prefs['pinnedFolderIds'] ?? []); $missingHiddenFolderIds = $missingPreferenceFolderIds($prefs['hiddenFolderIds'] ?? []);

        $pathHealth = diagnosticsBuildPathHealth($type, $privacyMode);
        $pathIssueCount = count($pathHealth['issues'] ?? []);

        $orphanedCount = 0;
        $orphanedByFolder = [];
        foreach ($orphanedMembers as $folderId => $members) {
            $members = array_values(array_unique(array_map('strval', $members)));
            $orphanedCount += count($members);
            $orphanedByFolder[] = [
                'folderId' => (string)$folderId,
                'count' => count($members),
                'items' => diagnosticsFormatNames($members, $privacyMode)
            ];
        }

        $issuesCount = count($duplicateNames)
            + count($invalidRegexFolders)
            + count($invalidIconFolders)
            + count($invalidRules)
            + count($missingManualOrderIds)
            + count($missingPinnedFolderIds)
            + count($missingHiddenFolderIds)
            + $orphanedCount
            + $buildConflicts($effectiveAssignments)['count']
            + $pathIssueCount
            + max(0, (int)($configMetadataIntegrity['issuesCount'] ?? 0));

        return [
            'ok' => $issuesCount === 0,
            'issuesCount' => $issuesCount,
            'duplicateFolderNames' => [
                'count' => count($duplicateNames),
                'examples' => array_slice($duplicateNames, 0, 30)
            ],
            'orphanedMembers' => [
                'count' => $orphanedCount,
                'folders' => $orphanedByFolder
            ],
            'invalidFolderRegex' => [
                'count' => count($invalidRegexFolders),
                'folderIds' => array_values(array_unique($invalidRegexFolders))
            ],
            'invalidFolderIconPaths' => [
                'count' => count($invalidIconFolders),
                'folderIds' => array_values(array_unique($invalidIconFolders))
            ],
            'invalidAutoRules' => [
                'count' => count($invalidRules),
                'rules' => array_slice($invalidRules, 0, 40)
            ],
            'missingManualOrderIds' => [
                'count' => count($missingManualOrderIds),
                'ids' => array_values(array_unique($missingManualOrderIds))
            ],
            'missingPinnedFolderIds' => [
                'count' => count($missingPinnedFolderIds),
                'ids' => array_values(array_unique($missingPinnedFolderIds))
            ],
            'missingHiddenFolderIds' => [
                'count' => count($missingHiddenFolderIds),
                'ids' => array_values(array_unique($missingHiddenFolderIds))
            ],
            'duplicateAssignments' => [
                'explicit' => $buildConflicts($explicitAssignments),
                'regex' => $buildConflicts($regexAssignments),
                'effective' => $buildConflicts($effectiveAssignments)
            ],
            'configurationMetadata' => $configMetadataIntegrity,
            'pathHealth' => $pathHealth
        ];
    }
