<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
        return withConfigMutationLock(static function () use ($type): array {
            $prefs = readTypePrefs($type);
            $metadata = readConfigMetadata($type, true);
            unset($metadata['prefsMutationReceipt']);
            return fvplusJsonTypeConfig([
                'prefs' => $prefs,
                'metadata' => $metadata
            ]);
        });
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
    if (array_key_exists('hiddenFolderIdChanges', $decoded)) {
        $visibilityChanges = $decoded['hiddenFolderIdChanges'];
        if ($type !== 'docker' || !is_array($visibilityChanges) || count($visibilityChanges) > 10000) {
            throw new RuntimeException("Invalid prefs payload: 'hiddenFolderIdChanges' must be a Docker folder visibility map.");
        }
        foreach ($visibilityChanges as $id => $hidden) {
            if ((string)$id === '' || normalizeFolderIdValue($id) !== (string)$id || !is_bool($hidden)) {
                throw new RuntimeException("Invalid prefs payload: 'hiddenFolderIdChanges' must use valid folder IDs and boolean values.");
            }
        }
    }
    $expectedRevision = (string)($_POST['expectedRevision'] ?? '');
    $clientMutationId = trim((string)($_POST['clientMutationId'] ?? ''));
    if ($clientMutationId !== '' && !preg_match('/^[a-zA-Z0-9._:-]{1,96}$/', $clientMutationId)) {
        throw new RuntimeException('Invalid client mutation id.');
    }
    $token = getConfiguredRequestToken();
    $receipt = $clientMutationId !== '' && ctype_digit($expectedRevision) && $token !== ''
        ? hash_hmac('sha256', json_encode([$type, $clientMutationId, (int)$expectedRevision, $decoded], JSON_THROW_ON_ERROR), $token)
        : '';
    try {
        assertExpectedConfigRevision($type, 'prefs', $expectedRevision);
    } catch (FVPlusConfigConflictException $error) {
        $committed = readConfigMetadata($type, false);
        if ($receipt === '' || (int)$expectedRevision + 1 !== $committed['prefsRevision']
            || !hash_equals($committed['prefsMutationReceipt'] ?? '', $receipt)) {
            throw $error;
        }
        // A lost response can be acknowledged while this operation is still the latest preference write.
        $decoded = [];
    }

    $current = readTypePrefs($type);
    $merged = mergeTypePrefsPatch($current, $decoded);
    if (isset($decoded['hiddenFolderIdChanges'])) {
        $hiddenIds = array_fill_keys(normalizeStringIdList($merged['hiddenFolderIds'] ?? []), true);
        foreach ($decoded['hiddenFolderIdChanges'] as $id => $hidden) {
            if ($hidden) $hiddenIds[$id] = true;
            else unset($hiddenIds[$id]);
        }
        $merged['hiddenFolderIds'] = array_map('strval', array_keys($hiddenIds));
        unset($merged['hiddenFolderIdChanges']);
    }
    fvplusValidateRuleChanges($type, $current['autoRules'] ?? [], $merged['autoRules'] ?? []);
    $next = normalizeTypePrefs($merged);
    $orderPrefsChanged = (
        $current['sortMode'] !== $next['sortMode']
        || $current['manualOrder'] !== $next['manualOrder']
        || $current['pinnedFolderIds'] !== $next['pinnedFolderIds']
        || $current['hiddenFolderIds'] !== $next['hiddenFolderIds']
    );
    if ($orderPrefsChanged) {
        $next = reconcileManualOrderPrefs($next, readRawFolderMap($type));
    }
    $configChanged = jsonObjectsDiffer($current, $next);
    $saved = $configChanged ? writeTypePrefs($type, $next, $receipt) : $current;
    $metadata = readConfigMetadata($type, false);
    unset($metadata['prefsMutationReceipt']);
    $dockerOrderChanged = $type === 'docker' && (
        $current['autoRules'] !== $saved['autoRules'] ||
        (string)($current['sortMode'] ?? 'created') !== (string)($saved['sortMode'] ?? 'created')
        || normalizeStringIdList($current['manualOrder'] ?? []) !== normalizeStringIdList($saved['manualOrder'] ?? [])
        || normalizeStringIdList($current['pinnedFolderIds'] ?? []) !== normalizeStringIdList($saved['pinnedFolderIds'] ?? [])
        || json_encode(normalizeDockerStartOrderPrefs($current['dockerStartOrder'] ?? []), JSON_UNESCAPED_SLASHES) !== json_encode(normalizeDockerStartOrderPrefs($saved['dockerStartOrder'] ?? []), JSON_UNESCAPED_SLASHES)
    );
    if ($dockerOrderChanged) {
        syncContainerOrder('docker');
    }
    $auditRelevant = $orderPrefsChanged || $dockerOrderChanged;
    foreach (['autoRules', 'backupSchedule', 'folderDefaults', 'importPresets', 'folderGroups'] as $key) {
        if (array_key_exists($key, $decoded) && json_encode($current[$key] ?? null) !== json_encode($saved[$key] ?? null)) {
            $auditRelevant = true;
            break;
        }
    }
    $auditRecorded = false;
    if ($configChanged && $auditRelevant) {
        try {
            appendDiagnosticsHistoryEvent('prefs_update', $type, [
                'traceId' => getRequestTraceId(),
                'clientMutationId' => $clientMutationId,
                'patchFieldCount' => count($decoded),
                'configChanged' => true,
                'backupRequired' => false,
                'backupCreated' => false,
                'backupCoalesced' => false,
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

    return fvplusJsonTypeConfig([
        'prefs' => $saved,
        'backup' => null,
        'metadata' => $metadata,
        'clientMutationId' => $clientMutationId,
        'configChanged' => $configChanged,
        'backupRequired' => false,
        'auditRecorded' => $auditRecorded,
        'backupCoalesced' => false
    ]);
});
