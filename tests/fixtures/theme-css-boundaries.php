<?php
$server = $argv[1];
$input = json_decode(base64_decode($argv[2]), true, 512, JSON_THROW_ON_ERROR);
require "$server/lib.php";

final class FixtureThemeHttps {
    public $context;
    public static array $heads = [];
    public static array $revisions = [];
    public static array $calls = [];
    public static array $overrides = [];
    public static array $unavailable = [];
    public static bool $truncated = false;
    public static bool $concurrentEdit = false;
    private string $contents = '';
    private int $offset = 0;

    public function stream_open(string $url, string $mode, int $options): bool {
        self::$calls[] = $url;
        $parts = parse_url($url);
        $path = rawurldecode($parts['path']);
        if ($parts['host'] === 'api.github.com' && preg_match('#\A/repos/owner/(repo|other)(?:/(.*))?\z#', $path, $match)) {
            $tail = $match[2] ?? '';
            $repo = $match[1];
            if (in_array($repo, self::$unavailable, true)) return false;
            if ($tail === '') {
                $result = ['default_branch' => 'main'];
            } elseif (str_starts_with($tail, 'commits/')) {
                $ref = substr($tail, strlen('commits/'));
                if (!in_array($ref, ['main', 'refs/heads/main', 'refs/tags/v1', 'refs/heads/feature/rc'], true)) return false;
                $result = ['sha' => self::$heads[$repo]];
            } elseif ($tail === 'git/matching-refs/heads/feature') {
                $result = [['ref' => 'refs/heads/feature/rc']];
            } elseif ($tail === 'git/matching-refs/tags/feature') {
                $result = [];
            } elseif (preg_match('#\Agit/trees/([a-f0-9]{40})\z#', $tail, $tree) && isset(self::$revisions[$repo][$tree[1]])) {
                $entries = [];
                foreach (self::$revisions[$repo][$tree[1]] as $name => $css) {
                    $size = strlen($css);
                    $entries[] = ['type' => 'blob', 'mode' => '100644', 'path' => $name, 'size' => $size, 'sha' => sha1("blob $size\0" . $css)];
                }
                $result = ['tree' => $entries, 'truncated' => self::$truncated];
            } else {
                throw new RuntimeException('Unexpected GitHub API fixture request.');
            }
            $this->contents = json_encode($result, JSON_THROW_ON_ERROR);
            return true;
        }
        if ($parts['host'] === 'raw.githubusercontent.com' && preg_match('#\A/owner/(repo|other)/([a-f0-9]{40})/(.+)\z#', $path, $match)) {
            if (self::$concurrentEdit) {
                self::$concurrentEdit = false;
                $workspace = readThemeWorkspace(false);
                $workspace['profiles'][0]['name'] = 'Concurrent edit';
                writeThemeWorkspace($workspace);
            }
            $css = array_key_exists($match[3], self::$overrides)
                ? self::$overrides[$match[3]]
                : (self::$revisions[$match[1]][$match[2]][$match[3]] ?? null);
            if ($css === null) return false;
            $this->contents = $css;
            return true;
        }
        throw new RuntimeException('Unexpected or unpinned theme fixture request.');
    }

    public function stream_read(int $count): string {
        $chunk = substr($this->contents, $this->offset, $count);
        $this->offset += strlen($chunk);
        return $chunk;
    }

    public function stream_eof(): bool { return $this->offset >= strlen($this->contents); }
    public function stream_stat(): array { return []; }
}

function fixtureThemeState(): array {
    $workspace = getThemeWorkspacePath();
    $files = [$workspace, getLastGoodJsonPath($workspace)];
    foreach (['docker', 'vm', 'dashboard'] as $type) {
        $files[] = fvplusThemeWorkspaceGeneratedCssPath($type);
    }
    return array_map(static fn(string $path): ?string => is_file($path) ? hash_file('sha256', $path) : null, $files);
}

