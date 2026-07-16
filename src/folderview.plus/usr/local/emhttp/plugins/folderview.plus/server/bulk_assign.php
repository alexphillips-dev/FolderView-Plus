<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();

    $type = ensureType((string)($_POST['type'] ?? ''));
    $assignmentsRaw = (string)($_POST['assignments'] ?? '');
    if ($assignmentsRaw !== '') {
        if (strlen($assignmentsRaw) > FVPLUS_MAX_FOLDER_BATCH_RAW_BYTES) {
            throw new RuntimeException('Bulk assignment payload exceeds the upload limit.');
        }
        $assignments = json_decode($assignmentsRaw, true);
        if (!is_array($assignments)) {
            throw new RuntimeException('Invalid bulk assignments payload.');
        }
        return [
            'result' => bulkAssignItemsToFolders($type, $assignments)
        ];
    }

    $folderId = (string)($_POST['folderId'] ?? '');
    $itemsRaw = (string)($_POST['items'] ?? '[]');
    $itemsDecoded = json_decode($itemsRaw, true);
    if (!is_array($itemsDecoded)) {
        throw new RuntimeException('Invalid items payload.');
    }

    return [
        'result' => bulkAssignItemsToFolder($type, $folderId, $itemsDecoded)
    ];
});
