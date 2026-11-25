<?php
$server = $argv[1];
$root = $argv[2];
$input = json_decode(base64_decode($argv[3]), true, 512, JSON_THROW_ON_ERROR);
putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
putenv("FVPLUS_TEST_SOURCE_DIR=$root/runtime");
$_SERVER['DOCUMENT_ROOT'] = "$root/host";

function fixtureThemeWorkspace(string $name): array {
    $layer = ['variables' => ['--fvplus-theme-accent' => '#123456'], 'customCss' => '.saved { opacity: .7; }'];
    return [
        'schemaVersion' => 2,
        'activeProfileId' => 'default',
        'profiles' => [
            ['id' => 'default', 'name' => $name, 'layers' => ['global' => $layer]],
            ['id' => 'alternate', 'name' => 'Alternate']
        ],
        'activeThemeId' => 'first',
        'themes' => array_map(static fn(string $id): array => [
            'id' => $id,
            'name' => $id,
            'importedAt' => '2026-01-01T00:00:00+00:00',
            'source' => ['input' => "owner/$id", 'canCheckUpdates' => true],
            'files' => [['path' => 'docker.css', 'tabs' => ['docker'], 'content' => '.fixture { color: red; }']]
        ], ['first', 'second'])
    ];
}

function fixtureThemeFilesystem(string $root): array {
    clearstatcache();
    $result = [];
    foreach (['config', 'runtime'] as $directory) {
        $path = "$root/$directory";
        $result[$directory] = is_dir($path) ? [fileperms($path) & 0777] : null;
        if (!is_dir($path)) continue;
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
        foreach ($files as $entry) {
            $key = substr($entry->getPathname(), strlen($root) + 1);
            $result[$key] = $entry->isLink()
                ? ['link', readlink($entry->getPathname())]
                : [$entry->getPerms() & 0777, $entry->isFile() ? file_get_contents($entry->getPathname()) : null];
        }
    }
    ksort($result);
    return $result;
}

function fixtureThemeObserveRemoteDispatch(): array {
    $other = fopen(getConfigMutationLockPath(), 'c+');
    if (!is_resource($other)) throw new RuntimeException('Could not observe the competing fixture lock.');
    $acquired = flock($other, LOCK_EX | LOCK_NB);
    fclose($other);
    $state = readJsonObjectFile(fvplus_security_state_path());
    return ['observedDispatch' => [
        'lockAvailable' => $acquired,
        'guardAuthorized' => $GLOBALS['fvplusMutationGuardComplete'] ?? false,
        'nonceConsumed' => ($state['nonces'] ?? null) === [],
        'protectedAction' => $state['transactions'][0]['action'] ?? null
    ]];
}

