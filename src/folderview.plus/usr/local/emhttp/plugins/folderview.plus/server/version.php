<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');
emitNoCachePageHeaders();

echo readInstalledVersion();
?>
