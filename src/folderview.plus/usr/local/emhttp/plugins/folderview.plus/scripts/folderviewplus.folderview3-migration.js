(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.folderview3-apply.js'), require('./folderviewplus.folderview3-model.js'));
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    const moduleApi = factory(root.FolderViewPlusFoundationModules.folderView3Apply, root.FolderViewPlusFoundationModules.folderView3Model);
    root.FolderViewPlusFoundationModules.folderView3Migration = moduleApi;
    const request = root.FolderViewPlusRequest;
    const bootstrap = () => {
        if (!request?.getJson || !request?.postJson || !root.document) {
            return;
        }
        root.FolderViewPlusFoundationModules.folderView3MigrationApi?.disconnect?.();
        const api = moduleApi.createApi({ window: root, document: root.document });
        root.FolderViewPlusFoundationModules.folderView3MigrationApi = api;
        api.bind();
    };
    if (root.document?.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function(defaultApply, model) {
    const createApi = (deps = {}) => {
    const repairT9b1afc29 = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
        const windowRef = deps.window || (typeof window !== 'undefined' ? window : null);
        const documentRef = deps.document || windowRef?.document || null;
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'));
        const request = windowRef?.FolderViewPlusRequest;
        const applyModule = deps.applyModule || windowRef?.FolderViewPlusFoundationModules?.folderView3Apply || defaultApply;
        const apiGetJson = typeof deps.apiGetJson === 'function' ? deps.apiGetJson : ((url, options = {}) => request.getJson(url, options));
        const apiPostJson = typeof deps.apiPostJson === 'function' ? deps.apiPostJson : ((url, data = {}, options = {}) => request.postJson(url, data, options));
        const selectJsonFile = typeof deps.selectJsonFile === 'function' ? deps.selectJsonFile : (() => new Promise((resolve, reject) => {
            const input = documentRef.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.addEventListener('cancel', () => resolve(null), { once: true });
            input.addEventListener('change', () => {
                const file = input.files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                if (file.size > 5242880) { reject(new Error('FolderView3 export exceeds the 5 MB migration limit.')); return; }
                const reader = new windowRef.FileReader();
                reader.onload = () => { try { resolve({ name: file.name, text: new windowRef.TextDecoder('utf-8', { fatal: true }).decode(reader.result) }); } catch (_) { reject(new Error('FolderView3 export is not valid JSON.')); } };
                reader.onerror = () => reject(reader.error || new Error('Unable to read the selected JSON file.'));
                reader.readAsArrayBuffer(file);
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
            windowRef.alert([title, text].map(value => windowRef.FolderViewPlusI18n?.message?.(value) || value).join(': '));
            }
        });
        const showToastMessage = typeof deps.showToastMessage === 'function' ? deps.showToastMessage : (() => {});
        const translate = deps.translate || ((key, fallback, ...params) => windowRef?.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback || key);
        const formatTimestamp = typeof deps.formatTimestamp === 'function' ? deps.formatTimestamp : ((value) => {
            const parsed = Date.parse(String(value || ''));
            return Number.isFinite(parsed) ? (globalThis.FolderViewPlusI18n?.formatDate?.(parsed, { dateStyle: 'short', timeStyle: 'medium' }) || new Date(parsed).toLocaleString('en')) : String(value || '');
        });
        let controller = null;
        let mode = 'idle';
        let detection = null;
        let report = null;
        let selectedSource = null;
        let migrationResult = null;
        let generation = 0;
        let reveal = deps.reveal || (() => {});
        let afterApply = deps.afterApply || (async () => {});

        const normalizeDetection = model.normalizeDetection;

        const normalizeReport = model.normalizeReport;

        const emptyHtml = () => `
            <div class="fv-recovery-empty-state">
                <strong>${escapeHtml(translate('import.folderview3.read-only-title', 'FolderView3 migration is read-only until you approve an apply plan.'))}</strong>
                <span>${escapeHtml(translate('import.folderview3.read-only-preview-help', 'Detect an installed FolderView3 configuration or preview a FolderView3 export. Previewing never writes plugin or Unraid configuration.'))}</span>
            </div>
        `;

        const buildDetectionHtml = () => {
            if (!detection) {
                return emptyHtml();
            }
            if (!detection.available) {
                return `
                    <div class="fv-recovery-empty-state">
                        <strong>${escapeHtml(translate('import.folderview3.not-detected', 'No installed FolderView3 configuration detected.'))}</strong>
                        <span>${escapeHtml(translate('import.folderview3.preview-export-help', 'You can still preview a FolderView3 full-export JSON from another server.'))}</span>
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
                            <div class="fv-recovery-history-title">${escapeHtml(translate('import.folderview3.detected', 'FolderView3 detected'))}</div>
                            <div class="fv-recovery-history-copy">${escapeHtml(repairT9b1afc29("common.repair.version-1-readable-components-2-14aacc", "Version: $1. Readable components: $2.", detection.pluginVersion || "unknown", detection.componentCount))}</div>
                        </div>
                        <span class="fv-recovery-history-badge">${escapeHtml(translate('import.folderview3.read-only-badge', 'Read only'))}</span>
                    </div>
                    <div class="fv-recovery-history-meta">
                        <span>${escapeHtml('Docker · ' + translate('common.runtime.folders-1', 'Folders: $1', detection.dockerFolderCount))}</span>
                        <span>${escapeHtml('VM · ' + translate('common.runtime.folders-1', 'Folders: $1', detection.vmFolderCount))}</span>
                        <span>${escapeHtml(translate('import.folderview3.style-count', 'Custom styles: $1', detection.customStyleCount))}</span>
                        <span>${escapeHtml(translate('common.repair.optional-native-autostart-entries-1-d67df3', 'Optional native autostart entries: $1', detection.nativeAutostartCount))}</span>
                    </div>
                    <div class="backup-actions fv-recovery-environment-actions">${previewButton}</div>
                </article>
            `;
        };

        const buildReportHtml = () => {
            return applyModule?.buildReportHtml?.({ report, migrationResult, escapeHtml, formatTimestamp, translate, fallbackHtml: buildDetectionHtml }) || buildDetectionHtml();
        };

        const render = () => {
            const host = documentRef?.querySelector?.('#fv-recovery-folderview3-summary');
            if (!host) {
                return;
            }
            host.innerHTML = mode === 'loading' || mode === 'applying'
                ? applyModule.loadingHtml(mode === 'applying', translate)
                : buildReportHtml();
        };

        const detectInstalled = async () => {
            if (mode === 'applying') return null;
            const currentGeneration = ++generation;
            mode = 'loading';
            report = null;
            migrationResult = null;
            render();
            try {
                const response = await apiGetJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    data: { action: 'detect_folderview3' }
                });
                if (currentGeneration !== generation) return null;
                detection = normalizeDetection(response?.detection || {});
                mode = 'detection';
                render();
                return detection;
            } catch (error) {
                if (currentGeneration !== generation) return null;
                mode = 'idle';
                render();
                showError(repairT9b1afc29("common.repair.folderview3-detection-failed-327513", "FolderView3 detection failed"), error);
                throw error;
            }
        };

        const previewSource = async (source) => {
            if (mode === 'applying') return null;
            reveal();
            const currentGeneration = ++generation;
            mode = 'loading';
            report = null;
            selectedSource = null;
            migrationResult = null;
            render();
            try {
                model.validateSource(source);
                const response = await apiPostJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    action: 'preview_folderview3',
                    sourceKind: source.kind,
                    payload: String(source.text || ''),
                    fileName: String(source.name || '')
                });
                if (currentGeneration !== generation) return null;
                if (!/^[a-f0-9]{64}$/.test(String(response?.report?.source?.digest || ''))) throw new Error('The server returned an incomplete migration preview.');
                report = normalizeReport(response?.report || {});
                selectedSource = source;
                mode = 'preview';
                render();
                showToastMessage({
                    title: translate('import.folderview3.preview-ready', 'FolderView3 preview ready'),
                    message: translate('import.folderview3.preview-created', 'Migration report created without changing configuration.'),
                    level: 'success',
                    durationMs: 3600
                });
                return report;
            } catch (error) {
                if (currentGeneration !== generation) return null;
                mode = 'idle';
                render();
                showError(repairT9b1afc29("common.repair.folderview3-migration-preview-failed-cb2fa9", "FolderView3 migration preview failed"), error);
                throw error;
            }
        };

        const previewInstalled = () => previewSource({
            kind: 'installed',
            name: 'Installed FolderView3 configuration',
            text: ''
        });

        const previewExport = async () => {
            if (mode === 'applying') return null;
            const currentGeneration = ++generation, previousMode = mode;
            mode = 'loading'; render();
            let selected = null;
            try {
                selected = await selectJsonFile();
            } catch (error) {
                if (currentGeneration !== generation) return null;
                mode = 'idle'; report = null; selectedSource = null; migrationResult = null; render();
                showError(repairT9b1afc29("common.repair.folderview3-export-selection-failed-ad42da", "FolderView3 export selection failed"), error);
                return null;
            }
            if (currentGeneration !== generation) return null;
            if (!selected) {
                mode = previousMode === 'loading' ? 'idle' : previousMode; render();
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

        const applyMigration = async () => {
            if (mode !== 'preview') return null;
            const currentGeneration = generation;
            const includeNativeAutostart = Boolean(documentRef?.querySelector?.('[data-fv-folderview3-native-autostart]')?.checked);
            mode = 'applying';
            render();
            try {
                const response = await applyModule.runApply({ report, selectedSource, includeNativeAutostart, confirm: windowRef?.confirm?.bind(windowRef), postJson: apiPostJson, translate });
                if (currentGeneration !== generation) return response?.migration?.transaction?.verified === true ? response.migration : null;
                if (!response) { mode = 'preview'; render(); return null; }
                if (response.migration?.transaction?.verified !== true) throw new Error('Migration verification did not complete. No successful migration was reported.');
                migrationResult = response?.migration || null;
                report = normalizeReport(migrationResult?.report || report);
                mode = 'applied';
                render();
                try { await afterApply(); }
                catch (error) { showError('Migration was saved; refresh failed', error); return migrationResult; }
                showToastMessage({
                    title: translate('import.folderview3.applied', 'FolderView3 migration applied'),
                    message: translate('import.folderview3.applied-help', 'The migration was verified and rollback checkpoints are available in Recovery.'),
                    level: 'success',
                    durationMs: 5200
                });
                return migrationResult;
            } catch (error) {
                if (currentGeneration !== generation) return null;
                mode = 'preview';
                render();
                showError(repairT9b1afc29("common.repair.folderview3-migration-failed-3a876a", "FolderView3 migration failed"), error);
                throw error;
            }
        };

        const handleClick = (event) => {
            const button = event.target?.closest?.('[data-fv-folderview3-action]');
            if (!button || !documentRef?.contains?.(button)) {
                return;
            }
            const action = String(button.getAttribute('data-fv-folderview3-action') || '');
            if (action === 'detect') {
                void detectInstalled().catch(() => {});
            } else if (action === 'preview-installed') {
                void previewInstalled().catch(() => {});
            } else if (action === 'preview-export') {
                void previewExport().catch(() => {});
            } else if (action === 'download-report') {
                downloadReport();
            } else if (action === 'apply') {
                void applyMigration().catch(() => {});
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
            generation += 1;
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
            previewSelection: (selected) => previewSource({ kind: 'export', name: selected.name, text: selected.text }),
            configureHooks: (hooks = {}) => { reveal = hooks.reveal || reveal; afterApply = hooks.afterApply || afterApply; },
            downloadReport,
            applyMigration,
            getReport: () => report,
            getSelectedSource: () => selectedSource,
            getMigrationResult: () => migrationResult
        });
    };

    return Object.freeze({ createApi });
}));
