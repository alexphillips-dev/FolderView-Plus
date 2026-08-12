<?php
function fvplusThemeProfileDefault(string $id = 'default', string $name = 'Default profile'): array {
    $empty = ['variables' => [], 'customCss' => ''];
    return ['id' => $id, 'name' => $name, 'layers' => ['global' => $empty, 'docker' => $empty, 'vm' => $empty, 'dashboard' => $empty]];
}

function fvplusThemeProfileNormalizeLayer($value): array {
    $source = is_array($value) ? $value : [];
    return [
        'variables' => fvplusThemeWorkspaceNormalizeVariableMap($source['variables'] ?? []),
        'customCss' => truncateUtf8String((string)($source['customCss'] ?? ''), FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES)
    ];
}

function fvplusThemeProfileNormalize($value, int $index = 0): array {
    $source = is_array($value) ? $value : [];
    $id = truncateUtf8String(trim((string)($source['id'] ?? '')), 64);
    if ($id === '') {
        $id = 'profile-' . ($index + 1);
    }
    $name = truncateUtf8String(trim((string)($source['name'] ?? '')), 96);
    $profile = fvplusThemeProfileDefault($id, $name !== '' ? $name : 'Appearance profile ' . ($index + 1));
    $layers = is_array($source['layers'] ?? null) ? $source['layers'] : [];
    foreach (array_keys($profile['layers']) as $scope) {
        $profile['layers'][$scope] = fvplusThemeProfileNormalizeLayer($layers[$scope] ?? []);
    }
    return $profile;
}

function fvplusThemeProfilesNormalizeState(array $incoming): array {
    $rawProfiles = is_array($incoming['profiles'] ?? null) ? $incoming['profiles'] : [];
    if (count($rawProfiles) <= 0) {
        $legacy = fvplusThemeProfileDefault();
        $legacy['layers']['global'] = fvplusThemeProfileNormalizeLayer([
            'variables' => $incoming['variables'] ?? [],
            'customCss' => $incoming['customCss'] ?? ''
        ]);
        $rawProfiles = [$legacy];
    }
    $profiles = [];
    $seen = [];
    foreach (array_slice($rawProfiles, 0, 32) as $index => $rawProfile) {
        $profile = fvplusThemeProfileNormalize($rawProfile, $index);
        if (isset($seen[$profile['id']])) {
            continue;
        }
        $seen[$profile['id']] = true;
        $profiles[] = $profile;
    }
    if (count($profiles) <= 0) {
        $profiles[] = fvplusThemeProfileDefault();
        $seen['default'] = true;
    }
    $activeId = truncateUtf8String(trim((string)($incoming['activeProfileId'] ?? '')), 64);
    if ($activeId === '' || !isset($seen[$activeId])) {
        $activeId = (string)$profiles[0]['id'];
    }
    return ['activeProfileId' => $activeId, 'profiles' => $profiles];
}

function fvplusThemeProfileActive(array $workspace): array {
    $activeId = trim((string)($workspace['activeProfileId'] ?? ''));
    foreach ((array)($workspace['profiles'] ?? []) as $profile) {
        if (trim((string)($profile['id'] ?? '')) === $activeId) {
            return fvplusThemeProfileNormalize($profile);
        }
    }
    return fvplusThemeProfileDefault();
}

function fvplusThemeProfileResolvedLayer(array $workspace, string $scope): array {
    $profile = fvplusThemeProfileActive($workspace);
    $layers = (array)($profile['layers'] ?? []);
    $global = fvplusThemeProfileNormalizeLayer($layers['global'] ?? []);
    $scoped = fvplusThemeProfileNormalizeLayer($layers[$scope] ?? []);
    return [
        'variables' => array_replace($global['variables'], $scoped['variables']),
        'customCss' => trim(implode("\n\n", array_filter([$global['customCss'], $scoped['customCss']], static fn($value): bool => trim((string)$value) !== '')))
    ];
}

function fvplusThemeProfilesWithCompatibilityAliases(array $workspace): array {
    $profile = fvplusThemeProfileActive($workspace);
    $global = fvplusThemeProfileNormalizeLayer($profile['layers']['global'] ?? []);
    $workspace['variables'] = $global['variables'];
    $workspace['customCss'] = $global['customCss'];
    return $workspace;
}

function fvplusThemeProfileUpdateLayer(array $workspace, string $profileId, string $scope, $variables, string $customCss): array {
    if (!in_array($scope, ['global', 'docker', 'vm', 'dashboard'], true)) {
        throw new RuntimeException('Unsupported appearance profile scope.');
    }
    $found = false;
    foreach ($workspace['profiles'] as &$profile) {
        if ((string)($profile['id'] ?? '') !== $profileId) {
            continue;
        }
        $profile['layers'][$scope] = fvplusThemeProfileNormalizeLayer(['variables' => $variables, 'customCss' => $customCss]);
        $found = true;
        break;
    }
    unset($profile);
    if (!$found) {
        throw new RuntimeException('Appearance profile not found.');
    }
    return $workspace;
}
