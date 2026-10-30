<?php
function legacyRegexMigrationLockPath(string $type): string {
        global $configDir;
        $type = ensureType($type);
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/' . $type . '-legacy-regex-migration.lock';
    }

    function migrateLegacyRegexToAutoRule(string $type, string $folderId, string $expectedPattern): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        $expectedPattern = (string)$expectedPattern;
        if ($folderId === '') {
            throw new RuntimeException('Folder ID is required.');
        }
        if ($expectedPattern === '') {
            throw new RuntimeException('Legacy regex pattern is required.');
        }

        $lockHandle = @fopen(legacyRegexMigrationLockPath($type), 'c+');
        if (!is_resource($lockHandle) || !@flock($lockHandle, LOCK_EX)) {
            if (is_resource($lockHandle)) {
                @fclose($lockHandle);
            }
            throw new RuntimeException('Legacy regex conversion is busy. Try again.');
        }

        $result = null;
        try {
            $folders = readRawFolderMap($type);
            if (!array_key_exists($folderId, $folders) || !is_array($folders[$folderId])) {
                throw new RuntimeException('Folder not found.');
            }
            $legacyPattern = (string)($folders[$folderId]['regex'] ?? '');
            if ($legacyPattern === '') {
                throw new RuntimeException('This folder no longer has a legacy regex to convert.');
            }
            if (!hash_equals($legacyPattern, $expectedPattern)) {
                throw new RuntimeException('The legacy regex changed after this editor loaded. Reload and review it before converting.');
            }
            $probe = '/' . str_replace('/', '\\/', $legacyPattern) . '/';
            if (@preg_match($probe, '') === false) {
                throw new RuntimeException('The legacy regex is invalid and cannot be converted.');
            }

            $prefs = readTypePrefs($type);
            $rules = is_array($prefs['autoRules'] ?? null) ? array_values($prefs['autoRules']) : [];
            $existingRule = null;
            foreach ($rules as $rule) {
                if (!is_array($rule)) {
                    continue;
                }
                if (
                    (string)($rule['folderId'] ?? '') === $folderId
                    && normalizeBool($rule['enabled'] ?? true, true) === true
                    && (string)($rule['effect'] ?? 'include') === 'include'
                    && (string)($rule['kind'] ?? 'name_regex') === 'name_regex'
                    && (string)($rule['pattern'] ?? '') === $legacyPattern
                ) {
                    $existingRule = $rule;
                    break;
                }
            }

            $created = false;
            if ($existingRule === null) {
                $existingRule = [
                    'id' => 'rule-' . gmdate('YmdHis') . '-' . generateId(8),
                    'enabled' => true,
                    'folderId' => $folderId,
                    'effect' => 'include',
                    'kind' => 'name_regex',
                    'pattern' => $legacyPattern,
                    'labelKey' => '',
                    'labelValue' => ''
                ];
                // Converted legacy matching is a fallback. Existing advanced policy keeps priority.
                $rules[] = $existingRule;
                $created = true;
            }

            $managedProgram = fvplusCompileRuleSet([$existingRule], $type, $folders);
            if (count($managedProgram['issues']) > 0 || count($managedProgram['compiled']) !== 1) {
                throw new RuntimeException('The legacy regex is not supported by managed rules and cannot be converted.');
            }

            $nextPrefs = normalizeTypePrefs(array_merge($prefs, ['autoRules' => $rules]));
            $nextFolders = $folders;
            $nextFolders[$folderId]['regex'] = '';
            $backup = createBackupSnapshot($type, 'before-legacy-regex-conversion');

            try {
                $savedPrefs = writeTypePrefs($type, $nextPrefs);
                writeRawFolderMap($type, $nextFolders);
            } catch (Throwable $writeError) {
                try {
                    writeTypePrefs($type, $prefs);
                    writeRawFolderMap($type, $folders);
                } catch (Throwable $rollbackError) {
                    throw new RuntimeException(
                        'Legacy regex conversion failed and rollback also failed: ' . $rollbackError->getMessage(),
                        0,
                        $writeError
                    );
                }
                throw new RuntimeException('Legacy regex conversion failed; original data was restored.', 0, $writeError);
            }

            $result = [
                'type' => $type,
                'folderId' => $folderId,
                'pattern' => $legacyPattern,
                'created' => $created,
                'rule' => $existingRule,
                'prefs' => $savedPrefs,
                'folder' => $nextFolders[$folderId],
                'backup' => $backup
            ];
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }

        if (!is_array($result)) {
            throw new RuntimeException('Legacy regex conversion did not complete.');
        }
        try {
            syncManualOrderWithFolders($type, readRawFolderMap($type));
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
        } catch (Throwable $error) {
            // The conversion is already committed; a later refresh can safely reconcile order.
        }
        try {
            appendDiagnosticsHistoryEvent('legacy_regex_conversion', $type, [
                'traceId' => getRequestTraceId(),
                'folderId' => $folderId,
                'ruleId' => (string)($result['rule']['id'] ?? ''),
                'created' => (bool)($result['created'] ?? false),
                'backupCreated' => is_array($result['backup'] ?? null)
            ], 'ok', 'server');
        } catch (Throwable $error) {
            // Diagnostics are non-fatal after the transactional conversion succeeds.
        }
        return $result;
    }
