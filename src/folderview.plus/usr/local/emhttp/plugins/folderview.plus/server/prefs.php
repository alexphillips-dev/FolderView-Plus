<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
        return [
            'prefs' => readTypePrefs($type),
            'metadata' => readConfigMetadata($type, true)
        ];
    }

    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));

    $incoming = $_POST['prefs'] ?? null;
    $decoded = [];
    if (is_string($incoming) && trim($incoming) !== '') {
        $parsed = json_decode($incoming, true);
        if (!is_array($parsed)) {
            throw new RuntimeException('Invalid prefs payload: expected JSON object.');
        }
        $decoded = $parsed;
    } elseif (is_array($incoming)) {
        $decoded = $incoming;
    }
    fvplus_assert_prefs_payload_shape($decoded);
    assertExpectedConfigRevision($type, 'prefs', $_POST['expectedRevision'] ?? '');
    $clientMutationId = trim((string)($_POST['clientMutationId'] ?? ''));
    if ($clientMutationId !== '' && !preg_match('/^[a-zA-Z0-9._:-]{1,96}$/', $clientMutationId)) {
        throw new RuntimeException('Invalid client mutation id.');
    }

    $current = readTypePrefs($type);
    $next = normalizeTypePrefs(mergeTypePrefsPatch($current, $decoded));
    $backup = null;
    $currentJson = json_encode(normalizeTypePrefs($current), JSON_UNESCAPED_SLASHES);
    $nextJson = json_encode($next, JSON_UNESCAPED_SLASHES);
    $configChanged = $currentJson !== $nextJson;
    $backupRequired = $configChanged && prefsPatchRequiresSafetyBackup($decoded, $current, $next);
    if ($backupRequired) {
        $backup = createCoalescedPrefsBackupSnapshot($type);
    }

    $saved = $configChanged ? writeTypePrefs($type, $next) : normalizeTypePrefs($current);
    $orderPrefsChanged = $configChanged && (
        (string)($current['sortMode'] ?? 'created') !== (string)($saved['sortMode'] ?? 'created')
        || normalizeStringIdList($current['manualOrder'] ?? []) !== normalizeStringIdList($saved['manualOrder'] ?? [])
        || normalizeStringIdList($current['pinnedFolderIds'] ?? []) !== normalizeStringIdList($saved['pinnedFolderIds'] ?? [])
        || normalizeStringIdList($current['hiddenFolderIds'] ?? []) !== normalizeStringIdList($saved['hiddenFolderIds'] ?? [])
    );
    if ($orderPrefsChanged) {
        syncManualOrderWithFolders($type, readRawFolderMap($type));
        $saved = readTypePrefs($type);
    }
    $metadata = readConfigMetadata($type, false);
    $dockerOrderChanged = $type === 'docker' && (
        (string)($current['sortMode'] ?? 'created') !== (string)($saved['sortMode'] ?? 'created')
        || normalizeStringIdList($current['manualOrder'] ?? []) !== normalizeStringIdList($saved['manualOrder'] ?? [])
        || normalizeStringIdList($current['pinnedFolderIds'] ?? []) !== normalizeStringIdList($saved['pinnedFolderIds'] ?? [])
        || json_encode(normalizeDockerStartOrderPrefs($current['dockerStartOrder'] ?? []), JSON_UNESCAPED_SLASHES) !== json_encode(normalizeDockerStartOrderPrefs($saved['dockerStartOrder'] ?? []), JSON_UNESCAPED_SLASHES)
    );
    if ($dockerOrderChanged) {
        syncContainerOrder('docker');
    }
    $auditRecorded = false;
    if ($configChanged && ($backupRequired || $orderPrefsChanged || $dockerOrderChanged)) {
        try {
            appendDiagnosticsHistoryEvent('prefs_update', $type, [
                'traceId' => getRequestTraceId(),
                'clientMutationId' => $clientMutationId,
                'patchFieldCount' => count($decoded),
                'configChanged' => true,
                'backupRequired' => $backupRequired,
                'backupCreated' => is_array($backup) && !($backup['coalesced'] ?? false),
                'backupCoalesced' => (bool)($backup['coalesced'] ?? false),
                'sortMode' => (string)($saved['sortMode'] ?? 'created'),
                'ruleCount' => count($saved['autoRules'] ?? []),
                'pinnedFolderCount' => count($saved['pinnedFolderIds'] ?? []),
                'hiddenFolderCount' => count($saved['hiddenFolderIds'] ?? [])
            ], 'ok', 'server');
            $auditRecorded = true;
        } catch (Throwable $err) {
            // Non-fatal.
        }
    }

    return [
        'prefs' => $saved,
        'backup' => $backup,
        'metadata' => $metadata,
        'clientMutationId' => $clientMutationId,
        'configChanged' => $configChanged,
        'backupRequired' => $backupRequired,
        'auditRecorded' => $auditRecorded,
        'backupCoalesced' => (bool)($backup['coalesced'] ?? false)
    ];
});
