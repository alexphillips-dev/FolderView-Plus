<?php

const FVPLUS_DOCKER_PAGE_ORDER_PATH = '/boot/config/plugins/dockerMan/userprefs.cfg';

function fvplus_append_unique_name(array &$list, array &$seen, string $name): void {
    $name = trim($name);
    if ($name === '' || isset($seen[$name])) {
        return;
    }
    $list[] = $name;
    $seen[$name] = true;
}

function dockerPageHasFolderSort(array $prefs): bool {
    return ($prefs['sortMode'] ?? 'created') !== 'created' || !empty($prefs['pinnedFolderIds']);
}

function readDockerNativePageOrder(): array {
    $path = FVPLUS_DOCKER_PAGE_ORDER_PATH;
    $parsed = is_file($path) ? @parse_ini_file($path) : false;
    return is_array($parsed) ? array_values($parsed) : [];
}

function dockerPageUnslottedNames(array $nativeRows, array $savedOrder, bool $hasNativeOrderFile): array {
    $savedNames = array_fill_keys($savedOrder, true);
    $unlisted = array_filter($nativeRows, static function ($row) use ($savedNames): bool {
        return is_array($row) && is_string($row['Name'] ?? null) && !isset($savedNames[$row['Name']]);
    });
    // Unraid compares the host records when rows share the unsaved sort rank.
    if ($hasNativeOrderFile) sort($unlisted, SORT_REGULAR);
    return array_column($unlisted, 'Name');
}

function composeDockerSavedOrder(array $nativeOrder, array $orderedFolders, array $prefs, array $liveNames = []): array {
    $folderPlaceholders = array_map(static fn($id) => 'folder-' . $id, array_keys($orderedFolders));
    // A live container named like a folder token keeps its native slot.
    $folderPlaceholders = array_values(array_diff($folderPlaceholders, $liveNames));
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

function buildDockerPageOrderModel(array $currentOrder, array $orderedFolders, array $prefs, array $allContainerNames, array $unlistedNativeNames = []): array {
    $savedOrder = composeDockerSavedOrder($currentOrder, $orderedFolders, $prefs, $allContainerNames);
    $liveNames = array_fill_keys($allContainerNames, true);
    $slotFolders = [];
    $slots = [];
    $sortSlots = dockerPageHasFolderSort($prefs);
    $preferredIds = $sortSlots ? orderFolderBranchIds($orderedFolders, $prefs['pinnedFolderIds'] ?? []) : [];
    $preferredIds = array_values(array_filter($preferredIds, static fn($id) => !isset($liveNames['folder-' . $id])));
    foreach ($savedOrder as $entry) {
        if (isset($liveNames[$entry])) {
            $slots[] = ['container', $entry];
            continue;
        }
        if (strpos($entry, 'folder-') !== 0) continue;
        $id = substr($entry, 7);
        if (!isset($orderedFolders[$id])) continue;
        if ($sortSlots) $id = $preferredIds[count($slotFolders)];
        $slotFolders[$id] = $orderedFolders[$id];
        $slots[] = ['folder', $id];
    }

    natcasesort($allContainerNames);
    $names = array_values(array_unique(array_merge(
        array_intersect($savedOrder, $allContainerNames),
        array_intersect($unlistedNativeNames, $allContainerNames),
        $allContainerNames
    )));
    foreach (array_diff($names, $savedOrder) as $name) $slots[] = ['container', $name];
    $unslotted = array_diff_key($orderedFolders, $slotFolders);
    $slots = array_merge(array_map(static fn($id) => ['folder', (string)$id], array_keys($unslotted)), $slots);
    $pageFolderIds = orderFolderBranchIds($unslotted + $slotFolders, [], true);

    // A nested folder appears with its root branch when the page is expanded.
    $rootById = [];
    $branchIds = [];
    foreach ($pageFolderIds as $id) {
        $parentId = (string)($orderedFolders[$id]['parentId'] ?? '');
        $rootId = $rootById[$parentId] ?? $id;
        $rootById[$id] = $rootId;
        $branchIds[$rootId][] = $id;
    }
    $pageOrder = [];
    foreach ($slots as [$kind, $id]) {
        if ($kind === 'container') {
            $pageOrder[] = ['container', $id];
            continue;
        }
        foreach ($branchIds[$id] ?? [] as $folderId) {
            $pageOrder[] = ['folder', $folderId];
        }
    }
    return [
        'displayFolderIds' => array_keys($slotFolders),
        'pageFolderIds' => $pageFolderIds,
        'pageOrder' => $pageOrder,
        'names' => $names
    ];
}
