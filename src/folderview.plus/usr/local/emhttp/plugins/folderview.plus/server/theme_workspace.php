<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = (string)($_REQUEST['action'] ?? 'read');
    $mutatingActions = ['import_github', 'activate', 'deactivate', 'delete', 'save_customize', 'check_updates'];
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

    if ($action === 'check_updates') {
        return checkThemeWorkspaceUpdates();
    }

    throw new RuntimeException('Unsupported theme workspace action.');
});
