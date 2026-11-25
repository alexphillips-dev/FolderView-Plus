<?php
define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

header('Content-Type: text/plain');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    fvplus_enforce_current_api_contract();
    $type = ensureType((string)($_GET['type'] ?? $_REQUEST['type'] ?? ''));
    $treeIntegrity = (string)($_GET['treeIntegrity'] ?? '') === '1';
    [$foldersJson, $metadata] = withConfigMutationLock(static function () use ($type, $treeIntegrity): array {
        if ($treeIntegrity) {
            $metadata = readConfigMetadata($type, true, false);
            unset($metadata['prefsMutationReceipt']);
            return [
                json_encode(fvplusJsonKeyedMap(readFolderMapForTreeIntegrity($type)), JSON_THROW_ON_ERROR),
                $metadata
            ];
        }
        return [readFolder($type), readConfigMetadata($type, true)];
    });
    if (!headers_sent()) {
        header('X-FV-Config-Schema: ' . (string)($metadata['schemaVersion'] ?? FVPLUS_CONFIG_METADATA_SCHEMA_VERSION));
        header('X-FV-Folder-Revision: ' . (string)($metadata['folderRevision'] ?? 0));
        header('X-FV-Prefs-Revision: ' . (string)($metadata['prefsRevision'] ?? 0));
    }
    $includeMetadata = $treeIntegrity || (string)($_GET['includeMetadata'] ?? '') === '1';
    if ($includeMetadata) {
        $folders = json_decode($foldersJson);
        echo json_encode([
            'ok' => true,
            'folders' => $folders ?? [],
            'metadata' => $metadata
        ], JSON_UNESCAPED_SLASHES);
    } else {
        echo $foldersJson;
    }
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
?>
