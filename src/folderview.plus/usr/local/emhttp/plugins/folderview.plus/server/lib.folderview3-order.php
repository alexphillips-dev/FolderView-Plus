<?php
function fvplusFolderView3ResolveOrder(array $folders, $snapshot, array &$warnings): array {
    $fallback = array_keys($folders);
    if ($snapshot === null || $snapshot === []) {
        return ['ids' => $fallback, 'status' => $snapshot === null ? 'missing' : 'empty'];
    }
    $entries = is_array($snapshot) ? ($snapshot['entries'] ?? null) : null;
    $valid = is_array($snapshot) && ($snapshot['fv3_order_version'] ?? null) === 1
        && is_array($entries) && array_is_list($entries) && count($entries) > 0 && count($entries) <= 4096;
    foreach ($valid ? $entries : [] as $entry) {
        if (!is_string($entry) || $entry === '' || trim($entry) !== $entry || strlen($entry) > 256
            || preg_match('/["\x00-\x1f\x7f]/', $entry)) {
            $valid = false;
            break;
        }
    }
    if (!$valid) {
        $warnings[] = 'A FolderView3 order snapshot is invalid; folder configuration order was used.';
        return ['ids' => $fallback, 'status' => 'invalid'];
    }
    $order = [];
    $seen = [];
    foreach ($entries as $entry) {
        if (isset($seen[$entry])) {
            $warnings[] = 'Duplicate FolderView3 order entries were ignored.';
            continue;
        }
        $seen[$entry] = true;
        if (!str_starts_with($entry, 'folder-')) {
            $warnings[] = 'Folder order is preserved; positions of unassigned items in the Unraid page are not imported.';
            continue;
        }
        $id = substr($entry, 7);
        if (!array_key_exists($id, $folders)) {
            $warnings[] = 'Unknown folder references in FolderView3 order snapshots were ignored.';
            continue;
        }
        $order[] = $id;
    }
    return ['ids' => array_values(array_unique(array_merge($order, $fallback))), 'status' => 'imported'];
}
