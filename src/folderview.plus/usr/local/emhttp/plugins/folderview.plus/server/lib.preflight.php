<?php
    function getLegacyConfigDirCandidates(): array {
        $candidates = [];
        foreach (FVPLUS_LEGACY_CONFIG_DIRS as $dir) {
            if (is_dir($dir)) {
                $candidates[] = $dir;
            }
        }
        return $candidates;
    }

    function getCustomOverrideDirs(string $kind): array {
        global $configDir;
        $safeKind = $kind === 'styles' ? 'styles' : 'scripts';
        $dirs = [];

        $currentDir = "$configDir/$safeKind";
        if (is_dir($currentDir)) {
            $dirs[] = $currentDir;
        }

        foreach (getLegacyConfigDirCandidates() as $legacyDir) {
            $path = "$legacyDir/$safeKind";
            if (is_dir($path)) {
                $dirs[] = $path;
            }
        }

        return array_values(array_unique($dirs));
    }

    function collectRuntimeOverrideEntries(string $type): array {
        $safeType = ensureType($type);
        $entries = [];
        $patterns = [
            'scripts' => "/\..*{$safeType}.*\.js$/",
            'styles' => "/\..*{$safeType}.*\.css$/"
        ];

        foreach ($patterns as $kind => $filePattern) {
            foreach (getCustomOverrideDirs($kind) as $overrideDir) {
                $baseDir = realpath($overrideDir);
                if ($baseDir === false) {
                    continue;
                }
                $files = dirToArrayOfFiles(pathToMultiDimArray($overrideDir), $filePattern, "/.*\.disabled$/");
                foreach ($files as $file) {
                    if (!is_array($file) || empty($file['path'])) {
                        continue;
                    }
                    $resolved = realpath($file['path']);
                    if ($resolved === false || strpos($resolved, $baseDir . '/') !== 0) {
                        continue;
                    }
                    $relativePath = ltrim(substr($resolved, strlen($baseDir)), '/');
                    $displayPath = ($relativePath === '' || $relativePath === false)
                        ? basename($resolved)
                        : str_replace('\\', '/', $relativePath);
                    $key = $kind . ':' . $resolved;
                    $entries[$key] = [
                        'kind' => $kind,
                        'path' => $displayPath,
                        'sourceDir' => str_replace('\\', '/', $baseDir)
                    ];
                }
            }
        }

        return array_values($entries);
    }

    function appendRuntimePreflightIssue(array &$issues, string $severity, string $code, string $title, string $message, array $details = [], string $category = 'environment'): void {
        $normalizedSeverity = strtolower(trim($severity));
        if (!in_array($normalizedSeverity, ['fatal', 'degraded'], true)) {
            $normalizedSeverity = 'degraded';
        }
        $detailLines = [];
        foreach ($details as $detail) {
            $normalized = trim((string)$detail);
            if ($normalized !== '') {
                $detailLines[] = $normalized;
            }
        }
        $issues[] = [
            'severity' => $normalizedSeverity,
            'code' => trim($code),
            'title' => trim($title),
            'message' => trim($message),
            'details' => $detailLines,
            'category' => trim($category) !== '' ? trim($category) : 'environment'
        ];
    }

    function collectRuntimePreflight(string $type): array {
        $safeType = ensureType($type);
        $surface = $safeType === 'docker' ? 'Docker' : 'VMs';
        $codePrefix = $safeType === 'docker' ? 'FVPLUS-DKR' : 'FVPLUS-VM';
        $issues = [];

        $unraidVersion = readUnraidVersionString();
        if (is_string($unraidVersion) && trim($unraidVersion) !== '') {
            if (version_compare($unraidVersion, '7.0.0', '<')) {
                appendRuntimePreflightIssue(
                    $issues,
                    'fatal',
                    $codePrefix . '-ENV-001',
                    "$surface runtime is not supported on this Unraid version",
                    "FolderView Plus requires Unraid 7.0.0 or newer for the $surface runtime.",
                    ["Detected Unraid version: $unraidVersion"],
                    'unsupported-unraid-version'
                );
            }
        }

        $dependencyStatus = fvplus_get_host_dependency_status();
        $dependencyDetails = [];
        $requiredDependencyLabels = [
            'helpers' => 'Unraid Helpers.php',
            'validation' => 'FolderView Plus validation library'
        ];
        if ($safeType === 'docker') {
            $requiredDependencyLabels['docker'] = 'Dynamix Docker helper';
        } else {
            $requiredDependencyLabels['libvirt'] = 'Dynamix VM libvirt helper';
        }
        foreach ($requiredDependencyLabels as $key => $label) {
            $entry = is_array($dependencyStatus[$key] ?? null) ? $dependencyStatus[$key] : [];
            if (($entry['loaded'] ?? false) === true) {
                continue;
            }
            $path = trim((string)($entry['path'] ?? ''));
            $detail = trim((string)($entry['detail'] ?? 'Dependency did not load.'));
            $dependencyDetails[] = $path !== ''
                ? "$label: $detail ($path)"
                : "$label: $detail";
        }
        if (count($dependencyDetails) > 0) {
            appendRuntimePreflightIssue(
                $issues,
                'fatal',
                $codePrefix . '-ENV-002',
                "$surface runtime dependencies are unavailable",
                "FolderView Plus could not load one or more required host dependencies for the $surface runtime.",
                $dependencyDetails,
                'missing-host-dependency'
            );
        }

        if ($safeType === 'docker') {
            $missingClasses = [];
            foreach (['DockerClient', 'DockerUpdate', 'DockerTemplates', 'DockerUtil'] as $className) {
                if (!class_exists($className)) {
                    $missingClasses[] = "Missing PHP class: $className";
                }
            }
            if (count($missingClasses) > 0) {
                appendRuntimePreflightIssue(
                    $issues,
                    'fatal',
                    $codePrefix . '-ENV-003',
                    'Docker runtime helpers are incomplete',
                    'FolderView Plus could not find the Unraid Docker runtime classes it needs.',
                    $missingClasses,
                    'missing-runtime-class'
                );
            } elseif (!array_filter($issues, static fn(array $issue): bool => ($issue['severity'] ?? '') === 'fatal')) {
                try {
                    $dockerClient = new DockerClient();
                    $probe = $dockerClient->getDockerJSON("/containers/json?all=1");
                    if (!is_array($probe)) {
                        appendRuntimePreflightIssue(
                            $issues,
                            'fatal',
                            $codePrefix . '-ENV-004',
                            'Docker API probe failed',
                            'FolderView Plus could not read Docker container data from the host runtime.',
                            ['DockerClient::getDockerJSON("/containers/json?all=1") did not return an array.'],
                            'docker-api-unavailable'
                        );
                    }
                } catch (Throwable $error) {
                    appendRuntimePreflightIssue(
                        $issues,
                        'fatal',
                        $codePrefix . '-ENV-004',
                        'Docker API probe failed',
                        'FolderView Plus could not contact the Docker runtime on this page load.',
                        [trim((string)$error->getMessage()) ?: 'DockerClient probe threw an unknown error.'],
                        'docker-api-unavailable'
                    );
                }
            }
        } else {
            if (!class_exists('Libvirt')) {
                appendRuntimePreflightIssue(
                    $issues,
                    'fatal',
                    $codePrefix . '-ENV-003',
                    'VM runtime helpers are incomplete',
                    'FolderView Plus could not find the Unraid libvirt runtime class it needs.',
                    ['Missing PHP class: Libvirt'],
                    'missing-runtime-class'
                );
            } elseif (!array_filter($issues, static fn(array $issue): bool => ($issue['severity'] ?? '') === 'fatal')) {
                try {
                    $lv = new Libvirt();
                    if (!$lv->connect()) {
                        appendRuntimePreflightIssue(
                            $issues,
                            'fatal',
                            $codePrefix . '-ENV-004',
                            'Libvirt connection failed',
                            'FolderView Plus could not connect to the Unraid libvirt service for the VMs runtime.',
                            ['Libvirt::connect() returned false.'],
                            'libvirt-unavailable'
                        );
                    }
                } catch (Throwable $error) {
                    appendRuntimePreflightIssue(
                        $issues,
                        'fatal',
                        $codePrefix . '-ENV-004',
                        'Libvirt connection failed',
                        'FolderView Plus could not initialize the libvirt helper for the VMs runtime.',
                        [trim((string)$error->getMessage()) ?: 'Libvirt probe threw an unknown error.'],
                        'libvirt-unavailable'
                    );
                }
            }
        }

        $overrideEntries = collectRuntimeOverrideEntries($safeType);
        if (count($overrideEntries) > 0) {
            $overrideDetails = [];
            $visibleEntries = array_slice($overrideEntries, 0, 8);
            foreach ($visibleEntries as $entry) {
                $kind = trim((string)($entry['kind'] ?? 'override'));
                $path = trim((string)($entry['path'] ?? ''));
                if ($path === '') {
                    continue;
                }
                $overrideDetails[] = strtoupper(rtrim($kind, 's')) . ': ' . $path;
            }
            $remaining = count($overrideEntries) - count($visibleEntries);
            if ($remaining > 0) {
                $overrideDetails[] = "... and $remaining more override file(s).";
            }
            appendRuntimePreflightIssue(
                $issues,
                'degraded',
                $codePrefix . '-OVR-001',
                'Custom FolderView Plus overrides are active',
                "Custom scripts or styles are active on the $surface page and can change or break runtime behavior.",
                $overrideDetails,
                'custom-overrides'
            );
        }

        return [
            'type' => $safeType,
            'surface' => $surface,
            'issues' => $issues
        ];
    }

    function runtimePreflightHasFatal(array $preflight): bool {
        foreach (($preflight['issues'] ?? []) as $issue) {
            if (!is_array($issue)) {
                continue;
            }
            if (strtolower(trim((string)($issue['severity'] ?? ''))) === 'fatal') {
                return true;
            }
        }
        return false;
    }
