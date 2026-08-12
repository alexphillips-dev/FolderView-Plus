<?php
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
