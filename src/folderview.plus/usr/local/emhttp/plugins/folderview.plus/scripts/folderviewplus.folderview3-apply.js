(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.folderview3-report.js'));
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderView3Apply = factory(root.FolderViewPlusFoundationModules.folderView3Report);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(report) {
    const { buildReportHtml } = report;
    const loadingHtml = (applying, translate = (key, fallback) => fallback || key) => applying
        ? `<div class="fv-recovery-empty-state"><strong>${translate('import.folderview3.applying', 'Applying FolderView3 migration...')}</strong><span>${translate('import.folderview3.applying-help', 'Keep this page open while configuration is written, verified, or automatically restored.')}</span></div>`
        : `<div class="fv-recovery-empty-state"><strong>${translate('import.folderview3.inspecting', 'Inspecting FolderView3 configuration...')}</strong><span>${translate('import.folderview3.inspecting-help', 'This read-only preview may take a moment when custom styles are present.')}</span></div>`;
    const runApply = async (options = {}) => {
        const report = options.report;
        const source = options.selectedSource;
        if (!report || !source || !report.source?.digest) {
            return null;
        }
        const includeNative = options.includeNativeAutostart === true;
        const translate = options.translate || ((key, fallback) => fallback || key);
        const nativeWarning = includeNative ? translate('import.folderview3.confirm-native-suffix', ' Native Docker autostart enablement and waits will also be replaced.') : '';
        const message = `${translate('import.folderview3.confirm-apply', 'Replace current FolderView Plus Docker folders, VM folders, compatible settings, start-order ownership, and Theme Workspace profile data? A rollback checkpoint and per-type backups will be created first.')}${nativeWarning}`;
        if (typeof options.confirm !== 'function' || !options.confirm(message)) {
            return null;
        }
        return options.postJson('/plugins/folderview.plus/server/environment_snapshot.php', {
            action: 'apply_folderview3',
            sourceKind: source.kind,
            payload: String(source.text || ''),
            fileName: String(source.name || ''),
            expectedDigest: report.source.digest,
            includeNativeAutostart: includeNative ? '1' : '0'
        }, { retries: 0 });
    };

    return Object.freeze({ buildReportHtml, loadingHtml, runApply });
}));
