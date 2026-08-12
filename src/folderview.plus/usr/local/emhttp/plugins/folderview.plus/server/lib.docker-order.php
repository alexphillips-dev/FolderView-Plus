<?php
function dockerSyncOrderLockPath(): string {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/docker-sync-order.lock';
    }

    function dockerSyncOrderPendingPath(): string {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/docker-sync-order.pending';
    }

    function markDockerSyncOrderPending(): void {
        @file_put_contents(dockerSyncOrderPendingPath(), (string)microtime(true));
    }

    function clearDockerSyncOrderPending(): void {
        $pendingPath = dockerSyncOrderPendingPath();
        if (file_exists($pendingPath)) {
            @unlink($pendingPath);
        }
    }

    function hasDockerSyncOrderPending(): bool {
        return file_exists(dockerSyncOrderPendingPath());
    }

    function fvplus_append_unique_name(array &$list, array &$seen, string $name): void {
        $name = trim($name);
        if ($name === '' || isset($seen[$name])) {
            return;
        }
        $list[] = $name;
        $seen[$name] = true;
    }

    function fvplus_set_autostart_line_delay(string $line, int $delay): string {
        $parts = preg_split('/\s+/', trim($line), 2);
        $name = (string)($parts[0] ?? '');
        if ($name === '') {
            return trim($line);
        }
        return $delay > 0 ? $name . ' ' . $delay : $name;
    }

    function buildDockerStartOrderContext(): array {
        global $configDir;

        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $prefsFile = "/boot/config/plugins/dockerMan/userprefs.cfg";
        $currentPrefs = file_exists($prefsFile) ? @parse_ini_file($prefsFile) : false;
        $currentOrder = $currentPrefs ? array_values($currentPrefs) : [];

        $foldersFile = "$configDir/docker.json";
        $folders = file_exists($foldersFile) ? (json_decode(file_get_contents($foldersFile), true) ?: []) : [];

        $dockerClient = new DockerClient();
        $allContainerNames = [];
        foreach ((array)$dockerClient->getDockerContainers() as $containerMeta) {
            $name = trim((string)($containerMeta['Name'] ?? ''));
            if ($name === '' || in_array($name, $allContainerNames, true)) {
                continue;
            }
            $allContainerNames[] = $name;
        }
        $prefs = readTypePrefs('docker');
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $infoByName = readInfoState('docker');
        if (count($allContainerNames) <= 0) {
            $allContainerNames = array_keys($infoByName);
        }

        $ruleTargetByName = [];
        $labelTargetByName = [];
        foreach ($allContainerNames as $name) {
            $decision = autoRuleDecision($rules, $name, $infoByName, 'docker');
            $assignedRule = is_array($decision['assignedRule'] ?? null) ? $decision['assignedRule'] : null;
            $ruleTargetByName[$name] = $assignedRule ? (string)($assignedRule['folderId'] ?? '') : '';
            $labels = dockerInfoLabelsForName($infoByName, $name);
            $labelTargetByName[$name] = getFolderLabelValueFromLabels($labels);
        }

        $orderedFolders = reorderFolderMapByPrefs('docker', $folders);
        $folderContainers = [];
        $folderNames = [];
        $assignedContainers = [];
        foreach ($orderedFolders as $folderId => $folder) {
            $members = normalizeFolderMembers($folder['containers'] ?? []);
            if (!empty($folder['regex'])) {
                $regex = '/' . str_replace('/', '\/', $folder['regex']) . '/';
                foreach ($allContainerNames as $name) {
                    if (@preg_match($regex, $name) && !in_array($name, $members, true)) {
                        $members[] = $name;
                    }
                }
            }
            $folderName = trim((string)($folder['name'] ?? ''));
            if ($folderName !== '') {
                foreach ($allContainerNames as $name) {
                    if (($labelTargetByName[$name] ?? '') === $folderName && !in_array($name, $members, true)) {
                        $members[] = $name;
                    }
                }
            }
            foreach ($allContainerNames as $name) {
                if (($ruleTargetByName[$name] ?? '') === (string)$folderId && !in_array($name, $members, true)) {
                    $members[] = $name;
                }
            }
            $members = array_values(array_filter($members, function($m) use ($allContainerNames, $assignedContainers) {
                return in_array($m, $allContainerNames, true) && !in_array($m, $assignedContainers, true);
            }));
            $placeholder = "folder-$folderId";
            $folderContainers[$placeholder] = $members;
            $folderNames[$placeholder] = $folderName !== '' ? $folderName : $placeholder;
            $assignedContainers = array_merge($assignedContainers, $members);
        }

        $dockerManPaths = @parse_ini_file('/boot/config/plugins/dockerMan/dockerMan.cfg') ?: [];
        $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
        $autoStartLines = file_exists($autoStartFile)
            ? (@file($autoStartFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [])
            : [];
        $autoStartMap = [];
        $staleAutostart = [];
        foreach ($autoStartLines as $line) {
            $parts = preg_split('/\s+/', trim((string)$line), 2);
            $name = (string)($parts[0] ?? '');
            if ($name === '') {
                continue;
            }
            if (!in_array($name, $allContainerNames, true)) {
                $staleAutostart[] = $name;
                continue;
            }
            $autoStartMap[$name] = trim((string)$line);
        }

        return [
            'prefs' => $prefs,
            'currentPrefs' => $currentPrefs,
            'currentOrder' => $currentOrder,
            'folders' => $folders,
            'orderedFolders' => $orderedFolders,
            'folderContainers' => $folderContainers,
            'folderNames' => $folderNames,
            'assignedContainers' => array_values(array_unique($assignedContainers)),
            'allContainerNames' => array_values($allContainerNames),
            'autoStartFile' => $autoStartFile,
            'autoStartMap' => $autoStartMap,
            'staleAutostart' => $staleAutostart
        ];
    }

    function buildDockerPageStartOrder(array $context): array {
        $allContainerNames = (array)($context['allContainerNames'] ?? []);
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $folderPlaceholders = array_keys($folderContainers);
        $assignedContainers = (array)($context['assignedContainers'] ?? []);
        $currentOrder = (array)($context['currentOrder'] ?? []);
        $currentPrefs = $context['currentPrefs'] ?? false;

        if (!$currentPrefs) {
            $currentOrder = array_values($allContainerNames);
            natcasesort($currentOrder);
            $currentOrder = array_values($currentOrder);
        }

        $newOrder = [];
        $seen = [];
        foreach ($currentOrder as $item) {
            $item = trim((string)$item);
            if ($item === '') {
                continue;
            }
            if (in_array($item, $folderPlaceholders, true)) {
                foreach ((array)($folderContainers[$item] ?? []) as $ct) {
                    fvplus_append_unique_name($newOrder, $seen, (string)$ct);
                }
                continue;
            }
            if (in_array($item, $assignedContainers, true)) {
                continue;
            }
            if (in_array($item, $allContainerNames, true)) {
                fvplus_append_unique_name($newOrder, $seen, $item);
            }
        }

        foreach ($allContainerNames as $name) {
            if (!in_array($name, $assignedContainers, true)) {
                fvplus_append_unique_name($newOrder, $seen, (string)$name);
            }
        }

        foreach ($folderPlaceholders as $placeholder) {
            foreach ((array)($folderContainers[$placeholder] ?? []) as $ct) {
                fvplus_append_unique_name($newOrder, $seen, (string)$ct);
            }
        }

        return $newOrder;
    }

    function buildDockerCustomStartOrder(array $context, array $plan): array {
        $allContainerNames = (array)($context['allContainerNames'] ?? []);
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $autoStartMap = (array)($context['autoStartMap'] ?? []);
        $pageOrder = buildDockerPageStartOrder($context);
        $plannedOrder = [];
        $seen = [];
        $batchesOut = [];
        $warnings = [];

        foreach ((array)($plan['batches'] ?? []) as $batch) {
            if (!is_array($batch)) {
                continue;
            }
            $batchNames = [];
            foreach ((array)($batch['items'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $type = (string)($item['type'] ?? 'container');
                if ($type === 'folder') {
                    $placeholder = 'folder-' . trim((string)($item['id'] ?? ''));
                    if (!array_key_exists($placeholder, $folderContainers)) {
                        $warnings[] = 'Folder in start plan no longer exists: ' . $placeholder;
                        continue;
                    }
                    foreach ((array)$folderContainers[$placeholder] as $ct) {
                        $batchNames[] = (string)$ct;
                    }
                    continue;
                }
                $name = trim((string)($item['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                if (!in_array($name, $allContainerNames, true)) {
                    $warnings[] = 'Container in start plan no longer exists: ' . $name;
                    continue;
                }
                $batchNames[] = $name;
            }

            $batchAutostartNames = [];
            $seenBatch = [];
            foreach ($batchNames as $name) {
                if (!isset($autoStartMap[$name])) {
                    $warnings[] = $name . ' is in the start plan but Docker autostart is off.';
                    continue;
                }
                fvplus_append_unique_name($plannedOrder, $seen, $name);
                fvplus_append_unique_name($batchAutostartNames, $seenBatch, $name);
            }
            $batchesOut[] = [
                'id' => (string)($batch['id'] ?? ''),
                'name' => (string)($batch['name'] ?? 'Start batch'),
                'delay' => (int)($batch['delay'] ?? 0),
                'parallel' => (bool)($batch['parallel'] ?? false),
                'containers' => $batchAutostartNames
            ];
        }

        $remaining = strtolower(trim((string)($plan['remaining'] ?? 'after')));
        $remainingOrder = [];
        $remainingSeen = [];
        if ($remaining === 'keep') {
            foreach (array_keys($autoStartMap) as $name) {
                if (!isset($seen[$name])) {
                    fvplus_append_unique_name($remainingOrder, $remainingSeen, (string)$name);
                }
            }
        } else {
            foreach ($pageOrder as $name) {
                if (isset($autoStartMap[$name]) && !isset($seen[$name])) {
                    fvplus_append_unique_name($remainingOrder, $remainingSeen, (string)$name);
                }
            }
        }

        $ordered = $remaining === 'before'
            ? array_values(array_merge($remainingOrder, $plannedOrder))
            : array_values(array_merge($plannedOrder, $remainingOrder));

        return [
            'order' => $ordered,
            'batches' => $batchesOut,
            'warnings' => array_values(array_unique($warnings)),
            'remaining' => $remainingOrder
        ];
    }

    function buildDockerStartOrderPlan(array $context = null): array {
        $context = $context ?? buildDockerStartOrderContext();
        $prefs = is_array($context['prefs'] ?? null) ? $context['prefs'] : readTypePrefs('docker');
        $plan = normalizeDockerStartOrderPrefs($prefs['dockerStartOrder'] ?? []);
        $autoStartMap = (array)($context['autoStartMap'] ?? []);
        $mode = (string)($plan['mode'] ?? 'docker-page');
        $warnings = [];
        $batches = [];
        $remaining = [];
        if ($mode === 'unmanaged') { $order = array_keys($autoStartMap); } elseif ($mode === 'custom-batches') {
            $custom = buildDockerCustomStartOrder($context, $plan);
            $order = (array)($custom['order'] ?? []);
            $warnings = (array)($custom['warnings'] ?? []);
            $batches = (array)($custom['batches'] ?? []);
            $remaining = (array)($custom['remaining'] ?? []);
        } else {
            $order = buildDockerPageStartOrder($context);
        }
        $autoStartOrder = [];
        foreach ($order as $name) {
            if (isset($autoStartMap[$name])) {
                $autoStartOrder[] = $name;
            }
        }
        foreach (array_keys($autoStartMap) as $name) {
            if (!in_array($name, $autoStartOrder, true)) {
                $autoStartOrder[] = $name;
            }
        }
        return [
            'mode' => $mode,
            'managed' => $mode !== 'unmanaged',
            'remainingMode' => (string)($plan['remaining'] ?? 'after'),
            'order' => array_values($order),
            'autostartOrder' => $autoStartOrder,
            'batches' => $batches,
            'remaining' => $remaining,
            'warnings' => array_values(array_unique($warnings)),
            'autostartCount' => count($autoStartMap),
            'containerCount' => count((array)($context['allContainerNames'] ?? [])),
            'staleAutostart' => (array)($context['staleAutostart'] ?? [])
        ];
    }

    function dockerStartOrderPreview(): array {
        $context = buildDockerStartOrderContext();
        return buildDockerStartOrderPlan($context);
    }

    function syncContainerOrderUnlocked(): void {
        // Rewrites the autostart file to match the configured FolderView Plus start order.
        // Docker userprefs.cfg is owned by Unraid and is only read here.
        $context = buildDockerStartOrderContext();
        $plan = buildDockerStartOrderPlan($context);
        if (($plan['managed'] ?? true) !== true) { fv3_debug_log('syncContainerOrder: skipped because Docker start order is unmanaged'); return; }
        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $autoStartFile = (string)($context['autoStartFile'] ?? "/var/lib/docker/unraid-autostart");
        if (file_exists($autoStartFile)) {
            $autoStartMap = (array)($context['autoStartMap'] ?? []);
            $newAutoStart = [];
            foreach ((array)($plan['autostartOrder'] ?? []) as $name) {
                if (isset($autoStartMap[$name])) {
                    $newAutoStart[] = $autoStartMap[$name];
                    unset($autoStartMap[$name]);
                }
            }
            foreach ($autoStartMap as $line) {
                $newAutoStart[] = $line;
            }
            if (($plan['mode'] ?? '') === 'custom-batches') {
                $lineIndexByName = [];
                foreach ($newAutoStart as $index => $line) {
                    $parts = preg_split('/\s+/', trim((string)$line), 2);
                    $lineIndexByName[(string)($parts[0] ?? '')] = $index;
                }
                foreach ((array)($plan['batches'] ?? []) as $batch) {
                    $containers = (array)($batch['containers'] ?? []);
                    $delay = (int)($batch['delay'] ?? 0);
                    if ($delay <= 0 || count($containers) <= 0) {
                        continue;
                    }
                    $last = (string)end($containers);
                    if (isset($lineIndexByName[$last])) {
                        $idx = $lineIndexByName[$last];
                        $newAutoStart[$idx] = fvplus_set_autostart_line_delay((string)$newAutoStart[$idx], $delay);
                    }
                }
            }
            $nextAutoStartContent = count($newAutoStart) > 0
                ? implode("\n", $newAutoStart) . "\n"
                : '';
            $currentAutoStartContent = @file_get_contents($autoStartFile);
            if ((string)$currentAutoStartContent !== $nextAutoStartContent) {
                writeDurableFileAtomic($autoStartFile, $nextAutoStartContent);
                fv3_debug_log("syncContainerOrder: wrote autostart file with " . count($newAutoStart) . " entries using " . (string)($plan['mode'] ?? 'docker-page') . " mode");
            } else {
                fv3_debug_log("syncContainerOrder: autostart file already up to date");
            }
        }
    }

    function syncContainerOrder(string $type): void {
        fv3_debug_log("syncContainerOrder called for type: $type");

        if ($type !== 'docker') { return; }
        if (!dockerStartOrderIsManaged()) { fv3_debug_log('syncContainerOrder: skipped before lock because Docker start order is unmanaged'); return; }

        $lockHandle = @fopen(dockerSyncOrderLockPath(), 'c+');
        if (!is_resource($lockHandle)) {
            fv3_debug_log('syncContainerOrder: unable to open lock file, falling back to unlocked run');
            syncContainerOrderUnlocked();
            return;
        }

        if (!@flock($lockHandle, LOCK_EX | LOCK_NB)) {
            markDockerSyncOrderPending();
            fv3_debug_log('syncContainerOrder: coalesced while another sync is already running');
            @fclose($lockHandle);
            return;
        }

        try {
            $attempt = 0;
            do {
                $attempt++;
                clearDockerSyncOrderPending();
                $startedAt = microtime(true);
                syncContainerOrderUnlocked();
                $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
                $shouldRerun = hasDockerSyncOrderPending();
                fv3_debug_log("syncContainerOrder: pass $attempt completed in {$durationMs}ms" . ($shouldRerun ? ' (pending rerun requested)' : ''));
            } while ($shouldRerun && $attempt < 3);
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }
    }
