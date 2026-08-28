<?php
const FVPLUS_WEBUI_PROFILE_MAX_PROFILES = 100;
const FVPLUS_WEBUI_PROFILE_MAX_MEMBERS = 250;
const FVPLUS_WEBUI_PROFILE_MAX_NAME_BYTES = 80;
const FVPLUS_WEBUI_PROFILE_MAX_MEMBER_BYTES = 160;

function fvplusWebuiProfileCleanString($value, int $maxBytes): string {
    $clean = preg_replace('/[\x00-\x1F\x7F]/u', '', (string)$value);
    $trimmed = trim(is_string($clean) ? $clean : '');
    return strlen($trimmed) <= $maxBytes ? $trimmed : substr($trimmed, 0, $maxBytes);
}

function fvplusNormalizeWebuiProfiles($value): array {
    $source = is_array($value) ? $value : [];
    $profiles = [];
    $usedIds = [];
    $usedNames = [];
    foreach ($source as $sourceIndex => $rawProfile) {
        if (count($profiles) >= FVPLUS_WEBUI_PROFILE_MAX_PROFILES || !is_array($rawProfile)) {
            continue;
        }
        $id = fvplusWebuiProfileCleanString($rawProfile['id'] ?? '', 64);
        if (!preg_match('/^[A-Za-z0-9._:-]{1,64}$/', $id)) {
            $id = 'profile-' . ((int)$sourceIndex + 1);
        }
        $baseId = $id;
        $suffix = 2;
        while (isset($usedIds[$id])) {
            $id = substr($baseId, 0, 58) . '-' . $suffix;
            $suffix++;
        }
        $usedIds[$id] = true;

        $name = fvplusWebuiProfileCleanString($rawProfile['name'] ?? '', FVPLUS_WEBUI_PROFILE_MAX_NAME_BYTES);
        if ($name === '') {
            $name = 'Profile ' . (count($profiles) + 1);
        }
        $baseName = $name;
        $nameKey = strtolower($name);
        $suffix = 2;
        while (isset($usedNames[$nameKey])) {
            $suffixText = ' ' . $suffix;
            $name = substr($baseName, 0, max(1, FVPLUS_WEBUI_PROFILE_MAX_NAME_BYTES - strlen($suffixText))) . $suffixText;
            $nameKey = strtolower($name);
            $suffix++;
        }
        $usedNames[$nameKey] = true;

        $rawMembers = is_array($rawProfile['containers'] ?? null)
            ? $rawProfile['containers']
            : (is_array($rawProfile['members'] ?? null) ? $rawProfile['members'] : []);
        $containers = [];
        $seenMembers = [];
        foreach ($rawMembers as $rawMember) {
            if (count($containers) >= FVPLUS_WEBUI_PROFILE_MAX_MEMBERS) {
                break;
            }
            $member = fvplusWebuiProfileCleanString($rawMember, FVPLUS_WEBUI_PROFILE_MAX_MEMBER_BYTES);
            if ($member === '' || isset($seenMembers[$member])) {
                continue;
            }
            $seenMembers[$member] = true;
            $containers[] = $member;
        }
        $profiles[] = ['id' => $id, 'name' => $name, 'containers' => $containers];
    }
    return $profiles;
}

function fvplusStripWebuiProfilesFromSettings($settings): array {
    $normalized = is_array($settings) ? $settings : [];
    unset($normalized['webui_profiles'], $normalized['webuiProfiles']);
    return $normalized;
}

function fvplusBuildWebuiProfileDiagnostics($settings, array $availableMembers): array {
    $rawSettings = is_array($settings) ? $settings : [];
    $rawProfiles = $rawSettings['webui_profiles'] ?? ($rawSettings['webuiProfiles'] ?? []);
    $invalidProfileCount = 0;
    $rawIds = [];
    $duplicateProfileIdCount = 0;
    foreach (is_array($rawProfiles) ? $rawProfiles : [] as $rawProfile) {
        if (!is_array($rawProfile)) {
            $invalidProfileCount++;
            continue;
        }
        $rawId = fvplusWebuiProfileCleanString($rawProfile['id'] ?? '', 64);
        $rawName = fvplusWebuiProfileCleanString($rawProfile['name'] ?? '', FVPLUS_WEBUI_PROFILE_MAX_NAME_BYTES);
        if ($rawId === '' || !preg_match('/^[A-Za-z0-9._:-]{1,64}$/', $rawId) || $rawName === '') {
            $invalidProfileCount++;
        }
        if ($rawId !== '' && isset($rawIds[$rawId])) {
            $duplicateProfileIdCount++;
        }
        if ($rawId !== '') {
            $rawIds[$rawId] = true;
        }
    }
    $profiles = fvplusNormalizeWebuiProfiles($rawProfiles);
    $available = array_fill_keys(array_values(array_unique(array_map('strval', $availableMembers))), true);
    $selectedReferenceCount = 0;
    $unavailableReferenceCount = 0;
    foreach ($profiles as $profile) {
        foreach ($profile['containers'] as $member) {
            $selectedReferenceCount++;
            if (!isset($available[$member])) {
                $unavailableReferenceCount++;
            }
        }
    }
    return [
        'profileCount' => count($profiles),
        'selectedReferenceCount' => $selectedReferenceCount,
        'unavailableReferenceCount' => $unavailableReferenceCount,
        'duplicateProfileIdCount' => $duplicateProfileIdCount,
        'invalidProfileCount' => $invalidProfileCount
    ];
}

function fvplusMergeWebuiProfileDiagnostics(array $left, array $right): array {
    $keys = ['profileCount', 'selectedReferenceCount', 'unavailableReferenceCount', 'duplicateProfileIdCount', 'invalidProfileCount'];
    $merged = [];
    foreach ($keys as $key) {
        $merged[$key] = max(0, (int)($left[$key] ?? 0)) + max(0, (int)($right[$key] ?? 0));
    }
    return $merged;
}
