// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerRuntimeHierarchy = factory();
    root.FolderViewPlusDockerRuntimeHierarchyModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const fallbackBuildFolderHierarchy = (
        folders,
        normalizeParentId = ((value) => String(value || '').trim())
    ) => {
        const source = folders && typeof folders === 'object' ? folders : {};
        const ids = Object.keys(source);
        const idSet = new Set(ids);
        const parentById = {};
        const childrenById = {};
        ids.forEach((id) => {
            childrenById[id] = [];
        });
        for (const id of ids) {
            const rawParent = normalizeParentId(source[id]?.parentId || source[id]?.parent_id || '');
            const parentId = (rawParent && rawParent !== id && idSet.has(rawParent)) ? rawParent : '';
            parentById[id] = parentId;
            if (parentId) {
                childrenById[parentId].push(id);
            }
        }
        return { ids, parentById, childrenById };
    };

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const jq = deps.$ || win?.jQuery || win?.$;
        const getGlobalFolders = typeof deps.getGlobalFolders === 'function' ? deps.getGlobalFolders : (() => ({}));
        const getDockerFolderHierarchy = typeof deps.getDockerFolderHierarchy === 'function'
            ? deps.getDockerFolderHierarchy
            : (() => ({ ids: [], parentById: {}, childrenById: {} }));
        const setDockerFolderHierarchy = typeof deps.setDockerFolderHierarchy === 'function'
            ? deps.setDockerFolderHierarchy
            : (() => {});
        const normalizeFolderParentId = typeof deps.normalizeFolderParentId === 'function'
            ? deps.normalizeFolderParentId
            : ((value) => String(value || '').trim());
        const folderEvents = deps.folderEvents && typeof deps.folderEvents.dispatchEvent === 'function'
            ? deps.folderEvents
            : { dispatchEvent: () => {} };
        const getDirectMemberRowsForFolder = typeof deps.getDirectMemberRowsForFolder === 'function'
            ? deps.getDirectMemberRowsForFolder
            : (() => jq ? jq() : null);
        const forceCollapseFolderRow = typeof deps.forceCollapseFolderRow === 'function'
            ? deps.forceCollapseFolderRow
            : (() => {});
        const persistExpandedStateFromGlobal = typeof deps.persistExpandedStateFromGlobal === 'function'
            ? deps.persistExpandedStateFromGlobal
            : (() => {});
        const applyFocusedFolderState = typeof deps.applyFocusedFolderState === 'function'
            ? deps.applyFocusedFolderState
            : (() => {});
        const queueRuntimeResizerBind = typeof deps.queueRuntimeResizerBind === 'function'
            ? deps.queueRuntimeResizerBind
            : (() => {});
        const scheduleRuntimeWidthReflow = typeof deps.scheduleRuntimeWidthReflow === 'function'
            ? deps.scheduleRuntimeWidthReflow
            : (() => {});
        const buildRuntimeContainerMapForFolder = typeof deps.buildRuntimeContainerMapForFolder === 'function'
            ? deps.buildRuntimeContainerMapForFolder
            : (() => ({}));
        const syncDockerFolderMemberRows = typeof deps.syncDockerFolderMemberRows === 'function'
            ? deps.syncDockerFolderMemberRows
            : (() => {});
        const applyFolderStatusColorOverrides = typeof deps.applyFolderStatusColorOverrides === 'function'
            ? deps.applyFolderStatusColorOverrides
            : (() => {});
        const applyFolderAccentStyle = typeof deps.applyFolderAccentStyle === 'function'
            ? deps.applyFolderAccentStyle
            : (() => {});
        const applyFolderDropdownStyle = typeof deps.applyFolderDropdownStyle === 'function'
            ? deps.applyFolderDropdownStyle
            : (() => {});
        const applyPreviewBorderStyle = typeof deps.applyPreviewBorderStyle === 'function'
            ? deps.applyPreviewBorderStyle
            : (() => {});
        const applyFolderPreviewLayout = typeof deps.applyFolderPreviewLayout === 'function'
            ? deps.applyFolderPreviewLayout
            : (() => {});
        const layoutFolderPreviewRows = typeof deps.layoutFolderPreviewRows === 'function'
            ? deps.layoutFolderPreviewRows
            : (() => {});
        const buildDockerPreviewItem = typeof deps.buildDockerPreviewItem === 'function'
            ? deps.buildDockerPreviewItem
            : (() => ({ $item: jq ? jq() : null, $tooltipTrigger: jq ? jq() : null }));
        const appendDockerPreviewActionButtons = typeof deps.appendDockerPreviewActionButtons === 'function'
            ? deps.appendDockerPreviewActionButtons
            : (() => {});
        const decorateDockerPreviewMemberTriggers = typeof deps.decorateDockerPreviewMemberTriggers === 'function'
            ? deps.decorateDockerPreviewMemberTriggers
            : (() => {});
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function' ? deps.getSafeWebuiUrl : ((value) => String(value || '').trim());
        const isCompactMultiRowPreview = typeof deps.isCompactMultiRowPreview === 'function' ? deps.isCompactMultiRowPreview : (() => false);
        const debugEnabled = deps.debugEnabled === true;
        const consoleRef = deps.console || win?.console || null;

        const debugLog = (...args) => {
            if (debugEnabled && consoleRef && typeof consoleRef.log === 'function') {
                consoleRef.log(...args);
            }
        };

        const buildFolderHierarchy = (folders) => fallbackBuildFolderHierarchy(folders, normalizeFolderParentId);

        const getFolderChildren = (folderId) => {
            const map = getDockerFolderHierarchy()?.childrenById || {};
            return Array.isArray(map[folderId]) ? map[folderId] : [];
        };

        const getFolderDescendants = (folderId) => {
            const result = [];
            const queue = [...getFolderChildren(folderId)];
            const seen = new Set();
            while (queue.length) {
                const current = queue.shift();
                if (!current || seen.has(current)) {
                    continue;
                }
                seen.add(current);
                result.push(current);
                queue.push(...getFolderChildren(current));
            }
            return result;
        };

        const getFolderAncestors = (folderId) => {
            const result = [];
            const parentById = getDockerFolderHierarchy()?.parentById || {};
            let current = String(folderId || '').trim();
            const seen = new Set();
            while (current && parentById[current] && !seen.has(parentById[current])) {
                const nextParent = String(parentById[current] || '').trim();
                if (!nextParent) {
                    break;
                }
                seen.add(nextParent);
                result.push(nextParent);
                current = nextParent;
            }
            return result;
        };

        const folderHasChildren = (folderId) => getFolderChildren(folderId).length > 0;

        const renderFolderUpdateColumn = (id, $updateColumn, managerTypes, upToDate, managed) => {
            if (!$updateColumn?.length || !jq) {
                return;
            }

            const showAdvanced = jq.cookie('docker_listview_mode') == 'advanced';
            const hasDockerMan = managerTypes.has('dockerman');
            const hasCompose = managerTypes.has('composeman');
            const has3rdParty = [...managerTypes].some((type) => type !== 'dockerman' && type !== 'composeman');

            $updateColumn.empty();

            if (!hasDockerMan && hasCompose && has3rdParty) {
                $updateColumn.append(
                    jq(`<span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('compose')}</span><br><span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('third-party')}</span>`)
                );
                return;
            }

            if (!hasDockerMan && hasCompose) {
                $updateColumn.append(
                    jq(`<span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('compose')}</span>`)
                );
                return;
            }

            if (!hasDockerMan) {
                $updateColumn.append(
                    jq(`<span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('third-party')}</span>`)
                );
                return;
            }

            if (!upToDate) {
                $updateColumn.append(
                    jq(`<div class="advanced" style="display: ${showAdvanced ? 'block' : 'none'};"><span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i> ${jq.i18n('update-ready')}</span></div>`)
                );
                $updateColumn.append(
                    jq(`<a class="exec" onclick="updateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${jq.i18n('apply-update')}</span></a>`)
                );
                return;
            }

            $updateColumn.append(
                jq(`<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i> ${jq.i18n('up-to-date')}</span>`)
            );
            if (managed > 0) {
                $updateColumn.append(
                    jq(`<div class="advanced" style="display: ${showAdvanced ? 'block' : 'none'};"><a class="exec" onclick="forceUpdateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${jq.i18n('force-update')}</span></a></div>`)
                );
            }
        };

        const updateFolderRowStatusFromContainers = (id, folder, runtimeContainers) => {
            if (!folder || typeof folder !== 'object' || !jq) {
                return;
            }
            const containerEntries = Object.values(runtimeContainers || {});
            let upToDate = true;
            let started = 0;
            let paused = 0;
            let stopped = 0;
            let autostart = 0;
            let autostartStarted = 0;
            let managed = 0;
            const managerTypes = new Set();

            for (const entry of containerEntries) {
                const state = entry?.state === true;
                const isPaused = entry?.pause === true;
                const isManaged = entry?.managed === true;
                const hasUpdate = entry?.update === true;
                const manager = String(entry?.manager || '').trim();
                const isAutostart = entry?.autostart === true;

                upToDate = upToDate && !hasUpdate;
                if (state) {
                    if (isPaused) {
                        paused += 1;
                    } else {
                        started += 1;
                    }
                } else {
                    stopped += 1;
                }
                if (isAutostart) {
                    autostart += 1;
                    if (state) {
                        autostartStarted += 1;
                    }
                }
                if (isManaged) {
                    managed += 1;
                }
                if (manager) {
                    managerTypes.add(manager);
                }
            }

            const total = containerEntries.length;
            const $folderRow = jq(`tr.folder-id-${id}`);
            applyFolderStatusColorOverrides($folderRow, folder.settings);
            applyFolderAccentStyle($folderRow, folder.settings);
            applyFolderDropdownStyle($folderRow, folder.settings);
            const $updateColumn = $folderRow.find('td.updatecolumn');
            const $folderIcon = $folderRow.find(`i#load-folder-${id}`);
            const $folderState = $folderRow.find('span.folder-state');
            $folderState.removeClass('fv-folder-state-started fv-folder-state-paused fv-folder-state-stopped');
            $folderIcon.show();
            if (started > 0) {
                $folderIcon.attr('class', 'fa fa-play started folder-load-status');
                $folderState.text(`${started}/${total} ${jq.i18n('started')}`).addClass('fv-folder-state-started');
            } else if (paused > 0) {
                $folderIcon.attr('class', 'fa fa-pause paused folder-load-status');
                $folderState.text(`${paused}/${total} ${jq.i18n('paused')}`).addClass('fv-folder-state-paused');
            } else {
                $folderIcon.attr('class', 'fa fa-square stopped folder-load-status');
                $folderState.text(`${stopped}/${total} ${jq.i18n('stopped')}`).addClass('fv-folder-state-stopped');
            }

            if ($updateColumn.length && folder?.settings?.update_column !== true) {
                renderFolderUpdateColumn(id, $updateColumn, managerTypes, upToDate, managed);
            }

            const expanded = folder?.status?.expanded === true;
            folder.status = { upToDate, started, paused, stopped, autostart, autostartStarted, managed, managerTypes: Array.from(managerTypes), expanded };
        };

        const renderNestedAggregatePreview = (id, folder, runtimeContainers) => {
            if (!jq) {
                return;
            }
            const $preview = jq(`tr.folder-id-${id} div.folder-preview`);
            if (!$preview.length) {
                return;
            }
            const previewMode = Number(folder?.settings?.preview || 0);
            if (previewMode <= 0) {
                $preview.empty();
                return;
            }
            const entries = Object.values(runtimeContainers || {});
            const quickActionPrefs = folder?.settings || {};
            const allowWebuiQuickAction = quickActionPrefs.preview_webui === true;
            const allowConsoleQuickAction = quickActionPrefs.preview_console === true;
            const allowLogsQuickAction = quickActionPrefs.preview_logs === true;
            $preview.empty();
            for (const entry of entries) {
                const { $item: item } = buildDockerPreviewItem({
                    entry,
                    settings: folder?.settings || {},
                    autostart: entry?.autostart === true
                });
                item.addClass('fv-nested-preview-item');
                const compactMultiRowPreview = isCompactMultiRowPreview(folder?.settings || {});
                const $inner = item.children('span.inner').last();
                const $actionsTarget = compactMultiRowPreview
                    ? item.find('.fv-preview-actions-compact').first()
                    : $inner;
                const containerName = String(entry?.name || '');
                const shellValue = String(entry?.shell || '/bin/sh');
                const webuiUrl = getSafeWebuiUrl(entry?.webui);
                appendDockerPreviewActionButtons($actionsTarget, {
                    preview_webui: allowWebuiQuickAction,
                    preview_console: allowConsoleQuickAction,
                    preview_logs: allowLogsQuickAction
                }, containerName, shellValue, webuiUrl);
                decorateDockerPreviewMemberTriggers(
                    item.find('span.hand, span.inner > span.appname, span.inner > span.appname > a, span.inner > i.fa, span.inner > span.state'),
                    id,
                    containerName
                );
                $preview.append(item);
            }
            $preview.children('span').wrap('<div class="folder-preview-wrapper"></div>');
            applyFolderPreviewLayout($preview, folder?.settings || {});
            layoutFolderPreviewRows($preview, folder?.settings || {});
            $preview.find('span.inner > span.appname').css('width', folder?.settings?.preview_text_width || '');
        };

        const syncParentFolderVisualState = (id, expanded) => {
            if (!folderHasChildren(id) || !jq) {
                return;
            }
            const folder = getGlobalFolders()?.[id];
            if (!folder || typeof folder !== 'object') {
                return;
            }
            const $row = jq(`tr.folder-id-${id}`);
            $row.toggleClass('fv-parent-collapsed', !expanded);
            $row.toggleClass('fv-parent-expanded', !!expanded);

            if (expanded) {
                // When expanded, keep parent-level containers visible but avoid duplicating descendants.
                const directRuntimeContainers = buildRuntimeContainerMapForFolder(id, false);
                renderNestedAggregatePreview(id, folder, directRuntimeContainers);
            } else {
                const runtimeContainers = folder?.runtimeContainers || {};
                renderNestedAggregatePreview(id, folder, runtimeContainers);
            }
            const previewNode = $row.find('div.folder-preview').get(0);
            applyPreviewBorderStyle(previewNode, folder?.settings || {});
        };

        const hideNestedDescendants = (id) => {
            if (!jq) {
                return;
            }
            for (const descendantId of getFolderDescendants(id)) {
                forceCollapseFolderRow(descendantId, true);
                jq(`tr.folder-id-${descendantId}`).addClass('fv-nested-hidden').hide();
            }
        };

        const showDirectNestedChildren = (id, anchor = null) => {
            if (!jq) {
                return;
            }
            let $insertAfter = anchor && anchor.length ? anchor : jq(`tr.folder-id-${id}`);
            for (const childId of getFolderChildren(id)) {
                forceCollapseFolderRow(childId, false);
                const $childRow = jq(`tr.folder-id-${childId}`);
                if ($insertAfter.length && $childRow.length) {
                    $insertAfter.after($childRow);
                    $insertAfter = $childRow;
                }
                $childRow.removeClass('fv-nested-hidden').show();
            }
        };

        const applyNestedFolderHierarchy = () => {
            if (!jq) {
                return;
            }
            const folders = getGlobalFolders();
            setDockerFolderHierarchy(buildFolderHierarchy(folders));
            const hierarchy = getDockerFolderHierarchy();
            const allIds = hierarchy?.ids || [];
            const parentById = hierarchy?.parentById || {};

            for (const id of allIds) {
                const parentId = parentById[id] || '';
                const $row = jq(`tr.folder-id-${id}`);
                $row.attr('data-folder-parent', parentId);
                $row.toggleClass('fv-folder-is-child', !!parentId);
                $row.toggleClass('fv-folder-has-children', folderHasChildren(id));
                if (parentId) {
                    forceCollapseFolderRow(id, false);
                    $row.addClass('fv-nested-hidden').hide();
                } else {
                    $row.removeClass('fv-nested-hidden').show();
                }
            }

            for (const id of allIds) {
                if (!folderHasChildren(id)) {
                    if (folders[id]) {
                        delete folders[id].runtimeContainers;
                    }
                    continue;
                }
                const runtimeContainers = buildRuntimeContainerMapForFolder(id, true);
                if (folders[id]) {
                    folders[id].runtimeContainers = runtimeContainers;
                    updateFolderRowStatusFromContainers(id, folders[id], runtimeContainers);
                    syncParentFolderVisualState(id, folders[id]?.status?.expanded === true);
                }
            }
        };

        const dropDownButton = (id, persistState = true) => {
            if (!jq) {
                return;
            }
            debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Entry.`);
            debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Dispatching docker-pre-folder-expansion event.`);
            folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-expansion', {detail: { id }}));
            const element = jq(`.dropDown-${id}`);
            const state = element.attr('active') === 'true';
            const hasChildren = folderHasChildren(id);
            debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Current state (active attribute): ${state}.`);
            if (state) {
                element.children().removeClass('fa-chevron-up').addClass('fa-chevron-down');
                if (hasChildren) {
                    hideNestedDescendants(id);
                }
                jq(`tr.folder-id-${id}`).addClass('sortable');
                const $directRows = getDirectMemberRowsForFolder(id);
                const $fallbackRows = jq(`.folder-${id}-element`);
                const $rowsToMove = $directRows.length ? $directRows : $fallbackRows;
                jq(`tr.folder-id-${id} .folder-storage`).append($rowsToMove);
                $rowsToMove.addClass('fv-nested-hidden').hide();
                if (hasChildren) {
                    syncParentFolderVisualState(id, false);
                }
                element.attr('active', 'false');
                debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Collapsed folder. Moved elements to storage.`);
            } else {
                element.children().removeClass('fa-chevron-down').addClass('fa-chevron-up');
                jq(`tr.folder-id-${id}`).removeClass('sortable').removeClass('ui-sortable-handle').off().css('cursor', '');
                if (hasChildren) {
                    const $folderRow = jq(`tr.folder-id-${id}`);
                    const $directMemberRows = getDirectMemberRowsForFolder(id);
                    const directRuntimeContainers = buildRuntimeContainerMapForFolder(id, false);
                    let $childAnchor = $folderRow;
                    if ($directMemberRows.length) {
                        $folderRow.after($directMemberRows);
                        $directMemberRows.removeClass('fv-nested-hidden').show();
                        jq(`.folder-${id}-element > td > i.fa-arrows-v`).remove();
                        syncDockerFolderMemberRows(id, directRuntimeContainers);
                        $childAnchor = $directMemberRows.last();
                    } else {
                        $folderRow.find('.folder-storage').append($directMemberRows);
                        $directMemberRows.addClass('fv-nested-hidden').hide();
                    }
                    showDirectNestedChildren(id, $childAnchor);
                    syncParentFolderVisualState(id, true);
                    debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Expanded parent folder. Showing direct members, then nested children.`);
                } else {
                    const $directMemberRows = getDirectMemberRowsForFolder(id);
                    const $fallbackRows = jq(`.folder-${id}-element`);
                    const $rowsToShow = $directMemberRows.length ? $directMemberRows : $fallbackRows;
                    const directRuntimeContainers = buildRuntimeContainerMapForFolder(id, false);
                    jq(`tr.folder-id-${id}`).after($rowsToShow);
                    $rowsToShow.removeClass('fv-nested-hidden').show();
                    $rowsToShow.children('td').children('i.fa-arrows-v').remove();
                    syncDockerFolderMemberRows(id, directRuntimeContainers);
                    debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Expanded leaf folder. Moved elements after folder row.`);
                }
                element.attr('active', 'true');
            }
            const globalFolders = getGlobalFolders();
            if (globalFolders[id]) {
                globalFolders[id].status.expanded = !state;
                debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Updated globalFolders[${id}].status.expanded to ${!state}.`);
            }
            if (persistState) {
                persistExpandedStateFromGlobal();
            }
            applyFocusedFolderState();
            queueRuntimeResizerBind();
            scheduleRuntimeWidthReflow('folder-toggle', 24);
            debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Dispatching docker-post-folder-expansion event.`);
            folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-expansion', {detail: { id }}));
            debugLog(`[FV3_DEBUG] dropDownButton (id: ${id}): Exit.`);
        };

        const expandFolderBranch = (folderId) => {
            const id = String(folderId || '').trim();
            if (!id) {
                return;
            }
            const expandNode = (nodeId) => {
                const button = jq ? jq(`.dropDown-${nodeId}`) : null;
                if (button && button.length && button.attr('active') !== 'true') {
                    dropDownButton(nodeId, false);
                }
                for (const childId of getFolderChildren(nodeId)) {
                    expandNode(childId);
                }
            };
            expandNode(id);
            persistExpandedStateFromGlobal();
            queueRuntimeResizerBind();
            scheduleRuntimeWidthReflow('folder-branch-expand', 24);
        };

        const collapseFolderBranch = (folderId) => {
            const id = String(folderId || '').trim();
            if (!id || !jq) {
                return;
            }
            const descendants = getFolderDescendants(id).reverse();
            for (const descendantId of descendants) {
                forceCollapseFolderRow(descendantId, true);
                jq(`tr.folder-id-${descendantId}`).addClass('fv-nested-hidden').hide();
            }
            const button = jq(`.dropDown-${id}`);
            if (button.length && button.attr('active') === 'true') {
                dropDownButton(id, false);
            } else {
                forceCollapseFolderRow(id, true);
                hideNestedDescendants(id);
                if (folderHasChildren(id)) {
                    syncParentFolderVisualState(id, false);
                }
            }
            persistExpandedStateFromGlobal();
            queueRuntimeResizerBind();
            scheduleRuntimeWidthReflow('folder-branch-collapse', 24);
        };

        return Object.freeze({
            buildFolderHierarchy,
            getFolderChildren,
            getFolderDescendants,
            getFolderAncestors,
            folderHasChildren,
            renderFolderUpdateColumn,
            updateFolderRowStatusFromContainers,
            renderNestedAggregatePreview,
            syncParentFolderVisualState,
            hideNestedDescendants,
            showDirectNestedChildren,
            applyNestedFolderHierarchy,
            dropDownButton,
            expandFolderBranch,
            collapseFolderBranch
        });
    };

    return Object.freeze({
        createApi
    });
}));
