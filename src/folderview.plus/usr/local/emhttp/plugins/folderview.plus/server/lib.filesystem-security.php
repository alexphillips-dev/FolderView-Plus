<?php

function fvplusNormalizeFilesystemPath(string $path): string {
    $normalized = str_replace('\\', '/', trim($path));
    $normalized = preg_replace('#/+#', '/', $normalized);
    // Generated storage targets must not change directories during resolution.
    if (is_string($normalized) && preg_match('#(?:^|/)\.{1,2}(?:/|$)#', $normalized)) {
        return '';
    }
    return is_string($normalized) ? rtrim($normalized, '/') : '';
}

function fvplusPathHasSymlinkComponent(string $path): bool {
    $cursor = $path;
    while ($cursor !== '' && $cursor !== '.' && $cursor !== DIRECTORY_SEPARATOR) {
        if (is_link($cursor)) {
            return true;
        }
        $parent = dirname($cursor);
        if ($parent === $cursor) {
            break;
        }
        $cursor = $parent;
    }
    return false;
}

function fvplusAssertDurableWriteTarget(string $path): void {
    global $configDir, $sourceDir;
    $normalizedPath = fvplusNormalizeFilesystemPath($path);
    // Validate the spelling used by the writer, including POSIX literal backslashes.
    if ($normalizedPath === '' || $path !== trim($path) || strpos($path, "\0") !== false
        || (DIRECTORY_SEPARATOR === '/' && strpos($path, '\\') !== false)) {
        throw new RuntimeException('Durable storage target path is invalid.');
    }
    if (is_link($path) || fvplusPathHasSymlinkComponent(dirname($path))) {
        throw new RuntimeException("Durable storage target contains a symbolic link: '" . basename($path) . "'.");
    }
    $allowedRoots = [
        fvplusNormalizeFilesystemPath((string)$configDir),
        fvplusNormalizeFilesystemPath((string)$sourceDir),
        '/var/lib/docker'
    ];
    if (PHP_SAPI === 'cli') {
        $testStorageRoot = fvplusNormalizeFilesystemPath((string)getenv('FVPLUS_TEST_STORAGE_DIR'));
        if ($testStorageRoot !== '') {
            $allowedRoots[] = $testStorageRoot;
        }
    }
    foreach ($allowedRoots as $root) {
        if ($root !== '' && ($normalizedPath === $root || strpos($normalizedPath, $root . '/') === 0)) {
            return;
        }
    }
    throw new RuntimeException("Durable storage target is outside an approved plugin or host directory: '" . basename($path) . "'.");
}
