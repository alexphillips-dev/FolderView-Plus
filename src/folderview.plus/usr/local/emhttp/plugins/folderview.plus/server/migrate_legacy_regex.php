<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));
    $folderId = trim((string)($_POST['folderId'] ?? ''));
    $expectedPattern = (string)($_POST['expectedPattern'] ?? '');
    return fvplusJsonTypeConfig(migrateLegacyRegexToAutoRule($type, $folderId, $expectedPattern));
});
