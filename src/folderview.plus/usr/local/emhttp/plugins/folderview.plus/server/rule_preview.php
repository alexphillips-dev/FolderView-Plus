<?php
$validatingPredicate = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && ($_POST['action'] ?? '') === 'validate_predicate';
if ($validatingPredicate || ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') define('FVPLUS_READ_ONLY_REQUEST', true);
if ($validatingPredicate) define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

fvplus_json_try(function () use ($validatingPredicate): array {
    if ($validatingPredicate) {
        fvplus_require_trusted_request_context();
        return ['valid' => fvplusValidateRulePredicateRequest($_POST)];
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        return ['preview' => fvplusBuildRulePreview(ensureType((string)($_GET['type'] ?? '')))];
    }
    requireMutationRequestGuard();
    return ['result' => fvplusApplyRulePreview(ensureType((string)($_POST['type'] ?? '')), (string)($_POST['expectedDigest'] ?? ''))];
});
