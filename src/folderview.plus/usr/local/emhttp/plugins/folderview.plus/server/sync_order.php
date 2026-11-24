<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): ?array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $sync = fvplusRespondToDockerOrderSync($type, true);
    if ($sync === null) return null;
    unset($sync['preview']);
    return ['type' => $type, ...$sync];
});
