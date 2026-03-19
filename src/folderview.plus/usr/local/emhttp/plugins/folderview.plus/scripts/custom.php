<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    $seen = [];
    foreach (getCustomOverrideDirs('scripts') as $scriptsDir) {
        $baseDir = realpath($scriptsDir);
        if ($baseDir === false) {
            continue;
        }
        $scripts = dirToArrayOfFiles(pathToMultiDimArray($scriptsDir), "/\..*{$type}.*\.js$/", "/.*\.disabled$/");
        foreach ($scripts as $script) {
            if (!is_array($script) || empty($script['path'])) {
                continue;
            }
            $resolved = realpath($script['path']);
            if ($resolved === false || strpos($resolved, $baseDir . '/') !== 0) {
                continue;
            }
            if (isset($seen[$resolved])) {
                continue;
            }
            $seen[$resolved] = true;
            echo "<script src=\"";
            autov($resolved);
            echo "\"></script>";
        }
    }
?>
