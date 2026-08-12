<?php
const FVPLUS_CUSTOM_ICON_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const FVPLUS_CUSTOM_ICON_MAX_BYTES = 4194304;
const FVPLUS_CUSTOM_ICON_MAX_FILES = 2000;
const FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES = 268435456;
const FVPLUS_CUSTOM_ICON_RATE_WINDOW_SECONDS = 60;
const FVPLUS_CUSTOM_ICON_RATE_MAX_UPLOADS = 24;
const FVPLUS_CUSTOM_ICON_LOCK_TIMEOUT_SECONDS = 10;
const FVPLUS_CUSTOM_ICON_OPTIMIZE_MAX_DIMENSION = 1024;
const FVPLUS_CUSTOM_ICON_OPTIMIZE_JPEG_QUALITY = 90;
const FVPLUS_CUSTOM_ICON_OPTIMIZE_PNG_COMPRESSION = 6;
const FVPLUS_CUSTOM_ICON_SVG_ALLOWED_ELEMENTS = [
    'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'image',
    'linearGradient', 'radialGradient', 'stop', 'pattern',
    'clipPath', 'mask', 'filter',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
    'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feDropShadow',
    'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur',
    'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset',
    'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
    'animate', 'animateMotion', 'animateTransform', 'set', 'mpath', 'marker'
];
const FVPLUS_CUSTOM_ICON_SVG_ALLOWED_ATTRIBUTES = [
    'id', 'class', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    'width', 'height', 'd', 'points', 'viewBox', 'preserveAspectRatio',
    'transform', 'fill', 'fill-rule', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
    'opacity', 'display', 'visibility', 'shape-rendering', 'text-rendering', 'vector-effect',
    'clip-path', 'clipPathUnits', 'clip-rule', 'mask', 'maskUnits', 'maskContentUnits',
    'filter', 'filterUnits', 'primitiveUnits', 'in', 'in2', 'result', 'stdDeviation', 'dx', 'dy',
    'operator', 'k1', 'k2', 'k3', 'k4', 'type', 'values', 'tableValues',
    'slope', 'intercept', 'amplitude', 'exponent', 'offset', 'surfaceScale',
    'specularConstant', 'specularExponent', 'lighting-color', 'azimuth', 'elevation',
    'baseFrequency', 'numOctaves', 'seed', 'stitchTiles', 'scale',
    'kernelMatrix', 'kernelUnitLength', 'targetX', 'targetY', 'divisor', 'bias', 'edgeMode', 'preserveAlpha',
    'gradientUnits', 'gradientTransform', 'spreadMethod', 'patternUnits', 'patternContentUnits', 'patternTransform',
    'stop-color', 'stop-opacity', 'flood-color', 'flood-opacity',
    'href', 'xlink:href', 'xmlns', 'xmlns:xlink', 'version',
    'attributeName', 'attributeType', 'from', 'to', 'by',
    'begin', 'dur', 'end', 'min', 'max', 'repeatCount', 'repeatDur',
    'calcMode', 'keyTimes', 'keySplines', 'keyPoints', 'path', 'rotate',
    'additive', 'accumulate', 'restart', 'style'
];
const FVPLUS_CUSTOM_ICON_SVG_ALLOWED_STYLE_PROPERTIES = [
    'fill', 'fill-rule', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
    'opacity', 'display', 'visibility', 'stop-color', 'stop-opacity',
    'flood-color', 'flood-opacity', 'vector-effect', 'shape-rendering', 'text-rendering',
    'transform'
];
const FVPLUS_CUSTOM_ICON_FATAL_TYPES = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR];

