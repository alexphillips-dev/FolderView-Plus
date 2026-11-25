<?php
require_once __DIR__ . '/lib.theme-css.php';

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
        $direct = preg_replace('#^https?://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/#i', 'https://raw.githubusercontent.com/$1/$2/', $raw);
        if (preg_match('#^https?://raw\.githubusercontent\.com/([^/]+)/([^/]+)/((?:refs/(?:heads|tags)/)?[^/]+)/(.+?\.css)$#i', $direct, $match)) {
            return [
                'kind' => 'github_file',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => rawurldecode($match[3]),
                'path' => rawurldecode($match[4]),
                'rawUrl' => $direct
            ];
        }
        if (preg_match('#^https?://github\.com/([^/]+)/([^/]+)(?:/tree/([^/]+)(?:/(.+))?)?$#i', $raw, $match)) {
            return [
                'kind' => 'github_repo',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => rawurldecode(trim((string)($match[3] ?? ''))),
                'path' => rawurldecode(trim((string)($match[4] ?? ''))),
                'rawUrl' => ''
            ];
        }
        if (preg_match('#^([^/\s]+)/([^/\s]+)(?:/tree/([^/\s]+)(?:/(.+))?)?$#', $raw, $match)) {
            return [
                'kind' => 'github_repo',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => rawurldecode(trim((string)($match[3] ?? ''))),
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
        $apiUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/commits/' . rawurlencode($branch);
        $response = fvplusThemeWorkspaceFetchJson($apiUrl, 10);
        if (!$response['ok']) {
            return '';
        }
        return strtolower(trim((string)($response['json']['sha'] ?? '')));
    }

    function fvplusThemeGithubManifest(string $sourceInput, string $commitSha = '', ?string $directory = null, bool $discover = false): array {
        $parsed = fvplusParseGithubThemeSourceInput($sourceInput);
        $owner = trim($parsed['owner']);
        $repo = trim($parsed['repo']);
        if ($owner === '' || $repo === '') throw new RuntimeException('Theme source is missing repository information.');
        $branch = $parsed['branch'];
        $path = trim($parsed['path'], '/');
        $isFile = $parsed['kind'] === 'github_file';
        if ($directory !== null && !$isFile) {
            if ($path !== '' && $directory !== $path && !str_starts_with($directory, "$path/")) {
                throw new RuntimeException('No CSS theme files were found in the selected GitHub repository.');
            }
            $path = trim($directory, '/');
        }
        if ($branch === '') {
            $branch = fvplusResolveGithubThemeRepoMeta($owner, $repo)['defaultBranch'] ?: 'main';
        }
        $repoPath = rawurlencode($owner) . '/' . rawurlencode($repo);
        $commitSha = $commitSha !== '' ? $commitSha : fvplusResolveGithubBranchHeadSha($owner, $repo, $branch);
        // Raw URLs with slash-containing refs leave their ref/path boundary implicit.
        if ($commitSha === '' && $isFile && str_contains($path, '/')) {
            $qualified = str_starts_with($branch, 'refs/');
            $fullPath = "$branch/$path";
            $resolvedRef = $resolvedPrefix = '';
            foreach ($qualified ? [substr($branch, 5)] : ["heads/$branch", "tags/$branch"] as $prefix) {
                $refs = fvplusThemeWorkspaceFetchJson("https://api.github.com/repos/$repoPath/git/matching-refs/" . rawurlencode($prefix));
                foreach ($refs['json'] ?? [] as $ref) {
                    $candidate = (string)($ref['ref'] ?? '');
                    $inputPrefix = $qualified ? $candidate : preg_replace('#^refs/(?:heads|tags)/#', '', $candidate);
                    if (strlen($inputPrefix) > strlen($resolvedPrefix) && str_starts_with($fullPath, "$inputPrefix/")) {
                        $resolvedRef = $candidate;
                        $resolvedPrefix = $inputPrefix;
                    }
                }
            }
            if ($resolvedRef !== '') {
                $branch = $resolvedRef;
                $path = substr($fullPath, strlen($resolvedPrefix) + 1);
                $sourceInput = "https://raw.githubusercontent.com/$repoPath/" . rawurlencode($branch) . '/'
                    . implode('/', array_map('rawurlencode', explode('/', $path)));
                $commitSha = fvplusResolveGithubBranchHeadSha($owner, $repo, $branch);
            }
        }
        if (!preg_match('/\A[a-f0-9]{40}\z/', $commitSha)) {
            throw new RuntimeException('Failed to read GitHub repository metadata.');
        }
        $response = fvplusThemeWorkspaceFetchJson("https://api.github.com/repos/$repoPath/git/trees/$commitSha?recursive=1", 12);
        $tree = $response['json']['tree'] ?? null;
        if (!$response['ok'] || !is_array($tree) || !empty($response['json']['truncated'])) {
            throw new RuntimeException('Failed to read GitHub repository tree.');
        }
        $scopes = [$path => []];
        foreach ($tree as $entry) {
            $filePath = (string)($entry['path'] ?? '');
            if (($entry['type'] ?? '') !== 'blob' || !preg_match('/\.css\z/i', $filePath)
                || ($isFile ? $filePath !== $path : ($path !== '' && !str_starts_with($filePath, "$path/")))
                || (!$isFile && preg_match('#(^|/)(node_modules|vendor|dist|build|coverage|\.git)/#i', $filePath))) {
                continue;
            }
            $scopes[$path][] = $entry;
            if ($discover && !$isFile) {
                for ($parent = dirname($filePath); $parent !== '.' && $parent !== $path; $parent = dirname($parent)) {
                    $scopes[$parent][] = $entry;
                }
            }
        }
        foreach ($scopes as &$entries) {
            $cssCount = count($entries);
            $entries = array_values(array_filter(array_map(static function (array $entry) use ($cssCount): array {
                $entry['tabs'] = fvplusThemeWorkspaceDetectTabsFromPath($entry['path'], $cssCount);
                return $entry;
            }, $entries), static fn(array $entry): bool => $entry['tabs'] !== []));
        }
        unset($entries);
        $directories = [];
        if ($discover && !$isFile && count($scopes) > 1) {
            foreach ($scopes as $directoryPath => $entries) {
                if ($entries && count($entries) <= FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME
                    && !array_filter($entries, static fn(array $file): bool => !fvplusThemeGithubValidFile($file))) {
                    $directories[] = (string)$directoryPath;
                }
            }
        }
        if ($directory !== null && !$isFile) {
            $encodedPath = implode('/', array_map('rawurlencode', explode('/', $path)));
            $sourceInput = "https://github.com/$repoPath/tree/" . rawurlencode($branch) . ($encodedPath === '' ? '' : "/$encodedPath");
        }
        if (strlen($sourceInput) > 512) {
            throw new RuntimeException('Unsupported GitHub theme source format.');
        }
        return [
            'source' => [
                'input' => $sourceInput,
                'kind' => $parsed['kind'],
                'owner' => $owner,
                'repo' => $repo,
                'branch' => $branch,
                'path' => $path,
                'defaultBranch' => $branch,
                'commitSha' => $commitSha,
                'canCheckUpdates' => true,
                'rawUrl' => $parsed['rawUrl']
            ],
            'repoPath' => $repoPath,
            'files' => $scopes[$path],
            'directories' => $directories
        ];
    }

    function fvplusThemeGithubFingerprint(array $files): string {
        $manifest = array_map(static function (array $file): array {
            $content = (string)($file['content'] ?? '');
            return [$file['path'], $file['tabs'], $file['sha'] ?? sha1('blob ' . strlen($content) . "\0" . $content)];
        }, $files);
        return hash('sha256', json_encode($manifest, JSON_THROW_ON_ERROR));
    }

    function fvplusThemeGithubValidFile(array $file): bool {
        $path = $file['path'];
        $size = $file['size'] ?? null;
        return trim($path) === $path && strlen($path) <= 512 && preg_match('//u', $path)
            && !preg_match('#(?:^|/)\.{1,2}(?:/|$)|[\\\\\x00-\x1F\x7F]#', $path)
            && in_array($file['mode'] ?? null, ['100644', '100755'], true)
            && is_int($size) && $size > 0 && $size <= FVPLUS_THEME_WORKSPACE_MAX_FILE_BYTES
            && preg_match('/\A[a-f0-9]{40}\z/', (string)($file['sha'] ?? '')) === 1;
    }

    function fvplusImportGithubThemeFiles(string $sourceInput, string $commitSha = '', ?array $manifest = null): array {
        $manifest = $manifest ?? fvplusThemeGithubManifest($sourceInput, $commitSha);
        $source = $manifest['source'];
        $commit = $source['commitSha'];
        $repoPath = $manifest['repoPath'];
        if (!$manifest['files']) {
            throw new RuntimeException('No compatible Docker, VM, or Dashboard CSS files were found.');
        }
        if (count($manifest['files']) > FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME) {
            throw new RuntimeException('Failed to fetch GitHub CSS file.');
        }
        $paths = [];
        $files = [];
        $warnings = [];
        foreach ($manifest['files'] as $file) {
            $path = $file['path'];
            $size = $file['size'] ?? null;
            $blobSha = (string)($file['sha'] ?? '');
            if (isset($paths[$path]) || !fvplusThemeGithubValidFile($file)) {
                throw new RuntimeException('Failed to fetch GitHub CSS file.');
            }
            $paths[$path] = true;
            $encodedPath = implode('/', array_map('rawurlencode', explode('/', $path)));
            $rawUrl = "https://raw.githubusercontent.com/$repoPath/$commit/$encodedPath";
            $response = fvplusThemeWorkspaceFetchText($rawUrl, 10);
            $content = (string)($response['content'] ?? '');
            if (!$response['ok'] || strlen($content) !== $size || !preg_match('//u', $content)
                || !hash_equals($blobSha, sha1("blob $size\0" . $content))) {
                throw new RuntimeException('Failed to fetch GitHub CSS file.');
            }
            $scan = fvplusThemeWorkspaceScanCss($content);
            if ($scan['severe']) {
                throw new RuntimeException(implode(' ', $scan['severe']));
            }
            $warnings = array_values(array_unique(array_merge($warnings, $scan['warnings'])));
            $files[] = ['name' => basename($path), 'path' => $path, 'sourceUrl' => $rawUrl, 'tabs' => $file['tabs'], 'content' => $content];
        }
        return ['name' => $source['owner'] . '/' . $source['repo'], 'warnings' => $warnings, 'files' => $files, 'source' => $source];
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

    function scanThemeWorkspaceGithub(string $sourceInput, string $commitSha = '', ?string $directory = null, bool $discover = false): array {
        $manifest = fvplusThemeGithubManifest($sourceInput, $commitSha, $directory, $discover);
        if ($manifest['directories']) {
            return ['directories' => $manifest['directories'], 'commitSha' => $manifest['source']['commitSha']];
        }
        $workspace = readThemeWorkspace(false);
        $imported = fvplusImportGithubThemeFiles($sourceInput, '', $manifest);
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

    function fvplusThemeWorkspaceWriteGithubChange(array $before, array $workspace): array {
        return withConfigMutationLock(static function () use ($before, $workspace): array {
            if (jsonObjectsDiffer($before, readThemeWorkspace(false))) {
                throw new RuntimeException('FolderView Plus configuration is busy. Please retry the action.');
            }
            return writeThemeWorkspace($workspace);
        });
    }

    function importThemeWorkspaceGithub(string $sourceInput, string $commitSha = ''): array {
        $before = $workspace = readThemeWorkspace(false);
        $imported = fvplusImportGithubThemeFiles($sourceInput, $commitSha);
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
        $saved = fvplusThemeWorkspaceWriteGithubChange($before, $workspace);
        return [
            'theme' => $themeRecord,
            'workspace' => $saved
        ];
    }

    function activateThemeWorkspaceTheme(string $themeId): array {
        return withConfigMutationLock(static function () use ($themeId): array {
            $workspace = readThemeWorkspace(false);
            $safeThemeId = truncateUtf8String(trim($themeId), 64);
            if (!in_array($safeThemeId, array_column($workspace['themes'], 'id'), true)) {
                throw new RuntimeException('Theme not found.');
            }
            $workspace['activeThemeId'] = $safeThemeId;
            return writeThemeWorkspace($workspace);
        });
    }

    function deactivateThemeWorkspaceTheme(): array {
        return withConfigMutationLock(static function (): array {
            $workspace = readThemeWorkspace(false);
            $workspace['activeThemeId'] = '';
            return writeThemeWorkspace($workspace);
        });
    }

    function deleteThemeWorkspaceTheme(string $themeId): array {
        return withConfigMutationLock(static function () use ($themeId): array {
            $workspace = readThemeWorkspace(false);
            $safeThemeId = truncateUtf8String(trim($themeId), 64);
            $themes = array_values(array_filter($workspace['themes'], static fn(array $theme): bool => $theme['id'] !== $safeThemeId));
            if (count($themes) === count($workspace['themes'])) {
                throw new RuntimeException('Theme not found.');
            }
            $workspace['themes'] = $themes;
            if ($workspace['activeThemeId'] === $safeThemeId) {
                $workspace['activeThemeId'] = '';
            }
            return writeThemeWorkspace($workspace);
        });
    }

    function saveThemeWorkspaceCustomize($variables, string $customCss): array {
        return withConfigMutationLock(static function () use ($variables, $customCss): array {
            $workspace = readThemeWorkspace(false);
            $prepared = prepareThemeWorkspaceProfileLayer($workspace['activeProfileId'], 'global', $variables, $customCss, $workspace);
            return writeThemeWorkspace($prepared['workspace']);
        });
    }

    function checkThemeWorkspaceUpdates(): array {
        $before = $workspace = readThemeWorkspace(false);
        $themes = [];
        $checkedAt = gmdate('c');
        $updateCount = 0;
        $failedCount = 0;
        $checkedCount = 0;
        foreach ($workspace['themes'] as $theme) {
            $source = $theme['source'];
            if (!empty($source['canCheckUpdates']) && !empty($source['input'])) {
                try {
                    $manifest = fvplusThemeGithubManifest($source['input']);
                    $theme['updateAvailable'] = fvplusThemeGithubFingerprint($manifest['files'])
                        !== fvplusThemeGithubFingerprint($theme['files']);
                    $theme['lastCheckedAt'] = $checkedAt;
                    $checkedCount++;
                    if ($theme['updateAvailable']) $updateCount++;
                } catch (RuntimeException $error) {
                    $failedCount++;
                }
            }
            $themes[] = $theme;
        }
        if ($checkedCount > 0) {
            $workspace['themes'] = $themes;
            $workspace['lastCheckedAt'] = $checkedAt;
            $workspace = fvplusThemeWorkspaceWriteGithubChange($before, $workspace);
        }
        return [
            'workspace' => $workspace,
            'updateCount' => $updateCount,
            'failedCount' => $failedCount,
            'checkedAt' => $workspace['lastCheckedAt']
        ];
    }
