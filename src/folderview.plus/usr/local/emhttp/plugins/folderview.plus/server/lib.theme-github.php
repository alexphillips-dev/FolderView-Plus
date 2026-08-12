<?php
function fvplusThemeWorkspaceScanCss(string $css): array {
        $severe = [];
        $rules = [
            ['pattern' => '/expression\s*\(/i', 'message' => 'CSS contains expression().'],
            ['pattern' => '/javascript\s*:/i', 'message' => 'CSS contains javascript: URLs.'],
            ['pattern' => '/behavior\s*:/i', 'message' => 'CSS contains behavior: rules.'],
            ['pattern' => '/-moz-binding\s*:/i', 'message' => 'CSS contains legacy executable binding rules.'],
            ['pattern' => '/@import\b/i', 'message' => 'CSS contains @import, which is not permitted in managed themes.'],
            ['pattern' => '/url\s*\(\s*["\']?(?:https?:)?\/\//i', 'message' => 'CSS contains an external network URL.'],
            ['pattern' => '/url\s*\(\s*["\']?data:text\/html/i', 'message' => 'CSS contains a data:text/html URL.']
        ];
        foreach ($rules as $rule) {
            if (preg_match($rule['pattern'], $css)) {
                $severe[] = $rule['message'];
            }
        }
        return [
            'warnings' => [],
            'severe' => array_values(array_unique($severe))
        ];
    }

    function fvplusThemeWorkspaceFetchText(string $url, int $timeoutSeconds = 10): array {
        $requestUrl = trim($url);
        if ($requestUrl === '') {
            return ['ok' => false, 'error' => 'Empty URL.', 'content' => '', 'status' => ''];
        }
        $host = strtolower((string)(@parse_url($requestUrl, PHP_URL_HOST) ?: ''));
        $maxBytes = $host === 'api.github.com'
            ? 2 * 1024 * 1024
            : FVPLUS_THEME_WORKSPACE_MAX_FILE_BYTES;
        return fvplusFetchRemoteTextBounded(
            $requestUrl,
            ['github.com', 'raw.githubusercontent.com', 'api.github.com'],
            $maxBytes,
            $timeoutSeconds,
            3
        );
    }

    function fvplusThemeWorkspaceFetchJson(string $url, int $timeoutSeconds = 10): array {
        $response = fvplusThemeWorkspaceFetchText($url, $timeoutSeconds);
        if (!$response['ok']) {
            return $response + ['json' => null];
        }
        $decoded = json_decode((string)($response['content'] ?? ''), true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'Remote response was not valid JSON.', 'content' => (string)($response['content'] ?? ''), 'status' => (string)($response['status'] ?? ''), 'json' => null];
        }
        $response['json'] = $decoded;
        return $response;
    }

    function fvplusParseGithubThemeSourceInput(string $input): array {
        $raw = trim($input);
        if ($raw === '') {
            throw new RuntimeException('Theme source is required.');
        }
        if (preg_match('#^https?://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+?\.css)$#i', $raw, $match)) {
            return [
                'kind' => 'github_file',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => $match[3],
                'path' => $match[4],
                'rawUrl' => $raw
            ];
        }
        if (preg_match('#^https?://github\.com/([^/]+)/([^/]+)/(blob|raw)/([^/]+)/(.+?\.css)$#i', $raw, $match)) {
            return [
                'kind' => 'github_file',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => $match[4],
                'path' => $match[5],
                'rawUrl' => 'https://raw.githubusercontent.com/' . $match[1] . '/' . $match[2] . '/' . $match[4] . '/' . $match[5]
            ];
        }
        if (preg_match('#^https?://github\.com/([^/]+)/([^/]+)(?:/tree/([^/]+)(?:/(.+))?)?$#i', $raw, $match)) {
            return [
                'kind' => 'github_repo',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => trim((string)($match[3] ?? '')),
                'path' => trim((string)($match[4] ?? '')),
                'rawUrl' => ''
            ];
        }
        if (preg_match('#^([^/\s]+)/([^/\s]+)(?:/tree/([^/\s]+)(?:/(.+))?)?$#', $raw, $match)) {
            return [
                'kind' => 'github_repo',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => trim((string)($match[3] ?? '')),
                'path' => trim((string)($match[4] ?? '')),
                'rawUrl' => ''
            ];
        }
        throw new RuntimeException('Unsupported GitHub theme source format.');
    }

    function fvplusResolveGithubThemeRepoMeta(string $owner, string $repo): array {
        $apiUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo);
        $response = fvplusThemeWorkspaceFetchJson($apiUrl, 10);
        if (!$response['ok']) {
            throw new RuntimeException('Failed to read GitHub repository metadata.');
        }
        $json = is_array($response['json'] ?? null) ? $response['json'] : [];
        return [
            'defaultBranch' => trim((string)($json['default_branch'] ?? 'main'))
        ];
    }

    function fvplusResolveGithubBranchHeadSha(string $owner, string $repo, string $branch): string {
        $apiUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/branches/' . rawurlencode($branch);
        $response = fvplusThemeWorkspaceFetchJson($apiUrl, 10);
        if (!$response['ok']) {
            return '';
        }
        return trim((string)($response['json']['commit']['sha'] ?? ''));
    }

    function fvplusImportGithubThemeFiles(string $sourceInput): array {
        $parsed = fvplusParseGithubThemeSourceInput($sourceInput);
        $owner = trim((string)($parsed['owner'] ?? ''));
        $repo = trim((string)($parsed['repo'] ?? ''));
        $branch = trim((string)($parsed['branch'] ?? ''));
        $pathPrefix = ltrim(trim((string)($parsed['path'] ?? '')), '/');
        if ($owner === '' || $repo === '') {
            throw new RuntimeException('Theme source is missing repository information.');
        }
        $repoMeta = fvplusResolveGithubThemeRepoMeta($owner, $repo);
        if ($branch === '') {
            $branch = trim((string)($repoMeta['defaultBranch'] ?? 'main')) ?: 'main';
        }
        $commitSha = fvplusResolveGithubBranchHeadSha($owner, $repo, $branch);
        $warnings = [];
        $files = [];
        if (($parsed['kind'] ?? '') === 'github_file') {
            $filePath = $pathPrefix;
            $rawUrl = trim((string)($parsed['rawUrl'] ?? ''));
            $fileResponse = fvplusThemeWorkspaceFetchText($rawUrl, 10);
            if (!$fileResponse['ok']) {
                throw new RuntimeException('Failed to fetch GitHub CSS file.');
            }
            $scan = fvplusThemeWorkspaceScanCss((string)$fileResponse['content']);
            if (count($scan['severe']) > 0) {
                throw new RuntimeException(implode(' ', $scan['severe']));
            }
            $warnings = array_values(array_unique(array_merge($warnings, (array)$scan['warnings'])));
            $files[] = [
                'name' => basename($filePath),
                'path' => $filePath,
                'sourceUrl' => $rawUrl,
                'tabs' => fvplusThemeWorkspaceDetectTabsFromPath($filePath, 1),
                'content' => (string)$fileResponse['content']
            ];
        } else {
            $treeUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/git/trees/' . rawurlencode($branch) . '?recursive=1';
            $treeResponse = fvplusThemeWorkspaceFetchJson($treeUrl, 12);
            if (!$treeResponse['ok']) {
                throw new RuntimeException('Failed to read GitHub repository tree.');
            }
            $tree = is_array($treeResponse['json']['tree'] ?? null) ? $treeResponse['json']['tree'] : [];
            $cssCandidates = [];
            foreach ($tree as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                if (trim((string)($entry['type'] ?? '')) !== 'blob') {
                    continue;
                }
                $entryPath = ltrim(trim((string)($entry['path'] ?? '')), '/');
                if ($entryPath === '' || !preg_match('/\.css$/i', $entryPath)) {
                    continue;
                }
                if ($pathPrefix !== '' && strpos(strtolower($entryPath), strtolower($pathPrefix)) !== 0) {
                    continue;
                }
                if (preg_match('#(^|/)(node_modules|vendor|dist|build|coverage|\.git)/#i', $entryPath)) {
                    continue;
                }
                $cssCandidates[] = $entryPath;
            }
            if (count($cssCandidates) <= 0) {
                throw new RuntimeException('No CSS theme files were found in the selected GitHub repository.');
            }
            $fallbackCssCount = count($cssCandidates);
            foreach ($cssCandidates as $entryPath) {
                $tabs = fvplusThemeWorkspaceDetectTabsFromPath($entryPath, $fallbackCssCount);
                if (count($tabs) <= 0) {
                    continue;
                }
                $rawUrl = 'https://raw.githubusercontent.com/' . $owner . '/' . $repo . '/' . $branch . '/' . $entryPath;
                $fileResponse = fvplusThemeWorkspaceFetchText($rawUrl, 10);
                if (!$fileResponse['ok']) {
                    continue;
                }
                $scan = fvplusThemeWorkspaceScanCss((string)$fileResponse['content']);
                if (count($scan['severe']) > 0) {
                    throw new RuntimeException(implode(' ', $scan['severe']));
                }
                $warnings = array_values(array_unique(array_merge($warnings, (array)$scan['warnings'])));
                $files[] = [
                    'name' => basename($entryPath),
                    'path' => $entryPath,
                    'sourceUrl' => $rawUrl,
                    'tabs' => $tabs,
                    'content' => (string)$fileResponse['content']
                ];
                if (count($files) >= FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME) {
                    break;
                }
            }
            if (count($files) <= 0) {
                throw new RuntimeException('No compatible Docker, VM, or Dashboard CSS files were found.');
            }
        }
        return [
            'name' => $owner . '/' . $repo,
            'warnings' => $warnings,
            'files' => $files,
            'source' => [
                'input' => $sourceInput,
                'kind' => (string)($parsed['kind'] ?? 'github_repo'),
                'owner' => $owner,
                'repo' => $repo,
                'branch' => $branch,
                'path' => $pathPrefix,
                'defaultBranch' => trim((string)($repoMeta['defaultBranch'] ?? 'main')),
                'commitSha' => $commitSha,
                'canCheckUpdates' => true,
                'rawUrl' => trim((string)($parsed['rawUrl'] ?? ''))
            ]
        ];
    }

    function fvplusThemeWorkspaceBuildThemeRecordFromImport(array $imported): array {
        $source = is_array($imported['source'] ?? null) ? $imported['source'] : [];
        $identity = strtolower(trim((string)($source['owner'] ?? ''))) . '|' . strtolower(trim((string)($source['repo'] ?? ''))) . '|' . trim((string)($source['branch'] ?? '')) . '|' . trim((string)($source['path'] ?? ''));
        $themeId = substr(hash('sha256', $identity), 0, 16);
        return fvplusThemeWorkspaceNormalizeThemeRecord([
            'id' => $themeId,
            'name' => (string)($imported['name'] ?? $themeId),
            'importedAt' => gmdate('c'),
            'lastCheckedAt' => '',
            'updateAvailable' => false,
            'warnings' => $imported['warnings'] ?? [],
            'source' => $source,
            'files' => $imported['files'] ?? []
        ]);
    }

    function scanThemeWorkspaceGithub(string $sourceInput): array {
        $workspace = readThemeWorkspace();
        $imported = fvplusImportGithubThemeFiles($sourceInput);
        $themeRecord = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
        $themeId = trim((string)($themeRecord['id'] ?? ''));
        $exists = false;
        foreach ((array)($workspace['themes'] ?? []) as $existingTheme) {
            if (trim((string)($existingTheme['id'] ?? '')) === $themeId) {
                $exists = true;
                break;
            }
        }
        return [
            'theme' => $themeRecord,
            'exists' => $exists,
            'fileCount' => count((array)($themeRecord['files'] ?? [])),
            'warnings' => (array)($themeRecord['warnings'] ?? [])
        ];
    }

    function importThemeWorkspaceGithub(string $sourceInput): array {
        $workspace = readThemeWorkspace();
        $imported = fvplusImportGithubThemeFiles($sourceInput);
        $themeRecord = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
        $themeId = trim((string)($themeRecord['id'] ?? ''));
        $themes = [];
        $replaced = false;
        foreach ((array)($workspace['themes'] ?? []) as $existingTheme) {
            $existingId = trim((string)($existingTheme['id'] ?? ''));
            if ($existingId === $themeId) {
                $themes[] = $themeRecord;
                $replaced = true;
                continue;
            }
            $themes[] = $existingTheme;
        }
        if (!$replaced) {
            $themes[] = $themeRecord;
        }
        $workspace['themes'] = $themes;
        if (trim((string)($workspace['activeThemeId'] ?? '')) === '') {
            $workspace['activeThemeId'] = $themeId;
        }
        $saved = writeThemeWorkspace($workspace);
        return [
            'theme' => $themeRecord,
            'workspace' => $saved
        ];
    }

    function activateThemeWorkspaceTheme(string $themeId): array {
        $workspace = readThemeWorkspace();
        $safeThemeId = truncateUtf8String(trim($themeId), 64);
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === $safeThemeId) {
                $workspace['activeThemeId'] = $safeThemeId;
                return writeThemeWorkspace($workspace);
            }
        }
        throw new RuntimeException('Theme not found.');
    }

    function deactivateThemeWorkspaceTheme(): array {
        $workspace = readThemeWorkspace();
        $workspace['activeThemeId'] = '';
        return writeThemeWorkspace($workspace);
    }

    function deleteThemeWorkspaceTheme(string $themeId): array {
        $workspace = readThemeWorkspace();
        $safeThemeId = truncateUtf8String(trim($themeId), 64);
        $themes = [];
        $deleted = false;
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === $safeThemeId) {
                $deleted = true;
                continue;
            }
            $themes[] = $theme;
        }
        if (!$deleted) {
            throw new RuntimeException('Theme not found.');
        }
        $workspace['themes'] = $themes;
        if (trim((string)($workspace['activeThemeId'] ?? '')) === $safeThemeId) {
            $workspace['activeThemeId'] = '';
        }
        return writeThemeWorkspace($workspace);
    }

    function saveThemeWorkspaceCustomize($variables, string $customCss): array {
        $workspace = readThemeWorkspace();
        $scan = fvplusThemeWorkspaceScanCss($customCss);
        if (count((array)($scan['severe'] ?? [])) > 0) {
            throw new RuntimeException(implode(' ', (array)$scan['severe']));
        }
        $workspace['variables'] = fvplusThemeWorkspaceNormalizeVariableMap($variables);
        $workspace['customCss'] = truncateUtf8String($customCss, FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES);
        return writeThemeWorkspace($workspace);
    }

    function checkThemeWorkspaceUpdates(): array {
        $workspace = readThemeWorkspace();
        $themes = [];
        $checkedAt = gmdate('c');
        $updateCount = 0;
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            $normalizedTheme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
            $source = is_array($normalizedTheme['source'] ?? null) ? $normalizedTheme['source'] : [];
            $canCheck = !empty($source['canCheckUpdates']);
            $latestSha = '';
            if ($canCheck) {
                $latestSha = fvplusResolveGithubBranchHeadSha(
                    (string)($source['owner'] ?? ''),
                    (string)($source['repo'] ?? ''),
                    (string)($source['branch'] ?? ($source['defaultBranch'] ?? 'main'))
                );
            }
            $normalizedTheme['lastCheckedAt'] = $checkedAt;
            $normalizedTheme['updateAvailable'] = $latestSha !== '' && $latestSha !== trim((string)($source['commitSha'] ?? ''));
            if ($normalizedTheme['updateAvailable']) {
                $updateCount += 1;
            }
            $themes[] = $normalizedTheme;
        }
        $workspace['themes'] = $themes;
        $workspace['lastCheckedAt'] = $checkedAt;
        $saved = writeThemeWorkspace($workspace);
        return [
            'workspace' => $saved,
            'updateCount' => $updateCount,
            'checkedAt' => $checkedAt
        ];
    }

    function updateThemeWorkspaceTheme(string $themeId): array {
        $workspace = readThemeWorkspace();
        $safeThemeId = truncateUtf8String(trim($themeId), 64);
        if ($safeThemeId === '') {
            throw new RuntimeException('Theme is required.');
        }
        $themes = [];
        $updated = false;
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            $normalizedTheme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
            if (trim((string)($normalizedTheme['id'] ?? '')) !== $safeThemeId) {
                $themes[] = $normalizedTheme;
                continue;
            }
            $source = is_array($normalizedTheme['source'] ?? null) ? $normalizedTheme['source'] : [];
            $sourceInput = trim((string)($source['input'] ?? ''));
            if ($sourceInput === '') {
                throw new RuntimeException('Theme does not have a saved GitHub source to update from.');
            }
            $imported = fvplusImportGithubThemeFiles($sourceInput);
            $replacement = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
            $replacement['id'] = $safeThemeId;
            $replacement['importedAt'] = (string)($normalizedTheme['importedAt'] ?? gmdate('c'));
            $replacement['lastCheckedAt'] = gmdate('c');
            $replacement['updateAvailable'] = false;
            $themes[] = fvplusThemeWorkspaceNormalizeThemeRecord($replacement);
            $updated = true;
        }
        if (!$updated) {
            throw new RuntimeException('Theme not found.');
        }
        $workspace['themes'] = $themes;
        $workspace['lastCheckedAt'] = gmdate('c');
        return writeThemeWorkspace($workspace);
    }
