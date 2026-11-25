<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-autostart-toggle.php");

fvplus_json_try(function (): ?array {
    $action = strtolower(trim((string)($_REQUEST['action'] ?? 'preview')));
    if ($action === 'sync') {
        requireMutationRequestGuard();
        return fvplusRespondToDockerOrderSync('docker');
    }
    if ($action === 'autostart') {
        requireMutationRequestGuard();
        $name = $_POST['container'] ?? null;
        $enabled = $_POST['enabled'] ?? null;
        if (!is_string($name) || !preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}\z/', $name)
            || !in_array($enabled, ['0', '1'], true)) {
            throw new InvalidArgumentException('Invalid Docker autostart request.');
        }
        return setDockerStartOrderAutostart($name, $enabled === '1');
    }

    $preview = dockerStartOrderPreview();
    return [
        'preview' => $preview
    ];
});
