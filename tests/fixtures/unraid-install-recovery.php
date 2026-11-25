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
$unraidVersion = '7.4.0';
if ($cliSource !== null) {
    $supportedCli = [
        // b135287c706a30da44f71cc7820615209e83e9a0
        '41450297945ecacc11374fecf7007d244b415d94809bb1c098bb059c0ef87292' => '7.4.0',
        // 71a85f020b9b1bce48b5bec75d69d78a57d8df3d
        '1b001772de850c9539742f34469e6a61402dd4018210632c015e9ef3ce511d23' => '7.0.0'
    ];
    $unraidVersion = is_string($cliSource) ? ($supportedCli[hash('sha256', $cliSource)] ?? '') : '';
    verifyInstallFixture($unraidVersion !== '', 'Expected the pinned Unraid 7.0.0 or 7.4.0 plugin manager.');
}
verifyInstallFixture(is_string($source), 'Could not read plugin manifest.');
$priorSource = isset($argv[3]) ? file_get_contents($argv[3]) : $source;
verifyInstallFixture(is_string($priorSource), 'Could not read the previous plugin manifest.');
$candidate = '2026.01.01.02';
$pluginName = 'folderview.plus';
$scriptSource = __DIR__ . '/../../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts';
$iconArchives = [];
foreach (['1.0.0', '2.0.0', '3.0.0'] as $iconVersion) {
    $iconRoot = "$root/icons-$iconVersion";
    mkdir("$iconRoot/third-party-icons", 0700, true);
    file_put_contents("$iconRoot/asset-pack.json", "{\"version\": \"$iconVersion\", \"fileCount\": 1}\n");
    file_put_contents("$iconRoot/third-party-icons/fixture.svg", "<svg><title>$iconVersion</title></svg>\n");
    $iconArchive = "$root/icons-$iconVersion.txz";
    $tar = proc_open(['tar', '-cJf', $iconArchive, '-C', $iconRoot, 'asset-pack.json', 'third-party-icons'], [], $pipes);
    verifyInstallFixture(is_resource($tar) && proc_close($tar) === 0, 'Could not build the synthetic icon archive.');
    $iconArchives[$iconVersion] = $iconArchive;
}
$cases = $cliSource === null
    ? ['hook-core', 'hook-icon', 'hook-scheduler', 'hook-report', 'hook-damaged-report', 'hook-legacy-damaged-report',
        'hook-version', 'hook-corrupt', 'hook-fresh-report', 'hook-success', 'hook-reinstall-success', 'hook-unknown']
    : ['update-core', 'update-icon', 'update-scheduler', 'update-report', 'update-version', 'update-overlap-version',
        'update-overlap-success', 'update-late-remove-success', 'update-late-check-success', 'install-url-remove-success', 'install-local-stage-remove-success',
        'install-url-channel-downgrade-success', 'update-staged-registration-conflict', 'update-older-staged-manifest',
        'update-registration-version', 'update-corrupt',
        'install-icon', 'install-scheduler', 'install-report', 'install-damaged-report', 'install-fresh-report',
        'update-success', 'install-success', 'install-reinstall-success',
        'install-native-remove-failure', 'install-native-remove-partial-failure',
        'install-native-remove-same-boot-partial-failure',
        'install-remove-stale-registration-success', 'install-boot-contention-success', 'update-staged-peer-success',
        'update-stale-records-success', 'update-stale-records-core', 'update-missing-runtime-core', 'install-remove-reinstall-stale-success',
        'update-legacy-registration-interrupted-success', 'update-early-activation-interrupted-success',
        'update-journal-interrupted-success', 'update-late-check-interrupted-boot-success', 'install-fresh-journal-interrupted-success',
        'update-rollback-retry-success', 'update-rollback-before-boot-success', 'install-local-journal-interrupted-success', 'install-remove-scheduler-retry-success',
        'install-remove-stale-cleanup-retry-success', 'install-renamed-local-success',
        'install-fresh-extract-success', 'install-fresh-extract-retry-success', 'install-fresh-unverified-runtime',
        'install-remove-archive-obstructed-success', 'install-remove-native-handoff-success',
        'install-remove-boot-finalize-success', 'install-remove-prepared-before-reboot-success',
        'install-remove-archived-reinstall-success'];
if ($cliSource !== null && $unraidVersion === '7.4.0') {
    $cases[] = 'install-remove-nextboot-staged-success';
    $cases[] = 'install-native-remove-nextboot-staged-failure';
    $cases[] = 'install-remove-nextboot-staged-interrupted-prepared-success';
    $cases[] = 'install-native-remove-nextboot-staged-partial-failure';
}
$check = [];

