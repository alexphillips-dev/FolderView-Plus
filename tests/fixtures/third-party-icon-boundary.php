<?php
$root = sys_get_temp_dir() . '/fvplus-icon-boundary-' . bin2hex(random_bytes(8));
$sourceDir = "$root/source";
mkdir("$sourceDir/images", 0700, true);
mkdir("$root/cache", 0700);
$base = "$sourceDir/images/third-party-icons";
$linkedBase = ($argv[1] ?? '') === 'linked';
$actualBase = $linkedBase ? "$root/pack/third-party-icons" : $base;
mkdir("$actualBase/Allowed", 0700, true);
mkdir("$actualBase/Allowed-sibling", 0700);
mkdir($actualBase . '-sibling', 0700);
if ($linkedBase) symlink($actualBase, $base);
$svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
file_put_contents("$actualBase/Allowed/inside.svg", $svg);
file_put_contents("$actualBase/Allowed-sibling/sibling.svg", $svg);
file_put_contents($actualBase . '-sibling/private.svg', '<svg>outside fixture bytes</svg>');
symlink("$actualBase/Allowed/inside.svg", "$actualBase/Allowed/inside-link.svg");
symlink("$actualBase/Allowed-sibling/sibling.svg", "$actualBase/Allowed/sibling-link.svg");
symlink($actualBase . '-sibling/private.svg', "$actualBase/Allowed/outside-link.svg");
symlink($actualBase . '-sibling', "$actualBase/Escape");
symlink($actualBase . '-sibling', "$actualBase/Allowed/Escape");
symlink("$actualBase/Allowed", "$actualBase/Alias");

try {
    $endpoint = dirname(__DIR__, 2) . '/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/third_party_icons.php';
    $source = file_get_contents($endpoint);
    $start = strpos($source, 'const FVPLUS_THIRD_PARTY_ICON_EXTENSIONS');
    $end = strpos($source, "\ntry {\n    fvplus_enforce_current_api_contract");
    if ($start === false || $end === false) throw new RuntimeException('Fixture declaration boundary not found.');
    $source = substr($source, $start, $end - $start);
    // Keep every production function, replacing only its fixed temporary cache root.
    eval(str_replace('/tmp/folderview.plus-cache/third-party-icons', "$root/cache", $source));
    $rejected = static function (callable $operation): bool {
        try { $operation(); return false; } catch (RuntimeException $error) { return true; }
    };
    $rows = [
        'folderEscapeRejected' => $rejected(static fn() => resolveThirdPartyIconFilePath('Escape', 'private.svg')),
        'folderListEscapeRejected' => $rejected(static fn() => listThirdPartyIconsInFolder('Escape')),
        'fileSiblingRejected' => $rejected(static fn() => resolveThirdPartyIconFilePath('Allowed', 'sibling-link.svg')),
        'fileOutsideRejected' => $rejected(static fn() => resolveThirdPartyIconFilePath('Allowed', 'outside-link.svg')),
        'insideFile' => file_get_contents(resolveThirdPartyIconFilePath('Allowed', 'inside.svg')) === $svg,
        'insideLink' => file_get_contents(resolveThirdPartyIconFilePath('Allowed', 'inside-link.svg')) === $svg,
        'insideAlias' => file_get_contents(resolveThirdPartyIconFilePath('Alias', 'inside.svg')) === $svg,
        'siblingDirectory' => file_get_contents(resolveThirdPartyIconFilePath('Allowed-sibling', 'sibling.svg')) === $svg,
        'linkedBase' => thirdPartyIconAssetPackStatus()['linked']
    ];
    $rows['icons'] = array_column(listThirdPartyIconsInFolder('Allowed')['icons'], 'name');
    $rows['count'] = countSupportedIconsInDirectory("$base/Allowed");
    $rows['folders'] = array_column(listThirdPartyFolders(), 'name');
    $index = listThirdPartyIconIndex();
    $rows['indexPaths'] = array_column($index['icons'], 'relativePath');
    // A cache written by the old implementation must never override safe enumeration.
    file_put_contents("$root/cache/folders.json", json_encode([
        'signature' => thirdPartyFolderListSignature($base), 'data' => [['name' => 'poisoned-old-cache', 'iconCount' => 1]]
    ]));
    $rows['oldCacheIgnored'] = !in_array('poisoned-old-cache', array_column(listThirdPartyFolders(), 'name'), true);
    echo json_encode($rows, JSON_THROW_ON_ERROR), "\n";
} finally {
    $remove = static function (string $entry) use (&$remove, $root): void {
        if ($entry !== $root && strpos($entry, $root . '/') !== 0) throw new RuntimeException('Fixture cleanup escaped its root.');
        if (is_link($entry) || !is_dir($entry)) { unlink($entry); return; }
        foreach (scandir($entry) as $name) if ($name !== '.' && $name !== '..') $remove("$entry/$name");
        rmdir($entry);
    };
    $remove($root);
}
