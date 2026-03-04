<?php
    if($_SESSION['locale'] == "") {
        $loc = 'en'; 
    } else {
        $loc = substr($_SESSION['locale'], 0, 2);
    }
?>
<script src="/plugins/folderview.plus/scripts/include/CLDRPluralRuleParser.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.messagestore.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.fallbacks.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.language.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.parser.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.bidi.js"></script>
<script>
    if(typeof folderi18n === 'undefined' ) {
        folderi18n = () => {};
    }
    $.i18n({
        'locale': '<? echo $loc?>'
    }).load({
        <?php
            if($loc != 'en') {
                echo "'$loc': '/plugins/folderview.plus/langs/$loc.json',";
            }
        ?>'en': '/plugins/folderview.plus/langs/en.json'
    }).then(folderi18n, ()=>{});
</script>