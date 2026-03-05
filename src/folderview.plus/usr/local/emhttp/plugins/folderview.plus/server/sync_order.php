<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    syncContainerOrder($type);
    echo json_encode([
        'ok' => true,
        'type' => $type
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
