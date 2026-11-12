<?php
$server = $argv[1]; $root = $argv[2]; $mode = $argv[3];
foreach (['config', 'source', 'host'] as $dir) mkdir("$root/$dir", 0700, true);
putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
$_SERVER['DOCUMENT_ROOT'] = "$root/host";
require "$server/lib.php";
$safeCss = '.\\31 23 { color: #123456; }';
$unsafeCss = 'body { background: u\\72l("https://synthetic.invalid/test"); }';
function fixtureAssets(): array {
    $assets = [];
    foreach (['docker', 'vm', 'dashboard'] as $type) {
        $path = fvplusThemeWorkspaceGeneratedCssPath($type);
        $assets[$type] = is_file($path) ? file_get_contents($path) : null;
    }
    return $assets;
}
function fixtureState(): array {
    $path = getThemeWorkspacePath();
    return ['workspace' => file_get_contents($path), 'lastgood' => file_get_contents($path . '.lastgood'), 'assets' => fixtureAssets()];
}
$workspace = defaultThemeWorkspace();
$workspace['profiles'][0]['layers']['global'] = ['variables' => ['--fixture-safe' => '#123456'], 'customCss' => $safeCss];
writeThemeWorkspace($workspace);
if ($mode === 'profile' || $mode === 'customize') {
    $before = fixtureState(); $error = '';
    try {
        if ($mode === 'profile') saveThemeWorkspaceProfileLayer('default', 'docker', [], $unsafeCss);
        else saveThemeWorkspaceCustomize([], $unsafeCss);
    } catch (RuntimeException $failure) { $error = $failure->getMessage(); }
    $after = fixtureState();
    $stored = readThemeWorkspace();
    echo json_encode(['before' => $before, 'after' => $after, 'error' => $error, 'safeCss' => $safeCss,
        'storedCss' => $stored['profiles'][0]['layers']['global']['customCss']], JSON_THROW_ON_ERROR);
} else {
    // Simulate already stored legacy content through the normal persistence owner.
    if ($mode === 'legacy-profile') $workspace['profiles'][0]['layers']['global']['customCss'] = $unsafeCss;
    else {
        $workspace['activeThemeId'] = 'legacy';
        $workspace['themes'] = [['id' => 'legacy', 'name' => 'Legacy', 'files' => [[
            'name' => 'legacy.css', 'path' => 'legacy.css', 'content' => $unsafeCss, 'tabs' => ['docker', 'vm', 'dashboard']
        ]]]];
    }
    writeThemeWorkspace($workspace);
    $stored = readThemeWorkspace();
    echo json_encode(['assets' => fixtureAssets(), 'safeCss' => $safeCss, 'unsafeCss' => $unsafeCss,
        'storedUnsafe' => $mode === 'legacy-profile' ? $stored['profiles'][0]['layers']['global']['customCss'] : $stored['themes'][0]['files'][0]['content']], JSON_THROW_ON_ERROR);
}
