<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    $conditionalDockerLegacyAssets = !empty($fvplusDockerLegacyConditionalAssets);
    $seen = [];
    foreach (getCustomOverrideDirs('styles') as $stylesDir) {
        $baseDir = realpath($stylesDir);
        if ($baseDir === false) {
            continue;
        }
        $styles = dirToArrayOfFiles(pathToMultiDimArray($stylesDir), "/\..*{$type}.*\.css$/", "/.*\.disabled$/");
        foreach ($styles as $style) {
            if (!is_array($style) || empty($style['path'])) {
                continue;
            }
            $resolved = realpath($style['path']);
            if ($resolved === false || strpos($resolved, $baseDir . '/') !== 0) {
                continue;
            }
            if (isset($seen[$resolved])) {
                continue;
            }
            $seen[$resolved] = true;
            echo $conditionalDockerLegacyAssets
                ? "<link rel=\"stylesheet\" media=\"not all\" data-fvplus-docker-legacy-style=\"true\" href=\""
                : "<link rel=\"stylesheet\" href=\"";
            autov($resolved);
            echo  "\">";
        }
    }
?>
