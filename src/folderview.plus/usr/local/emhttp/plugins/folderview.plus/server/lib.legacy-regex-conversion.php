<?php
function legacyRegexMigrationLockPath(string $type): string {
    ensureType($type);
    return getConfigMutationLockPath();
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

        $result = withConfigMutationLock(static function () use ($type, $folderId, $expectedPattern): array {
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
            $probe = serverRuleRegex($legacyPattern, false);
            if (@preg_match($probe, '') === false) {
                throw new RuntimeException('The legacy regex is invalid and cannot be converted.');
            }
            // The browser treats these as literal escapes in legacy expressions,
            // while managed rules interpret them using the Unicode flag.
            if (preg_match('~(?<!\\\\)(?:\\\\\\\\)*\\\\(?:u|[pP])\{~', $legacyPattern)) {
                throw new RuntimeException('The legacy regex is not supported by managed rules and cannot be converted.');
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
                    && fvplusRuleUsesLegacyRegex($rule)
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
                    'regexMode' => 'legacy',
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

            $nextFolders = $folders;
            $nextFolders[$folderId]['regex'] = '';
            $nextPrefs = normalizeTypePrefs(reconcileManualOrderPrefs(array_replace($prefs, ['autoRules' => $rules]), $nextFolders));
            $before = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type, false));
            $backup = createBackupSnapshot($type, 'before-legacy-regex-conversion', false);

            try {
                $savedPrefs = writeTypePrefs($type, $nextPrefs);
                writeRawFolderMap($type, $nextFolders);
                if (jsonObjectsDiffer($nextFolders, readRawFolderMap($type)) || jsonObjectsDiffer($savedPrefs, readTypePrefs($type))) {
                    throw new RuntimeException('Legacy regex conversion did not complete.');
                }
            } catch (Throwable $writeError) {
                fvplusTransactionRestoreAfterFailure($before, $writeError, 'fvplusTransactionRestoreFiles');
                throw new RuntimeException('Legacy regex conversion failed; original data was restored.', 0, $writeError);
            }

            $backup['pruned'] = pruneBackupSnapshots($type, getTypeBackupRetention($type), [$backup['name']]);
            return [
                'type' => $type,
                'folderId' => $folderId,
                'pattern' => $legacyPattern,
                'created' => $created,
                'rule' => $existingRule,
                'prefs' => $savedPrefs,
                'folder' => $nextFolders[$folderId],
                'backup' => $backup
            ];
        });
        try {
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
