<?php
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

    $tmpRoot = is_dir('/tmp') ? '/tmp' : (string)sys_get_temp_dir();
    $tmpDir = rtrim($tmpRoot, '/\\') . '/folderview-plus-uploads';
    if (is_link($tmpDir)) {
        throw new RuntimeException('Upload staging directory is unsafe.');
    }
    if (!is_dir($tmpDir) && !@mkdir($tmpDir, 0700, true) && !is_dir($tmpDir)) {
        throw new RuntimeException('Unable to create private upload staging directory.');
    }
    @chmod($tmpDir, 0700);
    $tmpPath = @tempnam($tmpDir, 'fvplus-icon-');
    if (!is_string($tmpPath) || $tmpPath === '') {
        throw new RuntimeException('Unable to allocate temporary upload file.');
    }

    if (@file_put_contents($tmpPath, $decoded, LOCK_EX) === false) {
        @unlink($tmpPath);
        throw new RuntimeException('Unable to write temporary upload data.');
    }
    @chmod($tmpPath, 0600);

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
