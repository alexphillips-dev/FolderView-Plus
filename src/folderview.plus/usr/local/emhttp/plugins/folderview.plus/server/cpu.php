<?php
require_once(__DIR__ . '/lib.api-contract.php');

header('Content-Type: text/plain');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    fvplus_enforce_current_api_contract();
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
} catch (Throwable $e) {
    http_response_code($e instanceof FVPlusApiContractException ? max(400, min(599, (int)$e->getCode())) : 400);
    echo $e->getMessage();
}
?>
