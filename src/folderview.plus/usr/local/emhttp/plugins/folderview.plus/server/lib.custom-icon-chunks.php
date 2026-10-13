<?php
const FVPLUS_ICON_CHUNK_BYTES = 524286;
function customIconUploadStageDirectory(): string {
    $override = PHP_SAPI === 'cli' ? trim((string)getenv('FVPLUS_TEST_ICON_STAGE_DIR')) : '';
    $root = is_dir('/tmp') ? '/tmp' : (string)sys_get_temp_dir();
    $directory = $override !== '' ? $override : rtrim($root, '/\\') . '/folderview-plus-uploads';
    if (is_link($directory)) throw new RuntimeException('Upload staging directory is unsafe.');
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create private upload staging directory.');
    }
    @chmod($directory, 0700);
    return $directory;
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

    $decoded = base64_decode(strtr($base64, '-_', '+/'), true);
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
        throw new RuntimeException('Uploaded file exceeds 16MB limit.');
    }

    $tmpDir = customIconUploadStageDirectory();
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

function stageCustomIconUploadChunk(): array {
    if (($GLOBALS['fvplusMutationGuardComplete'] ?? false) !== true) {
        throw new RuntimeException('Blocked by request guard.');
    }
    $id = (string)($_POST['icon_upload_id'] ?? '');
    $index = filter_var($_POST['icon_chunk_index'] ?? null, FILTER_VALIDATE_INT);
    $count = filter_var($_POST['icon_chunk_count'] ?? null, FILTER_VALIDATE_INT);
    $size = filter_var($_POST['icon_total_bytes'] ?? null, FILTER_VALIDATE_INT);
    $encoded = (string)($_POST['icon_inline_data'] ?? '');
    if (!preg_match('/^[a-f0-9]{32}$/D', $id) || $index === false || $count === false || $size === false
        || $size < 1 || $size > FVPLUS_CUSTOM_ICON_MAX_BYTES || $index < 0 || $index >= $count
        || $count !== (int)ceil($size / FVPLUS_ICON_CHUNK_BYTES)
        || strlen($encoded) > 4 * (FVPLUS_ICON_CHUNK_BYTES / 3)
        || !preg_match('/^[A-Za-z0-9_-]+={0,2}$/D', $encoded)) {
        throw new RuntimeException('Invalid inline icon payload.');
    }
    $decoded = decodeInlineIconPayload($encoded);
    if (strlen($decoded) !== min(FVPLUS_ICON_CHUNK_BYTES, $size - $index * FVPLUS_ICON_CHUNK_BYTES)) {
        throw new RuntimeException('Upload was incomplete. Try again.');
    }
    $name = basename(trim((string)($_POST['icon_inline_name'] ?? '')));
    $extension = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($extension, FVPLUS_CUSTOM_ICON_EXTENSIONS, true)) throw new RuntimeException('Unsupported icon format.');
    $directory = customIconUploadStageDirectory();
    // Only our private staging files are eligible for expiry; abandoned uploads never become icons.
    $files = glob($directory . '/fv-chunk-*') ?: [];
    foreach ($files as $file) {
        if (preg_match('/^fv-chunk-[a-f0-9]{32}\.(part|json)$/D', basename($file))
            && (is_link($file) || (int)@filemtime($file) < time() - 300)) @unlink($file);
    }
    $dataPath = $directory . '/fv-chunk-' . $id . '.part';
    $metaPath = $directory . '/fv-chunk-' . $id . '.json';
    clearstatcache(true, $dataPath);
    if (is_link($dataPath) || is_link($metaPath)) throw new RuntimeException('Upload staging directory is unsafe.');
    $owner = hash('sha256', getConfiguredRequestToken() . "\0" . (string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $identity = ['owner' => $owner, 'count' => $count, 'bytes' => $size, 'name' => $name,
        'replace' => normalizeBool($_POST['replace'] ?? false, false), 'dedupe' => normalizeBool($_POST['dedupe'] ?? true, true)];
    if ($index === 0) {
        enforceCustomIconUploadRateLimit();
        if (file_exists($dataPath) || file_exists($metaPath)) throw new RuntimeException('Upload was incomplete. Try again.');
        if (count(glob($directory . '/fv-chunk-*.part') ?: []) >= 4) {
            throw new RuntimeException('Custom icon store is busy. Please try again.');
        }
        $handle = @fopen($dataPath, 'x+b');
        $state = $identity;
    } else {
        $state = json_decode((string)@file_get_contents($metaPath), true);
        if (!is_array($state) || ($state['next'] ?? -1) !== $index
            || array_intersect_key($state, $identity) !== $identity || !is_file($dataPath)
            || (int)@filesize($dataPath) !== $index * FVPLUS_ICON_CHUNK_BYTES) {
            throw new RuntimeException('Upload was incomplete. Try again.');
        }
        $handle = @fopen($dataPath, 'ab');
    }
    if (!is_resource($handle)) throw new RuntimeException('Unable to write temporary upload data.');
    @chmod($dataPath, 0600);
    try {
        $offset = 0;
        while ($offset < strlen($decoded)) {
            $written = @fwrite($handle, substr($decoded, $offset));
            if ($written === false || $written < 1) throw new RuntimeException('Unable to write temporary upload data.');
            $offset += $written;
        }
        @fclose($handle); $handle = null;
        $state['next'] = $index + 1;
        if ($state['next'] < $count) {
            $json = json_encode($state, JSON_UNESCAPED_SLASHES);
            if (!is_string($json) || @file_put_contents($metaPath, $json, LOCK_EX) !== strlen($json)) {
                throw new RuntimeException('Unable to write temporary upload data.');
            }
            @chmod($metaPath, 0600);
            return ['complete' => false, 'chunkAccepted' => true, 'nextChunk' => $state['next']];
        }
        clearstatcache(true, $dataPath);
        if ((int)@filesize($dataPath) !== $size) throw new RuntimeException('Upload was incomplete. Try again.');
        @unlink($metaPath);
        return ['complete' => true, 'tmpPath' => $dataPath, 'cleanupPath' => $dataPath,
            'extension' => $extension, 'originalName' => $name, 'isHttpUpload' => false];
    } catch (Throwable $error) {
        if (is_resource($handle)) @fclose($handle);
        @unlink($dataPath); @unlink($metaPath);
        throw $error;
    }
}
