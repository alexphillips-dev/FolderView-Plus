<?php
require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

fvplus_json_try(function (): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        return ['preview' => fvplusBuildRulePreview(ensureType((string)($_GET['type'] ?? '')))];
    }
    requireMutationRequestGuard();
    return ['result' => fvplusApplyRulePreview(ensureType((string)($_POST['type'] ?? '')), (string)($_POST['expectedDigest'] ?? ''))];
});
