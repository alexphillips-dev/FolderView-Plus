<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
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
        echo '<script>'
            . 'let fvplusDockerCustomScriptsPromise = null;'
            . 'window.FolderViewPlusDockerLoadCustomScripts = () => {'
            . 'if (fvplusDockerCustomScriptsPromise) { return fvplusDockerCustomScriptsPromise; }'
            . 'fvplusDockerCustomScriptsPromise = (async () => {'
            . 'const sources = '
            . json_encode($conditionalScriptUrls, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
            . ';'
            . 'for (const src of sources) {'
            . 'await new Promise((resolve, reject) => {'
            . 'const script = document.createElement("script");'
            . 'script.src = src;'
            . 'script.async = false;'
            . 'script.dataset.fvplusDockerLegacyCustom = "true";'
            . 'script.onload = resolve;'
            . 'script.onerror = () => reject(new Error("A Docker custom script could not be loaded."));'
            . '(document.head || document.documentElement).appendChild(script);'
            . '});'
            . '}'
            . '})();'
            . 'return fvplusDockerCustomScriptsPromise;'
            . '};'
            . '</script>';
    }
?>
