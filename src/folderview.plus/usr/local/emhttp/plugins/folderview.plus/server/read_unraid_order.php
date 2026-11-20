<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');
emitNoCachePageHeaders();

try {
    fvplus_enforce_current_api_contract();
    $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
    if ((string)($_GET['stored'] ?? '') === '1') {
        // Read-only: the effective order plus the entries stored in Unraid's Docker order file, for checking a save.
        if ($type !== 'docker') {
            throw new RuntimeException('The stored order is only available for Docker.');
        }
        echo json_encode(['ok' => true, 'order' => readUnraidOrder($type), 'stored' => readUnraidStoredDockerOrder()]);
    } else {
        echo json_encode(readUnraidOrder($type));
    }
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
