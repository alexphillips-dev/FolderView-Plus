<?php
// Run actual endpoint code against isolated storage and host SDK include probes.
$server = $argv[1]; $root = $argv[2];
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$_SERVER = [
    'DOCUMENT_ROOT' => $root . '/host', 'REQUEST_METHOD' => 'POST',
    'HTTP_HOST' => 'fixture.test', 'HTTP_ORIGIN' => 'http://fixture.test',
    'HTTP_X_FV_REQUEST' => '1', 'HTTPS' => 'off', 'SERVER_PORT' => '80'
];
$_POST = $request['post'] ?? [];
$_GET = $request['get'] ?? [];
$_REQUEST = $_POST;

if (($request['operation'] ?? '') === 'bootstrap') {
    if (array_key_exists('configOnly', $request)) define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', $request['configOnly']);
    require $server . '/lib.php';
    $response = null;
} else {
    $endpoint = $request['endpoint'];
    if (!in_array($endpoint, ['security.php', 'create.php', 'update.php', 'read_info.php'], true)) {
        throw new RuntimeException('Unsupported fixture endpoint.');
    }
    if ($endpoint === 'read_info.php') $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['SCRIPT_FILENAME'] = $server . '/' . $endpoint;
    $_SERVER['SCRIPT_NAME'] = '/plugins/folderview.plus/server/' . $endpoint;
    $body = str_replace('/usr/local/emhttp/plugins/folderview.plus/server/',
        str_replace('\\', '/', $server) . '/', substr(file_get_contents($server . '/' . $endpoint), 5));
    ob_start();
    eval($body);
    $response = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
}

$attempts = $root . '/sdk-attempts.jsonl';
echo json_encode([
    'response' => $response, 'status' => http_response_code(),
    'sdkAttempts' => is_file($attempts) ? file($attempts, FILE_IGNORE_NEW_LINES) : [],
    'dependencies' => fvplus_get_host_dependency_status()
], JSON_THROW_ON_ERROR);
