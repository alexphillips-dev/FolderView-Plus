####FolderView Plus###
<span id="folderviewplus-desc">FolderView Plus adds powerful folder-based organization to Unraid Docker and VM tabs with nested folder trees, starter templates, smart assignment rules, custom icons, and one-click bulk actions.</span>
Quick start: Open the Docker or VM tab, click "Add Folder", then move items manually or auto-assign them with rules.
<script src="/plugins/folderview.plus/scripts/include/CLDRPluralRuleParser.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.messagestore.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.fallbacks.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.language.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.parser.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.bidi.js"></script>
<script id="folderviewplus-script">
(() => {
    const target = document.getElementById('folderviewplus-desc');
    if (!target) {
        return;
    }
    const fallback = String(target.textContent || '').trim();
    const locale = document.documentElement.lang || 'en';
    const i18nc = { locale };
    const i18nl = { en: '/plugins/folderview.plus/langs/en.json' };
    i18nl[locale] = `/plugins/folderview.plus/langs/${locale}.json`;
    $.i18n(i18nc).load(i18nl).then(() => {
        const translated = String($.i18n('folderviewplus-desc') || '').trim();
        target.textContent = translated && translated !== 'folderviewplus-desc' ? translated : fallback;
    }, () => {
        target.textContent = fallback;
    });
})();
</script>