$GLOBALS['fvplus_custom_icon_response_sent'] = false;
register_shutdown_function(static function (): void {
    if (($GLOBALS['fvplus_custom_icon_response_sent'] ?? false) === true) {
        return;
    }

    $lastError = error_get_last();
    if (!is_array($lastError) || !in_array((int)($lastError['type'] ?? 0), FVPLUS_CUSTOM_ICON_FATAL_TYPES, true)) {
        return;
    }

    if (function_exists('ob_get_level')) {
        while (@ob_get_level() > 0) {
            @ob_end_clean();
        }
    }

    fvplus_json_error('Icon upload failed due to a server error. Check /tmp/folderview.plus.api-error.log for details.', 500);
});

function customIconDirPath(): string {
    return fvplusCustomIconDirPath();
}

function customIconRepairHintCommand(): string {
    return fvplusCustomIconRepairHintCommand();
}

function ensureCustomIconDirExists(bool $requireWritable = true): string {
    $health = fvplusEnsureCustomIconStorageReady($requireWritable);
    return (string)($health['storageDir'] ?? customIconDirPath());
}

function customIconDirectoryHealth(): array {
    $health = fvplusEnsureCustomIconStorageReady(false);
    $path = (string)($health['storageDir'] ?? customIconDirPath());
    $runtimePath = (string)($health['runtimeDir'] ?? fvplusCustomIconRuntimeDirPath());
    $existsAfter = is_dir($path);
    $writableAfter = $existsAfter && is_writable($path);
    return [
        'path' => $path,
        'exists' => $existsAfter,
        'writable' => $writableAfter,
        'repairAttempted' => ($health['repairAttempted'] ?? false) === true,
        'repairSucceeded' => ($health['repairSucceeded'] ?? false) === true,
        'repairHint' => (string)($health['repairHint'] ?? customIconRepairHintCommand()),
        'runtimePath' => $runtimePath,
        'publicMode' => (string)($health['publicMode'] ?? 'missing'),
        'publicReady' => ($health['publicReady'] ?? false) === true,
        'migratedFileCount' => max(0, (int)($health['migratedFileCount'] ?? 0)),
        'migratedMetadata' => ($health['migratedMetadata'] ?? false) === true,
        'mirrorCopiedCount' => max(0, (int)($health['mirrorCopiedCount'] ?? 0)),
        'mirrorPrunedCount' => max(0, (int)($health['mirrorPrunedCount'] ?? 0))
    ];
}

function customIconLockPath(): string {
    $tmpRoot = function_exists('sys_get_temp_dir') ? trim((string)sys_get_temp_dir()) : '/tmp';
    if ($tmpRoot === '') {
        $tmpRoot = '/tmp';
    }
    $normalized = rtrim(str_replace('\\', '/', $tmpRoot), '/');
    if ($normalized === '') {
        $normalized = '/tmp';
    }
    return $normalized . '/folderview.plus-custom-icons.lock';
}

function withCustomIconLock(bool $exclusive, callable $callback) {
    $directory = ensureCustomIconDirExists(false);
    if ($exclusive && !is_writable($directory)) {
        @chmod($directory, 0770);
    }
    if ($exclusive && !is_writable($directory)) {
        throw new RuntimeException('Custom icon directory is not writable. Run: ' . customIconRepairHintCommand());
    }
    $lockPath = customIconLockPath();
    $handle = @fopen($lockPath, 'c+');
    if (!is_resource($handle)) {
        throw new RuntimeException('Unable to open custom icon lock file. Run: ' . customIconRepairHintCommand());
    }
    $mode = $exclusive ? LOCK_EX : LOCK_SH;
    $start = microtime(true);
    $locked = false;
    while ((microtime(true) - $start) <= FVPLUS_CUSTOM_ICON_LOCK_TIMEOUT_SECONDS) {
        if (@flock($handle, $mode | LOCK_NB)) {
            $locked = true;
            break;
        }
        usleep(25000);
    }
    if (!$locked) {
        @fclose($handle);
        throw new RuntimeException('Custom icon store is busy. Please try again.');
    }
    try {
        return $callback();
    } finally {
        @flock($handle, LOCK_UN);
        @fclose($handle);
    }
}

function customIconMetadataPath(): string {
    return customIconDirPath() . '/.metadata.json';
}

