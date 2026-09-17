<?php
function fvplusFolderView3SafeCssValue($value): string {
    $safe = truncateUtf8String(trim((string)$value), 200);
    if ($safe === '' || preg_match('/(?:expression\s*\(|javascript\s*:|@import\b|url\s*\()/i', $safe)) {
        return '';
    }
    return trim(str_replace([';', '{', '}', '<', '>', "\0"], '', $safe));
}

function fvplusFolderView3GroupStyles(array $bundle, array &$warnings): array {
    $groups = ['enabled' => []];
    foreach ((array)($bundle['custom_styles'] ?? []) as $path => $content) {
        $parts = explode('/', (string)$path);
        $name = array_pop($parts);
        if ($name === '.fv3-source') {
            $warnings[] = 'Theme source metadata was not converted into managed updates. Scan the original theme source to manage future updates.';
            continue;
        }
        if (preg_match('/^_fv3-generated\./i', $name)) {
            continue;
        }
        $scopes = [];
        foreach (['docker', 'vm', 'dashboard'] as $scope) {
            if (preg_match('/\..*' . $scope . '.*\.css$/i', $name)) {
                $scopes[] = $scope;
            }
        }
        if (count($scopes) === 0) {
            $warnings[] = 'Custom styles without a recognized FolderView3 page scope were excluded.';
            continue;
        }
        $group = 'enabled';
        foreach ($parts as $index => $part) {
            if (preg_match('/\.disabled$/i', $part)) {
                $group = implode('/', array_slice($parts, 0, $index + 1));
                break;
            }
        }
        $groups[$group][] = ['name' => $name, 'content' => $content, 'scopes' => $scopes];
    }
    if (count($groups) > 1) {
        $warnings[] = 'Disabled themes were preserved as separate inactive appearance profiles; they are not included in the main imported profile.';
    }
    return $groups;
}

function fvplusFolderView3BuildThemeProfile(array $bundle, array &$warnings, array $styles = [], int $disabledIndex = 0): array {
    $config = (array)($bundle['css_config'] ?? []);
    $profile = fvplusThemeProfileDefault(
        'folderview3-import-' . substr(hash('sha256', json_encode([$config, $styles, $disabledIndex], JSON_UNESCAPED_SLASHES)), 0, 12),
        $disabledIndex > 0 ? 'FolderView3 disabled appearance ' . $disabledIndex : 'FolderView3 imported appearance'
    );
    $pageValues = is_array($config['page_values'] ?? null) ? $config['page_values'] : [];
    foreach (['global', 'docker', 'vm', 'dashboard'] as $scope) {
        $variableSource = is_array($config[$scope] ?? null) ? $config[$scope] : [];
        if ($scope !== 'global' && is_array($pageValues[$scope] ?? null)) {
            $variableSource = array_merge($variableSource, $pageValues[$scope]);
        }
        $declarations = [];
        foreach ($variableSource as $name => $value) {
            $safeName = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$name);
            $safeValue = fvplusFolderView3SafeCssValue($value);
            if ($safeName !== '' && $safeValue !== '') {
                $declarations[] = '  --' . $safeName . ': ' . $safeValue . ';';
            }
        }
        $chunks = [];
        if (count($declarations) > 0) {
            $chunks[] = ":root {\n" . implode("\n", $declarations) . "\n}";
        }
        $customKey = $scope === 'global' ? 'custom_css' : 'custom_css_' . $scope;
        $customCss = trim((string)($config[$customKey] ?? ''));
        if ($customCss !== '') {
            $scan = fvplusThemeWorkspaceScanCss($customCss);
            if (count((array)($scan['severe'] ?? [])) > 0) {
                $warnings[] = 'Unsafe FolderView3 ' . $scope . ' custom CSS was excluded from the migration profile.';
            } else {
                $chunks[] = $customCss;
            }
        }
        foreach ($styles as $style) {
            if (!in_array($scope, $style['scopes'], true)) {
                continue;
            }
            $scan = fvplusThemeWorkspaceScanCss((string)$style['content']);
            if (count((array)($scan['severe'] ?? [])) > 0) {
                $warnings[] = 'A FolderView3 custom style was excluded because it failed the CSS safety scan.';
                continue;
            }
            $safeName = str_replace('*/', '* /', (string)$style['name']);
            $chunks[] = '/* FolderView3 custom style: ' . $safeName . " */\n" . (string)$style['content'];
        }
        $combined = trim(implode("\n\n", $chunks));
        if (strlen($combined) > FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES) {
            $combined = truncateUtf8String($combined, FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES);
            $warnings[] = 'FolderView3 ' . $scope . ' CSS was truncated to the FolderView Plus profile limit.';
        }
        $profile['layers'][$scope] = fvplusThemeProfileNormalizeLayer(['customCss' => $combined]);
    }
    return fvplusThemeProfileNormalize($profile);
}
