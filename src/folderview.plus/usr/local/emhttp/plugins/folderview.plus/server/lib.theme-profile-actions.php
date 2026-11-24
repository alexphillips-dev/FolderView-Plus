<?php
require_once __DIR__ . '/lib.theme-profile-create.php';

function activateThemeWorkspaceProfile(string $profileId): array {
    return withConfigMutationLock(static function () use ($profileId): array {
        $workspace = readThemeWorkspace(false);
        $safeId = truncateUtf8String(trim($profileId), 64);
        if (!in_array($safeId, array_column($workspace['profiles'], 'id'), true)) {
            throw new RuntimeException('Appearance profile not found.');
        }
        $workspace['activeProfileId'] = $safeId;
        return writeThemeWorkspace($workspace);
    });
}

function deleteThemeWorkspaceProfile(string $profileId): array {
    return withConfigMutationLock(static function () use ($profileId): array {
        $workspace = readThemeWorkspace(false);
        if (count($workspace['profiles']) <= 1) {
            throw new RuntimeException('The final appearance profile cannot be deleted.');
        }
        $safeId = truncateUtf8String(trim($profileId), 64);
        $profiles = array_values(array_filter($workspace['profiles'], static fn(array $profile): bool => $profile['id'] !== $safeId));
        if (count($profiles) === count($workspace['profiles'])) {
            throw new RuntimeException('Appearance profile not found.');
        }
        $workspace['profiles'] = $profiles;
        if ($workspace['activeProfileId'] === $safeId) {
            $workspace['activeProfileId'] = $profiles[0]['id'];
        }
        return writeThemeWorkspace($workspace);
    });
}

function prepareThemeWorkspaceProfileLayer(string $profileId, string $scope, $variables, string $customCss, ?array $workspace = null): array {
    $workspace ??= readThemeWorkspace(false);
    $scan = fvplusThemeWorkspaceScanCss($customCss);
    if (count((array)($scan['severe'] ?? [])) > 0) {
        throw new RuntimeException(implode(' ', (array)$scan['severe']));
    }
    $proposed = fvplusThemeProfileUpdateLayer($workspace, truncateUtf8String(trim($profileId), 64), $scope, $variables, $customCss);
    return ['workspace' => $proposed, 'plan' => fvplusThemeWorkspaceBuildUpdatePlan($workspace, $proposed)];
}

function saveThemeWorkspaceProfileLayer(string $profileId, string $scope, $variables, string $customCss): array {
    return withConfigMutationLock(static function () use ($profileId, $scope, $variables, $customCss): array {
        $prepared = prepareThemeWorkspaceProfileLayer($profileId, $scope, $variables, $customCss);
        return ['workspace' => writeThemeWorkspace($prepared['workspace']), 'plan' => $prepared['plan']];
    });
}
