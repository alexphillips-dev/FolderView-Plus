<?php
function fvplusRepairMissingCustomIconReferences(): array {
    return fvplusWithCustomIconStorageLock(true, static function (): array {
        $customIconDir = fvplusCustomIconDirPath();
        $existingIcons = [];
        if (is_dir($customIconDir)) {
            $entries = @scandir($customIconDir);
            if (!is_array($entries)) throw new RuntimeException('Icon references could not be verified. Reload Settings and try again.');
            foreach ($entries as $name) {
                if ($name === basename($name) && is_file($customIconDir . '/' . $name)
                    && in_array(strtolower((string)pathinfo($name, PATHINFO_EXTENSION)), fvplusAllowedCustomIconExtensions(), true)) {
                    $existingIcons[$name] = true;
                }
            }
        }
        $paths = array_merge(fvplusTypeTransactionPaths('docker', false), fvplusTypeTransactionPaths('vm', false));
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $templatePath = getTemplatePath($type);
            array_push($paths, $templatePath, getLastGoodJsonPath($templatePath));
        }
        $snapshots = fvplusEnvironmentCaptureFiles($paths);
        $repaired = []; $missing = []; $backups = []; $typeCounts = ['docker' => 0, 'vm' => 0];
        try {
            foreach (['docker', 'vm'] as $type) {
                $folders = readRawFolderMap($type);
                $storedPrefs = readJsonObjectFile(getTypePrefsPath($type));
                $prefs = $storedPrefs === null ? readTypePrefs($type)
                    : (migrateLegacyTypeDataIfNeeded($type, 'prefs', $storedPrefs) ?? $storedPrefs);
                $originalTemplates = readFolderTemplates($type, requireAvailable: true, normalize: false);
                $templates = $originalTemplates;
                $changed = [];
                fvplusVisitCustomIconReferences($type, $folders, $prefs, $templates,
                    static function (string $name, array $reference, array &$record) use (&$repaired, &$missing,
                        &$typeCounts, &$changed, $existingIcons, $type): void {
                        if (isset($existingIcons[$name])) return;
                        $record['icon'] = '';
                        $repaired[] = array_merge($reference, ['missingIcon' => $name]);
                        $missing[$name] = true; $typeCounts[$type]++;
                        $changed[$reference['scope']] = true;
                    });
                if ($changed === []) continue;
                $backupOptions = isset($changed['template']) ? ['templateRecords' => $originalTemplates] : [];
                $backups[$type] = createBackupSnapshot($type, 'before-repair-missing-custom-icons', false, $backupOptions);
                if (isset($changed['folder'])) writeRawFolderMap($type, $folders);
                if (isset($changed['defaults']) || isset($changed['group'])) writeTypePrefs($type, $prefs);
                if (isset($changed['template'])) fvplusWriteBackupTemplateRecords($type, $templates);
            }
        } catch (Throwable $error) {
            fvplusTransactionRestoreAfterFailure($snapshots, $error, 'fvplusEnvironmentRestoreFiles');
            throw $error;
        }
        foreach ($typeCounts as $type => $count) {
            if (!$count) continue;
            pruneBackupSnapshots($type, getTypeBackupRetention($type), [$backups[$type]['name']]);
            try {
                appendDiagnosticsHistoryEvent('repair_missing_custom_icons', $type,
                    ['repairedFolderCount' => $count, 'missingIconCount' => count($missing)], 'ok', 'server');
            } catch (Throwable $error) { /* Optional history must not change a committed repair. */ }
        }
        return ['customIconDir' => $customIconDir, 'repairedFolderCount' => count($repaired),
            'missingIconCount' => count($missing), 'missingIcons' => array_keys($missing),
            'repairedFolders' => $repaired, 'typeCounts' => $typeCounts];
    });
}
