<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    $seen = [];
    foreach (getCustomOverrideDirs('scripts') as $scriptsDir) {
        $scripts = dirToArrayOfFiles(pathToMultiDimArray($scriptsDir), "/\..*{$type}.*\.js$/", "/.*\.disabled$/");
        foreach ($scripts as $script) {
            if (!is_array($script) || empty($script['path']) || isset($seen[$script['path']])) {
                continue;
            }
            $seen[$script['path']] = true;
            echo "<script src=\"";
            autov($script['path']);
            echo "\"></script>";
        }
    }
?>
