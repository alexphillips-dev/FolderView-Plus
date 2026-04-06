<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();

    $type = ensureType((string)($_POST['type'] ?? ''));
    $folderId = (string)($_POST['folderId'] ?? '');
    $itemsRaw = (string)($_POST['items'] ?? '[]');
    $itemsDecoded = json_decode($itemsRaw, true);
    if (!is_array($itemsDecoded)) {
        throw new RuntimeException('Invalid items payload.');
    }

    return [
        'result' => bulkAssignItemsToFolder($type, $folderId, $itemsDecoded)
    ];
});
