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

    function diagnosticsSupportBundleRedactFolderIdValue(array &$redactor, string $type, string $fieldPath, string $folderId): string {
        $normalizedFolderId = trim($folderId);
        if ($normalizedFolderId === '' || ($redactor['mode'] ?? 'sanitized') === 'full') {
            return $normalizedFolderId;
        }
        diagnosticsSupportBundleMarkRedaction($redactor, 'hashedFields', $fieldPath);
        $salt = (string)($redactor['salt'] ?? '');
        return substr(hash('sha256', $salt . "\nfolder-id:" . $type . "\n" . $normalizedFolderId), 0, 16);
    }

    function diagnosticsSupportBundleRedactFolderIdList(array &$redactor, string $type, string $fieldPath, array $folderIds): array {
        return array_values(array_map(
            static function ($folderId) use (&$redactor, $type, $fieldPath): string {
                return diagnosticsSupportBundleRedactFolderIdValue($redactor, $type, $fieldPath, (string)$folderId);
            },
            array_values(array_map('strval', $folderIds))
        ));
    }

    function diagnosticsSupportBundleRedactExpandedFolderState(array &$redactor, string $type, string $fieldPath, array $expandedFolderState): array {
        if (($redactor['mode'] ?? 'sanitized') === 'full') {
            return $expandedFolderState;
        }
        $sanitized = [];
        foreach ($expandedFolderState as $folderId => $expanded) {
            $safeFolderId = diagnosticsSupportBundleRedactFolderIdValue(
                $redactor,
                $type,
                $fieldPath . '.*',
                (string)$folderId
            );
            if ($safeFolderId === '') {
                continue;
            }
            $sanitized[$safeFolderId] = (bool)$expanded;
        }
        return $sanitized;
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

    function diagnosticsSupportBundleActionTargetValue(array $details): string {
        foreach (['folderId', 'id', 'name', 'folderName', 'item', 'reason'] as $key) {
            $value = trim((string)($details[$key] ?? ''));
            if ($value !== '') {
                return $key . ':' . $value;
            }
        }
        return '';
    }

    function diagnosticsBuildSupportBundleRecentActions(array $events, array &$redactor, int $limit = 30): array {
        $rows = [];
        $maxRows = max(1, $limit);
        foreach (array_slice(array_values($events), 0, $maxRows) as $event) {
            if (!is_array($event)) {
                continue;
            }
            $details = is_array($event['details'] ?? null) ? $event['details'] : [];
            $targetValue = diagnosticsSupportBundleActionTargetValue($details);
            $row = [
                'timestamp' => (string)($event['timestamp'] ?? ''),
                'action' => (string)($event['action'] ?? ''),
                'type' => $event['type'] ?? null,
                'status' => (string)($event['status'] ?? 'ok'),
                'source' => (string)($event['source'] ?? 'server'),
                'target' => (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full')
                    ? ($targetValue !== '' ? $targetValue : null)
                    : null,
                'targetHash' => $targetValue !== ''
                    ? diagnosticsSupportBundleHashValue(
                        $redactor,
                        'healthAndHistory.recentActions.*.targetHash',
                        $targetValue
                    )
                    : null,
                'detailKeys' => array_slice(array_values(array_map('strval', array_keys($details))), 0, 24)
            ];
            if (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) !== 'full' && $targetValue !== '') {
                diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', 'healthAndHistory.recentActions.*.target');
            }
            $rows[] = $row;
        }
        if (count($rows) < count(array_values($events))) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', 'healthAndHistory.recentActions');
        }
        return $rows;
    }

    function diagnosticsBuildSupportBundleServerLogTailSection(array &$redactor, int $limit = 40): array {
        $logPath = defined('FVPLUS_API_ERROR_LOG') ? (string)FVPLUS_API_ERROR_LOG : '/tmp/folderview.plus.api-error.log';
        $lines = [];
        if (is_file($logPath)) {
            $allLines = @file($logPath, FILE_IGNORE_NEW_LINES);
            if (is_array($allLines)) {
                $slice = array_slice($allLines, -max(1, $limit));
                foreach ($slice as $line) {
                    $normalized = trim((string)$line);
                    if ($normalized === '') {
                        continue;
                    }
                    $lines[] = diagnosticsSupportBundleRedactInlineText(
                        substr($normalized, 0, 600),
                        'healthAndHistory.serverLogTail.lines.*',
                        $redactor
                    );
                }
            }
        }
        return [
            'path' => (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full') ? $logPath : basename(str_replace('\\', '/', $logPath)),
            'pathHash' => diagnosticsSupportBundleHashValue($redactor, 'healthAndHistory.serverLogTail.pathHash', $logPath),
            'exists' => is_file($logPath),
            'lineCount' => count($lines),
            'maxLines' => max(1, $limit),
            'lines' => $lines
        ];
    }

    function diagnosticsSupportBundleRedactInlineText(string $text, string $fieldPath, array &$redactor): string {
        if (($redactor['mode'] ?? 'sanitized') === 'full' || trim($text) === '') {
            return $text;
        }

        $redacted = (string)preg_replace_callback(
            '/\bhttps?:\/\/[^\s<>"\']+/i',
            static function (array $matches) use (&$redactor, $fieldPath): string {
                $url = trim((string)($matches[0] ?? ''));
                $urlHash = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.urlHash', $url);
                diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', $fieldPath . '.url');
                return $urlHash ? '[url-hash:' . $urlHash . ']' : '[url-redacted]';
            },
            $text
        );

        $redacted = (string)preg_replace_callback(
            '/(?:[A-Za-z]:[\\\\\/]|\/)[^\s<>"\']+/',
            static function (array $matches) use (&$redactor, $fieldPath): string {
                $pathValue = trim((string)($matches[0] ?? ''));
                if ($pathValue === '') {
                    return '';
                }
                $basename = basename(str_replace('\\', '/', rtrim($pathValue, '\\/')));
                $pathHash = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.pathHash', $pathValue);
                diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', $fieldPath . '.path');
                if ($basename !== '' && $pathHash) {
                    return $basename . '[path-hash:' . $pathHash . ']';
                }
                return $basename !== '' ? $basename : '[path-redacted]';
            },
            $redacted
        );

        $redacted = (string)preg_replace_callback(
            '/\b(?:\d{1,3}\.){3}\d{1,3}\b/',
            static function (array $matches) use (&$redactor, $fieldPath): string {
                $ipValue = trim((string)($matches[0] ?? ''));
                return diagnosticsSupportBundleMaskIpValue($redactor, $fieldPath . '.ip', $ipValue);
            },
            $redacted
        );

        return $redacted;
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
        $sanitized['issues'] = array_values(array_map(
            static function ($issue) use (&$redactor, $fieldPath): string {
                return diagnosticsSupportBundleRedactInlineText((string)$issue, $fieldPath . '.issues.*', $redactor);
            },
            is_array($sanitized['issues'] ?? null) ? $sanitized['issues'] : []
        ));
        $paths = is_array($sanitized['paths'] ?? null) ? $sanitized['paths'] : [];
        foreach (['configDir', 'sourceDir', 'folderFile', 'prefsFile', 'metadataFile', 'backupDir'] as $key) {
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
                    'folderIds' => diagnosticsSupportBundleRedactFolderIdList(
                        $redactor,
                        $type,
                        'healthAndHistory.integrityFindings.' . $type . '.duplicateFolderNames.examples.*.folderIds.*',
                        is_array($example['folderIds'] ?? null) ? $example['folderIds'] : []
                    )
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
                    'folderId' => diagnosticsSupportBundleRedactFolderIdValue(
                        $redactor,
                        $type,
                        'healthAndHistory.integrityFindings.' . $type . '.orphanedMembers.folders.*.folderId',
                        (string)($row['folderId'] ?? '')
                    ),
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
                        'folderIds' => diagnosticsSupportBundleRedactFolderIdList(
                            $redactor,
                            $type,
                            'healthAndHistory.integrityFindings.' . $type . '.duplicateAssignments.' . $groupKey . '.examples.*.folderIds.*',
                            is_array($example['folderIds'] ?? null) ? $example['folderIds'] : []
                        ),
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
            'duplicateAssignments' => [
                'explicit' => $buildConflicts($explicitAssignments),
                'regex' => $buildConflicts($regexAssignments),
                'effective' => $buildConflicts($effectiveAssignments)
            ],
            'configurationMetadata' => $configMetadataIntegrity,
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
        $validNameSet = array_fill_keys($validNames, true);
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

        $parentById = [];
        foreach ($folders as $folderId => $folder) {
            $safeFolderId = (string)$folderId;
            $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
            $parentById[$safeFolderId] = $parentId !== ''
                && $parentId !== $safeFolderId
                && array_key_exists($parentId, $folders)
                    ? $parentId
                    : '';
        }

        $depthById = [];
        $rootFolderCount = 0;
        $nestedFolderCount = 0;
        $maxDepth = 0;
        foreach (array_keys($folders) as $folderId) {
            $safeFolderId = (string)$folderId;
            $depth = 0;
            $cursor = $safeFolderId;
            $seen = [$safeFolderId => true];
            while (($parentById[$cursor] ?? '') !== '') {
                $parentId = (string)$parentById[$cursor];
                if (isset($seen[$parentId])) {
                    break;
                }
                $seen[$parentId] = true;
                $depth++;
                $cursor = $parentId;
            }
            $depthById[$safeFolderId] = $depth;
            if ($depth > 0) {
                $nestedFolderCount++;
            } else {
                $rootFolderCount++;
            }
            if ($depth > $maxDepth) {
                $maxDepth = $depth;
            }
        }

        $snapshotFolders = [];
        $folderStatusTotals = ['running' => 0, 'paused' => 0, 'stopped' => 0];
        $memberTotals = ['started' => 0, 'paused' => 0, 'stopped' => 0, 'total' => 0];
        $entityStateCounts = ['started' => 0, 'paused' => 0, 'stopped' => 0];
        $updateCounts = ['available' => 0, 'upToDate' => 0, 'unknown' => 0, 'total' => 0];
        $assignedItemSet = [];

        foreach ($infoByName as $name => $item) {
            if (!is_array($item)) {
                continue;
            }
            $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
            if (isset($entityStateCounts[$kind])) {
                $entityStateCounts[$kind]++;
            }
            if ($type === 'docker') {
                $updated = $item['info']['State']['Updated'] ?? null;
                if ($updated === true) {
                    $updateCounts['upToDate']++;
                } elseif ($updated === false) {
                    $updateCounts['available']++;
                } else {
                    $updateCounts['unknown']++;
                }
            } else {
                $updateCounts['unknown']++;
            }
            $updateCounts['total']++;
        }

        foreach ($folders as $folderId => $folder) {
            $safeFolderId = (string)$folderId;
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
            $folderManagerTypes = [];
            $folderManagedCount = 0;
            $folderUpToDate = true;
            foreach ($members as $name) {
                $item = $infoByName[$name] ?? null;
                if (!is_array($item)) {
                    continue;
                }
                if (isset($validNameSet[$name])) {
                    $assignedItemSet[$name] = true;
                }
                $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
                if ($kind === 'started') {
                    $started++;
                } elseif ($kind === 'paused') {
                    $paused++;
                } else {
                    $stopped++;
                }
                if ($type === 'docker') {
                    $memberManager = trim((string)($item['info']['State']['manager'] ?? ($item['manager'] ?? '')));
                    if ($memberManager !== '') {
                        $folderManagerTypes[$memberManager] = true;
                    }
                    if ($memberManager === 'dockerman') {
                        $folderManagedCount++;
                        $memberUpdated = $item['info']['State']['Updated'] ?? ($item['Updated'] ?? null);
                        if ($memberUpdated === false) {
                            $folderUpToDate = false;
                        }
                    }
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
            $hideUpdateColumn = diagnosticsFolderSettingBool(is_array($folder) ? $folder : [], 'update_column', false);
            $previewUpdate = diagnosticsFolderSettingBool(is_array($folder) ? $folder : [], 'preview_update', false);

            $folderStatusTotals[$statusKind]++;
            $memberTotals['started'] += $started;
            $memberTotals['paused'] += $paused;
            $memberTotals['stopped'] += $stopped;
            $memberTotals['total'] += $total;

            $snapshotFolders[$safeFolderId] = [
                'folderId' => $safeFolderId,
                'folderName' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)($folder['name'] ?? $folderId) : null,
                'folderNameHash' => diagnosticsHashShort((string)($folder['name'] ?? $folderId)),
                'parentId' => (string)($parentById[$safeFolderId] ?? ''),
                'depth' => (int)($depthById[$safeFolderId] ?? 0),
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
                ],
                'settings' => [
                    'previewUpdate' => $previewUpdate,
                    'hideUpdateColumn' => $hideUpdateColumn
                ]
            ];
            if ($type === 'docker') {
                $snapshotFolders[$safeFolderId]['renderExpectations'] = diagnosticsDockerFolderRenderExpectations(
                    array_keys($folderManagerTypes),
                    $folderUpToDate,
                    $folderManagedCount,
                    $showUpdateBadge,
                    $hideUpdateColumn
                );
            }
        }

        $entityDetails = [];
        $entityDetailsTotal = 0;
        $entityDetailsMaxEntries = 200;
        $managerCounts = [];
        foreach ($validNames as $name) {
            $item = $infoByName[$name] ?? null;
            if (!is_array($item)) {
                continue;
            }
            $entityDetailsTotal++;
            $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
            $manager = '';
            $updated = null;
            if ($type === 'docker') {
                $manager = trim((string)($item['info']['State']['manager'] ?? ($item['manager'] ?? '')));
                $updated = $item['info']['State']['Updated'] ?? ($item['Updated'] ?? null);
                $managerKey = $manager !== '' ? $manager : 'unclassified';
                $managerCounts[$managerKey] = (int)($managerCounts[$managerKey] ?? 0) + 1;
            }
            if (!is_bool($updated)) {
                $updated = null;
            }
            if ($entityDetailsTotal > $entityDetailsMaxEntries) {
                continue;
            }
            $provenance = [
                'managerSource' => 'missing',
                'updateSource' => 'missing'
            ];
            $renderExpectations = [
                'statusToken' => $updated === true ? 'upToDate' : ($updated === false ? 'available' : 'unknown'),
                'action' => 'none',
                'forceUpdateEligible' => false
            ];
            if ($type === 'docker') {
                $provenance = [
                    'managerSource' => diagnosticsDockerStateFieldSource($item, 'manager'),
                    'updateSource' => diagnosticsDockerStateFieldSource($item, 'updated')
                ];
                $renderExpectations = diagnosticsDockerMemberRenderExpectations($manager !== '' ? $manager : null, $updated);
            }
            $entityDetails[] = [
                'name' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)$name : null,
                'nameHash' => diagnosticsHashShort((string)$name),
                'state' => $kind,
                'assigned' => isset($assignedItemSet[$name]),
                'manager' => $manager !== '' ? $manager : null,
                'managed' => $manager === 'dockerman',
                'updated' => $updated,
                'updateState' => $updated === true ? 'upToDate' : ($updated === false ? 'available' : 'unknown'),
                'provenance' => $provenance,
                'renderExpectations' => $renderExpectations
            ];
        }
        if (!empty($managerCounts)) {
            ksort($managerCounts);
        }

        $totalItems = count($validNames);
        $assignedItems = count($assignedItemSet);
        $unassignedItems = max(0, $totalItems - $assignedItems);

        return [
            'totalItems' => $totalItems,
            'assignedItems' => $assignedItems,
            'unassignedItems' => $unassignedItems,
            'stateCounts' => $entityStateCounts,
            'rootFolderCount' => $rootFolderCount,
            'nestedFolderCount' => $nestedFolderCount,
            'maxDepth' => $maxDepth,
            'updateCounts' => $updateCounts,
            'managerCounts' => $managerCounts,
            'entityDetails' => [
                'total' => $entityDetailsTotal,
                'maxEntries' => $entityDetailsMaxEntries,
                'truncated' => $entityDetailsTotal > count($entityDetails),
                'entries' => $entityDetails
            ],
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

    function diagnosticsBuildIntegrityIssueDetail(array $integrity): string {
        $pathIssues = array_values(array_filter(array_map('strval', (array)($integrity['pathHealth']['issues'] ?? []))));
        if (!empty($pathIssues)) {
            return $pathIssues[0];
        }
        $metadataIssues = array_values(array_filter(array_map('strval', (array)($integrity['configurationMetadata']['issues'] ?? []))));
        if (!empty($metadataIssues)) {
            return $metadataIssues[0];
        }

        $orphanedCount = max(0, (int)($integrity['orphanedMembers']['count'] ?? 0));
        if ($orphanedCount > 0) {
            $orphanedFolderCount = count(array_values(is_array($integrity['orphanedMembers']['folders'] ?? null) ? $integrity['orphanedMembers']['folders'] : []));
            $orphanedFolderCount = max(1, $orphanedFolderCount);
            return sprintf(
                '%d orphaned member reference%s found in %d folder%s.',
                $orphanedCount,
                $orphanedCount === 1 ? '' : 's',
                $orphanedFolderCount,
                $orphanedFolderCount === 1 ? '' : 's'
            );
        }

        $effectiveDuplicateCount = max(0, (int)($integrity['duplicateAssignments']['effective']['count'] ?? 0));
        if ($effectiveDuplicateCount > 0) {
            return sprintf(
                '%d item assignment conflict%s found after rules and members were combined.',
                $effectiveDuplicateCount,
                $effectiveDuplicateCount === 1 ? '' : 's'
            );
        }

        $invalidRuleCount = max(0, (int)($integrity['invalidAutoRules']['count'] ?? 0));
        if ($invalidRuleCount > 0) {
            return sprintf(
                '%d auto-assignment rule%s failed validation.',
                $invalidRuleCount,
                $invalidRuleCount === 1 ? '' : 's'
            );
        }

        $invalidRegexCount = max(0, (int)($integrity['invalidFolderRegex']['count'] ?? 0));
        if ($invalidRegexCount > 0) {
            return sprintf(
                '%d folder regex pattern%s failed validation.',
                $invalidRegexCount,
                $invalidRegexCount === 1 ? '' : 's'
            );
        }

        $invalidIconPathCount = max(0, (int)($integrity['invalidFolderIconPaths']['count'] ?? 0));
        if ($invalidIconPathCount > 0) {
            return sprintf(
                '%d folder icon path%s %s invalid.',
                $invalidIconPathCount,
                $invalidIconPathCount === 1 ? '' : 's',
                $invalidIconPathCount === 1 ? 'is' : 'are'
            );
        }

        $missingManualOrderIds = max(0, (int)($integrity['missingManualOrderIds']['count'] ?? 0));
        if ($missingManualOrderIds > 0) {
            return sprintf(
                '%d saved manual-order id%s no longer %s an existing folder.',
                $missingManualOrderIds,
                $missingManualOrderIds === 1 ? '' : 's',
                $missingManualOrderIds === 1 ? 'matches' : 'match'
            );
        }

        $missingPinnedFolderIds = max(0, (int)($integrity['missingPinnedFolderIds']['count'] ?? 0));
        if ($missingPinnedFolderIds > 0) {
            return sprintf(
                '%d pinned folder id%s no longer %s an existing folder.',
                $missingPinnedFolderIds,
                $missingPinnedFolderIds === 1 ? '' : 's',
                $missingPinnedFolderIds === 1 ? 'matches' : 'match'
            );
        }

        $duplicateNameCount = max(0, (int)($integrity['duplicateFolderNames']['count'] ?? 0));
        if ($duplicateNameCount > 0) {
            return sprintf(
                '%d duplicate folder name%s found.',
                $duplicateNameCount,
                $duplicateNameCount === 1 ? '' : 's'
            );
        }

        return '';
    }

    function diagnosticsFolderSettingBool(array $folder, string $key, bool $default = false): bool {
        $settings = is_array($folder['settings'] ?? null) ? $folder['settings'] : [];
        if (!array_key_exists($key, $settings)) {
            return $default;
        }
        return normalizeBool($settings[$key], $default);
    }

    function diagnosticsDockerStateFieldSource(array $item, string $field): string {
        $state = is_array($item['info']['State'] ?? null) ? $item['info']['State'] : [];
        if ($field === 'manager') {
            if (trim((string)($state['manager'] ?? '')) !== '') {
                return 'infoState';
            }
            if (trim((string)($item['manager'] ?? '')) !== '') {
                return 'topLevelFallback';
            }
            return 'missing';
        }
        if ($field === 'updated') {
            if (is_bool($state['Updated'] ?? null)) {
                return 'infoState';
            }
            if (is_bool($item['Updated'] ?? null)) {
                return 'topLevelFallback';
            }
            return 'missing';
        }
        return 'missing';
    }

    function diagnosticsDockerMemberRenderExpectations(?string $manager, ?bool $updated): array {
        $safeManager = trim((string)($manager ?? ''));
        if ($safeManager === 'composeman') {
            return [
                'statusToken' => 'compose',
                'action' => 'none',
                'actionRequiresAdvancedView' => false,
                'forceUpdateEligible' => false
            ];
        }
        if ($safeManager !== '' && $safeManager !== 'dockerman') {
            return [
                'statusToken' => 'thirdParty',
                'action' => 'none',
                'actionRequiresAdvancedView' => false,
                'forceUpdateEligible' => false
            ];
        }
        if ($safeManager === 'dockerman' && $updated === false) {
            return [
                'statusToken' => 'updateReady',
                'action' => 'applyUpdate',
                'actionRequiresAdvancedView' => false,
                'forceUpdateEligible' => false
            ];
        }
        return [
            'statusToken' => 'upToDate',
            'action' => 'forceUpdate',
            'actionRequiresAdvancedView' => true,
            'forceUpdateEligible' => true
        ];
    }

    function diagnosticsDockerFolderRenderExpectations(array $managerTypes, bool $upToDate, int $managedCount, bool $showUpdateBadge, bool $hideUpdateColumn): array {
        $safeManagerTypes = array_values(array_filter(array_map('strval', $managerTypes), static function ($value): bool {
            return trim($value) !== '';
        }));
        $safeManagerTypes = array_values(array_unique($safeManagerTypes));
        sort($safeManagerTypes);

        $hasDockerMan = in_array('dockerman', $safeManagerTypes, true);
        $hasCompose = in_array('composeman', $safeManagerTypes, true);
        $hasThirdParty = count(array_filter($safeManagerTypes, static function ($value): bool {
            return $value !== 'dockerman' && $value !== 'composeman';
        })) > 0;

        $statusToken = 'upToDate';
        $action = 'none';
        if (!$hasDockerMan && $hasCompose && $hasThirdParty) {
            $statusToken = 'composeAndThirdParty';
        } elseif (!$hasDockerMan && $hasCompose) {
            $statusToken = 'compose';
        } elseif (!$hasDockerMan) {
            $statusToken = 'thirdParty';
        } elseif (!$upToDate) {
            $statusToken = 'updateReady';
            $action = 'applyUpdate';
        } elseif ($managedCount > 0) {
            $action = 'forceUpdate';
        }

        return [
            'updateColumnVisible' => $showUpdateBadge && !$hideUpdateColumn,
            'statusToken' => $statusToken,
            'action' => $action,
            'actionRequiresAdvancedView' => in_array($action, ['applyUpdate', 'forceUpdate'], true),
            'forceUpdateEligible' => $action === 'forceUpdate',
            'managerTypes' => $safeManagerTypes
        ];
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

        $orphanedMemberCount = max(0, (int)($dockerIntegrity['orphanedMembers']['count'] ?? 0))
            + max(0, (int)($vmIntegrity['orphanedMembers']['count'] ?? 0));
        if ($orphanedMemberCount > 0) {
            $addAction(
                'repair_orphaned_members',
                'Remove orphaned member refs',
                'Saved folder members still reference Docker or VM items that no longer exist.'
            );
        }

        $prefsNeedCleanup = false;
        $metadataNeedsRepair = false;
        foreach ([$dockerIntegrity, $vmIntegrity] as $integrity) {
            $metadataNeedsRepair = $metadataNeedsRepair
                || ((int)($integrity['configurationMetadata']['issuesCount'] ?? 0)) > 0;
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
        if ($metadataNeedsRepair) {
            $addAction(
                'repair_config_metadata',
                'Rebuild configuration metadata',
                'Saved configuration fingerprints or revisions need to be reconciled.'
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
        if (((int)($customIcons['missingReferenceCount'] ?? 0)) > 0) {
            $addAction(
                'repair_missing_custom_icons',
                'Reset missing custom icon refs',
                'Some folders still point to uploaded icons that no longer exist.'
            );
        }

        return array_values($actions);
    }

    function diagnosticsBuildOverviewSummary(
        array $typesData,
        array $customIcons,
        array $update,
        array $runtimeIntegrity = [],
        array $securityAudit = []
    ): array {
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
            $primaryIssueDetail = $issueCount > 0 ? diagnosticsBuildIntegrityIssueDetail($integrity) : '';
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
                $issueCount > 0 && $primaryIssueDetail !== ''
                    ? $primaryIssueDetail
                    : sprintf('%d folder(s), %d rule(s), %d backup(s).', $folderCount, $ruleCount, $backupCount),
                ['count' => $issueCount]
            );
        }

        if (($runtimeIntegrity['status'] ?? 'unavailable') === 'critical') {
            $pathIssues[] = (string)($runtimeIntegrity['reason'] ?? 'Installed runtime integrity verification failed.');
        }
        if (($securityAudit['status'] ?? 'unavailable') === 'critical') {
            $pathIssues[] = 'The security audit chain failed integrity verification.';
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
                : (($runtimeIntegrity['status'] ?? 'unavailable') === 'healthy'
                    ? 'Folder maps, prefs, backups, and installed runtime files passed integrity checks.'
                    : 'Folder maps, prefs, and backups look readable and writable.'),
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

    function diagnosticsResolveSupportBundleChannel(): string {
        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $contents = (string)@file_get_contents($manifestPath);
            if ($contents === '') {
                continue;
            }
            if (preg_match('/<PLUGINURL>[^<]*\\/(dev|main)\\/folderview\\.plus\\.plg<\\/PLUGINURL>/i', $contents, $match)) {
                return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
            }
            if (preg_match('/<!ENTITY\\s+pluginURL\\s+"[^"]*\\/(dev|main)\\/folderview\\.plus\\.plg"\\s*>/i', $contents, $match)) {
                return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
            }
        }
        return 'main';
    }

    function diagnosticsReadSupportBundleBuildMetadata(): array {
        global $sourceDir;
        $metadataPath = rtrim((string)($sourceDir ?? ''), '/\\') . '/build-metadata.json';
        if ($metadataPath === '/build-metadata.json' || !is_file($metadataPath)) {
            return [];
        }
        $decoded = @json_decode((string)@file_get_contents($metadataPath), true);
        return is_array($decoded) ? $decoded : [];
    }

    function diagnosticsResolveSupportBundleManifestMetadata(): array {
        $manifestMetadata = [
            'manifestPath' => null,
            'manifestPathHash' => null,
            'manifestSha256' => null,
            'manifestMd5' => null,
            'manifestUrl' => null,
            'archiveUrl' => null,
            'iconAssetPackVersion' => null,
            'iconAssetPackSha256' => null,
            'iconAssetPackUrl' => null
        ];

        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $contents = (string)@file_get_contents($manifestPath);
            if ($contents === '') {
                continue;
            }
            $manifestMetadata['manifestPath'] = basename(str_replace('\\', '/', $manifestPath));
            $manifestMetadata['manifestPathHash'] = diagnosticsHashShort($manifestPath);
            $manifestMetadata['manifestSha256'] = @hash_file('sha256', $manifestPath) ?: null;
            $manifestEntities = [];
            if (preg_match('/<!ENTITY\s+md5\s+"([^"]+)"/i', $contents, $match)) {
                $manifestMetadata['manifestMd5'] = (string)($match[1] ?? '');
            }
            foreach (['name', 'version', 'github', 'pluginURL', 'iconPackVersion', 'iconPackSha256', 'iconPackURL'] as $entityKey) {
                if (preg_match('/<!ENTITY\s+' . preg_quote($entityKey, '/') . '\s+"([^"]+)"/i', $contents, $match)) {
                    $entityValue = html_entity_decode((string)($match[1] ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
                    if ($entityValue !== '') {
                        $manifestEntities[$entityKey] = $entityValue;
                    }
                }
            }
            if (preg_match('/<!ENTITY\s+github\s+"([^"]+)"/i', $contents, $match)) {
                $githubRepo = trim((string)($match[1] ?? ''));
                $manifestMetadata['githubRepository'] = $githubRepo !== '' ? $githubRepo : null;
            }
            if (preg_match('/<!ENTITY\s+pluginURL\s+"([^"]+)"/i', $contents, $match)) {
                $manifestMetadata['manifestUrl'] = html_entity_decode((string)($match[1] ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
            if (preg_match('/<URL>([^<]*\/archive\/[^<]*&version;\.txz)<\/URL>/i', $contents, $match)) {
                $manifestMetadata['archiveUrl'] = html_entity_decode((string)($match[1] ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
            $manifestMetadata['iconAssetPackVersion'] = trim((string)($manifestEntities['iconPackVersion'] ?? '')) ?: null;
            $manifestMetadata['iconAssetPackSha256'] = preg_match('/^[a-f0-9]{64}$/', (string)($manifestEntities['iconPackSha256'] ?? ''))
                ? (string)$manifestEntities['iconPackSha256']
                : null;
            $manifestMetadata['iconAssetPackUrl'] = trim((string)($manifestEntities['iconPackURL'] ?? '')) ?: null;
            if (!empty($manifestMetadata['githubRepository'])) {
                $githubEntity = (string)$manifestMetadata['githubRepository'];
                foreach (['manifestUrl', 'archiveUrl', 'iconAssetPackUrl'] as $urlKey) {
                    $urlValue = (string)($manifestMetadata[$urlKey] ?? '');
                    if ($urlValue !== '') {
                        $manifestMetadata[$urlKey] = str_replace('&github;', $githubEntity, $urlValue);
                    }
                }
            }
            if (!empty($manifestEntities)) {
                foreach (['manifestUrl', 'archiveUrl', 'iconAssetPackUrl'] as $urlKey) {
                    $urlValue = (string)($manifestMetadata[$urlKey] ?? '');
                    if ($urlValue === '') {
                        continue;
                    }
                    foreach ($manifestEntities as $entityKey => $entityValue) {
                        $urlValue = str_replace('&' . $entityKey . ';', (string)$entityValue, $urlValue);
                    }
                    $manifestMetadata[$urlKey] = $urlValue;
                }
            }
            break;
        }

        return $manifestMetadata;
    }

    function diagnosticsBuildSupportBundleBuildIdentitySection(array $diagnostics): array {
        $buildMetadata = diagnosticsReadSupportBundleBuildMetadata();
        $manifestMetadata = diagnosticsResolveSupportBundleManifestMetadata();
        $sourceCommitSha = trim((string)($buildMetadata['sourceCommitSha'] ?? ''));
        $headCommitSha = trim((string)($buildMetadata['headCommitSha'] ?? ''));
        $sourceTreeSha = trim((string)($buildMetadata['sourceTreeSha'] ?? ''));
        $sourceContentSha256 = trim((string)($buildMetadata['sourceContentSha256'] ?? ''));
        $sourceSnapshotMode = trim((string)($buildMetadata['sourceSnapshotMode'] ?? ''));
        $sourceCommitExact = array_key_exists('sourceCommitExact', $buildMetadata)
            ? filter_var($buildMetadata['sourceCommitExact'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;
        $sourceBranch = trim((string)($buildMetadata['sourceBranch'] ?? diagnosticsResolveSupportBundleChannel()));
        $buildManifestUrl = trim((string)($buildMetadata['manifestUrl'] ?? ''));
        $buildArchiveUrl = trim((string)($buildMetadata['archiveUrl'] ?? ''));
        $resolvedManifestUrl = trim((string)($manifestMetadata['manifestUrl'] ?? ''));
        $resolvedArchiveUrl = trim((string)($manifestMetadata['archiveUrl'] ?? ''));
        $manifestUrl = ($resolvedManifestUrl !== '' && strpos($resolvedManifestUrl, '&') === false)
            ? $resolvedManifestUrl
            : $buildManifestUrl;
        $archiveUrl = ($resolvedArchiveUrl !== '' && strpos($resolvedArchiveUrl, '&') === false)
            ? $resolvedArchiveUrl
            : $buildArchiveUrl;
        $sourceCommitIsExact = is_bool($sourceCommitExact) ? $sourceCommitExact : null;
        $buildBaseCommitSha = $sourceCommitIsExact === false && $headCommitSha !== '' ? $headCommitSha : null;
        $provenanceStatus = $sourceCommitIsExact === true
            ? 'exactCommit'
            : ($sourceSnapshotMode !== '' ? 'sourceSnapshot' : 'unknown');

        return [
            'pluginVersion' => (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'channel' => in_array($sourceBranch, ['dev', 'main'], true)
                ? $sourceBranch
                : diagnosticsResolveSupportBundleChannel(),
            'sourceBranch' => $sourceBranch !== '' ? $sourceBranch : null,
            'sourceCommitSha' => $sourceCommitSha !== '' ? $sourceCommitSha : null,
            'headCommitSha' => $headCommitSha !== '' ? $headCommitSha : null,
            'headCommitRole' => $sourceCommitIsExact === true
                ? 'sourceCommit'
                : ($sourceCommitIsExact === false ? 'buildBaseCommit' : 'unknown'),
            'buildBaseCommitSha' => $buildBaseCommitSha,
            'sourceTreeSha' => $sourceTreeSha !== '' ? $sourceTreeSha : null,
            'sourceContentSha256' => preg_match('/^[a-f0-9]{64}$/', $sourceContentSha256) ? $sourceContentSha256 : null,
            'sourceContentFingerprint' => preg_match('/^[a-f0-9]{64}$/', $sourceContentSha256)
                ? 'sha256:' . $sourceContentSha256
                : ($sourceTreeSha !== '' ? 'git-tree:' . $sourceTreeSha : null),
            'sourceSnapshotMode' => in_array($sourceSnapshotMode, ['content', 'head', 'index', 'worktree', 'fast-worktree', 'unknown'], true)
                ? $sourceSnapshotMode
                : null,
            'sourceCommitExact' => $sourceCommitIsExact,
            'provenanceStatus' => $provenanceStatus,
            'packageVersion' => trim((string)($buildMetadata['packageVersion'] ?? '')) ?: (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'manifestPath' => $manifestMetadata['manifestPath'] ?? null,
            'manifestPathHash' => $manifestMetadata['manifestPathHash'] ?? null,
            'manifestSha256' => $manifestMetadata['manifestSha256'] ?? null,
            'manifestMd5' => $manifestMetadata['manifestMd5'] ?? null,
            'archiveMd5' => $manifestMetadata['manifestMd5'] ?? null,
            'manifestUrl' => $manifestUrl !== '' ? $manifestUrl : null,
            'archiveUrl' => $archiveUrl !== '' ? $archiveUrl : null,
            'iconAssetPackVersion' => trim((string)($buildMetadata['iconAssetPackVersion'] ?? ($manifestMetadata['iconAssetPackVersion'] ?? ''))) ?: null,
            'iconAssetPackSha256' => preg_match('/^[a-f0-9]{64}$/', (string)($buildMetadata['iconAssetPackSha256'] ?? ($manifestMetadata['iconAssetPackSha256'] ?? '')))
                ? (string)($buildMetadata['iconAssetPackSha256'] ?? $manifestMetadata['iconAssetPackSha256'])
                : null,
            'iconAssetPackUrl' => trim((string)($manifestMetadata['iconAssetPackUrl'] ?? ($buildMetadata['iconAssetPackUrl'] ?? ''))) ?: null
        ];
    }

    function diagnosticsBuildSupportBundleMetaSection(array $diagnostics, array $redactor): array {
        $requestedLocale = fvplus_i18n_normalize_locale((string)($_SESSION['locale'] ?? 'en'));
        $localeResolution = fvplus_i18n_resolve_locale($requestedLocale);
        $catalogReport = fvplus_i18n_catalog_report();
        $localeCoverage = is_array($catalogReport['locales'] ?? null) ? $catalogReport['locales'] : [];
        return [
            'bundleType' => 'FolderViewPlusSupportBundle',
            'bundleVersion' => 2,
            'schemaVersion' => (int)($diagnostics['schemaVersion'] ?? 0),
            'generatedAt' => gmdate('c'),
            'traceId' => diagnosticsCurrentTraceId(),
            'transactionId' => diagnosticsCurrentTransactionId(),
            'pluginVersion' => (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'channel' => diagnosticsResolveSupportBundleChannel(),
            'privacyMode' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)),
            'redactionPolicyVersion' => 1,
            'bundleSaltScope' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)) === 'full' ? 'none' : 'per-bundle',
            'bundleSaltHash' => $redactor['saltFingerprint'] ?? null,
            'localization' => [
                'requestedLocale' => $requestedLocale,
                'resolvedLocale' => (string)($localeResolution['resolved'] ?? 'en'),
                'fallbackChain' => array_values(is_array($localeResolution['fallbackChain'] ?? null) ? $localeResolution['fallbackChain'] : [$requestedLocale, 'en']),
                'direction' => (string)($localeResolution['direction'] ?? 'ltr'),
                'catalogVersion' => FVPLUS_I18N_CATALOG_VERSION,
                'status' => (string)($localeResolution['status'] ?? 'source'),
                'requestedStatus' => (string)($localeResolution['requestedStatus'] ?? 'unregistered'),
                'sourceMessageCount' => (int)($catalogReport['sourceMessageCount'] ?? 0),
                'namespaceCount' => (int)($catalogReport['namespaceCount'] ?? 0),
                'extractionCandidateCount' => (int)($catalogReport['extraction']['candidateCount'] ?? 0),
                'autoBoundMessageCount' => (int)($catalogReport['extraction']['autoBoundMessageCount'] ?? 0),
                'localeCount' => count($localeCoverage),
                'activeLocaleCoverage' => is_array($localeCoverage[$localeResolution['resolved'] ?? 'en'] ?? null)
                    ? $localeCoverage[$localeResolution['resolved'] ?? 'en']
                    : null
            ],
            'buildIdentity' => diagnosticsBuildSupportBundleBuildIdentitySection($diagnostics)
        ];
    }

    function diagnosticsBuildSupportBundlePluginTypeSection(string $type, array $typeData, array $hashes, array &$redactor): array {
        $backupSchedule = is_array($typeData['backupSchedule'] ?? null) ? $typeData['backupSchedule'] : [];
        $lastBackup = is_array($typeData['lastBackup'] ?? null) ? $typeData['lastBackup'] : null;
        $folderPath = (string)($typeData['folderPath'] ?? '');
        $folderFileHash = is_array($hashes[$type . 'Folders'] ?? null) ? $hashes[$type . 'Folders'] : [];
        $prefsFileHash = is_array($hashes[$type . 'Prefs'] ?? null) ? $hashes[$type . 'Prefs'] : [];
        $configMetadata = is_array($typeData['configurationMetadata'] ?? null) ? $typeData['configurationMetadata'] : [];

        return [
            'configurationMetadata' => [
                'schemaVersion' => (int)($configMetadata['schemaVersion'] ?? 0),
                'type' => (string)($configMetadata['type'] ?? $type),
                'createdAt' => (string)($configMetadata['createdAt'] ?? ''),
                'updatedAt' => (string)($configMetadata['updatedAt'] ?? ''),
                'folderRevision' => (int)($configMetadata['folderRevision'] ?? 0),
                'prefsRevision' => (int)($configMetadata['prefsRevision'] ?? 0),
                'folderUpdatedAt' => (string)($configMetadata['folderUpdatedAt'] ?? ''),
                'prefsUpdatedAt' => (string)($configMetadata['prefsUpdatedAt'] ?? ''),
                'folderSha256' => (string)($configMetadata['folderSha256'] ?? ''),
                'prefsSha256' => (string)($configMetadata['prefsSha256'] ?? ''),
                'externalChangeCount' => (int)($configMetadata['externalChangeCount'] ?? 0),
                'lastExternalChangeAt' => (string)($configMetadata['lastExternalChangeAt'] ?? ''),
                'lastTraceId' => (string)($configMetadata['lastTraceId'] ?? ''),
                'lastTransactionId' => (string)($configMetadata['lastTransactionId'] ?? ''),
                'lastMutationAt' => (string)($configMetadata['lastMutationAt'] ?? '')
            ],
            'prefs' => [
                'sortMode' => (string)($typeData['sortMode'] ?? 'created'),
                'dashboard' => is_array($typeData['dashboard'] ?? null) ? $typeData['dashboard'] : [],
                'expandedFolderState' => diagnosticsSupportBundleRedactExpandedFolderState(
                    $redactor,
                    $type,
                    'pluginState.' . $type . '.prefs.expandedFolderState',
                    is_array($typeData['expandedFolderState'] ?? null) ? $typeData['expandedFolderState'] : []
                ),
                'pinnedFolders' => diagnosticsSupportBundleRedactFolderIdList(
                    $redactor,
                    $type,
                    'pluginState.' . $type . '.prefs.pinnedFolders.*',
                    is_array($typeData['pinnedFolderIds'] ?? null) ? $typeData['pinnedFolderIds'] : []
                ),
                'hideEmptyFolders' => (bool)($typeData['hideEmptyFolders'] ?? false),
                'appColumnWidth' => (string)($typeData['appColumnWidth'] ?? 'standard'),
                'setupWizardCompleted' => (bool)($typeData['setupWizardCompleted'] ?? false),
                'settingsMode' => (string)($typeData['settingsMode'] ?? 'basic'),
                'runtimePrefsSchema' => (int)($typeData['runtimePrefsSchema'] ?? 0),
                'liveRefreshEnabled' => (bool)($typeData['liveRefreshEnabled'] ?? false),
                'liveRefreshSeconds' => (int)($typeData['liveRefreshSeconds'] ?? 0),
                'performanceProfile' => (string)($typeData['performanceProfile'] ?? 'standard'),
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

    function diagnosticsBuildSupportBundleRuntimeEntityDetails(string $type, array $stateSnapshot, array &$redactor): array {
        $details = is_array($stateSnapshot['entityDetails'] ?? null) ? $stateSnapshot['entityDetails'] : [];
        $entries = [];
        $fieldPath = 'runtimeState.' . $type . '.entityDetails.entries.*';
        foreach (array_values(is_array($details['entries'] ?? null) ? $details['entries'] : []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $name = (string)($entry['name'] ?? '');
            $manager = trim((string)($entry['manager'] ?? ''));
            $updated = array_key_exists('updated', $entry) && is_bool($entry['updated']) ? (bool)$entry['updated'] : null;
            $entries[] = [
                'name' => diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.name', $name),
                'nameHash' => diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.nameHash', $name),
                'state' => in_array((string)($entry['state'] ?? ''), ['started', 'paused', 'stopped'], true)
                    ? (string)$entry['state']
                    : 'stopped',
                'assigned' => (bool)($entry['assigned'] ?? false),
                'manager' => $manager !== '' ? $manager : null,
                'managed' => (bool)($entry['managed'] ?? false),
                'updated' => $updated,
                'updateState' => in_array((string)($entry['updateState'] ?? ''), ['available', 'upToDate', 'unknown'], true)
                    ? (string)$entry['updateState']
                    : 'unknown',
                'provenance' => [
                    'managerSource' => in_array((string)($entry['provenance']['managerSource'] ?? ''), ['infoState', 'topLevelFallback', 'missing'], true)
                        ? (string)$entry['provenance']['managerSource']
                        : 'missing',
                    'updateSource' => in_array((string)($entry['provenance']['updateSource'] ?? ''), ['infoState', 'topLevelFallback', 'missing'], true)
                        ? (string)$entry['provenance']['updateSource']
                        : 'missing'
                ],
                'renderExpectations' => [
                    'statusToken' => in_array((string)($entry['renderExpectations']['statusToken'] ?? ''), ['compose', 'thirdParty', 'updateReady', 'upToDate', 'available', 'unknown'], true)
                        ? (string)$entry['renderExpectations']['statusToken']
                        : 'unknown',
                    'action' => in_array((string)($entry['renderExpectations']['action'] ?? ''), ['none', 'applyUpdate', 'forceUpdate'], true)
                        ? (string)$entry['renderExpectations']['action']
                        : 'none',
                    'actionRequiresAdvancedView' => array_key_exists('actionRequiresAdvancedView', (array)($entry['renderExpectations'] ?? []))
                        ? (bool)$entry['renderExpectations']['actionRequiresAdvancedView']
                        : ((string)($entry['renderExpectations']['action'] ?? '') === 'forceUpdate'),
                    'forceUpdateEligible' => (bool)($entry['renderExpectations']['forceUpdateEligible'] ?? false)
                ]
            ];
        }
        if ((bool)($details['truncated'] ?? false)) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', 'runtimeState.' . $type . '.entityDetails.entries');
        }
        return [
            'total' => (int)($details['total'] ?? count($entries)),
            'maxEntries' => (int)($details['maxEntries'] ?? count($entries)),
            'truncated' => (bool)($details['truncated'] ?? false),
            'managerCounts' => is_array($stateSnapshot['managerCounts'] ?? null) ? $stateSnapshot['managerCounts'] : [],
            'entries' => $entries
        ];
    }

    function diagnosticsBuildSupportBundleRuntimeTypeSection(string $type, array $typeData, array &$redactor): array {
        $stateSnapshot = is_array($typeData['stateSnapshot'] ?? null) ? $typeData['stateSnapshot'] : [];
        $folders = [];
        foreach (array_values(is_array($stateSnapshot['folders'] ?? null) ? $stateSnapshot['folders'] : []) as $index => $folder) {
            if (!is_array($folder)) {
                continue;
            }
            $fieldPath = 'runtimeState.' . $type . '.folderHierarchySummary.folders.*';
            $folderId = (string)($folder['folderId'] ?? '');
            $parentId = (string)($folder['parentId'] ?? '');
            $folderName = (string)($folder['folderName'] ?? '');
            $memberItems = array_values(is_array($folder['members']['items'] ?? null) ? $folder['members']['items'] : []);
            $folder['folderId'] = diagnosticsSupportBundleRedactFolderIdValue($redactor, $type, $fieldPath . '.folderId', $folderId);
            $folder['parentId'] = diagnosticsSupportBundleRedactFolderIdValue($redactor, $type, $fieldPath . '.parentId', $parentId);
            $folder['folderName'] = diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.folderName', $folderName);
            $folder['folderNameHash'] = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.folderNameHash', $folderName !== '' ? $folderName : $folderId);
            if (!isset($folder['members']) || !is_array($folder['members'])) {
                $folder['members'] = [];
            }
            $folder['settings'] = [
                'previewUpdate' => (bool)($folder['settings']['previewUpdate'] ?? false),
                'hideUpdateColumn' => (bool)($folder['settings']['hideUpdateColumn'] ?? false)
            ];
            if ($type === 'docker') {
                $folder['renderExpectations'] = [
                    'updateColumnVisible' => (bool)($folder['renderExpectations']['updateColumnVisible'] ?? false),
                    'statusToken' => in_array((string)($folder['renderExpectations']['statusToken'] ?? ''), ['compose', 'composeAndThirdParty', 'thirdParty', 'updateReady', 'upToDate'], true)
                        ? (string)$folder['renderExpectations']['statusToken']
                        : 'upToDate',
                    'action' => in_array((string)($folder['renderExpectations']['action'] ?? ''), ['none', 'applyUpdate', 'forceUpdate'], true)
                        ? (string)$folder['renderExpectations']['action']
                        : 'none',
                    'actionRequiresAdvancedView' => array_key_exists('actionRequiresAdvancedView', (array)($folder['renderExpectations'] ?? []))
                        ? (bool)$folder['renderExpectations']['actionRequiresAdvancedView']
                        : in_array((string)($folder['renderExpectations']['action'] ?? ''), ['applyUpdate', 'forceUpdate'], true),
                    'forceUpdateEligible' => (bool)($folder['renderExpectations']['forceUpdateEligible'] ?? false),
                    'managerTypes' => array_values(array_filter(array_map('strval', is_array($folder['renderExpectations']['managerTypes'] ?? null) ? $folder['renderExpectations']['managerTypes'] : []), static function ($value): bool {
                        return trim($value) !== '';
                    }))
                ];
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
            'runtimeSnapshotAvailable' => !empty($stateSnapshot),
            'snapshotSource' => 'serverDiagnostics',
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
            'entityDetails' => diagnosticsBuildSupportBundleRuntimeEntityDetails($type, $stateSnapshot, $redactor),
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
            'durableStorage' => is_array($diagnostics['durableStorage'] ?? null) ? $diagnostics['durableStorage'] : [],
            'runtimeIntegrity' => is_array($diagnostics['runtimeIntegrity'] ?? null) ? $diagnostics['runtimeIntegrity'] : [],
            'securityAudit' => is_array($diagnostics['securityAudit'] ?? null) ? $diagnostics['securityAudit'] : [],
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
                'traceId' => (string)($event['traceId'] ?? ''),
                'transactionId' => (string)($event['transactionId'] ?? ''),
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
            'recentActions' => diagnosticsBuildSupportBundleRecentActions(
                array_values(is_array($history['events'] ?? null) ? $history['events'] : []),
                $redactor,
                30
            ),
            'recentTimeline' => $timelineRows,
            'recentMutations' => [
                'retained' => (int)($history['retained'] ?? 0),
                'returned' => (int)($history['returned'] ?? 0),
                'events' => $historyEvents
            ],
            'update' => is_array($diagnostics['update'] ?? null) ? $diagnostics['update'] : [],
            'serverLogTail' => diagnosticsBuildSupportBundleServerLogTailSection($redactor)
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

    function getSupportBundlePreviewSnapshot(string $privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY): array {
        $mode = normalizeDiagnosticsPrivacyMode($privacyMode);
        return [
            'bundleMeta' => [
                'bundleType' => 'FolderViewPlusSupportBundle',
                'bundleVersion' => 2,
                'schemaVersion' => FVPLUS_DIAGNOSTICS_SCHEMA_VERSION,
                'generatedAt' => gmdate('c'),
                'traceId' => diagnosticsCurrentTraceId(),
                'transactionId' => diagnosticsCurrentTransactionId(),
                'pluginVersion' => readInstalledVersion(),
                'channel' => diagnosticsResolveSupportBundleChannel(),
                'privacyMode' => $mode,
                'redactionPolicyVersion' => 1,
                'bundleSaltScope' => $mode === 'full' ? 'none' : 'per-bundle',
                'previewOnly' => true
            ],
            // These contract placeholders make the preview useful without running
            // host discovery. Full data is collected only when an export is requested.
            'system' => ['previewOnly' => true],
            'pluginState' => ['previewOnly' => true],
            'runtimeState' => ['previewOnly' => true],
            'uiTelemetry' => ['previewOnly' => true],
            'healthAndHistory' => [
                'previewOnly' => true,
                'summary' => new stdClass(),
                'recentTimeline' => []
            ],
            'redactionManifest' => [
                'mode' => $mode,
                'saltScope' => $mode === 'full' ? 'none' : 'per-bundle',
                'saltHash' => null,
                'hashedFields' => [],
                'maskedFields' => [],
                'omittedFields' => [],
                'truncatedFields' => [],
                'previewOnly' => true
            ]
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
