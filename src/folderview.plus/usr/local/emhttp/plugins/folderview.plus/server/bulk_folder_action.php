<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $action = strtolower(trim((string)($_POST['runtimeAction'] ?? $_POST['actionName'] ?? '')));
    $itemsRaw = $_POST['items'] ?? '[]';

    $items = [];
    if (is_string($itemsRaw) && trim($itemsRaw) !== '') {
        $decoded = json_decode($itemsRaw, true);
        if (is_array($decoded)) {
            $items = $decoded;
        } else {
            throw new RuntimeException('Items payload must be a JSON array.');
        }
    } elseif (is_array($itemsRaw)) {
        $items = $itemsRaw;
    }

    $result = executeFolderRuntimeAction($type, $action, $items);
    echo json_encode([
        'ok' => true,
        'result' => $result
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
