<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = (string)($_REQUEST['action'] ?? 'read');
    $mutatingActions = ['import_github', 'activate', 'deactivate', 'delete', 'save_customize', 'check_updates', 'update_theme', 'update_themes', 'create_profile', 'activate_profile', 'delete_profile', 'save_profile'];
    if (in_array($action, $mutatingActions, true)) {
        requireMutationRequestGuard();
    }

    if ($action === 'read') {
        return [
            'workspace' => readThemeWorkspace()
        ];
    }

    if ($action === 'import_github') {
        $source = (string)($_POST['source'] ?? '');
        return importThemeWorkspaceGithub($source);
    }

    if ($action === 'scan_github') {
        $source = (string)($_POST['source'] ?? $_REQUEST['source'] ?? '');
        return scanThemeWorkspaceGithub($source);
    }

    if ($action === 'activate') {
        $themeId = (string)($_POST['themeId'] ?? '');
        return [
            'workspace' => activateThemeWorkspaceTheme($themeId)
        ];
    }

    if ($action === 'deactivate') {
        return [
            'workspace' => deactivateThemeWorkspaceTheme()
        ];
    }

    if ($action === 'delete') {
        $themeId = (string)($_POST['themeId'] ?? '');
        return [
            'workspace' => deleteThemeWorkspaceTheme($themeId)
        ];
    }

    if ($action === 'save_customize') {
        $variablesRaw = $_POST['variables'] ?? '{}';
        $variables = is_string($variablesRaw) ? json_decode($variablesRaw, true) : $variablesRaw;
        if (!is_array($variables)) {
            throw new RuntimeException('Invalid theme variable payload.');
        }
        $customCss = (string)($_POST['customCss'] ?? '');
        return [
            'workspace' => saveThemeWorkspaceCustomize($variables, $customCss)
        ];
    }

    if ($action === 'create_profile') {
        return ['workspace' => createThemeWorkspaceProfile((string)($_POST['name'] ?? ''))];
    }

    if ($action === 'activate_profile') {
        return ['workspace' => activateThemeWorkspaceProfile((string)($_POST['profileId'] ?? ''))];
    }

    if ($action === 'delete_profile') {
        return ['workspace' => deleteThemeWorkspaceProfile((string)($_POST['profileId'] ?? ''))];
    }

    if ($action === 'preview_profile' || $action === 'save_profile') {
        $variablesRaw = $_POST['variables'] ?? '{}';
        $variables = is_string($variablesRaw) ? json_decode($variablesRaw, true) : $variablesRaw;
        if (!is_array($variables)) {
            throw new RuntimeException('Invalid theme variable payload.');
        }
        $profileId = (string)($_POST['profileId'] ?? '');
        $scope = (string)($_POST['scope'] ?? 'global');
        $customCss = (string)($_POST['customCss'] ?? '');
        $result = $action === 'save_profile'
            ? saveThemeWorkspaceProfileLayer($profileId, $scope, $variables, $customCss)
            : prepareThemeWorkspaceProfileLayer($profileId, $scope, $variables, $customCss);
        return $result;
    }

    if ($action === 'check_updates') {
        return checkThemeWorkspaceUpdates();
    }

    if ($action === 'update_theme') {
        $themeId = (string)($_POST['themeId'] ?? '');
        return [
            'workspace' => updateThemeWorkspaceTheme($themeId)
        ];
    }

    if ($action === 'preview_theme_updates' || $action === 'update_themes') {
        $themeIdsRaw = $_POST['themeIds'] ?? '[]';
        $themeIds = is_string($themeIdsRaw) ? json_decode($themeIdsRaw, true) : $themeIdsRaw;
        if (!is_array($themeIds)) {
            throw new RuntimeException('Invalid managed theme selection.');
        }
        return $action === 'update_themes' ? updateThemeWorkspaceThemes($themeIds) : ['plan' => prepareThemeWorkspaceThemeUpdates($themeIds)];
    }

    throw new RuntimeException('Unsupported theme workspace action.');
});
