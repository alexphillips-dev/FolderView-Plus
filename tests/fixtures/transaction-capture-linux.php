<?php
// Run as an unprivileged Linux user: exercise real permissions and links, no I/O stubs.
$server = $argv[1];
$root = sys_get_temp_dir() . '/fvplus-capture-linux-' . bin2hex(random_bytes(6));
foreach ([$root, "$root/config", "$root/source", "$root/host"] as $dir) mkdir($dir, 0700);
putenv("FVPLUS_TEST_CONFIG_DIR=$root/config"); putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
putenv("FVPLUS_TEST_DOCUMENT_ROOT=$root/host"); putenv("FVPLUS_TEST_STORAGE_DIR=$root/config");
require "$server/lib.php";
function expectCapture(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$checks = 0;
$hidden = "$root/config/hidden";
try {
    $workspacePath = getThemeWorkspacePath();
    writeThemeWorkspace(defaultThemeWorkspace());
    $originalWorkspace = defaultThemeWorkspace();
    $originalWorkspace['profiles'][0]['name'] = 'Uncaptured original';
    writeJsonObjectAtomic($workspacePath, $originalWorkspace);
    $originalWorkspaceBytes = file_get_contents($workspacePath);
    chmod($workspacePath, 0000); clearstatcache(); $failed = false;
    try { readThemeWorkspace(); } catch (RuntimeException $error) { $failed = true; }
    chmod($workspacePath, 0600); clearstatcache();
    expectCapture($failed && file_get_contents($workspacePath) === $originalWorkspaceBytes, 'Workspace recovery must not replace unreadable original bytes');
    $checks++;
    $file = "$root/config/original"; $empty = "$root/config/empty"; $missing = "$root/config/absent";
    mkdir($hidden); file_put_contents("$hidden/secret", 'secret fixture');
    file_put_contents($file, "original\0fixture"); file_put_contents($empty, '');
    chmod($file, 0600); chmod($empty, 0640);
    foreach (['environment', 'theme'] as $owner) {
        $capture = $owner === 'theme' ? static fn($paths) => array_map('fvplusThemeUpdateCaptureFile', $paths) : 'fvplusEnvironmentCaptureFiles';
        $restore = $owner === 'theme' ? 'fvplusThemeUpdateRestoreFiles' : 'fvplusEnvironmentRestoreFiles';
        chmod($file, 0000); clearstatcache();
        expectCapture(!is_readable($file), 'Must be an unprivileged user');
        $failed = false;
        try { $capture([$file]); } catch (RuntimeException $error) { $failed = true; }
        chmod($file, 0600); clearstatcache();
        expectCapture($failed && file_get_contents($file) === "original\0fixture", "$owner unreadable capture"); $checks++;
        chmod($hidden, 0000); clearstatcache();
        $failed = false;
        try { $capture(["$hidden/secret"]); } catch (RuntimeException $error) { $failed = true; }
        chmod($hidden, 0700); clearstatcache();
        expectCapture($failed, "$owner inaccessible ancestor capture"); $checks++;
        foreach ([$root . '/config/link' => $file, $root . '/config/dangling' => $missing] as $link => $target) {
            symlink($target, $link); $failed = false;
            try { $capture([$link]); } catch (RuntimeException $error) { $failed = true; }
            unlink($link); expectCapture($failed, "$owner symlink capture"); $checks++;
        }
        symlink($hidden, "$root/config/parent-link"); $failed = false;
        try { $capture(["$root/config/parent-link/secret"]); } catch (RuntimeException $error) { $failed = true; }
        unlink("$root/config/parent-link"); expectCapture($failed, "$owner symlink ancestor"); $checks++;
        $failed = false;
        try { $capture([$hidden]); } catch (RuntimeException $error) { $failed = true; }
        expectCapture($failed, "$owner non-regular directory"); $checks++;
        if (function_exists('posix_mkfifo')) {
            posix_mkfifo("$root/config/fifo", 0600); $failed = false;
            try { $capture(["$root/config/fifo"]); } catch (RuntimeException $error) { $failed = true; }
            unlink("$root/config/fifo"); expectCapture($failed, "$owner non-regular FIFO"); $checks++;
        }
        $snapshots = $capture([$file, $empty, $missing, "$root/config/absent-parent/child"]);
        foreach ([$file, $empty, $missing] as $path) { file_put_contents($path, 'changed'); chmod($path, 0644); }
        $restore($snapshots); clearstatcache();
        expectCapture(file_get_contents($file) === "original\0fixture" && (fileperms($file) & 0777) === 0600, "$owner exact bytes/mode");
        expectCapture(is_file($empty) && file_get_contents($empty) === '' && (fileperms($empty) & 0777) === 0640, "$owner empty bytes/mode");
        expectCapture(!file_exists($missing), "$owner missing target"); $checks += 3;
        $newA = "$hidden/new-a"; $newB = "$hidden/new-b";
        $snapshots = $capture([$newA, $newB, $empty]);
        file_put_contents($newA, 'new'); file_put_contents($newB, 'new'); file_put_contents($empty, 'changed');
        chmod($hidden, 0555); clearstatcache(); $message = '';
        try { $restore($snapshots); } catch (RuntimeException $error) { $message = $error->getMessage(); }
        chmod($hidden, 0700); clearstatcache();
        expectCapture(strpos($message, 'new-a') !== false && strpos($message, 'new-b') !== false && strpos($message, 'rollback was incomplete') !== false, "$owner failed deletion reporting");
        expectCapture(file_get_contents($empty) === '', "$owner compensation continued");
        unlink($newA); unlink($newB); $checks += 2;
    }
    echo "Linux capture/rollback checks passed: $checks (PHP " . PHP_VERSION . ").\n";
} finally {
    if (is_dir($hidden)) chmod($hidden, 0700);
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $entry) {
        if ($entry->isLink() || !$entry->isDir()) { @chmod($entry->getPathname(), 0600); unlink($entry->getPathname()); }
        else { chmod($entry->getPathname(), 0700); rmdir($entry->getPathname()); }
    }
    rmdir($root);
}
