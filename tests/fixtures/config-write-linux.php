<?php
// Native unprivileged PHP: byte/mode preservation and an actual read-only filesystem failure.
if (PHP_OS_FAMILY !== 'Linux' || !function_exists('posix_geteuid') || posix_geteuid() === 0) {
    throw new RuntimeException('This fixture requires unprivileged Linux PHP.');
}
$server = $argv[1]; $checks = 0;
function expectConfigWrite(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
    $GLOBALS['checks']++;
}
function linuxConfigWrite(array $request): array {
    global $server;
    $root = sys_get_temp_dir() . '/fvplus-config-write-linux-' . bin2hex(random_bytes(6));
    foreach ([$root, "$root/config", "$root/source", "$root/host"] as $dir) mkdir($dir, 0700);
    file_put_contents("$root/request.json", json_encode($request));
    $env = array_merge(getenv(), ['FVPLUS_TEST_CONFIG_DIR' => "$root/config", 'FVPLUS_TEST_SOURCE_DIR' => "$root/source",
        'FVPLUS_TEST_DOCUMENT_ROOT' => "$root/host", 'FVPLUS_TEST_STORAGE_DIR' => "$root/config"]);
    try {
        $process = proc_open([PHP_BINARY, __DIR__ . '/config-write.php', $server, $root],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env);
        $output = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0) throw new RuntimeException($errors);
        return json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    } finally {
        // Delete only this fixture's generated tree, using native PHP throughout.
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $entry) {
            if ($entry->isLink()) unlink($entry->getPathname());
            elseif ($entry->isDir()) { chmod($entry->getPathname(), 0700); rmdir($entry->getPathname()); }
            else unlink($entry->getPathname());
        }
        rmdir($root);
    }
}
foreach (['docker', 'vm'] as $type) foreach (['folder', 'prefs'] as $kind) {
    foreach (['primary-rename', 'metadata-open', 'metadata-rename'] as $stage) foreach ([false, true] as $first) {
        $result = linuxConfigWrite(compact('type', 'kind', 'stage', 'first') + ['modes' => !$first]);
        expectConfigWrite($result['error'] !== '', "$type/$kind/$stage must reject");
        expectConfigWrite($result['before'] === $result['after'], "$type/$kind/$stage must preserve every byte and mode");
        expectConfigWrite($result['temps'] === [], 'Failed writes must clean temporary files');
        if (!$first) {
            expectConfigWrite($result['after']['.json'][1] === 0600 && $result['after']['.prefs.json'][1] === 0640
                && $result['after']['.metadata.json'][1] === 0660, 'Restoration must retain actual POSIX permission bits');
        }
    }
    $result = linuxConfigWrite(compact('type', 'kind') + ['stage' => 'none', 'readOnlyAfterPrimary' => true, 'modes' => true]);
    $suffix = $kind === 'folder' ? '.json' : '.prefs.json';
    expectConfigWrite(str_contains($result['error'], 'read-only') && str_contains($result['error'], 'rollback was incomplete'),
        'An actual directory permission failure must report failed compensation');
    expectConfigWrite($result['after'][$suffix] !== $result['before'][$suffix], 'The permission fault must occur after primary rename');
    expectConfigWrite($result['after'][$suffix . '.lastgood'] === $result['before'][$suffix . '.lastgood'], 'Keep original recovery bytes');
    expectConfigWrite($result['after']['.metadata.json'] === $result['before']['.metadata.json'], 'Keep the previous revision sidecar');
    expectConfigWrite($result['runtimeSnapshot']['ok'] === false, 'Do not replace failure diagnostics with restoration success');
    $result = linuxConfigWrite(compact('type', 'kind') + ['stage' => 'none', 'readOnlyBeforePrimary' => true, 'modes' => true]);
    expectConfigWrite(str_contains($result['error'], 'read-only') && !str_contains($result['error'], 'rollback was incomplete'),
        'A failure before any atomic commit must not report compensation failure');
    expectConfigWrite($result['before'] === $result['after'], 'A rejected first atomic write must preserve every byte and mode');
    expectConfigWrite($result['runtimeSnapshot']['ok'] === false, 'Preserve the original precommit failure snapshot');
}
echo json_encode(['checks' => $checks, 'php' => PHP_VERSION, 'uid' => posix_geteuid()]);
