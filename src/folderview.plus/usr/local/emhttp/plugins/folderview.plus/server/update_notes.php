<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $version = readInstalledVersion();
    $lines = readCurrentVersionChanges(18);
    return [
        'version' => $version,
        'lines' => $lines
    ];
});
