<?php
function getThemeWorkspacePath(): string {
        global $configDir;
        return "$configDir/theme-workspace.json";
    }

    function fvplusThemeWorkspaceGeneratedCssPath(string $type): string {
        global $configDir;
        $safeType = trim((string)$type);
        if (!in_array($safeType, ['docker', 'vm', 'dashboard'], true)) {
            throw new RuntimeException('Unsupported theme workspace asset type.');
        }
        return "$configDir/styles/fvplus-managed.theme.$safeType.css";
    }

    function defaultThemeWorkspace(): array {
        return [
            'schemaVersion' => FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION,
            'activeThemeId' => '',
            'themes' => [],
            'variables' => [],
            'customCss' => '',
            'lastCheckedAt' => ''
        ];
    }

    function fvplusThemeWorkspaceNormalizeSource(array $source): array {
        return [
            'input' => truncateUtf8String(trim((string)($source['input'] ?? '')), 512),
            'kind' => truncateUtf8String(trim((string)($source['kind'] ?? '')), 32),
            'owner' => truncateUtf8String(trim((string)($source['owner'] ?? '')), 128),
            'repo' => truncateUtf8String(trim((string)($source['repo'] ?? '')), 128),
            'branch' => truncateUtf8String(trim((string)($source['branch'] ?? '')), 128),
            'path' => truncateUtf8String(trim((string)($source['path'] ?? '')), 512),
            'defaultBranch' => truncateUtf8String(trim((string)($source['defaultBranch'] ?? '')), 128),
            'commitSha' => truncateUtf8String(trim((string)($source['commitSha'] ?? '')), 128),
            'canCheckUpdates' => !empty($source['canCheckUpdates']),
            'rawUrl' => truncateUtf8String(trim((string)($source['rawUrl'] ?? '')), 1024)
        ];
    }

    function fvplusThemeWorkspaceNormalizeColorValue($value): string {
        $safeValue = truncateUtf8String(trim((string)$value), 128);
        if ($safeValue === '') {
            return '';
        }
        if (preg_match('/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $safeValue)) {
            return $safeValue;
        }
        if (preg_match('/^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i', $safeValue)) {
            return $safeValue;
        }
        if (preg_match('/^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i', $safeValue)) {
            return $safeValue;
        }
        return '';
    }

    function fvplusThemeWorkspaceNormalizeVariableMap($value): array {
        $incoming = is_array($value) ? $value : [];
        $normalized = [];
        foreach ($incoming as $key => $rawValue) {
            $token = trim((string)$key);
            if ($token === '' || !preg_match('/^--[A-Za-z0-9._-]+$/', $token)) {
                continue;
            }
            $safeValue = fvplusThemeWorkspaceNormalizeColorValue($rawValue);
            if ($safeValue === '') {
                continue;
            }
            $normalized[$token] = $safeValue;
            if (count($normalized) >= 96) {
                break;
            }
        }
        ksort($normalized, SORT_STRING);
        return $normalized;
    }

    function fvplusThemeWorkspaceDetectTabsFromPath(string $path, int $fallbackCssCount = 0): array {
        $normalized = strtolower(trim($path));
        if ($normalized === '') {
            return [];
        }
        $tabs = [];
        foreach (['docker', 'vm', 'dashboard'] as $tab) {
            if (preg_match('/(^|[._\/-])' . preg_quote($tab, '/') . '([._\/-]|$)/', $normalized)) {
                $tabs[] = $tab;
            }
        }
        if (count($tabs) <= 0 && $fallbackCssCount === 1) {
            return ['docker', 'vm', 'dashboard'];
        }
        return array_values(array_unique($tabs));
    }

    function fvplusThemeWorkspaceNormalizeThemeFiles($value): array {
        $incoming = is_array($value) ? $value : [];
        $normalized = [];
        foreach ($incoming as $file) {
            if (!is_array($file)) {
                continue;
            }
            $content = (string)($file['content'] ?? '');
            if ($content === '' || strlen($content) > FVPLUS_THEME_WORKSPACE_MAX_FILE_BYTES) {
                continue;
            }
            $path = truncateUtf8String(trim((string)($file['path'] ?? $file['name'] ?? '')), 512);
            $tabsIncoming = is_array($file['tabs'] ?? null) ? $file['tabs'] : fvplusThemeWorkspaceDetectTabsFromPath($path, 1);
            $tabs = [];
            foreach ($tabsIncoming as $tab) {
                $safeTab = trim((string)$tab);
                if (in_array($safeTab, ['docker', 'vm', 'dashboard'], true) && !in_array($safeTab, $tabs, true)) {
                    $tabs[] = $safeTab;
                }
            }
            if (count($tabs) <= 0) {
                continue;
            }
            $normalized[] = [
                'name' => truncateUtf8String(trim((string)($file['name'] ?? basename($path))), 160),
                'path' => $path,
                'sourceUrl' => truncateUtf8String(trim((string)($file['sourceUrl'] ?? '')), 1024),
                'tabs' => array_values($tabs),
                'sha256' => hash('sha256', $content),
                'content' => $content
            ];
            if (count($normalized) >= FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME) {
                break;
            }
        }
        return $normalized;
    }

    function fvplusThemeWorkspaceNormalizeThemeRecord($value): array {
        $source = is_array($value) ? $value : [];
        $files = fvplusThemeWorkspaceNormalizeThemeFiles($source['files'] ?? []);
        $identity = trim((string)($source['id'] ?? ''));
        if ($identity === '') {
            $identity = substr(hash('sha256', json_encode([
                'source' => fvplusThemeWorkspaceNormalizeSource(is_array($source['source'] ?? null) ? $source['source'] : []),
                'name' => (string)($source['name'] ?? ''),
                'files' => array_map(static function(array $file): string {
                    return (string)($file['sha256'] ?? '');
                }, $files)
            ], JSON_UNESCAPED_SLASHES)), 0, 16);
        }
        $warnings = [];
        foreach ((array)($source['warnings'] ?? []) as $warning) {
            $safeWarning = truncateUtf8String(trim((string)$warning), 280);
            if ($safeWarning !== '' && !in_array($safeWarning, $warnings, true)) {
                $warnings[] = $safeWarning;
            }
        }
        return [
            'id' => truncateUtf8String($identity, 64),
            'name' => truncateUtf8String(trim((string)($source['name'] ?? '')), 160),
            'importedAt' => normalizeIsoTimestamp((string)($source['importedAt'] ?? '')) ?: gmdate('c'),
            'lastCheckedAt' => normalizeIsoTimestamp((string)($source['lastCheckedAt'] ?? '')),
            'updateAvailable' => !empty($source['updateAvailable']),
            'warnings' => $warnings,
            'source' => fvplusThemeWorkspaceNormalizeSource(is_array($source['source'] ?? null) ? $source['source'] : []),
            'files' => $files
        ];
    }

    function normalizeThemeWorkspacePayload($value): array {
        $incoming = is_array($value) ? $value : [];
        $themesIncoming = is_array($incoming['themes'] ?? null) ? $incoming['themes'] : [];
        $themes = [];
        $seenIds = [];
        foreach ($themesIncoming as $theme) {
            $normalizedTheme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
            $themeId = trim((string)($normalizedTheme['id'] ?? ''));
            if ($themeId === '' || isset($seenIds[$themeId])) {
                continue;
            }
            $seenIds[$themeId] = true;
            $themes[] = $normalizedTheme;
            if (count($themes) >= FVPLUS_THEME_WORKSPACE_MAX_THEMES) {
                break;
            }
        }
        $activeThemeId = truncateUtf8String(trim((string)($incoming['activeThemeId'] ?? '')), 64);
        if ($activeThemeId !== '' && !isset($seenIds[$activeThemeId])) {
            $activeThemeId = '';
        }
        return [
            'schemaVersion' => FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION,
            'activeThemeId' => $activeThemeId,
            'themes' => $themes,
            'variables' => fvplusThemeWorkspaceNormalizeVariableMap($incoming['variables'] ?? []),
            'customCss' => truncateUtf8String((string)($incoming['customCss'] ?? ''), FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES),
            'lastCheckedAt' => normalizeIsoTimestamp((string)($incoming['lastCheckedAt'] ?? ''))
        ];
    }

    function fvplusThemeWorkspaceBuildVariablesCss(array $variables): string {
        if (count($variables) <= 0) {
            return '';
        }
        $lines = [':root {'];
        foreach ($variables as $token => $value) {
            $lines[] = "  $token: $value;";
        }
        $lines[] = '}';
        return implode("\n", $lines);
    }

    function writeThemeWorkspaceManagedAssets(array $workspace): void {
        $normalized = normalizeThemeWorkspacePayload($workspace);
        $activeTheme = null;
        foreach ((array)($normalized['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === trim((string)($normalized['activeThemeId'] ?? ''))) {
                $activeTheme = $theme;
                break;
            }
        }
        $variablesCss = fvplusThemeWorkspaceBuildVariablesCss((array)($normalized['variables'] ?? []));
        $customCss = trim((string)($normalized['customCss'] ?? ''));
        foreach (['docker', 'vm', 'dashboard'] as $type) {
            $chunks = [
                '/* FolderView Plus generated Theme Workspace asset. Do not edit manually. */'
            ];
            if ($variablesCss !== '') {
                $chunks[] = $variablesCss;
            }
            if (is_array($activeTheme)) {
                foreach ((array)($activeTheme['files'] ?? []) as $file) {
                    $tabs = is_array($file['tabs'] ?? null) ? $file['tabs'] : [];
                    if (!in_array($type, $tabs, true)) {
                        continue;
                    }
                    $content = (string)($file['content'] ?? '');
                    $contentScan = fvplusThemeWorkspaceScanCss($content);
                    if (count((array)($contentScan['severe'] ?? [])) > 0) {
                        continue;
                    }
                    $fileName = trim((string)($file['name'] ?? $file['path'] ?? 'theme.css'));
                    $chunks[] = "/* Imported theme: $fileName */\n" . $content;
                }
            }
            if ($customCss !== '') {
                $customScan = fvplusThemeWorkspaceScanCss($customCss);
                if (count((array)($customScan['severe'] ?? [])) === 0) {
                    $chunks[] = "/* Theme Workspace custom CSS */\n" . $customCss;
                }
            }
            $output = trim(implode("\n\n", array_filter($chunks, static function($chunk): bool {
                return trim((string)$chunk) !== '';
            })));
            $path = fvplusThemeWorkspaceGeneratedCssPath($type);
            if ($output === '' || $output === '/* FolderView Plus generated Theme Workspace asset. Do not edit manually. */') {
                if (file_exists($path)) {
                    @unlink($path);
                }
                continue;
            }
            writeJsonObjectAtomic(dirname($path) . '/.theme-workspace.touch', ['updatedAt' => gmdate('c')]);
            @unlink(dirname($path) . '/.theme-workspace.touch');
            $parent = dirname($path);
            if (!is_dir($parent)) {
                @mkdir($parent, 0770, true);
            }
            writeDurableFileAtomic($path, $output . "\n");
        }
    }

    function writeThemeWorkspace(array $workspace): array {
        $normalized = normalizeThemeWorkspacePayload($workspace);
        writeJsonObjectWithLastGood(getThemeWorkspacePath(), $normalized);
        writeThemeWorkspaceManagedAssets($normalized);
        return $normalized;
    }

    function ensureThemeWorkspaceManagedAssets(): array {
        $workspace = normalizeThemeWorkspacePayload(readJsonObjectFile(getThemeWorkspacePath()) ?? defaultThemeWorkspace());
        writeThemeWorkspaceManagedAssets($workspace);
        return $workspace;
    }

    function readThemeWorkspace(): array {
        $path = getThemeWorkspacePath();
        if (!file_exists($path)) {
            return writeThemeWorkspace(defaultThemeWorkspace());
        }
        $decoded = readJsonObjectFile($path);
        $recoveredFromLastGood = false;
        if (!is_array($decoded)) {
            $decoded = recoverJsonObjectFromLastGood($path);
            $recoveredFromLastGood = is_array($decoded);
        }
        if (!is_array($decoded)) {
            $decoded = defaultThemeWorkspace();
        }
        $normalized = normalizeThemeWorkspacePayload($decoded);
        if ($recoveredFromLastGood || jsonObjectsDiffer($decoded, $normalized)) {
            return writeThemeWorkspace($normalized);
        }
        writeThemeWorkspaceManagedAssets($normalized);
        return $normalized;
    }
