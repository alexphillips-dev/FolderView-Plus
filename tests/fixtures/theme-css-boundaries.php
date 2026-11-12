<?php
namespace ThemeBoundary {
    function fvplusResolveGithubThemeRepoMeta(string $owner, string $repo): array { return ['defaultBranch' => 'main']; }
    function fvplusResolveGithubBranchHeadSha(string $owner, string $repo, string $branch): string { return 'fixture-sha'; }
    function fvplusThemeWorkspaceFetchJson(string $url, int $timeout): array {
        return ['ok' => true, 'json' => ['tree' => array_map(static fn($path) => ['type' => 'blob', 'path' => $path], $GLOBALS['paths'])]];
    }
    function fvplusThemeWorkspaceFetchText(string $url, int $timeout): array { return ['ok' => true, 'content' => '.fixture { color: red; }']; }
    function fvplusThemeWorkspaceDetectTabsFromPath(string $path, int $count): array { return ['docker']; }
}
namespace {
    require $argv[1] . '/lib.theme-github.php';
    define('FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME', 100);
    $input = json_decode(base64_decode($argv[2]), true, 512, JSON_THROW_ON_ERROR);
    if (isset($input['css'])) {
        echo json_encode(fvplusThemeWorkspaceScanCss($input['css']));
    } else {
        $paths = $input['paths'];
        $reflection = new ReflectionFunction('fvplusImportGithubThemeFiles');
        $source = file($reflection->getFileName());
        eval('namespace ThemeBoundary; use RuntimeException;' . implode('', array_slice($source, $reflection->getStartLine() - 1, $reflection->getEndLine() - $reflection->getStartLine() + 1)));
        echo json_encode(\ThemeBoundary\fvplusImportGithubThemeFiles($input['source']));
    }
}
