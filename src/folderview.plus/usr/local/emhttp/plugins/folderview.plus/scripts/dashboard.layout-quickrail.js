(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDashboardLayoutQuickRail = factory();
    root.FolderViewPlusDashboardLayoutQuickRailModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const COMPACT_MATRIX_LAYOUT = Object.freeze({
        maxFolderColumns: 3,
        minFolderWidth: 360,
        minMemberWidth: 220,
        gap: 8
    });

    const normalizeDashboardType = (type) => (type === 'vm' ? 'vm' : 'docker');

    const deriveCompactMatrixLayout = ({ containerWidth = 0, folderCount = 0 } = {}) => {
        const width = Math.max(0, Math.floor(Number(containerWidth) || 0));
        const count = Math.max(0, Math.floor(Number(folderCount) || 0));
        const availableFolderColumns = Math.max(
            1,
            Math.floor((width + COMPACT_MATRIX_LAYOUT.gap) / (COMPACT_MATRIX_LAYOUT.minFolderWidth + COMPACT_MATRIX_LAYOUT.gap))
        );
        const folderColumns = Math.max(1, Math.min(
            COMPACT_MATRIX_LAYOUT.maxFolderColumns,
            count || 1,
            availableFolderColumns
        ));
        const folderRows = Math.max(1, Math.ceil(count / folderColumns));
        const estimatedFolderWidth = Math.max(
            0,
            Math.floor((width - (COMPACT_MATRIX_LAYOUT.gap * Math.max(0, folderColumns - 1))) / folderColumns)
        );
        const memberColumns = Math.max(
            1,
            Math.floor(
                (estimatedFolderWidth + COMPACT_MATRIX_LAYOUT.gap)
                / (COMPACT_MATRIX_LAYOUT.minMemberWidth + COMPACT_MATRIX_LAYOUT.gap)
            )
        );
        const estimatedMemberWidth = Math.max(
            0,
            Math.floor(
                (estimatedFolderWidth - (COMPACT_MATRIX_LAYOUT.gap * Math.max(0, memberColumns - 1)))
                / memberColumns
            )
        );
        return Object.freeze({
            containerWidth: width,
            folderCount: count,
            folderColumns,
            folderRows,
            estimatedFolderWidth,
            memberColumns,
            estimatedMemberWidth
        });
    };

    const defaultDashboardTypeMeta = (type) => {
        const resolvedType = normalizeDashboardType(type);
        return {
            type: resolvedType,
            tbodySelector: resolvedType === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view',
            outerSelector: resolvedType === 'vm' ? 'span.outer.vms.folder-vm' : 'span.outer.apps.folder-docker'
        };
    };

    const createController = (deps = {}) => {
        const win = deps.window || (typeof globalThis !== 'undefined' ? globalThis : null);
        const jq = deps.$ || (win ? (win.jQuery || win.$) : null);
        if (typeof jq !== 'function' || !win) {
            throw new Error('FolderViewPlusDashboardLayoutQuickRail requires window + jQuery.');
        }

        const state = {
            layoutRafByType: {
                docker: 0,
                vm: 0
            },
            layoutApplyTokenByType: {
                docker: 0,
                vm: 0
            },
            quickSwitchRetryTimerByType: {
                docker: 0,
                vm: 0
            },
            widgetVisibilityObserverByType: {
                docker: null,
                vm: null
            },
            widgetVisibilitySyncTimerByType: {
                docker: 0,
                vm: 0
            },
            compactMatrixResizeObserverByType: {
                docker: null,
                vm: null
            },
            compactMatrixObservedNodeByType: {
                docker: null,
                vm: null
            },
            compactMatrixResizeRafByType: {
                docker: 0,
                vm: 0
            },
            compactMatrixMetricsByType: {
                docker: null,
                vm: null
            },
            viewPopoverByType: {
                docker: null,
                vm: null
            },
            layoutPendingByType: {
                docker: false,
                vm: false
            },
            quickActionSyncBound: false
        };

        const ui = deps.ui || win.FolderViewPlusUI || null;
        const translate = (key, fallback = '', ...params) => (
            typeof deps.t === 'function' ? deps.t(key, fallback, ...params) : (fallback || key)
        );
        const escapeHtml = (value) => (
            typeof ui?.escapeHtml === 'function'
                ? ui.escapeHtml(value)
                : String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
        );

        const dashboardTypeMeta = (type) => (
            typeof deps.dashboardTypeMeta === 'function'
                ? deps.dashboardTypeMeta(type)
                : defaultDashboardTypeMeta(type)
        );

        const dashboardStartedOnlyMemberSelectorForType = (type) => (
            normalizeDashboardType(type) === 'vm' ? 'span.folder-element-vm' : 'span.folder-element-docker'
        );

        const isDashboardStartedOnlyMemberActive = ($member) => {
            if (!$member || !$member.length) {
                return false;
            }
            const runtimeState = String($member.attr('data-fv-runtime-state') || '').trim().toLowerCase();
            if (runtimeState) {
                return ['running', 'started', 'paused', 'pmsuspended', 'unknown'].includes(runtimeState);
            }
            return $member.is('.started, .running, .paused, .pmsuspended, .unknown');
        };

        const applyDashboardStartedOnlyFilterForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const meta = dashboardTypeMeta(resolvedType);
            const $tbody = jq(meta.tbodySelector).first();
            if (!$tbody.length) {
                return { enabled: false, members: 0, hiddenMembers: 0, folders: 0, hiddenFolders: 0 };
            }
            const enabled = typeof deps.isDashboardStartedOnlyEnabledForType === 'function'
                ? deps.isDashboardStartedOnlyEnabledForType(resolvedType) === true
                : jq(resolvedType === 'vm' ? 'input#vms' : 'input#apps').first().is(':checked');
            const memberSelector = dashboardStartedOnlyMemberSelectorForType(resolvedType);
            const $members = $tbody.find(memberSelector);
            let hiddenMembers = 0;

            $tbody.toggleClass('fv-dashboard-started-only-enabled', enabled);
            $members.each((_, node) => {
                const $member = jq(node);
                const hidden = enabled && !isDashboardStartedOnlyMemberActive($member);
                $member.toggleClass('fv-dashboard-started-only-hidden', hidden);
                if (hidden) {
                    hiddenMembers += 1;
                }
            });

            const cards = $tbody.find('.folder-showcase-outer').get().reverse();
            let hiddenFolders = 0;
            cards.forEach((node) => {
                const $card = jq(node);
                if (!enabled) {
                    $card.removeClass('fv-dashboard-started-only-hidden');
                    return;
                }
                const $folderSurface = $card.children(meta.outerSelector).first();
                const $storageMembers = $folderSurface.children('.folder-storage').children(memberSelector);
                const $showcase = $card.children('.folder-showcase').first();
                const $showcaseMembers = $showcase.children(memberSelector);
                const hasVisibleMember = $storageMembers.add($showcaseMembers).toArray().some((member) => (
                    !jq(member).hasClass('fv-dashboard-started-only-hidden')
                ));
                const hasVisibleChildFolder = $showcase.children('.folder-showcase-outer').toArray().some((child) => (
                    !jq(child).hasClass('fv-dashboard-started-only-hidden')
                ));
                const hidden = !hasVisibleMember && !hasVisibleChildFolder;
                $card.toggleClass('fv-dashboard-started-only-hidden', hidden);
                if (hidden) {
                    hiddenFolders += 1;
                }
            });

            return {
                enabled,
                members: $members.length,
                hiddenMembers,
                folders: cards.length,
                hiddenFolders
            };
        };

        const getDashboardLayoutModes = () => (
            Array.isArray(deps.dashboardLayoutModes) && deps.dashboardLayoutModes.length
                ? deps.dashboardLayoutModes
                : ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed']
        );

        const getDashboardLayoutLabels = () => (
            deps.dashboardLayoutLabels && typeof deps.dashboardLayoutLabels === 'object'
                ? deps.dashboardLayoutLabels
                : {}
        );

        const resolveDashboardWidgetInlineHostForType = (type) => {
            const meta = dashboardTypeMeta(type);
            const $tbody = jq(meta.tbodySelector).first();
            if (!$tbody.length) {
                return jq();
            }
            const $targetCell = $tbody.children('tr.updated').children('td').first();
            if ($targetCell.length) {
                return $targetCell;
            }
            return $tbody;
        };

        const getDashboardFolderCardsForType = (type) => {
            const meta = dashboardTypeMeta(type);
            return jq(`${meta.tbodySelector} .folder-showcase-outer`);
        };

        const getDashboardWidgetBodyForType = (type) => {
            const meta = dashboardTypeMeta(type);
            return jq(meta.tbodySelector).first();
        };

        const getDashboardWidgetUpdatedRowForType = (type) => {
            const $tbody = getDashboardWidgetBodyForType(type);
            if (!$tbody.length) {
                return jq();
            }
            return $tbody.children('tr.updated').first();
        };

        const measureDashboardContainerWidth = (node) => {
            if (!node) {
                return 0;
            }
            const style = typeof win.getComputedStyle === 'function' ? win.getComputedStyle(node) : null;
            const horizontalPadding = style
                ? (parseFloat(style.paddingLeft || '0') || 0) + (parseFloat(style.paddingRight || '0') || 0)
                : 0;
            const borderBoxWidth = Number(node.getBoundingClientRect?.().width) || Number(node.clientWidth) || 0;
            return Math.max(0, Math.floor(borderBoxWidth - horizontalPadding));
        };

        const publishDashboardCompactMatrixTelemetry = (type, layout, metrics) => {
            const resolvedType = normalizeDashboardType(type);
            const renderComplete = typeof deps.isDashboardRenderCompleteForType === 'function'
                && deps.isDashboardRenderCompleteForType(resolvedType) === true;
            if (layout !== 'compactmatrix' || renderComplete !== true || metrics.containerWidth <= 0) {
                return;
            }
            const previous = state.compactMatrixMetricsByType[resolvedType];
            const next = {
                schemaVersion: 2,
                type: resolvedType,
                currentPreference: layout,
                measurementStatus: 'measured',
                measuredLayout: layout,
                widgetWidthPx: metrics.containerWidth,
                folderCount: metrics.folderCount,
                folderColumns: metrics.folderColumns,
                folderRows: metrics.folderRows,
                estimatedFolderWidthPx: metrics.estimatedFolderWidth,
                memberColumns: metrics.memberColumns,
                estimatedMemberWidthPx: metrics.estimatedMemberWidth,
                minimumFolderWidthPx: COMPACT_MATRIX_LAYOUT.minFolderWidth,
                minimumMemberWidthPx: COMPACT_MATRIX_LAYOUT.minMemberWidth
            };
            const comparable = (value) => JSON.stringify(value || {});
            if (comparable(previous) === comparable(next)) {
                return;
            }
            state.compactMatrixMetricsByType[resolvedType] = next;
            if (typeof deps.onLayoutTelemetry === 'function') {
                deps.onLayoutTelemetry(resolvedType, {
                    ...next,
                    renderComplete: true,
                    measuredAt: new Date().toISOString()
                });
            }
        };

        const scheduleDashboardCompactMatrixSyncForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            if (state.compactMatrixResizeRafByType[resolvedType]) {
                return;
            }
            const callback = () => {
                state.compactMatrixResizeRafByType[resolvedType] = 0;
                const layout = typeof deps.normalizeDashboardPrefsForType === 'function'
                    ? deps.normalizeDashboardPrefsForType(resolvedType).layout
                    : 'classic';
                syncDashboardCompactMatrixOrderFlowForType(resolvedType, layout);
            };
            state.compactMatrixResizeRafByType[resolvedType] = typeof win.requestAnimationFrame === 'function'
                ? win.requestAnimationFrame(callback)
                : win.setTimeout(callback, 16);
        };

        const bindDashboardCompactMatrixResizeObserverForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const $container = resolveDashboardWidgetInlineHostForType(resolvedType);
            const containerNode = $container.get(0) || null;
            if (!containerNode) {
                return;
            }
            if (
                state.compactMatrixObservedNodeByType[resolvedType] === containerNode
                && state.compactMatrixResizeObserverByType[resolvedType]
            ) {
                return;
            }
            state.compactMatrixResizeObserverByType[resolvedType]?.disconnect?.();
            state.compactMatrixResizeObserverByType[resolvedType] = null;
            state.compactMatrixObservedNodeByType[resolvedType] = containerNode;
            if (typeof win.ResizeObserver !== 'function') {
                return;
            }
            const observer = new win.ResizeObserver(() => {
                scheduleDashboardCompactMatrixSyncForType(resolvedType);
            });
            observer.observe(containerNode);
            state.compactMatrixResizeObserverByType[resolvedType] = observer;
        };

        const syncDashboardCompactMatrixOrderFlowForType = (type, layout) => {
            const resolvedType = normalizeDashboardType(type);
            const $container = resolveDashboardWidgetInlineHostForType(resolvedType);
            if (!$container.length) {
                return;
            }
            bindDashboardCompactMatrixResizeObserverForType(resolvedType);
            if (layout !== 'compactmatrix') {
                state.compactMatrixMetricsByType[resolvedType] = null;
                $container.css('--fv-dashboard-compactmatrix-columns', '');
                $container.css('--fv-dashboard-compactmatrix-rows', '');
                $container.css('--fv-dashboard-compactmatrix-member-columns', '');
                $container.removeAttr('data-fv-compactmatrix-folder-columns data-fv-compactmatrix-member-columns');
                return;
            }
            const directCardCount = $container.children('.folder-showcase-outer').length;
            const metrics = deriveCompactMatrixLayout({
                containerWidth: measureDashboardContainerWidth($container.get(0)),
                folderCount: directCardCount
            });
            $container.css('--fv-dashboard-compactmatrix-columns', String(metrics.folderColumns));
            $container.css('--fv-dashboard-compactmatrix-rows', String(metrics.folderRows));
            $container.css('--fv-dashboard-compactmatrix-member-columns', String(metrics.memberColumns));
            $container.attr('data-fv-compactmatrix-folder-columns', String(metrics.folderColumns));
            $container.attr('data-fv-compactmatrix-member-columns', String(metrics.memberColumns));
            publishDashboardCompactMatrixTelemetry(resolvedType, layout, metrics);
        };

        const isDashboardNodeVisible = (node) => {
            if (!node || !(node instanceof Element)) {
                return false;
            }
            if (node.hidden === true) {
                return false;
            }
            const ownerWindow = node.ownerDocument && node.ownerDocument.defaultView
                ? node.ownerDocument.defaultView
                : win;
            let current = node;
            while (current && current instanceof Element) {
                const style = ownerWindow.getComputedStyle(current);
                if (!style || style.display === 'none' || style.visibility === 'hidden') {
                    return false;
                }
                current = current.parentElement;
            }
            return node.getClientRects().length > 0;
        };

        const isDashboardWidgetCollapsedForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const $tbody = getDashboardWidgetBodyForType(resolvedType);
            if (!$tbody.length) {
                return true;
            }
            const $updatedRow = getDashboardWidgetUpdatedRowForType(resolvedType);
            if (!$updatedRow.length) {
                return true;
            }
            const updatedNode = $updatedRow.get(0);
            if (!updatedNode) {
                return true;
            }
            const style = win.getComputedStyle(updatedNode);
            if (!style || style.display === 'none' || style.visibility === 'hidden') {
                return true;
            }
            return !isDashboardNodeVisible(updatedNode);
        };

        const getFirstVisibleDashboardFolderCardForType = (type) => {
            const $cards = getDashboardFolderCardsForType(type);
            if (!$cards.length) {
                return null;
            }
            let firstVisible = null;
            $cards.each((_, node) => {
                if (isDashboardNodeVisible(node)) {
                    firstVisible = node;
                    return false;
                }
                return true;
            });
            return firstVisible;
        };

        const ensureDashboardWidgetInlineHostMountForType = (type, hostOverride = null) => {
            const resolvedType = normalizeDashboardType(type);
            const $container = resolveDashboardWidgetInlineHostForType(resolvedType);
            const $host = hostOverride && hostOverride.length
                ? hostOverride
                : jq(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`).first();
            if (!$container.length || !$host.length) {
                return $container;
            }
            if (!$host.parent().is($container)) {
                $container.prepend($host);
            }
            $container.addClass('fv-dashboard-layout-inline-container');
            return $container;
        };

        const hasVisibleDashboardFolderCardsForType = (type) => !!getFirstVisibleDashboardFolderCardForType(type);

        const syncDashboardWidgetQuickRailFitForType = (type, parentRect, offsetTop) => {
            const resolvedType = normalizeDashboardType(type);
            const $host = jq(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`).first();
            if (!$host.length) {
                return;
            }
            const $rail = $host.children('.fv-dashboard-layout-quick-rail').first();
            if (!$rail.length) {
                return;
            }
            const availableHeight = Math.max(0, Math.floor((parentRect?.height || 0) - offsetTop - 2));
            $host.toggleClass('is-narrow', Math.max(0, Number(parentRect?.width || 0)) < 440);
            if (availableHeight <= 0) {
                $host.removeClass('is-height-constrained');
                $host.css('max-height', '');
                $rail.css('max-height', '');
                $rail.removeClass('is-clamped is-compact-grid');
                return;
            }
            $host.css('max-height', `${availableHeight}px`);
            $rail.css('max-height', `${availableHeight}px`);
            $host.toggleClass('is-height-constrained', availableHeight < 58);

            const $buttons = $rail.children('button.fv-dashboard-quick-action').filter((_, node) => win.getComputedStyle(node).display !== 'none');
            const buttonCount = $buttons.length;
            const buttonNode = $buttons.first().get(0);
            const buttonStyle = buttonNode ? win.getComputedStyle(buttonNode) : null;
            const buttonHeight = buttonStyle
                ? Math.max(10, Math.round(parseFloat(buttonStyle.height) || 16))
                : 16;
            const railNode = $rail.get(0);
            const railStyle = railNode ? win.getComputedStyle(railNode) : null;
            const rowGap = railStyle
                ? Math.max(0, Math.round(parseFloat(railStyle.rowGap || railStyle.gap || '2') || 2))
                : 2;
            const singleRows = buttonCount;
            const singleHeight = singleRows > 0
                ? (singleRows * buttonHeight) + (Math.max(0, singleRows - 1) * rowGap)
                : 0;
            const gridRows = Math.ceil(buttonCount / 2);
            const gridHeight = gridRows > 0
                ? (gridRows * buttonHeight) + (Math.max(0, gridRows - 1) * rowGap)
                : 0;
            const useCompactGrid = availableHeight < singleHeight && availableHeight >= gridHeight;
            $rail.toggleClass('is-compact-grid', useCompactGrid);
            const requiredHeight = useCompactGrid ? gridHeight : singleHeight;
            $rail.toggleClass('is-clamped', requiredHeight > availableHeight);
        };

        const syncDashboardWidgetQuickRailAlignmentForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const $host = jq(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`).first();
            if (!$host.length) {
                return;
            }
            const hostNode = $host.get(0);
            const parentNode = hostNode && hostNode.parentElement ? hostNode.parentElement : null;
            const firstVisibleCard = getFirstVisibleDashboardFolderCardForType(resolvedType);
            if (!parentNode || !firstVisibleCard || !isDashboardNodeVisible(parentNode)) {
                $host.removeClass('is-height-constrained');
                $host.css('top', '');
                $host.css('max-height', '');
                $host.children('.fv-dashboard-layout-quick-rail').first().css('max-height', '').removeClass('is-clamped is-compact-grid');
                return;
            }
            const parentRect = parentNode.getBoundingClientRect();
            const cardRect = firstVisibleCard.getBoundingClientRect();
            const offsetTop = Math.max(0, Math.round(cardRect.top - parentRect.top));
            $host.css('top', `${offsetTop}px`);
            syncDashboardWidgetQuickRailFitForType(resolvedType, parentRect, offsetTop);
        };

        const syncDashboardWidgetQuickRailVisibilityForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const $host = jq(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`).first();
            if (!$host.length) {
                return;
            }
            ensureDashboardWidgetInlineHostMountForType(resolvedType, $host);
            const hostNode = $host.get(0);
            const parentNode = hostNode && hostNode.parentElement ? hostNode.parentElement : null;
            const shouldShow = !!parentNode
                && isDashboardNodeVisible(parentNode)
                && isDashboardWidgetCollapsedForType(resolvedType) !== true
                && (
                    hasVisibleDashboardFolderCardsForType(resolvedType)
                    || (typeof deps.isDashboardLegacyLayoutForType === 'function' && deps.isDashboardLegacyLayoutForType(resolvedType))
                    || (typeof deps.isDashboardLayoutTransitionInFlightForType === 'function' && deps.isDashboardLayoutTransitionInFlightForType(resolvedType))
                );
            $host.toggleClass('is-hidden', !shouldShow);
            jq(parentNode).toggleClass('fv-dashboard-has-visible-quick-rail', shouldShow);
            if (shouldShow) {
                syncDashboardWidgetQuickRailAlignmentForType(resolvedType);
                return;
            }
            $host.css('top', '');
            $host.css('max-height', '');
            $host.removeClass('is-height-constrained');
            $host.children('.fv-dashboard-layout-quick-rail').first().css('max-height', '').removeClass('is-clamped is-compact-grid');
        };

        const getDashboardFolderIdsForType = (type) => {
            const ids = [];
            getDashboardFolderCardsForType(type).each((_, node) => {
                const id = typeof deps.resolveFolderIdFromCard === 'function'
                    ? deps.resolveFolderIdFromCard(jq(node))
                    : '';
                if (id) {
                    ids.push(id);
                }
            });
            return ids;
        };

        const areAllDashboardFoldersExpandedForType = (type) => {
            const $cards = getDashboardFolderCardsForType(type);
            if (!$cards.length) {
                return false;
            }
            let allExpanded = true;
            $cards.each((_, node) => {
                if (jq(node).attr('expanded') !== 'true') {
                    allExpanded = false;
                    return false;
                }
                return true;
            });
            return allExpanded;
        };

        const hasExpandedDashboardFoldersForType = (type) => {
            let hasExpanded = false;
            getDashboardFolderCardsForType(type).each((_, node) => {
                if (jq(node).attr('expanded') === 'true') {
                    hasExpanded = true;
                    return false;
                }
                return true;
            });
            return hasExpanded;
        };

        const readDashboardQuickStateForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const hasStartedOnlyToggle = typeof deps.getDashboardStartedOnlySelectorForType === 'function'
                ? jq(deps.getDashboardStartedOnlySelectorForType(resolvedType)).length > 0
                : false;
            return {
                hasStartedOnlyToggle,
                startedOnlyEnabled: hasStartedOnlyToggle && typeof deps.isDashboardStartedOnlyEnabledForType === 'function'
                    ? deps.isDashboardStartedOnlyEnabledForType(resolvedType)
                    : false,
                healthEnabled: typeof deps.readDashboardHealthEmphasisStateForType === 'function'
                    ? deps.readDashboardHealthEmphasisStateForType(resolvedType)
                    : false,
                compactDensityEnabled: typeof deps.readDashboardCompactDensityStateForType === 'function'
                    ? deps.readDashboardCompactDensityStateForType(resolvedType)
                    : false,
                allExpanded: areAllDashboardFoldersExpandedForType(resolvedType),
                anyExpanded: hasExpandedDashboardFoldersForType(resolvedType),
                folderCount: getDashboardFolderCardsForType(resolvedType).length
            };
        };

        const isDashboardQuickStateDefaultForType = (type) => {
            const quickState = readDashboardQuickStateForType(type);
            return quickState.startedOnlyEnabled !== true
                && quickState.healthEnabled !== true
                && quickState.compactDensityEnabled !== true
                && quickState.anyExpanded !== true;
        };

        const syncDashboardViewPopoverForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const popover = state.viewPopoverByType[resolvedType];
            if (!popover?.element?.isConnected) return;
            const currentLayout = typeof deps.normalizeDashboardPrefsForType === 'function'
                ? deps.normalizeDashboardPrefsForType(resolvedType).layout
                : 'classic';
            const quickState = readDashboardQuickStateForType(resolvedType);
            const layoutSelect = popover.element.querySelector('[data-fv-layout-select]');
            if (layoutSelect) {
                layoutSelect.value = currentLayout;
                layoutSelect.disabled = state.layoutPendingByType[resolvedType] === true;
            }
            const toggleStates = {
                'running-only': quickState.startedOnlyEnabled,
                'health-emphasis': quickState.healthEnabled,
                'density-toggle': quickState.compactDensityEnabled
            };
            Object.entries(toggleStates).forEach(([action, enabled]) => {
                const button = popover.element.querySelector(`[data-fv-view-action="${action}"]`);
                if (!button) return;
                button.classList.toggle('is-active', enabled === true);
                button.setAttribute('aria-pressed', enabled === true ? 'true' : 'false');
                if (action === 'running-only') button.disabled = !quickState.hasStartedOnlyToggle;
            });
            const reset = popover.element.querySelector('[data-fv-view-action="reset-view"]');
            if (reset) reset.disabled = isDashboardQuickStateDefaultForType(resolvedType);
        };

        const buildDashboardViewPopoverMarkup = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const widgetLabel = resolvedType === 'vm' ? translate('dashboard.widget.vm', 'VM') : translate('dashboard.widget.docker', 'Docker');
            const layoutLabels = getDashboardLayoutLabels();
            const currentLayout = typeof deps.normalizeDashboardPrefsForType === 'function'
                ? deps.normalizeDashboardPrefsForType(resolvedType).layout
                : 'classic';
            const layoutOptions = getDashboardLayoutModes().map((layout) => `
                <option value="${escapeHtml(layout)}"${layout === currentLayout ? ' selected' : ''}>${escapeHtml(layoutLabels[layout] || layout)}</option>`).join('');
            const toggleRow = (action, icon, label, description) => `
                <button type="button" class="fv-dashboard-view-option" data-fv-view-action="${escapeHtml(action)}" aria-pressed="false">
                    <i class="fa ${escapeHtml(icon)} fv-dashboard-view-option-icon" aria-hidden="true"></i>
                    <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
                    <i class="fa fa-check fv-dashboard-view-option-check" aria-hidden="true"></i>
                </button>`;
            return `
                <div class="fv-dashboard-view-popover" data-fv-dashboard-type="${resolvedType}">
                    <header><strong>${escapeHtml(translate('dashboard.quick.view-options-title', '$1 view options', widgetLabel))}</strong><span>${escapeHtml(translate('dashboard.quick.view-options-help', 'Customize this Dashboard widget.'))}</span></header>
                    <section class="fv-dashboard-view-section" data-fv-view-section="layout">
                        <h3>${escapeHtml(translate('dashboard.quick.layout', 'Layout'))}</h3>
                        <div class="fv-dashboard-layout-select-shell">
                            <i class="fa fa-columns" aria-hidden="true"></i>
                            <select class="fv-dashboard-layout-select" data-fv-layout-select aria-label="${escapeHtml(translate('dashboard.quick.choose-layout', 'Choose layout'))}">${layoutOptions}</select>
                            <i class="fa fa-chevron-down" aria-hidden="true"></i>
                        </div>
                    </section>
                    <section class="fv-dashboard-view-section">
                        <h3>${escapeHtml(translate('dashboard.quick.display', 'Display'))}</h3>
                        <div class="fv-dashboard-view-options">
                            ${toggleRow('running-only', 'fa-play-circle', translate('dashboard.quick.running-only', 'Running only'), translate('dashboard.quick.running-only-help', 'Hide stopped members and folders.'))}
                            ${toggleRow('health-emphasis', 'fa-heartbeat', translate('dashboard.quick.health-emphasis', 'Health emphasis'), translate('dashboard.quick.health-emphasis-help', 'Make runtime health states easier to scan.'))}
                            ${toggleRow('density-toggle', 'fa-compress', translate('dashboard.quick.compact-density', 'Compact density'), translate('dashboard.quick.compact-density-help', 'Reduce spacing to fit more folders.'))}
                        </div>
                    </section>
                    <footer>
                        <button type="button" class="fv-dashboard-view-footer-action" data-fv-view-action="reset-view"><i class="fa fa-undo" aria-hidden="true"></i><span>${escapeHtml(translate('dashboard.quick.reset-view', 'Reset view'))}</span></button>
                        <button type="button" class="fv-dashboard-view-footer-action" data-fv-view-action="open-settings"><i class="fa fa-cog" aria-hidden="true"></i><span>${escapeHtml(translate('dashboard.quick.open-settings', 'Open settings'))}</span></button>
                    </footer>
                </div>`;
        };

        const setDashboardLayoutFromQuickRail = async (type, layout) => {
            const resolvedType = normalizeDashboardType(type);
            if (state.layoutPendingByType[resolvedType]) return;
            state.layoutPendingByType[resolvedType] = true;
            syncDashboardWidgetLayoutQuickControlForType(resolvedType);
            try {
                const result = typeof deps.onLayoutCycle === 'function'
                    ? await deps.onLayoutCycle(resolvedType, layout)
                    : { ok: true };
                if (result?.ok === false) throw (result.error instanceof Error ? result.error : new Error(String(result.error || 'Unable to save dashboard view preference.')));
            } catch (error) {
                ui?.toast?.({
                    title: translate('dashboard.quick.save-error-title', 'Dashboard view not saved'),
                    message: String(error?.message || translate('dashboard.quick.save-error-message', 'Unable to save the Dashboard view preference.')),
                    tone: 'danger'
                });
            } finally {
                state.layoutPendingByType[resolvedType] = false;
                syncDashboardWidgetLayoutQuickControlForType(resolvedType);
            }
        };

        const openDashboardViewPopoverForType = (type, trigger, initialSection = 'all') => {
            const resolvedType = normalizeDashboardType(type);
            const existing = state.viewPopoverByType[resolvedType];
            if (existing?.element?.isConnected && existing.trigger === trigger) {
                existing.close('toggle');
                return;
            }
            if (typeof ui?.openPopover !== 'function') return;
            const widgetLabel = resolvedType === 'vm' ? translate('dashboard.widget.vm', 'VM') : translate('dashboard.widget.docker', 'Docker');
            const popover = ui.openPopover({
                trigger,
                content: buildDashboardViewPopoverMarkup(resolvedType),
                ariaLabel: translate('dashboard.quick.view-options-title', '$1 view options', widgetLabel),
                className: 'fv-dashboard-view-popover-shell',
                placement: 'bottom-end',
                initialFocus: initialSection === 'layout' ? '[data-fv-layout-select]' : '[data-fv-view-action="running-only"]',
                onClose: () => {
                    if (state.viewPopoverByType[resolvedType]?.element === popover?.element) state.viewPopoverByType[resolvedType] = null;
                }
            });
            if (!popover) return;
            state.viewPopoverByType[resolvedType] = popover;
            syncDashboardViewPopoverForType(resolvedType);
            popover.element.addEventListener('change', (event) => {
                const layoutSelect = event.target.closest('[data-fv-layout-select]');
                if (!layoutSelect) return;
                const layout = String(layoutSelect.value || '').trim();
                if (!getDashboardLayoutModes().includes(layout)) return;
                popover.close('layout-selected');
                void setDashboardLayoutFromQuickRail(resolvedType, layout);
            });
            popover.element.addEventListener('click', (event) => {
                const actionButton = event.target.closest('[data-fv-view-action]');
                if (!actionButton || actionButton.disabled) return;
                const action = String(actionButton.getAttribute('data-fv-view-action') || '').trim();
                if (action === 'running-only') {
                    const current = readDashboardQuickStateForType(resolvedType).startedOnlyEnabled;
                    deps.onSetStartedOnlyEnabled?.(resolvedType, !current);
                    syncDashboardWidgetLayoutQuickControlForType(resolvedType);
                } else if (action === 'health-emphasis') {
                    const current = readDashboardQuickStateForType(resolvedType).healthEnabled;
                    deps.onToggleHealthEmphasis?.(resolvedType, !current);
                    syncDashboardWidgetLayoutQuickControlForType(resolvedType);
                } else if (action === 'density-toggle') {
                    const current = readDashboardQuickStateForType(resolvedType).compactDensityEnabled;
                    deps.onToggleDensity?.(resolvedType, !current);
                    syncDashboardWidgetLayoutQuickControlForType(resolvedType);
                } else if (action === 'reset-view') {
                    popover.close('reset');
                    deps.onResetView?.(resolvedType);
                } else if (action === 'open-settings') {
                    popover.close('settings', { restoreFocus: false });
                    deps.onOpenSettings?.();
                }
            });
        };

        const syncDashboardWidgetLayoutQuickControlForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const widgetLabel = resolvedType === 'vm' ? translate('dashboard.widget.vm', 'VM') : translate('dashboard.widget.docker', 'Docker');
            const currentLayout = typeof deps.normalizeDashboardPrefsForType === 'function'
                ? deps.normalizeDashboardPrefsForType(resolvedType).layout
                : 'classic';
            const layoutLabel = getDashboardLayoutLabels()[currentLayout] || currentLayout;
            const $host = jq(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`).first();
            if (!$host.length) {
                return;
            }

            const $rail = $host.children('.fv-dashboard-layout-quick-rail').first();
            const quickState = readDashboardQuickStateForType(resolvedType);
            const $layoutControl = $rail.children('[data-fv-quick-action="layout-menu"]').first();
            if ($layoutControl.length) {
                $layoutControl.attr('data-fv-layout', currentLayout);
                $layoutControl.toggleClass('is-pending', state.layoutPendingByType[resolvedType] === true);
                $layoutControl.prop('disabled', state.layoutPendingByType[resolvedType] === true);
                $layoutControl.attr('title', translate('dashboard.quick.current-layout', '$1 view: $2. Choose a layout.', widgetLabel, layoutLabel));
                $layoutControl.attr('aria-label', translate('dashboard.quick.current-layout', '$1 view: $2. Choose a layout.', widgetLabel, layoutLabel));
                $layoutControl.children('i.fa').attr('class', state.layoutPendingByType[resolvedType] ? 'fa fa-spinner fa-spin' : 'fa fa-columns');
            }

            const $expandControl = $rail.children('[data-fv-quick-action="expand-toggle"]').first();
            if ($expandControl.length) {
                $expandControl.toggleClass('is-active', quickState.allExpanded === true);
                $expandControl.prop('disabled', quickState.folderCount === 0);
                $expandControl.attr('aria-pressed', quickState.allExpanded === true ? 'true' : 'false');
                $expandControl.attr('title', quickState.allExpanded ? translate('dashboard.quick.collapse-all', '$1: Collapse all folders', widgetLabel) : translate('dashboard.quick.expand-all', '$1: Expand all folders', widgetLabel));
                $expandControl.attr('aria-label', quickState.allExpanded ? translate('dashboard.quick.collapse-all', '$1: Collapse all folders', widgetLabel) : translate('dashboard.quick.expand-all', '$1: Expand all folders', widgetLabel));
                const $icon = $expandControl.children('i.fa').first();
                $icon.toggleClass('fa-angle-double-down', quickState.allExpanded !== true);
                $icon.toggleClass('fa-angle-double-up', quickState.allExpanded === true);
            }

            const $runningControl = $rail.children('[data-fv-quick-action="running-only"]').first();
            if ($runningControl.length) {
                $runningControl.toggleClass('is-active', quickState.startedOnlyEnabled);
                $runningControl.prop('disabled', !quickState.hasStartedOnlyToggle);
                $runningControl.attr('aria-pressed', quickState.startedOnlyEnabled ? 'true' : 'false');
                $runningControl.attr('title', translate('dashboard.quick.running-state', '$1: Running-only $2', widgetLabel, quickState.startedOnlyEnabled ? translate('dashboard.quick.enabled', 'enabled') : translate('dashboard.quick.disabled', 'disabled')));
                $runningControl.attr('aria-label', translate('dashboard.quick.running-state', '$1: Running-only $2', widgetLabel, quickState.startedOnlyEnabled ? translate('dashboard.quick.enabled', 'enabled') : translate('dashboard.quick.disabled', 'disabled')));
            }

            const $viewControl = $rail.children('[data-fv-quick-action="view-options"]').first();
            if ($viewControl.length) {
                const label = translate('dashboard.quick.view-options-title', '$1 view options', widgetLabel);
                $viewControl.attr('title', label).attr('aria-label', label);
            }

            syncDashboardViewPopoverForType(resolvedType);
            syncDashboardWidgetQuickRailVisibilityForType(resolvedType);
        };

        const ensureDashboardWidgetLayoutQuickSwitchForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const $container = resolveDashboardWidgetInlineHostForType(resolvedType);
            if (!$container.length) {
                if (state.quickSwitchRetryTimerByType[resolvedType]) {
                    return;
                }
                state.quickSwitchRetryTimerByType[resolvedType] = win.setTimeout(() => {
                    state.quickSwitchRetryTimerByType[resolvedType] = 0;
                    ensureDashboardWidgetLayoutQuickSwitchForType(resolvedType);
                }, 320);
                return;
            }
            const hostSelector = `.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`;
            let $host = jq(hostSelector).first();
            if (!$host.length) {
                $host = jq(`<div class="fv-dashboard-layout-inline-host fv-dashboard-quick-rail-host" data-fv-dashboard-type="${resolvedType}"></div>`);
            }
            ensureDashboardWidgetInlineHostMountForType(resolvedType, $host);
            if (!$host.hasClass('fv-dashboard-quick-rail-host')) {
                $host.addClass('fv-dashboard-quick-rail-host');
            }
            let $rail = $host.children('.fv-dashboard-layout-quick-rail').first();
            if (!$rail.length) {
                $rail = jq('<div class="fv-dashboard-layout-quick-rail" role="group" aria-label="Dashboard quick actions"></div>');
                $host.append($rail);
            }

            const ensureQuickAction = (action, iconClass, label, extraClass = '') => {
                let $button = $rail.children(`button[data-fv-quick-action="${action}"]`).first();
                if (!$button.length) {
                    const className = `fv-dashboard-quick-action ${extraClass}`.trim();
                    $button = jq(
                        `<button type="button" class="${className}" data-fv-dashboard-type="${resolvedType}" data-fv-quick-action="${action}" aria-label="${label}" title="${label}">` +
                            `<i class="fa ${iconClass}" aria-hidden="true"></i>` +
                        '</button>'
                    );
                    $rail.append($button);
                }
                return $button;
            };

            ensureQuickAction('layout-menu', 'fa-columns', translate('dashboard.quick.choose-layout', 'Choose layout'), 'fv-dashboard-layout-quick is-responsive-secondary').attr('aria-haspopup', 'dialog').attr('aria-expanded', 'false');
            ensureQuickAction('expand-toggle', 'fa-angle-double-down', translate('dashboard.quick.expand-all-short', 'Expand all folders'));
            ensureQuickAction('running-only', 'fa-play-circle', translate('dashboard.quick.running-only', 'Running only'), 'is-responsive-secondary');
            ensureQuickAction('view-options', 'fa-sliders', translate('dashboard.quick.view-options', 'View options')).attr('aria-haspopup', 'dialog').attr('aria-expanded', 'false');

            if (!$rail.data('fvQuickActionBound')) {
                $rail.on('click.fvplusdashboardquick', 'button.fv-dashboard-quick-action', (event) => {
                    const $button = jq(event.currentTarget);
                    const action = String($button.attr('data-fv-quick-action') || '').trim();
                    const buttonType = normalizeDashboardType(String($button.attr('data-fv-dashboard-type') || '').trim());
                    if (!action) {
                        return;
                    }
                    if (action === 'layout-menu') {
                        openDashboardViewPopoverForType(buttonType, $button.get(0), 'layout');
                        return;
                    }
                    if (action === 'expand-toggle') {
                        if (typeof deps.onToggleExpandAll === 'function') {
                            deps.onToggleExpandAll(buttonType);
                        }
                        syncDashboardWidgetLayoutQuickControlForType(buttonType);
                        return;
                    }
                    if (action === 'running-only') {
                        const current = typeof deps.isDashboardStartedOnlyEnabledForType === 'function'
                            ? deps.isDashboardStartedOnlyEnabledForType(buttonType)
                            : false;
                        if (typeof deps.onSetStartedOnlyEnabled === 'function') {
                            deps.onSetStartedOnlyEnabled(buttonType, !current);
                        }
                        syncDashboardWidgetLayoutQuickControlForType(buttonType);
                        return;
                    }
                    if (action === 'view-options') openDashboardViewPopoverForType(buttonType, $button.get(0), 'all');
                });
                $rail.data('fvQuickActionBound', true);
            }

            bindDashboardWidgetVisibilityObserverForType(resolvedType);
            syncDashboardWidgetLayoutQuickControlForType(resolvedType);
            scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
        };

        const applyDashboardLayoutStateForType = (type) => {
            const meta = dashboardTypeMeta(type);
            if (
                typeof deps.isDashboardPrefsHydratedForType === 'function'
                && deps.isDashboardPrefsHydratedForType(meta.type) !== true
            ) {
                return;
            }
            const $tbody = jq(meta.tbodySelector);
            if (!$tbody.length) {
                return;
            }
            const dashboardPrefs = typeof deps.normalizeDashboardPrefsForType === 'function'
                ? deps.normalizeDashboardPrefsForType(meta.type)
                : { layout: 'classic', expandToggle: true, greyscale: false, folderLabel: true };
            const layout = dashboardPrefs.layout || 'classic';
            const folderCardLayout = !['classic', 'legacy'].includes(layout);
            $tbody.attr('data-fv-dashboard-layout', layout);
            $tbody.removeClass('fv-dashboard-layout-classic fv-dashboard-layout-legacy fv-dashboard-layout-fullwidth fv-dashboard-layout-accordion fv-dashboard-layout-inset fv-dashboard-layout-compactmatrix fv-dashboard-layout-embossed');
            $tbody.addClass(`fv-dashboard-layout-${layout}`);
            $tbody.toggleClass('fv-dashboard-show-expand-toggle', folderCardLayout && dashboardPrefs.expandToggle === true);
            $tbody.toggleClass('fv-dashboard-greyscale-enabled', folderCardLayout && dashboardPrefs.greyscale === true);
            $tbody.toggleClass('fv-dashboard-hide-folder-label', folderCardLayout && dashboardPrefs.folderLabel === false);
            $tbody.toggleClass('fv-dashboard-health-emphasis-enabled', typeof deps.readDashboardHealthEmphasisStateForType === 'function' && deps.readDashboardHealthEmphasisStateForType(meta.type));
            $tbody.toggleClass('fv-dashboard-density-compact', typeof deps.readDashboardCompactDensityStateForType === 'function' && deps.readDashboardCompactDensityStateForType(meta.type));
            syncDashboardCompactMatrixOrderFlowForType(meta.type, layout);
            ensureDashboardWidgetLayoutQuickSwitchForType(meta.type);
            $tbody.find('.folder-showcase-outer').each((_, node) => {
                const $card = jq(node);
                const isExpanded = $card.attr('expanded') === 'true';
                $card.toggleClass('fv-dashboard-card-expanded', isExpanded);
                $card.toggleClass('fv-dashboard-card-collapsed', !isExpanded);
                if (typeof deps.updateExpandToggleIcon === 'function') {
                    deps.updateExpandToggleIcon($card, isExpanded);
                }
            });
        };

        const scheduleDashboardLayoutApplyForType = (type) => {
            const meta = dashboardTypeMeta(type);
            const resolvedType = meta.type;
            state.layoutApplyTokenByType[resolvedType] = (state.layoutApplyTokenByType[resolvedType] || 0) + 1;
            const token = state.layoutApplyTokenByType[resolvedType];
            if (state.layoutRafByType[resolvedType]) {
                return;
            }
            const runApply = () => {
                state.layoutRafByType[resolvedType] = 0;
                if (token !== state.layoutApplyTokenByType[resolvedType]) {
                    scheduleDashboardLayoutApplyForType(resolvedType);
                    return;
                }
                applyDashboardLayoutStateForType(resolvedType);
            };
            if (typeof win.requestAnimationFrame === 'function') {
                state.layoutRafByType[resolvedType] = win.requestAnimationFrame(runApply);
                return;
            }
            state.layoutRafByType[resolvedType] = win.setTimeout(runApply, 16);
        };

        const scheduleDashboardWidgetVisibilitySyncForType = (type, delayMs = 40) => {
            const resolvedType = normalizeDashboardType(type);
            const delay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : 40;
            if (state.widgetVisibilitySyncTimerByType[resolvedType]) {
                win.clearTimeout(state.widgetVisibilitySyncTimerByType[resolvedType]);
            }
            state.widgetVisibilitySyncTimerByType[resolvedType] = win.setTimeout(() => {
                state.widgetVisibilitySyncTimerByType[resolvedType] = 0;
                syncDashboardWidgetQuickRailVisibilityForType(resolvedType);
            }, delay);
        };

        const bindDashboardWidgetVisibilityObserverForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const $container = resolveDashboardWidgetInlineHostForType(resolvedType);
            if (!$container.length || typeof MutationObserver !== 'function') {
                return;
            }
            const containerNode = $container.get(0);
            if (!containerNode) {
                return;
            }
            if (state.widgetVisibilityObserverByType[resolvedType]) {
                state.widgetVisibilityObserverByType[resolvedType].disconnect();
                state.widgetVisibilityObserverByType[resolvedType] = null;
            }
            const observer = new MutationObserver(() => {
                scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 30);
            });
            const nodesToObserve = [];
            let current = containerNode;
            for (let depth = 0; current && depth < 16; depth += 1) {
                if (current instanceof Element) {
                    nodesToObserve.push(current);
                }
                current = current.parentElement;
            }
            for (const node of nodesToObserve) {
                observer.observe(node, {
                    attributes: true,
                    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
                });
            }
            observer.observe(containerNode, {
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
                childList: true,
                subtree: true
            });
            state.widgetVisibilityObserverByType[resolvedType] = observer;
            scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
        };

        const bindDashboardQuickActionSyncHandlers = () => {
            if (state.quickActionSyncBound) {
                return;
            }
            jq(win.document).on('change.fvplusdashboardquick', 'input#apps, input#vms', (event) => {
                const id = String(event?.currentTarget?.id || '').trim().toLowerCase();
                if (id === 'apps') {
                    applyDashboardStartedOnlyFilterForType('docker');
                    syncDashboardWidgetLayoutQuickControlForType('docker');
                    scheduleDashboardWidgetVisibilitySyncForType('docker', 0);
                    return;
                }
                if (id === 'vms') {
                    applyDashboardStartedOnlyFilterForType('vm');
                    syncDashboardWidgetLayoutQuickControlForType('vm');
                    scheduleDashboardWidgetVisibilitySyncForType('vm', 0);
                }
            });
            jq(win.document).on('click.fvplusdashboardquickcollapse', 'a.switch, .switch', () => {
                scheduleDashboardWidgetVisibilitySyncForType('docker', 0);
                scheduleDashboardWidgetVisibilitySyncForType('vm', 0);
                scheduleDashboardWidgetVisibilitySyncForType('docker', 80);
                scheduleDashboardWidgetVisibilitySyncForType('vm', 80);
                scheduleDashboardWidgetVisibilitySyncForType('docker', 220);
                scheduleDashboardWidgetVisibilitySyncForType('vm', 220);
            });
            jq(win).on('resize.fvplusdashboardquick orientationchange.fvplusdashboardquick', () => {
                scheduleDashboardWidgetVisibilitySyncForType('docker', 0);
                scheduleDashboardWidgetVisibilitySyncForType('vm', 0);
                scheduleDashboardCompactMatrixSyncForType('docker');
                scheduleDashboardCompactMatrixSyncForType('vm');
            });
            state.quickActionSyncBound = true;
        };

        return Object.freeze({
            resolveDashboardWidgetInlineHostForType,
            getDashboardFolderCardsForType,
            getDashboardWidgetBodyForType,
            getDashboardWidgetUpdatedRowForType,
            isDashboardNodeVisible,
            isDashboardWidgetCollapsedForType,
            getFirstVisibleDashboardFolderCardForType,
            ensureDashboardWidgetInlineHostMountForType,
            syncDashboardWidgetQuickRailFitForType,
            syncDashboardWidgetQuickRailVisibilityForType,
            getDashboardFolderIdsForType,
            areAllDashboardFoldersExpandedForType,
            syncDashboardWidgetLayoutQuickControlForType,
            ensureDashboardWidgetLayoutQuickSwitchForType,
            syncDashboardCompactMatrixOrderFlowForType,
            scheduleDashboardCompactMatrixSyncForType,
            bindDashboardCompactMatrixResizeObserverForType,
            getDashboardCompactMatrixMetrics: () => ({
                docker: state.compactMatrixMetricsByType.docker,
                vm: state.compactMatrixMetricsByType.vm
            }),
            applyDashboardLayoutStateForType,
            scheduleDashboardLayoutApplyForType,
            scheduleDashboardWidgetVisibilitySyncForType,
            bindDashboardWidgetVisibilityObserverForType,
            applyDashboardStartedOnlyFilterForType,
            bindDashboardQuickActionSyncHandlers
        });
    };

    return Object.freeze({
        COMPACT_MATRIX_LAYOUT,
        deriveCompactMatrixLayout,
        createController
    });
}));
