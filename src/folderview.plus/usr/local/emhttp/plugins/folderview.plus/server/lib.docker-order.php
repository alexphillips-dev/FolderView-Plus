<?php
require_once __DIR__ . '/lib.folder-membership.php';
require_once __DIR__ . '/lib.docker-page-order.php';
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

    function markDockerSyncOrderPending(): bool {
        return @file_put_contents(dockerSyncOrderPendingPath(), (string)microtime(true)) !== false;
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

    function fvplus_set_autostart_line_delay(string $line, int $delay): string {
        $parts = preg_split('/\s+/', trim($line), 2);
        $name = (string)($parts[0] ?? '');
        if ($name === '') {
            return trim($line);
        }
        return $delay > 0 ? $name . ' ' . $delay : $name;
    }

    function dockerPageStartOrderUsesSavedLayout(array $prefs): bool {
        return ($prefs['dockerRowPlacement'] ?? 'folders-first') === 'saved-order'
            && ($prefs['groupUnassignedItems'] ?? false) !== true;
    }

    function buildDockerStartOrderContext(?array $verifiedInventory = null): array {
        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $currentOrder = readDockerNativePageOrder();

        $folders = readRawFolderMap('docker', true);

        $allContainerNames = [];
        $nativeRows = [];
        if ($verifiedInventory === null) {
            $dockerClient = new DockerClient();
            $nativeRows = (array)fvplusReadDockerHostValue(static fn() => $dockerClient->getDockerContainers(), true);
            foreach ($nativeRows as $containerMeta) {
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
            $allContainerNames = array_map('strval', array_keys($infoByName));
        }

        $unlistedNativeNames = [];
        if (($prefs['dockerStartOrder']['mode'] ?? '') === 'docker-page'
            && dockerPageStartOrderUsesSavedLayout($prefs)
            && count(array_diff($allContainerNames, $currentOrder)) > 1) {
            if ($verifiedInventory !== null) {
                // Only this mode needs the native tiebreaker for multiple unsaved rows.
                try {
                    $nativeRows = (array)fvplusReadDockerHostValue(static fn() => (new DockerClient())->getDockerContainers());
                } catch (Throwable $error) {
                    fv3_debug_log('Docker startup preview could not verify the native order of unsaved rows.');
                }
            }
            $unlistedNativeNames = dockerPageUnslottedNames($nativeRows, $currentOrder, is_file(FVPLUS_DOCKER_PAGE_ORDER_PATH));
        }
        $orderedFolders = reorderFolderMapByPrefs('docker', $folders, $prefs);
        $pageModel = buildDockerPageOrderModel($currentOrder, $orderedFolders, $prefs, $allContainerNames, $unlistedNativeNames);
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
            'currentOrder' => $currentOrder,
            'folders' => $folders,
            'orderedFolders' => $orderedFolders,
            'folderContainers' => $folderContainers,
            'folderNames' => $folderNames,
            'assignedContainers' => array_values(array_unique($assignedContainers)),
            'allContainerNames' => array_values($allContainerNames),
            'pageContainerNames' => $pageModel['names'],
            'pageFolderIds' => $pageModel['pageFolderIds'],
            'pageOrder' => $pageModel['pageOrder'],
            'autoStartFile' => $autoStartFile,
            'autoStartContent' => $autoStartContent,
            'autoStartMap' => $autoStartMap,
            'staleAutostart' => $staleAutostart
        ];
    }

    function buildDockerPageStartOrder(array $context, bool $followSavedLayout = true): array {
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $assignedContainers = array_fill_keys($context['assignedContainers'], true);
        $prefs = $context['prefs'] ?? [];
        $useMixedOrder = $followSavedLayout && dockerPageStartOrderUsesSavedLayout($prefs) && isset($context['pageOrder']);
        $entries = $useMixedOrder ? $context['pageOrder'] : array_merge(
            array_map(static fn($id) => ['folder', $id], $context['pageFolderIds']),
            array_map(static fn($name) => ['container', $name], $context['pageContainerNames'])
        );
        $newOrder = [];
        $seen = [];
        foreach ($entries as [$kind, $id]) {
            if ($kind === 'container') {
                if (!isset($assignedContainers[$id])) fvplus_append_unique_name($newOrder, $seen, (string)$id);
                continue;
            }
            foreach ($folderContainers['folder-' . $id] ?? [] as $name) {
                fvplus_append_unique_name($newOrder, $seen, (string)$name);
            }
        }
        return $newOrder;
    }

    function buildDockerCustomStartOrder(array $context, array $plan): array {
        $allContainerNames = (array)($context['allContainerNames'] ?? []);
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $autoStartMap = (array)($context['autoStartMap'] ?? []);
        $nativeNames = array_map('strval', array_keys($autoStartMap));
        $pageOrder = buildDockerPageStartOrder($context, false);
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
                    $members = array_map('strval', (array)$folderContainers[$placeholder]);
                    if (($batch['useFolderOrder'] ?? true) === false) {
                        $members = array_merge(array_intersect($nativeNames, $members), array_diff($members, $nativeNames));
                    }
                    $batchNames = array_merge($batchNames, $members);
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
            foreach ($batchNames as $name) {
                if (!isset($autoStartMap[$name])) {
                    $warnings[] = $name . ' is in the start plan but Docker autostart is off.';
                    continue;
                }
                if (isset($seen[$name])) continue;
                fvplus_append_unique_name($plannedOrder, $seen, $name);
                $batchAutostartNames[] = $name;
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
            foreach ($nativeNames as $name) {
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
        $nativeNames = array_map('strval', array_keys($autoStartMap));
        $mode = (string)($plan['mode'] ?? 'docker-page');
        $warnings = [];
        $batches = [];
        $remaining = [];
        if ($mode === 'unmanaged') { $order = $nativeNames; } elseif ($mode === 'custom-batches') {
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
        foreach ($nativeNames as $name) {
            if (!in_array($name, $autoStartOrder, true)) {
                $autoStartOrder[] = $name;
            }
        }
        $sequence = buildDockerStartOrderSequence($autoStartOrder, $context, $mode === 'unmanaged' ? [] : $plan, $batches);
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
            'nativeAutostartReadable' => is_string($context['autoStartContent'] ?? null),
            'containerCount' => count((array)($context['allContainerNames'] ?? [])),
            'staleAutostart' => (array)($context['staleAutostart'] ?? [])
        ];
    }

    function dockerStartOrderPreview(): array {
        $context = buildDockerStartOrderContext();
        return buildDockerStartOrderPlan($context);
    }

    function syncContainerOrderUnlocked(): array {
        // Rewrites the autostart file to match the configured FolderView Plus start order.
        // Docker userprefs.cfg is owned by Unraid and is only read here.
        try {
            $context = buildDockerStartOrderContext(fvplusReadRepairInventory('docker'));
        } catch (\UnexpectedValueException $error) {
            fv3_debug_log('syncContainerOrder: Docker folders could not be verified');
            return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_folders_unavailable'];
        } catch (Throwable $error) {
            // Sync is also a post-save hook: retain native records without rejecting committed configuration.
            fv3_debug_log('syncContainerOrder: skipped because inventory or context could not be verified');
            return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_inventory_unavailable'];
        }
        $plan = buildDockerStartOrderPlan($context);
        if (($plan['managed'] ?? true) !== true) { fv3_debug_log('syncContainerOrder: skipped because Docker start order is unmanaged'); return ['syncOutcome' => 'unmanaged']; }
        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $autoStartFile = (string)($context['autoStartFile'] ?? "/var/lib/docker/unraid-autostart");
        if (is_file($autoStartFile)) {
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
            if ($currentAutoStartContent === false || $currentAutoStartContent !== ($context['autoStartContent'] ?? null)) {
                fv3_debug_log('syncContainerOrder: native autostart changed during planning; skipped');
                return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_native_changed'];
            }
            if ((string)$currentAutoStartContent !== $nextAutoStartContent) {
                try {
                    writeDurableFileAtomic($autoStartFile, $nextAutoStartContent);
                } catch (Throwable $error) {
                    return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_native_write_failed'];
                }
                if (@file_get_contents($autoStartFile) !== $nextAutoStartContent) return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_native_changed'];
                fv3_debug_log("syncContainerOrder: wrote autostart file with " . count($newAutoStart) . " entries using " . (string)($plan['mode'] ?? 'docker-page') . " mode");
            } else {
                fv3_debug_log("syncContainerOrder: autostart file already up to date");
            }
            return ['syncOutcome' => 'synced', 'preview' => $plan];
        }
        return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_native_unavailable'];
    }

    function syncContainerOrder(string $type): array {
        fv3_debug_log("syncContainerOrder called for type: $type");

        if ($type !== 'docker') { return ['syncOutcome' => 'not-applicable']; }
        // Setup rollback and all plugin writes to native Docker order must share this lock.
        return withConfigMutationLock(static fn(): array => fvplusSyncDockerOrderWithNativeLock());
    }

    function fvplusSyncDockerOrderWithNativeLock(): array {
        if (!dockerStartOrderIsManaged()) { fv3_debug_log('syncContainerOrder: skipped before lock because Docker start order is unmanaged'); return ['syncOutcome' => 'unmanaged']; }
        if (isset($GLOBALS['fvplus_setup_docker_order_sync'])) {
            $GLOBALS['fvplus_setup_docker_order_sync'] = true;
            return ['syncOutcome' => 'queued'];
        }

        $lockHandle = @fopen(dockerSyncOrderLockPath(), 'c+');
        if (!is_resource($lockHandle)) {
            fv3_debug_log('syncContainerOrder: could not open the sync lock');
            return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_lock_unavailable'];
        }

        if (!@flock($lockHandle, LOCK_EX | LOCK_NB, $wouldBlock)) {
            @fclose($lockHandle);
            if (!$wouldBlock || !markDockerSyncOrderPending()) return ['syncOutcome' => 'failed', 'errorCode' => 'docker_order_lock_unavailable'];
            fv3_debug_log('syncContainerOrder: coalesced while another sync is already running');
            return ['syncOutcome' => 'queued'];
        }

        try {
            $attempt = 0;
            do {
                $attempt++;
                clearDockerSyncOrderPending();
                $startedAt = microtime(true);
                $result = syncContainerOrderUnlocked();
                $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
                $shouldRerun = hasDockerSyncOrderPending();
                fv3_debug_log("syncContainerOrder: pass $attempt completed in {$durationMs}ms" . ($shouldRerun ? ' (pending rerun requested)' : ''));
            } while ($shouldRerun && $attempt < 3);
            return $shouldRerun && $result['syncOutcome'] === 'synced' ? ['syncOutcome' => 'queued'] : $result;
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }
    }

    function fvplusRespondToDockerOrderSync(string $type, bool $bestEffort = false): ?array {
        $result = syncContainerOrder($type);
        $failure = $result['errorCode'] ?? null;
        // Post-save callers acknowledge skipped work without invalidating the saved folder.
        if ($failure === null || ($bestEffort && in_array($failure, [
            'docker_order_inventory_unavailable', 'docker_order_native_changed', 'docker_order_native_unavailable', 'docker_order_native_write_failed'
        ], true))) return $result;
        $status = $failure === 'docker_order_lock_unavailable' ? 503 : 409;
        fvplus_json_error('Docker start order sync failed', $status, $result);
        return null;
    }
