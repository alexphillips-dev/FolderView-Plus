<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

$applyStartupBatchChanges = static function (array $plan, string $type, string $currentMode, int &$conflictCount): array {
    if (!array_key_exists('batchChanges', $plan)) return $plan;
    $changes = $plan['batchChanges'];
    if ($type !== 'docker' || !is_array($changes) || !array_is_list($changes) || count($changes) > 500) {
        throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
    }
    unset($plan['batchChanges']);
    $batches = normalizeDockerStartOrderPrefs($plan)['batches'];
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
    $structuralTargets = [];
    $candidateOrder = array_column($batches, 'id');
    foreach ($changes as $edit) {
        $id = $edit['id'] ?? null;
        $action = $edit['action'] ?? null;
        if (!is_string($id) || trim($id) === '' || strlen($id) > 256) {
            throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
        }
        if ($action === 'add') {
            $value = $edit['value'] ?? null;
            if (!is_array($value) || ($value['id'] ?? null) !== $id) {
                throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            }
            foreach (array_diff_key($value, ['id' => true]) as $field => $fieldValue) {
                if (!$validBatchValue((string)$field, $fieldValue)) throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            }
            $batch = normalizeDockerStartOrderPrefs(['batches' => [$value]])['batches'][0];
            if ($batch['id'] !== $id) throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            $candidateOrder[] = $id;
        } elseif ($action === 'move') {
            if (!in_array($edit['offset'] ?? null, [-1, 1], true) || !is_string($edit['neighbor'] ?? null)) {
                throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
            }
        } elseif ($action !== 'remove' && ($action !== 'set'
            || !is_string($edit['field'] ?? null) || !$validBatchValue($edit['field'], $edit['value'] ?? null))) {
            throw new InvalidArgumentException('Invalid Docker start-order batch changes.');
        }
        if ($action === 'add' || $action === 'remove') $structuralTargets[$id] = true;
    }

    // Structural operations share an order dependency when they touch the
    // same row or change which rows separate an explicitly named move pair.
    $positions = array_flip(array_values(array_unique($candidateOrder)));
    $components = [];
    foreach ($changes as $edit) {
        if ($edit['action'] === 'set') continue;
        $id = $edit['id'];
        $targets = [$id];
        if ($edit['action'] === 'move') {
            $neighbor = $edit['neighbor'];
            $targets[] = $neighbor;
            if (isset($positions[$id], $positions[$neighbor])) {
                $first = min($positions[$id], $positions[$neighbor]);
                $length = abs($positions[$id] - $positions[$neighbor]);
                $targets = array_slice(array_keys($positions), $first, $length + 1);
            }
        }
        $owners = array_intersect_key($components, array_fill_keys($targets, true));
        $owner = $owners ? reset($owners) : $id;
        foreach ($components as $target => $existing) {
            if (in_array($existing, $owners, true)) $components[$target] = $owner;
        }
        foreach ($targets as $target) $components[$target] = $owner;
    }
    $groups = array_map(static function (array $edit) use ($components, $structuralTargets): string {
        $id = $edit['id'];
        return $edit['action'] !== 'set' || isset($structuralTargets[$id])
            ? 'structure:' . $components[$id] : $edit['field'] . ':' . $id;
    }, $changes);

    $applyEdit = static function (array &$next, array $edit): bool {
        $id = $edit['id'];
        $index = array_search($id, array_column($next, 'id'), true);
        if ($edit['action'] === 'add') {
            if ($index !== false || count($next) >= 100) return false;
            $next[] = normalizeDockerStartOrderPrefs(['batches' => [$edit['value']]])['batches'][0];
        } elseif ($edit['action'] === 'remove') {
            if ($index !== false) array_splice($next, $index, 1);
        } elseif ($index === false) {
            return false;
        } elseif ($edit['action'] === 'move') {
            $neighbor = $index + $edit['offset'];
            if (($next[$neighbor]['id'] ?? null) !== $edit['neighbor']) return false;
            [$next[$index], $next[$neighbor]] = [$next[$neighbor], $next[$index]];
        } else {
            $field = $edit['field'];
            $previous = $edit['previous'] ?? null;
            if ($field === 'name' && is_string($previous)) $previous = rtrim(truncateUtf8String(trim($previous), 64));
            if ($next[$index][$field] !== $previous) return false;
            $next[$index] = normalizeDockerStartOrderPrefs(['batches' => [
                array_replace($next[$index], [$field => $edit['value']])
            ]])['batches'][0];
        }
        return true;
    };

    // Replay surviving groups in the original request order so independently
    // added batches keep their position. Discard a failed group's partial writes.
    $rejected = [];
    do {
        $next = $batches;
        $retry = false;
        foreach ($changes as $key => $edit) {
            $group = $groups[$key];
            if (!isset($rejected[$group]) && !$applyEdit($next, $edit)) {
                $rejected[$group] = true;
                $retry = true;
                break;
            }
        }
    } while ($retry);
    $conflictCount += array_sum(array_intersect_key(array_count_values($groups), $rejected));
    $adds = array_keys(array_column($changes, 'action'), 'add', true);
    if (($plan['mode'] ?? null) === 'custom-batches' && $adds !== []) {
        $acceptedAdds = array_filter($adds, static fn(int $key): bool => !isset($rejected[$groups[$key]]));
        if ($acceptedAdds === []) $plan['mode'] = $currentMode;
    }
    return array_replace($plan, ['batches' => $next]);
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
    $expectedRecoveryRevision = $_POST['expectedRecoveryRevision'] ?? null;
    $clientMutationId = trim((string)($_POST['clientMutationId'] ?? ''));
    if ($clientMutationId !== '' && !preg_match('/^[a-zA-Z0-9._:-]{1,96}$/', $clientMutationId)) {
        throw new RuntimeException('Invalid client mutation id.');
    }
    $token = getConfiguredRequestToken();
    $receipt = $clientMutationId !== '' && ctype_digit($expectedRevision) && $token !== ''
        ? hash_hmac('sha256', json_encode([$type, $clientMutationId, (int)$expectedRevision, $decoded], JSON_THROW_ON_ERROR), $token)
        : '';
    $replayDockerStartOrder = false;
    $startupConflictCount = 0;
    try {
        $metadata = readConfigMetadata($type, true);
        $recoveryRevision = $metadata['prefsRecoveryRevision'];
        if (($expectedRecoveryRevision !== null && (!is_scalar($expectedRecoveryRevision)
                || !ctype_digit((string)$expectedRecoveryRevision) || (int)$expectedRecoveryRevision !== $recoveryRevision))
            || (ctype_digit($expectedRevision) && (int)$expectedRevision < $recoveryRevision)) {
            throw new FVPlusApiContractException('Preferences changed in another page. Review and save your changes again.', 422);
        }
        assertExpectedConfigRevision($type, 'prefs', $expectedRevision, $metadata);
    } catch (FVPlusConfigConflictException $error) {
        $committed = readConfigMetadata($type, false);
        if ($receipt === '' || (int)$expectedRevision + 1 !== $committed['prefsRevision']
            || !hash_equals($committed['prefsMutationReceipt'] ?? '', $receipt)) {
            throw $error;
        }
        // A lost response can be acknowledged while this operation is still the latest preference write.
        $replayDockerStartOrder = $type === 'docker' && array_key_exists('dockerStartOrder', $decoded);
        $startupConflictCount = $committed['prefsStartupConflictCount'] ?? 0;
        $decoded = [];
    }

    $current = readTypePrefs($type);
    $merged = mergeTypePrefsPatch($current, $decoded);
    if (isset($merged['dockerStartOrder'])) {
        $merged['dockerStartOrder'] = $applyStartupBatchChanges($merged['dockerStartOrder'], $type, $current['dockerStartOrder']['mode'], $startupConflictCount);
    }
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
    if (!$configChanged && $startupConflictCount > 0 && !$replayDockerStartOrder) {
        throw new InvalidArgumentException('Preferences changed in another page. Review and save your changes again.');
    }
    $saved = $current;
    if ($configChanged) {
        $saved = writeTypePrefs($type, $next, $receipt, prefsStartupConflictCount: $startupConflictCount);
    }
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
        ...($startupConflictCount > 0 ? ['startupBatchConflicts' => $startupConflictCount] : []),
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
