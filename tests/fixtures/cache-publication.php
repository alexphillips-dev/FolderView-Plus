<?php
namespace CachePublication {
    function waitFor(string $marker): void {
        $deadline = microtime(true) + 10;
        while (!is_file($marker)) {
            if (microtime(true) > $deadline) throw new \RuntimeException('Fixture barrier timed out: ' . basename($marker));
            usleep(10000); clearstatcache();
        }
    }
    function getReadInfoCachePath(string $type, string $mode): string { return $GLOBALS['target']; }
    function file_put_contents(string $path, string $data, int $flags = 0) {
        if (($GLOBALS['fault'] ?? '') === 'partial') return \file_put_contents($path, substr($data, 0, 1), $flags);
        if ($GLOBALS['worker'] !== 'b') return \file_put_contents($path, $data, $flags);
        // A second real writer holds the inode lock while its payload is incomplete.
        $handle = fopen($path, 'c+b');
        flock($handle, LOCK_EX); ftruncate($handle, 0);
        fwrite($handle, '{'); fflush($handle);
        \file_put_contents($GLOBALS['root'] . '/b-partial', 'ready');
        waitFor($GLOBALS['root'] . '/a-observed');
        fwrite($handle, substr($data, 1)); fflush($handle);
        flock($handle, LOCK_UN); fclose($handle);
        return strlen($data);
    }
    function rename(string $from, string $to): bool {
        if (($GLOBALS['fault'] ?? '') === 'rename') return false;
        if ($GLOBALS['worker'] !== 'a') return \rename($from, $to);
        \file_put_contents($GLOBALS['root'] . '/a-staged', 'ready');
        waitFor($GLOBALS['root'] . '/b-partial');
        $result = \rename($from, $to);
        $observed = \file_get_contents($to);
        \file_put_contents($GLOBALS['root'] . '/observed.json', json_encode(['raw' => $observed, 'valid' => is_array(json_decode($observed, true))]));
        \file_put_contents($GLOBALS['root'] . '/a-observed', 'ready');
        return $result;
    }
}
namespace {
    $server = $argv[1]; $root = $argv[2]; $worker = $argv[3]; $kind = $argv[4]; $fault = $argv[5] ?? '';
    $target = "$root/cache.json";
    putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
    putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
    $_SERVER['DOCUMENT_ROOT'] = "$root/host";
    require "$server/lib.php";
    $source = file("$server/lib.php");
    foreach (['fv3_write_json_cache_payload', 'writeReadInfoCache'] as $name) {
        $reflection = new ReflectionFunction($name);
        eval('namespace CachePublication;' . implode('', array_slice($source, $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1)));
    }
    if ($worker === 'b') \CachePublication\waitFor("$root/a-staged");
    if ($kind === 'info') \CachePublication\writeReadInfoCache('docker', 'state', ['writer' => $worker]);
    else \CachePublication\fv3_write_json_cache_payload($target, ['writer' => $worker]);
    echo json_encode(['done' => $worker]);
}
