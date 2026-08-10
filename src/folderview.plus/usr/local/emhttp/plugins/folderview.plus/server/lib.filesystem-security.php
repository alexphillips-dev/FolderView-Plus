<?php

function fvplusNormalizeFilesystemPath(string $path): string {
    $normalized = str_replace('\\', '/', trim($path));
    $normalized = preg_replace('#/+#', '/', $normalized);
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
    if (trim($path) === '' || strpos($path, "\0") !== false) {
        throw new RuntimeException('Durable storage target path is invalid.');
    }
    if (is_link($path) || fvplusPathHasSymlinkComponent(dirname($path))) {
        throw new RuntimeException("Durable storage target contains a symbolic link: '" . basename($path) . "'.");
    }
    $normalizedPath = fvplusNormalizeFilesystemPath($path);
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