if (isset($input['css'])) {
    echo json_encode(fvplusThemeWorkspaceScanCss($input['css']), JSON_THROW_ON_ERROR);
    exit;
}
if (in_array('https', stream_get_wrappers(), true)) stream_wrapper_unregister('https');
if (!stream_wrapper_register('https', FixtureThemeHttps::class)) {
    throw new RuntimeException('Unable to isolate the GitHub HTTPS fixture.');
}
$a = str_repeat('a', 40);
$b = str_repeat('b', 40);
$c = str_repeat('c', 40);
$red = '.fixture { color: red; }';
$tan = '.fixture { color: tan; }';
$paths = array_fill_keys($input['paths'] ?? ['classic/docker.css', 'classic/vm.css', 'compact/docker.css'], $red);
FixtureThemeHttps::$heads = ['repo' => $a, 'other' => $a];
FixtureThemeHttps::$revisions = [
    'repo' => [$a => $paths, $b => $paths + ['README.md' => 'Updated documentation'], $c => array_map(static fn(): string => $tan, $paths)],
    'other' => [$a => ['other/dashboard.css' => $red], $c => ['other/dashboard.css' => $tan]]
];
$source = $input['source'] ?? 'owner/repo';
$mode = $input['run'] ?? 'fetch';
if ($mode === 'fetch') {
    echo json_encode(fvplusImportGithubThemeFiles($source), JSON_THROW_ON_ERROR);
    exit;
}
if ($mode === 'review') {
    $preview = scanThemeWorkspaceGithub($source);
    FixtureThemeHttps::$heads['repo'] = $c;
    $reviewed = $preview['theme']['source'];
    echo json_encode(importThemeWorkspaceGithub($reviewed['input'], $reviewed['commitSha'])['theme'], JSON_THROW_ON_ERROR);
    exit;
}
$configBefore = scandir(dirname(getThemeWorkspacePath()));
$before = fixtureThemeState();
$discovery = scanThemeWorkspaceGithub($source, '', null, true);
$preview = scanThemeWorkspaceGithub($source, $discovery['commitSha'], 'classic');
$readOnly = $before === fixtureThemeState() && $configBefore === scandir(dirname(getThemeWorkspacePath()));
FixtureThemeHttps::$heads['repo'] = $c;
$import = importThemeWorkspaceGithub($preview['theme']['source']['input'], $preview['theme']['source']['commitSha']);
$checks = [
    'directories' => $discovery['directories'],
    'readOnly' => $readOnly,
    'pinnedImport' => $import['theme']['source']['commitSha'] === $a && $import['theme']['files'][0]['content'] === $red,
    'scopedImport' => array_column($import['theme']['files'], 'path') === ['classic/docker.css', 'classic/vm.css']
];
$themeId = $import['theme']['id'];

FixtureThemeHttps::$heads['repo'] = $b;
$checks['unrelatedUpdateCount'] = checkThemeWorkspaceUpdates()['updateCount'];
FixtureThemeHttps::$heads['repo'] = $c;
$checks['changedUpdateCount'] = checkThemeWorkspaceUpdates()['updateCount'];

$other = importThemeWorkspaceGithub('owner/other')['theme']['id'];
FixtureThemeHttps::$heads['other'] = $c;
$saved = readThemeWorkspace(false);
FixtureThemeHttps::$unavailable = ['other'];
$partial = checkThemeWorkspaceUpdates();
$checks['isolatedUpdateCheck'] = $partial['failedCount'] === 1 && $partial['updateCount'] === 1
    && $partial['workspace']['themes'][1] === $saved['themes'][1]
    && $partial['workspace']['activeThemeId'] === $themeId;
$before = fixtureThemeState();
FixtureThemeHttps::$unavailable = ['repo', 'other'];
$allFailed = checkThemeWorkspaceUpdates();
$checks['unavailableCheckPreserved'] = $allFailed['failedCount'] === 2 && $allFailed['updateCount'] === 0 && $before === fixtureThemeState();
FixtureThemeHttps::$unavailable = [];
$before = fixtureThemeState();
foreach ([
    'missing' => static function () use ($themeId): void {
        FixtureThemeHttps::$overrides['classic/vm.css'] = null;
        updateThemeWorkspaceTheme($themeId);
    },
    'mismatch' => static function () use ($themeId): void {
        FixtureThemeHttps::$overrides['classic/vm.css'] = '.fixture { color: red; }';
        updateThemeWorkspaceTheme($themeId);
    },
    'bulk' => static function () use ($themeId, $other): void {
        FixtureThemeHttps::$overrides['other/dashboard.css'] = null;
        updateThemeWorkspaceThemes([$themeId, $other]);
    },
    'truncated' => static function () use ($themeId): void {
        FixtureThemeHttps::$truncated = true;
        updateThemeWorkspaceTheme($themeId);
    },
] as $key => $operation) {
    try {
        $operation();
        $checks[$key] = false;
    } catch (RuntimeException $failure) {
        $checks[$key] = $before === fixtureThemeState() && str_starts_with($failure->getMessage(), 'Failed to ');
    } finally {
        FixtureThemeHttps::$overrides = [];
        FixtureThemeHttps::$truncated = false;
    }
}

FixtureThemeHttps::$concurrentEdit = true;
try {
    updateThemeWorkspaceTheme($themeId);
    $checks['concurrentPreserved'] = false;
} catch (RuntimeException $failure) {
    $checks['concurrentPreserved'] = str_contains($failure->getMessage(), 'configuration is busy')
        && readThemeWorkspace(false)['profiles'][0]['name'] === 'Concurrent edit';
}
$updated = updateThemeWorkspaceThemes([$themeId, $other])['workspace'];
$checks['bulkCompleted'] = count($updated['themes']) === 2 && $updated['activeThemeId'] === $themeId
    && $updated['activeProfileId'] === 'default' && !in_array(true, array_column($updated['themes'], 'updateAvailable'), true)
    && array_column(array_column($updated['themes'], 'source'), 'commitSha') === [$c, $c];
$checks['rawRequestsPinned'] = count(array_filter(FixtureThemeHttps::$calls, static fn(string $call): bool =>
    preg_match('#\Ahttps://raw\.githubusercontent\.com/owner/[^/]+/(?![a-f0-9]{40}/)#', $call))) === 0;
echo json_encode($checks, JSON_THROW_ON_ERROR);