if ($input['mode'] === 'endpoint' || $input['mode'] === 'remote') {
    $scenario = $input['scenario'] ?? 'fresh';
    $workspacePath = "$root/config/theme-workspace.json";
    if ($scenario !== 'fresh') {
        mkdir("$root/config/styles", 0700, true);
        file_put_contents("$workspacePath.lastgood", json_encode(fixtureThemeWorkspace('Mirror profile'), JSON_THROW_ON_ERROR));
        chmod("$workspacePath.lastgood", 0640);
        if ($scenario === 'corrupt') {
            file_put_contents($workspacePath, '{corrupt-primary');
            chmod($workspacePath, 0600);
        } elseif ($scenario === 'healthy') {
            file_put_contents($workspacePath, json_encode(fixtureThemeWorkspace('Primary profile'), JSON_THROW_ON_ERROR));
            chmod($workspacePath, 0600);
        }
        $css = "$root/config/styles/fvplus-managed.theme.docker.css";
        file_put_contents($css, '.stale { opacity: .4; }');
        chmod($css, 0640);
    }
    $before = fixtureThemeFilesystem($root);
    $_SERVER['SCRIPT_FILENAME'] = "$server/theme_workspace.php";
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_POST = $_REQUEST = [
        'action' => $input['action'],
        'profileId' => 'default',
        'scope' => 'docker',
        'variables' => '{"--fvplus-theme-accent":"#abc123"}',
        'customCss' => '.preview { opacity: .8; }',
        'themeIds' => '["first"]',
        'themeId' => 'first',
        'source' => 'owner/fixture'
    ];
    // Load the real endpoint at file scope so it shares lib.php's config globals.
    $body = str_replace(
        'require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");',
        'require_once $server . "/lib.php";',
        file_get_contents($_SERVER['SCRIPT_FILENAME']),
        $count
    );
    if ($count !== 1) throw new RuntimeException('Fixture could not relocate the Theme Workspace bootstrap.');
    if ($input['mode'] === 'remote') {
        putenv("FVPLUS_TEST_SECURITY_STATE_PATH=$root/fixture-theme-security.json");
        // Use a real request token and nonce. Observe dispatch without GitHub I/O.
        $authorize = <<<'PHP_AUTHORIZE'
require_once $server . "/lib.php";
$_SERVER['HTTP_X_FV_REQUEST'] = '1';
$_SERVER['HTTP_X_FV_TOKEN'] = getConfiguredRequestToken();
$_SERVER['HTTP_X_FV_NONCE'] = fvplus_issue_mutation_nonce('theme_workspace.php', $input['action'])['nonce'];
PHP_AUTHORIZE;
        $body = str_replace('require_once $server . "/lib.php";', $authorize, $body);
        $calls = [
            'import_github' => 'importThemeWorkspaceGithub($source, (string)($_POST[\'commitSha\'] ?? \'\'))',
            'check_updates' => 'checkThemeWorkspaceUpdates()',
            'update_theme' => 'updateThemeWorkspaceTheme($themeId)',
            'update_themes' => 'updateThemeWorkspaceThemes($themeIds)'
        ];
        $body = str_replace($calls[$input['action']], 'fixtureThemeObserveRemoteDispatch()', $body, $count);
        if ($count !== 1) throw new RuntimeException('Fixture could not observe the selected remote dispatch.');
    }
    ob_start();
    eval('?>' . $body);
    $response = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if ($input['mode'] === 'remote') {
        echo json_encode($response['observedDispatch'] ?? $response['workspace']['observedDispatch'] ?? $response, JSON_THROW_ON_ERROR);
        return;
    }
    echo json_encode([
        'ok' => $response['ok'] ?? false,
        'name' => $response['workspace']['profiles'][0]['name'] ?? null,
        'primaryName' => isset($response['workspace']) && is_file($workspacePath)
            ? json_decode(file_get_contents($workspacePath), true)['profiles'][0]['name'] ?? null : null,
        'afterCss' => is_file("$root/config/styles/fvplus-managed.theme.docker.css")
            ? file_get_contents("$root/config/styles/fvplus-managed.theme.docker.css") : null,
        'changedScopes' => $response['plan']['changedScopes'] ?? null,
        'themeIds' => $response['plan']['themeIds'] ?? null,
        'beforeAfterEqual' => $before === fixtureThemeFilesystem($root),
        'hasConfigDir' => is_dir("$root/config"),
        'hasRuntimeDir' => is_dir("$root/runtime"),
        'hasLock' => file_exists("$root/config/.config-mutation.lock"),
        'hasIconStorage' => is_dir("$root/config/images") || file_exists("$root/folderview.plus-custom-icons.lock")
    ], JSON_THROW_ON_ERROR);
    return;
}

if ($input['mode'] !== 'bootstrap') define('FVPLUS_THEME_WORKSPACE_REQUEST', true);
require "$server/lib.php";
if ($input['mode'] === 'bootstrap' || $input['mode'] === 'repair') {
    if ($input['mode'] === 'repair') repairPluginPaths();
    echo json_encode([
        'workspace' => is_file("$root/config/theme-workspace.json"),
        'iconStorage' => is_dir("$root/config/images/custom"),
        'runtimeIcons' => is_dir("$root/runtime/images/custom"),
        'iconLock' => is_file("$root/folderview.plus-custom-icons.lock")
    ], JSON_THROW_ON_ERROR);
    return;
}
$before = writeThemeWorkspace(fixtureThemeWorkspace('Primary profile'));
if ($input['mode'] === 'css-limit') {
    $marker = '.fixture-css-limit { color: red; }';
    $limit = FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES;
    $bytes = $limit - strlen($marker) - 4;
    $css = '/*' . str_repeat($input['character'], intdiv($bytes, strlen($input['character'])))
        . str_repeat(' ', $bytes % strlen($input['character'])) . '*/' . $marker;
    $saved = saveThemeWorkspaceProfileLayer('default', 'docker', [], $css)['workspace'];
    $nativeAfterSave = fixtureThemeFilesystem($root);
    $rejected = [];
    $overBudget = $css . $input['character'];
    foreach ([
        'preview' => static fn() => prepareThemeWorkspaceProfileLayer('default', 'docker', [], $overBudget),
        'save' => static fn() => saveThemeWorkspaceProfileLayer('default', 'docker', [], $overBudget),
        'saveAs' => static fn() => createThemeWorkspaceProfile('Oversized copy', 'default', 'docker', [], $overBudget),
        'legacySave' => static fn() => saveThemeWorkspaceCustomize([], $overBudget)
    ] as $action => $write) {
        try { $write(); } catch (RuntimeException $error) { $rejected[$action] = $error->getMessage(); }
    }
    echo json_encode([
        'exactBytes' => strlen($saved['profiles'][0]['layers']['docker']['customCss']),
        'hasEndingRule' => str_contains(file_get_contents("$root/config/styles/fvplus-managed.theme.docker.css"), $marker),
        'rejected' => $rejected,
        'unchanged' => fixtureThemeFilesystem($root) === $nativeAfterSave
    ], JSON_THROW_ON_ERROR);
    return;
}
$replacement = $before;
$replacement['themes'][0]['files'][0]['content'] = '.remote { color: blue; }';
$GLOBALS['themeFixtureBefore'] = $before;
$GLOBALS['themeFixtureReplacement'] = $replacement;

