<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

const FVPLUS_CUSTOM_ICON_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const FVPLUS_CUSTOM_ICON_MAX_BYTES = 4194304;
const FVPLUS_CUSTOM_ICON_MAX_FILES = 2000;
const FVPLUS_CUSTOM_ICON_MAX_TOTAL_BYTES = 268435456;
const FVPLUS_CUSTOM_ICON_RATE_WINDOW_SECONDS = 60;
const FVPLUS_CUSTOM_ICON_RATE_MAX_UPLOADS = 24;
const FVPLUS_CUSTOM_ICON_OPTIMIZE_MAX_DIMENSION = 1024;
const FVPLUS_CUSTOM_ICON_OPTIMIZE_JPEG_QUALITY = 90;
const FVPLUS_CUSTOM_ICON_OPTIMIZE_PNG_COMPRESSION = 6;
const FVPLUS_CUSTOM_ICON_METADATA_SCHEMA_VERSION = 1;
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
    return '/usr/local/emhttp/plugins/folderview.plus/images/custom/' . $fileName;
}

function readCustomIconMetadataIndex(): array {
    $path = customIconMetadataPath();
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
    $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || $encoded === '') {
        return;
    }
    @file_put_contents($path, $encoded . "\n", LOCK_EX);
    @chmod($path, 0644);
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

