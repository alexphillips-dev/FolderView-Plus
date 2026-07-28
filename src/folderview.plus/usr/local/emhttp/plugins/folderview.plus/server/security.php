<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = (string)($_POST['action'] ?? '');
    if ($action !== 'issue_nonce') {
        throw new FVPlusSecurityRequestException('Unsupported security action.', 400);
    }
    return fvplus_issue_mutation_nonce(
        (string)($_POST['endpoint'] ?? ''),
        (string)($_POST['targetAction'] ?? '')
    );
});
