<?php
function createThemeWorkspaceProfile(string $name): array {
    $workspace = readThemeWorkspace();
    $safeName = truncateUtf8String(trim($name), 96);
    if ($safeName === '') {
        throw new RuntimeException('Appearance profile name is required.');
    }
    $id = 'profile-' . generateId(12);
    $workspace['profiles'][] = fvplusThemeProfileDefault($id, $safeName);
    $workspace['activeProfileId'] = $id;
    return writeThemeWorkspace($workspace);
}

function activateThemeWorkspaceProfile(string $profileId): array {
    $workspace = readThemeWorkspace();
    $safeId = truncateUtf8String(trim($profileId), 64);
    $found = false;
    foreach ((array)$workspace['profiles'] as $profile) {
        if ((string)($profile['id'] ?? '') === $safeId) {
            $found = true;
            break;
        }
    }
    if (!$found) {
        throw new RuntimeException('Appearance profile not found.');
    }
    $workspace['activeProfileId'] = $safeId;
    return writeThemeWorkspace($workspace);
}

function deleteThemeWorkspaceProfile(string $profileId): array {
    $workspace = readThemeWorkspace();
    if (count((array)$workspace['profiles']) <= 1) {
        throw new RuntimeException('The final appearance profile cannot be deleted.');
    }
    $safeId = truncateUtf8String(trim($profileId), 64);
    $profiles = array_values(array_filter((array)$workspace['profiles'], static fn(array $profile): bool => (string)($profile['id'] ?? '') !== $safeId));
    if (count($profiles) === count((array)$workspace['profiles'])) {
        throw new RuntimeException('Appearance profile not found.');
    }
    $workspace['profiles'] = $profiles;
    if ((string)$workspace['activeProfileId'] === $safeId) {
        $workspace['activeProfileId'] = (string)$profiles[0]['id'];
    }
    return writeThemeWorkspace($workspace);
}

function prepareThemeWorkspaceProfileLayer(string $profileId, string $scope, $variables, string $customCss): array {
    $workspace = readThemeWorkspace();
    $scan = fvplusThemeWorkspaceScanCss($customCss);
    if (count((array)($scan['severe'] ?? [])) > 0) {
        throw new RuntimeException(implode(' ', (array)$scan['severe']));
    }
    $proposed = fvplusThemeProfileUpdateLayer($workspace, truncateUtf8String(trim($profileId), 64), $scope, $variables, $customCss);
    return ['workspace' => $proposed, 'plan' => fvplusThemeWorkspaceBuildUpdatePlan($workspace, $proposed)];
}

function saveThemeWorkspaceProfileLayer(string $profileId, string $scope, $variables, string $customCss): array {
    $prepared = prepareThemeWorkspaceProfileLayer($profileId, $scope, $variables, $customCss);
    return ['workspace' => writeThemeWorkspace($prepared['workspace']), 'plan' => $prepared['plan']];
}
