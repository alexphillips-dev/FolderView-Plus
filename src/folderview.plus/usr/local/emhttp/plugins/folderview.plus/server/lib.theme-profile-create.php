<?php
function createThemeWorkspaceProfile(string $name, string $sourceProfileId = '', string $scope = 'global', $variables = [], string $customCss = ''): array {
    $safeName = truncateUtf8String(trim($name), 96);
    $sourceProfileId = truncateUtf8String(trim($sourceProfileId), 64);
    if ($safeName === '') {
        throw new RuntimeException('Appearance profile name is required.');
    }
    return withConfigMutationLock(static function () use ($safeName, $sourceProfileId, $scope, $variables, $customCss): array {
        $workspace = readThemeWorkspace(false);
        if (count($workspace['profiles']) >= 32) {
            throw new RuntimeException('The appearance profile limit has been reached. Remove an unused profile first.');
        }
        $id = 'profile-' . generateId(12);
        $profile = fvplusThemeProfileDefault($id, $safeName);
        if ($sourceProfileId !== '') {
            $prepared = prepareThemeWorkspaceProfileLayer($sourceProfileId, $scope, $variables, $customCss, $workspace);
            $profile['layers'] = array_column($prepared['workspace']['profiles'], 'layers', 'id')[$sourceProfileId];
        }
        $workspace['profiles'][] = $profile;
        $workspace['activeProfileId'] = $id;
        return writeThemeWorkspace($workspace);
    });
}
