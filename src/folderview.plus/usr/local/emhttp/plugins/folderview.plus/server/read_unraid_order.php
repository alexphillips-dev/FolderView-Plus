<?php
  require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");
  echo json_encode(readUnraidOrder($_GET['type']));
?>