<?php

if (!function_exists('fvplusProcessProfiles')) {
    function fvplusProcessProfiles(): array {
        return [
            'docker-tailscale-ip' => [
                'tool' => 'docker',
                'timeoutSeconds' => 5,
                'maxOutputBytes' => 16384
            ],
            'docker-tailscale-status' => [
                'tool' => 'docker',
                'timeoutSeconds' => 5,
                'maxOutputBytes' => 262144
            ],
            'docker-runtime' => [
                'tool' => 'docker',
                'timeoutSeconds' => 30,
                'maxOutputBytes' => 32768
            ],
            'virsh-runtime' => [
                'tool' => 'virsh',
                'timeoutSeconds' => 30,
                'maxOutputBytes' => 32768
            ]
        ];
    }
}

if (!function_exists('fvplusProcessToolCandidates')) {
    function fvplusProcessToolCandidates(string $tool): array {
        $defaults = [
            'docker' => ['/usr/bin/docker', '/usr/local/bin/docker', '/usr/local/sbin/docker', '/bin/docker'],
            'virsh' => ['/usr/bin/virsh', '/usr/sbin/virsh', '/usr/local/bin/virsh', '/usr/local/sbin/virsh', '/bin/virsh', '/sbin/virsh']
        ];
        $candidates = $defaults[$tool] ?? [];
        if (PHP_SAPI === 'cli') {
            $testBinDir = trim((string)getenv('FVPLUS_TEST_PROCESS_BIN_DIR'));
            if ($testBinDir !== '' && preg_match('#^[A-Za-z0-9_./:\\\\ -]+$#', $testBinDir)) {
                array_unshift($candidates, rtrim($testBinDir, '/\\') . DIRECTORY_SEPARATOR . $tool);
            }
        }
        return array_values(array_unique($candidates));
    }
}

if (!function_exists('fvplusResolveProcessTool')) {
    function fvplusResolveProcessTool(string $tool): string {
        foreach (fvplusProcessToolCandidates($tool) as $candidate) {
            $resolved = realpath($candidate);
            if (!is_string($resolved) || $resolved === '' || !is_file($resolved) || !is_executable($resolved)) {
                continue;
            }
            if (PHP_SAPI === 'cli' && trim((string)getenv('FVPLUS_TEST_PROCESS_BIN_DIR')) !== '') {
                return $resolved;
            }
            if (
                strpos($resolved, '/usr/bin/') === 0
                || strpos($resolved, '/usr/sbin/') === 0
                || strpos($resolved, '/usr/local/bin/') === 0
                || strpos($resolved, '/usr/local/sbin/') === 0
                || strpos($resolved, '/bin/') === 0
                || strpos($resolved, '/sbin/') === 0
            ) {
                return $resolved;
            }
        }
        throw new RuntimeException("Required process tool '$tool' is unavailable.");
    }
}

if (!function_exists('fvplusValidateRuntimeItemName')) {
    function fvplusValidateRuntimeItemName(string $name, bool $allowSpaces = false): string {
        $safeName = trim($name);
        $pattern = $allowSpaces
            ? '/^[^\x00-\x1F\x7F\/\\\\]{1,255}$/u'
            : '/^[A-Za-z0-9_.:-]{1,255}$/';
        if ($safeName === '' || strlen($safeName) > 255 || !preg_match($pattern, $safeName)) {
            throw new RuntimeException('Runtime item name is invalid.');
        }
        return $safeName;
    }
}

if (!function_exists('fvplusBuildProcessArguments')) {
    function fvplusBuildProcessArguments(string $profile, array $input): array {
        $name = fvplusValidateRuntimeItemName(
            (string)($input['name'] ?? ''),
            $profile === 'virsh-runtime'
        );
        if ($profile === 'docker-tailscale-ip') {
            return ['exec', $name, 'tailscale', 'ip', '-4'];
        }
        if ($profile === 'docker-tailscale-status') {
            return ['exec', $name, 'tailscale', 'status', '--peers=false', '--json'];
        }
        if ($profile === 'docker-runtime') {
            $action = strtolower(trim((string)($input['action'] ?? '')));
            if (!in_array($action, ['start', 'stop', 'pause', 'unpause'], true)) {
                throw new RuntimeException('Docker runtime action is invalid.');
            }
            return [$action, $name];
        }
        if ($profile === 'virsh-runtime') {
            $action = strtolower(trim((string)($input['action'] ?? '')));
            if (!in_array($action, ['start', 'shutdown', 'suspend', 'resume'], true)) {
                throw new RuntimeException('VM runtime action is invalid.');
            }
            return [$action, $name];
        }
        throw new RuntimeException('Process profile is not allowlisted.');
    }
}

