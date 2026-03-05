<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
        echo json_encode([
            'ok' => true,
            'prefs' => readTypePrefs($type)
        ]);
        exit;
    }

    requireMutationRequestGuard();
    $type = ensureType((string)($_POST['type'] ?? ''));

    $incoming = $_POST['prefs'] ?? null;
    $decoded = [];
    if (is_string($incoming) && $incoming !== '') {
        $parsed = json_decode($incoming, true);
        if (is_array($parsed)) {
            $decoded = $parsed;
        }
    }

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
            'backupCreated' => is_array($backup),
            'sortMode' => (string)($saved['sortMode'] ?? 'created'),
            'ruleCount' => count($saved['autoRules'] ?? []),
            'pinnedFolderCount' => count($saved['pinnedFolderIds'] ?? [])
        ], 'ok', 'server');
    } catch (Throwable $err) {
        // Non-fatal.
    }

    echo json_encode([
        'ok' => true,
        'prefs' => $saved,
        'backup' => $backup
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
