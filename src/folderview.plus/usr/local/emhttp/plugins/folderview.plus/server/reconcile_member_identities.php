<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $patchesRaw = (string)($_POST['patches'] ?? '{}');
    if (strlen($patchesRaw) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES * 4) {
        throw new RuntimeException('Member identity reconciliation payload is too large.');
    }
    $patches = json_decode($patchesRaw, true);
    if (!is_array($patches)) {
        throw new RuntimeException('Invalid member identity reconciliation payload.');
    }
    if (count($patches) > 5000) {
        throw new RuntimeException('Too many folder identity patches.');
    }
    return ['result' => applyFolderMemberIdentityPatches($type, $patches)];
});
