<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $result = checkRemotePluginUpdate();
    if (is_array($result) && array_key_exists('ok', $result)) {
        return $result;
    }
    return [
        'update' => $result
    ];
});
