<?php
function preserveMigratedFolderReferences(array $next, array $existing): array {
    if (($existing['membershipPolicy'] ?? '') !== 'folderview3') return $next;
    $next['membershipPolicy'] = 'folderview3';
    $retained = array_intersect_key((array)($existing['memberIdentities'] ?? []), array_fill_keys($next['containers'], true));
    $next['memberIdentities'] = array_replace($retained, $next['memberIdentities']);
    return $next;
}

// Only migrated folders opt into FV3's explicit > valid label > regex ownership.
function buildLegacyFolderMembership(array $folders, array $names, array $info, string $type, array $rules): array {
    if (!array_filter($folders, static fn($folder): bool => is_array($folder) && ($folder['membershipPolicy'] ?? '') === 'folderview3')) return [];
    $manual = [];
    $labels = [];
    $result = [];
    foreach ($folders as $id => $folder) {
        if (!is_array($folder)) continue;
        foreach (normalizeFolderMembers($folder['containers'] ?? []) as $name) {
            if (!isset($manual[$name])) $manual[$name] = (string)$id;
        }
        $folderName = (string)($folder['name'] ?? '');
        if ($folderName !== '' && !isset($labels[$folderName])) $labels[$folderName] = (string)$id;
        if (($folder['membershipPolicy'] ?? '') === 'folderview3') $result[$id] = [];
    }
    $available = array_fill_keys($names, true); $labelMembers = [];
    foreach ($result as $id => $_) {
        $result[$id] = array_values(array_filter(normalizeFolderMembers($folders[$id]['containers'] ?? []), static fn(string $name): bool => isset($available[$name]) && $manual[$name] === (string)$id));
        $labelMembers[$id] = [];
    }
    foreach ($names as $name) {
        if (isset($manual[$name])) continue;
        $labelOwner = $type === 'docker' ? ($labels[getFolderLabelValueFromLabels(dockerInfoLabelsForName($info, $name))] ?? '') : '';
        $owner = $labelOwner;
        if ($owner === '') {
            $decision = autoRuleDecision($rules, $name, $info, $type);
            $owner = (string)($decision['assignedRule']['folderId'] ?? '');
        }
        if (array_key_exists($owner, $result)) {
            if ($labelOwner !== '') $labelMembers[$owner][] = $name; else $result[$owner][] = $name;
        }
    }
    foreach ($result as $id => $members) $result[$id] = array_merge($members, $labelMembers[$id]);
    return $result;
}