foreach ($cases as $case) {
    $reinstall = str_contains($case, '-reinstall-');
    $channelDowngrade = $case === 'install-url-channel-downgrade-success';
    $previous = $reinstall || $channelDowngrade ? $candidate : '2026.01.01.01';
    $previousIcon = $reinstall || $channelDowngrade ? '2.0.0' : '1.0.0';
    $dir = "$root/$case";
    $boot = "$dir/boot";
    $nextboot = "$dir/boot-nextboot";
    $config = "$boot/$pluginName";
    $runtime = "$dir/emhttp/plugins/$pluginName";
    $postHooks = "$dir/emhttp/plugins/dynamix.plugin.manager/post-hooks";
    $registrationHook = "$postHooks/00-folderview.plus-registration";
    $removalHook = "$postHooks/00-folderview.plus-removal";
    $removalWrapper = "$boot/00-folderview.plus-removal-recovery.plg";
    $removalHelper = "$boot/.folderview.plus-removal.sh";
    $recoveryWrapper = "$boot/00-folderview.plus-registration-recovery.plg";
    $journal = "$config/.native-registration";
    $packages = str_contains($case, '-legacy-') ? "$dir/legacy-packages" : "$dir/packages";
    foreach ([$config, "$runtime/scripts", "$dir/emhttp/webGui/include", "$dir/emhttp/webGui/scripts", "$dir/bin", "$dir/cron.d", "$dir/running", "$dir/downloads", "$dir/manual", $packages, $postHooks] as $folder) {
        mkdir($folder, 0770, true);
    }
    $rewrite = [
        '/boot/config/plugins-nextboot' => $nextboot,
        '/boot/config/plugins' => $boot,
        '/usr/local/emhttp' => "$dir/emhttp",
        '/tmp/folderview.plus' => "$dir/folderview.plus",
        '/tmp/folderview-plus-archive' => "$dir/archive-preflight",
        '/run/folderview.plus-install.lock' => "$dir/install.lock",
        '/run/folderview.plus-registration' => "$dir/registration",
        '/proc/sys/kernel/random/boot_id' => "$dir/boot-id",
        '/etc/cron.d' => "$dir/cron.d",
        '/etc/rc.d/rc.crond' => "$dir/bin/crond",
        '/etc/unraid-version' => "$dir/unraid-version",
        '/var/lib/pkgtools/packages' => "$dir/packages",
        '/var/log/packages' => "$dir/legacy-packages",
        '/var/log/plugins' => "$dir/running",
        '/tmp/plugins' => "$dir/downloads",
        '/tmp/inline' => "$dir/inline",
        '/usr/local/sbin/update_cron' => "$dir/bin/crond"
    ];
    file_put_contents("$dir/boot-id", "synthetic boot one\n");
    $manifest = static function (string $version, string $icon, ?string $template = null) use ($source, $rewrite, $iconArchives): string {
        $values = [
            'version' => $version,
            'md5' => md5("core $version"),
            'sha256' => hash('sha256', "core $version"),
            'iconPackVersion' => $icon,
            'iconPackMd5' => md5_file($iconArchives[$icon]),
            'iconPackSha256' => hash_file('sha256', $iconArchives[$icon])
        ];
        $text = $template ?? $source;
        foreach ($values as $name => $value) {
            $text = preg_replace('/^<!ENTITY ' . $name . ' "[^"]+">/m', '<!ENTITY ' . $name . ' "' . $value . '">', $text, 1, $count);
            verifyInstallFixture($count === 1, "Fixture requires the $name entity.");
        }
        return strtr($text, $rewrite);
    };
    $oldManifest = $manifest($previous, $previousIcon, $reinstall ? $source : $priorSource);
    $newManifest = $manifest($candidate, '2.0.0');
    $bootManifest = "$boot/$pluginName.plg";
    $runningLink = "$dir/running/$pluginName.plg";
    $fresh = str_contains($case, '-fresh-') || $case === 'hook-unknown';
    $failed = !str_ends_with($case, 'success') && $case !== 'hook-unknown';
    $keepsStaleRecords = str_contains($case, '-stale-') || in_array($case, ['update-registration-version', 'update-missing-runtime-core', 'install-native-remove-failure'], true);
    if (!$fresh) {
        file_put_contents($bootManifest, $oldManifest);
        symlink($bootManifest, $runningLink);
        file_put_contents("$config/version", "$previous\n");
        file_put_contents("$dir/core-installed", "$config/$pluginName-$previous.txz\n");
        file_put_contents("$packages/$pluginName-$previous", "PACKAGE NAME: $pluginName-$previous\n");
        if ($keepsStaleRecords) {
            foreach (['2025.12.31.01', '2026.01.01.03'] as $stale) {
                file_put_contents("$packages/$pluginName-$stale", "PACKAGE NAME: $pluginName-$stale\n");
            }
            symlink($packages, "$dir/legacy-packages");
        }
        if (!str_contains($case, '-legacy-')) {
            file_put_contents("$runtime/build-metadata.json", "{\n  \"packageVersion\": \"$previous\",\n  \"sourceBranch\": \"dev\"\n}\n");
        }
        if (!$reinstall && !str_contains($case, '-damaged-')) {
            file_put_contents("$runtime/FolderViewPlus.page", "$config/$pluginName-$previous.txz\n");
        }
    } elseif ($case === 'hook-unknown') {
        file_put_contents($bootManifest, '<PLUGIN/>');
    }
    file_put_contents("$dir/downloads/$pluginName.plg", $newManifest);
    file_put_contents("$dir/manual/$pluginName.plg", $newManifest);
    file_put_contents("$config/docker.json", '{"previous":"Docker"}');
    file_put_contents("$config/vm.json", '{"previous":"VM"}');
    foreach ([$previous, $candidate, '2025.01.01.01'] as $version) file_put_contents("$config/$pluginName-$version.txz", "core $version");
    foreach ($iconArchives as $icon => $archive) copy($archive, "$config/$pluginName-icons-$icon.txz");
    file_put_contents("$config/$pluginName-icons-0.9.0.txz", 'older icons');
    if (str_ends_with($case, '-corrupt')) file_put_contents("$config/$pluginName-$previous.txz", 'corrupt archive');

    $cronFile = "$dir/cron.d/$pluginName";
    $priorCron = "# fixture previous cron entry\n";
    if (str_ends_with($case, 'scheduler')) {
        mkdir($cronFile);
    } elseif (!$fresh) {
        file_put_contents($cronFile, $priorCron);
        chmod($cronFile, 0600);
    }
    foreach (['archive_preflight.sh', 'install_icon_asset_pack.sh', 'complete_native_registration.sh'] as $script) {
        $installedScript = "$runtime/scripts/$script";
        file_put_contents($installedScript, strtr(file_get_contents("$scriptSource/$script"), $rewrite));
        chmod($installedScript, 0700);
    }
    copy("$runtime/scripts/complete_native_registration.sh", "$dir/recovery-script");
    if (str_ends_with($case, 'icon')) {
        // Fail after the real helper has activated the candidate's icon link and cache.
        file_put_contents("$runtime/scripts/install_icon_asset_pack.sh", "\n[ \"\$1\" != 2.0.0 ] || exit 23\n", FILE_APPEND);
    }
    $reportFailure = str_ends_with($case, 'report') ? '[ "$1 $2" != "complete ' . $candidate . '" ] || exit 24' : ':';
    file_put_contents("$runtime/scripts/install_report.sh", "$reportFailure\n" . strtr(file_get_contents("$scriptSource/install_report.sh"), $rewrite));
    file_put_contents("$dir/unraid-version", "version=$unraidVersion\n");
    file_put_contents("$dir/emhttp/webGui/include/Wrappers.php", '<?php function my_logger(...$args) {}');
    file_put_contents("$dir/emhttp/webGui/include/publish.php", '<?php function publish(...$args) {}');
    foreach ([
        "$dir/emhttp/webGui/scripts/notify" => 'exit 0',
        "$dir/bin/crond" => '[ ! -e /proc/$$/fd/9 ]',
        "$dir/bin/plugin" => 'exec php "$FVPLUS_FIXTURE_DIR/plugin.php" "$@"',
        "$dir/bin/tar" => 'if [ "$1" = -xOf ] && [[ "$3" == */scripts/complete_native_registration.sh ]]; then
    test -f "$2" || exit 32
    exec cat "$FVPLUS_FIXTURE_DIR/recovery-script"
fi
exec /bin/tar "$@"',
        "$dir/bin/wget" => 'while [ "$#" -gt 1 ] && [ "$1" != -O ]; do shift; done
if [ "$#" -gt 1 ] && [ "$2" = "$FVPLUS_FIXTURE_DIR/downloads/folderview.plus.plg" ] &&
    [ -f "$FVPLUS_FIXTURE_DIR/remote.plg" ]; then
    cp -- "$FVPLUS_FIXTURE_DIR/remote.plg" "$2"
    exit $?
fi
printf "offline fixture attempted a download\n" >&2; exit 4',
        "$dir/bin/upgradepkg" => 'archive="${@: -1}"
if [ "${FVPLUS_FIXTURE_FAIL_PRIOR_PACKAGE:-}" = 1 ] && [[ "$archive" == *-2026.01.01.01.txz ]]; then
    printf "Transient previous-package failure\n" >&2
    exit 31
fi
if [ "$(cat "$FVPLUS_FIXTURE_CORE" 2>/dev/null)" = "$archive" ] && [[ " $* " != *" --reinstall "* ]]; then exit 0; fi
package="${archive##*/}"
if [ "$FVPLUS_FIXTURE_KEEP_STALE_RECORDS" != 1 ]; then
    rm -f -- "$FVPLUS_FIXTURE_PACKAGES"/folderview.plus-*
fi
if [ ! -d "$FVPLUS_FIXTURE_RUNTIME" ]; then
    mkdir -p "$FVPLUS_FIXTURE_RUNTIME"
    cp -R "$FVPLUS_FIXTURE_DIR/package-scripts" "$FVPLUS_FIXTURE_RUNTIME/scripts"
fi
if [[ "$archive" == *-2026.01.01.02.txz ]]; then
    cp "$FVPLUS_FIXTURE_DIR/recovery-script" "$FVPLUS_FIXTURE_RUNTIME/scripts/complete_native_registration.sh"
fi
if [ -n "${FVPLUS_FIXTURE_STOP_EXTRACTION:-}" ]; then
    printf "Partial extraction\n" > "$FVPLUS_FIXTURE_RUNTIME/FolderViewPlus.page"
    if [ "$FVPLUS_FIXTURE_STOP_EXTRACTION" = after-metadata ]; then
        printf "{\n  \"packageVersion\": \"2026.01.01.02\"\n}\n" > "$FVPLUS_FIXTURE_RUNTIME/build-metadata.json"
    fi
    exit 36
fi
printf "PACKAGE NAME: %s\n" "${package%.txz}" > "$FVPLUS_FIXTURE_PACKAGES/${package%.txz}"
printf "%s\n" "$archive" > "$FVPLUS_FIXTURE_CORE"
printf "%s\n" "$archive" > "$FVPLUS_FIXTURE_RUNTIME/FolderViewPlus.page"
version="${package#folderview.plus-}"
printf "{\n  \"packageVersion\": \"%s\",\n  \"sourceBranch\": \"dev\"\n}\n" "${version%.txz}" > "$FVPLUS_FIXTURE_RUNTIME/build-metadata.json"
if [[ "$FVPLUS_FIXTURE_CASE" = update-early-activation-interrupted-success || "$FVPLUS_FIXTURE_CASE" = update-rollback-retry-success ]]; then
    printf "%s\n" "$package" >> "$FVPLUS_FIXTURE_DIR/package-history"
    if [ "$package" = folderview.plus-2026.01.01.02.txz ] && [ "${FVPLUS_FIXTURE_INTERRUPT:-}" != 1 ] &&
        [ "${FVPLUS_FIXTURE_FAIL_VERSION_COMMIT:-}" != 1 ]; then
        cat "$FVPLUS_FIXTURE_DIR/cron.d/folderview.plus" > "$FVPLUS_FIXTURE_DIR/recovered-cron"
        stat -c "%a" "$FVPLUS_FIXTURE_DIR/cron.d/folderview.plus" > "$FVPLUS_FIXTURE_DIR/recovered-cron-mode"
    fi
fi
if [[ "$FVPLUS_FIXTURE_CASE" == *-core && "$archive" == *-2026.01.01.02.txz ]]; then exit 22; fi',
        "$dir/bin/removepkg" => 'if [ "${FVPLUS_FIXTURE_INTERRUPT_REMOVAL:-}" = 1 ]; then
    kill -KILL "$PPID"
    exit 0
fi
if [[ "$FVPLUS_FIXTURE_CASE" == install-native-remove*-failure && "${FVPLUS_FIXTURE_ALLOW_REMOVE_RETRY:-}" != 1 ]]; then
    if [[ "$FVPLUS_FIXTURE_CASE" == *-partial-failure ]]; then
        rm -f -- "$FVPLUS_FIXTURE_RUNTIME/scripts/install_icon_asset_pack.sh"
    fi
    if [[ "$FVPLUS_FIXTURE_CASE" = install-native-remove-same-boot-partial-failure ]]; then
        rm -f -- "$FVPLUS_FIXTURE_RUNTIME/build-metadata.json"
    fi
    printf "Native removal fixture failed\n" >&2
    exit 28
fi
[ -f "$FVPLUS_FIXTURE_PACKAGES/$1" ] || exit 29
rm -f -- "$FVPLUS_FIXTURE_CORE" "$FVPLUS_FIXTURE_RUNTIME/FolderViewPlus.page" "$FVPLUS_FIXTURE_RUNTIME/build-metadata.json" "$FVPLUS_FIXTURE_PACKAGES/$1"',
        "$dir/bin/rm" => 'if [ "${FVPLUS_FIXTURE_FAIL_REMOVE_SCHEDULER:-}" = 1 ] &&
    [[ "${@: -1}" == */cron.d/folderview.plus ]]; then exit 33; fi
if [ "${FVPLUS_FIXTURE_FAIL_REMOVE_CONFIG:-}" = 1 ] &&
    [[ "${@: -1}" == */boot/folderview.plus ]]; then exit 34; fi
if [ "${FVPLUS_FIXTURE_FAIL_FRESH_CLEANUP:-}" = 1 ] &&
    [ "${@: -1}" = "$FVPLUS_FIXTURE_RUNTIME" ]; then exit 37; fi
exec /bin/rm "$@"',
        "$dir/bin/flock" => 'if [ "$FVPLUS_FIXTURE_CASE" = install-boot-contention-success ] && [ "$#" -eq 1 ] && [ "$1" = 9 ]; then
    touch "$FVPLUS_FIXTURE_DIR/boot-lock-waiting"
fi
exec /usr/bin/flock "$@"',
        "$dir/bin/mv" => 'if [[ "$FVPLUS_FIXTURE_CASE" = update-late-*-success ]] &&
    [[ "${@: -1}" == */boot/folderview.plus.plg && "${@: -2:1}" == */boot/.folderview.plus.plg.* ]]; then
    touch "$FVPLUS_FIXTURE_DIR/registration-commit-paused"
    for ((attempt=0; attempt<200; attempt++)); do
        [ ! -f "$FVPLUS_FIXTURE_DIR/allow-registration-commit" ] || exec /bin/mv "$@"
        sleep 0.05
    done
    exit 27
fi
if [[ "$FVPLUS_FIXTURE_CASE" = install-remove-nextboot-staged-interrupted-prepared-success &&
    "${@: -1}" == */boot/.folderview.plus-removal.nextboot && "${@: -2:1}" == */boot-nextboot/folderview.plus.plg ]]; then
    /bin/mv "$@" || exit $?
    kill -KILL "$PPID"
    exit 0
fi
if [ "${FVPLUS_FIXTURE_FAIL_MANIFEST_COMMIT:-}" = 1 ] &&
    [[ "${@: -1}" == */boot/folderview.plus.plg && "${@: -2:1}" == */boot/.folderview.plus.plg.* ]]; then
    exit 35
fi
if [[ "${@: -1}" == */version && "${@: -2:1}" == */.version.* ]] &&
    [ "$(cat "${@: -2:1}")" = 2026.01.01.02 ] && [ "${FVPLUS_FIXTURE_ALLOW_VERSION_COMMIT:-}" != 1 ]; then
    [ "${FVPLUS_FIXTURE_FAIL_VERSION_COMMIT:-}" != 1 ] || exit 25
    if [ "${FVPLUS_FIXTURE_PAUSE_BEFORE_VERSION:-}" = 1 ]; then
        touch "$FVPLUS_FIXTURE_DIR/version-commit-paused"
        for ((attempt=0; attempt<200; attempt++)); do
            [ ! -f "$FVPLUS_FIXTURE_DIR/allow-version-failure" ] || exit 25
            [ ! -f "$FVPLUS_FIXTURE_DIR/allow-version-commit" ] || exec /bin/mv "$@"
            sleep 0.05
        done
        exit 27
    fi
    [[ "$FVPLUS_FIXTURE_CASE" != *-version ]] || exit 25
fi
if [[ "$FVPLUS_FIXTURE_CASE" == update-journal-interrupted-success && "${FVPLUS_FIXTURE_INTERRUPT:-}" == 1 &&
    "${@: -1}" == */version && "${@: -2:1}" == */.version.* ]]; then
    /bin/mv "$@" || exit $?
    kill -KILL "$PPID"
    exit 0
fi
if [[ "${FVPLUS_FIXTURE_INTERRUPT:-}" == 1 ]]; then
    if [[ ( "$FVPLUS_FIXTURE_CASE" == update-early-activation-interrupted-success ||
            "$FVPLUS_FIXTURE_CASE" == install-local-journal-interrupted-success ) &&
            "${@: -1}" == */cron.d/folderview.plus ]]; then
        /bin/mv "$@" || exit $?
        kill -KILL "$PPID"
        exit 0
    fi
    if [[ "$FVPLUS_FIXTURE_CASE" == install-fresh-journal-interrupted-success && "${@: -1}" == */boot/folderview.plus.plg ]]; then
        kill -KILL "$PPID"
        exit 0
    fi
fi
exec /bin/mv "$@"'
    ] as $file => $body) {
        file_put_contents($file, "#!/bin/bash\n$body\n");
        chmod($file, 0700);
    }
    $start = static function (array $command, array $extraEnvironment = []) use ($dir, $case, $runtime, $packages, $keepsStaleRecords): array {
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['redirect', 1]], $pipes, $dir, [
            'PATH' => "$dir/bin:/usr/bin:/bin",
            'DOCUMENT_ROOT' => "$dir/emhttp",
            'FVPLUS_FIXTURE_CORE' => "$dir/core-installed",
            'FVPLUS_FIXTURE_PACKAGES' => $packages,
            'FVPLUS_FIXTURE_KEEP_STALE_RECORDS' => $keepsStaleRecords ? '1' : '0',
            'FVPLUS_FIXTURE_RUNTIME' => $runtime,
            'FVPLUS_FIXTURE_CASE' => $case,
            'FVPLUS_FIXTURE_DIR' => $dir
        ] + $extraEnvironment);
        if (!is_resource($process)) throw new RuntimeException('Could not start installer fixture.');
        return [$process, $pipes[1]];
    };
    $finish = static function (array $activeProcess): array {
        [$process, $outputPipe] = $activeProcess;
        $output = stream_get_contents($outputPipe);
        fclose($outputPipe);
        return [proc_close($process), $output];
    };
    $run = static fn(array $command, array $environment = []): array => $finish($start($command, $environment));

    $xml = simplexml_load_string($newManifest, null, LIBXML_NONET);
    verifyInstallFixture($xml !== false, 'Could not parse the fixture manifest.');
    $hooks = $xml->xpath('//FILE[INLINE and not(@Method)]');
    verifyInstallFixture(count($hooks) === 1, 'Expected a single installation activation hook.');
    $activateHook = ['/bin/bash', '-c', (string)$hooks[0]->INLINE];

    if (!$fresh) {
        [$oldIconStatus, $oldIconOutput] = $run(['/bin/bash', "$runtime/scripts/install_icon_asset_pack.sh", $previousIcon, hash_file('sha256', $iconArchives[$previousIcon])]);
        verifyInstallFixture($oldIconStatus === 0, "$case could not activate its previous icon pack: $oldIconOutput");
    }

    if ($cliSource !== null) {
        $cli = "$dir/plugin.php";
        $nativeCode = strtr($cliSource, $rewrite);
        if (in_array($case, ['install-remove-native-handoff-success', 'install-remove-boot-finalize-success'], true)) {
            // Inject a destination conflict after the remove hook has finished.
            $needle = 'return rename($src_file, $tar_dir."/".basename($src_file));';
            $nativeCode = str_replace($needle, 'if (getenv("FVPLUS_FIXTURE_FAIL_NATIVE_REMOVE_MOVE") === "1" && $tar_dir === "'
                . "$boot-removed" . '") mkdir($tar_dir."/".basename($src_file));' . "\n  " . $needle, $nativeCode, $replaced);
            verifyInstallFixture($replaced === 1, 'Could not inject the final native move failure.');
        } elseif (in_array($case, ['update-late-check-interrupted-boot-success', 'install-remove-archived-reinstall-success'], true)) {
            // Stop the native owner after its flash copy, before it decides which post-hooks to run.
            $needle = 'function post_hooks($error=\'\') {';
            $nativeCode = str_replace($needle, $needle . "\n" . '  if (getenv("FVPLUS_FIXTURE_INTERRUPT") === "1" && $error === "") exit(137);', $nativeCode, $replaced);
            verifyInstallFixture($replaced === 1, 'Could not inject the native post-copy interruption.');
        }
        file_put_contents($cli, $nativeCode);
        $command = str_starts_with($case, 'update')
            ? [PHP_BINARY, $cli, 'update', "$pluginName.plg"]
            : [PHP_BINARY, $cli, 'install', "$dir/manual/$pluginName.plg", 'forced'];
    } else {
        $command = $activateHook;
    }
    mkdir("$dir/package-scripts");
    foreach (glob("$runtime/scripts/*.sh") as $script) {
        $packagedScript = "$dir/package-scripts/" . basename($script);
        copy($script, $packagedScript);
        chmod($packagedScript, 0700);
    }
    if ($fresh && $case !== 'install-fresh-unverified-runtime') {
        rename($runtime, "$dir/prepared-runtime");
    }
    if ($case === 'update-missing-runtime-core') {
        rename($runtime, "$dir/missing-runtime");
    }
    if ($case === 'install-renamed-local-success') {
        $alias = "$dir/manual/$pluginName-copy.plg";
        file_put_contents($alias, $newManifest);
        [$rejectedStatus, $rejectedOutput] = $run([PHP_BINARY, $cli, 'install', $alias, 'forced']);
        verifyInstallFixture($rejectedStatus !== 0 && str_contains($rejectedOutput, "requires the native manifest filename $pluginName.plg")
            && file_get_contents($bootManifest) === $oldManifest && !file_exists("$boot/$pluginName-copy.plg")
            && !is_link("$dir/running/$pluginName-copy.plg") && trim(file_get_contents("$config/version")) === $previous
            && !is_dir($journal), "$case let a renamed manifest change native registration: $rejectedOutput");
        $command = [PHP_BINARY, $cli, 'update', "$pluginName.plg"];
    }
    if (str_starts_with($case, 'install-fresh-extract-')) {
        $sibling = "$dir/emhttp/plugins/sibling-marker";
        file_put_contents($sibling, 'unrelated');
        $needsRetry = $case === 'install-fresh-extract-retry-success';
        [$failedStatus, $failedOutput] = $run($command, [
            'FVPLUS_FIXTURE_STOP_EXTRACTION' => $needsRetry ? 'after-metadata' : 'before-metadata',
            'FVPLUS_FIXTURE_FAIL_FRESH_CLEANUP' => $needsRetry ? '1' : '0'
        ]);
        clearstatcache();
        verifyInstallFixture($failedStatus !== 0 && !is_file($bootManifest) && !is_link($runningLink)
            && !is_file("$packages/$pluginName-$candidate") && !is_file("$config/version") && !is_file($cronFile)
            && file_get_contents($sibling) === 'unrelated', "$case changed native registration during partial extraction: $failedOutput");
        verifyInstallFixture(is_dir($runtime) === $needsRetry && is_dir($journal) === $needsRetry && is_file($recoveryWrapper) === $needsRetry,
            "$case did not clean the partial runtime or retain recovery on failure: $failedOutput");
        if ($needsRetry) {
            verifyInstallFixture(is_file("$journal/runtime-absent") && is_file("$journal/rollback")
                && str_contains($failedOutput, 'could not fully restore'), "$case falsely reported successful cleanup: $failedOutput");
            // Retry replays the retained cleanup even though pkgtools never registered the package.
            [$recoveredStatus, $recoveredOutput] = $run($command, ['FVPLUS_FIXTURE_STOP_EXTRACTION' => 'before-metadata']);
            clearstatcache();
            verifyInstallFixture($recoveredStatus !== 0 && !is_dir($runtime) && !is_dir($journal) && !is_file($recoveryWrapper)
                && str_contains($recoveredOutput, 'restored the previous installation state'),
                "$case could not clean the partial runtime on retry: $recoveredOutput");
        } else {
            verifyInstallFixture(str_contains($failedOutput, 'restored the previous installation state'),
                "$case did not report verified rollback: $failedOutput");
        }
    }
    if ($case === 'install-fresh-unverified-runtime') {
        file_put_contents("$runtime/pre-existing", 'keep');
        [$status, $output] = $run($command, ['FVPLUS_FIXTURE_STOP_EXTRACTION' => 'before-metadata']);
        verifyInstallFixture($status !== 0 && str_contains($output, 'cannot verify the existing runtime for rollback')
            && !str_contains($output, 'Exit code      36') && !is_file($bootManifest) && !is_link($runningLink)
            && !is_file("$runtime/FolderViewPlus.page")
            && file_get_contents("$runtime/pre-existing") === 'keep' && !is_file("$runtime/build-metadata.json")
            && !is_dir($journal) && !is_file("$packages/$pluginName-$candidate")
            && file_get_contents("$config/docker.json") === '{"previous":"Docker"}',
            "$case changed the pre-existing runtime or entered package extraction: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-rollback-retry-success') {
        [$failedStatus, $failedOutput] = $run($command, [
            'FVPLUS_FIXTURE_FAIL_VERSION_COMMIT' => '1', 'FVPLUS_FIXTURE_FAIL_PRIOR_PACKAGE' => '1'
        ]);
        verifyInstallFixture($failedStatus !== 0 && str_contains($failedOutput, 'Transient previous-package failure')
            && is_file("$journal/activated") && is_file("$journal/rollback") && is_file($recoveryWrapper)
            && file_get_contents("$journal/previous-manifest") === $oldManifest
            && file_get_contents("$journal/saved-version") === "$previous\n"
            && file_get_contents($bootManifest) === $oldManifest && trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$candidate.txz",
            "$case lost recovery after the transient rollback failure: $failedOutput");
        [$retryStatus, $retryOutput] = $run($command);
        clearstatcache();
        verifyInstallFixture($retryStatus === 0 && file_get_contents($bootManifest) === $newManifest
            && trim(file_get_contents("$config/version")) === $candidate && !is_dir($journal) && !is_file($recoveryWrapper),
            "$case did not finish the retry with an aligned registration: $retryOutput");
        $packageHistory = file("$dir/package-history", FILE_IGNORE_NEW_LINES);
        verifyInstallFixture($packageHistory === ["$pluginName-$candidate.txz", "$pluginName-$previous.txz", "$pluginName-$candidate.txz"],
            "$case did not restore the previous package before reapplying the update: " . json_encode($packageHistory));
        verifyInstallFixture(file_get_contents("$dir/recovered-cron") === $priorCron && trim(file_get_contents("$dir/recovered-cron-mode")) === '600',
            "$case did not restore the previous scheduler before reapplying the update.");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-rollback-before-boot-success') {
        [$failedStatus, $failedOutput] = $run($command, [
            'FVPLUS_FIXTURE_FAIL_MANIFEST_COMMIT' => '1', 'FVPLUS_FIXTURE_FAIL_PRIOR_PACKAGE' => '1'
        ]);
        verifyInstallFixture($failedStatus !== 0 && str_contains($failedOutput, 'Transient previous-package failure')
            && is_file("$journal/committed") && is_file("$journal/rollback") && is_file($recoveryWrapper)
            && trim(file_get_contents("$config/version")) === $candidate && file_get_contents($bootManifest) === $oldManifest,
            "$case did not leave a durable rollback after marking the candidate committed: $failedOutput");

        file_put_contents("$dir/boot-id", "synthetic boot two\n");
        unlink($runningLink);
        unlink("$dir/registration");
        unlink($registrationHook);
        unlink("$dir/core-installed");
        unlink("$runtime/FolderViewPlus.page");
        unlink("$runtime/build-metadata.json");
        unlink("$packages/$pluginName-$candidate");
        rename($runtime, "$dir/runtime-before-reboot");
        foreach ([$recoveryWrapper, $bootManifest] as $bootFile) {
            [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $bootFile]);
            verifyInstallFixture($bootStatus === 0, "$case could not boot from " . basename($bootFile) . ": $bootOutput");
        }
        clearstatcache();
        verifyInstallFixture(file_get_contents($bootManifest) === $oldManifest && readlink($runningLink) === $bootManifest
            && trim(file_get_contents("$config/version")) === $previous && !is_dir($journal)
            && trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$previous.txz",
            "$case boot favored the explicitly failed candidate over rollback.");
        $check[] = $case;
        continue;
    }
    if ($case === 'install-local-journal-interrupted-success') {
        [$interruptedStatus, $interruptedOutput] = $run($command, ['FVPLUS_FIXTURE_INTERRUPT' => '1']);
        verifyInstallFixture($interruptedStatus !== 0 && is_file("$journal/core-started") && !is_file("$journal/activated")
            && file_get_contents("$journal/manifest") === file_get_contents("$dir/manual/$pluginName.plg")
            && trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$candidate.txz",
            "$case did not journal the external local manifest before activation: $interruptedOutput");
        [$removeStatus, $removeOutput] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"]);
        clearstatcache();
        verifyInstallFixture($removeStatus === 0 && !is_file($bootManifest) && !is_link($runningLink)
            && !is_file($recoveryWrapper) && !is_dir($config) && !is_file($cronFile) && !is_file("$dir/core-installed")
            && file_get_contents("$dir/manual/$pluginName.plg") === $newManifest,
            "$case could not recover and remove the previous installation: $removeOutput");
        $check[] = $case;
        continue;
    }
    if (in_array($case, ['install-remove-archive-obstructed-success', 'install-remove-native-handoff-success',
        'install-remove-boot-finalize-success', 'install-remove-prepared-before-reboot-success'], true)) {
        $remove = [PHP_BINARY, $cli, 'remove', "$pluginName.plg"];
        $removedManifest = "$boot-removed/$pluginName.plg";
        $removalMarker = "$boot/.$pluginName-removal";
        $earlyObstacle = $case === 'install-remove-archive-obstructed-success';
        $interruptedPackage = $case === 'install-remove-prepared-before-reboot-success';
        $canFinalizeOnBoot = $case === 'install-remove-boot-finalize-success';
        if ($earlyObstacle) mkdir($removedManifest, 0700, true);
        $options = $interruptedPackage ? ['FVPLUS_FIXTURE_INTERRUPT_REMOVAL' => '1']
            : ($earlyObstacle ? [] : ['FVPLUS_FIXTURE_FAIL_NATIVE_REMOVE_MOVE' => '1']);
        [$removeStatus, $removeOutput] = $run($remove, $options);
        clearstatcache();
        verifyInstallFixture(file_get_contents($bootManifest) === $oldManifest && readlink($runningLink) === $bootManifest,
            "$case lost the original boot manifest or native retry entry: $removeOutput");
        if ($earlyObstacle) {
            verifyInstallFixture($removeStatus !== 0 && str_contains($removeOutput, 'cannot archive its boot manifest')
                && !str_contains($removeOutput, "$pluginName.plg removed") && !is_file($removalMarker)
                && file_get_contents("$config/docker.json") === '{"previous":"Docker"}' && is_file("$runtime/FolderViewPlus.page")
                && is_file("$packages/$pluginName-$previous") && file_get_contents($cronFile) === $priorCron,
                "$case allowed destructive work before checking the native destination: $removeOutput");
        } elseif ($interruptedPackage) {
            verifyInstallFixture($removeStatus !== 0 && file_get_contents("$config/docker.json") === '{"previous":"Docker"}'
                && is_file("$runtime/FolderViewPlus.page") && is_file("$packages/$pluginName-$previous")
                && trim(file_get_contents($removalMarker)) === "$previous " . hash('sha256', $oldManifest) . ' cleanup',
                "$case could not recover interruption before package removal: $removeOutput");
            rename($runtime, "$dir/runtime-before-reboot");
            unlink("$packages/$pluginName-$previous");
        } else {
            verifyInstallFixture(str_contains($removeOutput, 'Removal is pending') && !is_dir($config)
                && !is_dir($runtime) && !is_file($cronFile)
                && trim(file_get_contents($removalMarker)) === "$previous " . hash('sha256', $oldManifest) . ' ready',
                "$case did not durably retain failed native registration: $removeOutput");
            [$pendingStatus, $pendingOutput] = $run($activateHook);
            verifyInstallFixture($pendingStatus !== 0 && str_contains($pendingOutput, 'has an unfinished removal')
                && !is_dir($runtime) && !is_dir($config) && !is_file($cronFile),
                "$case allowed activation of the removed manifest: $pendingOutput");
        }
        if ($canFinalizeOnBoot) rmdir($removedManifest);
        if (!$earlyObstacle) {
            unlink($runningLink);
            unlink($removalHook);
            file_put_contents("$dir/boot-id", "synthetic boot two\n");
            [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $removalWrapper]);
            verifyInstallFixture($bootStatus === 0 && !is_link("$dir/running/" . basename($removalWrapper)),
                "$case could not reconcile removal on cold boot: $bootOutput");
            if ($canFinalizeOnBoot) {
                verifyInstallFixture(!is_file($bootManifest) && !is_link($runningLink) && !is_file($removalMarker) && !is_file($removalHelper)
                    && file_get_contents($removedManifest) === $oldManifest && !is_dir($runtime) && !is_file($cronFile),
                    "$case did not finish archive registration on cold boot: $bootOutput");
                $check[] = $case;
                continue;
            }
            verifyInstallFixture(readlink($runningLink) === $bootManifest && is_file($removalMarker),
                "$case did not recreate the native retry entry after reboot: $bootOutput");
            [$activationStatus, $activationOutput] = $run([PHP_BINARY, $cli, 'install', $bootManifest]);
            verifyInstallFixture($activationStatus !== 0 && is_file($bootManifest) && !is_dir($runtime) && !is_file($cronFile),
                "$case allowed the old manifest to reactivate on cold boot: $activationOutput");
        }
        if (is_dir($removedManifest)) rmdir($removedManifest);
        [$retryStatus, $retryOutput] = $run($remove);
        clearstatcache();
        verifyInstallFixture($retryStatus === 0 && !is_file($bootManifest) && !is_link($runningLink)
            && file_get_contents($removedManifest) === $oldManifest && !is_file($removalMarker) && !is_file($removalHook)
            && !is_file($removalHelper) && !is_file($removalWrapper)
            && !is_dir($config) && !is_dir($runtime) && !is_file($cronFile),
            "$case left registration or removal state behind after retry: $retryOutput");
        $check[] = $case;
        continue;
    }
    if ($case === 'install-remove-archived-reinstall-success') {
        $remove = [PHP_BINARY, $cli, 'remove', "$pluginName.plg"];
        $removedManifest = "$boot-removed/$pluginName.plg";
        $removalMarker = "$boot/.$pluginName-removal";
        [$removeStatus, $removeOutput] = $run($remove, ['FVPLUS_FIXTURE_INTERRUPT' => '1']);
        verifyInstallFixture($removeStatus !== 0 && !is_file($bootManifest) && !is_link($runningLink)
            && file_get_contents($removedManifest) === $oldManifest && is_file($removalHook)
            && trim(file_get_contents($removalMarker)) === "$previous " . hash('sha256', $oldManifest) . ' ready',
            "$case did not leave a completed native move awaiting its callback: $removeOutput");
        verifyInstallFixture(mkdir($config, 0700), "$case could not restore synthetic archive downloads.");
        file_put_contents("$config/$pluginName-$previous.txz", "core $previous");
        copy($iconArchives[$previousIcon], "$config/$pluginName-icons-$previousIcon.txz");
        file_put_contents("$dir/manual/$pluginName.plg", $oldManifest);
        [$installStatus, $installOutput] = $run($command);
        verifyInstallFixture($installStatus === 0 && file_get_contents($bootManifest) === $oldManifest
            && readlink($runningLink) === $bootManifest && is_file("$runtime/FolderViewPlus.page")
            && !is_file($removalMarker) && !is_file($removalHook) && !is_file($removalHelper) && !is_file($removalWrapper),
            "$case left an old removal callback able to affect the identical reinstall: $installOutput");
        $check[] = $case;
        continue;
    }
    if (in_array($case, ['install-remove-scheduler-retry-success', 'install-remove-stale-cleanup-retry-success'], true)) {
        // Exercise the current uninstall hook even when the rest of the matrix uses a historical manifest.
        $oldManifest = $manifest($previous, $previousIcon);
        file_put_contents($bootManifest, $oldManifest);
        $schedulerError = $case === 'install-remove-scheduler-retry-success';
        $failure = $schedulerError ? 'FVPLUS_FIXTURE_FAIL_REMOVE_SCHEDULER' : 'FVPLUS_FIXTURE_FAIL_REMOVE_CONFIG';
        $remove = [PHP_BINARY, $cli, 'remove', "$pluginName.plg"];
        [$removeStatus, $removeOutput] = $run($remove, [$failure => '1']);
        $removalMarker = "$boot/.folderview.plus-removal";
        verifyInstallFixture($removeStatus !== 0 && !str_contains($removeOutput, "$pluginName.plg removed")
            && str_starts_with(trim(file_get_contents($removalMarker)), $previous) && file_get_contents($bootManifest) === $oldManifest
            && readlink($runningLink) === $bootManifest && file_get_contents("$config/docker.json") === '{"previous":"Docker"}'
            && is_file("$packages/$pluginName-$previous") === $schedulerError,
            "$case falsely succeeded or lost retry state: $removeOutput");
        verifyInstallFixture($schedulerError ? file_get_contents($cronFile) === $priorCron && (fileperms($cronFile) & 0777) === 0600 : !is_file($cronFile),
            "$case did not preserve the scheduler on its failed removal path.");
        [$retryStatus, $retryOutput] = $run($remove);
        clearstatcache();
        verifyInstallFixture($retryStatus === 0 && !is_file($bootManifest) && !is_link($runningLink)
            && !is_dir($config) && !is_dir($runtime) && !is_file($cronFile) && !is_file($removalMarker)
            && ($schedulerError || is_file("$packages/$pluginName-2025.12.31.01")),
            "$case could not finish removal without touching stale package records: $retryOutput");
        $check[] = $case;
        continue;
    }
    if (in_array($case, ['install-native-remove-failure', 'install-native-remove-partial-failure',
        'install-native-remove-same-boot-partial-failure', 'install-remove-nextboot-staged-success',
        'install-native-remove-nextboot-staged-failure', 'install-remove-nextboot-staged-interrupted-prepared-success',
        'install-native-remove-nextboot-staged-partial-failure'], true)) {
        $removalMarker = "$boot/.$pluginName-removal";
        $staged = str_contains($case, '-nextboot-staged-');
        $prepared = $case === 'install-remove-nextboot-staged-interrupted-prepared-success';
        $partial = str_ends_with($case, '-partial-failure');
        $promoteNextboot = static function () use ($boot, $nextboot): void {
            // Pinned Unraid 7.4 promotes manifests and merges downloaded package folders before boot activation.
            foreach (glob("$nextboot/*") as $entry) {
                $dest = "$boot/" . basename($entry);
                if (is_dir($entry)) {
                    verifyInstallFixture(is_dir($dest) || mkdir($dest), 'Could not create a synthetic boot package directory.');
                    foreach (glob("$entry/*") as $file) {
                        verifyInstallFixture(copy($file, "$dest/" . basename($file)) && unlink($file), 'Could not merge synthetic boot packages.');
                    }
                    rmdir($entry);
                } elseif (str_ends_with($entry, '.plg')) {
                    verifyInstallFixture(rename($entry, $dest), 'Could not promote a synthetic boot manifest.');
                }
            }
            if (is_dir($nextboot)) rmdir($nextboot);
        };
        $coldBoot = static function (string $id) use ($dir, $runningLink, $cronFile, $removalHook, $packages, $pluginName, $runtime): void {
            foreach ([$runningLink, $cronFile, $removalHook, "$dir/core-installed", ...glob("$packages/$pluginName-*")] as $volatile) {
                if (is_file($volatile) || is_link($volatile)) unlink($volatile);
            }
            if (is_dir($runtime)) rename($runtime, "$dir/runtime-before-" . $id);
            file_put_contents("$dir/boot-id", "synthetic $id\n");
        };
        if ($staged) {
            mkdir("$nextboot/$pluginName", 0700, true);
            copy("$config/$pluginName-$candidate.txz", "$nextboot/$pluginName/$pluginName-$candidate.txz");
            copy($iconArchives['2.0.0'], "$nextboot/$pluginName/$pluginName-icons-2.0.0.txz");
            file_put_contents("$nextboot/unrelated.plg", 'unrelated staged manifest');
            mkdir("$nextboot/unrelated");
            file_put_contents("$nextboot/unrelated/archive.txz", 'unrelated staged archive');
            [$stageStatus, $stageOutput] = $run([PHP_BINARY, $cli, 'download', "$pluginName.plg"]);
            verifyInstallFixture($stageStatus === 0 && file_get_contents("$nextboot/$pluginName.plg") === $newManifest,
                "$case did not stage the candidate through Unraid's native download: $stageOutput");
        }
        [$status, $output] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"]);
        clearstatcache();
        if ($staged) {
            verifyInstallFixture(file_get_contents("$nextboot/unrelated.plg") === 'unrelated staged manifest'
                && file_get_contents("$nextboot/unrelated/archive.txz") === 'unrelated staged archive',
                "$case modified another plugin's staging files.");
        }
        if ($case === 'install-remove-nextboot-staged-success') {
            verifyInstallFixture($status === 0 && !is_file("$nextboot/$pluginName.plg") && !is_dir("$nextboot/$pluginName")
                && !is_file("$removalMarker.nextboot") && !is_file($bootManifest) && !is_link($runningLink),
                "$case left a staged reinstall after successful removal: $output");
            $promoteNextboot();
            verifyInstallFixture(!is_file($bootManifest) && !is_dir($config) && !is_dir($runtime) && !is_file($cronFile),
                "$case made the removed plugin bootable again.");
            $check[] = $case;
            continue;
        }
        if ($prepared) {
            verifyInstallFixture($status !== 0 && file_get_contents($bootManifest) === $oldManifest
                && is_file("$runtime/FolderViewPlus.page") && is_file("$packages/$pluginName-$previous")
                && trim(file_get_contents($removalMarker)) === "$previous " . hash('sha256', $oldManifest) . ' prepared'
                && file_get_contents("$removalMarker.nextboot") === $newManifest && !is_file("$nextboot/$pluginName.plg"),
                "$case did not interrupt the removal between staging and package cleanup: $output");
            $coldBoot('prepared-rollback');
            $promoteNextboot();
            [$recoveryStatus, $recoveryOutput] = $run([PHP_BINARY, $cli, 'install', $removalWrapper]);
            clearstatcache();
            verifyInstallFixture($recoveryStatus === 0 && !is_file($removalMarker) && !is_file("$removalMarker.nextboot")
                && file_get_contents("$nextboot/$pluginName.plg") === $newManifest && !is_link($runningLink),
                "$case did not restore the interrupted stage before boot activation: $recoveryOutput");
            [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $bootManifest]);
            verifyInstallFixture($bootStatus === 0 && is_file($cronFile) && is_file("$runtime/FolderViewPlus.page")
                && file_get_contents($bootManifest) === $oldManifest && trim(file_get_contents("$config/version")) === $previous,
                "$case did not boot the intact original install: $bootOutput");
            $coldBoot('restored-update');
            $promoteNextboot();
            [$nextStatus, $nextOutput] = $run([PHP_BINARY, $cli, 'install', $bootManifest]);
            verifyInstallFixture($nextStatus === 0 && file_get_contents($bootManifest) === $newManifest
                && trim(file_get_contents("$config/version")) === $candidate && !is_file($removalWrapper)
                && file_get_contents("$config/docker.json") === '{"previous":"Docker"}'
                && file_get_contents("$config/vm.json") === '{"previous":"VM"}',
                "$case did not apply the restored next-boot update with the original configuration: $nextOutput");
            $check[] = $case;
            continue;
        }
        verifyInstallFixture($status !== 0 && str_contains($output, 'Native removal fixture failed') && !str_contains($output, "$pluginName.plg removed"),
            "$case treated native removal failure as success: $output");
        verifyInstallFixture(file_get_contents($bootManifest) === $oldManifest && readlink($runningLink) === $bootManifest
            && file_get_contents("$config/docker.json") === '{"previous":"Docker"}' && is_file("$config/vm.json")
            && is_file("$packages/$pluginName-$previous") && is_file("$runtime/FolderViewPlus.page")
            && is_link("$runtime/images/third-party-icons") && file_get_contents($cronFile) === $priorCron,
            "$case damaged the active installation, registration, schedule, or configuration.");
        if ($partial) {
            verifyInstallFixture(!is_file("$runtime/scripts/install_icon_asset_pack.sh") && is_file($removalMarker) && is_file($removalWrapper),
                "$case retired cleanup state after partial native package removal: $output");
            if ($staged) {
                verifyInstallFixture(file_get_contents("$removalMarker.nextboot") === $newManifest && !is_file("$nextboot/$pluginName.plg"),
                    "$case restored a staged update while partial removal was pending.");
            }
        } else {
            verifyInstallFixture(!is_file($removalMarker) && !is_file($removalHook) && !is_file($removalWrapper) && !is_file($removalHelper),
                "$case left recovery armed after a rejection that changed no package files: $output");
        }
        if ($staged && !$partial) {
            verifyInstallFixture(file_get_contents("$nextboot/$pluginName.plg") === $newManifest && !is_file("$removalMarker.nextboot")
                && is_file("$nextboot/$pluginName/$pluginName-$candidate.txz"), "$case lost the staged update on a clean rollback.");
            $check[] = $case;
            continue;
        }
        if ($case === 'install-native-remove-same-boot-partial-failure') {
            $olderPackage = "$packages/$pluginName-2025.12.31.01";
            $installedMetadata = "$runtime/build-metadata.json";
            verifyInstallFixture(!file_exists($installedMetadata) && is_file("$runtime/FolderViewPlus.page")
                && trim(file_get_contents($removalMarker)) === "$previous " . hash('sha256', $oldManifest) . ' cleanup',
                "$case did not leave the ownership evidence of a partial removal.");
            file_put_contents($olderPackage, 'unrelated historical record');
            $remove = [PHP_BINARY, $cli, 'remove', "$pluginName.plg"];
            $retry = ['FVPLUS_FIXTURE_ALLOW_REMOVE_RETRY' => '1'];

            file_put_contents($bootManifest, $oldManifest . "\n<!-- changed manifest bytes -->\n");
            [$forgedStatus, $forgedOutput] = $run($remove, $retry);
            verifyInstallFixture($forgedStatus !== 0 && str_contains($forgedOutput, 'removal journal does not match')
                && is_file($removalMarker) && is_file("$config/docker.json"),
                "$case allowed a retired journal to authorize another manifest: $forgedOutput");
            file_put_contents($bootManifest, $oldManifest);
            file_put_contents($installedMetadata, "{\n  \"packageVersion\": \"$candidate\"\n}\n");
            [$conflictStatus, $conflictOutput] = $run($remove, $retry);
            verifyInstallFixture($conflictStatus !== 0 && str_contains($conflictOutput, 'active FolderView Plus package does not match')
                && is_file($removalMarker) && is_file("$config/docker.json"),
                "$case ignored a conflicting deployed version: $conflictOutput");
            unlink($installedMetadata);

            [$retryStatus, $retryOutput] = $run($remove, $retry);
            verifyInstallFixture($retryStatus === 0 && !is_file($bootManifest) && !is_link($runningLink)
                && file_get_contents("$boot-removed/$pluginName.plg") === $oldManifest && !is_file($removalMarker)
                && !is_dir($config) && !is_dir($runtime) && !is_file($cronFile)
                && file_get_contents($olderPackage) === 'unrelated historical record',
                "$case could not finish partial native removal in the same boot: $retryOutput");
            $check[] = $case;
            continue;
        }
        $coldBoot('rejected-removal');
        if ($staged) $promoteNextboot();
        if (is_file($removalWrapper)) {
            [$recoveryStatus, $recoveryOutput] = $run([PHP_BINARY, $cli, 'install', $removalWrapper]);
            verifyInstallFixture($recoveryStatus === 0 && readlink($runningLink) === $bootManifest,
                "$case did not restore the pending removal retry entry: $recoveryOutput");
        }
        [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $bootManifest]);
        clearstatcache();
        if ($partial) {
            verifyInstallFixture($bootStatus !== 0 && !is_dir($runtime) && is_file($removalMarker),
                "$case booted an explicitly pending removal: $bootOutput");
            [$retryStatus, $retryOutput] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"], ['FVPLUS_FIXTURE_ALLOW_REMOVE_RETRY' => '1']);
            clearstatcache();
            verifyInstallFixture($retryStatus === 0 && !is_file($bootManifest) && !is_file($removalMarker) && !is_dir($config)
                && !is_file("$removalMarker.nextboot") && !is_file("$nextboot/$pluginName.plg"),
                "$case could not finish partial native removal after reboot: $retryOutput");
        } else {
            verifyInstallFixture($bootStatus === 0 && file_get_contents($bootManifest) === $oldManifest
                && readlink($runningLink) === $bootManifest && is_file("$runtime/FolderViewPlus.page") && is_file($cronFile)
                && trim(file_get_contents("$config/version")) === $previous
                && file_get_contents("$config/docker.json") === '{"previous":"Docker"}'
                && file_get_contents("$config/vm.json") === '{"previous":"VM"}',
                "$case did not boot the preserved installation after explicit native rejection: $bootOutput");
        }
        $check[] = $case;
        continue;
    }
    if ($case === 'install-remove-stale-registration-success') {
        $activeManifest = $manifest($previous, $previousIcon);
        file_put_contents($bootManifest, $activeManifest);
        mkdir("$dir/registration", 0700);
        file_put_contents("$dir/registration/manifest", $activeManifest);
        symlink("$runtime/scripts/complete_native_registration.sh", $registrationHook);
        $owner = getmypid();
        $ownerFields = explode(' ', preg_replace('/^[0-9]+ \(.*\) /', '', file_get_contents("/proc/$owner/stat")));
        $startTime = (int)$ownerFields[19];
        $remove = [PHP_BINARY, $cli, 'remove', "$pluginName.plg"];
        file_put_contents("$dir/registration/owner", "$owner $startTime update $previous\n");
        [$busyStatus, $busyOutput] = $run($remove);
        verifyInstallFixture($busyStatus !== 0 && str_contains($busyOutput, 'installation or removal is in progress')
            && readlink($runningLink) === $bootManifest && is_link($registrationHook) && is_dir($config),
            "$case took registration away from the live owner: $busyOutput");

        // The recorded PID now belongs to another lifetime. An interrupted owner
        // may not have written its completion report.
        file_put_contents("$dir/registration/owner", "$owner " . ($startTime + 1) . " update $previous\n");
        [$status, $output] = $run($remove);
        clearstatcache();
        verifyInstallFixture($status === 0 && !is_link($runningLink) && !is_file($bootManifest)
            && !is_dir($runtime) && !is_dir($config) && !is_link($registrationHook) && !is_dir("$dir/registration"),
            "$case did not complete removal after recovering abandoned registration: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'install-remove-reinstall-stale-success') {
        [$status, $output] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"]);
        verifyInstallFixture($status === 0 && !is_file($bootManifest) && !is_link($runningLink) && !is_dir($runtime)
            && !is_dir($config) && !is_file("$packages/$pluginName-$previous")
            && is_file("$packages/$pluginName-2025.12.31.01") && is_file("$packages/$pluginName-2026.01.01.03"),
            "$case did not remove the registered installation independently of stale records: $output");
        mkdir($config);
        file_put_contents("$config/$pluginName-$candidate.txz", "core $candidate");
        copy($iconArchives['2.0.0'], "$config/$pluginName-icons-2.0.0.txz");
        [$status, $output] = $run($command);
        verifyInstallFixture($status === 0 && file_get_contents($bootManifest) === $newManifest && readlink($runningLink) === $bootManifest
            && trim(file_get_contents("$config/version")) === $candidate && is_file("$packages/$pluginName-$candidate"),
            "$case treated leftover package logs as an active installation: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'install-boot-contention-success') {
        unlink($runningLink);
        unlink("$packages/$pluginName-$previous");
        unlink("$dir/core-installed");
        unlink("$runtime/FolderViewPlus.page");
        unlink("$runtime/build-metadata.json");
        rename($runtime, "$dir/runtime-before-reboot");
        $lock = fopen("$dir/install.lock", 'a+');
        verifyInstallFixture(is_resource($lock) && flock($lock, LOCK_EX | LOCK_NB), "$case could not reserve the test lock.");
        $bootTask = $start([PHP_BINARY, $cli, 'install', $bootManifest]);
        for ($attempt = 0; $attempt < 160 && !is_file("$dir/boot-lock-waiting"); $attempt++) usleep(50000);
        $waited = is_file("$dir/boot-lock-waiting") && proc_get_status($bootTask[0])['running'] && is_file($bootManifest);
        flock($lock, LOCK_UN);
        fclose($lock);
        [$status, $output] = $finish($bootTask);
        verifyInstallFixture($waited && $status === 0, "$case could not resume boot after the lock was released: $output");
        verifyInstallFixture(file_get_contents($bootManifest) === $oldManifest && readlink($runningLink) === $bootManifest
            && !is_file("$boot-error/$pluginName.plg") && is_file("$packages/$pluginName-$previous")
            && str_contains(readlink("$runtime/images/third-party-icons"), '/icons-1.0.0/'),
            "$case failed to retain and activate the registered boot installation.");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-staged-peer-success') {
        $peerVersion = '2026.01.01.00';
        $stagedVersion = '2026.01.01.03';
        file_put_contents("$config/$pluginName-$peerVersion.txz", "core $peerVersion");
        file_put_contents("$config/$pluginName-$stagedVersion.txz", "core $stagedVersion");
        [$firstStatus, $firstOutput] = $run($command);
        clearstatcache();
        verifyInstallFixture($firstStatus === 0 && file_get_contents($bootManifest) === $newManifest
            && is_file("$config/$pluginName-$peerVersion.txz") && is_file("$config/$pluginName-$stagedVersion.txz")
            && is_file("$config/$pluginName-icons-3.0.0.txz") && !is_file("$config/$pluginName-2025.01.01.01.txz")
            && !is_file("$config/$pluginName-icons-0.9.0.txz"),
            "$case pruned a staged or peer archive, or kept an obsolete archive: $firstOutput");
        $stagedManifest = $manifest($stagedVersion, '3.0.0');
        file_put_contents("$dir/manual/$pluginName.plg", $stagedManifest);
        [$secondStatus, $secondOutput] = $run([PHP_BINARY, $cli, 'install', "$dir/manual/$pluginName.plg", 'forced']);
        verifyInstallFixture($secondStatus === 0 && file_get_contents($bootManifest) === $stagedManifest
            && is_file("$packages/$pluginName-$stagedVersion") && str_contains(readlink("$runtime/images/third-party-icons"), '/icons-3.0.0/'),
            "$case could not install the staged downloads offline: $secondOutput");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-registration-version') {
        [$firstStatus, $firstOutput] = $run($activateHook, ['FVPLUS_FIXTURE_ALLOW_VERSION_COMMIT' => '1']);
        verifyInstallFixture($firstStatus === 0 && file_get_contents($bootManifest) === $oldManifest, "$case could not simulate pending manifest registration: $firstOutput");
        [$status, $output] = $run($command, ['FVPLUS_FIXTURE_ALLOW_VERSION_COMMIT' => '1']);
        verifyInstallFixture($status !== 0 && str_contains($output, 'does not match the registered manifest'), "$case accepted a stale rollback baseline: $output");
        [$removeStatus, $removeOutput] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"]);
        verifyInstallFixture($removeStatus !== 0 && str_contains($removeOutput, 'does not match the registered manifest'), "$case allowed removal before registration: $removeOutput");
        verifyInstallFixture(trim(file_get_contents("$config/version")) === $candidate && is_file("$packages/$pluginName-$candidate")
            && file_get_contents($bootManifest) === $oldManifest && str_contains(readlink("$runtime/images/third-party-icons"), '/icons-2.0.0/'),
            "$case changed the activated package during pending registration.");
        verifyInstallFixture(glob("$dir/folderview.plus-install.*") === [], "$case left installation report state behind.");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-older-staged-manifest') {
        $olderManifest = $manifest('2025.01.01.01', '1.0.0');
        file_put_contents("$dir/downloads/$pluginName.plg", $olderManifest);
        [$status, $output] = $run($command);
        verifyInstallFixture($status !== 0 && str_contains($output, 'older staged manifest')
            && file_get_contents($bootManifest) === $oldManifest && readlink($runningLink) === $bootManifest
            && trim(file_get_contents("$config/version")) === $previous && is_file("$packages/$pluginName-$previous")
            && file_get_contents("$dir/downloads/$pluginName.plg") === $olderManifest,
            "$case replaced the active registration or its staged input: $output");
        $check[] = $case;
        continue;
    }
    if ($channelDowngrade) {
        $downgradeVersion = '2026.01.01.01';
        $mainManifest = str_replace('https://raw.githubusercontent.com/&github;/dev/', 'https://raw.githubusercontent.com/&github;/main/', $manifest($downgradeVersion, '1.0.0'));
        file_put_contents("$dir/remote.plg", $mainManifest);
        file_put_contents("$config/$pluginName-$downgradeVersion.txz", "core $downgradeVersion");
        [$status, $output] = $run([PHP_BINARY, $cli, 'install', 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg', 'forced']);
        verifyInstallFixture($status === 0 && str_contains($output, 'Downgrade complete')
            && file_get_contents($bootManifest) === $mainManifest && readlink($runningLink) === $bootManifest
            && trim(file_get_contents("$config/version")) === $downgradeVersion && is_file("$packages/$pluginName-$downgradeVersion")
            && !is_dir("$dir/registration") && !is_link($registrationHook), "$case failed a deliberate stable-channel install: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-legacy-registration-interrupted-success') {
        [$firstStatus, $firstOutput] = $run($activateHook);
        verifyInstallFixture($firstStatus === 0 && file_get_contents($bootManifest) === $oldManifest,
            "$case could not set up the partially registered legacy state: $firstOutput");
        mkdir("$dir/registration", 0700);
        file_put_contents("$runtime/scripts/complete_native_registration.sh", "#!/bin/bash\nexit 42\n");
        [$status, $output] = $run($command);
        verifyInstallFixture($status === 0 && file_get_contents($bootManifest) === $newManifest
            && trim(file_get_contents("$config/version")) === $candidate
            && !is_dir("$dir/registration") && !is_link("$dir/registration") && !is_dir($journal) && !is_file($recoveryWrapper),
            "$case could not recover an incomplete legacy directory with an older helper: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-journal-interrupted-success') {
        [$interruptedStatus, $interruptedOutput] = $run($command, ['FVPLUS_FIXTURE_INTERRUPT' => '1']);
        verifyInstallFixture($interruptedStatus !== 0 && trim(file_get_contents("$config/version")) === $candidate
            && file_get_contents($bootManifest) === $oldManifest && file_get_contents("$journal/manifest") === $newManifest
            && is_file("$journal/activated") && !is_file("$journal/committed") && is_file($recoveryWrapper),
            "$case did not interrupt an activated package before flash registration: $interruptedOutput");
        $remove = [PHP_BINARY, $cli, 'remove', "$pluginName.plg"];
        [$firstStatus, $firstOutput] = $run($remove);
        verifyInstallFixture($firstStatus !== 0 && file_get_contents($bootManifest) === $newManifest
            && readlink($runningLink) === $bootManifest && !is_dir($journal),
            "$case did not repair the manifest during the original removal attempt: $firstOutput");
        [$status, $output] = $run($remove);
        clearstatcache();
        verifyInstallFixture($status === 0 && !is_file($bootManifest) && !is_link($runningLink)
            && !is_dir($runtime) && !is_dir($config) && !is_file($recoveryWrapper),
            "$case could not remove the recovered installation: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'update-early-activation-interrupted-success') {
        [$interruptedStatus, $interruptedOutput] = $run($command, ['FVPLUS_FIXTURE_INTERRUPT' => '1']);
        verifyInstallFixture($interruptedStatus !== 0 && trim(file_get_contents("$config/version")) === $previous
            && file_get_contents($bootManifest) === $oldManifest && str_contains(file_get_contents("$runtime/build-metadata.json"), $candidate)
            && str_contains(file_get_contents($cronFile), 'scheduled_backup.php') && is_file("$journal/core-started") && !is_file("$journal/activated"),
            "$case did not interrupt activation after package and scheduler replacement: $interruptedOutput");
        [$status, $output] = $run($command);
        verifyInstallFixture($status === 0 && file_get_contents("$bootManifest") === $newManifest
            && trim(file_get_contents("$config/version")) === $candidate && !is_dir($journal)
            && file("$dir/package-history", FILE_IGNORE_NEW_LINES) === [
                "$pluginName-$candidate.txz", "$pluginName-$previous.txz", "$pluginName-$candidate.txz"
            ] && file_get_contents("$dir/recovered-cron") === $priorCron && trim(file_get_contents("$dir/recovered-cron-mode")) === '600',
            "$case did not reinstall the verified previous package and restore the scheduler before retry: $output");
        $check[] = $case;
        continue;
    }
    if ($case === 'install-fresh-journal-interrupted-success') {
        $command = [PHP_BINARY, $cli, 'install', "$dir/downloads/$pluginName.plg"];
        [$interruptedStatus, $interruptedOutput] = $run($command, ['FVPLUS_FIXTURE_INTERRUPT' => '1']);
        verifyInstallFixture($interruptedStatus !== 0 && !is_file($bootManifest) && is_file("$journal/committed") && is_file($recoveryWrapper),
            "$case did not interrupt first-time registration before the primary manifest existed: $interruptedOutput");
        unlink("$dir/registration");
        unlink($registrationHook);
        unlink("$dir/downloads/$pluginName.plg");
        unlink("$dir/core-installed");
        unlink("$runtime/FolderViewPlus.page");
        unlink("$runtime/build-metadata.json");
        unlink("$packages/$pluginName-$candidate");
        rename($runtime, "$dir/runtime-before-reboot");
        file_put_contents("$dir/boot-id", "synthetic boot two\n");
        verifyInstallFixture(glob("$boot/*.plg") === [$recoveryWrapper], "$case incorrectly enumerated a primary startup manifest.");
        [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $recoveryWrapper]);
        verifyInstallFixture($bootStatus === 0 && file_get_contents($bootManifest) === $newManifest && readlink($runningLink) === $bootManifest
            && trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$candidate.txz"
            && !is_dir($journal) && !is_link("$dir/running/" . basename($recoveryWrapper)),
            "$case could not bootstrap the verified first installation offline: $bootOutput");
        $check[] = $case;
        continue;
    }
    if (in_array($case, ['update-late-check-success', 'update-late-check-interrupted-boot-success'], true)) {
        $interrupted = $case === 'update-late-check-interrupted-boot-success';
        $stagedVersion = '2026.01.01.03';
        $peerManifest = $manifest($stagedVersion, '3.0.0');
        file_put_contents("$dir/remote.plg", $peerManifest);
        $first = $start($command, $interrupted ? ['FVPLUS_FIXTURE_INTERRUPT' => '1'] : []);
        for ($attempt = 0; $attempt < 160 && !is_file("$dir/registration-commit-paused"); $attempt++) usleep(50000);
        verifyInstallFixture(is_file("$dir/registration-commit-paused") && is_link($registrationHook), "$case did not arm the post-hook at registration.");
        [$checkStatus, $checkOutput] = $run([PHP_BINARY, $cli, 'check', "$pluginName.plg"]);
        verifyInstallFixture($checkStatus === 0 && str_contains($checkOutput, $stagedVersion)
            && file_get_contents("$dir/downloads/$pluginName.plg") === $peerManifest && is_link($registrationHook)
            && file_get_contents($bootManifest) === $oldManifest, "$case let the unrelated check consume the handoff: $checkOutput");
        touch("$dir/allow-registration-commit");
        [$status, $output] = $finish($first);
        if ($interrupted) {
            verifyInstallFixture($status === 137 && file_get_contents($bootManifest) === $peerManifest
                && !file_exists("$config/$pluginName-$stagedVersion.txz") && is_file("$journal/committed"),
                "$case did not stop between the native copy and its post-hook: $output");
            unlink($runningLink);
            unlink("$dir/registration");
            unlink($registrationHook);
            unlink("$dir/downloads/$pluginName.plg");
            unlink("$dir/core-installed");
            unlink("$runtime/FolderViewPlus.page");
            unlink("$runtime/build-metadata.json");
            unlink("$packages/$pluginName-$candidate");
            rename($runtime, "$dir/runtime-before-reboot");
            file_put_contents("$dir/boot-id", "synthetic boot two\n");
            $bootManifests = glob("$boot/*.plg");
            verifyInstallFixture($bootManifests === [$recoveryWrapper, $bootManifest], "$case did not load recovery before the primary manifest.");
            foreach ($bootManifests as $manifestPath) {
                [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $manifestPath]);
                verifyInstallFixture($bootStatus === 0 && !str_contains($bootOutput, 'offline fixture attempted a download'),
                    "$case failed to load $manifestPath offline: $bootOutput");
            }
            clearstatcache();
            verifyInstallFixture(file_get_contents($bootManifest) === $newManifest && readlink($runningLink) === $bootManifest
                && trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$candidate.txz"
                && !is_dir($journal) && !is_link("$dir/running/" . basename($recoveryWrapper)),
                "$case did not boot the exact verified installation.");
            // The wrapper may still be enumerated on a later boot after its record is retired.
            [$inactiveStatus, $inactiveOutput] = $run([PHP_BINARY, $cli, 'install', $recoveryWrapper]);
            verifyInstallFixture($inactiveStatus === 0 && !is_link("$dir/running/" . basename($recoveryWrapper))
                && file_get_contents($bootManifest) === $newManifest && !is_dir($journal),
                "$case let an inactive wrapper register itself or modify the plugin: $inactiveOutput");
            $check[] = $case;
            continue;
        }
        verifyInstallFixture(str_contains($output, 'Executing hook script: 00-folderview.plus-registration')
            && !str_contains($output, 'could not confirm native boot registration')
            && file_get_contents("$dir/downloads/$pluginName.plg") === $peerManifest,
            "$case failed post-hook reconciliation or lost the newer stage: $output");
    } elseif (in_array($case, ['update-overlap-success', 'update-late-remove-success', 'install-url-remove-success', 'install-local-stage-remove-success', 'update-staged-registration-conflict'], true)) {
        $lateRemove = $case === 'update-late-remove-success';
        if ($case === 'install-url-remove-success') {
            file_put_contents("$dir/remote.plg", $newManifest);
            $command = [PHP_BINARY, $cli, 'install', 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg'];
        }
        if ($case === 'install-local-stage-remove-success') {
            // Native install resolves this relative path to the same shared stage.
            $command = [PHP_BINARY, $cli, 'install', "downloads/../downloads/$pluginName.plg"];
        }
        $first = $start($command, $lateRemove ? [] : ['FVPLUS_FIXTURE_PAUSE_BEFORE_VERSION' => '1']);
        $checkpoint = $lateRemove ? 'registration' : 'version';
        for ($attempt = 0; $attempt < 160 && !is_file("$dir/$checkpoint-commit-paused"); $attempt++) usleep(50000);
        verifyInstallFixture(is_file("$dir/$checkpoint-commit-paused"), "$case did not reach the $checkpoint commit.");
        $staged = "$dir/downloads/$pluginName.plg";
        [$removeStatus, $removeOutput] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"]);
        clearstatcache();
        $removeRefused = $removeStatus !== 0 && str_contains($removeOutput, 'installation or removal is in progress')
            && !file_exists($staged) && readlink($runningLink) === $bootManifest;
        $expectedStaged = $newManifest;
        if ($case === 'update-staged-registration-conflict') {
            $expectedStaged = $manifest('2026.01.01.03', '3.0.0');
            file_put_contents($staged, $expectedStaged);
        }
        touch("$dir/allow-$checkpoint-commit");
        [$status, $output] = $finish($first);
        verifyInstallFixture($removeRefused, "$case did not reproduce native staging deletion on a refused removal: $removeOutput");
        verifyInstallFixture($lateRemove ? !file_exists($staged) : is_file($staged) && file_get_contents($staged) === $expectedStaged,
            "$case did not restore the chosen input or preserve a staged peer: $output");
        if ($failed) {
            verifyInstallFixture(str_contains($output, 'staged manifest may have changed')
                && str_contains($output, 'restored the previous installation state') && !str_contains($output, 'Upgrade complete'),
                "$case did not report staging conflict and rollback: $output");
        } else {
            verifyInstallFixture(str_contains($output, 'Upgrade complete') && str_contains($output, 'copy(') === $lateRemove,
                "$case did not complete native registration: $output");
        }
    } elseif ($case === 'update-overlap-version') {
        $first = $start($command, ['FVPLUS_FIXTURE_PAUSE_BEFORE_VERSION' => '1']);
        for ($attempt = 0; $attempt < 160 && !is_file("$dir/version-commit-paused"); $attempt++) usleep(50000);
        verifyInstallFixture(is_file("$dir/version-commit-paused"), "$case did not reach the version commit.");
        [$secondStatus, $secondOutput] = $run($command, ['FVPLUS_FIXTURE_ALLOW_VERSION_COMMIT' => '1']);
        [$removeStatus, $removeOutput] = $run([PHP_BINARY, $cli, 'remove', "$pluginName.plg"]);
        touch("$dir/allow-version-failure");
        [$status, $output] = $finish($first);
        verifyInstallFixture($secondStatus !== 0 && str_contains($secondOutput, 'installation or removal is in progress'),
            "$case let a second update take ownership: $secondOutput");
        verifyInstallFixture($removeStatus !== 0 && str_contains($removeOutput, 'installation or removal is in progress'),
            "$case let removal run alongside an update: $removeOutput");
    } else {
        [$status, $output] = $run($command);
    }
    verifyInstallFixture(($status !== 0) === $failed, "$case returned $status: $output");
    verifyInstallFixture(file_get_contents("$config/docker.json") === '{"previous":"Docker"}', "$case changed Docker configuration.");
    verifyInstallFixture(file_get_contents("$config/vm.json") === '{"previous":"VM"}', "$case changed VM configuration.");
    verifyInstallFixture(is_file("$config/$pluginName-$previous.txz") && is_file("$config/$pluginName-icons-$previousIcon.txz"), "$case removed registered boot files.");
    verifyInstallFixture(is_file("$config/$pluginName-$candidate.txz") && is_file("$config/$pluginName-icons-2.0.0.txz"), "$case removed incoming boot files.");
    if ($fresh && $failed) {
        verifyInstallFixture(!file_exists("$config/version") && !file_exists("$dir/core-installed")
            && !file_exists("$runtime/FolderViewPlus.page") && !is_link("$runtime/images/third-party-icons")
            && !file_exists("$runtime/icon-asset-pack.json") && !file_exists($cronFile), "$case left the failed first installation active.");
    } else {
        $activeCoreVersion = $failed ? $previous : $candidate;
        $activeIconVersion = $failed ? $previousIcon : '2.0.0';
        verifyInstallFixture(trim(file_get_contents("$config/version")) === $activeCoreVersion, "$case wrote the wrong version.");
        verifyInstallFixture(trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$activeCoreVersion.txz"
            && trim(file_get_contents("$runtime/FolderViewPlus.page")) === "$config/$pluginName-$activeCoreVersion.txz", "$case left the wrong core package active.");
        verifyInstallFixture(is_file("$packages/$pluginName-$activeCoreVersion"), "$case left the wrong package record active.");
        verifyInstallFixture(json_decode(file_get_contents("$runtime/build-metadata.json"), true)['packageVersion'] === $activeCoreVersion,
            "$case left the wrong deployed package version active.");
        $link = "$runtime/images/third-party-icons";
        verifyInstallFixture(is_link($link) && str_contains(readlink($link), "/icons-$activeIconVersion/")
            && str_contains(file_get_contents("$link/fixture.svg"), "<title>$activeIconVersion</title>")
            && json_decode(file_get_contents("$runtime/icon-asset-pack.json"), true)['version'] === $activeIconVersion, "$case left the wrong icon pack active.");
        if ($failed && str_ends_with($case, 'scheduler')) {
            verifyInstallFixture(is_dir($cronFile), "$case replaced the existing scheduler obstacle.");
        } elseif ($failed) {
            verifyInstallFixture(file_get_contents($cronFile) === $priorCron && (fileperms($cronFile) & 0777) === 0600,
                "$case did not restore the previous scheduler bytes and mode.");
        } else {
            verifyInstallFixture(str_contains(file_get_contents($cronFile), '/scripts/scheduled_backup.php')
                && (fileperms($cronFile) & 0777) === 0644, "$case did not install the scheduler.");
        }
    }
    verifyInstallFixture(glob("$dir/cron.d/.folderview.plus.*") === [] && glob("$config/.version.*") === []
        && glob("$boot/.folderview.plus.plg.*") === [] && glob("$dir/downloads/.folderview.plus.plg.*") === [],
        "$case left temporary installation state behind.");
    verifyInstallFixture(glob("$dir/folderview.plus-install.*") === [] && !is_dir("$dir/registration")
        && !is_link("$dir/registration") && !is_dir($journal) && !is_file($recoveryWrapper) && !is_link($registrationHook),
        "$case left temporary reporting or native registration state behind: $output");
    if (str_ends_with($case, '-version')) {
        verifyInstallFixture(str_contains($output, 'Upgrade failed') && preg_match('/Previous\s+' . preg_quote($previous, '/') . '/', $output)
            && str_contains($output, 'restored the previous installation state') && !str_contains($output, 'Upgrade complete'),
            "$case reported the wrong operation, previous version, or recovery outcome: $output");
    }
    verifyInstallFixture(is_file("$config/$pluginName-2025.01.01.01.txz") === ($failed || $fresh), "$case pruned unexpectedly.");
    verifyInstallFixture(is_file("$config/$pluginName-icons-0.9.0.txz") === ($failed || $fresh), "$case pruned an icon pack unexpectedly.");

    if ($cliSource !== null) {
        if ($fresh && $failed) {
            verifyInstallFixture(!file_exists($bootManifest) && !is_link($runningLink), "$case registered a failed first installation.");
            $check[] = $case;
            continue;
        }
        verifyInstallFixture(file_get_contents($bootManifest) === ($failed ? $oldManifest : $newManifest), "$case registered the wrong manifest.");
        verifyInstallFixture(readlink($runningLink) === $bootManifest, "$case changed the running manifest link.");
        if (str_ends_with($case, '-corrupt')) {
            verifyInstallFixture(str_contains($output, 'cannot verify the previous core package'), "$case did not refuse an unverifiable rollback: $output");
            $check[] = $case;
            continue;
        }
        if ($case === 'update-overlap-version') {
            file_put_contents("$dir/downloads/$pluginName.plg", $newManifest);
            [$retryStatus, $retryOutput] = $run($command, ['FVPLUS_FIXTURE_ALLOW_VERSION_COMMIT' => '1']);
            verifyInstallFixture($retryStatus === 0 && file_get_contents($bootManifest) === $newManifest, "$case kept the install lock after recovery: $retryOutput");
            $activeCoreVersion = $candidate;
            $failed = false;
        }
        if (is_dir($cronFile)) rmdir($cronFile);
        unlink($runningLink);
        unlink("$dir/core-installed");
        unlink("$runtime/FolderViewPlus.page");
        unlink("$runtime/build-metadata.json");
        foreach (glob("$packages/$pluginName-*") as $packageRecord) unlink($packageRecord);
        rename($runtime, "$dir/runtime-before-reboot");
        [$bootStatus, $bootOutput] = $run([PHP_BINARY, $cli, 'install', $bootManifest], ['FVPLUS_FIXTURE_ALLOW_VERSION_COMMIT' => '1']);
        verifyInstallFixture($bootStatus === 0, "$case could not reinstall offline: $bootOutput");
        $bootVersion = $failed ? $previous : $candidate;
        verifyInstallFixture(trim(file_get_contents("$dir/core-installed")) === "$config/$pluginName-$bootVersion.txz", "$case reinstalled the wrong core archive.");
    }
    $check[] = $case;
}

echo json_encode(['nativeVersion' => $cliSource !== null ? $unraidVersion : null, 'cases' => $check], JSON_THROW_ON_ERROR);
