<?php
function renameCustomIconUnlocked(): array {
    $customDir = ensureCustomIconDirExists();
    $from = normalizeCustomIconFileNameInput((string)($_POST['from'] ?? ''));
    $fromPath = "$customDir/$from";
    if (!is_file($fromPath) || is_link($fromPath)) throw new RuntimeException('Icon not found.');
    $to = sanitizeCustomIconTargetName((string)($_POST['to'] ?? ''), strtolower((string)pathinfo($from, PATHINFO_EXTENSION)));
    if ($from === $to) {
        $meta = readCustomIconMetadataIndex();
        return ['icon' => buildCustomIconUploadResponse($from, $meta, false, false, '', 'multipart', customIconUsageMap()),
            'health' => customIconDirectoryHealth()];
    }
    $toPath = "$customDir/$to";
    if (file_exists($toPath) || is_link($toPath)) throw new RuntimeException('An icon with that name already exists.');
    $usageMap = customIconUsageMap(true);
    $referenced = !empty($usageMap[$from]) || customIconNameFromReference((string)($_POST['selectedIcon'] ?? '')) === $from;
    if ($referenced) throw new RuntimeException('Remove or replace saved icon references and choose a different editor icon before renaming.');

    $runtimeDir = fvplusCustomIconRuntimeDirPath();
    $paths = [$fromPath, $toPath, customIconMetadataPath(), getLastGoodJsonPath(customIconMetadataPath())];
    if (!is_link($runtimeDir)) $paths = array_merge($paths, ["$runtimeDir/$from", "$runtimeDir/$to"]);
    $snapshots = array_map('fvplusTransactionCaptureFile', $paths);
    try {
        if (!@rename($fromPath, $toPath)) throw new RuntimeException('Failed to rename icon.');
        $meta = readCustomIconMetadataIndex();
        $entry = is_array($meta[$from] ?? null) ? $meta[$from] : [];
        unset($meta[$from]);
        $entry['updatedAt'] = gmdate('c');
        $entry['size'] = max(0, (int)@filesize($toPath));
        $entry['mime'] = detectUploadedMimeType($toPath);
        if (trim((string)($entry['originalName'] ?? '')) === '') $entry['originalName'] = $from;
        $meta[$to] = $entry;
        writeCustomIconMetadataIndex($meta);
        // Storage bootstrap already migrated legacy files before the icon lock.
        // Mirror directly here so the old public copy cannot be re-imported.
        if (!is_link($runtimeDir)) fvplusMirrorPersistentCustomIconsToRuntime();
        $hash = computeCustomIconHash($toPath);
        if ($hash === '' || computeCustomIconHash("$runtimeDir/$to") !== $hash || file_exists("$runtimeDir/$from")) {
            throw new RuntimeException('Failed to rename icon.');
        }
        $response = ['icon' => buildCustomIconUploadResponse($to, $meta, false, false, '', 'multipart', $usageMap),
            'health' => customIconDirectoryHealth()];
    } catch (Throwable $error) {
        fvplusTransactionRestoreAfterFailure($snapshots, $error, 'fvplusTransactionRestoreFiles');
        throw $error;
    }
    appendCustomIconAuditEvent('icon_rename', 'ok', ['from' => $from, 'to' => $to]);
    return $response;
}
