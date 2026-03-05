<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');

try {
    $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
    echo json_encode(readInfo($type));
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
