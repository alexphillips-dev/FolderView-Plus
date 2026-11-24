<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): ?array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    if (!fvplusRespondToDockerOrderSync($type)) return null;
    return [
        'type' => $type
    ];
});
