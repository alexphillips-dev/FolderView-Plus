<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $type = (string)($_REQUEST['type'] ?? '');
    $id = (string)($_REQUEST['id'] ?? '');
    if ($type === '' || $id === '') {
        throw new RuntimeException('Missing required parameters.');
    }

    deleteFolder($type, $id);
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
