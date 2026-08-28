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
        const previewModelModule = deps.previewModelModule
            && typeof deps.previewModelModule.createChildFolderPreviewModel === 'function'
            ? deps.previewModelModule
            : {
                createChildFolderPreviewModel: (input = {}) => Object.freeze({
                    id: String(input.childId || '').trim(),
                    childId: String(input.childId || '').trim(),
                    sourceId: String(input.sourceId || input.parentId || '').trim(),
                    rootId: String(input.rootId || input.parentId || '').trim(),
                    parentId: String(input.parentId || '').trim(),
                    name: String(input.childFolder?.name || 'Folder').trim() || 'Folder',
                    icon: String(input.childFolder?.icon || '').trim(),
                    memberCount: Number(input.memberCount) || 0,
                    startedCount: Number(input.startedCount) || 0,
                    depth: Number(input.depth) || 0,
                    breadcrumbText: Array.isArray(input.breadcrumb) && input.breadcrumb.length
                        ? input.breadcrumb.join(' / ')
                        : (String(input.childFolder?.name || 'Folder').trim() || 'Folder'),
                    runtimeCountLabel: Number(input.memberCount) > 0 ? `${Number(input.startedCount) || 0}/${Number(input.memberCount) || 0}` : 'Empty'
                })
            };
        const childFolderPreviewMenuModule = deps.childFolderPreviewMenuModule
            || win?.FolderViewPlusFoundationModules?.dockerChildFolderPreviewMenu
            || null;
        const appendDockerPreviewActionButtons = typeof deps.appendDockerPreviewActionButtons === 'function'
            ? deps.appendDockerPreviewActionButtons
            : (() => {});
        const decorateDockerPreviewMemberTriggers = typeof deps.decorateDockerPreviewMemberTriggers === 'function'
            ? deps.decorateDockerPreviewMemberTriggers
            : (() => {});
        const bindDockerNestedPreviewContext = typeof deps.bindDockerNestedPreviewContext === 'function'
            ? deps.bindDockerNestedPreviewContext
            : (() => false);
        const auditDockerPreviewContextBridges = typeof deps.auditDockerPreviewContextBridges === 'function'
            ? deps.auditDockerPreviewContextBridges
            : (() => null);
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function' ? deps.getSafeWebuiUrl : ((value) => String(value || '').trim());
        const isCompactMultiRowPreview = typeof deps.isCompactMultiRowPreview === 'function' ? deps.isCompactMultiRowPreview : (() => false);
        const editFolder = typeof deps.editFolder === 'function' ? deps.editFolder : (() => {});
        const openFolderActions = typeof deps.openFolderActions === 'function' ? deps.openFolderActions : (() => {});
        const recordChildFolderPreviewRender = typeof deps.recordChildFolderPreviewRender === 'function'
            ? deps.recordChildFolderPreviewRender
            : (() => {});
        const recordChildFolderPreviewBinding = typeof deps.recordChildFolderPreviewBinding === 'function'
            ? deps.recordChildFolderPreviewBinding
            : (() => {});
        const recordChildFolderPreviewMenuOpen = typeof deps.recordChildFolderPreviewMenuOpen === 'function'
            ? deps.recordChildFolderPreviewMenuOpen
            : (() => {});
        const debugEnabled = deps.debugEnabled === true;
        const consoleRef = deps.console || win?.console || null;

        const debugLog = (...args) => {
            if (debugEnabled && consoleRef && typeof consoleRef.log === 'function') {
                consoleRef.log(...args);
            }
        };

        const buildFolderHierarchy = (folders) => fallbackBuildFolderHierarchy(folders, normalizeFolderParentId);

        const normalizeChildFolderOrder = (value) => {
            const source = Array.isArray(value) ? value : [];
            const seen = new Set();
            const result = [];
            source.forEach((entry) => {
                const id = String(entry || '').trim();
                if (!id || seen.has(id)) {
                    return;
                }
                seen.add(id);
                result.push(id);
            });
            return result;
        };

        const sortFolderChildren = (parentId, childIds) => {
            const ids = Array.isArray(childIds) ? childIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
            const sourceIndex = new Map(ids.map((id, index) => [id, index]));
            const parentSettings = getGlobalFolders()?.[parentId]?.settings || {};
            const orderIndex = new Map(normalizeChildFolderOrder(parentSettings.child_folder_order || parentSettings.childFolderOrder).map((id, index) => [id, index]));
            return ids.sort((left, right) => {
                const leftOrder = orderIndex.has(left) ? orderIndex.get(left) : Number.MAX_SAFE_INTEGER;
                const rightOrder = orderIndex.has(right) ? orderIndex.get(right) : Number.MAX_SAFE_INTEGER;
                if (leftOrder !== rightOrder) {
                    return leftOrder - rightOrder;
                }
                return (sourceIndex.get(left) || 0) - (sourceIndex.get(right) || 0);
            });
        };

        const getFolderChildren = (folderId) => {
            const map = getDockerFolderHierarchy()?.childrenById || {};
            return sortFolderChildren(folderId, Array.isArray(map[folderId]) ? map[folderId] : []);
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

        const shouldHideNestedPreviewItems = (settings = {}) => settings?.preview_hide_nested_items === true
            || settings?.previewHideNestedItems === true;

        const normalizeChildFolderPreviewDepth = (settings = {}) => {
            const rawValue = settings?.preview_child_folder_depth ?? settings?.previewChildFolderDepth ?? 0;
            const normalized = String(rawValue ?? '').trim().toLowerCase();
            if (normalized === '0' || normalized === 'all' || normalized === 'unlimited' || normalized === '') {
                return 0;
            }
            const parsed = Number.parseInt(normalized, 10);
            return Number.isFinite(parsed) ? Math.max(1, Math.min(3, parsed)) : 0;
        };

        const getFolderBreadcrumb = (folderId) => {
            const folders = getGlobalFolders();
            return [...getFolderAncestors(folderId).reverse(), String(folderId || '').trim()]
                .map((id) => String(folders?.[id]?.name || id || '').trim())
                .filter(Boolean);
        };

        const getFolderPreviewDescendants = (folderId, maxDepth = 0) => {
            const result = [];
            const seen = new Set();
            const visit = (parentId, depth = 0) => {
                if (maxDepth > 0 && depth >= maxDepth) {
                    return;
                }
                for (const childId of getFolderChildren(parentId)) {
                    const safeChildId = String(childId || '').trim();
                    if (!safeChildId || seen.has(safeChildId)) {
                        continue;
                    }
                    seen.add(safeChildId);
                    result.push({ id: safeChildId, depth });
                    visit(safeChildId, depth + 1);
                }
            };
            visit(folderId, 0);
            return result;
        };

        const resolveFolderUpdateColumnState = (managerTypes, upToDate, managed, options = {}) => {
            const managerTypeSet = managerTypes instanceof Set
                ? managerTypes
                : new Set(Array.isArray(managerTypes) ? managerTypes : []);
            const showAdvanced = options?.advanced === true
                || (options?.advanced !== false && jq?.cookie('docker_listview_mode') == 'advanced');
            const hasDockerMan = managerTypeSet.has('dockerman');
            const hasCompose = managerTypeSet.has('composeman');
            const has3rdParty = [...managerTypeSet].some((type) => type !== 'dockerman' && type !== 'composeman');

            if (!hasDockerMan && hasCompose && has3rdParty) {
                return {
                    statusToken: 'composeAndThirdParty',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false,
                    showAdvanced
                };
            }
            if (!hasDockerMan && hasCompose) {
                return {
                    statusToken: 'compose',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false,
                    showAdvanced
                };
            }
            if (!hasDockerMan) {
                return {
                    statusToken: 'thirdParty',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false,
                    showAdvanced
                };
            }
            if (!upToDate) {
                return {
                    statusToken: 'updateReady',
                    actionToken: 'applyUpdate',
                    actionRequiresAdvancedView: false,
                    showAdvanced
                };
            }
            return {
                statusToken: 'upToDate',
                actionToken: managed > 0 && showAdvanced ? 'forceUpdate' : 'upToDate',
                actionRequiresAdvancedView: managed > 0,
                showAdvanced
            };
        };

        const renderFolderUpdateColumn = (id, $updateColumn, managerTypes, upToDate, managed) => {
            if (!$updateColumn?.length || !jq) {
                return;
            }

            const state = resolveFolderUpdateColumnState(managerTypes, upToDate, managed);
            $updateColumn.empty();

            if (state.statusToken === 'composeAndThirdParty') {
                $updateColumn.append(
                    jq(`<span class="folder-update-text" data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('compose')}</span><br><span class="folder-update-text" data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('third-party')}</span>`)
                );
                return;
            }
            if (state.statusToken === 'compose') {
                $updateColumn.append(
                    jq(`<span class="folder-update-text" data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('compose')}</span>`)
                );
                return;
            }
            if (state.statusToken === 'thirdParty') {
                $updateColumn.append(
                    jq(`<span class="folder-update-text" data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-docker fa-fw"></i> ${jq.i18n('third-party')}</span>`)
                );
                return;
            }
            if (state.statusToken === 'updateReady') {
                $updateColumn.append(
                    jq(`<div class="advanced${state.showAdvanced ? ' fv-advanced-visible' : ''}"><span class="orange-text folder-update-text" data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-flash fa-fw"></i> ${jq.i18n('update-ready')}</span></div>`)
                );
                $updateColumn.append(
                    jq(`<a class="exec" data-fv-onclick="updateFolder('${id}');"><span data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-cloud-download fa-fw"></i> ${jq.i18n('apply-update')}</span></a>`)
                );
                return;
            }

            $updateColumn.append(
                jq(`<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i> ${jq.i18n('up-to-date')}</span>`)
            );
            if (state.actionToken === 'forceUpdate') {
                $updateColumn.append(
                    jq(`<div class="advanced${state.showAdvanced ? ' fv-advanced-visible' : ''}"><a class="exec" data-fv-onclick="forceUpdateFolder('${id}');"><span data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-cloud-download fa-fw"></i> ${jq.i18n('force-update')}</span></a></div>`)
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

        const expandFolderPathToChild = (rootId, childId) => {
            const safeRootId = String(rootId || '').trim();
            const safeChildId = String(childId || '').trim();
            if (!safeRootId || !safeChildId || !jq) {
                return;
            }
            const ancestors = getFolderAncestors(safeChildId).reverse();
            const rootIndex = ancestors.indexOf(safeRootId);
            const pathIds = rootIndex >= 0
                ? ancestors.slice(rootIndex)
                : [safeRootId];
            for (const pathId of pathIds) {
                const button = jq(`.dropDown-${pathId}`);
                if (button.length && button.attr('active') !== 'true') {
                    dropDownButton(pathId, false);
                }
            }
            persistExpandedStateFromGlobal();
        };

        const scrollFolderRowIntoView = (folderId) => {
            if (!jq) {
                return;
            }
            const $folderRow = jq(`tr.folder-id-${folderId}`);
            if ($folderRow.length && typeof $folderRow.get(0)?.scrollIntoView === 'function') {
                $folderRow.get(0).scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        };

        const childFolderPreviewMenuApi = childFolderPreviewMenuModule
            && typeof childFolderPreviewMenuModule.createApi === 'function'
            ? childFolderPreviewMenuModule.createApi({
                window: win,
                $: jq,
                expandFolderPathToChild,
                scrollFolderRowIntoView,
                editFolder,
                openFolderActions,
                recordMenuOpen: recordChildFolderPreviewMenuOpen
            })
            : null;

        const buildChildFolderPreviewItem = (parentId, childId, childFolder, options = {}) => {
            const $item = jq('<span class="outer fv-docker-preview-card fv-docker-preview-mode-1 fv-folder-preview-child" role="button" tabindex="0" aria-haspopup="menu"></span>');
            const $inner = jq('<span class="inner"></span>');
            const $hand = jq('<span class="hand fv-folder-preview-child-trigger"></span>');
            const runtimeContainers = buildRuntimeContainerMapForFolder(childId, true);
            const total = Object.keys(runtimeContainers || {}).length;
            const started = Object.values(runtimeContainers || {}).filter((entry) => entry?.state === true).length;
            const model = previewModelModule.createChildFolderPreviewModel({
                rootId: parentId,
                parentId,
                sourceId: parentId,
                childId,
                childFolder,
                memberCount: total,
                startedCount: started,
                depth: options?.depth || 0,
                breadcrumb: getFolderBreadcrumb(childId),
                hasChildren: folderHasChildren(childId)
            });

            $item.attr('data-folder-preview-root', parentId);
            $item.attr('data-folder-preview-parent', parentId);
            $item.attr('data-folder-preview-child', model.childId);
            $item.attr('data-folder-preview-depth', String(model.depth));
            $item.attr('title', `${model.breadcrumbText}\n${model.runtimeCountLabel}`);
            $item.attr('aria-label', `${model.breadcrumbText}, ${model.runtimeCountLabel}`);
            if (model.icon) {
                $hand.append(jq('<img class="img folder-img fv-folder-preview-child-icon" alt="">').attr('src', model.icon));
            } else {
                $hand.append(jq('<i class="fa fa-folder fv-folder-preview-child-icon" aria-hidden="true"></i>'));
            }
            $inner.append($hand);
            $inner.append(jq('<span class="appname fv-folder-preview-child-name"></span>').text(model.name));
            $inner.append(jq('<span class="fv-folder-preview-child-count"></span>').text(model.runtimeCountLabel));
            $item.append($inner);
            recordChildFolderPreviewRender();
            const openChildFolderPreviewMenu = (event) => {
                if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                childFolderPreviewMenuApi?.show?.({
                    event,
                    rootId: parentId,
                    childId,
                    childName: model.name,
                    $item
                });
            };
            $item
                .on('click.fvChildFolderPreviewMenu keydown.fvChildFolderPreviewMenu', openChildFolderPreviewMenu)
                .on('contextmenu.fvChildFolderPreviewMenu', openChildFolderPreviewMenu);
            recordChildFolderPreviewBinding();
            return $item;
        };

        const renderNestedAggregatePreview = (id, folder, runtimeContainers, options = {}) => {
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
            const includeChildFolders = options?.includeChildFolders === true;
            const entries = Object.values(includeChildFolders
                ? buildRuntimeContainerMapForFolder(id, false)
                : (runtimeContainers || {}));
            const quickActionPrefs = folder?.settings || {};
            const allowWebuiQuickAction = quickActionPrefs.preview_webui === true;
            const allowConsoleQuickAction = quickActionPrefs.preview_console === true;
            const allowLogsQuickAction = quickActionPrefs.preview_logs === true;
            $preview.empty();
            for (const entry of entries) {
                const { $item: item, $tooltipTrigger } = buildDockerPreviewItem({
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
                bindDockerNestedPreviewContext(item, $tooltipTrigger, entry, folder, id);
            }
            if (includeChildFolders) {
                const folders = getGlobalFolders();
                const depthLimit = normalizeChildFolderPreviewDepth(folder?.settings || {});
                for (const descendant of getFolderPreviewDescendants(id, depthLimit)) {
                    const childId = String(descendant?.id || '').trim();
                    const childFolder = folders?.[childId];
                    if (!childFolder || typeof childFolder !== 'object') {
                        continue;
                    }
                    $preview.append(buildChildFolderPreviewItem(id, childId, childFolder, { depth: descendant.depth }));
                }
            }
            $preview.children('span').wrap('<div class="folder-preview-wrapper"></div>');
            applyFolderPreviewLayout($preview, folder?.settings || {});
            layoutFolderPreviewRows($preview, folder?.settings || {});
            auditDockerPreviewContextBridges($preview, folder?.settings || {});
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
                renderNestedAggregatePreview(id, folder, runtimeContainers, {
                    includeChildFolders: shouldHideNestedPreviewItems(folder?.settings || {})
                });
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
            resolveFolderUpdateColumnState,
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
