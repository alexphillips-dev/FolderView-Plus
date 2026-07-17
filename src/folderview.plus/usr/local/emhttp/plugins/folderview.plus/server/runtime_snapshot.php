<?php
require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.runtime-snapshot.php');

emitNoCachePageHeaders();

fvplus_json_try(function (): array {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
        throw new RuntimeException('Unsupported method.');
    }
    $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
    $mode = normalizeRuntimeSnapshotMode((string)($_GET['mode'] ?? $_REQUEST['mode'] ?? 'state'));
    $since = (string)($_GET['since'] ?? $_REQUEST['since'] ?? '');
    $forceRefresh = normalizeBool((string)($_GET['nocache'] ?? $_REQUEST['nocache'] ?? '0'), false);
    $preferLiveUpdateStatus = $type === 'docker'
        && $mode !== 'full'
        && normalizeBool((string)($_GET['liveupdate'] ?? $_REQUEST['liveupdate'] ?? '0'), false);
    $ttl = null;
    if (isset($_GET['ttl']) || isset($_REQUEST['ttl'])) {
        $ttl = max(0, min(30, (int)($_GET['ttl'] ?? $_REQUEST['ttl'] ?? 0)));
    }
    $snapshot = buildRuntimeSnapshot($type, $mode, $since, $preferLiveUpdateStatus, $ttl, $forceRefresh);
    if (!headers_sent()) {
        header('X-FV-Runtime-Snapshot-Schema: ' . FVPLUS_RUNTIME_SNAPSHOT_SCHEMA_VERSION);
        header('X-FV-Runtime-Snapshot-Token: ' . (string)($snapshot['snapshotToken'] ?? ''));
    }
    return $snapshot;
});
