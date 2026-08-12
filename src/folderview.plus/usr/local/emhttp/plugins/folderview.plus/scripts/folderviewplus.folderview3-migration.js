(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    const moduleApi = factory();
    root.FolderViewPlusFoundationModules.folderView3Migration = moduleApi;
    const request = root.FolderViewPlusRequest;
    const bootstrap = () => {
        if (!request?.getJson || !request?.postJson || !root.document) {
            return;
        }
        const api = moduleApi.createApi({ window: root, document: root.document });
        root.FolderViewPlusFoundationModules.folderView3MigrationApi = api;
        api.bind();
    };
    if (root.document?.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
        const windowRef = deps.window || (typeof window !== 'undefined' ? window : null);
        const documentRef = deps.document || windowRef?.document || null;
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'));
        const request = windowRef?.FolderViewPlusRequest;
        const apiGetJson = typeof deps.apiGetJson === 'function' ? deps.apiGetJson : ((url, options = {}) => request.getJson(url, options));
        const apiPostJson = typeof deps.apiPostJson === 'function' ? deps.apiPostJson : ((url, data = {}, options = {}) => request.postJson(url, data, options));
        const selectJsonFile = typeof deps.selectJsonFile === 'function' ? deps.selectJsonFile : (() => new Promise((resolve, reject) => {
            const input = documentRef.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.addEventListener('change', () => {
                const file = input.files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new windowRef.FileReader();
                reader.onload = () => resolve({ name: file.name, text: String(reader.result || '') });
                reader.onerror = () => reject(reader.error || new Error('Unable to read the selected JSON file.'));
                reader.readAsText(file);
            }, { once: true });
            input.click();
        }));
        const downloadFile = typeof deps.downloadFile === 'function' ? deps.downloadFile : ((name, content) => {
            const href = windowRef.URL.createObjectURL(new windowRef.Blob([String(content || '')], { type: 'application/json;charset=utf-8' }));
            const link = documentRef.createElement('a');
            link.href = href;
            link.download = String(name || 'FolderView3 Migration Report.json');
            link.click();
            windowRef.setTimeout(() => windowRef.URL.revokeObjectURL(href), 0);
        });
        const toPrettyJson = typeof deps.toPrettyJson === 'function' ? deps.toPrettyJson : ((value) => JSON.stringify(value, null, 2));
        const showError = typeof deps.showError === 'function' ? deps.showError : ((title, error) => {
            const text = String(error?.message || error || 'Unknown error');
            if (typeof windowRef?.alert === 'function') {
                windowRef.alert(`${title}: ${text}`);
            }
        });
        const showToastMessage = typeof deps.showToastMessage === 'function' ? deps.showToastMessage : (() => {});
        const formatTimestamp = typeof deps.formatTimestamp === 'function' ? deps.formatTimestamp : ((value) => {
            const parsed = Date.parse(String(value || ''));
            return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : String(value || '');
        });
        let controller = null;
        let mode = 'idle';
        let detection = null;
        let report = null;
        let selectedSource = null;

        const normalizeDetection = (value) => {
            const source = value && typeof value === 'object' ? value : {};
            return {
                available: source.available === true,
                pluginVersion: String(source.pluginVersion || '').trim(),
                componentCount: Math.max(0, Number(source.componentCount) || 0),
                components: Array.isArray(source.components) ? source.components.map(String) : [],
                canPreview: source.canPreview === true,
                dockerFolderCount: Math.max(0, Number(source.dockerFolderCount) || 0),
                vmFolderCount: Math.max(0, Number(source.vmFolderCount) || 0),
                customStyleCount: Math.max(0, Number(source.customStyleCount) || 0),
                nativeAutostartCount: Math.max(0, Number(source.nativeAutostartCount) || 0)
            };
        };

        const normalizeReport = (value) => {
            const source = value && typeof value === 'object' ? value : {};
            const summary = source.summary && typeof source.summary === 'object' ? source.summary : {};
            const sourceMeta = source.source && typeof source.source === 'object' ? source.source : {};
            return {
                kind: String(source.kind || 'folderview3_migration_plan'),
                schemaVersion: Math.max(1, Number(source.schemaVersion) || 1),
                createdAt: String(source.createdAt || '').trim(),
                source: {
                    kind: String(sourceMeta.kind || 'export').trim(),
                    sourceName: String(sourceMeta.sourceName || '').trim(),
                    pluginVersion: String(sourceMeta.pluginVersion || '').trim(),
                    unraidVersion: String(sourceMeta.unraidVersion || '').trim(),
                    exportedAt: String(sourceMeta.exportedAt || '').trim(),
                    digest: String(sourceMeta.digest || '').trim()
                },
                summary: {
                    dockerFolderCount: Math.max(0, Number(summary.dockerFolderCount) || 0),
                    vmFolderCount: Math.max(0, Number(summary.vmFolderCount) || 0),
                    dockerRuleCount: Math.max(0, Number(summary.dockerRuleCount) || 0),
                    vmRuleCount: Math.max(0, Number(summary.vmRuleCount) || 0),
                    appearanceProfileId: String(summary.appearanceProfileId || '').trim(),
                    appearanceProfileActive: summary.appearanceProfileActive === true,
                    startOrderMode: String(summary.startOrderMode || 'docker-page').trim(),
                    nativeAutostartCount: Math.max(0, Number(summary.nativeAutostartCount) || 0),
                    organizerRegistryCount: Math.max(0, Number(summary.organizerRegistryCount) || 0)
                },
                operations: Array.isArray(source.operations) ? source.operations.map((entry) => ({
                    id: String(entry?.id || '').trim(),
                    category: String(entry?.category || '').trim(),
                    label: String(entry?.label || '').trim(),
                    selected: entry?.selected === true,
                    count: Math.max(0, Number(entry?.count) || 0)
                })).filter((entry) => entry.id && entry.label) : [],
                warnings: Array.isArray(source.warnings)
                    ? source.warnings.map((entry) => String(entry || '').trim()).filter(Boolean)
                    : []
            };
        };

        const emptyHtml = () => `
            <div class="fv-recovery-empty-state">
                <strong>FolderView3 migration is read-only until you approve an apply plan.</strong>
                <span>Detect an installed FolderView3 configuration or preview a FolderView3 export. Previewing never writes plugin or Unraid configuration.</span>
            </div>
        `;

        const buildDetectionHtml = () => {
            if (!detection) {
                return emptyHtml();
            }
            if (!detection.available) {
                return `
                    <div class="fv-recovery-empty-state">
                        <strong>No installed FolderView3 configuration detected.</strong>
                        <span>You can still preview a FolderView3 full-export JSON from another server.</span>
                    </div>
                `;
            }
            const previewButton = detection.canPreview
                ? '<button type="button" data-fv-folderview3-action="preview-installed"><i class="fa fa-eye"></i> Preview installed configuration</button>'
                : '';
            return `
                <article class="fv-recovery-history-card fv-recovery-environment-card">
                    <div class="fv-recovery-history-head">
                        <div>
                            <div class="fv-recovery-history-title">FolderView3 detected</div>
                            <div class="fv-recovery-history-copy">Version ${escapeHtml(detection.pluginVersion || 'unknown')} with ${escapeHtml(String(detection.componentCount))} readable component${detection.componentCount === 1 ? '' : 's'}.</div>
                        </div>
                        <span class="fv-recovery-history-badge">Read only</span>
                    </div>
                    <div class="fv-recovery-history-meta">
                        <span>${escapeHtml(`Docker ${detection.dockerFolderCount} folders`)}</span>
                        <span>${escapeHtml(`VM ${detection.vmFolderCount} folders`)}</span>
                        <span>${escapeHtml(`${detection.customStyleCount} custom styles`)}</span>
                        <span>${escapeHtml(`${detection.nativeAutostartCount} native autostart entries`)}</span>
                    </div>
                    <div class="backup-actions fv-recovery-environment-actions">${previewButton}</div>
                </article>
            `;
        };

        const buildReportHtml = () => {
            if (!report) {
                return buildDetectionHtml();
            }
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
            return `
                <article class="fv-recovery-history-card fv-recovery-environment-card">
                    <div class="fv-recovery-history-head">
                        <div>
                            <div class="fv-recovery-history-title">FolderView3 migration preview</div>
                            <div class="fv-recovery-history-copy">${escapeHtml(report.source.sourceName || (report.source.kind === 'installed' ? 'Installed FolderView3 configuration' : 'FolderView3 export'))}</div>
                        </div>
                        <span class="fv-recovery-history-badge">No changes made</span>
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
                    </div>
                </article>
            `;
        };

        const render = () => {
            const host = documentRef?.querySelector?.('#fv-recovery-folderview3-summary');
            if (!host) {
                return;
            }
            host.innerHTML = mode === 'loading'
                ? '<div class="fv-recovery-empty-state"><strong>Inspecting FolderView3 configuration...</strong><span>This read-only preview may take a moment when custom styles are present.</span></div>'
                : buildReportHtml();
        };

        const detectInstalled = async () => {
            mode = 'loading';
            report = null;
            render();
            try {
                const response = await apiGetJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    data: { action: 'detect_folderview3' }
                });
                detection = normalizeDetection(response?.detection || {});
                mode = 'detection';
                render();
                return detection;
            } catch (error) {
                mode = 'idle';
                render();
                showError('FolderView3 detection failed', error);
                throw error;
            }
        };

        const previewSource = async (source) => {
            mode = 'loading';
            report = null;
            render();
            try {
                const response = await apiPostJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    action: 'preview_folderview3',
                    sourceKind: source.kind,
                    payload: String(source.text || ''),
                    fileName: String(source.name || '')
                });
                report = normalizeReport(response?.report || {});
                selectedSource = source;
                mode = 'preview';
                render();
                showToastMessage({
                    title: 'FolderView3 preview ready',
                    message: 'Migration report created without changing configuration.',
                    level: 'success',
                    durationMs: 3600
                });
                return report;
            } catch (error) {
                mode = 'idle';
                render();
                showError('FolderView3 migration preview failed', error);
                throw error;
            }
        };

        const previewInstalled = () => previewSource({
            kind: 'installed',
            name: 'Installed FolderView3 configuration',
            text: ''
        });

        const previewExport = async () => {
            let selected = null;
            try {
                selected = await selectJsonFile();
            } catch (error) {
                showError('FolderView3 export selection failed', error);
                return null;
            }
            if (!selected) {
                return null;
            }
            return previewSource({ kind: 'export', name: selected.name, text: selected.text });
        };

        const downloadReport = () => {
            if (!report) {
                return;
            }
            const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z');
            downloadFile(`FolderView3 Migration Report ${stamp}.json`, toPrettyJson(report));
        };

        const handleClick = (event) => {
            const button = event.target?.closest?.('[data-fv-folderview3-action]');
            if (!button || !documentRef?.contains?.(button)) {
                return;
            }
            const action = String(button.getAttribute('data-fv-folderview3-action') || '');
            if (action === 'detect') {
                detectInstalled();
            } else if (action === 'preview-installed') {
                previewInstalled();
            } else if (action === 'preview-export') {
                previewExport();
            } else if (action === 'download-report') {
                downloadReport();
            }
        };

        const bind = () => {
            if (!documentRef || controller) {
                render();
                return;
            }
            controller = new AbortController();
            documentRef.addEventListener('click', handleClick, { signal: controller.signal });
            render();
        };

        const disconnect = () => {
            controller?.abort?.();
            controller = null;
        };

        return Object.freeze({
            bind,
            disconnect,
            render,
            detectInstalled,
            previewInstalled,
            previewExport,
            downloadReport,
            getReport: () => report,
            getSelectedSource: () => selectedSource
        });
    };

    return Object.freeze({ createApi });
}));
