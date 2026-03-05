<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $orderRaw = (string)($_POST['order'] ?? '[]');
    $order = json_decode($orderRaw, true);
    if (!is_array($order)) {
        throw new RuntimeException('Invalid order payload.');
    }

    $reordered = reorderFoldersByIdList($type, $order);
    echo json_encode([
        'ok' => true,
        'order' => array_keys($reordered)
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