function customIconPublicUrl(string $fileName): string {
    $path = customIconDirPath() . '/' . $fileName;
    $version = (int)@filemtime($path);
    if ($version <= 0) {
        $version = time();
    }
    return '/plugins/folderview.plus/images/custom/' . rawurlencode($fileName) . '?v=' . $version;
}

function customIconPublicPath(string $fileName): string {
    return customIconDirPath() . '/' . $fileName;
}

function syncCustomIconPublicRuntime(): array {
    try {
        return fvplusEnsureCustomIconStorageReady(false);
    } catch (Throwable $_error) {
        return [];
    }
}

function normalizeCustomIconReferencePath(string $value): string {
    $path = trim($value);
    if ($path === '') {
        return '';
    }
    $hashPos = strpos($path, '#');
    if ($hashPos !== false) {
        $path = substr($path, 0, $hashPos);
    }
    $queryPos = strpos($path, '?');
    if ($queryPos !== false) {
        $path = substr($path, 0, $queryPos);
    }
    $decoded = @rawurldecode($path);
    if (is_string($decoded) && $decoded !== '') {
        $path = $decoded;
    }
    $hostTrimmed = preg_replace('#^https?://[^/]+#i', '', $path);
    if (is_string($hostTrimmed) && $hostTrimmed !== '') {
        $path = $hostTrimmed;
    }
    return str_replace('\\', '/', trim($path));
}

function customIconNameFromReference(string $value): string {
    $normalized = normalizeCustomIconReferencePath($value);
    if ($normalized === '') {
        return '';
    }

    $prefixes = [
        '/plugins/folderview.plus/images/custom/',
        '/usr/local/emhttp/plugins/folderview.plus/images/custom/',
        'plugins/folderview.plus/images/custom/',
        'usr/local/emhttp/plugins/folderview.plus/images/custom/'
    ];
    $candidate = '';
    foreach ($prefixes as $prefix) {
        if (strpos($normalized, $prefix) === 0) {
            $candidate = basename(substr($normalized, strlen($prefix)));
            break;
        }
    }
    if ($candidate === '') {
        return '';
    }
    $safe = basename(trim($candidate));
    if ($safe === '' || $safe !== $candidate) {
        return '';
    }
    $extension = strtolower((string)pathinfo($safe, PATHINFO_EXTENSION));
    if ($extension === '' || !in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) {
        return '';
    }
    return $safe;
}

function customIconUsageMap(): array {
    $usage = [];
    foreach (['docker', 'vm'] as $type) {
        $folders = readRawFolderMap($type);
        foreach ($folders as $folderId => $folder) {
            if (!is_array($folder)) {
                continue;
            }
            $iconName = customIconNameFromReference((string)($folder['icon'] ?? ''));
            if ($iconName === '') {
                continue;
            }
            if (!isset($usage[$iconName]) || !is_array($usage[$iconName])) {
                $usage[$iconName] = [];
            }
            $usage[$iconName][] = [
                'type' => $type,
                'folderId' => (string)$folderId,
                'folderName' => trim((string)($folder['name'] ?? (string)$folderId))
            ];
        }
    }
    foreach ($usage as $name => $refs) {
        usort($refs, static function (array $a, array $b): int {
            $typeCmp = strcmp((string)($a['type'] ?? ''), (string)($b['type'] ?? ''));
            if ($typeCmp !== 0) {
                return $typeCmp;
            }
            return strcasecmp((string)($a['folderName'] ?? ''), (string)($b['folderName'] ?? ''));
        });
        $usage[$name] = array_values($refs);
    }
    return $usage;
}

function customIconUsageSummary(array $usageMap): array {
    $inUseIconCount = 0;
    $references = 0;
    foreach ($usageMap as $refs) {
        $count = is_array($refs) ? count($refs) : 0;
        if ($count <= 0) {
            continue;
        }
        $inUseIconCount += 1;
        $references += $count;
    }
    return [
        'inUseIconCount' => $inUseIconCount,
        'totalReferences' => $references
    ];
}