if (!function_exists('fvplusRunProcessProfile')) {
    function fvplusRunProcessProfile(string $profile, array $input): array {
        $profiles = fvplusProcessProfiles();
        if (!isset($profiles[$profile])) {
            throw new RuntimeException('Process profile is not allowlisted.');
        }
        $config = $profiles[$profile];
        $tool = (string)$config['tool'];
        $executable = fvplusResolveProcessTool($tool);
        $arguments = fvplusBuildProcessArguments($profile, $input);
        $command = array_merge([$executable], $arguments);
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w']
        ];
        $environment = [
            'PATH' => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'LANG' => 'C',
            'LC_ALL' => 'C'
        ];
        $pipes = [];
        $process = @proc_open($command, $descriptors, $pipes, null, $environment, ['bypass_shell' => true]);
        if (!is_resource($process)) {
            throw new RuntimeException("Unable to start allowlisted process profile '$profile'.");
        }

        @fclose($pipes[0]);
        @stream_set_blocking($pipes[1], false);
        @stream_set_blocking($pipes[2], false);
        $stdout = '';
        $stderr = '';
        $timedOut = false;
        $truncated = false;
        $observedExitCode = null;
        $startedAt = microtime(true);
        $timeoutSeconds = max(1, (int)$config['timeoutSeconds']);
        $maxOutputBytes = max(1024, (int)$config['maxOutputBytes']);

        while (true) {
            $status = @proc_get_status($process);
            $running = is_array($status) && ($status['running'] ?? false) === true;
            foreach ([1, 2] as $index) {
                $chunk = @stream_get_contents($pipes[$index]);
                if (!is_string($chunk) || $chunk === '') {
                    continue;
                }
                if ($index === 1) {
                    $stdout .= $chunk;
                } else {
                    $stderr .= $chunk;
                }
            }
            if ((strlen($stdout) + strlen($stderr)) > $maxOutputBytes) {
                $remaining = max(0, $maxOutputBytes - strlen($stdout));
                $stderr = substr($stderr, 0, $remaining);
                $truncated = true;
                @proc_terminate($process, 9);
                break;
            }
            if (!$running) {
                $candidateExitCode = is_array($status) ? (int)($status['exitcode'] ?? -1) : -1;
                if ($candidateExitCode >= 0) {
                    $observedExitCode = $candidateExitCode;
                }
                break;
            }
            if ((microtime(true) - $startedAt) >= $timeoutSeconds) {
                $timedOut = true;
                @proc_terminate($process, 15);
                usleep(100000);
                $afterTerminate = @proc_get_status($process);
                if (is_array($afterTerminate) && ($afterTerminate['running'] ?? false) === true) {
                    @proc_terminate($process, 9);
                }
                break;
            }
            usleep(20000);
        }

        foreach ([1, 2] as $index) {
            $chunk = @stream_get_contents($pipes[$index]);
            if (is_string($chunk) && $chunk !== '') {
                if ($index === 1) {
                    $stdout .= $chunk;
                } else {
                    $stderr .= $chunk;
                }
            }
            @fclose($pipes[$index]);
        }
        $exitCode = @proc_close($process);
        if ($exitCode < 0 && is_int($observedExitCode)) {
            $exitCode = $observedExitCode;
        }
        if ($timedOut) {
            $exitCode = 124;
        } elseif ($truncated) {
            $exitCode = 125;
        }
        $elapsedMs = max(0, (int)round((microtime(true) - $startedAt) * 1000));
        $combined = trim($stdout . ($stderr !== '' ? "\n" . $stderr : ''));
        $lines = $combined === '' ? [] : preg_split('/\r?\n/', $combined);
        if (!is_array($lines)) {
            $lines = [];
        }
        return [
            'ok' => $exitCode === 0 && !$timedOut && !$truncated,
            'exitCode' => (int)$exitCode,
            'stdout' => substr($stdout, 0, $maxOutputBytes),
            'stderr' => substr($stderr, 0, $maxOutputBytes),
            'output' => array_slice(array_values($lines), 0, 8),
            'timedOut' => $timedOut,
            'truncated' => $truncated,
            'durationMs' => $elapsedMs,
            'profile' => $profile
        ];
    }
}

if (!function_exists('fvplusRunRuntimeItemAction')) {
    function fvplusRunRuntimeItemAction(string $type, string $action, string $name): array {
        $profile = $type === 'docker' ? 'docker-runtime' : 'virsh-runtime';
        $mappedAction = $action;
        if ($type === 'docker' && $action === 'resume') {
            $mappedAction = 'unpause';
        } elseif ($type === 'vm' && $action === 'stop') {
            $mappedAction = 'shutdown';
        } elseif ($type === 'vm' && $action === 'pause') {
            $mappedAction = 'suspend';
        }
        return fvplusRunProcessProfile($profile, ['name' => $name, 'action' => $mappedAction]);
    }
}
