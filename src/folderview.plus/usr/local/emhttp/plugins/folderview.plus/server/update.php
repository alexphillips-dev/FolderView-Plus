<?php
$requestStartedAt = microtime(true);
define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
$bootstrapFinishedAt = microtime(true);

fvplus_json_try(function () use ($requestStartedAt, $bootstrapFinishedAt): array {
    requireMutationRequestGuard();
    $guardFinishedAt = microtime(true);
    $type = ensureType((string)($_POST['type'] ?? ''));
    $content = (string)($_POST['content'] ?? '');
    $id = (string)($_POST['id'] ?? '');
    if ($type === '' || $content === '' || $id === '') {
        throw new RuntimeException('Missing required parameters.');
    }

    $metadata = updateFolder($type, $content, $id, $_POST['expectedRevision'] ?? '');
    return ['metadata' => $metadata, 'timings' => [
        'bootstrapMs' => max(0, min(600000, (int)round(($bootstrapFinishedAt - $requestStartedAt) * 1000))),
        'guardMs' => max(0, min(600000, (int)round(($guardFinishedAt - $bootstrapFinishedAt) * 1000))),
        'saveMs' => max(0, min(600000, (int)round((microtime(true) - $guardFinishedAt) * 1000)))
    ]];
});