function readCustomIconMetadataIndex(): array {
    $path = customIconMetadataPath();
    $decoded = readJsonObjectFile($path);
    if (!is_array($decoded)) {
        $decoded = recoverJsonObjectFromLastGood($path);
    }
    if (!is_array($decoded)) {
        return [];
    }
    $items = is_array($decoded['items'] ?? null) ? $decoded['items'] : $decoded;
    if (!is_array($items)) {
        return [];
    }
    $normalized = [];
    foreach ($items as $name => $meta) {
        $safeName = basename((string)$name);
        if ($safeName === '' || $safeName !== (string)$name) {
            continue;
        }
        if (!is_array($meta)) {
            continue;
        }
        $normalized[$safeName] = [
            'originalName' => trim((string)($meta['originalName'] ?? $safeName)),
            'uploadedAt' => trim((string)($meta['uploadedAt'] ?? '')),
            'updatedAt' => trim((string)($meta['updatedAt'] ?? '')),
            'size' => max(0, (int)($meta['size'] ?? 0)),
            'hash' => strtolower(trim((string)($meta['hash'] ?? ''))),
            'mime' => trim((string)($meta['mime'] ?? '')),
            'width' => max(0, (int)($meta['width'] ?? 0)),
            'height' => max(0, (int)($meta['height'] ?? 0)),
            'optimized' => ($meta['optimized'] ?? false) === true
        ];
    }
    return $normalized;
}

function writeCustomIconMetadataIndex(array $items): void {
    $path = customIconMetadataPath();
    $payload = [
        'schemaVersion' => FVPLUS_CUSTOM_ICON_METADATA_SCHEMA_VERSION,
        'updatedAt' => gmdate('c'),
        'items' => $items
    ];
    writeJsonObjectWithLastGood($path, $payload);
}

function customIconRateDirPath(): string {
    $path = '/tmp/folderview.plus-cache/custom-icon-rate';
    if (!is_dir($path)) {
        @mkdir($path, 0770, true);
    }
    return $path;
}

function customIconUploadClientKey(): string {
    $raw = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $normalized = preg_replace('/[^A-Fa-f0-9:.]+/', '', $raw);
    if (!is_string($normalized) || trim($normalized) === '') {
        $normalized = 'unknown';
    }
    return strtolower($normalized);
}

function customIconUploadRatePath(string $clientKey): string {
    return customIconRateDirPath() . '/' . sha1($clientKey) . '.json';
}

function readCustomIconUploadRateBucket(string $path): array {
    if (!is_file($path)) {
        return [];
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }
    $timestamps = [];
    foreach ($decoded as $entry) {
        $timestamp = (int)$entry;
        if ($timestamp > 0) {
            $timestamps[] = $timestamp;
        }
    }
    sort($timestamps, SORT_NUMERIC);
    return $timestamps;
}

function writeCustomIconUploadRateBucket(string $path, array $timestamps): void {
    $encoded = json_encode(array_values($timestamps), JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) {
        return;
    }
    $tmpPath = $path . '.tmp';
    if (@file_put_contents($tmpPath, $encoded, LOCK_EX) !== false) {
        @rename($tmpPath, $path);
        @chmod($path, 0644);
        return;
    }
    @file_put_contents($path, $encoded, LOCK_EX);
    @chmod($path, 0644);
}

function enforceCustomIconUploadRateLimit(): void {
    $clientKey = customIconUploadClientKey();
    $bucketPath = customIconUploadRatePath($clientKey);
    $now = time();
    $windowStart = $now - FVPLUS_CUSTOM_ICON_RATE_WINDOW_SECONDS;
    $timestamps = array_values(array_filter(
        readCustomIconUploadRateBucket($bucketPath),
        static function ($entry) use ($windowStart, $now): bool {
            $timestamp = (int)$entry;
            return $timestamp >= $windowStart && $timestamp <= ($now + 5);
        }
    ));
    if (count($timestamps) >= FVPLUS_CUSTOM_ICON_RATE_MAX_UPLOADS) {
        throw new RuntimeException('Too many icon uploads. Please wait one minute and try again.');
    }
    $timestamps[] = $now;
    writeCustomIconUploadRateBucket($bucketPath, $timestamps);
}

