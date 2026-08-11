<?php
function normalizeCustomIconFileNameInput(string $value): string {
    $name = basename(trim($value));
    if ($name === '' || $name !== trim($value)) {
        throw new RuntimeException('Invalid icon name.');
    }
    $extension = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
    if ($extension === '' || !in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) {
        throw new RuntimeException('Unsupported icon format.');
    }
    return $name;
}

function sanitizeCustomIconTargetName(string $value, ?string $defaultExtension = null): string {
    $trimmed = trim($value);
    if ($trimmed === '') {
        throw new RuntimeException('Icon name is required.');
    }
    $extension = strtolower((string)pathinfo($trimmed, PATHINFO_EXTENSION));
    if ($extension === '' && is_string($defaultExtension) && $defaultExtension !== '') {
        $extension = strtolower($defaultExtension);
    }
    if ($extension === '' || !in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) {
        throw new RuntimeException('Unsupported icon format.');
    }
    $basename = sanitizeCustomIconBasename((string)pathinfo($trimmed, PATHINFO_FILENAME));
    return "$basename.$extension";
}

function computeCustomIconHash(string $path): string {
    $hash = @hash_file('sha256', $path);
    return is_string($hash) ? strtolower(trim($hash)) : '';
}

function syncCustomIconMetadataIndex(string $directory): array {
    $files = listCustomIconsInDirectory($directory);
    $existing = readCustomIconMetadataIndex();
    $next = [];
    $changed = false;
    foreach ($files as $name => $file) {
        $prev = is_array($existing[$name] ?? null) ? $existing[$name] : [];
        $mtime = max(1, (int)($file['mtime'] ?? time()));
        $defaultTimestamp = gmdate('c', $mtime);
        $hash = strtolower(trim((string)($prev['hash'] ?? '')));
        if ($hash === '') {
            $hash = computeCustomIconHash((string)$file['path']);
            $changed = true;
        }
        $mime = trim((string)($prev['mime'] ?? ''));
        if ($mime === '') {
            $mime = detectUploadedMimeType((string)$file['path']);
            $changed = true;
        }
        $dimensions = readImageDimensions((string)$file['path']);
        $width = max(0, (int)($prev['width'] ?? 0));
        $height = max(0, (int)($prev['height'] ?? 0));
        if ($width <= 0 && (int)$dimensions['width'] > 0) {
            $width = (int)$dimensions['width'];
            $changed = true;
        }
        if ($height <= 0 && (int)$dimensions['height'] > 0) {
            $height = (int)$dimensions['height'];
            $changed = true;
        }
        $entry = [
            'originalName' => trim((string)($prev['originalName'] ?? $name)),
            'uploadedAt' => trim((string)($prev['uploadedAt'] ?? $defaultTimestamp)),
            'updatedAt' => trim((string)($prev['updatedAt'] ?? $defaultTimestamp)),
            'size' => max(0, (int)($file['size'] ?? 0)),
            'hash' => $hash,
            'mime' => $mime,
            'width' => $width,
            'height' => $height,
            'optimized' => ($prev['optimized'] ?? false) === true
        ];
        if (!isset($existing[$name]) || $entry != $existing[$name]) {
            $changed = true;
        }
        $next[$name] = $entry;
    }
    if (count($existing) !== count($next)) {
        $changed = true;
    }
    if ($changed) {
        writeCustomIconMetadataIndex($next);
    }
    return $next;
}

function customIconMetadataForResponse(string $name, array $meta): array {
    $entry = is_array($meta[$name] ?? null) ? $meta[$name] : [];
    return [
        'originalName' => (string)($entry['originalName'] ?? $name),
        'uploadedAt' => (string)($entry['uploadedAt'] ?? ''),
        'updatedAt' => (string)($entry['updatedAt'] ?? ''),
        'size' => max(0, (int)($entry['size'] ?? 0)),
        'hash' => (string)($entry['hash'] ?? ''),
        'mime' => (string)($entry['mime'] ?? ''),
        'width' => max(0, (int)($entry['width'] ?? 0)),
        'height' => max(0, (int)($entry['height'] ?? 0)),
        'optimized' => ($entry['optimized'] ?? false) === true
    ];
}

