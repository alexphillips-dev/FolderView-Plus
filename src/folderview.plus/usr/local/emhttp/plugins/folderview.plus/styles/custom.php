<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    $seen = [];
    foreach (getCustomOverrideDirs('styles') as $stylesDir) {
        $styles = dirToArrayOfFiles(pathToMultiDimArray($stylesDir), "/\..*{$type}.*\.css$/", "/.*\.disabled$/");
        foreach ($styles as $style) {
            if (!is_array($style) || empty($style['path']) || isset($seen[$style['path']])) {
                continue;
            }
            $seen[$style['path']] = true;
            echo "<link rel=\"stylesheet\" href=\"";
            autov($style['path']);
            echo  "\">";
        }
    }
?>
