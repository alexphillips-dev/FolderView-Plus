<?php

function normalizeBatchFolderOperations(string $type, array $deletes, array $upserts, array $creates, $expectedRevision): array {
    $normalizedDeletes = [];
    foreach ($deletes as $rawId) {
        $id = trim((string)$rawId);
        if ($id === '' || strlen($id) > 128) {
            throw new RuntimeException('Batch delete contains an invalid folder ID.');
        }
        $normalizedDeletes[] = $id;
    }

    $normalizeEntry = static function ($rawEntry, bool $requiresId) use ($type): array {
        if (!is_array($rawEntry)) {
            throw new RuntimeException('Batch folder operation must be an object.');
        }
        $rawId = $rawEntry['id'] ?? null;
        $id = $requiresId && (is_string($rawId) || is_int($rawId)) ? normalizeFolderIdValue($rawId) : '';
        if ($requiresId && $id === '') {
            throw new RuntimeException('Batch update contains an invalid folder ID.');
        }
        if (array_key_exists('createOnly', $rawEntry) && (!$requiresId || !is_bool($rawEntry['createOnly']))) {
            throw new RuntimeException('Invalid folder payload.');
        }
        $folder = $rawEntry['folder'] ?? null;
        if (!is_array($folder)) {
            throw new RuntimeException('Batch folder operation is missing a valid folder payload.');
        }
        fvplus_assert_folder_payload_shape($folder);
        if ($type === 'docker') fvplusAssertWebuiProfileLimits($folder['settings'] ?? []);
        $rawPreview = json_encode($folder, JSON_UNESCAPED_SLASHES);
        if (!is_string($rawPreview) || strlen($rawPreview) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
            throw new RuntimeException('Batch folder payload exceeds the raw upload limit.');
        }
        $normalized = normalizeFolderContentPayload($folder);
        $normalizedPreview = json_encode($normalized, JSON_UNESCAPED_SLASHES);
        if (!is_string($normalizedPreview) || strlen($normalizedPreview) > FVPLUS_MAX_FOLDER_CONTENT_BYTES) {
            throw new RuntimeException('Batch folder payload is too large after normalization.');
        }
        return ['id' => $id, 'folder' => $normalized, 'createOnly' => $rawEntry['createOnly'] ?? false];
    };

    $normalizedUpserts = array_map(static fn($entry): array => $normalizeEntry($entry, true), $upserts);
    $upsertCounts = array_count_values(array_column($normalizedUpserts, 'id'));
    foreach ($normalizedUpserts as $entry) {
        if ($entry['createOnly'] && (!is_scalar($expectedRevision) || !ctype_digit((string)$expectedRevision) || (int)$expectedRevision < 1
            || $upsertCounts[$entry['id']] !== 1 || in_array($entry['id'], $normalizedDeletes, true))) {
            throw new RuntimeException('The preview changed. Run the preview again before applying.');
        }
    }
    $normalizedCreates = array_map(static fn($entry): array => $normalizeEntry($entry, false), $creates);
    return [$normalizedDeletes, $normalizedUpserts, $normalizedCreates];
}
