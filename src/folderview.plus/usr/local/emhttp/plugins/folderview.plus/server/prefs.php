<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
        return [
            'prefs' => readTypePrefs($type)
        ];
    }

    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));

    $incoming = $_POST['prefs'] ?? null;
    $decoded = [];
    if (is_string($incoming) && trim($incoming) !== '') {
        $parsed = json_decode($incoming, true);
        if (!is_array($parsed)) {
            throw new RuntimeException('Invalid prefs payload: expected JSON object.');
        }
        $decoded = $parsed;
    } elseif (is_array($incoming)) {
        $decoded = $incoming;
    }
    fvplus_assert_prefs_payload_shape($decoded);

    $current = readTypePrefs($type);
    $next = normalizeTypePrefs(array_merge($current, $decoded));
    $backup = null;
    $currentJson = json_encode(normalizeTypePrefs($current), JSON_UNESCAPED_SLASHES);
    $nextJson = json_encode($next, JSON_UNESCAPED_SLASHES);
    if ($currentJson !== $nextJson) {
        $backup = createBackupSnapshot($type, 'before-prefs-update');
    }

    $saved = writeTypePrefs($type, $next);
    syncManualOrderWithFolders($type, readRawFolderMap($type));
    try {
        appendDiagnosticsHistoryEvent('prefs_update', $type, [
            'traceId' => getRequestTraceId(),
            'backupCreated' => is_array($backup),
            'sortMode' => (string)($saved['sortMode'] ?? 'created'),
            'ruleCount' => count($saved['autoRules'] ?? []),
            'pinnedFolderCount' => count($saved['pinnedFolderIds'] ?? [])
        ], 'ok', 'server');
    } catch (Throwable $err) {
        // Non-fatal.
    }

    return [
        'prefs' => $saved,
        'backup' => $backup
    ];
});
