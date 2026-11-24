<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    fvplus_enforce_current_api_contract();
    $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
    $mode = normalizeReadInfoMode((string)($_GET['mode'] ?? $_REQUEST['mode'] ?? 'full'));
    $nocacheRaw = strtolower(trim((string)($_GET['nocache'] ?? $_REQUEST['nocache'] ?? '0')));
    $forceRefresh = in_array($nocacheRaw, ['1', 'true', 'yes', 'on'], true);
    $preferLiveUpdateStatus = $mode === 'state'
        && normalizeBool((string)($_GET['liveupdate'] ?? $_REQUEST['liveupdate'] ?? '0'), false);
    $ttl = null;
    if (isset($_GET['ttl']) || isset($_REQUEST['ttl'])) {
        $ttl = (int)($_GET['ttl'] ?? $_REQUEST['ttl'] ?? 0);
        $ttl = max(0, min(30, $ttl));
    }
    $info = $preferLiveUpdateStatus ? readInfoState($type, true) : readInfoCached($type, $mode, $ttl, $forceRefresh);
    echo json_encode($info !== [] && array_is_list($info) ? (object)$info : $info);
} catch (Throwable $e) {
    http_response_code($e instanceof FVPlusApiContractException ? fvplus_get_api_error_status($e) : 400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
