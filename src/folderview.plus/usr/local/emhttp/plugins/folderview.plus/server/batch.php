<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $rawOperations = (string)($_POST['operations'] ?? '');
    if ($type === '' || $rawOperations === '') {
        throw new RuntimeException('Missing required parameters.');
    }
    if (strlen($rawOperations) > FVPLUS_MAX_FOLDER_BATCH_RAW_BYTES) {
        throw new RuntimeException('Folder batch payload exceeds the upload limit.');
    }
    $operations = json_decode($rawOperations, true);
    if (!is_array($operations)) {
        throw new RuntimeException('Folder batch payload is not valid JSON.');
    }

    return [
        'result' => applyFolderBatchOperations($type, $operations)
    ];
});
