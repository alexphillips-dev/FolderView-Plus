(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderView3Apply = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const buildReportHtml = (options = {}) => {
        const report = options.report;
        if (!report) {
            return typeof options.fallbackHtml === 'function' ? options.fallbackHtml() : '';
        }
        const escapeHtml = options.escapeHtml;
        const formatTimestamp = options.formatTimestamp;
        const summary = report.summary;
        const selected = report.operations.filter((entry) => entry.selected);
        const unselected = report.operations.filter((entry) => !entry.selected);
        const operationHtml = report.operations.map((entry) => `
            <div class="fv-recovery-callout${entry.selected ? '' : ' is-warning'}">
                <strong>${escapeHtml(entry.selected ? 'Included' : 'Not selected')}</strong>
                <span>${escapeHtml(`${entry.label} (${entry.count})`)}</span>
            </div>
        `).join('');
        const warningHtml = report.warnings.map((warning) => `
            <div class="fv-recovery-callout is-warning">${escapeHtml(warning)}</div>
        `).join('');
        const nativeOptionHtml = summary.nativeAutostartCount > 0 ? `
            <label class="fv-recovery-callout is-warning">
                <input type="checkbox" data-fv-folderview3-native-autostart>
                <span><strong>Also replace native Docker autostart entries and waits</strong><br>This host-level operation is optional and participates in automatic rollback.</span>
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
                        <div class="fv-recovery-history-title">FolderView3 migration preview</div>
                        <div class="fv-recovery-history-copy">${escapeHtml(report.source.sourceName || (report.source.kind === 'installed' ? 'Installed FolderView3 configuration' : 'FolderView3 export'))}</div>
                    </div>
                    <span class="fv-recovery-history-badge">${escapeHtml(options.migrationResult ? 'Applied and verified' : 'No changes made')}</span>
                </div>
                <div class="fv-recovery-history-meta">
                    <span>${escapeHtml(`Docker ${summary.dockerFolderCount} folders / ${summary.dockerRuleCount} rules`)}</span>
                    <span>${escapeHtml(`VM ${summary.vmFolderCount} folders / ${summary.vmRuleCount} rules`)}</span>
                    <span>${escapeHtml(`Start order: ${summary.startOrderMode}`)}</span>
                    <span>${escapeHtml(`Appearance inactive: ${summary.appearanceProfileActive ? 'no' : 'yes'}`)}</span>
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

    const loadingHtml = (applying) => applying
        ? '<div class="fv-recovery-empty-state"><strong>Applying FolderView3 migration...</strong><span>Keep this page open while configuration is written, verified, or automatically restored.</span></div>'
        : '<div class="fv-recovery-empty-state"><strong>Inspecting FolderView3 configuration...</strong><span>This read-only preview may take a moment when custom styles are present.</span></div>';

    const runApply = async (options = {}) => {
        const report = options.report;
        const source = options.selectedSource;
        if (!report || !source || !report.source?.digest) {
            return null;
        }
        const includeNative = options.includeNativeAutostart === true;
        const nativeWarning = includeNative ? ' Native Docker autostart enablement and waits will also be replaced.' : '';
        const message = `Replace current FolderView Plus Docker folders, VM folders, compatible settings, start-order ownership, and Theme Workspace profile data? A rollback checkpoint and per-type backups will be created first.${nativeWarning}`;
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
