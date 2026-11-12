<?php
$root = $argv[1];
$server = $argv[2];
$configDir = "$root/current";
define('FVPLUS_LEGACY_CONFIG_DIRS', ["$root/legacy"]);

function ensureType(string $type): string {
    if (!in_array($type, ['docker', 'vm'], true)) {
        throw new RuntimeException('Invalid fixture type.');
    }
    return $type;
}
function readUnraidVersionString(): string { return '7.3.4'; }
function fvplus_get_host_dependency_status(): array {
    return array_fill_keys(['helpers', 'validation', 'docker', 'libvirt'], ['loaded' => true]);
}
class DockerClient {
    public function getDockerJSON(string $path): array { return []; }
}
class DockerUpdate {}
class DockerTemplates {}
class DockerUtil {}
class Libvirt {
    public function connect(): bool { return true; }
}

require "$server/lib.runtime-info.php";
require "$server/lib.theme-workspace.php";
require "$server/lib.preflight.php";

$result = [];
foreach (['docker', 'vm'] as $type) {
    $result[$type] = [
        'overrides' => collectRuntimeOverrideEntries($type),
        'preflight' => collectRuntimePreflight($type)
    ];
}
echo json_encode($result, JSON_THROW_ON_ERROR);
