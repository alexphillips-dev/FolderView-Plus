<?php
function createThemeWorkspaceProfile(string $name, string $sourceProfileId = '', string $scope = 'global', $variables = [], string $customCss = ''): array {
    $workspace = readThemeWorkspace();
    $safeName = truncateUtf8String(trim($name), 96);
    $sourceProfileId = truncateUtf8String(trim($sourceProfileId), 64);
    if ($safeName === '') {
        throw new RuntimeException('Appearance profile name is required.');
    }
    $id = 'profile-' . generateId(12);
    if (count($workspace['profiles']) >= 32) {
        throw new RuntimeException('The appearance profile limit has been reached. Remove an unused profile first.');
    }
    $profile = fvplusThemeProfileDefault($id, $safeName);
    if ($sourceProfileId !== '') {
        $prepared = prepareThemeWorkspaceProfileLayer($sourceProfileId, $scope, $variables, $customCss);
        foreach ($prepared['workspace']['profiles'] as $sourceProfile) {
            if ($sourceProfile['id'] === $sourceProfileId) {
                $profile['layers'] = $sourceProfile['layers'];
                break;
            }
        }
    }
    $workspace['profiles'][] = $profile;
    $workspace['activeProfileId'] = $id;
    return writeThemeWorkspace($workspace);
}
