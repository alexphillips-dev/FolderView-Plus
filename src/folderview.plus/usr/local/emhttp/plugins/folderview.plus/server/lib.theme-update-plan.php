<?php
function fvplusThemeUpdateCaptureFile(string $path): array {
    return ['path' => $path, 'exists' => file_exists($path), 'content' => file_exists($path) ? (string)@file_get_contents($path) : ''];
}

function fvplusThemeUpdateRestoreFiles(array $snapshots): void {
    foreach ($snapshots as $snapshot) {
        $path = (string)($snapshot['path'] ?? '');
        if ($path === '') {
            continue;
        }
        if (!empty($snapshot['exists'])) {
            writeDurableFileAtomic($path, (string)($snapshot['content'] ?? ''));
        } elseif (file_exists($path)) {
            @unlink($path);
        }
    }
}

function fvplusThemeUpdateSnapshotPaths(bool $includeWorkspace): array {
    $paths = array_map(static fn(string $scope): string => fvplusThemeWorkspaceGeneratedCssPath($scope), ['docker', 'vm', 'dashboard']);
    if ($includeWorkspace) {
        $workspacePath = getThemeWorkspacePath();
        array_unshift($paths, $workspacePath, getLastGoodJsonPath($workspacePath));
    }
    return array_map(static fn(string $path): array => fvplusThemeUpdateCaptureFile($path), $paths);
}

function fvplusThemeWorkspaceBuildUpdatePlan(array $current, array $proposed): array {
    $before = normalizeThemeWorkspacePayload($current);
    $after = normalizeThemeWorkspacePayload($proposed);
    $changedScopes = [];
    foreach (['docker', 'vm', 'dashboard'] as $scope) {
        if (jsonObjectsDiffer(fvplusThemeProfileResolvedLayer($before, $scope), fvplusThemeProfileResolvedLayer($after, $scope))) {
            $changedScopes[] = $scope;
        }
    }
    return [
        'changed' => jsonObjectsDiffer($before, $after),
        'changedScopes' => $changedScopes,
        'profileCountBefore' => count((array)$before['profiles']),
        'profileCountAfter' => count((array)$after['profiles']),
        'themeCountBefore' => count((array)$before['themes']),
        'themeCountAfter' => count((array)$after['themes']),
        'activeProfileId' => (string)$after['activeProfileId']
    ];
}

function fvplusThemeWorkspaceApplyAtomic(array $workspace, bool $persistWorkspace = true): array {
    $normalized = normalizeThemeWorkspacePayload($workspace);
    return withConfigMutationLock(static function() use ($normalized, $persistWorkspace): array {
        $snapshots = fvplusThemeUpdateSnapshotPaths($persistWorkspace);
        try {
            if ($persistWorkspace) {
                writeJsonObjectWithLastGood(getThemeWorkspacePath(), $normalized);
            }
            writeThemeWorkspaceManagedAssetsUnprotected($normalized);
            return $normalized;
        } catch (Throwable $error) {
            fvplusThemeUpdateRestoreFiles($snapshots);
            throw $error;
        }
    });
}
