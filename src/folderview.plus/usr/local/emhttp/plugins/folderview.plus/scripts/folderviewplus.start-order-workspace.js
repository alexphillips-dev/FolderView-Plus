// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.startOrderWorkspace = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    const createApi = (deps = {}) => {
        const translate = deps.translate || ((key, fallback) => globalThis?.FolderViewPlusI18n?.t?.(key, fallback) || fallback || key); const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
        const encodeName = (value) => encodeURIComponent(String(value || '')).replace(/'/g, '%27');

        const buildWaitControl = (entry) => {
            const name = String(entry?.name || '');
            const source = String(entry?.waitSource || 'none');
            const sourceLabel = source === 'container' ? 'explicit' : (source === 'batch' ? 'batch' : (source === 'native' ? 'native' : 'none'));
            return `<label class="fv-docker-start-order-wait"><span>${escapeHtml(translate('settings.start-order.wait', 'Wait'))}</span><input type="number" min="0" max="3600" step="1" value="${Number(entry?.wait) || 0}" data-fv-onchange="updateDockerStartOrderWait('${encodeName(name)}', this.value)"><small>${escapeHtml(sourceLabel)}</small></label>`;
        };

        const buildSequenceHtml = (preview) => {
            const sequence = Array.isArray(preview?.sequence) ? preview.sequence : [];
            if (!sequence.length) {
                return `<div class="fv-recovery-empty-state"><strong>No autostart containers detected.</strong><span>${escapeHtml(translate('settings.start-order.enable-autostart-help', 'Enable Docker autostart for a container to include it in the sequence.'))}</span></div>`;
            }
            return `<ol class="fv-docker-start-order-list fv-docker-start-order-sequence">${sequence.map((entry, index) => {
                const name = String(entry?.name || '');
                const batch = String(entry?.batchId || '');
                return `<li><span>${index + 1}</span><strong>${escapeHtml(name)}</strong>${batch ? `<small class="fv-docker-start-order-batch-tag">${escapeHtml(batch)}</small>` : ''}${buildWaitControl(entry)}<button type="button" class="fv-docker-autostart-toggle" data-fv-onclick="toggleDockerStartOrderAutostart('${encodeName(name)}', false)"><i class="fa fa-power-off"></i> Disable</button></li>`;
            }).join('')}</ol>`;
        };

        const buildBatchSummaryHtml = (preview) => {
            const batches = Array.isArray(preview?.batches) ? preview.batches : [];
            if (!batches.length) return '';
            return `<details class="fv-docker-start-order-batch-summary"><summary>Batch details (${batches.length})</summary>${batches.map((batch) => `<div><strong>${escapeHtml(batch?.name || 'Start batch')}</strong><span>${(batch?.containers || []).length} container(s), ${Number(batch?.delay) || 0}s wait</span></div>`).join('')}</details>`;
        };

        const buildDisabledHtml = (disabledNames) => {
            const names = Array.isArray(disabledNames) ? disabledNames : [];
            if (!names.length) return '';
            return `<details class="fv-docker-start-order-disabled"><summary>Autostart disabled (${names.length})</summary><div>${names.map((name) => `<button type="button" data-fv-onclick="toggleDockerStartOrderAutostart('${encodeName(name)}', true)"><i class="fa fa-power-off"></i> ${escapeHtml(name)}</button>`).join('')}</div></details>`;
        };

        const buildPreviewHtml = (preview, options = {}) => {
            const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];
            const stale = Array.isArray(preview?.staleAutostart) ? preview.staleAutostart : [];
            const warningsHtml = [...warnings, ...stale.map((name) => `Stale autostart entry will be removed: ${name}`)]
                .map((warning) => `<div class="fv-docker-start-order-warning"><i class="fa fa-exclamation-triangle"></i> ${escapeHtml(warning)}</div>`).join('');
            return `<div class="fv-docker-start-order-preview-head"><strong><i class="fa fa-sort-amount-asc" aria-hidden="true"></i> Preview autostart sequence</strong><span class="fv-docker-start-order-count">${Number(preview?.autostartCount) || 0} autostart containers, ${Number(preview?.containerCount) || 0} containers detected</span></div>${preview?.managed === false ? '<div class="fv-docker-start-order-warning"><i class="fa fa-lock"></i> Unmanaged mode: this sequence is read-only and FolderView Plus will not rewrite it.</div>' : ''}${warningsHtml}${buildSequenceHtml(preview)}${buildBatchSummaryHtml(preview)}${buildDisabledHtml(options.disabledNames)}`;
        };

        const rowIdentity = (row) => String(row?.Id || row?.id || row?.shortId || row?.info?.Id || '').trim();
        const rowAutostart = (row) => row?.info?.State?.Autostart === true || row?.State?.Autostart === true;
        const buildAutostartMutationEntries = (infoByName, plan, targetName, enabled) => {
            const waits = plan?.containerWaits && typeof plan.containerWaits === 'object' ? plan.containerWaits : {};
            return Object.entries(infoByName || {}).map(([name, row]) => ({
                id: rowIdentity(row),
                autoStart: String(name) === String(targetName) ? enabled === true : rowAutostart(row),
                ...(Object.prototype.hasOwnProperty.call(waits, name) ? { wait: Number(waits[name]) || 0 } : {})
            })).filter((entry) => entry.id);
        };

        const updateWait = async (containerName, value) => {
            const plan = deps.getPlan();
            const containerWaits = { ...(plan.containerWaits || {}) };
            containerWaits[decodeURIComponent(String(containerName || ''))] = Math.max(0, Math.min(3600, Math.round(Number(value) || 0)));
            try {
                await deps.savePlan({ containerWaits }, { preservePreview: true, refreshPreview: true });
            } catch (error) {
                deps.showError('Docker container wait save failed', error);
            }
        };

        const toggleAutostart = async (containerName, enabled) => {
            const name = decodeURIComponent(String(containerName || '')).trim();
            const info = deps.getInfo();
            const row = info?.[name];
            const entries = buildAutostartMutationEntries(info, deps.getPlan(), name, enabled === true);
            if (!row || !entries.length) {
                deps.showError('Docker autostart update failed', new Error('Container identity data is unavailable. Refresh Settings and try again.'));
                return;
            }
            try {
                await deps.runDockerMutation({ operation: 'updateAutostartConfiguration', entries, persistUserPreferences: true });
                if (row?.info?.State) row.info.State.Autostart = enabled === true;
                if (row?.State) row.State.Autostart = enabled === true;
                await deps.refreshPreview({ flush: false });
                deps.setStatus(`Docker autostart ${enabled === true ? 'enabled' : 'disabled'} for ${name}.`);
            } catch (error) {
                deps.showError('Docker autostart update failed', error);
            }
        };

        return Object.freeze({ buildPreviewHtml, buildAutostartMutationEntries, rowAutostart, updateWait, toggleAutostart });
    };

    return Object.freeze({ createApi });
}));
