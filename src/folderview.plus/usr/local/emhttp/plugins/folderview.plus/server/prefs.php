<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: application/json');

try {
    $type = ensureType((string)($_REQUEST['type'] ?? ''));
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([
            'ok' => true,
            'prefs' => readTypePrefs($type)
        ]);
        exit;
    }

    $incoming = $_POST['prefs'] ?? null;
    $decoded = [];
    if (is_string($incoming) && $incoming !== '') {
        $parsed = json_decode($incoming, true);
        if (is_array($parsed)) {
            $decoded = $parsed;
        }
    }

    $current = readTypePrefs($type);
    $next = array_merge($current, $decoded);
    $saved = writeTypePrefs($type, $next);
    syncManualOrderWithFolders($type, readRawFolderMap($type));

    echo json_encode([
        'ok' => true,
        'prefs' => $saved
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
