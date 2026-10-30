<?php
require_once __DIR__ . '/lib.backup-content.php';
require_once __DIR__ . '/lib.backup-schedule-state.php';
function getTypeBackupSchedule(string $type): array {
        $type = ensureType($type);
        $prefs = readTypePrefs($type);
        $schedule = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
        $normalized = [
            'enabled' => normalizeBool($schedule['enabled'] ?? true, true),
            'intervalHours' => normalizeIntInRange($schedule['intervalHours'] ?? 1, 1, 168, 1),
            'retention' => normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25),
            'lastRunAt' => '', 'lastStatus' => '', 'skipReason' => '', 'lastBackupAt' => ''
        ];
        return readBackupScheduleRuntime($type, $normalized);
    }

    function getTypeBackupRetention(string $type): int {
        $schedule = getTypeBackupSchedule($type);
        return normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25);
    }

    function maybeRunScheduledBackup(string $type): void {
        static $running = [];
        $type = ensureType($type);
        if (isset($running[$type])) {
            return;
        }

        $running[$type] = true;
        try { withConfigMutationLock(static function () use ($type): void {
            $schedule = getTypeBackupSchedule($type);
            if (($schedule['enabled'] ?? false) !== true) {
                return;
            }
            $intervalHours = normalizeIntInRange($schedule['intervalHours'] ?? 1, 1, 168, 1);
            $now = time();
            $lastRun = strtotime((string)($schedule['lastRunAt'] ?? '')) ?: 0;
            $intervalSeconds = $intervalHours * 3600;
            if ($lastRun > 0 && $lastRun <= $now && ($now - $lastRun) < $intervalSeconds) {
                return;
            }

            $folders = readRawFolderMap($type);
            if (count($folders) === 0) {
                $result = ['skipped' => true, 'skipReason' => 'empty-folder-map', 'count' => 0];
            } else {
                $latest = latestBackupConfiguration($type);
                if ($latest !== null && hash_equals($latest['fingerprint'], backupConfigurationFingerprint($folders, readTypePrefs($type)))) {
                    $result = [...$latest, 'skipped' => true, 'skipReason' => 'unchanged-config'];
                } else {
                    $result = createBackupSnapshot($type, 'scheduled');
                }
            }
            recordBackupScheduleCheck($type, $schedule, $result, $now);
        });
        } catch (Throwable $error) {
            try { appendDiagnosticsHistoryEvent('backup_schedule_run', $type, ['failureReason' => 'backup-check-failed'], 'error', 'scheduler'); }
            catch (Throwable $historyError) { /* Preserve the original failure. */ }
            throw $error;
        } finally {
            unset($running[$type]);
        }
    }

    function runScheduledBackups(?string $type = null): array {
        $results = [];
        if ($type !== null && $type !== '') {
            $resolvedType = ensureType($type);
            maybeRunScheduledBackup($resolvedType);
            $results[$resolvedType] = getTypeBackupSchedule($resolvedType);
            return $results;
        }
        foreach (FVPLUS_ALLOWED_TYPES as $resolvedType) {
            maybeRunScheduledBackup($resolvedType);
            $results[$resolvedType] = getTypeBackupSchedule($resolvedType);
        }
        return $results;
    }

    function getBackupsDirPath(): string {
        global $configDir;
        return "$configDir/backups";
    }

    require_once __DIR__ . '/lib.global-rollback.php';
