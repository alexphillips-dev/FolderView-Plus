<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    $scripts = dirToArrayOfFiles(pathToMultiDimArray('/boot/config/plugins/folderview.plus/scripts'), "/\..*{$type}.*\.js$/", "/.*\.disabled$/");
    foreach ($scripts as $script) {
        echo "<script src=\"";
        autov($script['path']);
        echo "\"></script>";
    }
?>