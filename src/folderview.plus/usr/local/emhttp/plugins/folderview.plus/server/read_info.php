<?php
    require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
    echo json_encode(readInfo($_GET['type']));
?>