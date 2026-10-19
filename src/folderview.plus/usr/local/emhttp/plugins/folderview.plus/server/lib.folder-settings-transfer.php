<?php
// One field registry is shared with the browser; unknown portable settings belong to Behavior.
function folderSettingsTransferSchema(): array {
    static $schema = null;
    if ($schema === null) $schema = json_decode(file_get_contents(__DIR__ . '/../schemas/folder-settings-transfer.schema.json'), true, 512, JSON_THROW_ON_ERROR);
    return $schema;
}

function folderSettingsTransferCategory(string $key): string {
    $schema = folderSettingsTransferSchema();
    if (in_array($key, $schema['protectedSettings'], true)) return '';
    if (in_array($key, $schema['actionKeys'], true)) return 'actions';
    foreach (['appearance', 'layout'] as $category) {
        foreach ($schema[$category . 'Prefixes'] as $prefix) if (strpos($key, $prefix) === 0) return $category;
    }
    return in_array($key, $schema['layoutKeys'], true) ? 'layout' : 'behavior';
}

function normalizeFolderSettingsTransferCategories(array $categories): array {
    $allowed = folderSettingsTransferSchema()['categories'];
    if (!$categories) throw new InvalidArgumentException('Invalid folder settings categories.');
    foreach ($categories as $category) if (!is_string($category) || !in_array($category, $allowed, true)) throw new InvalidArgumentException('Invalid folder settings categories.');
    return array_values(array_filter($allowed, static fn($category) => in_array($category, $categories, true)));
}

function mergeFolderSettingsTransfer(array $target, array $payload, array $categories): array {
    $next = $target;
    if (in_array('appearance', $categories, true)) $next['icon'] = $payload['icon'];
    $settings = is_array($next['settings'] ?? null) ? $next['settings'] : [];
    foreach (array_keys($settings) as $key) if (in_array(folderSettingsTransferCategory((string)$key), $categories, true)) unset($settings[$key]);
    foreach ($payload['settings'] as $key => $value) if (in_array(folderSettingsTransferCategory((string)$key), $categories, true)) $settings[$key] = $value;
    $next['settings'] = $settings;
    if (in_array('actions', $categories, true)) $next['actions'] = $payload['actions'];
    return normalizeFolderContentPayload($next);
}

function applySelectiveFolderSettings(string $type, array $targetIds, array $settingsPayload, array $options = []): array {
    $type = ensureType($type);
    $categories = normalizeFolderSettingsTransferCategories($options['categories'] ?? folderSettingsTransferSchema()['categories']);
    $payload = normalizeFolderSettingsTransferPayload($settingsPayload);
    foreach ($targetIds as $id) if (!is_string($id) || strlen($id) > 64) throw new InvalidArgumentException('Invalid target folder list.');
    $ids = array_values(array_unique(array_map('trim', $targetIds)));
    if (!$ids || in_array('', $ids, true)) throw new InvalidArgumentException('Select at least one target folder.');
    return withConfigMutationLock(static function() use ($type, $categories, $payload, $ids, $options): array {
        if (isset($options['expectedRevision'])) assertExpectedConfigRevision($type, 'folder', $options['expectedRevision']);
        $folders = readRawFolderMap($type);
        $nextFolders = $folders;
        $changed = [];
        $skipped = [];
        $changes = [];
        foreach ($ids as $id) {
            if (!is_array($folders[$id] ?? null)) throw new RuntimeException('Target folder not found.');
            $before = normalizeFolderContentPayload($folders[$id]);
            $after = mergeFolderSettingsTransfer($before, $payload, $categories);
            $changedCategories = [];
            foreach ($categories as $category) {
                $part = mergeFolderSettingsTransfer($before, $payload, [$category]);
                if (fvplus_security_canonicalize($part) !== fvplus_security_canonicalize($before)) $changedCategories[] = $category;
            }
            if (!$changedCategories) { $skipped[] = $id; continue; }
            $changed[] = $id;
            $changes[$id] = $changedCategories;
            $after['updatedAt'] = gmdate('c');
            $nextFolders[$id] = $after;
        }
        $result = ['updatedIds' => $changed, 'updatedCount' => count($changed), 'skippedIds' => $skipped,
            'unchangedCount' => count($skipped), 'categories' => $categories, 'changes' => $changes,
            'folderRevision' => readConfigMetadata($type, false, false)['folderRevision'], 'backup' => null, 'settings' => $payload];
        if (!empty($options['preview']) || !$changed) return $result;
        $result['backup'] = createBackupSnapshot($type, 'before-apply-folder-settings');
        // Membership and hierarchy are unchanged, so no order/preferences write is necessary.
        writeRawFolderMap($type, $nextFolders);
        $result['folderRevision'] = readConfigMetadata($type, false, false)['folderRevision'];
        try {
            appendDiagnosticsHistoryEvent('folder_settings_apply', $type, ['targetCount' => count($changed),
                'unchangedCount' => count($skipped), 'categories' => $categories], 'ok', 'server');
        } catch (Throwable $error) { /* A committed transfer remains successful if diagnostics are unavailable. */ }
        return $result;
    });
}
