<?php

function parseBatchManualOrder(array $operations): array {
    $manualOrder = $operations['manualOrder'] ?? null;
    $expectedPrefsRevision = $operations['expectedPrefsRevision'] ?? '';
    if ($manualOrder !== null && !is_array($manualOrder)) {
        throw new RuntimeException('Batch manual order must be an array.');
    }
    if ($manualOrder !== null && trim((string)$expectedPrefsRevision) === '') {
        throw new RuntimeException('Batch manual order requires a preference revision.');
    }
    return [$manualOrder, $expectedPrefsRevision];
}

function assertBatchFolderOperationCount(array $deletes, array $upserts, array $creates): int {
    $count = count($deletes) + count($upserts) + count($creates);
    if ($count <= 0) {
        throw new RuntimeException('No folder operations were provided.');
    }
    if ($count > FVPLUS_MAX_FOLDER_BATCH_OPERATIONS) {
        throw new RuntimeException('Folder batch exceeds the maximum operation count.');
    }
    return $count;
}

function assertBatchManualOrderRevision(string $type, ?array $manualOrder, $expectedPrefsRevision): void {
    if ($manualOrder !== null) {
        assertExpectedConfigRevision($type, 'prefs', $expectedPrefsRevision);
    }
}

function applyBatchManualOrderPrefs(array $prefs, array $folders, array $manualOrder): array {
    $prefs['sortMode'] = 'manual';
    $prefs['manualOrder'] = normalizeStringIdList($manualOrder);
    return reconcileManualOrderPrefs($prefs, $folders);
}
