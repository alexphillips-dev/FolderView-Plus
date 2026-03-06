<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $orderRaw = (string)($_POST['order'] ?? '[]');
    $order = json_decode($orderRaw, true);
    if (!is_array($order)) {
        throw new RuntimeException('Invalid order payload.');
    }

    $reordered = reorderFoldersByIdList($type, $order);
    return [
        'order' => array_keys($reordered)
    ];
});
