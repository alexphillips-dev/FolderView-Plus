<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $content = (string)($_POST['content'] ?? '');
    if ($type === '' || $content === '') {
        throw new RuntimeException('Missing required parameters.');
    }

    updateFolder($type, $content);
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
