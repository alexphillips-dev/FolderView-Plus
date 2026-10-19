<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    requireMutationRequestGuard();

    $type = ensureType((string)($_POST['type'] ?? ''));
    $targetIdsRaw = (string)($_POST['targetIds'] ?? '[]');
    $settingsRaw = (string)($_POST['settings'] ?? '{}');
    if ($type === '' || $targetIdsRaw === '' || $settingsRaw === '') {
        throw new RuntimeException('Missing required parameters.');
    }

    $targetIds = json_decode($targetIdsRaw, true);
    if (!is_array($targetIds)) {
        throw new RuntimeException('Invalid target folder list.');
    }
    $settings = json_decode($settingsRaw, true);
    if (!is_array($settings)) {
        throw new RuntimeException('Invalid folder settings payload.');
    }

    $options = ['preview' => ($_POST['preview'] ?? '') === '1'];
    if (isset($_POST['categories'])) {
        $categories = json_decode((string)$_POST['categories'], true);
        if (!is_array($categories)) throw new InvalidArgumentException('Invalid folder settings categories.');
        $options['categories'] = $categories;
    }
    if (isset($_POST['expectedRevision'])) $options['expectedRevision'] = $_POST['expectedRevision'];
    return ['result' => applyFolderSettingsPayload($type, $targetIds, $settings, $options)];
});