// Route only the local mutator's workspace read through a fixture observation
// point. The lock and competing GitHub compare-and-swap remain the real owners.
$probe = <<<'PHP_PROBE'
namespace ThemeMutationFixture;
use \RuntimeException;
function readThemeWorkspace(bool $repair = true): array {
    $snapshot = \readThemeWorkspace($repair);
    $other = fopen(\getConfigMutationLockPath(), 'c+');
    if (!is_resource($other)) throw new RuntimeException('Could not observe the competing fixture lock.');
    $acquired = flock($other, LOCK_EX | LOCK_NB);
    if ($acquired) flock($other, LOCK_UN);
    fclose($other);
    $GLOBALS['themeFixtureReadLockHeld'] = !$acquired;
    if ($acquired) \fvplusThemeWorkspaceWriteGithubChange($GLOBALS['themeFixtureBefore'], $GLOBALS['themeFixtureReplacement']);
    return $snapshot;
}
PHP_PROBE;
$subjects = [
    'lib.theme-profile-actions.php' => "require_once __DIR__ . '/lib.theme-profile-create.php';",
    'lib.theme-profile-create.php' => '',
    'lib.theme-github.php' => "require_once __DIR__ . '/lib.theme-css.php';"
];
foreach ($subjects as $file => $relativeRequire) {
    $source = substr(file_get_contents("$server/$file"), 5);
    if ($relativeRequire !== '') $source = str_replace($relativeRequire, '', $source);
    $probe .= "\n" . $source;
}
eval($probe);

$operation = $input['action'];
switch ($operation) {
    case 'create':
        \ThemeMutationFixture\createThemeWorkspaceProfile('Local copy', 'default', 'docker', [], '.copy { opacity: .8; }');
        break;
    case 'activate-profile':
        \ThemeMutationFixture\activateThemeWorkspaceProfile('alternate');
        break;
    case 'delete-profile':
        \ThemeMutationFixture\deleteThemeWorkspaceProfile('alternate');
        break;
    case 'save-profile':
        \ThemeMutationFixture\saveThemeWorkspaceProfileLayer('default', 'docker', [], '.local { opacity: .8; }');
        break;
    case 'save-customize':
        \ThemeMutationFixture\saveThemeWorkspaceCustomize([], '.local { opacity: .8; }');
        break;
    case 'activate-theme':
        \ThemeMutationFixture\activateThemeWorkspaceTheme('second');
        break;
    case 'deactivate-theme':
        \ThemeMutationFixture\deactivateThemeWorkspaceTheme();
        break;
    case 'delete-theme':
        \ThemeMutationFixture\deleteThemeWorkspaceTheme('second');
        break;
    default:
        throw new RuntimeException('Unknown local Theme Workspace fixture action.');
}
$local = readThemeWorkspace(false);
$conflict = false;
try {
    fvplusThemeWorkspaceWriteGithubChange($before, $replacement);
} catch (RuntimeException $error) {
    $conflict = str_contains($error->getMessage(), 'configuration is busy');
}
echo json_encode([
    'heldDuringRead' => $GLOBALS['themeFixtureReadLockHeld'] ?? false,
    'localPersisted' => jsonObjectsDiffer($before, $local) && !jsonObjectsDiffer($local, readThemeWorkspace(false)),
    'staleGithubRejected' => $conflict
], JSON_THROW_ON_ERROR);
