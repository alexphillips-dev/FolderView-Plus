<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $id = (string)($_POST['id'] ?? '');
    if ($type === '' || $id === '') {
        throw new RuntimeException('Missing required parameters.');
    }

    deleteFolder($type, $id);
    return [];
});
