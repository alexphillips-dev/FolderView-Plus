<?php
require_once __DIR__ . '/lib.folder-membership.php';
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

    function dockerPageHasFolderSort(array $prefs): bool {
        return ($prefs['sortMode'] ?? 'created') !== 'created' || !empty($prefs['pinnedFolderIds']);
    }

    function composeDockerSavedOrder(array $nativeOrder, array $orderedFolders, array $prefs): array {
        $folderPlaceholders = array_map(static fn($id) => 'folder-' . $id, array_keys($orderedFolders));
        $folderTokens = array_fill_keys($folderPlaceholders, true);
        $sortSlots = dockerPageHasFolderSort($prefs);
        $slotIndex = 0;
        $seen = [];
        $nextOrder = [];
        foreach ($nativeOrder as $entry) {
            $value = trim((string)$entry);
            if ($sortSlots && isset($folderTokens[$value])) $value = $folderPlaceholders[$slotIndex++] ?? '';
            // An unknown folder-prefixed token may be a real container name.
            fvplus_append_unique_name($nextOrder, $seen, $value);
        }
        // Folders without a host slot keep their established top placement.
        $missing = array_values(array_diff($folderPlaceholders, $nextOrder));
        return array_merge($missing, $nextOrder);
    }

    function buildDockerPageOrderModel(array $currentOrder, array $orderedFolders, array $prefs, array $allContainerNames): array {
        $savedOrder = composeDockerSavedOrder($currentOrder, $orderedFolders, $prefs);
        $slotFolders = [];
        $sortSlots = dockerPageHasFolderSort($prefs);
        $preferredIds = $sortSlots ? orderFolderBranchIds($orderedFolders, $prefs['pinnedFolderIds'] ?? []) : [];
        foreach ($savedOrder as $entry) {
            if (strpos($entry, 'folder-') !== 0) continue;
            $id = substr($entry, 7);
            if (!isset($orderedFolders[$id])) continue;
            if ($sortSlots) $id = $preferredIds[count($slotFolders)];
            $slotFolders[$id] = $orderedFolders[$id];
        }
        // The render starts with a saved-name reconciliation and appends newly discovered rows.
        natcasesort($allContainerNames);
        $names = array_values(array_unique(array_merge(array_intersect($savedOrder, $allContainerNames), $allContainerNames)));
        return [
            'displayFolderIds' => array_keys($slotFolders),
            'pageFolderIds' => orderFolderBranchIds($slotFolders, [], true),
            'names' => $names
        ];
    }

    function buildDockerStartOrderContext(?array $verifiedInventory = null): array {
        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $prefsFile = "/boot/config/plugins/dockerMan/userprefs.cfg";
        $currentPrefs = file_exists($prefsFile) ? @parse_ini_file($prefsFile) : false;
        $currentOrder = $currentPrefs ? array_values($currentPrefs) : [];

        $folders = readRawFolderMap('docker', true);

        $allContainerNames = [];
        if ($verifiedInventory === null) {
            $dockerClient = new DockerClient();
            foreach ((array)$dockerClient->getDockerContainers() as $containerMeta) {
                $name = trim((string)($containerMeta['Name'] ?? ''));
                if ($name === '' || in_array($name, $allContainerNames, true)) {
                    continue;
                }
                $allContainerNames[] = $name;
            }
        }
        $prefs = readTypePrefs('docker');
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $infoByName = $verifiedInventory ?? readInfoState('docker');
        if (count($allContainerNames) <= 0) {
            $allContainerNames = array_keys($infoByName);
        }

        $orderedFolders = reorderFolderMapByPrefs('docker', $folders, $prefs);
        $pageModel = buildDockerPageOrderModel($currentOrder, $orderedFolders, $prefs, $allContainerNames);
        $snapshot = fvplusBuildMembershipSnapshot('docker', $orderedFolders, $rules, $infoByName, $pageModel['names'], $pageModel['displayFolderIds']);
        $folderContainers = []; $folderNames = []; $assignedContainers = [];
        foreach ($orderedFolders as $folderId => $folder) {
            $placeholder = "folder-$folderId";
            $members = $snapshot['byFolder'][$folderId]['displayMembers'] ?? [];
            $folderContainers[$placeholder] = $members;
            $folderName = trim((string)($folder['name'] ?? ''));
            $folderNames[$placeholder] = $folderName !== '' ? $folderName : $placeholder;
            $assignedContainers = array_merge($assignedContainers, $members);
        }

        $autoStartFile = fvplusEnvironmentDockerAutostartPath();
        $autoStartLines = file_exists($autoStartFile)
            ? @file($autoStartFile)
            : [];
        $autoStartContent = is_array($autoStartLines) ? implode('', $autoStartLines) : null;
        $autoStartMap = [];
        $staleAutostart = [];
        foreach ($autoStartLines ?: [] as $line) {
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
            'pageContainerNames' => $pageModel['names'],
            'pageFolderIds' => $pageModel['pageFolderIds'],
            'autoStartFile' => $autoStartFile,
            'autoStartContent' => $autoStartContent,
            'autoStartMap' => $autoStartMap,
            'staleAutostart' => $staleAutostart
        ];
    }

    function buildDockerPageStartOrder(array $context): array {
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $assignedContainers = array_fill_keys($context['assignedContainers'], true);
        $newOrder = [];
        $seen = [];
        foreach ($context['pageFolderIds'] as $id) {
            foreach ($folderContainers['folder-' . $id] ?? [] as $name) {
                fvplus_append_unique_name($newOrder, $seen, (string)$name);
            }
        }

        foreach ($context['pageContainerNames'] as $name) {
            if (!isset($assignedContainers[$name])) fvplus_append_unique_name($newOrder, $seen, (string)$name);
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
        $sequence = buildDockerStartOrderSequence($autoStartOrder, $context, $plan, $batches);
        return [
            'mode' => $mode,
            'managed' => $mode !== 'unmanaged',
            'remainingMode' => (string)($plan['remaining'] ?? 'after'),
            'order' => array_values($order),
            'autostartOrder' => $autoStartOrder,
            'sequence' => $sequence,
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

    function syncContainerOrderUnlocked(): ?string {
        // Rewrites the autostart file to match the configured FolderView Plus start order.
        // Docker userprefs.cfg is owned by Unraid and is only read here.
        try {
            $context = buildDockerStartOrderContext(fvplusReadRepairInventory('docker'));
        } catch (\UnexpectedValueException $error) {
            fv3_debug_log('syncContainerOrder: Docker folders could not be verified');
            return 'docker_order_folders_unavailable';
        } catch (Throwable $error) {
            // Sync is also a post-save hook: retain native records without rejecting committed configuration.
            fv3_debug_log('syncContainerOrder: skipped because inventory or context could not be verified');
            return null;
        }
        $plan = buildDockerStartOrderPlan($context);
        if (($plan['managed'] ?? true) !== true) { fv3_debug_log('syncContainerOrder: skipped because Docker start order is unmanaged'); return null; }
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
            $newAutoStart = applyDockerStartOrderSequenceWaits($newAutoStart, (array)($plan['sequence'] ?? []));
            $nextAutoStartContent = count($newAutoStart) > 0
                ? implode("\n", $newAutoStart) . "\n"
                : '';
            $currentAutoStartContent = @file_get_contents($autoStartFile);
            if ($currentAutoStartContent !== ($context['autoStartContent'] ?? null)) {
                fv3_debug_log('syncContainerOrder: native autostart changed during planning; skipped');
                return null;
            }
            if ((string)$currentAutoStartContent !== $nextAutoStartContent) {
                writeDurableFileAtomic($autoStartFile, $nextAutoStartContent);
                fv3_debug_log("syncContainerOrder: wrote autostart file with " . count($newAutoStart) . " entries using " . (string)($plan['mode'] ?? 'docker-page') . " mode");
            } else {
                fv3_debug_log("syncContainerOrder: autostart file already up to date");
            }
        }
        return null;
    }

    function syncContainerOrder(string $type): ?string {
        fv3_debug_log("syncContainerOrder called for type: $type");

        if ($type !== 'docker') { return null; }
        if (!dockerStartOrderIsManaged()) { fv3_debug_log('syncContainerOrder: skipped before lock because Docker start order is unmanaged'); return null; }

        $lockHandle = @fopen(dockerSyncOrderLockPath(), 'c+');
        if (!is_resource($lockHandle)) {
            fv3_debug_log('syncContainerOrder: could not open the sync lock');
            return 'docker_order_lock_unavailable';
        }

        if (!@flock($lockHandle, LOCK_EX | LOCK_NB, $wouldBlock)) {
            @fclose($lockHandle);
            if (!$wouldBlock) return 'docker_order_lock_unavailable';
            markDockerSyncOrderPending();
            fv3_debug_log('syncContainerOrder: coalesced while another sync is already running');
            return null;
        }

        try {
            $attempt = 0;
            do {
                $attempt++;
                clearDockerSyncOrderPending();
                $startedAt = microtime(true);
                $failure = syncContainerOrderUnlocked();
                $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
                $shouldRerun = hasDockerSyncOrderPending();
                fv3_debug_log("syncContainerOrder: pass $attempt completed in {$durationMs}ms" . ($shouldRerun ? ' (pending rerun requested)' : ''));
            } while ($shouldRerun && $attempt < 3);
            return $failure;
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }
    }

    function fvplusRespondToDockerOrderSync(string $type): bool {
        $failure = syncContainerOrder($type);
        if ($failure === null) return true;
        $status = $failure === 'docker_order_lock_unavailable' ? 503 : 409;
        fvplus_json_error('Docker start order sync failed', $status, ['errorCode' => $failure]);
        return false;
    }
