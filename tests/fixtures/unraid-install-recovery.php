<?php

// Linux fixture. Every writable path in the manifest and optional Unraid CLI is rooted here.
$root = sys_get_temp_dir() . '/fvplus-install-recovery-' . bin2hex(random_bytes(8));
if (!preg_match('#^/tmp/fvplus-install-recovery-[0-9a-f]{16}$#D', $root) || !mkdir($root, 0700)) {
    throw new RuntimeException('Could not create a confined installer fixture.');
}
register_shutdown_function(static function () use ($root): void {
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
        if ($file->isDir() && !$file->isLink()) rmdir($file->getPathname());
        else unlink($file->getPathname());
    }
    rmdir($root);
});

function verifyInstallFixture(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$source = file_get_contents($argv[1]);
$cliSource = isset($argv[2]) ? file_get_contents($argv[2]) : null;
if ($cliSource !== null) {
    verifyInstallFixture(
        is_string($cliSource) && hash('sha256', $cliSource) === '41450297945ecacc11374fecf7007d244b415d94809bb1c098bb059c0ef87292',
        'Expected the Unraid 7.4.0 plugin manager at b135287c706a30da44f71cc7820615209e83e9a0.'
    );
}
verifyInstallFixture(is_string($source), 'Could not read plugin manifest.');
$previous = '2026.01.01.01';
$candidate = '2026.01.01.02';
$pluginName = 'folderview.plus';
$cases = $cliSource === null
    ? ['hook-icon', 'hook-scheduler', 'hook-report', 'hook-success', 'hook-unknown']
    : ['update-icon', 'update-scheduler', 'update-report', 'install-icon', 'install-scheduler', 'install-report', 'update-success', 'install-success'];
$check = [];

foreach ($cases as $case) {
    $dir = "$root/$case";
    $boot = "$dir/boot";
    $config = "$boot/$pluginName";
    $runtime = "$dir/emhttp/plugins/$pluginName";
    foreach ([$config, "$runtime/scripts", "$dir/emhttp/webGui/include", "$dir/emhttp/webGui/scripts", "$dir/bin", "$dir/cron.d", "$dir/running", "$dir/downloads", "$dir/manual"] as $folder) {
        mkdir($folder, 0770, true);
    }
    $rewrite = [
        '/boot/config/plugins' => $boot,
        '/usr/local/emhttp' => "$dir/emhttp",
        '/tmp/folderview.plus' => "$dir/folderview.plus",
        '/etc/cron.d' => "$dir/cron.d",
        '/etc/rc.d/rc.crond' => "$dir/bin/crond",
        '/etc/unraid-version' => "$dir/unraid-version",
        '/var/log/plugins' => "$dir/running",
        '/tmp/plugins' => "$dir/downloads",
        '/tmp/inline' => "$dir/inline",
        '/usr/local/sbin/update_cron' => "$dir/bin/crond"
    ];
    $manifest = static function (string $version, string $icon) use ($source, $rewrite): string {
        $values = [
            'version' => $version,
            'md5' => md5("core $version"),
            'sha256' => hash('sha256', "core $version"),
            'iconPackVersion' => $icon,
            'iconPackMd5' => md5("icons $icon"),
            'iconPackSha256' => hash('sha256', "icons $icon")
        ];
        $text = $source;
        foreach ($values as $name => $value) {
            $text = preg_replace('/^<!ENTITY ' . $name . ' "[^"]+">/m', '<!ENTITY ' . $name . ' "' . $value . '">', $text, 1, $count);
            verifyInstallFixture($count === 1, "Fixture requires the $name entity.");
        }
        return strtr($text, $rewrite);
    };
    $oldManifest = $manifest($previous, '1.0.0');
    $newManifest = $manifest($candidate, '2.0.0');
    $bootManifest = "$boot/$pluginName.plg";
    $runningLink = "$dir/running/$pluginName.plg";
    file_put_contents($bootManifest, $case === 'hook-unknown' ? '<PLUGIN/>' : $oldManifest);
    symlink($bootManifest, $runningLink);
    file_put_contents("$dir/downloads/$pluginName.plg", $newManifest);
    file_put_contents("$dir/manual/$pluginName.plg", $newManifest);
    file_put_contents("$config/version", "$previous\n");
    file_put_contents("$config/docker.json", '{"previous":"Docker"}');
    file_put_contents("$config/vm.json", '{"previous":"VM"}');
    foreach ([$previous, $candidate, '2025.01.01.01'] as $version) file_put_contents("$config/$pluginName-$version.txz", "core $version");
    foreach (['1.0.0', '2.0.0', '0.9.0'] as $icon) file_put_contents("$config/$pluginName-icons-$icon.txz", "icons $icon");

    $cronFile = "$dir/cron.d/$pluginName";
    if (str_ends_with($case, 'scheduler')) mkdir($cronFile);
    $iconFailure = str_ends_with($case, 'icon') ? '[ "$1" != 2.0.0 ] || exit 23' : ':';
    file_put_contents("$runtime/scripts/install_icon_asset_pack.sh", "$iconFailure\n");
    $reportFailure = str_ends_with($case, 'report') ? '[ "$1 $2" != "complete ' . $candidate . '" ] || exit 24' : ':';
    file_put_contents("$runtime/scripts/install_report.sh", "$reportFailure\nprintf '%s\\n' \"\$1\"\n");
    file_put_contents("$dir/unraid-version", "version=7.4.0\n");
    file_put_contents("$dir/emhttp/webGui/include/Wrappers.php", '<?php function my_logger(...$args) {}');
    file_put_contents("$dir/emhttp/webGui/include/publish.php", '<?php function publish(...$args) {}');
    foreach ([
        "$dir/emhttp/webGui/scripts/notify" => 'exit 0',
        "$dir/bin/crond" => 'exit 0',
        "$dir/bin/wget" => 'printf "offline fixture attempted a download\n" >&2; exit 4',
        "$dir/bin/upgradepkg" => 'printf "%s\n" "$2" > "$FVPLUS_FIXTURE_CORE"'
    ] as $file => $body) {
        file_put_contents($file, "#!/bin/bash\n$body\n");
        chmod($file, 0700);
    }
    $run = static function (array $command) use ($dir): array {
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['redirect', 1]], $pipes, $dir, [
            'PATH' => "$dir/bin:/usr/bin:/bin",
            'DOCUMENT_ROOT' => "$dir/emhttp",
            'FVPLUS_FIXTURE_CORE' => "$dir/core-installed"
        ]);
        if (!is_resource($process)) throw new RuntimeException('Could not start installer fixture.');
        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        return [proc_close($process), $output];
    };

    if ($cliSource !== null) {
        $cli = "$dir/plugin.php";
        file_put_contents($cli, strtr($cliSource, $rewrite));
        $command = str_starts_with($case, 'update')
            ? [PHP_BINARY, $cli, 'update', "$pluginName.plg"]
            : [PHP_BINARY, $cli, 'install', "$dir/manual/$pluginName.plg", 'forced'];
    } else {
        $xml = simplexml_load_string($newManifest, null, LIBXML_NONET);
        verifyInstallFixture($xml !== false, 'Could not parse the fixture manifest.');
        $hooks = $xml->xpath('//FILE[INLINE]');
        $command = ['/bin/bash', '-c', (string)$hooks[1]->INLINE];
    }
    [$status, $output] = $run($command);
    $failed = !str_ends_with($case, 'success') && $case !== 'hook-unknown';
    verifyInstallFixture(($status !== 0) === $failed, "$case returned $status: $output");
    verifyInstallFixture(file_get_contents("$config/docker.json") === '{"previous":"Docker"}', "$case changed Docker configuration.");
    verifyInstallFixture(file_get_contents("$config/vm.json") === '{"previous":"VM"}', "$case changed VM configuration.");
    verifyInstallFixture(is_file("$config/$pluginName-$previous.txz") && is_file("$config/$pluginName-icons-1.0.0.txz"), "$case removed registered boot files.");
    verifyInstallFixture(is_file("$config/$pluginName-$candidate.txz") && is_file("$config/$pluginName-icons-2.0.0.txz"), "$case removed incoming boot files.");
    verifyInstallFixture(trim(file_get_contents("$config/version")) === ($failed ? $previous : $candidate), "$case wrote the wrong version.");
    verifyInstallFixture(is_file("$config/$pluginName-2025.01.01.01.txz") === ($failed || $case === 'hook-unknown'), "$case pruned unexpectedly.");
    verifyInstallFixture(is_file("$config/$pluginName-icons-0.9.0.txz") === ($failed || $case === 'hook-unknown'), "$case pruned an icon pack unexpectedly.");

    if ($cliSource !== null) {
        verifyInstallFixture(file_get_contents($bootManifest) === ($failed ? $oldManifest : $newManifest), "$case registered the wrong manifest.");
        verifyInstallFixture(readlink($runningLink) === $bootManifest, "$case changed the running manifest link.");
        verifyInstallFixture(is_file("$dir/core-installed"), "$case did not reach package installation: $output");
        if (is_dir($cronFile)) rmdir($cronFile);
        unlink($runningLink);
        unlink("$dir/core-installed");
        [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $bootManifest]);
        verifyInstallFixture($bootStatus === 0, "$case could not reinstall offline: $bootOutput");
        $bootVersion = $failed ? $previous : $candidate;
        verifyInstallFixture(trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$bootVersion.txz", "$case reinstalled the wrong core archive.");
    }
    $check[] = $case;
}

echo json_encode($check, JSON_THROW_ON_ERROR);