function startsWithString(string $value, string $prefix): bool {
    if ($prefix === '') {
        return true;
    }
    return substr($value, 0, strlen($prefix)) === $prefix;
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

function validateSvgStyleDeclarationList(string $styleValue): void {
    $trimmed = trim($styleValue);
    if ($trimmed === '') {
        return;
    }
    $allowedProperties = array_map(static fn($name) => strtolower((string)$name), FVPLUS_CUSTOM_ICON_SVG_ALLOWED_STYLE_PROPERTIES);
    $declarations = explode(';', $trimmed);
    foreach ($declarations as $declaration) {
        $entry = trim($declaration);
        if ($entry === '') {
            continue;
        }
        $parts = explode(':', $entry, 2);
        if (count($parts) !== 2) {
            throw new RuntimeException('SVG style declaration is invalid.');
        }
        $property = strtolower(trim((string)$parts[0]));
        $value = trim((string)$parts[1]);
        if ($property === '' || !in_array($property, $allowedProperties, true)) {
            throw new RuntimeException("SVG style property \"$property\" is not allowed.");
        }
        if ($value === '') {
            continue;
        }
        if (@preg_match('/(?:javascript:|vbscript:|data:|https?:|ftp:|file:|\/\/|expression\s*\(|behavior\s*:|@import)/i', $value) === 1) {
            throw new RuntimeException('SVG style contains blocked content.');
        }
    }
}

function enforceSvgAllowlistConstraints(string $raw): void {
    if (!(class_exists('DOMDocument') && function_exists('libxml_use_internal_errors'))) {
        return;
    }
    $previous = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $loaded = @$dom->loadXML($raw, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    $errors = libxml_get_errors();
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$loaded || !empty($errors)) {
        throw new RuntimeException('Invalid SVG icon file.');
    }

    $allowedElements = array_map(static fn($name) => strtolower((string)$name), FVPLUS_CUSTOM_ICON_SVG_ALLOWED_ELEMENTS);
    $allowedAttrs = array_map(static fn($name) => strtolower((string)$name), FVPLUS_CUSTOM_ICON_SVG_ALLOWED_ATTRIBUTES);
    $nodes = $dom->getElementsByTagName('*');
    foreach ($nodes as $node) {
        if (!$node instanceof DOMElement) {
            continue;
        }
        $tagName = strtolower((string)($node->localName ?: $node->nodeName));
        if (!in_array($tagName, $allowedElements, true)) {
            throw new RuntimeException("SVG contains unsupported element: $tagName");
        }
        if (!$node->hasAttributes()) {
            continue;
        }
        foreach ($node->attributes as $attribute) {
            if (!$attribute instanceof DOMAttr) {
                continue;
            }
            $attrName = strtolower((string)$attribute->nodeName);
            $attrValue = trim((string)$attribute->nodeValue);
            if (startsWithString($attrName, 'on')) {
                throw new RuntimeException('SVG contains blocked event handler attributes.');
            }
            if (!in_array($attrName, $allowedAttrs, true)) {
                throw new RuntimeException("SVG contains unsupported attribute: $attrName");
            }
            if (($attrName === 'href' || $attrName === 'xlink:href') && $attrValue !== '' && !startsWithString($attrValue, '#')) {
                throw new RuntimeException('SVG references external resources.');
            }
            if ($attrName === 'style') {
                validateSvgStyleDeclarationList($attrValue);
                continue;
            }
            if (@preg_match('/(?:javascript:|vbscript:|data:|https?:|ftp:|file:|\/\/)/i', $attrValue) === 1) {
                throw new RuntimeException('SVG contains blocked URI content.');
            }
        }
    }
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
    enforceSvgAllowlistConstraints($raw);

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

function readImageDimensions(string $path): array {
    if (!function_exists('getimagesize')) {
        return ['width' => 0, 'height' => 0];
    }
    $info = @getimagesize($path);
    if (!is_array($info) || count($info) < 2) {
        return ['width' => 0, 'height' => 0];
    }
    return [
        'width' => max(0, (int)$info[0]),
        'height' => max(0, (int)$info[1])
    ];
}

function optimizeUploadedRasterIcon(string $tmpPath, string $extension): array {
    $dims = readImageDimensions($tmpPath);
    $width = (int)$dims['width'];
    $height = (int)$dims['height'];
    if ($width <= 0 || $height <= 0) {
        return [
            'optimized' => false,
            'width' => 0,
            'height' => 0,
            'size' => max(0, (int)@filesize($tmpPath))
        ];
    }

    if (!in_array($extension, ['jpg', 'jpeg', 'png'], true)) {
        return [
            'optimized' => false,
            'width' => $width,
            'height' => $height,
            'size' => max(0, (int)@filesize($tmpPath))
        ];
    }

    if (!function_exists('imagecreatetruecolor') || !function_exists('imagecopyresampled')) {
        return [
            'optimized' => false,
            'width' => $width,
            'height' => $height,
            'size' => max(0, (int)@filesize($tmpPath))
        ];
    }

    $source = null;
    if ($extension === 'png' && function_exists('imagecreatefrompng')) {
        $source = @imagecreatefrompng($tmpPath);
    } elseif (($extension === 'jpg' || $extension === 'jpeg') && function_exists('imagecreatefromjpeg')) {
        $source = @imagecreatefromjpeg($tmpPath);
    }

    if (!is_resource($source) && !is_object($source)) {
        return [
            'optimized' => false,
            'width' => $width,
            'height' => $height,
            'size' => max(0, (int)@filesize($tmpPath))
        ];
    }

    $maxDim = FVPLUS_CUSTOM_ICON_OPTIMIZE_MAX_DIMENSION;
    $ratio = min(1, $maxDim / max($width, $height));
    $targetW = max(1, (int)round($width * $ratio));
    $targetH = max(1, (int)round($height * $ratio));
    $target = imagecreatetruecolor($targetW, $targetH);
    if (!is_resource($target) && !is_object($target)) {
        if (function_exists('imagedestroy')) {
            @imagedestroy($source);
        }
        return [
            'optimized' => false,
            'width' => $width,
            'height' => $height,
            'size' => max(0, (int)@filesize($tmpPath))
        ];
    }

    if ($extension === 'png') {
        @imagealphablending($target, false);
        @imagesavealpha($target, true);
        $transparent = @imagecolorallocatealpha($target, 0, 0, 0, 127);
        if (is_int($transparent)) {
            @imagefilledrectangle($target, 0, 0, $targetW, $targetH, $transparent);
        }
    }

    @imagecopyresampled($target, $source, 0, 0, 0, 0, $targetW, $targetH, $width, $height);
    $written = false;
    if ($extension === 'png' && function_exists('imagepng')) {
        $written = @imagepng($target, $tmpPath, FVPLUS_CUSTOM_ICON_OPTIMIZE_PNG_COMPRESSION);
    } elseif (($extension === 'jpg' || $extension === 'jpeg') && function_exists('imagejpeg')) {
        $written = @imagejpeg($target, $tmpPath, FVPLUS_CUSTOM_ICON_OPTIMIZE_JPEG_QUALITY);
    }

    if (function_exists('imagedestroy')) {
        @imagedestroy($source);
        @imagedestroy($target);
    }

    return [
        'optimized' => $written === true && ($targetW !== $width || $targetH !== $height || in_array($extension, ['jpg', 'jpeg'], true)),
        'width' => $targetW,
        'height' => $targetH,
        'size' => max(0, (int)@filesize($tmpPath))
    ];
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

function decodeInlineIconPayload(string $payload): string {
    $raw = trim($payload);
    if ($raw === '') {
        throw new RuntimeException('No icon payload provided.');
    }

    $base64 = $raw;
    if (strpos($raw, 'base64,') !== false) {
        $parts = explode('base64,', $raw, 2);
        $base64 = (string)($parts[1] ?? '');
    }
    $base64 = preg_replace('/\s+/', '', $base64);
    if (!is_string($base64) || $base64 === '') {
        throw new RuntimeException('Invalid inline icon payload.');
    }

    $decoded = base64_decode($base64, true);
    if (!is_string($decoded) || $decoded === '') {
        throw new RuntimeException('Invalid inline icon payload.');
    }
    return $decoded;
}

function writeInlineIconTempFile(string $payload): array {
    $decoded = decodeInlineIconPayload($payload);
    $size = strlen($decoded);
    if ($size <= 0) {
        throw new RuntimeException('Uploaded file is empty.');
    }
    if ($size > FVPLUS_CUSTOM_ICON_MAX_BYTES) {
        throw new RuntimeException('Uploaded file exceeds 4MB limit.');
    }

    $tmpDir = is_dir('/tmp') ? '/tmp' : (string)sys_get_temp_dir();
    $tmpPath = @tempnam($tmpDir, 'fvplus-icon-');
    if (!is_string($tmpPath) || $tmpPath === '') {
        throw new RuntimeException('Unable to allocate temporary upload file.');
    }

    if (@file_put_contents($tmpPath, $decoded, LOCK_EX) === false) {
        @unlink($tmpPath);
        throw new RuntimeException('Unable to write temporary upload data.');
    }

    return [
        'tmpPath' => $tmpPath,
        'size' => $size
    ];
}

function resolveCustomIconUploadInput(): array {
    if (isset($_FILES['icon']) && is_array($_FILES['icon'])) {
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

        return [
            'tmpPath' => $tmpPath,
            'size' => $size,
            'originalName' => $originalName,
            'extension' => $extension,
            'isHttpUpload' => true,
            'cleanupPath' => ''
        ];
    }

    $inlinePayload = (string)($_POST['icon_inline_data'] ?? '');
    $inlineName = (string)($_POST['icon_inline_name'] ?? 'icon');
    if (trim($inlinePayload) === '') {
        throw new RuntimeException('No icon file uploaded.');
    }

    $extension = strtolower((string)pathinfo($inlineName, PATHINFO_EXTENSION));
    if ($extension === '' || !in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) {
        throw new RuntimeException('Unsupported icon format.');
    }

    $tmp = writeInlineIconTempFile($inlinePayload);
    $tmpPath = (string)($tmp['tmpPath'] ?? '');
    if ($tmpPath === '') {
        throw new RuntimeException('Invalid upload source.');
    }

    return [
        'tmpPath' => $tmpPath,
        'size' => (int)($tmp['size'] ?? 0),
        'originalName' => trim($inlineName) !== '' ? $inlineName : 'icon.' . $extension,
        'extension' => $extension,
        'isHttpUpload' => false,
        'cleanupPath' => $tmpPath
    ];
}

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

function customIconListRows(string $directory, string $search = '', string $sort = 'newest'): array {
    $meta = syncCustomIconMetadataIndex($directory);
    $files = listCustomIconsInDirectory($directory);
    $rows = [];
    $needle = strtolower(trim($search));
    foreach ($files as $name => $file) {
        $entry = customIconMetadataForResponse($name, $meta);
        $searchHaystack = strtolower($name . ' ' . (string)$entry['originalName'] . ' ' . (string)$entry['hash']);
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
            'optimized' => ($entry['optimized'] ?? false) === true
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

function buildCustomIconUploadResponse(string $name, array $meta, bool $duplicate = false, bool $replaced = false, string $message = '', string $uploadMode = 'multipart'): array {
    $response = [
        'name' => $name,
        'url' => customIconPublicUrl($name),
        'path' => customIconPublicPath($name),
        'duplicate' => $duplicate,
        'replaced' => $replaced,
        'uploadMode' => $uploadMode,
        'metadata' => customIconMetadataForResponse($name, $meta),
        'stats' => customIconStorageStats(customIconDirPath())
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
        $customDir = ensureCustomIconDirExists();
        $meta = syncCustomIconMetadataIndex($customDir);

        if ($dedupeByHash) {
            $duplicateName = findCustomIconNameByHash($meta, $hash);
            if ($duplicateName !== '') {
                $response = buildCustomIconUploadResponse($duplicateName, $meta, true, false, 'Identical icon already exists; reusing existing file.', $uploadMode);
                appendCustomIconAuditEvent('icon_upload', 'ok', [
                    'result' => 'deduplicated',
                    'name' => $duplicateName,
                    'hash' => $hash,
                    'mode' => $uploadMode
                ]);
                return $response;
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

        $stored = false;
        if ($isHttpUpload) {
            $stored = @move_uploaded_file($tmpPath, $targetPath);
        } else {
            if (@rename($tmpPath, $targetPath)) {
                $stored = true;
                $cleanupPath = '';
            } elseif (@copy($tmpPath, $targetPath)) {
                $stored = true;
            }
        }

        if (!$stored) {
            throw new RuntimeException('Unable to store uploaded icon.');
        }
        if ($cleanupPath !== '' && is_file($cleanupPath)) {
            @unlink($cleanupPath);
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
        $message = $replaced ? 'Existing icon replaced.' : 'Icon uploaded successfully.';
        $response = buildCustomIconUploadResponse($targetName, $meta, false, $replaced, $message, $uploadMode);
        appendCustomIconAuditEvent('icon_upload', 'ok', [
            'result' => $replaced ? 'replaced' : 'uploaded',
            'name' => $targetName,
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
    $customDir = ensureCustomIconDirExists();
    $search = trim((string)($_REQUEST['query'] ?? ''));
    $sort = trim((string)($_REQUEST['sort'] ?? 'newest'));
    return [
        'icons' => customIconListRows($customDir, $search, $sort),
        'stats' => customIconStorageStats($customDir)
    ];
}

function handleCustomIconStatsAction(): array {
    $customDir = ensureCustomIconDirExists();
    syncCustomIconMetadataIndex($customDir);
    return [
        'stats' => customIconStorageStats($customDir)
    ];
}

function handleCustomIconDeleteAction(): array {
    $customDir = ensureCustomIconDirExists();
    $name = normalizeCustomIconFileNameInput((string)($_POST['name'] ?? ''));
    $path = "$customDir/$name";
    if (!is_file($path)) {
        throw new RuntimeException('Icon not found.');
    }
    if (!@unlink($path)) {
        throw new RuntimeException('Failed to delete icon.');
    }
    $meta = readCustomIconMetadataIndex();
    unset($meta[$name]);
    writeCustomIconMetadataIndex($meta);
    appendCustomIconAuditEvent('icon_delete', 'ok', ['name' => $name]);
    return [
        'deleted' => $name,
        'stats' => customIconStorageStats($customDir)
    ];
}

function handleCustomIconRenameAction(): array {
    $customDir = ensureCustomIconDirExists();
    $from = normalizeCustomIconFileNameInput((string)($_POST['from'] ?? ''));
    $toRaw = (string)($_POST['to'] ?? '');
    $fromPath = "$customDir/$from";
    if (!is_file($fromPath)) {
        throw new RuntimeException('Icon not found.');
    }
    $fromExt = strtolower((string)pathinfo($from, PATHINFO_EXTENSION));
    $to = sanitizeCustomIconTargetName($toRaw, $fromExt);
    if ($from === $to) {
        $meta = syncCustomIconMetadataIndex($customDir);
        return [
            'icon' => buildCustomIconUploadResponse($from, $meta)
        ];
    }
    $toPath = "$customDir/$to";
    if (is_file($toPath)) {
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
    appendCustomIconAuditEvent('icon_rename', 'ok', ['from' => $from, 'to' => $to]);
    return [
        'icon' => buildCustomIconUploadResponse($to, $meta)
    ];
}

fvplus_json_try(function (): array {
    $action = strtolower(trim((string)($_REQUEST['action'] ?? 'upload')));
    if ($action === 'list') {
        return handleCustomIconListAction();
    }
    if ($action === 'stats') {
        return handleCustomIconStatsAction();
    }
    if ($action === 'delete') {
        requireMutationRequestGuard();
        return handleCustomIconDeleteAction();
    }
    if ($action === 'rename') {
        requireMutationRequestGuard();
        return handleCustomIconRenameAction();
    }
    if ($action === 'upload' || $action === '') {
        requireMutationRequestGuard();
        return handleCustomIconUploadAction();
    }
    throw new RuntimeException('Unsupported action.');
});

$GLOBALS['fvplus_custom_icon_response_sent'] = true;