function customIconListRows(string $directory, string $search = '', string $sort = 'newest', array $usageMap = []): array {
    $meta = syncCustomIconMetadataIndex($directory);
    $files = listCustomIconsInDirectory($directory);
    $rows = [];
    $needle = strtolower(trim($search));
    foreach ($files as $name => $file) {
        $entry = customIconMetadataForResponse($name, $meta);
        $usage = is_array($usageMap[$name] ?? null) ? array_values($usageMap[$name]) : [];
        $usageSearch = [];
        foreach ($usage as $ref) {
            $usageSearch[] = (string)($ref['type'] ?? '');
            $usageSearch[] = (string)($ref['folderName'] ?? '');
            $usageSearch[] = (string)($ref['folderId'] ?? '');
        }
        $searchHaystack = strtolower($name . ' ' . (string)$entry['originalName'] . ' ' . (string)$entry['hash'] . ' ' . implode(' ', $usageSearch));
        if ($needle !== '' && strpos($searchHaystack, $needle) === false) {
            continue;
        }
        $rows[] = [
            'name' => $name,
            'url' => customIconPublicUrl($name),
            'path' => customIconPublicPath($name),
            'size' => max(0, (int)($entry['size'] ?? 0)),
            'updatedAt' => (string)($entry['updatedAt'] ?? ''),
            'uploadedAt' => (string)($entry['uploadedAt'] ?? ''),
            'originalName' => (string)($entry['originalName'] ?? $name),
            'hash' => (string)($entry['hash'] ?? ''),
            'mime' => (string)($entry['mime'] ?? ''),
            'width' => max(0, (int)($entry['width'] ?? 0)),
            'height' => max(0, (int)($entry['height'] ?? 0)),
            'optimized' => ($entry['optimized'] ?? false) === true,
            'usageCount' => count($usage),
            'inUse' => count($usage) > 0,
            'usage' => array_slice($usage, 0, 50)
        ];
    }
    $mode = strtolower(trim($sort));
    usort($rows, static function (array $a, array $b) use ($mode): int {
        if ($mode === 'name') {
            return strcasecmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
        }
        if ($mode === 'size') {
            return ((int)($b['size'] ?? 0) <=> (int)($a['size'] ?? 0)) ?: strcasecmp((string)$a['name'], (string)$b['name']);
        }
        if ($mode === 'oldest') {
            return strcmp((string)($a['updatedAt'] ?? ''), (string)($b['updatedAt'] ?? '')) ?: strcasecmp((string)$a['name'], (string)$b['name']);
        }
        return strcmp((string)($b['updatedAt'] ?? ''), (string)($a['updatedAt'] ?? '')) ?: strcasecmp((string)$a['name'], (string)$b['name']);
    });
    return $rows;
}

function appendCustomIconAuditEvent(string $event, string $status, array $details = []): void {
    try {
        appendDiagnosticsHistoryEvent($event, null, $details, $status, 'icon-upload');
    } catch (Throwable $_error) {
        // Keep endpoint behavior non-fatal if diagnostics logging fails.
    }
}

function findCustomIconNameByHash(array $meta, string $hash): string {
    $needle = strtolower(trim($hash));
    if ($needle === '') {
        return '';
    }
    foreach ($meta as $name => $entry) {
        $value = strtolower(trim((string)($entry['hash'] ?? '')));
        if ($value !== '' && $value === $needle) {
            $path = customIconDirPath() . '/' . $name;
            if (is_file($path)) {
                return (string)$name;
            }
        }
    }
    return '';
}

function buildCustomIconUploadResponse(string $name, array $meta, bool $duplicate = false, bool $replaced = false, string $message = '', string $uploadMode = 'multipart', array $usageMap = []): array {
    $usage = is_array($usageMap[$name] ?? null) ? array_values($usageMap[$name]) : [];
    $response = [
        'name' => $name,
        'url' => customIconPublicUrl($name),
        'path' => customIconPublicPath($name),
        'duplicate' => $duplicate,
        'replaced' => $replaced,
        'uploadMode' => $uploadMode,
        'metadata' => customIconMetadataForResponse($name, $meta),
        'stats' => customIconStorageStats(customIconDirPath()),
        'health' => customIconDirectoryHealth(),
        'usageCount' => count($usage),
        'inUse' => count($usage) > 0,
        'usage' => array_slice($usage, 0, 50)
    ];
    $text = trim($message);
    if ($text !== '') {
        $response['message'] = $text;
    }
    return $response;
}

