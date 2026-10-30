<?php
$server = $argv[1]; $root = $argv[2]; $operation = $argv[3];
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
require $server . '/lib.php';
require $server . '/lib.custom-icon-endpoint-foundation.php';
require $server . '/lib.custom-icon-validation.php';
require $server . '/lib.custom-icon-actions.php';
if ($operation === 'seed') {
    withCustomIconLock(true, static function (): void {
        $directory = customIconDirPath();
        file_put_contents($directory . '/before.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j+X8AAAAASUVORK5CYII='));
        syncCustomIconMetadataIndex($directory); syncCustomIconPublicRuntime();
    });
    getConfiguredRequestToken(); echo '{}'; exit;
}
$await = static function (string $file) use ($root): void {
    $deadline = microtime(true) + 15;
    while (!is_file($root . '/' . $file)) {
        if (microtime(true) > $deadline) throw new RuntimeException('Icon lock fixture barrier timeout.');
        usleep(10000);
    }
};
file_put_contents($root . '/' . $operation . '-ready', 'ready');
$await('start-' . $operation);
if ($operation === 'read') {
    $result = withCustomIconLock(false, static function () use ($root, $await): array {
        file_put_contents($root . '/read-holds-icon', 'ready');
        $await('release-read');
        return customIconUsageMap();
    });
    echo json_encode(['ok' => true, 'usage' => $result]); exit;
}
$_SERVER['SCRIPT_FILENAME'] = $server . '/upload_custom_icon.php';
$_SERVER['REQUEST_METHOD'] = 'POST'; $_SERVER['HTTP_HOST'] = 'fixture.test';
$_SERVER['HTTP_ORIGIN'] = 'http://fixture.test'; $_SERVER['HTTP_X_FV_REQUEST'] = '1';
$nonce = fvplus_issue_mutation_nonce('upload_custom_icon.php', 'rename');
$_POST = ['action' => 'rename', 'from' => 'before.png', 'to' => 'after', 'selectedIcon' => '',
    'token' => getConfiguredRequestToken(), '_fv_nonce' => $nonce['nonce'], '_fv_transaction' => 'tx-icon-lock-order-001'];
$_REQUEST = $_POST;
$probe = fopen(getConfigMutationLockPath(), 'c+'); $locked = flock($probe, LOCK_EX | LOCK_NB);
if ($locked) flock($probe, LOCK_UN); fclose($probe);
file_put_contents($root . '/write-config-probe', $locked ? 'unlocked' : 'blocked');
requireMutationRequestGuard();
$result = handleCustomIconRenameAction();
echo json_encode(['ok' => true, 'name' => $result['icon']['name']]);
