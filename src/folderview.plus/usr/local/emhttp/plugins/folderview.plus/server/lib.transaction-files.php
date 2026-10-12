<?php
function fvplusTransactionCaptureFile(string $path): array {
    fvplusAssertDurableWriteTarget($path);
    clearstatcache(true, $path);
    $stat = @lstat($path);
    if ($stat === false) {
        // Prove absence rather than treating inaccessible metadata as missing.
        $ancestor = $path;
        while (!is_dir(dirname($ancestor)) && dirname($ancestor) !== $ancestor) {
            $ancestor = dirname($ancestor);
        }
        $entries = @scandir(dirname($ancestor));
        if (!is_array($entries) || in_array(basename($ancestor), $entries, true)) {
            throw new RuntimeException('Transaction capture failed: unable to read file.');
        }
    } elseif (($stat['mode'] & 0170000) !== 0100000) {
        throw new RuntimeException('Transaction capture failed: file is not a regular file.');
    }
    $content = $stat === false ? '' : @file_get_contents($path);
    if ($content === false || ($stat !== false && strlen($content) !== $stat['size'])) {
        throw new RuntimeException('Transaction capture failed: unable to read file.');
    }
    return ['path' => $path, 'exists' => $stat !== false, 'content' => $content,
        'mode' => $stat === false ? null : ($stat['mode'] & 0777)];
}

function fvplusTransactionRestoreFiles(array $snapshots): void {
    $errors = [];
    foreach ($snapshots as $snapshot) {
        $path = (string)($snapshot['path'] ?? '');
        if ($path === '') continue;
        try {
            fvplusAssertDurableWriteTarget($path);
            if (!empty($snapshot['exists'])) {
                if (!is_string($snapshot['content'] ?? null)) {
                    throw new RuntimeException('Transaction capture failed: unable to read file.');
                }
                writeDurableFileAtomic($path, $snapshot['content']);
                if (isset($snapshot['mode']) && !@chmod($path, (int)$snapshot['mode'])) {
                    throw new RuntimeException('Transaction rollback failed: unable to restore file permissions.');
                }
            } elseif (file_exists($path) && !@unlink($path)) {
                throw new RuntimeException('Unable to remove newly-created transaction file.');
            }
        } catch (Throwable $error) {
            $errors[] = basename($path) . ': ' . $error->getMessage();
        }
    }
    if (count($errors) > 0) {
        throw new RuntimeException('Transaction rollback was incomplete: ' . implode('; ', $errors));
    }
}

function fvplusTransactionRestoreAfterFailure(array $snapshots, Throwable $error, callable $restoreFiles): void {
    try {
        $restoreFiles($snapshots);
    } catch (Throwable $rollbackError) {
        throw new RuntimeException($error->getMessage() . ' ' . $rollbackError->getMessage(), 0, $error);
    }
}
