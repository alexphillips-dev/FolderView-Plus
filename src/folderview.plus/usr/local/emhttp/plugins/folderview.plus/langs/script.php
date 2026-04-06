<?php
    require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
    if($_SESSION['locale'] == "") {
        $loc = 'en'; 
    } else {
        $loc = substr($_SESSION['locale'], 0, 2);
    }
    $localeAssets = [
        'en' => fvplus_versioned_plugin_asset_path('/plugins/folderview.plus/langs/en.json')
    ];
    if ($loc != 'en') {
        $localeAssets[$loc] = fvplus_versioned_plugin_asset_path("/plugins/folderview.plus/langs/$loc.json");
    }
?>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/CLDRPluralRuleParser.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.messagestore.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.fallbacks.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.language.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.parser.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.bidi.js')?>"></script>
<script>
    if(typeof folderi18n === 'undefined' ) {
        folderi18n = () => {};
    }
    $.i18n({
        'locale': '<?php echo $loc?>'
    }).load(<?php echo json_encode($localeAssets, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>).then(folderi18n, ()=>{});
</script>
