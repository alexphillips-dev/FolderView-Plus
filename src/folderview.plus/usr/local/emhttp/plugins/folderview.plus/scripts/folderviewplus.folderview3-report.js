(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderView3Report = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const buildReportHtml = (options = {}) => {
        const report = options.report;
        if (!report) {
            return typeof options.fallbackHtml === 'function' ? options.fallbackHtml() : '';
        }
        const escapeHtml = options.escapeHtml;
        const formatTimestamp = options.formatTimestamp;
        const translate = options.translate || ((key, fallback, ...params) => globalThis?.FolderViewPlusI18n?.t?.(key, fallback, ...params) || String(fallback || key).replace(/\$(\d+)/g, (match, index) => String(params[Number(index) - 1] ?? match)));
        const summary = report.summary;
        const warningMessages = {
            'A FolderView3 order snapshot is invalid; folder configuration order was used.': translate('import.folderview3.order-invalid', 'A FolderView3 order snapshot is invalid; folder configuration order was used.'),
            'Duplicate FolderView3 order entries were ignored.': translate('import.folderview3.order-duplicates', 'Duplicate FolderView3 order entries were ignored.'),
            'Unknown folder references in FolderView3 order snapshots were ignored.': translate('import.folderview3.order-unknown', 'Unknown folder references in FolderView3 order snapshots were ignored.'),
            'Folder order is preserved; positions of unassigned items in the Unraid page are not imported.': translate('import.folderview3.order-unassigned', 'Folder order is preserved; positions of unassigned items in the Unraid page are not imported.'),
            'Theme source metadata was not converted into managed updates. Scan the original theme source to manage future updates.': translate('import.folderview3.theme-source', 'Theme source metadata was not converted into managed updates. Scan the original theme source to manage future updates.'),
            'Custom styles without a recognized FolderView3 page scope were excluded.': translate('import.folderview3.theme-unscoped', 'Custom styles without a recognized FolderView3 page scope were excluded.'),
            'Disabled themes were preserved as separate inactive appearance profiles; they are not included in the main imported profile.': translate('import.folderview3.theme-disabled', 'Disabled themes were preserved as separate inactive appearance profiles; they are not included in the main imported profile.'),
            'Imported CSS may use FolderView3 selectors or variables that differ in FolderView Plus. Preview each appearance profile before activation.': translate('import.folderview3.theme-compatibility', 'Imported CSS may use FolderView3 selectors or variables that differ in FolderView Plus. Preview each appearance profile before activation.')
        };
        const orderLabels = {
            imported: translate('import.folderview3.order-imported', 'Imported'),
            missing: translate('import.folderview3.order-fallback', 'Configuration order'),
            empty: translate('import.folderview3.order-empty', 'No saved order'),
            invalid: translate('import.folderview3.order-invalid-status', 'Invalid snapshot; configuration order')
        };
        const selected = report.operations.filter((entry) => entry.selected);
        const unselected = report.operations.filter((entry) => !entry.selected);
        const operationHtml = report.operations.map((entry) => `
            <div class="fv-recovery-callout${entry.selected ? '' : ' is-warning'}">
                <strong>${escapeHtml(entry.selected ? 'Included' : 'Not selected')}</strong>
                <span>${escapeHtml(`${entry.id === 'appearance-profile' ? translate('import.folderview3.appearance-profiles', 'Add inactive FolderView3 appearance profiles') : entry.label} (${entry.count})`)}</span>
            </div>
        `).join('');
        const warningHtml = report.warnings.map((warning) => `
            <div class="fv-recovery-callout is-warning">${escapeHtml(Object.prototype.hasOwnProperty.call(warningMessages, warning) ? warningMessages[warning] : warning)}</div>
        `).join('');
        const nativeOptionHtml = summary.nativeAutostartCount > 0 ? `
            <label class="fv-recovery-callout is-warning">
                <input type="checkbox" data-fv-folderview3-native-autostart>
                <span><strong>${escapeHtml(translate('import.folderview3.native-autostart', 'Also replace native Docker autostart entries and waits'))}</strong><br>${escapeHtml(translate('import.folderview3.native-autostart-help', 'This host-level operation is optional and participates in automatic rollback.'))}</span>
            </label>
        ` : '';
        const applyHtml = options.migrationResult ? '' : `
            ${nativeOptionHtml}
            <button type="button" data-fv-folderview3-action="apply"><i class="fa fa-check"></i> Apply verified migration</button>
        `;
        return `
            <article class="fv-recovery-history-card fv-recovery-environment-card">
                <div class="fv-recovery-history-head">
                    <div>
                        <div class="fv-recovery-history-title">${escapeHtml(translate('import.folderview3.preview-title', 'FolderView3 migration preview'))}</div>
                        <div class="fv-recovery-history-copy">${escapeHtml(report.source.sourceName || (report.source.kind === 'installed' ? 'Installed FolderView3 configuration' : 'FolderView3 export'))}</div>
                    </div>
                    <span class="fv-recovery-history-badge">${escapeHtml(options.migrationResult ? 'Applied and verified' : 'No changes made')}</span>
                </div>
                <div class="fv-recovery-history-meta">
                    <span>${escapeHtml(`Docker ${summary.dockerFolderCount} folders / ${summary.dockerRuleCount} rules`)}</span>
                    <span>${escapeHtml(`VM ${summary.vmFolderCount} folders / ${summary.vmRuleCount} rules`)}</span>
                    <span>${escapeHtml(`Start order: ${summary.startOrderMode}`)}</span>
                    <span>${escapeHtml(`Appearance inactive: ${summary.appearanceProfileActive ? 'no' : 'yes'}`)}</span>
                    <span>${escapeHtml(translate('import.folderview3.order-summary', 'Saved folder order: Docker $1; VMs $2.', orderLabels[summary.dockerOrderStatus] || orderLabels.missing, orderLabels[summary.vmOrderStatus] || orderLabels.missing))}</span>
                    <span>${escapeHtml(translate('import.folderview3.disabled-profile-count', 'Separate profiles for disabled themes: $1.', summary.disabledAppearanceProfileCount || 0))}</span>
                    <span>${escapeHtml(`${selected.length} included / ${unselected.length} excluded operations`)}</span>
                </div>
                <div class="fv-recovery-environment-meta">
                    <span>${escapeHtml(`Source plugin ${report.source.pluginVersion || 'unknown'}`)}</span>
                    <span>${escapeHtml(report.source.exportedAt ? `Exported ${formatTimestamp(report.source.exportedAt)}` : 'Export time unavailable')}</span>
                    <span>${escapeHtml(`${summary.nativeAutostartCount} optional native autostart entries`)}</span>
                    <span>${escapeHtml(`${summary.organizerRegistryCount} unmapped organizer entries`)}</span>
                </div>
                <div class="fv-folderview3-operation-list">${operationHtml}</div>
                ${warningHtml}
                <div class="backup-actions fv-recovery-environment-actions">
                    <button type="button" data-fv-folderview3-action="download-report"><i class="fa fa-download"></i> Download migration report</button>
                    ${applyHtml}
                </div>
            </article>
        `;
    };
    return Object.freeze({ buildReportHtml });
}));
