<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

require_once(__DIR__ . '/lib.custom-icon-endpoint-foundation.php');

require_once(__DIR__ . '/lib.custom-icon-validation.php');

require_once(__DIR__ . '/lib.custom-icon-actions.php');

fvplus_json_try(function (): array {
    $action = strtolower(trim((string)($_REQUEST['action'] ?? 'upload')));
    if ($action === 'list') {
        return handleCustomIconListAction();
    }
    if ($action === 'stats') {
        return handleCustomIconStatsAction();
    }
    if ($action === 'usage') {
        return handleCustomIconUsageAction();
    }
    if ($action === 'delete') {
        requireMutationRequestGuard();
        return handleCustomIconDeleteAction();
    }
    if ($action === 'rename') {
        requireMutationRequestGuard();
        return handleCustomIconRenameAction();
    }
    if ($action === 'upload' || $action === '') {
        requireMutationRequestGuard();
        return handleCustomIconUploadAction();
    }
    throw new RuntimeException('Unsupported action.');
});

$GLOBALS['fvplus_custom_icon_response_sent'] = true;
