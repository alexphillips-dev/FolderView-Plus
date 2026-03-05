<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    requireMutationRequestGuard();

    $type = ensureType((string)($_POST['type'] ?? ''));
    $folderId = (string)($_POST['folderId'] ?? '');
    $itemsRaw = (string)($_POST['items'] ?? '[]');
    $itemsDecoded = json_decode($itemsRaw, true);
    if (!is_array($itemsDecoded)) {
        throw new RuntimeException('Invalid items payload.');
    }

    echo json_encode([
        'ok' => true,
        'result' => bulkAssignItemsToFolder($type, $folderId, $itemsDecoded)
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
