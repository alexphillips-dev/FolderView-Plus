<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = strtolower(trim((string)($_REQUEST['action'] ?? 'preview')));
    if ($action === 'sync') {
        requireMutationRequestGuard();
        syncContainerOrder('docker');
    }

    $preview = dockerStartOrderPreview();
    return [
        'preview' => $preview
    ];
});
