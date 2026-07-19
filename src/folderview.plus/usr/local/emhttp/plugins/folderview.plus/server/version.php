<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');
emitNoCachePageHeaders();

try {
    fvplus_enforce_current_api_contract();
    echo readInstalledVersion();
} catch (Throwable $e) {
    http_response_code($e instanceof FVPlusApiContractException ? max(400, min(599, (int)$e->getCode())) : 400);
    echo $e->getMessage();
}
?>
