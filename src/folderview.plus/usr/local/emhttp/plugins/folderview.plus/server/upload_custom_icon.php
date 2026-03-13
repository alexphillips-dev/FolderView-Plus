<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

const FVPLUS_CUSTOM_ICON_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const FVPLUS_CUSTOM_ICON_MAX_BYTES = 4194304;
const FVPLUS_CUSTOM_ICON_MAX_FILES = 2000;
const FVPLUS_CUSTOM_ICON_RATE_WINDOW_SECONDS = 60;
const FVPLUS_CUSTOM_ICON_RATE_MAX_UPLOADS = 24;
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
    global $sourceDir;
    return "$sourceDir/images/custom";
}

function ensureCustomIconDirExists(): string {
    $path = customIconDirPath();
    if (!is_dir($path)) {
        @mkdir($path, 0770, true);
    }
    if (!is_dir($path) || !is_writable($path)) {
        throw new RuntimeException('Custom icon directory is not writable.');
    }
    return $path;
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

function countCustomIconsInDirectory(string $directory): int {
    if (!is_dir($directory)) {
        return 0;
    }
    $count = 0;
    $items = @scandir($directory) ?: [];
    foreach ($items as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        if ($name !== basename($name)) {
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
        $count += 1;
    }
    return $count;
}

function enforceCustomIconStorageLimit(string $directory): void {
    if (countCustomIconsInDirectory($directory) >= FVPLUS_CUSTOM_ICON_MAX_FILES) {
        throw new RuntimeException('Custom icon storage limit reached. Remove old icons before uploading more.');
    }
}

function sanitizeCustomIconBasename(string $value): string {
    $name = trim($value);
    $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $name);
    $name = trim((string)$name, '.-_');
    if ($name === '') {
        $name = 'icon';
    }
    if (strlen($name) > 80) {
        $name = substr($name, 0, 80);
        $name = trim($name, '.-_');
        if ($name === '') {
            $name = 'icon';
        }
    }
    return $name;
}

function detectUploadedMimeType(string $path): string {
    if (function_exists('finfo_open') && function_exists('finfo_file')) {
        $finfo = @finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = (string)@finfo_file($finfo, $path);
            @finfo_close($finfo);
            return strtolower(trim($mime));
        }
    }
    return '';
}

function appearsToBeSvg(string $path): bool {
    $chunk = @file_get_contents($path, false, null, 0, 4096);
    if (!is_string($chunk) || $chunk === '') {
        return false;
    }
    $normalized = strtolower((string)$chunk);
    return strpos($normalized, '<svg') !== false;
}

function validateAndNormalizeSvgContent(string $tmpPath): void {
    $raw = @file_get_contents($tmpPath);
    if (!is_string($raw) || $raw === '') {
        throw new RuntimeException('Invalid SVG icon file.');
    }
    if (strlen($raw) > FVPLUS_CUSTOM_ICON_MAX_BYTES) {
        throw new RuntimeException('SVG icon exceeds 4MB limit.');
    }
    if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
        $raw = substr($raw, 3);
    }
    if (!preg_match('/<\s*svg\b/i', $raw)) {
        throw new RuntimeException('Invalid SVG icon file.');
    }

    $blockedPatterns = [
        '/<\s*script\b/i',
        '/<\s*iframe\b/i',
        '/<\s*object\b/i',
        '/<\s*embed\b/i',
        '/<\s*foreignObject\b/i',
        '/<!\s*doctype/i',
        '/<!\s*entity/i',
        '/\bon[a-z]+\s*=/i',
        '/\b(?:xlink:href|href|src)\s*=\s*["\']\s*(?:javascript:|vbscript:|data:|https?:|ftp:|file:|\/\/)/i',
        '/\burl\(\s*["\']?\s*(?:javascript:|vbscript:|data:|https?:|ftp:|file:|\/\/)/i',
        '/@\s*import\b/i'
    ];
    foreach ($blockedPatterns as $pattern) {
        if (@preg_match($pattern, $raw) === 1) {
            throw new RuntimeException('SVG contains blocked content.');
        }
    }

    if (function_exists('libxml_use_internal_errors') && function_exists('simplexml_load_string')) {
        $prev = libxml_use_internal_errors(true);
        $xml = @simplexml_load_string($raw, 'SimpleXMLElement', LIBXML_NONET);
        $errors = libxml_get_errors();
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        if ($xml === false || !empty($errors)) {
            throw new RuntimeException('Invalid SVG icon file.');
        }
    }

    if (@file_put_contents($tmpPath, $raw, LOCK_EX) === false) {
        throw new RuntimeException('Unable to process uploaded SVG icon.');
    }
}

function appearsToBeIco(string $path): bool {
    $chunk = @file_get_contents($path, false, null, 0, 4);
    if (!is_string($chunk) || strlen($chunk) < 4) {
        return false;
    }
    return $chunk === "\x00\x00\x01\x00";
}

