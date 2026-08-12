<?php
function prepareThemeWorkspaceThemeUpdates($themeIds): array {
    $workspace = readThemeWorkspace();
    $ids = array_values(array_unique(array_filter(array_map(static fn($value): string => truncateUtf8String(trim((string)$value), 64), is_array($themeIds) ? $themeIds : []))));
    if (count($ids) <= 0 || count($ids) > FVPLUS_THEME_WORKSPACE_MAX_THEMES) {
        throw new RuntimeException('Select one or more managed themes to update.');
    }
    $selected = [];
    foreach ((array)$workspace['themes'] as $theme) {
        $theme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
        if (!in_array((string)$theme['id'], $ids, true)) {
            continue;
        }
        if (trim((string)($theme['source']['input'] ?? '')) === '') {
            throw new RuntimeException('A selected theme does not have a saved GitHub source.');
        }
        $selected[] = ['id' => (string)$theme['id'], 'name' => (string)$theme['name']];
    }
    if (count($selected) !== count($ids)) {
        throw new RuntimeException('One or more selected themes no longer exist.');
    }
    return ['themeIds' => $ids, 'themes' => $selected, 'updateCount' => count($selected), 'atomic' => true];
}

function updateThemeWorkspaceThemes($themeIds): array {
    $plan = prepareThemeWorkspaceThemeUpdates($themeIds);
    $workspace = readThemeWorkspace();
    $selected = array_fill_keys($plan['themeIds'], true);
    $themes = [];
    foreach ((array)$workspace['themes'] as $theme) {
        $normalized = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
        $id = (string)$normalized['id'];
        if (!isset($selected[$id])) {
            $themes[] = $normalized;
            continue;
        }
        $imported = fvplusImportGithubThemeFiles((string)$normalized['source']['input']);
        $replacement = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
        $replacement['id'] = $id;
        $replacement['importedAt'] = (string)$normalized['importedAt'];
        $replacement['lastCheckedAt'] = gmdate('c');
        $replacement['updateAvailable'] = false;
        $themes[] = fvplusThemeWorkspaceNormalizeThemeRecord($replacement);
    }
    $workspace['themes'] = $themes;
    $workspace['lastCheckedAt'] = gmdate('c');
    return ['workspace' => writeThemeWorkspace($workspace), 'plan' => $plan];
}
