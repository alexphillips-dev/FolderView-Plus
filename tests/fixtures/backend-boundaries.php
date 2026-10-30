<?php
// All writes are confined to the supplied temporary root.
$server = $argv[1]; $root = $argv[2];
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
function var_split($line) { return explode(' ', $line)[0]; }
class DockerUtil {
    public static function driver() { return []; }
    public static function host() { return '127.0.0.1'; }
    public static function loadJSON($path) { return []; }
}
class DockerClient {
    public function getDockerJSON($path) { return []; }
    public function getDockerContainers() { return []; }
}
class DockerUpdate {}
class DockerTemplates { public function getTemplates($source) { return []; } }
class Libvirt {
    public function connect() { return true; }
    public function get_domains() { return []; }
}
class BoundaryOfflineStream {
    public $context; private $position = 0;
    private $body = '<!ENTITY version "2026.10.29.01">';
    public function stream_open($path, $mode, $options, &$opened) { return true; }
    public function stream_read($count) { $part = substr($this->body, $this->position, $count); $this->position += strlen($part); return $part; }
    public function stream_eof() { return $this->position >= strlen($this->body); }
    public function stream_stat() { return []; }
    public function stream_set_option($option, $arg1, $arg2) { return false; }
}
foreach (['http', 'https'] as $protocol) {
    if (in_array($protocol, stream_get_wrappers(), true)) stream_wrapper_unregister($protocol);
    stream_wrapper_register($protocol, BoundaryOfflineStream::class);
}
require $server . '/lib.php';

if ($request['operation'] === 'convert') {
    $pattern = $request['pattern']; $type = $request['type'] ?? 'vm';
    writeRawFolderMap($type, ['fixture' => ['name' => 'Fixture', 'containers' => [], 'regex' => $pattern]]);
    writeTypePrefs($type, defaultTypePrefs());
    touch(legacyRegexMigrationLockPath($type));
    $capture = static function () use ($root): array {
        $result = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/config', FilesystemIterator::SKIP_DOTS)) as $file) {
            // Guard authorization audit events and coordination locks are expected request effects.
            if ($file->isFile() && substr($file->getFilename(), -5) !== '.lock'
                && strpos($file->getFilename(), 'security.audit.json') !== 0) {
                $result[substr($file->getPathname(), strlen($root))] = hash_file('sha256', $file->getPathname());
            }
        }
        ksort($result); return $result;
    };
    $info = array_fill_keys($request['names'] ?? ['abc'], []);
    $beforeMembership = fvplusBuildMembershipSnapshot($type, readRawFolderMap($type), [], $info);
    $_SERVER['SCRIPT_FILENAME'] = $server . '/migrate_legacy_regex.php';
    $_SERVER['REQUEST_METHOD'] = 'POST'; $_SERVER['HTTP_HOST'] = 'fixture.test';
    $_SERVER['HTTP_ORIGIN'] = 'http://fixture.test'; $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $nonce = fvplus_issue_mutation_nonce('migrate_legacy_regex.php');
    $_POST = ['type' => $type, 'folderId' => 'fixture', 'expectedPattern' => $pattern,
        'token' => getConfiguredRequestToken(), '_fv_nonce' => $nonce['nonce'], '_fv_transaction' => 'tx-boundary-conversion-001'];
    $_REQUEST = $_POST; $before = $capture();
    $endpoint = file_get_contents($server . '/migrate_legacy_regex.php');
    $endpoint = preg_replace('~require_once\([^;]+;~', '', $endpoint, 1);
    ob_start(); eval(substr($endpoint, 5)); $response = json_decode(ob_get_clean(), true);
    $after = $capture();
    $folders = readRawFolderMap($type); $rules = readTypePrefs($type)['autoRules'];
    $afterMembership = fvplusBuildMembershipSnapshot($type, $folders, $rules, $info);
    echo json_encode(['response' => $response, 'status' => http_response_code(), 'exactUnchanged' => $before === $after,
        'legacy' => $folders['fixture']['regex'], 'rules' => $rules,
        'beforeMembers' => $beforeMembership['byFolder']['fixture']['members'],
        'afterMembers' => $afterMembership['byFolder']['fixture']['members'],
        'issues' => $afterMembership['issues']], JSON_THROW_ON_ERROR);
    exit;
}
if ($request['operation'] === 'bundle') {
    writeRawFolderMap('vm', ['PRIVATE_ID' => ['name' => 'PRIVATE_FOLDER',
        'icon' => '/plugins/folderview.plus/images/custom/PRIVATE_ICON.png', 'containers' => []]]);
    appendDiagnosticsHistoryEvent('environment_import', 'vm', [
        'sourceName' => 'PRIVATE_SOURCE.json', 'folderId' => 'PRIVATE_ID', 'templateId' => 'PRIVATE_TEMPLATE',
        'reason' => 'PRIVATE_REASON', 'from' => 'PRIVATE_FROM', 'to' => 'PRIVATE_TO',
        'message' => 'PRIVATE_ERROR', 'folderIds' => ['PRIVATE_ID'],
        'PRIVATE_KEY' => 'PRIVATE_UNKNOWN',
        'details' => ['sourceName' => 'PRIVATE_NESTED.json', 'item' => 'PRIVATE_ITEM',
            'PRIVATE_NESTED_KEY' => 'PRIVATE_NESTED_UNKNOWN', 'templateId' => 123456789],
        'renames' => [123456789 => 'PRIVATE_SPARSE_VALUE'],
        'folderCount' => 3, 'verified' => true, 'phase' => 'verified'
    ], 'ok', 'server');
    appendDiagnosticsHistoryEvent('PRIVATE_ACTION', 'vm', ['sourceName' => 'PRIVATE_ENVELOPE.json'], 'PRIVATE_STATUS', 'PRIVATE_SOURCE_KIND');
    echo json_encode(['sanitized' => getSupportBundleV2Snapshot('sanitized'),
        'full' => getSupportBundleV2Snapshot('full'), 'another' => getSupportBundleV2Snapshot('sanitized')], JSON_THROW_ON_ERROR);
    exit;
}
throw new RuntimeException('Unsupported fixture operation.');
