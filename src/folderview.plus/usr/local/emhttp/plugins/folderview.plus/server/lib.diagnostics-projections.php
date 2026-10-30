<?php
    function diagnosticsSupportBundleEventLabel(string $value, string $kind, string $fieldPath, array &$redactor): string {
        if (($redactor['mode'] ?? 'sanitized') === 'full' || $value === '') return $value;
        $allowed = [
            'action' => ['backup_download', 'environment_export', 'environment_import', 'backup_restore',
                'backup_schedule_run', 'rollback_create', 'rollback_restore', 'backup_skipped', 'backup_create',
                'backup_delete', 'backup_delete_all', 'folder_create', 'create_folder', 'folder_update',
                'folder_batch_mutation', 'member_identity_reconcile', 'folder_delete', 'legacy_regex_conversion',
                'folder_batch_assignment', 'folder_settings_apply', 'folderview3_preview', 'folderview3_migration',
                'reorder', 'runtime_bulk_action', 'template_create', 'template_delete', 'template_apply', 'prefs_update',
                'icon_upload', 'icon_delete', 'icon_rename', 'conflict_scan', 'diagnostics_export', 'support_bundle_export',
                'bulk_assign', 'export_download_missing', 'export', 'import_dry_run', 'import', 'delete_folder',
                'clear_folders', 'rule_simulator', 'rule_preview_apply', 'theme_resolver_apply'],
            'type' => ['docker', 'vm'],
            'status' => ['ok', 'warn', 'warning', 'error', 'skipped'],
            'source' => ['server', 'ui', 'scheduler', 'icon-upload', 'runtime']
        ];
        if (in_array($value, $allowed[$kind] ?? [], true)) return $value;
        return 'redacted-' . diagnosticsSupportBundleHashValue($redactor, $fieldPath, $value);
    }

    function diagnosticsSupportBundleRedactEventDetails($value, string $fieldPath, array &$redactor, int $depth = 0) {
        if (($redactor['mode'] ?? 'sanitized') === 'full') return $value;
        if ($depth > 6) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', $fieldPath);
            return null;
        }
        if (!is_array($value)) {
            if (is_string($value)) {
                return diagnosticsSupportBundleHashValue($redactor, $fieldPath, $value);
            }
            return $value;
        }

        // Fields emitted by repository history producers. Unknown client details are omitted.
        // A recognized enum key does not make arbitrary values safe to publish.
        $enums = [
            'type' => ['docker', 'vm'],
            'phase' => ['validation', 'stale-preview', 'capture', 'writing', 'verification', 'verified'],
            'outcome' => ['validation-rejected', 'stale-preview', 'capture-failed', 'write-failed', 'verification-failed', 'applied'],
            'rollback' => ['not-needed', 'complete', 'failed'],
            'sourcekind' => ['installed', 'export'],
            'operation' => ['preview', 'apply'],
            'sortmode' => ['created', 'alpha', 'manual'],
            'action' => ['start', 'stop', 'pause', 'resume', 'restart', 'update', 'force_update'],
            'mode' => ['post_nonce', 'replace', 'skip', 'rename'],
            'result' => ['uploaded', 'replaced', 'skipped', 'deduplicated'],
            'historystorage' => ['memory'],
            'skipreason' => ['unchanged-config', 'empty-folder-map'],
            'failurereason' => ['backup-check-failed']
        ];
        $scalars = [
            'foldercount', 'itemcount', 'dockercount', 'vmcount', 'managedthemecount', 'warningcount',
            'prunedcount', 'deletedcount', 'failedcount', 'requestedcount', 'updatedcount', 'createdcount',
            'renamecount', 'identitycount', 'targetcount', 'unchangedcount', 'targetfoldercount',
            'assignedcount', 'skippedinvalidcount', 'changedfoldercount', 'durationms', 'patchfieldcount',
            'rulecount', 'pinnedfoldercount', 'hiddenfoldercount', 'requested', 'executed', 'succeeded',
            'failed', 'skipped', 'count', 'total', 'bytes', 'size', 'width', 'height',
            'verified', 'checkpointavailable', 'nativeautostartrequested', 'nativeautostartincluded',
            'configchanged', 'backuprequired', 'backupcreated', 'backupcoalesced', 'prefsrestored',
            'optimized', 'created', 'force', 'reconciled'
        ];
        $containers = ['details', 'items', 'folderids', 'categories', 'renames'];
        $private = [
            'name', 'foldername', 'sourcename', 'folderid', 'parentid', 'ruleid', 'templateid', 'templatename',
            'item', 'hostname', 'host', 'url', 'uri', 'useragent', 'traceid', 'transactionid', 'clientmutationid',
            'from', 'to', 'message', 'hash', 'originalname', 'path', 'folderpath', 'prefspath',
            'ip', 'clientip', 'address', 'reason', 'sourcescript', 'lastbackupat'
        ];
        $sanitized = [];
        $isList = array_is_list($value);
        foreach ($value as $key => $entry) {
            $key = (string)$key;
            $lowerKey = strtolower($key);
            $listEntry = $isList && ctype_digit($key);
            if (!$listEntry && !isset($enums[$lowerKey]) && !in_array($lowerKey, $scalars, true)
                && !in_array($lowerKey, $containers, true) && !in_array($lowerKey, $private, true)) {
                diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', $fieldPath . '.*');
                continue;
            }
            $entryPath = $fieldPath . '.' . ($listEntry ? '*' : $key);
            if (is_array($entry)) {
                $sanitized[$key] = diagnosticsSupportBundleRedactEventDetails($entry, $entryPath, $redactor, $depth + 1);
                continue;
            }
            if (in_array($lowerKey, $private, true) && $entry !== null && !is_string($entry)) {
                $sanitized[$key . 'Hash'] = diagnosticsSupportBundleHashValue($redactor, $entryPath . 'Hash', (string)$entry);
                $sanitized[$key] = diagnosticsSupportBundleRedactScalar($redactor, $entryPath, $entry);
                continue;
            }
            if (!is_string($entry)) {
                $sanitized[$key] = $entry;
                continue;
            }
            if (isset($enums[$lowerKey]) && in_array($entry, $enums[$lowerKey], true)) {
                $sanitized[$key] = $entry;
                continue;
            }
            if ($listEntry) {
                $sanitized[$key] = diagnosticsSupportBundleHashValue($redactor, $entryPath, $entry);
                continue;
            }
            $sanitized[$key . 'Hash'] = diagnosticsSupportBundleHashValue($redactor, $entryPath . 'Hash', $entry);
            $sanitized[$key] = in_array($lowerKey, ['ip', 'clientip', 'address'], true)
                ? diagnosticsSupportBundleMaskIpValue($redactor, $entryPath, $entry)
                : diagnosticsSupportBundleRedactScalar($redactor, $entryPath, $entry);
        }
        return $sanitized;
    }

    function diagnosticsSupportBundleRedactMissingIcons(array $customIcons, array &$redactor): array {
        if (($redactor['mode'] ?? 'sanitized') === 'full') return $customIcons['missingReferencedIcons'] ?? [];
        $missingIcons = [];
        foreach (array_values(is_array($customIcons['missingReferencedIcons'] ?? null) ? $customIcons['missingReferencedIcons'] : []) as $missingIcon) {
            if (!is_array($missingIcon)) continue;
            $iconPath = 'system.pathHealth.customIcons.missingReferencedIcons.*';
            $references = [];
            foreach (array_values(is_array($missingIcon['references'] ?? null) ? $missingIcon['references'] : []) as $reference) {
                if (!is_array($reference)) continue;
                $type = in_array($reference['type'] ?? '', ['docker', 'vm'], true) ? $reference['type'] : '';
                $name = (string)($reference['folderName'] ?? '');
                $references[] = [
                    'type' => $type,
                    'folderId' => diagnosticsSupportBundleRedactFolderIdValue($redactor, $type, $iconPath . '.references.*.folderId', (string)($reference['folderId'] ?? '')),
                    'folderName' => diagnosticsSupportBundleRedactScalar($redactor, $iconPath . '.references.*.folderName', $name),
                    'folderNameHash' => diagnosticsSupportBundleHashValue($redactor, $iconPath . '.references.*.folderNameHash', $name)
                ];
            }
            $name = (string)($missingIcon['name'] ?? '');
            $missingIcons[] = [
                'name' => diagnosticsSupportBundleRedactScalar($redactor, $iconPath . '.name', $name),
                'nameHash' => diagnosticsSupportBundleHashValue($redactor, $iconPath . '.nameHash', $name),
                'referenceCount' => (int)($missingIcon['referenceCount'] ?? 0),
                'references' => $references
            ];
        }
        return $missingIcons;
    }
