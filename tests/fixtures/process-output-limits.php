<?php
$server = $argv[1]; $root = $argv[2];
require "$server/lib.process.php";
putenv("FVPLUS_TEST_PROCESS_BIN_DIR=$root");
$cases = [
    'normal' => ['printf normal; printf warning >&2', false, 13],
    'exact-limit' => ['head -c 32768 /dev/zero | tr "\\000" A', false, 32768],
    'stdout' => ['head -c 100000 /dev/zero | tr "\\000" A', true, 32768],
    'stderr' => ['head -c 100000 /dev/zero | tr "\\000" A >&2', true, 32768],
    'combined' => ['head -c 20000 /dev/zero | tr "\\000" A; head -c 20000 /dev/zero | tr "\\000" B >&2', true, 32768]
];
$results = [];
foreach ($cases as $name => [$command, $truncated, $bytes]) {
    file_put_contents("$root/docker", "#!/bin/sh\n$command\n");
    chmod("$root/docker", 0700);
    $result = fvplusRunProcessProfile('docker-runtime', ['name' => 'fixture-member', 'action' => 'start']);
    $actual = strlen($result['stdout']) + strlen($result['stderr']);
    $outputBytes = strlen(implode("\n", $result['output']));
    if ($result['truncated'] !== $truncated || $actual !== $bytes || $outputBytes > 32768
        || $result['ok'] === $truncated || $result['exitCode'] !== ($truncated ? 125 : 0)) {
        throw new RuntimeException("Output limit regression: $name");
    }
    $results[$name] = ['bytes' => $actual, 'outputBytes' => $outputBytes, 'truncated' => $result['truncated']];
}
echo json_encode($results);
