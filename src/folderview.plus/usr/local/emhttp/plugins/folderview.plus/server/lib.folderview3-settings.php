<?php
const FVPLUS_FOLDER_VIEW3_NUMERIC_DEFAULTS = ['preview' => [1, 0, 4], 'context' => [1, 0, 3], 'context_trigger' => [0, 0, 1], 'context_graph' => [1, 0, 4], 'context_graph_time' => [60, 5, 600]];
function fvplusFolderView3VerifyPreviewUnderLock(array $bundle, string $sourceName, string $expected): void {
    $fresh = ($bundle['_source_kind'] ?? '') === 'installed' ? fvplusFolderView3ReadInstalledBundle() : $bundle;
    if (!hash_equals($expected, buildFolderView3MigrationPlan($fresh, $sourceName)['source']['digest'])) {
        throw new RuntimeException('FolderView3 source or current configuration changed after preview. Preview it again before applying.');
    }
}
function fvplusFolderView3Overflow($value): string {
    $aliases = ['0' => 'default', 'default' => 'default', '1' => 'expand_row', 'expand' => 'expand_row', 'expand_row' => 'expand_row', '2' => 'scroll', 'scroll' => 'scroll'];
    $key = (string)$value;
    if (!isset($aliases[$key])) throw new RuntimeException('Unsupported FolderView3 overflow setting.');
    return $aliases[$key];
}

function fvplusFolderView3DefaultSettings(array $settings): array {
    $result = [];
    $booleanFields = ['preview_hover', 'preview_grayscale', 'preview_webui', 'preview_logs', 'preview_console', 'preview_update', 'preview_vertical_bars', 'preview_border', 'update_column'];
    foreach ($booleanFields as $field) $result[$field] = ($settings['default_' . $field] ?? 'no') === 'yes';
    foreach (FVPLUS_FOLDER_VIEW3_NUMERIC_DEFAULTS as $field => $bounds) {
        $value = $settings['default_' . $field] ?? $bounds[0];
        if (!is_numeric($value) || floor((float)$value) !== (float)$value || (float)$value < $bounds[1] || (float)$value > $bounds[2]) throw new RuntimeException('Unsupported FolderView3 default context or preview value.');
        $result[$field] = (int)$value;
    }
    $result['preview_status'] = (string)($settings['default_preview_status'] ?? 'none');
    $result['preview_row_separator'] = ($settings['default_row_separator'] ?? 'no') === 'yes';
    $result['folder_update_highlight'] = ($settings['default_preview_update_folder'] ?? 'no') === 'yes';
    foreach (['vertical_bars_color' => 'preview_vertical_bars_color', 'border_color' => 'preview_border_color', 'separator_color' => 'preview_row_separator_color', 'preview_text_width' => 'preview_text_width'] as $source => $field) {
        $result[$field] = (string)($settings['default_' . $source] ?? '');
    }
    $result['preview_overflow'] = fvplusFolderView3Overflow($settings['default_overflow'] ?? 'default');
    if ($result['preview_row_separator_color'] !== '' && !preg_match('/^#[0-9a-f]{6}$/i', $result['preview_row_separator_color'])) throw new RuntimeException('FolderView3 separator color is unsupported. Use a six-digit hexadecimal color before importing.');
    return $result;
}