function handleCustomIconUploadAction(): array {
    enforceCustomIconUploadRateLimit();
    $replaceExisting = normalizeBool($_POST['replace'] ?? false, false);
    $dedupeByHash = normalizeBool($_POST['dedupe'] ?? true, true);
    $uploadSource = resolveCustomIconUploadInput();
    $tmpPath = (string)($uploadSource['tmpPath'] ?? '');
    $extension = strtolower((string)($uploadSource['extension'] ?? ''));
    $originalName = (string)($uploadSource['originalName'] ?? 'icon');
    $isHttpUpload = ($uploadSource['isHttpUpload'] ?? false) === true;
    $cleanupPath = (string)($uploadSource['cleanupPath'] ?? '');
    $uploadMode = $isHttpUpload ? 'multipart' : 'inline';

    try {
        validateUploadedIcon($tmpPath, $extension);
        $optimization = optimizeUploadedRasterIcon($tmpPath, $extension);
        $hash = computeCustomIconHash($tmpPath);
        $response = withCustomIconLock(true, static function () use (
            $replaceExisting,
            $dedupeByHash,
            $hash,
            $extension,
            $originalName,
            $tmpPath,
            &$cleanupPath,
            $optimization,
            $uploadMode
        ) {
            $customDir = ensureCustomIconDirExists();
            $meta = syncCustomIconMetadataIndex($customDir);

            if ($dedupeByHash) {
                $duplicateName = findCustomIconNameByHash($meta, $hash);
                if ($duplicateName !== '') {
                    $usageMap = customIconUsageMap();
                    return buildCustomIconUploadResponse($duplicateName, $meta, true, false, 'Identical icon already exists; reusing existing file.', $uploadMode, $usageMap);
                }
            }

            $baseName = sanitizeCustomIconBasename((string)pathinfo($originalName, PATHINFO_FILENAME));
            $preferredName = "$baseName.$extension";
            $targetName = $preferredName;
            $targetPath = "$customDir/$targetName";
            $replaced = false;
            if (is_file($targetPath)) {
                if ($replaceExisting) {
                    $replaced = true;
                } else {
                    $targetName = nextAvailableCustomIconName($customDir, $baseName, $extension);
                    $targetPath = "$customDir/$targetName";
                }
            }

            $incomingBytes = max(0, (int)@filesize($tmpPath));
            enforceCustomIconStorageLimit($customDir, $incomingBytes, $replaced ? $targetName : '');

            $iconContents = @file_get_contents($tmpPath);
            if (!is_string($iconContents)) {
                throw new RuntimeException('Unable to store uploaded icon.');
            }
            writeDurableFileAtomic($targetPath, $iconContents, ['mode' => 0644]);
            if ($cleanupPath !== '' && is_file($cleanupPath)) {
                @unlink($cleanupPath);
                $cleanupPath = '';
            }

            @chmod($targetPath, 0644);
            $dimensions = readImageDimensions($targetPath);
            $now = gmdate('c');
            $existingMeta = is_array($meta[$targetName] ?? null) ? $meta[$targetName] : [];
            $uploadedAt = $existingMeta['uploadedAt'] ?? $now;
            if (!$replaced || !isset($meta[$targetName])) {
                $uploadedAt = $now;
            }
            $meta[$targetName] = [
                'originalName' => basename($originalName) ?: $targetName,
                'uploadedAt' => $uploadedAt,
                'updatedAt' => $now,
                'size' => max(0, (int)@filesize($targetPath)),
                'hash' => $hash,
                'mime' => detectUploadedMimeType($targetPath),
                'width' => max(0, (int)$dimensions['width']),
                'height' => max(0, (int)$dimensions['height']),
                'optimized' => ($optimization['optimized'] ?? false) === true
            ];
            writeCustomIconMetadataIndex($meta);
            syncCustomIconPublicRuntime();
            $message = $replaced ? 'Existing icon replaced.' : 'Icon uploaded successfully.';
            $usageMap = customIconUsageMap();
            return buildCustomIconUploadResponse($targetName, $meta, false, $replaced, $message, $uploadMode, $usageMap);
        });
        $result = $response['duplicate'] === true
            ? 'deduplicated'
            : (($response['replaced'] ?? false) === true ? 'replaced' : 'uploaded');
        appendCustomIconAuditEvent('icon_upload', 'ok', [
            'result' => $result,
            'name' => (string)($response['name'] ?? basename($originalName)),
            'hash' => $hash,
            'optimized' => ($optimization['optimized'] ?? false) === true,
            'mode' => $uploadMode
        ]);
        return $response;
    } catch (Throwable $error) {
        appendCustomIconAuditEvent('icon_upload', 'error', [
            'message' => (string)$error->getMessage(),
            'mode' => $uploadMode,
            'name' => basename((string)$originalName)
        ]);
        throw $error;
    } finally {
        if ($cleanupPath !== '' && is_file($cleanupPath)) {
            @unlink($cleanupPath);
        }
    }
}

function handleCustomIconListAction(): array {
    return withCustomIconLock(false, static function (): array {
        $customDir = ensureCustomIconDirExists(false);
        $search = trim((string)($_REQUEST['query'] ?? ''));
        $sort = trim((string)($_REQUEST['sort'] ?? 'newest'));
        $usageMap = customIconUsageMap();
        return [
            'icons' => customIconListRows($customDir, $search, $sort, $usageMap),
            'stats' => customIconStorageStats($customDir),
            'health' => customIconDirectoryHealth(),
            'usage' => customIconUsageSummary($usageMap)
        ];
    });
}

