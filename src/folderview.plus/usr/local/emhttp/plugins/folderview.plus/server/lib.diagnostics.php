<?php
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
        $decoded = @json_decode((string)@file_get_contents($path), true);
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
        $decoded = @json_decode((string)@file_get_contents($path), true);
        $events = is_array($decoded) ? $decoded : [];

        $event = [
            'id' => generateId(16),
            'timestamp' => gmdate('c'),
            'action' => $action,
            'type' => $type ? ensureType($type) : null,
            'status' => trim($status) === '' ? 'ok' : substr(trim($status), 0, 32),
            'source' => trim($source) === '' ? 'server' : substr(trim($source), 0, 64),
            'details' => diagnosticsNormalizeEventDetails($details)
        ];

        $events[] = $event;
        if (count($events) > FVPLUS_DIAGNOSTICS_HISTORY_MAX) {
            $events = array_slice($events, -FVPLUS_DIAGNOSTICS_HISTORY_MAX);
        }
        @file_put_contents($path, json_encode(array_values($events), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        return $event;
    }

    function diagnosticsHashShort(string $value): string {
        return substr(hash('sha256', $value), 0, 12);
    }

    function diagnosticsMaskIp(string $ip): string {
        $ip = trim($ip);
        if ($ip === '') {
            return '';
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            if (count($parts) === 4) {
                return $parts[0] . '.' . $parts[1] . '.x.x';
            }
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $ip);
            $head = implode(':', array_slice($parts, 0, 2));
            return $head . '::';
        }
        return '[redacted]';
    }

    function diagnosticsCreateSupportBundleRedactor(string $privacyMode): array {
        $privacyMode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $salt = '';
        $saltFingerprint = null;
        if ($privacyMode !== 'full') {
            try {
                $salt = bin2hex(random_bytes(16));
            } catch (Throwable $exception) {
                $seed = microtime(true) . ':' . getmypid() . ':' . uniqid('fvplus-support-bundle-', true);
                $salt = hash('sha256', $seed);
            }
            $saltFingerprint = substr(hash('sha256', $salt), 0, 16);
        }

        return [
            'mode' => $privacyMode,
            'salt' => $salt,
            'saltFingerprint' => $saltFingerprint,
            'hashedFields' => [],
            'maskedFields' => [],
            'omittedFields' => [],
            'truncatedFields' => []
        ];
    }

    function diagnosticsSupportBundleMarkRedaction(array &$redactor, string $bucket, string $fieldPath): void {
        if (!isset($redactor[$bucket]) || !is_array($redactor[$bucket])) {
            $redactor[$bucket] = [];
        }
        if ($fieldPath === '' || in_array($fieldPath, $redactor[$bucket], true)) {
            return;
        }
        $redactor[$bucket][] = $fieldPath;
    }

    function diagnosticsSupportBundleHashValue(array &$redactor, string $fieldPath, string $value): ?string {
        if ($value === '') {
            return null;
        }
        if (($redactor['mode'] ?? 'sanitized') === 'full') {
            return diagnosticsHashShort($value);
        }
        diagnosticsSupportBundleMarkRedaction($redactor, 'hashedFields', $fieldPath);
        $salt = (string)($redactor['salt'] ?? '');
        return substr(hash('sha256', $salt . "\n" . $fieldPath . "\n" . $value), 0, 16);
    }

    function diagnosticsSupportBundleMaskIpValue(array &$redactor, string $fieldPath, string $value): string {
        if (($redactor['mode'] ?? 'sanitized') === 'full') {
            return $value;
        }
        diagnosticsSupportBundleMarkRedaction($redactor, 'maskedFields', $fieldPath);
        return diagnosticsMaskIp($value);
    }

    function diagnosticsSupportBundleRedactScalar(array &$redactor, string $fieldPath, $value, bool $preserveBasename = false) {
        if (($redactor['mode'] ?? 'sanitized') === 'full') {
            return $value;
        }
        diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', $fieldPath);
        if (!is_string($value) || !$preserveBasename) {
            return null;
        }
        $value = trim($value);
        return $value === '' ? null : basename(str_replace('\\', '/', $value));
    }

    function diagnosticsSupportBundleRedactPathDescriptor(array $descriptor, string $fieldPath, array &$redactor): array {
        $sanitized = $descriptor;
        $path = (string)($descriptor['path'] ?? '');
        $sanitized['path'] = diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.path', $path, true);
        $sanitized['pathHash'] = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.pathHash', $path);
        return $sanitized;
    }

    function diagnosticsSupportBundleRedactRecentTimelineSummary(string $summary, array &$redactor): string {
        if (($redactor['mode'] ?? 'sanitized') === 'full' || trim($summary) === '') {
            return $summary;
        }
        return (string)preg_replace_callback(
            '/\\b(name|folderId)=([^,]+)/',
            static function (array $matches) use (&$redactor): string {
                $label = (string)($matches[1] ?? 'value');
                $value = trim((string)($matches[2] ?? ''));
                if ($value === '') {
                    return $label . '=';
                }
                return $label . 'Hash=' . (diagnosticsSupportBundleHashValue(
                    $redactor,
                    'healthAndHistory.recentTimeline.*.summary.' . $label . 'Hash',
                    $value
                ) ?? '');
            },
            $summary
        );
    }

    function diagnosticsSupportBundleRedactEventDetails($value, string $fieldPath, array &$redactor, int $depth = 0) {
        if (($redactor['mode'] ?? 'sanitized') === 'full') {
            return $value;
        }
        if ($depth > 6) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', $fieldPath);
            return null;
        }
        if (!is_array($value)) {
            return $value;
        }

        $sanitized = [];
        foreach ($value as $key => $entry) {
            $key = (string)$key;
            $entryPath = $fieldPath . '.' . $key;
            $lowerKey = strtolower($key);

            if (is_array($entry)) {
                $sanitized[$key] = diagnosticsSupportBundleRedactEventDetails($entry, $entryPath, $redactor, $depth + 1);
                continue;
            }

            if (!is_string($entry)) {
                $sanitized[$key] = $entry;
                continue;
            }

            if (in_array($lowerKey, ['name', 'foldername', 'item', 'hostname', 'host', 'url', 'uri', 'useragent'], true)) {
                $sanitized[$key . 'Hash'] = diagnosticsSupportBundleHashValue($redactor, $entryPath . 'Hash', $entry);
                $sanitized[$key] = diagnosticsSupportBundleRedactScalar($redactor, $entryPath, $entry);
                continue;
            }

            if (in_array($lowerKey, ['path', 'folderpath', 'prefspath'], true)) {
                $sanitized[$key . 'Hash'] = diagnosticsSupportBundleHashValue($redactor, $entryPath . 'Hash', $entry);
                $sanitized[$key] = diagnosticsSupportBundleRedactScalar($redactor, $entryPath, $entry, true);
                continue;
            }

            if (in_array($lowerKey, ['ip', 'clientip', 'address'], true)) {
                $sanitized[$key . 'Hash'] = diagnosticsSupportBundleHashValue($redactor, $entryPath . 'Hash', $entry);
                $sanitized[$key] = diagnosticsSupportBundleMaskIpValue($redactor, $entryPath, $entry);
                continue;
            }

            $sanitized[$key] = $entry;
        }
        return $sanitized;
    }

    function diagnosticsSupportBundleRedactPathHealth(array $pathHealth, string $fieldPath, array &$redactor): array {
        $sanitized = $pathHealth;
        $paths = is_array($sanitized['paths'] ?? null) ? $sanitized['paths'] : [];
        foreach (['configDir', 'sourceDir', 'folderFile', 'prefsFile', 'backupDir'] as $key) {
            if (!is_array($paths[$key] ?? null)) {
                continue;
            }
            $paths[$key] = diagnosticsSupportBundleRedactPathDescriptor(
                $paths[$key],
                $fieldPath . '.paths.' . $key,
                $redactor
            );
        }
        $sanitized['paths'] = $paths;

        $legacyRemnants = [];
        foreach (array_values(is_array($sanitized['legacyRemnants'] ?? null) ? $sanitized['legacyRemnants'] : []) as $remnant) {
            if (!is_array($remnant)) {
                continue;
            }
            $path = (string)($remnant['path'] ?? '');
            $remnant['path'] = diagnosticsSupportBundleRedactScalar(
                $redactor,
                $fieldPath . '.legacyRemnants.*.path',
                $path,
                true
            );
            $remnant['pathHash'] = diagnosticsSupportBundleHashValue(
                $redactor,
                $fieldPath . '.legacyRemnants.*.pathHash',
                $path
            );
            $legacyRemnants[] = $remnant;
        }
        $sanitized['legacyRemnants'] = $legacyRemnants;
        return $sanitized;
    }

    function diagnosticsSupportBundleRedactIntegrityFindings(array $integrityFindings, array &$redactor): array {
        $sanitized = [];
        foreach (['docker', 'vm'] as $type) {
            $integrity = is_array($integrityFindings[$type] ?? null) ? $integrityFindings[$type] : [];
            $duplicateExamples = [];
            foreach (array_values(is_array($integrity['duplicateFolderNames']['examples'] ?? null) ? $integrity['duplicateFolderNames']['examples'] : []) as $example) {
                if (!is_array($example)) {
                    continue;
                }
                $name = (string)($example['name'] ?? '');
                $duplicateExamples[] = [
                    'name' => diagnosticsSupportBundleRedactScalar($redactor, 'healthAndHistory.integrityFindings.' . $type . '.duplicateFolderNames.examples.*.name', $name),
                    'nameHash' => diagnosticsSupportBundleHashValue($redactor, 'healthAndHistory.integrityFindings.' . $type . '.duplicateFolderNames.examples.*.nameHash', $name),
                    'folderIds' => array_values(array_map('strval', is_array($example['folderIds'] ?? null) ? $example['folderIds'] : []))
                ];
            }

            $orphanedFolders = [];
            foreach (array_values(is_array($integrity['orphanedMembers']['folders'] ?? null) ? $integrity['orphanedMembers']['folders'] : []) as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $itemHashes = [];
                foreach (array_values(is_array($row['items'] ?? null) ? $row['items'] : []) as $itemName) {
                    $itemHashes[] = diagnosticsSupportBundleHashValue(
                        $redactor,
                        'healthAndHistory.integrityFindings.' . $type . '.orphanedMembers.folders.*.itemHashes.*',
                        (string)$itemName
                    );
                }
                $orphanedFolders[] = [
                    'folderId' => (string)($row['folderId'] ?? ''),
                    'count' => (int)($row['count'] ?? 0),
                    'items' => (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full')
                        ? array_values(array_map('strval', is_array($row['items'] ?? null) ? $row['items'] : []))
                        : [],
                    'itemHashes' => (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full')
                        ? []
                        : array_values(array_filter($itemHashes, static function ($value): bool {
                            return is_string($value) && $value !== '';
                        }))
                ];
                if (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) !== 'full') {
                    diagnosticsSupportBundleMarkRedaction(
                        $redactor,
                        'omittedFields',
                        'healthAndHistory.integrityFindings.' . $type . '.orphanedMembers.folders.*.items'
                    );
                }
            }

            $assignmentGroups = [];
            $duplicateAssignments = is_array($integrity['duplicateAssignments'] ?? null) ? $integrity['duplicateAssignments'] : [];
            foreach (['explicit', 'regex', 'effective'] as $groupKey) {
                $group = is_array($duplicateAssignments[$groupKey] ?? null) ? $duplicateAssignments[$groupKey] : [];
                $examples = [];
                foreach (array_values(is_array($group['examples'] ?? null) ? $group['examples'] : []) as $example) {
                    if (!is_array($example)) {
                        continue;
                    }
                    $item = (string)($example['item'] ?? '');
                    $examples[] = [
                        'item' => diagnosticsSupportBundleRedactScalar(
                            $redactor,
                            'healthAndHistory.integrityFindings.' . $type . '.duplicateAssignments.' . $groupKey . '.examples.*.item',
                            $item
                        ),
                        'itemHash' => diagnosticsSupportBundleHashValue(
                            $redactor,
                            'healthAndHistory.integrityFindings.' . $type . '.duplicateAssignments.' . $groupKey . '.examples.*.itemHash',
                            $item
                        ),
                        'folderIds' => array_values(array_map('strval', is_array($example['folderIds'] ?? null) ? $example['folderIds'] : [])),
                        'folderCount' => (int)($example['folderCount'] ?? 0)
                    ];
                }
                $assignmentGroups[$groupKey] = [
                    'count' => (int)($group['count'] ?? 0),
                    'examples' => $examples
                ];
            }

            $integrity['duplicateFolderNames'] = [
                'count' => (int)($integrity['duplicateFolderNames']['count'] ?? 0),
                'examples' => $duplicateExamples
            ];
            $integrity['orphanedMembers'] = [
                'count' => (int)($integrity['orphanedMembers']['count'] ?? 0),
                'folders' => $orphanedFolders
            ];
            $integrity['duplicateAssignments'] = $assignmentGroups;
            $integrity['pathHealth'] = diagnosticsSupportBundleRedactPathHealth(
                is_array($integrity['pathHealth'] ?? null) ? $integrity['pathHealth'] : [],
                'healthAndHistory.integrityFindings.' . $type . '.pathHealth',
                $redactor
            );
            $sanitized[$type] = $integrity;
        }
        return $sanitized;
    }

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
            'stopped' => diagnosticsNormalizeStatusColor($settings['status_color_stopped'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['stopped'])
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
        global $sourceDir;
        $privacyMode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $directory = "$sourceDir/images/custom";
        $descriptor = diagnosticsPathDescriptor($directory, $privacyMode);
        $extensions = diagnosticsCustomIconExtensions();
        $usageMap = diagnosticsBuildCustomIconUsageMap();
        $fileCount = 0;
        $totalBytes = 0;
        $inUseIconCount = 0;
        $orphanedIconCount = 0;
        $referenceCount = 0;
        $topReferences = [];

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

        $repairHint = 'mkdir -p ' . escapeshellarg($directory) . ' && chmod -R 775 ' . escapeshellarg($directory);
        return [
            'path' => $descriptor,
            'fileCount' => $fileCount,
            'totalBytes' => $totalBytes,
            'inUseIconCount' => $inUseIconCount,
            'orphanedIconCount' => $orphanedIconCount,
            'referenceCount' => $referenceCount,
            'topReferences' => array_slice($topReferences, 0, 15),
            'issues' => $issues,
            'repairHint' => $repairHint
        ];
    }

    function diagnosticsBuildPathHealth(string $type, string $privacyMode): array {
        global $configDir, $sourceDir;
        $folderPath = getFolderFilePath($type);
        $prefsPath = getTypePrefsPath($type);
        $backupDir = getBackupsDirPath();
        $issues = [];

        $configDesc = diagnosticsPathDescriptor($configDir, $privacyMode);
        $sourceDesc = diagnosticsPathDescriptor($sourceDir, $privacyMode);
        $folderDesc = diagnosticsPathDescriptor($folderPath, $privacyMode);
        $prefsDesc = diagnosticsPathDescriptor($prefsPath, $privacyMode);
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
                'backupDir' => $backupDesc
            ],
            'legacyRemnants' => $legacyRemnants
        ];
    }

    function diagnosticsBuildIntegrityChecks(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode): array {
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
        $missingPinnedFolderIds = [];
        foreach (($prefs['pinnedFolderIds'] ?? []) as $pinnedId) {
            $pinnedId = (string)$pinnedId;
            if ($pinnedId !== '' && !array_key_exists($pinnedId, $folders)) {
                $missingPinnedFolderIds[] = $pinnedId;
            }
        }

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
            + $orphanedCount
            + $buildConflicts($effectiveAssignments)['count']
            + $pathIssueCount;

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
            'duplicateAssignments' => [
                'explicit' => $buildConflicts($explicitAssignments),
                'regex' => $buildConflicts($regexAssignments),
                'effective' => $buildConflicts($effectiveAssignments)
            ],
            'pathHealth' => $pathHealth
        ];
    }

    function diagnosticsStateKindForDockerItem(array $item): string {
        $state = is_array($item['info']['State'] ?? null) ? $item['info']['State'] : [];
        $running = (bool)($state['Running'] ?? false);
        $paused = (bool)($state['Paused'] ?? false);
        if ($running && !$paused) {
            return 'started';
        }
        if ($running && $paused) {
            return 'paused';
        }
        return 'stopped';
    }

    function diagnosticsStateKindForVmItem(array $item): string {
        $state = strtolower(trim((string)($item['state'] ?? '')));
        if ($state === 'running') {
            return 'started';
        }
        if (in_array($state, ['paused', 'pmsuspended', 'unknown'], true)) {
            return 'paused';
        }
        return 'stopped';
    }

    function diagnosticsBuildStateSnapshot(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode): array {
        $validNames = array_keys($infoByName);
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $ruleTargetByName = [];
        foreach ($validNames as $name) {
            $rule = diagnosticsFirstMatchingRule($rules, $name, $infoByName, $type);
            $ruleTargetByName[$name] = $rule ? (string)($rule['folderId'] ?? '') : '';
        }

        $badges = is_array($prefs['badges'] ?? null) ? $prefs['badges'] : [];
        $showRunningBadge = !array_key_exists('running', $badges) ? true : (bool)$badges['running'];
        $showStoppedBadge = array_key_exists('stopped', $badges) && (bool)$badges['stopped'];
        $showUpdateBadge = !array_key_exists('updates', $badges) ? true : (bool)$badges['updates'];

        $snapshotFolders = [];
        $folderStatusTotals = ['running' => 0, 'paused' => 0, 'stopped' => 0];
        $memberTotals = ['started' => 0, 'paused' => 0, 'stopped' => 0, 'total' => 0];

        foreach ($folders as $folderId => $folder) {
            $members = normalizeFolderMembers($folder['containers'] ?? []);
            $regex = (string)($folder['regex'] ?? '');
            if ($regex !== '' && diagnosticsRegexIsValid($regex)) {
                foreach ($validNames as $name) {
                    if (diagnosticsRegexMatches($regex, $name) && !in_array($name, $members, true)) {
                        $members[] = $name;
                    }
                }
            }
            if ($type === 'docker') {
                $folderName = trim((string)($folder['name'] ?? ''));
                if ($folderName !== '') {
                    foreach ($validNames as $name) {
                        $labelValue = getFolderLabelValueFromLabels(dockerInfoLabelsForName($infoByName, $name));
                        if ($labelValue !== '' && $labelValue === $folderName && !in_array($name, $members, true)) {
                            $members[] = $name;
                        }
                    }
                }
            }
            foreach ($validNames as $name) {
                if (($ruleTargetByName[$name] ?? '') === (string)$folderId && !in_array($name, $members, true)) {
                    $members[] = $name;
                }
            }

            $started = 0;
            $paused = 0;
            $stopped = 0;
            foreach ($members as $name) {
                $item = $infoByName[$name] ?? null;
                if (!is_array($item)) {
                    continue;
                }
                $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
                if ($kind === 'started') {
                    $started++;
                } elseif ($kind === 'paused') {
                    $paused++;
                } else {
                    $stopped++;
                }
            }

            $total = count($members);
            $statusKind = 'stopped';
            $statusCount = $stopped;
            if ($started > 0) {
                $statusKind = 'running';
                $statusCount = $started;
            } elseif ($paused > 0) {
                $statusKind = 'paused';
                $statusCount = $paused;
            }
            $statusText = sprintf('%d/%d %s', $statusCount, $total, $statusKind === 'running' ? 'started' : $statusKind);
            $badgeVisible = true;
            if ($statusKind === 'running') {
                $badgeVisible = $showRunningBadge;
            } elseif ($statusKind === 'stopped') {
                $badgeVisible = $showStoppedBadge;
            }

            $folderStatusTotals[$statusKind]++;
            $memberTotals['started'] += $started;
            $memberTotals['paused'] += $paused;
            $memberTotals['stopped'] += $stopped;
            $memberTotals['total'] += $total;

            $snapshotFolders[$folderId] = [
                'folderId' => (string)$folderId,
                'folderName' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)($folder['name'] ?? $folderId) : null,
                'folderNameHash' => diagnosticsHashShort((string)($folder['name'] ?? $folderId)),
                'members' => [
                    'total' => $total,
                    'started' => $started,
                    'paused' => $paused,
                    'stopped' => $stopped,
                    'items' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? array_slice($members, 0, 40) : []
                ],
                'status' => [
                    'kind' => $statusKind,
                    'text' => $statusText,
                    'badgeVisible' => $badgeVisible,
                    'colors' => diagnosticsFolderStatusColors(is_array($folder) ? $folder : [])
                ]
            ];
        }

        return [
            'summary' => [
                'folderTotalsByStatus' => $folderStatusTotals,
                'memberTotals' => $memberTotals,
                'badgePrefs' => [
                    'running' => $showRunningBadge,
                    'stopped' => $showStoppedBadge,
                    'updates' => $showUpdateBadge
                ]
            ],
            'folders' => $snapshotFolders
        ];
    }

    function diagnosticsSummaryStatusFromCounts(int $errorCount, int $warningCount = 0): string {
        if ($errorCount > 0) {
            return 'error';
        }
        if ($warningCount > 0) {
            return 'warning';
        }
        return 'healthy';
    }

    function diagnosticsBuildSummaryCard(string $key, string $label, string $status, string $headline, string $detail = '', array $extra = []): array {
        return array_merge([
            'key' => $key,
            'label' => $label,
            'status' => in_array($status, ['healthy', 'warning', 'error'], true) ? $status : 'healthy',
            'headline' => $headline,
            'detail' => $detail
        ], $extra);
    }

    function diagnosticsBuildRecommendedActions(array $typesData, array $customIcons): array {
        $actions = [];
        $addAction = static function (string $action, string $label, string $reason) use (&$actions): void {
            if (isset($actions[$action])) {
                return;
            }
            $actions[$action] = [
                'action' => $action,
                'label' => $label,
                'reason' => $reason
            ];
        };

        $dockerIntegrity = is_array($typesData['docker']['integrityChecks'] ?? null)
            ? $typesData['docker']['integrityChecks']
            : [];
        $vmIntegrity = is_array($typesData['vm']['integrityChecks'] ?? null)
            ? $typesData['vm']['integrityChecks']
            : [];

        if (((int)($dockerIntegrity['missingManualOrderIds']['count'] ?? 0)) > 0) {
            $addAction(
                'sync_docker_order',
                'Rebuild Docker order index',
                'Docker manual order still references missing folder ids.'
            );
        }

        $prefsNeedCleanup = false;
        foreach ([$dockerIntegrity, $vmIntegrity] as $integrity) {
            $prefsNeedCleanup = $prefsNeedCleanup
                || ((int)($integrity['invalidAutoRules']['count'] ?? 0)) > 0
                || ((int)($integrity['invalidFolderRegex']['count'] ?? 0)) > 0
                || ((int)($integrity['invalidFolderIconPaths']['count'] ?? 0)) > 0
                || ((int)($integrity['missingPinnedFolderIds']['count'] ?? 0)) > 0
                || ((int)($integrity['missingManualOrderIds']['count'] ?? 0)) > 0;
            if ($prefsNeedCleanup) {
                break;
            }
        }
        if ($prefsNeedCleanup) {
            $addAction(
                'normalize_prefs',
                'Validate and normalize prefs',
                'Folder rules or saved preference ids need cleanup.'
            );
        }

        $pathIssues = [];
        foreach (['docker', 'vm'] as $type) {
            $integrity = is_array($typesData[$type]['integrityChecks'] ?? null)
                ? $typesData[$type]['integrityChecks']
                : [];
            foreach ((array)($integrity['pathHealth']['issues'] ?? []) as $issue) {
                $text = trim((string)$issue);
                if ($text !== '') {
                    $pathIssues[] = $text;
                }
            }
        }
        $customIconIssues = array_values(array_filter(array_map('strval', (array)($customIcons['issues'] ?? []))));
        if (!empty($pathIssues) || !empty($customIconIssues)) {
            $reason = !empty($pathIssues)
                ? 'Plugin paths or permissions need repair.'
                : 'Custom icon storage reported problems.';
            if (!empty($pathIssues) && !empty($customIconIssues)) {
                $reason .= ' Custom icon storage also reported problems.';
            }
            $addAction(
                'repair_paths',
                'Repair plugin paths',
                $reason
            );
        }

        return array_values($actions);
    }

    function diagnosticsBuildOverviewSummary(array $typesData, array $customIcons, array $update): array {
        $cards = [];
        $errorCount = 0;
        $warningCount = 0;
        $totalIssues = 0;
        $pathIssues = [];

        foreach (['docker' => 'Docker config', 'vm' => 'VM config'] as $type => $label) {
            $typeData = is_array($typesData[$type] ?? null) ? $typesData[$type] : [];
            $integrity = is_array($typeData['integrityChecks'] ?? null) ? $typeData['integrityChecks'] : [];
            $issueCount = max(0, (int)($integrity['issuesCount'] ?? 0));
            $folderCount = max(0, (int)($typeData['folderCount'] ?? 0));
            $ruleCount = max(0, (int)($typeData['ruleCount'] ?? 0));
            $backupCount = max(0, (int)($typeData['backupCount'] ?? 0));
            $typePathIssues = array_values(array_filter(array_map('strval', (array)($integrity['pathHealth']['issues'] ?? []))));
            $pathIssues = array_merge($pathIssues, $typePathIssues);

            $status = $issueCount > 0 ? 'error' : 'healthy';
            if ($status === 'error') {
                $errorCount++;
                $totalIssues += $issueCount;
            }

            $cards[] = diagnosticsBuildSummaryCard(
                $type,
                $label,
                $status,
                $issueCount > 0 ? sprintf('%d issue(s) need attention.', $issueCount) : 'No issues detected.',
                $issueCount > 0 && count($typePathIssues) > 0
                    ? $typePathIssues[0]
                    : sprintf('%d folder(s), %d rule(s), %d backup(s).', $folderCount, $ruleCount, $backupCount),
                ['count' => $issueCount]
            );
        }

        $pathIssues = array_values(array_unique(array_filter(array_map('strval', $pathIssues))));
        $pathIssueCount = count($pathIssues);
        if ($pathIssueCount > 0) {
            $errorCount++;
        }
        $cards[] = diagnosticsBuildSummaryCard(
            'storage',
            'Storage and paths',
            $pathIssueCount > 0 ? 'error' : 'healthy',
            $pathIssueCount > 0 ? sprintf('%d path or permission issue(s) detected.', $pathIssueCount) : 'Paths look healthy.',
            $pathIssueCount > 0
                ? implode(' ', array_slice($pathIssues, 0, 2))
                : 'Folder maps, prefs, and backups look readable and writable.',
            ['count' => $pathIssueCount]
        );

        $customIconIssues = array_values(array_filter(array_map('strval', (array)($customIcons['issues'] ?? []))));
        $customIconIssueCount = count($customIconIssues);
        $orphanedIconCount = max(0, (int)($customIcons['orphanedIconCount'] ?? 0));
        $iconStatus = $customIconIssueCount > 0 ? 'error' : ($orphanedIconCount > 0 ? 'warning' : 'healthy');
        if ($iconStatus === 'error') {
            $errorCount++;
            $totalIssues += $customIconIssueCount;
        } elseif ($iconStatus === 'warning') {
            $warningCount++;
        }
        $cards[] = diagnosticsBuildSummaryCard(
            'custom_icons',
            'Custom icons',
            $iconStatus,
            $customIconIssueCount > 0
                ? sprintf('%d storage issue(s) detected.', $customIconIssueCount)
                : ($orphanedIconCount > 0 ? sprintf('%d orphaned icon(s) found.', $orphanedIconCount) : 'Custom icon storage looks healthy.'),
            $customIconIssueCount > 0
                ? implode(' ', array_slice($customIconIssues, 0, 2))
                : ($orphanedIconCount > 0
                    ? 'Unused custom icons can be cleaned up later if needed.'
                    : sprintf('%d icon file(s) tracked.', max(0, (int)($customIcons['fileCount'] ?? 0)))),
            ['count' => $customIconIssueCount > 0 ? $customIconIssueCount : $orphanedIconCount]
        );

        $updateOk = (bool)($update['ok'] ?? false);
        $updateAvailable = (bool)($update['updateAvailable'] ?? false);
        $updateStatus = !$updateOk ? 'warning' : ($updateAvailable ? 'warning' : 'healthy');
        if ($updateStatus === 'warning') {
            $warningCount++;
        }
        $cards[] = diagnosticsBuildSummaryCard(
            'update',
            'Update check',
            $updateStatus,
            !$updateOk
                ? 'Update check failed.'
                : ($updateAvailable
                    ? sprintf('Update available: %s', (string)($update['remoteVersion'] ?? 'unknown'))
                    : 'Plugin is up to date.'),
            !$updateOk
                ? (string)($update['error'] ?? 'Unable to reach the remote manifest.')
                : ($updateAvailable
                    ? sprintf('Current %s, remote %s.', (string)($update['currentVersion'] ?? 'unknown'), (string)($update['remoteVersion'] ?? 'unknown'))
                    : sprintf('Current version %s.', (string)($update['currentVersion'] ?? 'unknown'))),
            ['count' => $updateAvailable ? 1 : 0]
        );

        $status = diagnosticsSummaryStatusFromCounts($errorCount, $warningCount);
        $headline = $totalIssues > 0
            ? sprintf('Detected %d issue(s) that may affect FolderView Plus.', $totalIssues)
            : ($warningCount > 0
                ? 'Plugin is healthy, but there are a few follow-up items.'
                : 'No major plugin health issues detected.');
        $detail = $totalIssues > 0
            ? 'Start with the suggested fixes below. If the problem continues, copy the issue report or export a support bundle.'
            : ($warningCount > 0
                ? 'Review the warning cards below, then decide if any follow-up is needed.'
                : 'Use support exports only if you need to share diagnostics with someone else.');

        return [
            'status' => $status,
            'headline' => $headline,
            'detail' => $detail,
            'errorCount' => $errorCount,
            'warningCount' => $warningCount,
            'totalIssues' => $totalIssues,
            'cards' => $cards,
            'recommendedActions' => diagnosticsBuildRecommendedActions($typesData, $customIcons)
        ];
    }

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
            $integrityChecks = diagnosticsBuildIntegrityChecks($type, $folders, $prefs, $infoByName, $privacyMode);
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
                'hideEmptyFolders' => normalizeBool($prefs['hideEmptyFolders'] ?? false, false),
                'appColumnWidth' => normalizeAppColumnWidth($prefs['appColumnWidth'] ?? 'standard'),
                'setupWizardCompleted' => normalizeBool($prefs['setupWizardCompleted'] ?? false, false),
                'settingsMode' => (($prefs['settingsMode'] ?? 'basic') === 'advanced') ? 'advanced' : 'basic',
                'runtimePrefsSchema' => normalizeIntInRange($prefs['runtimePrefsSchema'] ?? FVPLUS_RUNTIME_PREFS_SCHEMA, 0, FVPLUS_RUNTIME_PREFS_SCHEMA, FVPLUS_RUNTIME_PREFS_SCHEMA),
                'liveRefreshEnabled' => normalizeBool($prefs['liveRefreshEnabled'] ?? false, false),
                'liveRefreshSeconds' => normalizeIntInRange($prefs['liveRefreshSeconds'] ?? 20, 10, 300, 20),
                'performanceMode' => normalizeBool($prefs['performanceMode'] ?? false, false),
                'lazyPreviewEnabled' => normalizeBool($prefs['lazyPreviewEnabled'] ?? false, false),
                'lazyPreviewThreshold' => normalizeIntInRange($prefs['lazyPreviewThreshold'] ?? 30, 10, 200, 30),
                'themeCompatibilityMode' => normalizeThemeCompatibilityMode($prefs['themeCompatibilityMode'] ?? 'auto'),
                'health' => [
                    'cardsEnabled' => normalizeBool($prefs['health']['cardsEnabled'] ?? true, true),
                    'runtimeBadgeEnabled' => normalizeBool($prefs['health']['runtimeBadgeEnabled'] ?? false, false),
                    'compact' => normalizeBool($prefs['health']['compact'] ?? false, false),
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
                        : 'critical'
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
                'integrityChecks' => $integrityChecks,
                'stateSnapshot' => $stateSnapshot
            ];
        }

        $historyEvents = readDiagnosticsHistoryEvents(80);
        $customIcons = diagnosticsBuildCustomIconStorage($privacyMode);
        $update = checkRemotePluginUpdate();
        return [
            'schemaVersion' => FVPLUS_DIAGNOSTICS_SCHEMA_VERSION,
            'privacyMode' => $privacyMode,
            'checkedAt' => gmdate('c'),
            'pluginVersion' => readInstalledVersion(),
            'environment' => getEnvironmentSnapshot($privacyMode),
            'hashes' => getDiagnosticsKeyFileHashes($privacyMode),
            'customIcons' => $customIcons,
            'importExportHistory' => [
                'retained' => count(readDiagnosticsHistoryEvents(FVPLUS_DIAGNOSTICS_HISTORY_MAX)),
                'returned' => count($historyEvents),
                'events' => $historyEvents
            ],
            'recentTimeline' => buildDiagnosticsTimeline($historyEvents, 25),
            'update' => $update,
            'summary' => diagnosticsBuildOverviewSummary($typesData, $customIcons, $update),
            'types' => $typesData
        ];
    }

    function diagnosticsResolveSupportBundleChannel(): string {
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

    function diagnosticsBuildSupportBundleMetaSection(array $diagnostics, array $redactor): array {
        return [
            'bundleType' => 'FolderViewPlusSupportBundle',
            'bundleVersion' => 2,
            'schemaVersion' => (int)($diagnostics['schemaVersion'] ?? 0),
            'generatedAt' => gmdate('c'),
            'pluginVersion' => (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'channel' => diagnosticsResolveSupportBundleChannel(),
            'privacyMode' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)),
            'redactionPolicyVersion' => 1,
            'bundleSaltScope' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)) === 'full' ? 'none' : 'per-bundle',
            'bundleSaltHash' => $redactor['saltFingerprint'] ?? null
        ];
    }

    function diagnosticsBuildSupportBundlePluginTypeSection(string $type, array $typeData, array $hashes, array &$redactor): array {
        $backupSchedule = is_array($typeData['backupSchedule'] ?? null) ? $typeData['backupSchedule'] : [];
        $lastBackup = is_array($typeData['lastBackup'] ?? null) ? $typeData['lastBackup'] : null;
        $folderPath = (string)($typeData['folderPath'] ?? '');
        $folderFileHash = is_array($hashes[$type . 'Folders'] ?? null) ? $hashes[$type . 'Folders'] : [];
        $prefsFileHash = is_array($hashes[$type . 'Prefs'] ?? null) ? $hashes[$type . 'Prefs'] : [];

        return [
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
                'path' => diagnosticsSupportBundleRedactScalar($redactor, 'pluginState.' . $type . '.folders.path', $folderPath, true),
                'pathHash' => diagnosticsSupportBundleHashValue($redactor, 'pluginState.' . $type . '.folders.pathHash', $folderPath),
                'exists' => (bool)($typeData['foldersExists'] ?? false),
                'count' => (int)($typeData['folderCount'] ?? 0),
                'manualOrderCount' => (int)($typeData['manualOrderCount'] ?? 0),
                'pinnedFolderCount' => (int)($typeData['pinnedFolderCount'] ?? 0)
            ],
            'templates' => [
                'count' => (int)($typeData['templateCount'] ?? 0)
            ],
            'fileHashes' => [
                'folders' => diagnosticsSupportBundleRedactPathDescriptor($folderFileHash, 'pluginState.' . $type . '.fileHashes.folders', $redactor),
                'prefs' => diagnosticsSupportBundleRedactPathDescriptor($prefsFileHash, 'pluginState.' . $type . '.fileHashes.prefs', $redactor)
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
    }

    function diagnosticsBuildSupportBundlePluginStateSection(array $diagnostics, array &$redactor): array {
        $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
        $hashes = is_array($diagnostics['hashes'] ?? null) ? $diagnostics['hashes'] : [];
        $section = [];
        foreach (['docker', 'vm'] as $type) {
            $typeData = is_array($types[$type] ?? null) ? $types[$type] : [];
            $section[$type] = diagnosticsBuildSupportBundlePluginTypeSection($type, $typeData, $hashes, $redactor);
        }
        return $section;
    }

    function diagnosticsBuildSupportBundleRuntimeTypeSection(string $type, array $typeData, array &$redactor): array {
        $stateSnapshot = is_array($typeData['stateSnapshot'] ?? null) ? $typeData['stateSnapshot'] : [];
        $folders = [];
        foreach (array_values(is_array($stateSnapshot['folders'] ?? null) ? $stateSnapshot['folders'] : []) as $index => $folder) {
            if (!is_array($folder)) {
                continue;
            }
            $fieldPath = 'runtimeState.' . $type . '.folderHierarchySummary.folders.*';
            $folderName = (string)($folder['folderName'] ?? '');
            $memberItems = array_values(is_array($folder['members']['items'] ?? null) ? $folder['members']['items'] : []);
            $folder['folderName'] = diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.folderName', $folderName);
            $folder['folderNameHash'] = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.folderNameHash', $folderName !== '' ? $folderName : (string)($folder['folderId'] ?? ''));
            if (!isset($folder['members']) || !is_array($folder['members'])) {
                $folder['members'] = [];
            }
            if (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full') {
                $folder['members']['items'] = array_slice(array_map('strval', $memberItems), 0, 40);
            } else {
                $folder['members']['itemHashes'] = array_slice(array_values(array_map(
                    static function ($name) use (&$redactor, $fieldPath): ?string {
                        return diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.members.itemHashes.*', (string)$name);
                    },
                    $memberItems
                )), 0, 40);
                $folder['members']['items'] = [];
                diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', $fieldPath . '.members.items');
            }
            $folders[$index] = $folder;
        }

        $foldersPath = (string)($typeData['folderPath'] ?? '');
        $prefsPath = (string)($typeData['prefsPath'] ?? '');

        return [
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
                'folders' => $folders
            ],
            'updateStateSummary' => is_array($stateSnapshot['updateCounts'] ?? null) ? $stateSnapshot['updateCounts'] : [],
            'preflight' => [
                'foldersPath' => diagnosticsSupportBundleRedactScalar($redactor, 'runtimeState.' . $type . '.preflight.foldersPath', $foldersPath, true),
                'foldersPathHash' => diagnosticsSupportBundleHashValue($redactor, 'runtimeState.' . $type . '.preflight.foldersPathHash', $foldersPath),
                'prefsPath' => diagnosticsSupportBundleRedactScalar($redactor, 'runtimeState.' . $type . '.preflight.prefsPath', $prefsPath, true),
                'prefsPathHash' => diagnosticsSupportBundleHashValue($redactor, 'runtimeState.' . $type . '.preflight.prefsPathHash', $prefsPath),
                'foldersExists' => (bool)($typeData['foldersExists'] ?? false),
                'prefsExists' => (bool)($typeData['prefsExists'] ?? false)
            ]
        ];
    }

    function diagnosticsBuildSupportBundleRuntimeStateSection(array $diagnostics, array &$redactor): array {
        $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
        $detectedConflicts = fvplus_detect_runtime_plugin_conflicts();
        return [
            'docker' => diagnosticsBuildSupportBundleRuntimeTypeSection('docker', is_array($types['docker'] ?? null) ? $types['docker'] : [], $redactor),
            'vm' => diagnosticsBuildSupportBundleRuntimeTypeSection('vm', is_array($types['vm'] ?? null) ? $types['vm'] : [], $redactor),
            'conflicts' => [
                'runtimeSafeMode' => count($detectedConflicts) > 0,
                'detected' => $detectedConflicts
            ]
        ];
    }

    function diagnosticsBuildSupportBundleSystemSection(array $diagnostics, array $integrityFindings, array &$redactor): array {
        $environment = is_array($diagnostics['environment'] ?? null) ? $diagnostics['environment'] : [];
        $customIcons = is_array($diagnostics['customIcons'] ?? null) ? $diagnostics['customIcons'] : [];
        $request = is_array($environment['request'] ?? null) ? $environment['request'] : [];
        $userAgent = (string)($request['userAgent'] ?? '');
        $clientIp = (string)($request['clientIp'] ?? '');
        $customIconsPath = is_array($customIcons['path'] ?? null) ? $customIcons['path'] : [];
        $topReferences = [];
        foreach (array_values(is_array($customIcons['topReferences'] ?? null) ? $customIcons['topReferences'] : []) as $reference) {
            if (!is_array($reference)) {
                continue;
            }
            $name = (string)($reference['name'] ?? '');
            $topReferences[] = [
                'name' => diagnosticsSupportBundleRedactScalar($redactor, 'system.pathHealth.customIcons.topReferences.*.name', $name),
                'nameHash' => diagnosticsSupportBundleHashValue($redactor, 'system.pathHealth.customIcons.topReferences.*.nameHash', $name),
                'referenceCount' => (int)($reference['referenceCount'] ?? 0)
            ];
        }
        $customIcons['path'] = diagnosticsSupportBundleRedactPathDescriptor($customIconsPath, 'system.pathHealth.customIcons.path', $redactor);
        $customIcons['topReferences'] = $topReferences;
        $customIconsRepairHint = (string)($customIcons['repairHint'] ?? '');
        $customIcons['repairHint'] = (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full')
            ? $customIconsRepairHint
            : null;
        if (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) !== 'full' && $customIconsRepairHint !== '') {
            diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', 'system.pathHealth.customIcons.repairHint');
        }
        return [
            'unraidVersion' => $environment['unraidVersion'] ?? null,
            'phpVersion' => $environment['phpVersion'] ?? null,
            'kernel' => $environment['os'] ?? null,
            'timezone' => $environment['timezone'] ?? null,
            'serverSoftware' => $environment['serverSoftware'] ?? null,
            'request' => [
                'privacyMode' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)),
                'userAgent' => diagnosticsSupportBundleRedactScalar($redactor, 'system.request.userAgent', $userAgent),
                'userAgentHash' => diagnosticsSupportBundleHashValue($redactor, 'system.request.userAgentHash', $userAgent),
                'clientIp' => diagnosticsSupportBundleMaskIpValue($redactor, 'system.request.clientIp', $clientIp),
                'clientIpHash' => diagnosticsSupportBundleHashValue($redactor, 'system.request.clientIpHash', $clientIp)
            ],
            'pathHealth' => [
                'docker' => diagnosticsSupportBundleRedactPathHealth(
                    is_array($integrityFindings['docker']['pathHealth'] ?? null) ? $integrityFindings['docker']['pathHealth'] : [],
                    'system.pathHealth.docker',
                    $redactor
                ),
                'vm' => diagnosticsSupportBundleRedactPathHealth(
                    is_array($integrityFindings['vm']['pathHealth'] ?? null) ? $integrityFindings['vm']['pathHealth'] : [],
                    'system.pathHealth.vm',
                    $redactor
                ),
                'customIcons' => $customIcons
            ],
            'phpExtensions' => array_values(get_loaded_extensions())
        ];
    }

    function diagnosticsBuildSupportBundleHealthAndHistorySection(array $diagnostics, array $integrityFindings, array &$redactor): array {
        $summary = is_array($diagnostics['summary'] ?? null) ? $diagnostics['summary'] : [];
        $history = is_array($diagnostics['importExportHistory'] ?? null) ? $diagnostics['importExportHistory'] : [];
        $timelineRows = [];
        foreach (array_values(is_array($diagnostics['recentTimeline'] ?? null) ? $diagnostics['recentTimeline'] : []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $timelineRows[] = [
                'timestamp' => (string)($row['timestamp'] ?? ''),
                'action' => (string)($row['action'] ?? ''),
                'type' => $row['type'] ?? null,
                'status' => (string)($row['status'] ?? 'ok'),
                'summary' => diagnosticsSupportBundleRedactRecentTimelineSummary((string)($row['summary'] ?? ''), $redactor)
            ];
        }
        if (count($timelineRows) < count(array_values(is_array($diagnostics['recentTimeline'] ?? null) ? $diagnostics['recentTimeline'] : []))) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', 'healthAndHistory.recentTimeline');
        }

        $historyEvents = [];
        foreach (array_values(is_array($history['events'] ?? null) ? $history['events'] : []) as $event) {
            if (!is_array($event)) {
                continue;
            }
            $historyEvents[] = [
                'id' => (string)($event['id'] ?? ''),
                'timestamp' => (string)($event['timestamp'] ?? ''),
                'action' => (string)($event['action'] ?? ''),
                'type' => $event['type'] ?? null,
                'status' => (string)($event['status'] ?? 'ok'),
                'source' => (string)($event['source'] ?? 'server'),
                'details' => diagnosticsSupportBundleRedactEventDetails(
                    is_array($event['details'] ?? null) ? $event['details'] : [],
                    'healthAndHistory.recentMutations.events.*.details',
                    $redactor
                )
            ];
        }

        return [
            'summary' => $summary,
            'integrityFindings' => diagnosticsSupportBundleRedactIntegrityFindings($integrityFindings, $redactor),
            'recommendedActions' => array_values(is_array($summary['recommendedActions'] ?? null) ? $summary['recommendedActions'] : []),
            'recentTimeline' => $timelineRows,
            'recentMutations' => [
                'retained' => (int)($history['retained'] ?? 0),
                'returned' => (int)($history['returned'] ?? 0),
                'events' => $historyEvents
            ],
            'update' => is_array($diagnostics['update'] ?? null) ? $diagnostics['update'] : []
        ];
    }

    function diagnosticsBuildSupportBundleRedactionManifestSection(array $redactor): array {
        $privacyMode = normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY));
        return [
            'mode' => $privacyMode,
            'saltScope' => $privacyMode === 'full' ? 'none' : 'per-bundle',
            'saltHash' => $privacyMode === 'full' ? null : ($redactor['saltFingerprint'] ?? null),
            'hashedFields' => array_values(array_unique(array_map('strval', is_array($redactor['hashedFields'] ?? null) ? $redactor['hashedFields'] : []))),
            'maskedFields' => array_values(array_unique(array_map('strval', is_array($redactor['maskedFields'] ?? null) ? $redactor['maskedFields'] : []))),
            'omittedFields' => array_values(array_unique(array_map('strval', is_array($redactor['omittedFields'] ?? null) ? $redactor['omittedFields'] : []))),
            'truncatedFields' => array_values(array_unique(array_map('strval', is_array($redactor['truncatedFields'] ?? null) ? $redactor['truncatedFields'] : [])))
        ];
    }

    function getSupportBundleV2Snapshot(string $privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY): array {
        $redactor = diagnosticsCreateSupportBundleRedactor($privacyMode);
        $diagnostics = getDiagnosticsSnapshot('full');
        $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
        $integrityFindings = [
            'docker' => is_array($types['docker']['integrityChecks'] ?? null) ? $types['docker']['integrityChecks'] : [],
            'vm' => is_array($types['vm']['integrityChecks'] ?? null) ? $types['vm']['integrityChecks'] : []
        ];

        return [
            'bundleMeta' => diagnosticsBuildSupportBundleMetaSection($diagnostics, $redactor),
            'system' => diagnosticsBuildSupportBundleSystemSection($diagnostics, $integrityFindings, $redactor),
            'pluginState' => diagnosticsBuildSupportBundlePluginStateSection($diagnostics, $redactor),
            'runtimeState' => diagnosticsBuildSupportBundleRuntimeStateSection($diagnostics, $redactor),
            'uiTelemetry' => new stdClass(),
            'healthAndHistory' => diagnosticsBuildSupportBundleHealthAndHistorySection($diagnostics, $integrityFindings, $redactor),
            'redactionManifest' => diagnosticsBuildSupportBundleRedactionManifestSection($redactor)
        ];
    }

