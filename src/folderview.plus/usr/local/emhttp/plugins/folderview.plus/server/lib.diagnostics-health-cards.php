<?php
    function diagnosticsRuntimeConnectivity(array $configPaths = []): array {
        $states = [];
        foreach (['docker' => ['/boot/config/docker.cfg', 'DOCKER_ENABLED'], 'vm' => ['/boot/config/domain.cfg', 'SERVICE']] as $type => [$defaultPath, $key]) {
            $path = (string)($configPaths[$type] ?? $defaultPath);
            $config = @file_get_contents($path);
            $setting = '';
            if (is_string($config) && preg_match('/^\s*' . $key . '\s*=\s*["\']?([a-z]+)["\']?\s*$/mi', $config, $matches)) {
                $setting = strtolower($matches[1]);
            }
            $disabled = $type === 'docker' ? $setting === 'no' : $setting === 'disable';
            $enabled = $type === 'docker' ? $setting === 'yes' : $setting === 'enable';
            if ($disabled) {
                $states[$type] = 'disabled';
                continue;
            }
            $ready = false;
            try {
                if ($type === 'docker' && class_exists('DockerClient')) {
                    $client = new DockerClient();
                    $ready = is_array($client->getDockerJSON('/containers/json?all=1'));
                } elseif ($type === 'vm' && class_exists('Libvirt')) {
                    $client = new Libvirt();
                    $ready = $client->connect() && is_array($client->get_domains());
                }
            } catch (Throwable $error) {
                // Only a bounded state is included in diagnostics and support bundles.
            }
            $states[$type] = $ready ? 'ready' : ($enabled ? 'unavailable' : 'unknown');
        }
        return $states;
    }

    function diagnosticsBackupReadiness(array $typesData, ?int $now = null): array {
        $now = $now ?? time();
        $states = [];
        foreach (['docker', 'vm'] as $type) {
            $data = is_array($typesData[$type] ?? null) ? $typesData[$type] : [];
            $backup = is_array($data['lastBackup'] ?? null) ? $data['lastBackup'] : null;
            $schedule = is_array($data['backupSchedule'] ?? null) ? $data['backupSchedule'] : [];
            $created = $backup ? strtotime((string)($backup['createdAt'] ?? '')) : false;
            $ageHours = $created !== false && $created > 0 ? max(0, (int)floor(($now - $created) / 3600)) : null;
            $state = 'ready';
            if ((int)($data['folderCount'] ?? 0) === 0) {
                $state = 'empty';
            } elseif ($backup === null) {
                $state = 'missing';
            } elseif ((int)($backup['count'] ?? 0) <= 0 || (int)($backup['size'] ?? 0) <= 0 || $ageHours === null) {
                $state = 'invalid';
            } elseif (($schedule['enabled'] ?? false) === true && $ageHours > max(1, (int)($schedule['intervalHours'] ?? 24)) + 1) {
                $state = 'overdue';
            }
            $states[$type] = ['state' => $state, 'ageHours' => $ageHours, 'scheduled' => ($schedule['enabled'] ?? false) === true];
        }
        return $states;
    }

    function diagnosticsBuildBackupReadinessCard(array $typesData): array {
        $states = diagnosticsBackupReadiness($typesData);
        $warnings = count(array_filter($states, static fn(array $row): bool => in_array($row['state'], ['missing', 'invalid', 'overdue'], true)));
        $status = $warnings > 0 ? 'warning' : (count(array_filter($states, static fn(array $row): bool => $row['state'] === 'ready')) > 0 ? 'healthy' : 'info');
        return diagnosticsBuildSummaryCard('backup_readiness', 'Backup readiness', $status,
            $status === 'warning' ? 'Backups need attention.' : ($status === 'healthy' ? 'Backup snapshots are available.' : 'No folders to back up.'),
            'Check Docker and VM backup status.', ['count' => $warnings, 'states' => $states]);
    }

    function diagnosticsBuildRuntimeConnectivityCard(array $runtimeConnectivity): array {
        $states = [];
        foreach (['docker', 'vm'] as $type) {
            $state = (string)($runtimeConnectivity[$type] ?? 'unknown');
            $states[$type] = in_array($state, ['ready', 'unavailable', 'disabled', 'unknown'], true) ? $state : 'unknown';
        }
        $warnings = count(array_filter($states, static fn(string $state): bool => $state === 'unavailable'));
        $status = $warnings > 0 ? 'warning' : (in_array('unknown', $states, true) || in_array('disabled', $states, true) ? 'info' : 'healthy');
        return diagnosticsBuildSummaryCard('runtime_connectivity', 'Live runtime connectivity', $status,
            $status === 'warning' ? 'A runtime is unavailable.' : ($status === 'healthy' ? 'Runtime connection succeeded.' : 'Review Docker and VM runtime status.'),
            'Check Docker and VM runtime status.', ['count' => $warnings, 'states' => $states]);
    }

    function diagnosticsBuildSummaryOutcome(int $errorCount, int $warningCount, int $totalIssues, bool $hasInformationalCard): array {
        $status = diagnosticsSummaryStatusFromCounts($errorCount, $warningCount);
        if ($status === 'healthy' && $hasInformationalCard) {
            $status = 'info';
        }
        $headline = $totalIssues > 0
            ? sprintf('Detected %d issue(s) that may affect FolderView Plus.', $totalIssues)
            : ($warningCount > 0
                ? 'Plugin is healthy, but there are a few follow-up items.'
                : ($status === 'info' ? 'Some checks are informational.' : 'No major plugin health issues detected.'));
        $detail = $totalIssues > 0
            ? 'Start with the suggested fixes below. If the problem continues, copy the issue report or export a support bundle.'
            : ($warningCount > 0
                ? 'Review the warning cards below, then decide if any follow-up is needed.'
                : ($status === 'info' ? 'Review checks that are disabled or could not be verified.' : 'Use support exports only if you need to share diagnostics with someone else.'));
        return ['status' => $status, 'headline' => $headline, 'detail' => $detail];
    }
