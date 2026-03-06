<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

$version = readInstalledVersion();
$lines = readCurrentVersionChanges(18);

echo json_encode([
    'ok' => true,
    'version' => $version,
    'lines' => $lines
]);
