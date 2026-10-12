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
    // Never mistake unreadable/corrupt current configuration for an unused icon.
    foreach (['docker', 'vm'] as $type) {
        foreach ([getFolderFilePath($type), getTypePrefsPath($type)] as $path) {
            if ((file_exists($path) || is_link($path))
                && (is_link($path) || !is_file($path) || !is_readable($path) || !is_array(readJsonObjectFile($path)))) {
                throw new RuntimeException('Icon references could not be verified. Reload Settings and try again.');
            }
        }
    }
    $usageMap = customIconUsageMap();
    $referenced = !empty($usageMap[$from]) || customIconNameFromReference((string)($_POST['selectedIcon'] ?? '')) === $from;
    foreach (['docker', 'vm'] as $type) {
        $prefs = readJsonObjectFile(getTypePrefsPath($type)) ?? [];
        $sources = [$prefs];
        if (!hasLegacyMigrationMarker($type, 'prefs') && normalizeTypePrefs($prefs) === defaultTypePrefs()) {
            foreach (getLegacyConfigDirCandidates() as $directory) {
                $legacy = readJsonObjectFile("$directory/$type.prefs.json");
                if (is_array($legacy) && normalizeTypePrefs($legacy) !== defaultTypePrefs()) {
                    $sources[] = $legacy;
                    break;
                }
            }
        }
        foreach ($sources as $source) {
            $icons = [(string)($source['folderDefaults']['profile']['icon'] ?? '')];
            foreach (is_array($source['folderGroups'] ?? null) ? $source['folderGroups'] : [] as $group) {
                foreach (is_array($group['folders'] ?? null) ? $group['folders'] : [] as $folder) $icons[] = (string)($folder['icon'] ?? '');
            }
            foreach ($icons as $icon) $referenced = $referenced || customIconNameFromReference($icon) === $from;
        }
    }
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