function listCustomIconsInDirectory(string $directory): array {
    if (!is_dir($directory)) {
        return [];
    }
    $rows = [];
    foreach ((array)@scandir($directory) as $name) {
        if ($name === '.' || $name === '..' || $name !== basename($name)) {
            continue;
        }
        $path = "$directory/$name";
        if (!is_file($path)) {
            continue;
        }
        $extension = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
        if ($extension === '' || !in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) {
            continue;
        }
        $rows[$name] = [
            'name' => $name,
            'path' => $path,
            'size' => max(0, (int)@filesize($path)),
            'mtime' => max(0, (int)@filemtime($path)),
            'extension' => $extension
        ];
    }
    return $rows;
}

function customIconStorageStats(string $directory): array {
    $files = listCustomIconsInDirectory($directory);
    $totalBytes = 0;
    $oldest = 0;
    $newest = 0;
    foreach ($files as $item) {
        $size = max(0, (int)($item['size'] ?? 0));
        $mtime = max(0, (int)($item['mtime'] ?? 0));
        $totalBytes += $size;
        if ($oldest === 0 || ($mtime > 0 && $mtime < $oldest)) {
            $oldest = $mtime;
        }
        if ($mtime > $newest) {
            $newest = $mtime;
        }
    }
    $count = count($files);
    $remainingFiles = max(0, FVPLUS_CUSTOM_ICON_MAX_FILES - $count);
    $remainingBytes = max(0, FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES - $totalBytes);
    $warnings = [];
    if ($count >= FVPLUS_CUSTOM_ICON_MAX_FILES) {
        $warnings[] = 'File-count quota reached.';
    } elseif ($count >= (int)floor(FVPLUS_CUSTOM_ICON_MAX_FILES * 0.9)) {
        $warnings[] = 'File-count quota above 90%.';
    }
    if ($totalBytes >= FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES) {
        $warnings[] = 'Storage quota reached.';
    } elseif ($totalBytes >= (int)floor(FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES * 0.9)) {
        $warnings[] = 'Storage quota above 90%.';
    }
    return [
        'count' => $count,
        'totalBytes' => $totalBytes,
        'maxFiles' => FVPLUS_CUSTOM_ICON_MAX_FILES,
        'maxTotalBytes' => FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES,
        'remainingFiles' => $remainingFiles,
        'remainingBytes' => $remainingBytes,
        'oldest' => $oldest > 0 ? gmdate('c', $oldest) : null,
        'newest' => $newest > 0 ? gmdate('c', $newest) : null,
        'warnings' => $warnings
    ];
}

function enforceCustomIconStorageLimit(string $directory, int $incomingBytes = 0, string $replaceName = ''): void {
    $stats = customIconStorageStats($directory);
    $replace = basename(trim($replaceName));
    $existingSize = 0;
    if ($replace !== '') {
        $path = "$directory/$replace";
        if (is_file($path)) {
            $existingSize = max(0, (int)@filesize($path));
        }
    }
    $effectiveCount = (int)$stats['count'];
    if ($replace === '' && $incomingBytes > 0) {
        $effectiveCount += 1;
    }
    $effectiveBytes = (int)$stats['totalBytes'] + max(0, $incomingBytes) - $existingSize;

    if ($effectiveCount > FVPLUS_CUSTOM_ICON_MAX_FILES) {
        throw new RuntimeException('Custom icon storage limit reached. Remove old icons before uploading more.');
    }
    if ($effectiveBytes > FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES) {
        throw new RuntimeException('Custom icon storage byte limit reached. Remove old icons before uploading more.');
    }
}
