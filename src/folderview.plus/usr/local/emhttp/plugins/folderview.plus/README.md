####FolderView Plus###
FolderView Plus lets you create folders for grouping Dockers and VMs together to help with organization. Especially useful if you're using docker-compose.
Getting Started: A new button named "Add Folder" will appear at the bottom of the docker/VM tab next to "Add Container/VM".
<script src="/plugins/folderview.plus/scripts/include/CLDRPluralRuleParser.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.messagestore.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.fallbacks.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.language.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.parser.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.js"></script>
<script src="/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.bidi.js"></script>
<script id="folderviewplus-script">const i18nc = {'locale': document.documentElement.lang};const i18nl = {'en': '/plugins/folderview.plus/langs/en.json'};i18nl[`${document.documentElement.lang}`] = `/plugins/folderview.plus/langs/${document.documentElement.lang}.json`;$.i18n(i18nc).load(i18nl).then(() => {$('#folderviewplus-script').parent()[0].childNodes[0].nodeValue = $.i18n('folderviewplus-desc')}, ()=>{});</script>
