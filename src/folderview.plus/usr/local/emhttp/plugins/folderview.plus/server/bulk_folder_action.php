<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
require_once(__DIR__ . '/lib.runtime-snapshot.php');

fvplus_json_try(function (): array {
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

    $result = executeFolderRuntimeAction($type, $action, $items, (string)($_POST['folderId'] ?? ''));
    return [
        'result' => $result
    ];
});