function fvplusFolderView3FolderSettings(array $incoming, array $defaults, array &$warnings): array {
    $settings = $incoming;
    foreach ($defaults as $key => $value) {
        $legacyKey = $key === 'folder_update_highlight' ? 'preview_update_folder' : $key;
        if (!array_key_exists($legacyKey, $settings) || $settings[$legacyKey] === null || $settings[$legacyKey] === '') $settings[$legacyKey] = $value;
        if (is_bool($value)) {
            if (!in_array($settings[$legacyKey], [true, false, 0, 1, '0', '1', 'true', 'false', 'yes', 'no'], true)) throw new RuntimeException('FolderView3 folder boolean setting is invalid.');
            $settings[$legacyKey] = normalizeBool($settings[$legacyKey]);
        }
    }
    foreach (FVPLUS_FOLDER_VIEW3_NUMERIC_DEFAULTS as $field => $bounds) {
        $value = $settings[$field];
        if (!is_numeric($value) || floor((float)$value) !== (float)$value || (float)$value < $bounds[1] || (float)$value > $bounds[2]) throw new RuntimeException('Unsupported FolderView3 default context or preview value.');
        $settings[$field] = (int)$value;
    }
    if (!in_array($settings['preview_status'], ['none', 'symbol', 'grayscale'], true)) throw new RuntimeException('Unsupported FolderView3 preview status.');
    $settings['preview_overflow'] = fvplusFolderView3Overflow($settings['preview_overflow']);
    $settings['folder_update_highlight'] = normalizeBool($settings['preview_update_folder'], false);
    unset($settings['preview_update_folder']);
    if (array_key_exists('lock_colors', $settings)) {
        $warnings[] = 'Legacy color locking has no equivalent in FolderView Plus. Explicit colors are retained; review their appearance.';
        unset($settings['lock_colors']);
    }
    unset($settings['use_global_defaults']);
    // The normal folder contract accepts six-digit separator colors only.
    if (($settings['preview_row_separator_color'] ?? '') === '') $settings['preview_row_separator_color'] = '#afa89e';
    if (!preg_match('/^#[0-9a-f]{6}$/i', $settings['preview_row_separator_color'])) throw new RuntimeException('FolderView3 separator color is unsupported. Use a six-digit hexadecimal color before importing.');
    return $settings;
}

function fvplusFolderView3SettingsWarnings(array $settings, array &$warnings): array {
    $unsupported = array_intersect(array_keys($settings), ['dashboard_animation', 'dashboard_update_container', 'dashboard_update_folder']);
    foreach ($unsupported as $key) $warnings[] = 'Unsupported legacy setting: ' . $key . '. It is not applied; retain the original export for recovery.';
    if (isset($settings['dashboard_context']) && in_array((string)$settings['dashboard_context'], ['0', '3'], true)) {
        $warnings[] = 'Legacy Dashboard disabled-context and direct-WebUI modes have no exact equivalent. The native context behavior will be used.';
    }
    $defaults = fvplusFolderView3DefaultSettings($settings);
    $known = ['dashboard_context', 'dashboard_context_trigger', 'dashboard_context_graph', 'dashboard_context_graph_time'];
    foreach (['docker', 'vm'] as $type) foreach (['layout', 'expand_toggle', 'greyscale', 'folder_label'] as $suffix) $known[] = 'dashboard_' . $type . '_' . $suffix;
    foreach (array_keys($defaults) as $field) $known[] = 'default_' . ($field === 'folder_update_highlight' ? 'preview_update_folder' : $field);
    $known = array_merge($known, ['default_overflow', 'default_row_separator', 'default_vertical_bars_color', 'default_border_color', 'default_separator_color']);
    foreach (array_diff(array_keys($settings), $known, $unsupported) as $key) $warnings[] = 'Unsupported legacy setting: ' . preg_replace('/[^A-Za-z0-9_.-]/', '', (string)$key) . '. It is not applied; retain the original export for recovery.';
    return ['converted' => count(array_intersect(array_keys($settings), $known)), 'unsupported' => count(array_diff(array_keys($settings), $known))];
}

function fvplusFolderView3InspectWorkspace(): array {
    $path = getThemeWorkspacePath();
    $decoded = readJsonObjectFile($path);
    if ($decoded === null && file_exists($path)) {
        $decoded = readJsonObjectFile(getLastGoodJsonPath($path));
        if ($decoded === null) throw new RuntimeException('Theme Workspace is corrupt and has no valid recovery copy. Restore it in Recovery before migrating.');
    }
    return normalizeThemeWorkspacePayload($decoded ?? defaultThemeWorkspace());
}

function fvplusFolderView3PreviewDigest(array $source): string {
    unset($source['exported']);
    $destination = [];
    foreach (fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths([fvplusEnvironmentDockerAutostartPath()])) as $entry) {
        $destination[] = [$entry['exists'], $entry['content']];
    }
    return hash('sha256', json_encode([$source, $destination], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
}
