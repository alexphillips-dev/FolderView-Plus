(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderView3Report = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const buildReportHtml = (options = {}) => {
        const report = options.report;
        if (!report) return typeof options.fallbackHtml === 'function' ? options.fallbackHtml() : '';
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
        const operationLabels = { "docker-folders": translate("common.repair.replace-docker-folders-1cef1f", "Replace Docker folders"), "vm-folders": translate("common.repair.replace-vm-folders-0d78f8", "Replace VM folders"), "docker-rules": translate("common.repair.convert-docker-regex-rules-47b9f6", "Convert Docker regex rules"), "vm-rules": translate("common.repair.convert-vm-regex-rules-9af627", "Convert VM regex rules"), "settings-defaults": translate("common.repair.convert-compatible-settings-and-defaults-594f8b", "Convert compatible settings and defaults"), "docker-start-order": translate("common.repair.convert-folderview3-start-order-ownership-770099", "Convert FolderView3 start-order ownership"), "native-autostart": translate("common.repair.reapply-native-docker-autostart-enablement-and-waits-0505bc", "Reapply native Docker autostart enablement and waits"), "organizer-registry": translate("common.repair.folderview3-native-organizer-registry-24f28d", "FolderView3 native organizer registry") };
        const startOrderLabels = { 'docker-page': translate("common.repair.docker-page-order-8a2b8b", "Docker page order"), unmanaged: translate('settings.start-order.unmanaged', 'Leave Unraid order unmanaged'), 'custom-batches': translate('settings.start-order.custom-batches', 'Custom startup batches') };
        const selected = report.operations.filter((entry) => entry.selected);
        const unselected = report.operations.filter((entry) => !entry.selected);
        const operationHtml = report.operations.map((entry) => `
            <div class="fv-recovery-callout${entry.selected ? '' : ' is-warning'}">
                <strong>${escapeHtml(entry.selected ? translate("legacy.surface.ba829a98b7994088", "Included") : translate("common.repair.not-selected-df12ae", "Not selected"))}</strong>
                <span>${escapeHtml(`${entry.id === 'appearance-profile' ? translate('import.folderview3.appearance-profiles', 'Add inactive FolderView3 appearance profiles') : (operationLabels[entry.id] || entry.label)} (${entry.count})`)}</span>
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
            <button type="button" data-fv-folderview3-action="apply"><i class="fa fa-check"></i> ${escapeHtml(translate("common.repair.apply-verified-migration-eacb3d", "Apply verified migration"))}</button>
        `;
        return `
            <article class="fv-recovery-history-card fv-recovery-environment-card">
                <div class="fv-recovery-history-head">
                    <div>
                        <div class="fv-recovery-history-title">${escapeHtml(translate('import.folderview3.preview-title', 'FolderView3 migration preview'))}</div>
                        <div class="fv-recovery-history-copy">${escapeHtml(report.source.sourceName || (report.source.kind === 'installed' ? translate("common.repair.installed-folderview3-configuration-61ef4d", "Installed FolderView3 configuration") : translate("common.repair.folderview3-export-1ed0bb", "FolderView3 export")))}</div>
                    </div>
                    <span class="fv-recovery-history-badge">${escapeHtml(options.migrationResult ? translate("common.repair.applied-and-verified-277eae", "Applied and verified") : translate("common.repair.no-changes-made-3e54c2", "No changes made"))}</span>
                </div>
                <div class="fv-recovery-history-meta">
                    <span>${escapeHtml(translate("common.repair.docker-folders-1-rules-2-38e1e6", "Docker — folders: $1; rules: $2.", summary.dockerFolderCount, summary.dockerRuleCount))}</span>
                    <span>${escapeHtml(translate("common.repair.vms-folders-1-rules-2-c07c56", "VMs — folders: $1; rules: $2.", summary.vmFolderCount, summary.vmRuleCount))}</span>
                    <span>${escapeHtml(translate("common.repair.start-order-1-b1954e", "Start order: $1", startOrderLabels[summary.startOrderMode] || summary.startOrderMode))}</span>
                    <span>${escapeHtml(translate("common.repair.appearance-profile-1-2f7650", "Appearance profile: $1", summary.appearanceProfileActive ? translate("legacy.surface.92340695899bd2d8", "Active") : translate("common.repair.inactive-ac7c94", "Inactive")))}</span>
                    <span>${escapeHtml(translate('import.folderview3.order-summary', 'Saved folder order: Docker $1; VMs $2.', orderLabels[summary.dockerOrderStatus] || orderLabels.missing, orderLabels[summary.vmOrderStatus] || orderLabels.missing))}</span>
                    <span>${escapeHtml(translate('import.folderview3.disabled-profile-count', 'Separate profiles for disabled themes: $1.', summary.disabledAppearanceProfileCount || 0))}</span>
                    <span>${escapeHtml(translate("common.repair.operations-included-1-excluded-2-caf034", "Operations included: $1; excluded: $2.", selected.length, unselected.length))}</span>
                </div>
                <div class="fv-recovery-environment-meta">
                    <span>${escapeHtml(translate("common.repair.source-plugin-version-1-20e8d3", "Source plugin version: $1", report.source.pluginVersion || translate("common.runtime.unknown", "Unknown")))}</span>
                    <span>${escapeHtml(report.source.exportedAt ? translate("common.repair.exported-1-202a0e", "Exported: $1", formatTimestamp(report.source.exportedAt)) : translate("common.repair.export-time-unavailable-f3434a", "Export time unavailable"))}</span>
                    <span>${escapeHtml(translate("common.repair.optional-native-autostart-entries-1-d67df3", "Optional native autostart entries: $1", summary.nativeAutostartCount))}</span>
                    <span>${escapeHtml(translate("common.repair.unmapped-organizer-entries-1-70f846", "Unmapped organizer entries: $1", summary.organizerRegistryCount))}</span>
                </div>
                <div class="fv-folderview3-operation-list">${operationHtml}</div>
                ${warningHtml}
                <div class="backup-actions fv-recovery-environment-actions">
                    <button type="button" data-fv-folderview3-action="download-report"><i class="fa fa-download"></i> ${escapeHtml(translate("common.repair.download-migration-report-3593a0", "Download migration report"))}</button>
                    ${applyHtml}
                </div>
            </article>
        `;
    };
    return Object.freeze({ buildReportHtml });
}));
