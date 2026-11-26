<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

$applyStartupBatchChanges = static function (array $plan, string $type): array {
    if (!array_key_exists('batchChanges', $plan)) return $plan;
    $changes = $plan['batchChanges'];
    if ($type !== 'docker' || !is_array($changes) || !array_is_list($changes) || count($changes) > 500) {
        throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
    }
    unset($plan['batchChanges']);
    $batches = normalizeDockerStartOrderPrefs($plan)['batches'];
    $conflict = 'Preferences changed in another page. Review and save your changes again.';
    $validBatchValue = static fn(string $field, $value): bool => match ($field) {
        'name' => is_string($value) && trim($value) !== '',
        'delay' => is_int($value) && $value >= 0 && $value <= 3600,
        'parallel', 'useFolderOrder' => is_bool($value),
        'items' => is_array($value) && array_is_list($value) && count($value) <= 2000
            && !array_filter($value, static fn($item): bool => !is_array($item) || match ($item['type'] ?? null) {
                'folder' => !is_string($item['id'] ?? null) || normalizeFolderIdValue($item['id']) !== $item['id'],
                'container' => !is_string($item['name'] ?? null) || trim($item['name']) === '',
                default => true
            }),
        default => false
    };
    foreach ($changes as $edit) {
        $id = $edit['id'] ?? null;
        $action = $edit['action'] ?? null;
        if (!is_string($id) || trim($id) === '' || strlen($id) > 256) {
            throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
        }
        $indices = array_keys(array_column($batches, 'id'), $id, true);
        $index = $indices[0] ?? null;
        if ($action === 'add') {
            if ($indices !== [] || count($batches) >= 100) throw new InvalidArgumentException($conflict);
            $value = $edit['value'] ?? null;
            if (!is_array($value) || ($value['id'] ?? null) !== $id) {
                throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            }
            foreach (array_diff_key($value, ['id' => true]) as $field => $fieldValue) {
                if (!$validBatchValue((string)$field, $fieldValue)) throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            }
            $batch = normalizeDockerStartOrderPrefs(['batches' => [$value]])['batches'][0];
            if ($batch['id'] !== $id) throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            $batches[] = $batch;
            continue;
        }
        if ($action === 'remove' && $index === null) continue;
        if (count($indices) !== 1 || $index === null) throw new InvalidArgumentException($conflict);
        if ($action === 'remove') {
            array_splice($batches, $index, 1);
        } elseif ($action === 'move') {
            $offset = $edit['offset'] ?? null;
            if (!in_array($offset, [-1, 1], true) || !isset($batches[$index + $offset])
                || $batches[$index + $offset]['id'] !== ($edit['neighbor'] ?? null)
                || count(array_keys(array_column($batches, 'id'), $edit['neighbor'], true)) !== 1) {
                throw new InvalidArgumentException($conflict);
            }
            [$batches[$index], $batches[$index + $offset]] = [$batches[$index + $offset], $batches[$index]];
        } elseif ($action === 'set' && is_string($edit['field'] ?? null) && $validBatchValue($edit['field'], $edit['value'] ?? null)) {
            $field = $edit['field'];
            if ($batches[$index][$field] !== ($edit['previous'] ?? null)) throw new InvalidArgumentException($conflict);
            $batches[$index] = normalizeDockerStartOrderPrefs(['batches' => [
                array_replace($batches[$index], [$field => $edit['value']])
            ]])['batches'][0];
        } else {
            throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
        }
    }
    return array_replace($plan, ['batches' => $batches]);
};

$writePrefs = static function (string $type) use ($applyStartupBatchChanges): array {
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
    $replayDockerStartOrder = false;
    try {
        assertExpectedConfigRevision($type, 'prefs', $expectedRevision);
    } catch (FVPlusConfigConflictException $error) {
        $committed = readConfigMetadata($type, false);
        if ($receipt === '' || (int)$expectedRevision + 1 !== $committed['prefsRevision']
            || !hash_equals($committed['prefsMutationReceipt'] ?? '', $receipt)) {
            throw $error;
        }
        // A lost response can be acknowledged while this operation is still the latest preference write.
        $replayDockerStartOrder = $type === 'docker' && array_key_exists('dockerStartOrder', $decoded);
        $decoded = [];
    }

    $current = readTypePrefs($type);
    $merged = mergeTypePrefsPatch($current, $decoded);
    if (isset($merged['dockerStartOrder'])) $merged['dockerStartOrder'] = $applyStartupBatchChanges($merged['dockerStartOrder'], $type);
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
    $currentDockerStartOrder = normalizeDockerStartOrderPrefs($current['dockerStartOrder'] ?? []);
    $savedDockerStartOrder = normalizeDockerStartOrderPrefs($saved['dockerStartOrder'] ?? []);
    $followsDockerPage = $savedDockerStartOrder['mode'] === 'docker-page';
    $dockerOrderChanged = $type === 'docker' && (
        $current['autoRules'] !== $saved['autoRules'] ||
        (string)($current['sortMode'] ?? 'created') !== (string)($saved['sortMode'] ?? 'created')
        || normalizeStringIdList($current['manualOrder'] ?? []) !== normalizeStringIdList($saved['manualOrder'] ?? [])
        || normalizeStringIdList($current['pinnedFolderIds'] ?? []) !== normalizeStringIdList($saved['pinnedFolderIds'] ?? [])
        || $currentDockerStartOrder !== $savedDockerStartOrder
        || ($followsDockerPage && dockerPageStartOrderUsesSavedLayout($current) !== dockerPageStartOrderUsesSavedLayout($saved))
    );
    $dockerOrderSync = null;
    if ($dockerOrderChanged || $replayDockerStartOrder) {
        try {
            $dockerOrderSync = syncContainerOrder('docker')['syncOutcome'];
        } catch (Throwable $error) {
            fv3_debug_log('prefs: committed Docker preferences but the native order sync failed');
            $dockerOrderSync = 'failed';
        }
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
        ...($dockerOrderSync !== null ? ['dockerOrderSync' => $dockerOrderSync] : []),
        'backupRequired' => false,
        'auditRecorded' => $auditRecorded,
        'backupCoalesced' => false
    ]);
};

fvplus_json_try(static function () use ($writePrefs): array {
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
    return fvplusRunSetupAssistantMutation($_POST['setupCheckpoint'] ?? null, $_POST['setupFence'] ?? null,
        static fn(): array => $writePrefs($type));
});
