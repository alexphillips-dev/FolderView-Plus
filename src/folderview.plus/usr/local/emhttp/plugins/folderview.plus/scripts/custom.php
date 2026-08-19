<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    echo '<script src="' . fvplus_asset_url('/plugins/folderview.plus/scripts/runtime.image-fallbacks.js') . '"></script>';
    echo '<script src="' . fvplus_asset_url('/plugins/folderview.plus/scripts/folderviewplus.csp-events.js') . '"></script>';
    echo '<script src="' . fvplus_asset_url('/plugins/folderview.plus/scripts/folderviewplus.safe-dom.js') . '"></script>';
    $conditionalDockerLegacyAssets = !empty($fvplusDockerLegacyConditionalAssets);
    $conditionalScriptUrls = [];
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
            if ($conditionalDockerLegacyAssets) {
                ob_start();
                autov($resolved);
                $conditionalScriptUrls[] = (string)ob_get_clean();
            } else {
                echo "<script src=\"";
                autov($resolved);
                echo "\"></script>";
            }
        }
    }
    if ($conditionalDockerLegacyAssets) {
        emitJsonBootstrapMeta('fvplus-docker-custom-scripts', $conditionalScriptUrls);
        echo '<script src="'
            . htmlspecialchars(fvplus_asset_url('/plugins/folderview.plus/scripts/runtime.custom-script-loader.js'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '"></script>';
    }
?>
