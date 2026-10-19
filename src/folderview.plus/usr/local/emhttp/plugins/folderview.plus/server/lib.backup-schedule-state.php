<?php
function backupScheduleStatePath(): string {
    global $sourceDir;
    // /usr/local is RAM-backed on Unraid. Tests use their isolated source directory.
    return "$sourceDir/.backup-schedule-state.json";
}

function readBackupScheduleState(): array {
    $state = readJsonObjectFile(backupScheduleStatePath()) ?? [];
    return ['types' => is_array($state['types'] ?? null) ? $state['types'] : [], 'events' => is_array($state['events'] ?? null) ? $state['events'] : []];
}

function backupScheduleSettingsFingerprint(array $schedule): string {
    return hash('sha256', json_encode([$schedule['enabled'], $schedule['intervalHours'], $schedule['retention']]));
}

function readBackupScheduleRuntime(string $type, array $schedule): array {
    $runtime = readBackupScheduleState()['types'][$type] ?? [];
    if (($runtime['settingsFingerprint'] ?? '') === backupScheduleSettingsFingerprint($schedule)) {
        foreach (['lastRunAt', 'lastStatus', 'skipReason'] as $key) $schedule[$key] = (string)($runtime[$key] ?? '');
        $name = (string)($runtime['backupName'] ?? '');
        try {
            if ($name !== '' && is_file(getBackupSnapshotPath($type, $name))) $schedule['lastBackupAt'] = (string)($runtime['lastBackupAt'] ?? '');
        } catch (Throwable $error) { /* Invalid volatile state cannot establish backup coverage. */ }
    }
    return $schedule;
}

function backupScheduleCoverageAge(array $schedule, ?array $backup, int $now, ?int $ageHours): ?int {
    $verified = $backup && ($schedule['lastBackupAt'] ?? '') === ($backup['createdAt'] ?? '')
        && in_array($schedule['lastStatus'] ?? '', ['ok', 'skipped'], true);
    $checked = $verified ? strtotime((string)($schedule['lastRunAt'] ?? '')) : false;
    return $checked !== false && $checked <= $now ? max(0, (int)floor(($now - $checked) / 3600)) : $ageHours;
}

function recordBackupScheduleCheck(string $type, array $schedule, array $result, int $now): void {
    $state = readBackupScheduleState();
    $skipped = ($result['skipped'] ?? false) === true;
    $status = $skipped ? 'skipped' : 'ok';
    $skipReason = (string)($result['skipReason'] ?? '');
    $name = (string)($result['name'] ?? '');
    $backupAt = $name !== '' ? gmdate('c', (int)filemtime(getBackupSnapshotPath($type, $name))) : '';
    $state['types'][$type] = [
        'lastRunAt' => gmdate('c', $now), 'lastStatus' => $status, 'skipReason' => $skipReason,
        'settingsFingerprint' => backupScheduleSettingsFingerprint($schedule),
        'backupName' => $name, 'lastBackupAt' => $backupAt
    ];
    $state['events'][] = [
        'id' => generateId(16), 'timestamp' => gmdate('c', $now), 'action' => 'backup_schedule_run',
        'type' => $type, 'status' => $status, 'source' => 'scheduler',
        'traceId' => diagnosticsCurrentTraceId(), 'transactionId' => diagnosticsCurrentTransactionId(),
        'details' => ['intervalHours' => $schedule['intervalHours'], 'retention' => $schedule['retention'],
            'folderCount' => (int)($result['count'] ?? 0), 'skipReason' => $skipReason,
            'lastBackupAt' => $backupAt, 'historyStorage' => 'memory']
    ];
    $state['events'] = array_slice($state['events'], -FVPLUS_DIAGNOSTICS_HISTORY_MAX);
    writeJsonObjectAtomic(backupScheduleStatePath(), $state);
}

function backupScheduleHistoryEvents(): array {
    $events = readBackupScheduleState()['events'] ?? [];
    return is_array($events) ? $events : [];
}
