<?php
header('Content-Type: text/plain');

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
