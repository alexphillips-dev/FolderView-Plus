<?php
function prepareThemeWorkspaceThemeUpdates($themeIds, ?array $workspace = null): array {
    $workspace = $workspace ?? readThemeWorkspace(false);
    $ids = array_values(array_unique(array_filter(array_map(static fn($value): string => truncateUtf8String(trim((string)$value), 64), is_array($themeIds) ? $themeIds : []))));
    if (count($ids) <= 0 || count($ids) > FVPLUS_THEME_WORKSPACE_MAX_THEMES) {
        throw new RuntimeException('Select one or more managed themes to update.');
    }
    $selected = [];
    foreach ((array)$workspace['themes'] as $theme) {
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
    $before = $workspace = readThemeWorkspace(false);
    $plan = prepareThemeWorkspaceThemeUpdates($themeIds, $workspace);
    $selected = array_fill_keys($plan['themeIds'], true);
    $checkedAt = gmdate('c');
    $workspace['themes'] = array_map(static function (array $theme) use ($selected, $checkedAt): array {
        $id = $theme['id'];
        if (!isset($selected[$id])) {
            return $theme;
        }
        $imported = fvplusImportGithubThemeFiles($theme['source']['input']);
        $replacement = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
        return array_replace($replacement, ['id' => $id, 'importedAt' => $theme['importedAt'], 'lastCheckedAt' => $checkedAt]);
    }, $workspace['themes']);
    $workspace['lastCheckedAt'] = $checkedAt;
    return ['workspace' => fvplusThemeWorkspaceWriteGithubChange($before, $workspace), 'plan' => $plan];
}

function updateThemeWorkspaceTheme(string $themeId): array {
    $safeThemeId = truncateUtf8String(trim($themeId), 64);
    if ($safeThemeId === '') {
        throw new RuntimeException('Theme is required.');
    }
    return updateThemeWorkspaceThemes([$safeThemeId])['workspace'];
}
