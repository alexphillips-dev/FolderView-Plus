<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');

try {
    $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
    $mode = normalizeReadInfoMode((string)($_GET['mode'] ?? $_REQUEST['mode'] ?? 'full'));
    $nocacheRaw = strtolower(trim((string)($_GET['nocache'] ?? $_REQUEST['nocache'] ?? '0')));
    $forceRefresh = in_array($nocacheRaw, ['1', 'true', 'yes', 'on'], true);
    $ttl = null;
    if (isset($_GET['ttl']) || isset($_REQUEST['ttl'])) {
        $ttl = (int)($_GET['ttl'] ?? $_REQUEST['ttl'] ?? 0);
        $ttl = max(0, min(30, $ttl));
    }
    echo json_encode(readInfoCached($type, $mode, $ttl, $forceRefresh));
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