function validateUploadedIcon(string $tmpPath, string $extension): void {
    $mime = detectUploadedMimeType($tmpPath);
    $mimeByExt = [
        'png' => ['image/png', 'image/x-png'],
        'jpg' => ['image/jpeg', 'image/pjpeg'],
        'jpeg' => ['image/jpeg', 'image/pjpeg'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
        'svg' => ['image/svg+xml', 'application/xml', 'text/xml', 'text/plain'],
        'bmp' => ['image/bmp', 'image/x-ms-bmp'],
        'ico' => ['image/x-icon', 'image/vnd.microsoft.icon', 'application/octet-stream'],
        'avif' => ['image/avif', 'application/octet-stream']
    ];

    $expected = $mimeByExt[$extension] ?? [];
    if ($mime !== '' && !in_array($mime, $expected, true)) {
        throw new RuntimeException('Uploaded file type does not match extension.');
    }

    if ($extension === 'svg' && !appearsToBeSvg($tmpPath)) {
        throw new RuntimeException('Invalid SVG icon file.');
    }
    if ($extension === 'svg') {
        validateAndNormalizeSvgContent($tmpPath);
    }

    if ($extension === 'ico' && !appearsToBeIco($tmpPath)) {
        throw new RuntimeException('Invalid ICO icon file.');
    }

    if ($extension !== 'svg' && $extension !== 'ico' && $extension !== 'avif' && function_exists('getimagesize')) {
        $imageInfo = @getimagesize($tmpPath);
        if (!is_array($imageInfo) || count($imageInfo) < 2) {
            throw new RuntimeException('Uploaded file is not a valid image.');
        }
    }
}

function nextAvailableCustomIconName(string $directory, string $basename, string $extension): string {
    $candidate = "$basename.$extension";
    if (!file_exists("$directory/$candidate")) {
        return $candidate;
    }
    for ($index = 1; $index <= 9999; $index++) {
        $candidate = "{$basename}-{$index}.{$extension}";
        if (!file_exists("$directory/$candidate")) {
            return $candidate;
        }
    }
    throw new RuntimeException('Unable to allocate unique file name.');
}

function uploadErrorMessage(int $errorCode): string {
    switch ($errorCode) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'Uploaded file is too large.';
        case UPLOAD_ERR_PARTIAL:
            return 'Upload was incomplete. Try again.';
        case UPLOAD_ERR_NO_FILE:
            return 'No file was selected.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Upload temporary directory is missing.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Unable to write uploaded file.';
        case UPLOAD_ERR_EXTENSION:
            return 'Upload blocked by a server extension.';
        default:
            return 'Upload failed.';
    }
}

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    enforceCustomIconUploadRateLimit();

    if (!isset($_FILES['icon']) || !is_array($_FILES['icon'])) {
        throw new RuntimeException('No icon file uploaded.');
    }

    $upload = $_FILES['icon'];
    $error = (int)($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException(uploadErrorMessage($error));
    }

    $size = (int)($upload['size'] ?? 0);
    if ($size <= 0) {
        throw new RuntimeException('Uploaded file is empty.');
    }
    if ($size > FVPLUS_CUSTOM_ICON_MAX_BYTES) {
        throw new RuntimeException('Uploaded file exceeds 4MB limit.');
    }

    $tmpPath = (string)($upload['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        throw new RuntimeException('Invalid upload source.');
    }

    $originalName = (string)($upload['name'] ?? 'icon');
    $extension = strtolower((string)pathinfo($originalName, PATHINFO_EXTENSION));
    if ($extension === '' || !in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) {
        throw new RuntimeException('Unsupported icon format.');
    }

    validateUploadedIcon($tmpPath, $extension);

    $customDir = ensureCustomIconDirExists();
    enforceCustomIconStorageLimit($customDir);
    $baseName = sanitizeCustomIconBasename((string)pathinfo($originalName, PATHINFO_FILENAME));
    $fileName = nextAvailableCustomIconName($customDir, $baseName, $extension);
    $targetPath = "$customDir/$fileName";

    if (!@move_uploaded_file($tmpPath, $targetPath)) {
        throw new RuntimeException('Unable to store uploaded icon.');
    }

    @chmod($targetPath, 0644);
    $version = (int)@filemtime($targetPath);
    if ($version <= 0) {
        $version = time();
    }

    return [
        'name' => $fileName,
        'url' => '/plugins/folderview.plus/images/custom/' . rawurlencode($fileName) . '?v=' . $version,
        'path' => '/usr/local/emhttp/plugins/folderview.plus/images/custom/' . $fileName
    ];
});

$GLOBALS['fvplus_custom_icon_response_sent'] = true;
