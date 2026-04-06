<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $content = (string)($_POST['content'] ?? '');
    if ($type === '' || $content === '') {
        throw new RuntimeException('Missing required parameters.');
    }

    updateFolder($type, $content);
    return [];
});