function handleCustomIconStatsAction(): array {
    return withCustomIconLock(false, static function (): array {
        $customDir = ensureCustomIconDirExists(false);
        syncCustomIconMetadataIndex($customDir);
        $usageMap = customIconUsageMap();
        return [
            'stats' => customIconStorageStats($customDir),
            'health' => customIconDirectoryHealth(),
            'usage' => customIconUsageSummary($usageMap)
        ];
    });
}

function handleCustomIconDeleteAction(): array {
    return withCustomIconLock(true, static function (): array {
        $customDir = ensureCustomIconDirExists();
        $name = normalizeCustomIconFileNameInput((string)($_POST['name'] ?? ''));
        $path = "$customDir/$name";
        if (!is_file($path) || is_link($path)) {
            throw new RuntimeException('Icon not found.');
        }
        $usageMap = customIconUsageMap();
        $refs = is_array($usageMap[$name] ?? null) ? array_values($usageMap[$name]) : [];
        if (count($refs) > 0) {
            $previewNames = array_map(
                static fn(array $entry): string => trim((string)($entry['folderName'] ?? '')),
                array_slice($refs, 0, 3)
            );
            $previewNames = array_values(array_filter($previewNames, static fn(string $entry): bool => $entry !== ''));
            $suffix = count($refs) > 3 ? ' +' . (count($refs) - 3) . ' more' : '';
            $preview = count($previewNames) > 0 ? (' (' . implode(', ', $previewNames) . $suffix . ')') : '';
            throw new RuntimeException('Icon is in use by folder references and cannot be deleted.' . $preview);
        }
        if (!@unlink($path)) {
            throw new RuntimeException('Failed to delete icon.');
        }
        $meta = readCustomIconMetadataIndex();
        unset($meta[$name]);
        writeCustomIconMetadataIndex($meta);
        syncCustomIconPublicRuntime();
        appendCustomIconAuditEvent('icon_delete', 'ok', ['name' => $name]);
        return [
            'deleted' => $name,
            'stats' => customIconStorageStats($customDir),
            'health' => customIconDirectoryHealth()
        ];
    });
}

function handleCustomIconRenameAction(): array {
    return withCustomIconLock(true, static function (): array {
        $customDir = ensureCustomIconDirExists();
        $from = normalizeCustomIconFileNameInput((string)($_POST['from'] ?? ''));
        $toRaw = (string)($_POST['to'] ?? '');
        $fromPath = "$customDir/$from";
        if (!is_file($fromPath) || is_link($fromPath)) {
            throw new RuntimeException('Icon not found.');
        }
        $fromExt = strtolower((string)pathinfo($from, PATHINFO_EXTENSION));
        $to = sanitizeCustomIconTargetName($toRaw, $fromExt);
        if ($from === $to) {
            $meta = syncCustomIconMetadataIndex($customDir);
            $usageMap = customIconUsageMap();
            return [
                'icon' => buildCustomIconUploadResponse($from, $meta, false, false, '', 'multipart', $usageMap),
                'health' => customIconDirectoryHealth()
            ];
        }
        $toPath = "$customDir/$to";
        if (is_file($toPath) || is_link($toPath)) {
            throw new RuntimeException('An icon with that name already exists.');
        }
        if (!@rename($fromPath, $toPath)) {
            throw new RuntimeException('Failed to rename icon.');
        }
        $meta = readCustomIconMetadataIndex();
        $entry = is_array($meta[$from] ?? null) ? $meta[$from] : [];
        unset($meta[$from]);
        $entry['updatedAt'] = gmdate('c');
        $entry['size'] = max(0, (int)@filesize($toPath));
        $entry['mime'] = detectUploadedMimeType($toPath);
        if (trim((string)($entry['originalName'] ?? '')) === '') {
            $entry['originalName'] = $from;
        }
        $meta[$to] = $entry;
        writeCustomIconMetadataIndex($meta);
        syncCustomIconPublicRuntime();
        appendCustomIconAuditEvent('icon_rename', 'ok', ['from' => $from, 'to' => $to]);
        $usageMap = customIconUsageMap();
        if (isset($usageMap[$from])) {
            $usageMap[$to] = $usageMap[$from];
            unset($usageMap[$from]);
        }
        return [
            'icon' => buildCustomIconUploadResponse($to, $meta, false, false, '', 'multipart', $usageMap),
            'health' => customIconDirectoryHealth()
        ];
    });
}

function handleCustomIconUsageAction(): array {
    return withCustomIconLock(false, static function (): array {
        $name = normalizeCustomIconFileNameInput((string)($_REQUEST['name'] ?? ''));
        $usageMap = customIconUsageMap();
        $refs = is_array($usageMap[$name] ?? null) ? array_values($usageMap[$name]) : [];
        return [
            'name' => $name,
            'usageCount' => count($refs),
            'inUse' => count($refs) > 0,
            'usage' => $refs
        ];
    });
}
