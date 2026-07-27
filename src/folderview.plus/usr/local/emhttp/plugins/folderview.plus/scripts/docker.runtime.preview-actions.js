// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerPreviewActions = factory();
    root.FolderViewPlusDockerPreviewActionsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        const jq = deps.$ || win?.jQuery || win?.$;
        const utils = deps.utils && typeof deps.utils === 'object' ? deps.utils : {};
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;'));
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function' ? deps.getSafeWebuiUrl : ((value) => String(value || '').trim());
        const openWebuiInNewTab = typeof deps.openWebuiInNewTab === 'function' ? deps.openWebuiInNewTab : (() => {});
        const openTerminal = typeof deps.openTerminal === 'function' ? deps.openTerminal : (() => {});
        const getDirectMemberRowsForFolder = typeof deps.getDirectMemberRowsForFolder === 'function'
            ? deps.getDirectMemberRowsForFolder
            : (() => jq());
        const isCompactMultiRowPreview = typeof deps.isCompactMultiRowPreview === 'function'
            ? deps.isCompactMultiRowPreview
            : (() => false);
        const applyFolderPreviewLayout = typeof deps.applyFolderPreviewLayout === 'function'
            ? deps.applyFolderPreviewLayout
            : (() => {});
        const layoutFolderPreviewRows = typeof deps.layoutFolderPreviewRows === 'function'
            ? deps.layoutFolderPreviewRows
            : (() => {});
        const webuiLinkRel = String(deps.webuiLinkRel || 'noopener noreferrer').trim() || 'noopener noreferrer';
        const dockerRuntimeStateClassList = 'started paused stopped fv-preview-status-started fv-preview-status-paused fv-preview-status-stopped green-text orange-text red-text';
        const dockerRuntimeIconClassList = 'fa-play fa-pause fa-square fa-refresh fa-spin';

        const buildDockerPreviewWebuiButton = (webuiUrl) => jq('<span class="folder-element-custom-btn folder-element-webui fv-preview-action-slot is-ready"></span>').append(
            jq('<a></a>')
                .attr('href', webuiUrl)
                .attr('target', '_blank')
                .attr('rel', webuiLinkRel)
                .attr('data-fv-preview-action', 'webui')
                .attr('data-webui-url', webuiUrl)
                .attr('aria-label', i18nLabel('docker.preview.open-webui', 'Open WebUI'))
                .attr('title', i18nLabel('docker.preview.open-webui', 'Open WebUI'))
                .append('<i class="fa fa-globe" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openWebuiInNewTab(webuiUrl);
                })
        );

        const buildDockerPreviewConsoleButton = (containerName, shellValue) => jq('<span class="folder-element-custom-btn folder-element-console fv-preview-action-slot is-ready"></span>').append(
            jq('<a href="#"></a>')
                .attr('data-fv-preview-action', 'console')
                .attr('data-container-name', containerName)
                .attr('data-shell-value', shellValue)
                .attr('aria-label', i18nLabel('docker.preview.open-console', 'Open console'))
                .attr('title', i18nLabel('docker.preview.open-console', 'Open console'))
                .append('<i class="fa fa-terminal" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openTerminal('docker', containerName, shellValue);
                })
        );

        const buildDockerPreviewLogsButton = (containerName) => jq('<span class="folder-element-custom-btn folder-element-logs fv-preview-action-slot is-ready"></span>').append(
            jq('<a href="#"></a>')
                .attr('data-fv-preview-action', 'logs')
                .attr('data-container-name', containerName)
                .attr('data-shell-value', '.log')
                .attr('aria-label', i18nLabel('docker.preview.view-logs', 'View logs'))
                .attr('title', i18nLabel('docker.preview.view-logs', 'View logs'))
                .append('<i class="fa fa-bars" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openTerminal('docker', containerName, '.log');
                })
        );

        const collectDockerPreviewActionTargets = ($preview, settings = {}) => {
            if (!$preview || !$preview.length) {
                return [];
            }
            if (isCompactMultiRowPreview(settings)) {
                return $preview.find('.fv-preview-actions-compact').get().map((node) => jq(node));
            }
            const previewMode = Number(settings?.preview || 0);
            switch (previewMode) {
                case 2:
                    return $preview.find('span.hand').get().map((node) => jq(node));
                case 3:
                    return $preview.find('span.inner').get().map((node) => jq(node));
                case 4:
                    return $preview.find('span.outer > span.inner').get().map((node) => jq(node));
                case 1:
                default:
                    return $preview.find('span.outer').get().map((node) => {
                        const $outer = jq(node);
                        const $inner = $outer.children('span.inner').last();
                        return $inner.length ? $inner : $outer;
                    });
            }
        };

        const insertDockerPreviewActionSlot = ($target, $slot, actionName) => {
            const actionOrder = ['webui', 'console', 'logs'];
            const currentIndex = actionOrder.indexOf(actionName);
            const laterAction = actionOrder
                .slice(currentIndex + 1)
                .map((name) => $target.children(`span.folder-element-${name}`).first())
                .find(($candidate) => $candidate && $candidate.length);
            if (laterAction && laterAction.length) {
                $slot.insertBefore(laterAction);
                return;
            }
            $target.append($slot);
        };

        const ensureDockerPreviewActionSlot = ($target, actionName, factory) => {
            let $slot = $target.children(`span.folder-element-${actionName}`).first();
            if ($slot.length) {
                $slot.addClass('fv-preview-action-slot');
                return $slot;
            }
            $slot = factory();
            insertDockerPreviewActionSlot($target, $slot, actionName);
            return $slot;
        };

        const syncDockerPreviewWebuiSlot = ($slot, webuiUrl = '', options = {}) => {
            const safeUrl = getSafeWebuiUrl(webuiUrl);
            const capability = typeof options?.webuiCapability === 'boolean'
                ? options.webuiCapability
                : (safeUrl ? true : null);
            const hydrating = options?.webuiHydrating === true && !safeUrl;
            $slot
                .removeClass('is-ready is-pending is-unavailable fv-preview-webui-placeholder')
                .addClass(safeUrl ? 'is-ready' : (hydrating || capability === null ? 'is-pending' : 'is-unavailable'))
                .attr('data-fv-preview-action-slot', 'webui')
                .attr('data-fv-webui-capability', capability === null ? 'unknown' : String(capability))
                .attr('aria-hidden', safeUrl ? 'false' : 'true');

            const $existingLink = $slot.children('a[data-fv-preview-action="webui"]').first();
            if (safeUrl && $existingLink.length && String($existingLink.attr('data-webui-url') || '') === safeUrl) {
                return;
            }
            $slot.empty();
            if (safeUrl) {
                const $readySlot = buildDockerPreviewWebuiButton(safeUrl);
                $slot.append($readySlot.children());
                return;
            }
            $slot.append('<span class="fv-preview-webui-placeholder-icon" aria-hidden="true"><i class="fa fa-globe" aria-hidden="true"></i></span>');
        };

        const syncDockerPreviewConsoleSlot = ($slot, containerName, shellValue) => {
            const safeName = String(containerName || '').trim();
            const safeShell = String(shellValue || '/bin/sh').trim() || '/bin/sh';
            const $existingLink = $slot.children('a[data-fv-preview-action="console"]').first();
            if (
                $existingLink.length
                && String($existingLink.attr('data-container-name') || '') === safeName
                && String($existingLink.attr('data-shell-value') || '') === safeShell
            ) {
                return;
            }
            $slot.empty().append(buildDockerPreviewConsoleButton(safeName, safeShell).children());
        };

        const syncDockerPreviewLogsSlot = ($slot, containerName) => {
            const safeName = String(containerName || '').trim();
            const $existingLink = $slot.children('a[data-fv-preview-action="logs"]').first();
            if ($existingLink.length && String($existingLink.attr('data-container-name') || '') === safeName) {
                return;
            }
            $slot.empty().append(buildDockerPreviewLogsButton(safeName).children());
        };

        const reconcileDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '', options = {}) => {
            if (!$target || !$target.length) {
                return;
            }
            const actionPrefs = typeof utils.resolvePreviewActionPrefs === 'function'
                ? utils.resolvePreviewActionPrefs(settings)
                : {
                    preview_webui: settings?.preview_webui === true,
                    preview_console: settings?.preview_console === true,
                    preview_logs: settings?.preview_logs === true
                };
            if (actionPrefs.preview_webui) {
                const $webuiSlot = ensureDockerPreviewActionSlot(
                    $target,
                    'webui',
                    () => jq('<span class="folder-element-custom-btn folder-element-webui fv-preview-action-slot"></span>')
                );
                syncDockerPreviewWebuiSlot($webuiSlot, webuiUrl, options);
            } else {
                $target.children('span.folder-element-webui').remove();
            }
            if (actionPrefs.preview_console && containerName) {
                const $consoleSlot = ensureDockerPreviewActionSlot(
                    $target,
                    'console',
                    () => buildDockerPreviewConsoleButton(containerName, shellValue)
                );
                syncDockerPreviewConsoleSlot($consoleSlot, containerName, shellValue);
            } else {
                $target.children('span.folder-element-console').remove();
            }
            if (actionPrefs.preview_logs && containerName) {
                const $logsSlot = ensureDockerPreviewActionSlot(
                    $target,
                    'logs',
                    () => buildDockerPreviewLogsButton(containerName)
                );
                syncDockerPreviewLogsSlot($logsSlot, containerName);
            } else {
                $target.children('span.folder-element-logs').remove();
            }
        };

        const appendDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '', options = {}) => {
            reconcileDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, options);
        };

        const i18nLabel = (key, fallback = '') => {
            const safeFallback = String(fallback || key || '').trim();
            try {
                if (typeof jq?.i18n !== 'function') {
                    return safeFallback;
                }
                const localized = String(jq.i18n(key) || '').trim();
                return localized && localized !== key ? localized : safeFallback;
            } catch (_error) {
                return safeFallback;
            }
        };

        const isDockerAdvancedModeEnabled = () => {
            try {
                return typeof jq?.cookie === 'function' && jq.cookie('docker_listview_mode') == 'advanced';
            } catch (_error) {
                return false;
            }
        };

        const escapeInlineJsSingleQuotedValue = (value) => String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");

        const resolveDockerMemberUpdateState = (entry = {}, options = {}) => {
            const manager = String(entry?.manager || '').trim().toLowerCase();
            const updateReady = entry?.update === true;
            const advanced = options?.advanced === true
                || (options?.advanced !== false && isDockerAdvancedModeEnabled());

            if (manager === 'composeman') {
                return {
                    manager,
                    statusToken: 'compose',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false
                };
            }
            if (manager && manager !== 'dockerman') {
                return {
                    manager,
                    statusToken: 'thirdParty',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false
                };
            }
            if (updateReady) {
                return {
                    manager: manager || 'dockerman',
                    statusToken: 'updateReady',
                    actionToken: 'applyUpdate',
                    actionRequiresAdvancedView: false
                };
            }
            return {
                manager: manager || 'dockerman',
                statusToken: 'upToDate',
                actionToken: advanced ? 'forceUpdate' : 'upToDate',
                actionRequiresAdvancedView: true
            };
        };

        const buildDockerMemberUpdateColumnHtml = (entry = {}, options = {}) => {
            const state = resolveDockerMemberUpdateState(entry, options);
            if (state.statusToken === 'compose') {
                return `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${escapeHtml(i18nLabel('compose', 'compose'))}</span>`;
            }
            if (state.statusToken === 'thirdParty') {
                return `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${escapeHtml(i18nLabel('third-party', 'third-party'))}</span>`;
            }
            const safeContainerName = escapeInlineJsSingleQuotedValue(String(entry?.name || '').trim());
            if (state.statusToken === 'updateReady') {
                return `<span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i>${escapeHtml(i18nLabel('update-ready', 'update-ready'))}</span><br><a class="exec" onclick="hideAllTips(); updateContainer('${safeContainerName}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${escapeHtml(i18nLabel('apply-update', 'apply-update'))}</span></a>`;
            }
            const forceUpdateHtml = state.actionToken === 'forceUpdate'
                ? `<br><a class="exec" onclick="hideAllTips(); updateContainer('${safeContainerName}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${escapeHtml(i18nLabel('force-update', 'force-update'))}</span></a>`
                : '';
            return `<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i>${escapeHtml(i18nLabel('up-to-date', 'up-to-date'))}</span>${forceUpdateHtml}`;
        };

        const getDockerPreviewStatusMeta = (entry = {}) => {
            const running = entry?.state === true;
            const paused = running && entry?.pause === true;
            if (running && paused) {
                return {
                    key: 'paused',
                    icon: 'fa-pause',
                    compactClassName: 'fv-preview-status-paused',
                    legacyStateClass: 'paused',
                    legacyToneClass: 'orange-text'
                };
            }
            if (running) {
                return {
                    key: 'started',
                    icon: 'fa-play',
                    compactClassName: 'fv-preview-status-started',
                    legacyStateClass: 'started',
                    legacyToneClass: 'green-text'
                };
            }
            return {
                key: 'stopped',
                icon: 'fa-square',
                compactClassName: 'fv-preview-status-stopped',
                legacyStateClass: 'stopped',
                legacyToneClass: 'red-text'
            };
        };
        const normalizePreviewStatusMode = (value) => {
            const normalized = String(value || '').trim().toLowerCase();
            if (['none', 'hide', 'hidden', 'off', 'false', '0', 'no'].includes(normalized)) {
                return 'none';
            }
            return ['none', 'symbol', 'grayscale'].includes(normalized) ? normalized : 'symbol';
        };

        const clearDockerRuntimeStateClasses = ($elements) => {
            if (!$elements || !$elements.length) {
                return;
            }
            $elements.removeClass(dockerRuntimeStateClassList);
        };

        const syncDockerPreviewStateSurface = ($target, statusMeta, localizedLabel) => {
            if (!$target || !$target.length) {
                return;
            }
            const $outer = $target.hasClass('outer')
                ? $target
                : $target.closest('span.outer').first();
            if (!$outer.length) {
                return;
            }
            const $hand = $outer.children('span.hand').first();
            const $inner = $outer.children('span.inner').first();
            const $appName = $inner.children('span.appname').first();
            const $appLink = $appName.children('a.exec').first();
            const $inlineStatus = $appLink.children('.fv-preview-status-inline').first();
            clearDockerRuntimeStateClasses($outer.add($hand).add($inner).add($appName));
            $outer.add($hand).add($inner).add($appName).addClass(statusMeta.legacyStateClass);
            $outer.attr('data-fv-runtime-state', statusMeta.key);
            if ($appLink.length) {
                clearDockerRuntimeStateClasses($appLink);
                $appLink
                    .addClass(statusMeta.legacyStateClass)
                    .attr('data-fv-runtime-state', statusMeta.key);
                if ($appLink.hasClass('fv-preview-status-name')) {
                    $appLink.addClass(statusMeta.compactClassName);
                }
            }
            if ($inlineStatus.length) {
                clearDockerRuntimeStateClasses($inlineStatus);
                $inlineStatus
                    .addClass(statusMeta.compactClassName)
                    .attr('title', localizedLabel)
                    .attr('data-fv-runtime-state', statusMeta.key);
                $inlineStatus.find('i.fa').first()
                    .removeClass(dockerRuntimeIconClassList)
                    .addClass(`fa ${statusMeta.icon}`);
            }
            const $iconStatus = $outer.find('.fv-preview-icon-status').first();
            if ($iconStatus.length) {
                clearDockerRuntimeStateClasses($iconStatus);
                $iconStatus
                    .addClass(statusMeta.compactClassName)
                    .attr('title', localizedLabel)
                    .attr('data-fv-runtime-state', statusMeta.key);
                $iconStatus.find('i.fa').first()
                    .removeClass(dockerRuntimeIconClassList)
                    .addClass(`fa ${statusMeta.icon}`);
                $iconStatus.find('span.state').first().text(` ${localizedLabel}`);
            }
        };

        const syncDockerPreviewUpdateHighlight = ($target, settings = {}, entry = {}) => {
            if (!$target || !$target.length) {
                return;
            }
            const $outer = $target.hasClass('outer')
                ? $target
                : $target.closest('span.outer').first();
            if (!$outer.length) {
                return;
            }
            const $appName = $outer.children('span.inner').first().children('span.appname').first();
            const $appLink = $appName.children('a.exec').first();
            const highlightUpdate = settings?.preview_update === true && entry?.update === true;
            $appName.toggleClass('orange-text fv-preview-update-ready', highlightUpdate);
            if ($appLink.length) {
                $appLink.toggleClass('orange-text fv-preview-update-ready', highlightUpdate);
            }
        };

        const findDockerFolderMemberRow = (id, containerName) => {
            const folderId = String(id || '').trim();
            const safeContainerName = String(containerName || '').trim();
            if (!folderId || !safeContainerName) {
                return jq();
            }
            const matchRows = ($rows) => $rows.filter((_, row) => {
                const rowId = String(row?.id || '').trim();
                if (rowId === `ct-${safeContainerName}`) {
                    return true;
                }
                const $row = jq(row);
                return String($row.find('td.ct-name .appname').first().text() || '').trim() === safeContainerName;
            }).first();
            const $rows = jq(`tr.folder-id-${folderId} div.folder-storage > tr, tr.folder-${folderId}-element`);
            const $matchedRow = matchRows($rows);
            if ($matchedRow.length) {
                return $matchedRow;
            }
            return matchRows(getDirectMemberRowsForFolder(folderId));
        };

        const syncDockerStorageRowStatus = ($row, entry = {}) => {
            if (!$row || !$row.length) {
                return;
            }
            const statusMeta = getDockerPreviewStatusMeta(entry);
            const localizedLabel = typeof jq?.i18n === 'function'
                ? String(jq.i18n(statusMeta.key) || statusMeta.key).trim()
                : statusMeta.key;
            const $outer = $row.find('td.ct-name > span.outer').first();
            const $hand = $outer.children('span.hand').first();
            const $inner = $outer.children('span.inner').first();
            const $appName = $inner.children('span.appname').first();
            const $stateLabel = $inner.children('span.state').first();
            const $icon = $inner.children('i[id^="load-"]').first();
            clearDockerRuntimeStateClasses($outer.add($hand).add($inner).add($appName).add($stateLabel));
            $outer.add($hand).add($inner).add($appName).add($stateLabel).addClass(statusMeta.legacyStateClass);
            $row.attr('data-fv-runtime-state', statusMeta.key);
            if ($icon.length) {
                $icon
                    .removeClass(dockerRuntimeStateClassList)
                    .removeClass(dockerRuntimeIconClassList)
                    .addClass(`fa ${statusMeta.icon} ${statusMeta.legacyStateClass} ${statusMeta.legacyToneClass}`);
            }
            if ($stateLabel.length) {
                $stateLabel.text(` ${localizedLabel}`);
            }
        };

        const syncDockerStorageRowUpdateColumn = ($row, entry = {}) => {
            if (!$row || !$row.length) {
                return;
            }
            const $updateColumn = $row.find('td.updatecolumn').first();
            if (!$updateColumn.length) {
                return;
            }
            $updateColumn.html(buildDockerMemberUpdateColumnHtml(entry));
        };

        const syncDockerFolderMemberRows = (id, runtimeContainers, changedNames = null) => {
            const changedSet = changedNames instanceof Set
                ? changedNames
                : (Array.isArray(changedNames) ? new Set(changedNames) : null);
            const entries = Object.values(runtimeContainers || {}).filter((entry) => (
                !changedSet || changedSet.has(String(entry?.name || '').trim())
            ));
            entries.forEach((entry) => {
                const containerName = String(entry?.name || '').trim();
                if (!containerName) {
                    return;
                }
                const $row = findDockerFolderMemberRow(id, containerName);
                syncDockerStorageRowStatus($row, entry);
                syncDockerStorageRowUpdateColumn($row, entry);
            });
        };

        const syncDockerRuntimeRows = (runtimeContainers, changedNames = null) => {
            const changedSet = changedNames instanceof Set
                ? changedNames
                : (Array.isArray(changedNames) ? new Set(changedNames) : null);
            Object.values(runtimeContainers || {}).forEach((entry) => {
                const containerName = String(entry?.name || entry?.info?.Name || '').trim();
                if (!containerName || (changedSet && !changedSet.has(containerName))) {
                    return;
                }
                const row = doc?.getElementById?.(`ct-${containerName}`) || null;
                if (!row) {
                    return;
                }
                const $row = jq(row);
                syncDockerStorageRowStatus($row, entry);
            });
        };

        const resolveDockerPreviewStateTargets = ($target) => {
            if (!$target || !$target.length) {
                return {
                    $compactStatus: jq(),
                    $stateLabel: jq(),
                    $icon: jq()
                };
            }
            const $compactStatus = $target.hasClass('fv-preview-status-compact')
                ? $target
                : $target.siblings('.fv-preview-status-compact').first();
            if ($compactStatus.length) {
                return {
                    $compactStatus,
                    $stateLabel: $compactStatus.find('span.state').first(),
                    $icon: $compactStatus.find('i.fa').first()
                };
            }
            const $stateLabel = $target.find('span.state').first().length
                ? $target.find('span.state').first()
                : $target.closest('span.inner, span.outer').find('span.state').first();
            const $icon = $stateLabel.length
                ? $stateLabel.prevAll('i.fa').first()
                : jq();
            return {
                $compactStatus: jq(),
                $stateLabel,
                $icon
            };
        };

        const syncDockerPreviewStatus = ($target, entry = {}) => {
            const { $compactStatus, $stateLabel, $icon } = resolveDockerPreviewStateTargets($target);
            if (!$stateLabel.length && !$icon.length && !$compactStatus.length) {
                return;
            }
            const statusMeta = getDockerPreviewStatusMeta(entry);
            const localizedLabel = typeof jq?.i18n === 'function'
                ? String(jq.i18n(statusMeta.key) || statusMeta.key).trim()
                : statusMeta.key;
            syncDockerPreviewStateSurface($target, statusMeta, localizedLabel);
            if ($compactStatus.length) {
                $compactStatus.attr('title', localizedLabel);
            }
            if ($icon.length) {
                $icon
                    .removeClass(`${dockerRuntimeIconClassList} ${dockerRuntimeStateClassList}`)
                    .addClass(`fa ${statusMeta.icon} ${$compactStatus.length ? statusMeta.compactClassName : `${statusMeta.legacyStateClass} ${statusMeta.legacyToneClass}`}`);
            }
            if ($stateLabel.length) {
                $stateLabel.text(` ${localizedLabel}`);
            }
        };

        const hideDockerPreviewStatus = ($target) => {
            if (!$target || !$target.length) {
                return;
            }
            const $outer = $target.hasClass('outer')
                ? $target
                : $target.closest('span.outer').first();
            if (!$outer.length) {
                return;
            }
            clearDockerRuntimeStateClasses($outer.add($outer.find('span.hand, span.inner, span.appname, span.appname > a.exec')));
            $outer.find('.fv-preview-status-compact, .fv-preview-status-inline').remove();
            $outer.find('span.state').each((_, node) => {
                const $state = jq(node);
                const $icon = $state.prevAll('i.fa').first();
                $state.remove();
                if ($icon.length) {
                    $icon.remove();
                }
            });
        };

        const syncDockerLeafFolderPreviewActions = (id, folder, runtimeContainers, changedNames = null) => {
            const $preview = jq(`tr.folder-id-${id} div.folder-preview`);
            if (!$preview.length) {
                return;
            }
            const settings = folder?.settings || {};
            const previewMode = Number(settings?.preview || 0);
            if (previewMode <= 0) {
                $preview.empty();
                return;
            }
            const actionTargets = collectDockerPreviewActionTargets($preview, settings);
            const entries = Object.values(runtimeContainers || {});
            const changedSet = changedNames instanceof Set
                ? changedNames
                : (Array.isArray(changedNames) ? new Set(changedNames) : null);
            syncDockerFolderMemberRows(id, runtimeContainers, changedSet);
            actionTargets.forEach(($target, index) => {
                const entry = entries[index];
                if (!$target || !$target.length || !entry) {
                    return;
                }
                const containerName = String(entry?.name || '').trim();
                if (changedSet && !changedSet.has(containerName)) {
                    return;
                }
                const shellValue = String(entry?.shell || '/bin/sh').trim() || '/bin/sh';
                const webuiUrl = getSafeWebuiUrl(entry?.webui);
                const previewStatusMode = normalizePreviewStatusMode(settings?.preview_status);
                if (previewStatusMode === 'none') {
                    hideDockerPreviewStatus($target);
                } else {
                    syncDockerPreviewStatus($target, entry);
                }
                syncDockerPreviewUpdateHighlight($target, settings, entry);
                if (Number(settings?.preview || 0) === 2) {
                    const $outer = $target.hasClass('outer') ? $target : $target.closest('span.outer').first();
                    const $img = $outer.find('img.img').first();
                    if (previewStatusMode === 'symbol') {
                        $outer.find('.fv-preview-icon-status').removeClass('fv-preview-status-hidden');
                    } else {
                        $outer.find('.fv-preview-icon-status').remove();
                    }
                    if (previewStatusMode === 'grayscale' && entry?.state !== true) {
                        $img.css('filter', 'grayscale(100%)');
                    } else if (settings?.preview_grayscale !== true) {
                        $img.css('filter', '');
                    }
                }
                reconcileDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, {
                    webuiCapability: entry?.webuiCapability,
                    webuiHydrating: entry?.webuiHydrating === true
                });
            });
            $preview.find('[id^="folder-preview-"]').each((_, node) => {
                jq(node).data('fvTooltipLazyBuilt', false);
            });
            applyFolderPreviewLayout($preview, settings);
            layoutFolderPreviewRows($preview, settings);
            $preview.find('span.inner > span.appname').css('width', settings?.preview_text_width || '');
        };

        return Object.freeze({
            appendDockerPreviewActionButtons,
            reconcileDockerPreviewActionButtons,
            resolveDockerMemberUpdateState,
            buildDockerMemberUpdateColumnHtml,
            syncDockerRuntimeRows,
            syncDockerFolderMemberRows,
            syncDockerLeafFolderPreviewActions
        });
    };

    return Object.freeze({
        createApi
    });
}));
