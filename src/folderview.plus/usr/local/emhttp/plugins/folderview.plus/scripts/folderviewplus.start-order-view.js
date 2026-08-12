// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.startOrderView = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    const createApi = (deps = {}) => {
        const translate = deps.translate || ((key, fallback) => globalThis?.FolderViewPlusI18n?.t?.(key, fallback) || fallback || key);
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
        const encodeName = (value) => encodeURIComponent(String(value || '')).replace(/'/g, '%27');
        const startOrderT = (key, fallback) => escapeHtml(translate(key, fallback));
        const rowAutostart = (row) => [true, 1, '1', 'true', 'yes', 'on'].includes(row?.autostart ?? row?.autoStart ?? row?.info?.State?.Autostart ?? row?.State?.Autostart);
        const iconFallback = '/plugins/dynamix.docker.manager/images/question.png';
        const rowIcon = (row) => {
            const labels = row?.info?.Config?.Labels || row?.Labels || {};
            const candidate = String(labels['net.unraid.docker.icon'] || row?.Icon || row?.icon || '').trim();
            return /^(?:https?:\/\/|\/)/i.test(candidate) ? candidate : iconFallback;
        };

        const buildHeaderSummaryHtml = (infoByName = {}) => {
            const rows = Object.values(infoByName || {});
            const autostart = rows.filter(rowAutostart).length;
            return `<div class="fv-start-order-summary-card" aria-label="${startOrderT('settings.start-order.summary', 'Docker container summary')}">
                <div class="fv-start-order-summary-metric"><i class="fa fa-cubes" aria-hidden="true"></i><span><strong>${rows.length}</strong><small>${startOrderT('settings.start-order.total-containers', 'Total containers')}</small></span></div>
                <div class="fv-start-order-summary-divider" aria-hidden="true"></div>
                <div class="fv-start-order-summary-metric"><i class="fa fa-play" aria-hidden="true"></i><span><strong>${autostart}</strong><small>${startOrderT('settings.start-order.autostart-containers', 'Autostart containers')}</small></span></div>
            </div>`;
        };

        const modeCopy = (plan) => {
            if (plan.mode === 'unmanaged') return ['Unraid owns the start order.', 'FolderView Plus will preview the native order but will not rewrite the Docker autostart file.'];
            if (plan.mode === 'custom-batches') return ['Custom batches are active.', 'Only containers with Docker autostart enabled are written to Unraid boot order. Delays apply to the last autostart container in each batch.'];
            return ['Docker page order is active.', 'Unraid autostart follows the same visual order you see on the Docker page, including containers inside folders.'];
        };

        const buildControlsHtml = (plan) => {
            const copy = modeCopy(plan);
            return `<div class="fv-docker-start-order-top" data-fv-start-order-region="top">
                <div class="fv-docker-start-order-config">
                    <div class="fv-docker-start-order-controls">
                        <label class="setting-select"><span>${startOrderT('settings.start-order.mode', 'Start order mode')}</span><span class="fv-start-order-select-shell"><i class="fa fa-list" aria-hidden="true"></i><select id="docker-start-order-mode" data-fv-onchange="updateDockerStartOrderMode(this.value)">
                            <option value="unmanaged" ${plan.mode === 'unmanaged' ? 'selected' : ''}>${startOrderT('settings.start-order.unmanaged', 'Leave Unraid order unmanaged')}</option>
                            <option value="docker-page" ${plan.mode === 'docker-page' ? 'selected' : ''}>${startOrderT('settings.start-order.docker-page', 'Follow Docker page order')}</option>
                            <option value="custom-batches" ${plan.mode === 'custom-batches' ? 'selected' : ''}>${startOrderT('settings.start-order.custom', 'Custom batch order')}</option>
                        </select><i class="fa fa-chevron-down" aria-hidden="true"></i></span></label>
                        <label class="setting-select"><span>${startOrderT('settings.start-order.remaining', 'Remaining autostart containers')}</span><span class="fv-start-order-select-shell"><i class="fa fa-users" aria-hidden="true"></i><select id="docker-start-order-remaining" data-fv-onchange="updateDockerStartOrderRemaining(this.value)">
                            <option value="after" ${plan.remaining === 'after' ? 'selected' : ''}>${startOrderT('settings.start-order.after', 'Start after custom batches')}</option>
                            <option value="before" ${plan.remaining === 'before' ? 'selected' : ''}>${startOrderT('settings.start-order.before', 'Start before custom batches')}</option>
                            <option value="keep" ${plan.remaining === 'keep' ? 'selected' : ''}>${startOrderT('settings.start-order.keep', 'Keep their current relative order')}</option>
                        </select><i class="fa fa-chevron-down" aria-hidden="true"></i></span></label>
                    </div>
                    <div class="fv-docker-start-order-toolbar">
                        <button type="button" class="fv-docker-start-order-primary" data-fv-onclick="refreshDockerStartOrderPreview()"><i class="fa fa-eye" aria-hidden="true"></i> ${startOrderT('settings.start-order.preview', 'Preview order')}</button>
                        <button type="button" data-fv-onclick="syncDockerStartOrderNow()" ${plan.mode === 'unmanaged' ? `disabled title="${startOrderT('settings.start-order.unmanaged-title', 'Unraid owns this order in unmanaged mode')}"` : ''}><i class="fa fa-refresh" aria-hidden="true"></i> ${startOrderT('settings.start-order.sync', 'Sync now')}</button>
                    </div>
                </div>
                <div class="fv-docker-start-order-help"><i class="fa fa-info-circle" aria-hidden="true"></i><div><strong>${escapeHtml(copy[0])}</strong><span>${escapeHtml(copy[1])}</span></div></div>
            </div>`;
        };

        const buildBatchHtml = (batch, index, options) => {
            const safeId = String(batch?.id || '');
            const items = Array.isArray(batch?.items) ? batch.items : [];
            const folderCache = options.folderOptionsCache;
            const itemHtml = items.length ? items.map((item, itemIndex) => {
                const isFolder = item?.type === 'folder';
                const label = isFolder ? (folderCache.byId.get(String(item.id))?.name || item.id || 'Folder') : (item?.name || 'Container');
                return `<div class="fv-docker-start-order-item"><span class="fv-docker-start-order-kind"><i class="fa ${isFolder ? 'fa-folder-o' : 'fa-cube'}" aria-hidden="true"></i> ${isFolder ? 'Folder' : 'Container'}</span><strong>${escapeHtml(label)}</strong><div class="fv-docker-start-order-item-actions"><button type="button" aria-label="Move up" data-fv-onclick="moveDockerStartOrderItem('${escapeHtml(safeId)}', ${itemIndex}, 'up')" ${itemIndex === 0 ? 'disabled' : ''}><i class="fa fa-chevron-up"></i></button><button type="button" aria-label="Move down" data-fv-onclick="moveDockerStartOrderItem('${escapeHtml(safeId)}', ${itemIndex}, 'down')" ${itemIndex >= items.length - 1 ? 'disabled' : ''}><i class="fa fa-chevron-down"></i></button><button type="button" aria-label="Remove item" data-fv-onclick="removeDockerStartOrderItem('${escapeHtml(safeId)}', ${itemIndex})"><i class="fa fa-times"></i></button></div></div>`;
            }).join('') : `<div class="fv-docker-start-order-empty-copy">${startOrderT('settings.start-order.add-items', 'Add folders or containers to this batch.')}</div>`;
            return `<section class="fv-docker-start-order-batch"><div class="fv-docker-start-order-batch-head"><input type="text" value="${escapeHtml(batch?.name || `Start batch ${index + 1}`)}" data-fv-onchange="updateDockerStartOrderBatch('${escapeHtml(safeId)}', 'name', this.value)" aria-label="Batch name"><div class="fv-docker-start-order-batch-actions"><button type="button" aria-label="Move batch up" data-fv-onclick="moveDockerStartOrderBatch('${escapeHtml(safeId)}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="fa fa-chevron-up"></i></button><button type="button" aria-label="Move batch down" data-fv-onclick="moveDockerStartOrderBatch('${escapeHtml(safeId)}', 'down')"><i class="fa fa-chevron-down"></i></button><button type="button" aria-label="Remove batch" data-fv-onclick="removeDockerStartOrderBatch('${escapeHtml(safeId)}')"><i class="fa fa-trash"></i></button></div></div><div class="fv-docker-start-order-batch-settings"><label>Delay after batch <input type="number" min="0" max="3600" step="1" value="${Number(batch?.delay) || 0}" data-fv-onchange="updateDockerStartOrderBatch('${escapeHtml(safeId)}', 'delay', this.value)"></label><label><input type="checkbox" ${batch?.useFolderOrder === false ? '' : 'checked'} data-fv-onchange="updateDockerStartOrderBatch('${escapeHtml(safeId)}', 'useFolderOrder', this.checked)"> Use folder member order</label><label><input type="checkbox" ${batch?.parallel === true ? 'checked' : ''} data-fv-onchange="updateDockerStartOrderBatch('${escapeHtml(safeId)}', 'parallel', this.checked)"> Parallel batch note</label></div><div class="fv-docker-start-order-add-row"><select data-fv-start-folder="${escapeHtml(safeId)}">${folderCache.html}</select><button type="button" data-fv-onclick="addDockerStartOrderItem('${escapeHtml(safeId)}', 'folder')"><i class="fa fa-folder-o"></i> Add folder</button><select data-fv-start-container="${escapeHtml(safeId)}">${options.containerOptionsHtml}</select><button type="button" data-fv-onclick="addDockerStartOrderItem('${escapeHtml(safeId)}', 'container')"><i class="fa fa-cube"></i> Add container</button></div><div class="fv-docker-start-order-items">${itemHtml}</div></section>`;
        };

        const buildBatchesHtml = (batches, options) => `<section class="fv-docker-start-order-batch-section" data-fv-start-order-region="batches"><div class="fv-start-order-section-head"><strong><i class="fa fa-cubes" aria-hidden="true"></i> ${startOrderT('settings.start-order.custom-batches', 'Custom startup batches')}</strong><button type="button" data-fv-onclick="addDockerStartOrderBatch()"><i class="fa fa-plus" aria-hidden="true"></i> ${startOrderT('settings.start-order.add-batch', 'Add batch')}</button></div><div class="fv-docker-start-order-batches">${batches.length ? batches.map((batch, index) => buildBatchHtml(batch, index, options)).join('') : `<div class="fv-docker-start-order-empty"><span class="fv-docker-start-order-empty-icon"><i class="fa fa-cube" aria-hidden="true"></i></span><span><strong>${startOrderT('settings.start-order.no-batches', 'No custom batches yet')}</strong><small>${startOrderT('settings.start-order.no-batches-help', 'Add a batch to define exact boot groups.')}</small></span></div>`}</div></section>`;

        const buildPreviewPlaceholderHtml = () => `<section id="docker-start-order-preview" class="fv-docker-start-order-preview" data-fv-start-order-region="preview"><div class="fv-recovery-empty-state"><strong>${startOrderT('settings.start-order.preview-pending', 'Preview has not loaded yet.')}</strong><span>${startOrderT('settings.start-order.preview-help', 'Use Preview order to inspect the exact autostart sequence.')}</span></div></section>`;
        const buildWaitControl = (entry) => `<label class="fv-docker-start-order-wait" title="${escapeHtml(String(entry?.waitSource || 'none'))}"><span class="fv-sr-only">Wait time for ${escapeHtml(entry?.name || '')}</span><input aria-label="Wait time for ${escapeHtml(entry?.name || '')}" type="number" min="0" max="3600" step="1" value="${Number(entry?.wait) || 0}" data-fv-onchange="updateDockerStartOrderWait('${encodeName(entry?.name)}', this.value)"><span>sec</span></label>`;
        const buildSequenceHtml = (preview, infoByName) => {
            const sequence = Array.isArray(preview?.sequence) ? preview.sequence : [];
            if (!sequence.length) return `<div class="fv-recovery-empty-state"><strong>${startOrderT('settings.start-order.none', 'No autostart containers detected.')}</strong><span>${startOrderT('settings.start-order.enable-autostart-help', 'Enable Docker autostart for a container to include it in the sequence.')}</span></div>`;
            return `<div class="fv-start-order-table-wrap"><div class="fv-start-order-table"><div class="fv-start-order-table-head"><span>Order</span><span>Container</span><span>${startOrderT('settings.start-order.wait', 'Wait time')}</span><span>Enabled</span><span aria-hidden="true"></span></div><ol class="fv-docker-start-order-sequence">${sequence.map((entry, index) => {
                const name = String(entry?.name || '');
                const encoded = encodeName(name);
                return `<li><span class="fv-start-order-number">${index + 1}</span><span class="fv-start-order-container"><img src="${escapeHtml(rowIcon(infoByName?.[name]))}" alt="" data-fv-onerror="this.src='${iconFallback}'"><strong>${escapeHtml(name)}</strong>${entry?.batchId ? `<small>${escapeHtml(entry.batchId)}</small>` : ''}</span>${buildWaitControl(entry)}<label class="fv-start-order-switch"><input type="checkbox" checked aria-label="Autostart enabled for ${escapeHtml(name)}" data-fv-onchange="toggleDockerStartOrderAutostart('${encoded}', this.checked)"><span aria-hidden="true"></span></label><span class="fv-start-order-overflow" aria-hidden="true"><i class="fa fa-ellipsis-v"></i></span></li>`;
            }).join('')}</ol></div></div>`;
        };
        const buildDisabledHtml = (disabledNames) => {
            const names = Array.isArray(disabledNames) ? disabledNames : [];
            if (!names.length) return '';
            return `<details class="fv-docker-start-order-disabled"><summary><span><i class="fa fa-ban" aria-hidden="true"></i> ${startOrderT('settings.start-order.disabled', 'Autostart disabled')} (${names.length})</span><i class="fa fa-chevron-down" aria-hidden="true"></i></summary><div>${names.map((name) => `<button type="button" data-fv-onclick="toggleDockerStartOrderAutostart('${encodeName(name)}', true)"><i class="fa fa-ban" aria-hidden="true"></i><span>${escapeHtml(name)}</span></button>`).join('')}</div></details>`;
        };
        const buildPreviewHtml = (preview, options = {}) => {
            const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];
            const stale = Array.isArray(preview?.staleAutostart) ? preview.staleAutostart : [];
            const warningHtml = [...warnings, ...stale.map((name) => `Stale autostart entry will be removed: ${name}`)].map((warning) => `<div class="fv-docker-start-order-warning"><i class="fa fa-exclamation-triangle"></i> ${escapeHtml(warning)}</div>`).join('');
            return `<div class="fv-docker-start-order-preview-head"><strong><i class="fa fa-play" aria-hidden="true"></i> ${startOrderT('settings.start-order.preview-sequence', 'Preview autostart sequence')}</strong><span class="fv-docker-start-order-count">${Number(preview?.autostartCount) || 0} autostart containers, ${Number(preview?.containerCount) || 0} containers detected</span></div>${preview?.managed === false ? '<div class="fv-docker-start-order-warning"><i class="fa fa-lock"></i> Unmanaged mode: this sequence is read-only and FolderView Plus will not rewrite it.</div>' : ''}${warningHtml}${buildSequenceHtml(preview, options.infoByName || {})}${buildDisabledHtml(options.disabledNames)}<footer class="fv-start-order-notice"><i class="fa fa-info-circle" aria-hidden="true"></i><span>${startOrderT('settings.start-order.notice', 'Changes take effect on the next Docker service start (e.g., server reboot). Use “Preview order” to see the current sequence.')}</span></footer>`;
        };

        return Object.freeze({ buildHeaderSummaryHtml, buildControlsHtml, buildBatchesHtml, buildPreviewPlaceholderHtml, buildPreviewHtml });
    };

    return Object.freeze({ createApi });
}));
