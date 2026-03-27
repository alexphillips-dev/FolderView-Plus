####FolderView Plus###
<span id="folderviewplus-desc">FolderView Plus adds folder-based organization to Unraid Docker, VM, and Dashboard views with nested folders, the Setup Assistant, smart rules, bulk assignment, reusable templates, recovery tools, and copyable diagnostics.</span>
Quick start: Open `Settings -> FolderView Plus`, stay in `Basic` for normal folder management, and switch to `Advanced` for Bulk Assignment, Rules, Recovery, Operations, and Diagnostics. Changes save automatically.
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
