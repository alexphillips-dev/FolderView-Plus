<?php
header('Content-Type: text/plain');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$cpuCount = 1;
$cpuInfoPath = '/proc/cpuinfo';
if (is_readable($cpuInfoPath)) {
    $content = @file_get_contents($cpuInfoPath);
    if (is_string($content) && $content !== '') {
        $matches = [];
        if (preg_match_all('/^processor\s*:/m', $content, $matches) !== false) {
            $count = count($matches[0] ?? []);
            if ($count > 0) {
                $cpuCount = $count;
            }
        }
    }
}

echo (string)$cpuCount;
?>
