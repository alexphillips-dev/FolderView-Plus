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
            quickActionSyncBound: false
        };

        const dashboardTypeMeta = (type) => (
            typeof deps.dashboardTypeMeta === 'function'
                ? deps.dashboardTypeMeta(type)
                : defaultDashboardTypeMeta(type)
        );

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
            const previous = state.compactMatrixMetricsByType[resolvedType];
            const next = {
                schemaVersion: 1,
                type: resolvedType,
                layout,
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
                    observedAt: new Date().toISOString()
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
                $container.css('--fv-dashboard-compactmatrix-columns', '');
                $container.css('--fv-dashboard-compactmatrix-rows', '');
                $container.css('--fv-dashboard-compactmatrix-member-columns', '');
                $container.removeAttr('data-fv-compactmatrix-folder-columns data-fv-compactmatrix-member-columns');
                publishDashboardCompactMatrixTelemetry(resolvedType, layout, deriveCompactMatrixLayout());
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
            if (availableHeight <= 0) {
                $host.css('max-height', '');
                $rail.css('max-height', '');
                $rail.removeClass('is-clamped is-compact-grid');
                return;
            }
            $host.css('max-height', `${availableHeight}px`);
            $rail.css('max-height', `${availableHeight}px`);

            const $buttons = $rail.children('button.fv-dashboard-quick-action');
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

        const syncDashboardWidgetLayoutQuickControlForType = (type) => {
            const resolvedType = normalizeDashboardType(type);
            const widgetLabel = resolvedType === 'vm' ? 'VM' : 'Docker';
            const currentLayout = typeof deps.normalizeDashboardPrefsForType === 'function'
                ? deps.normalizeDashboardPrefsForType(resolvedType).layout
                : 'classic';
            const layoutLabel = getDashboardLayoutLabels()[currentLayout] || currentLayout;
            const $host = jq(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${resolvedType}"]`).first();
            if (!$host.length) {
                return;
            }

            const $rail = $host.children('.fv-dashboard-layout-quick-rail').first();
            const $layoutControl = $rail.children('[data-fv-quick-action="layout-cycle"]').first();
            if ($layoutControl.length) {
                $layoutControl.attr('data-fv-layout', currentLayout);
                $layoutControl.attr('title', `${widgetLabel} view: ${layoutLabel} (click to switch)`);
                $layoutControl.attr('aria-label', `${widgetLabel} dashboard view: ${layoutLabel}. Click to switch.`);
            }

            const allExpanded = areAllDashboardFoldersExpandedForType(resolvedType);
            const folderCount = getDashboardFolderCardsForType(resolvedType).length;
            const $expandControl = $rail.children('[data-fv-quick-action="expand-toggle"]').first();
            if ($expandControl.length) {
                $expandControl.toggleClass('is-active', allExpanded === true);
                $expandControl.prop('disabled', folderCount === 0);
                $expandControl.attr('title', allExpanded ? `${widgetLabel}: Collapse all folders` : `${widgetLabel}: Expand all folders`);
                $expandControl.attr('aria-label', allExpanded ? `${widgetLabel}: collapse all folders` : `${widgetLabel}: expand all folders`);
                const $icon = $expandControl.children('i.fa').first();
                $icon.toggleClass('fa-angle-double-down', allExpanded !== true);
                $icon.toggleClass('fa-angle-double-up', allExpanded === true);
            }

            const hasStartedOnlyToggle = typeof deps.getDashboardStartedOnlySelectorForType === 'function'
                ? jq(deps.getDashboardStartedOnlySelectorForType(resolvedType)).length > 0
                : false;
            const startedOnlyEnabled = hasStartedOnlyToggle && typeof deps.isDashboardStartedOnlyEnabledForType === 'function'
                ? deps.isDashboardStartedOnlyEnabledForType(resolvedType)
                : false;
            const $runningControl = $rail.children('[data-fv-quick-action="running-only"]').first();
            if ($runningControl.length) {
                $runningControl.toggleClass('is-active', startedOnlyEnabled);
                $runningControl.prop('disabled', !hasStartedOnlyToggle);
                $runningControl.attr('title', `${widgetLabel}: Running-only ${startedOnlyEnabled ? 'enabled' : 'disabled'}`);
                $runningControl.attr('aria-label', `${widgetLabel}: running-only ${startedOnlyEnabled ? 'enabled' : 'disabled'}`);
            }

            const healthEnabled = typeof deps.readDashboardHealthEmphasisStateForType === 'function'
                ? deps.readDashboardHealthEmphasisStateForType(resolvedType)
                : false;
            const $healthControl = $rail.children('[data-fv-quick-action="health-emphasis"]').first();
            if ($healthControl.length) {
                $healthControl.toggleClass('is-active', healthEnabled);
                $healthControl.attr('title', `${widgetLabel}: Health emphasis ${healthEnabled ? 'enabled' : 'disabled'}`);
                $healthControl.attr('aria-label', `${widgetLabel}: health emphasis ${healthEnabled ? 'enabled' : 'disabled'}`);
            }

            const compactDensityEnabled = typeof deps.readDashboardCompactDensityStateForType === 'function'
                ? deps.readDashboardCompactDensityStateForType(resolvedType)
                : false;
            const $densityControl = $rail.children('[data-fv-quick-action="density-toggle"]').first();
            if ($densityControl.length) {
                $densityControl.toggleClass('is-active', compactDensityEnabled);
                $densityControl.attr('title', `${widgetLabel}: Compact density ${compactDensityEnabled ? 'enabled' : 'disabled'}`);
                $densityControl.attr('aria-label', `${widgetLabel}: compact density ${compactDensityEnabled ? 'enabled' : 'disabled'}`);
            }

            const $resetControl = $rail.children('[data-fv-quick-action="reset-view"]').first();
            if ($resetControl.length) {
                $resetControl.attr('title', `${widgetLabel}: Reset quick view state`);
                $resetControl.attr('aria-label', `${widgetLabel}: reset quick view state`);
            }

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

            ensureQuickAction('layout-cycle', 'fa-columns', 'Cycle layout view', 'fv-dashboard-layout-quick');
            ensureQuickAction('expand-toggle', 'fa-angle-double-down', 'Expand all folders');
            ensureQuickAction('running-only', 'fa-play-circle', 'Toggle running-only filter');
            ensureQuickAction('health-emphasis', 'fa-heartbeat', 'Toggle health emphasis');
            ensureQuickAction('density-toggle', 'fa-compress', 'Toggle compact density');
            ensureQuickAction('reset-view', 'fa-undo', 'Reset widget view');
            ensureQuickAction('open-settings', 'fa-cog', 'Open FolderView Plus settings');

            if (!$rail.data('fvQuickActionBound')) {
                $rail.on('click.fvplusdashboardquick', 'button.fv-dashboard-quick-action', (event) => {
                    const $button = jq(event.currentTarget);
                    const action = String($button.attr('data-fv-quick-action') || '').trim();
                    const buttonType = normalizeDashboardType(String($button.attr('data-fv-dashboard-type') || '').trim());
                    if (!action) {
                        return;
                    }
                    if (action === 'layout-cycle') {
                        const currentLayout = typeof deps.normalizeDashboardPrefsForType === 'function'
                            ? deps.normalizeDashboardPrefsForType(buttonType).layout
                            : 'classic';
                        const layoutModes = getDashboardLayoutModes();
                        const currentIndex = layoutModes.indexOf(currentLayout);
                        const nextIndex = currentIndex < 0 ? 0 : ((currentIndex + 1) % layoutModes.length);
                        if (typeof deps.onLayoutCycle === 'function') {
                            void deps.onLayoutCycle(buttonType, layoutModes[nextIndex]);
                        }
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
                    if (action === 'health-emphasis') {
                        const current = typeof deps.readDashboardHealthEmphasisStateForType === 'function'
                            ? deps.readDashboardHealthEmphasisStateForType(buttonType)
                            : false;
                        if (typeof deps.onToggleHealthEmphasis === 'function') {
                            deps.onToggleHealthEmphasis(buttonType, !current);
                        }
                        syncDashboardWidgetLayoutQuickControlForType(buttonType);
                        return;
                    }
                    if (action === 'density-toggle') {
                        const current = typeof deps.readDashboardCompactDensityStateForType === 'function'
                            ? deps.readDashboardCompactDensityStateForType(buttonType)
                            : false;
                        if (typeof deps.onToggleDensity === 'function') {
                            deps.onToggleDensity(buttonType, !current);
                        }
                        syncDashboardWidgetLayoutQuickControlForType(buttonType);
                        return;
                    }
                    if (action === 'reset-view') {
                        if (typeof deps.onResetView === 'function') {
                            deps.onResetView(buttonType);
                        }
                        return;
                    }
                    if (action === 'open-settings' && typeof deps.onOpenSettings === 'function') {
                        deps.onOpenSettings();
                    }
                });
                $rail.data('fvQuickActionBound', true);
            }

            bindDashboardWidgetVisibilityObserverForType(resolvedType);
            syncDashboardWidgetLayoutQuickControlForType(resolvedType);
            scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
        };

        const applyDashboardLayoutStateForType = (type) => {
            const meta = dashboardTypeMeta(type);
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
                    syncDashboardWidgetLayoutQuickControlForType('docker');
                    scheduleDashboardWidgetVisibilitySyncForType('docker', 0);
                    return;
                }
                if (id === 'vms') {
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
            bindDashboardQuickActionSyncHandlers
        });
    };

    return Object.freeze({
        COMPACT_MATRIX_LAYOUT,
        deriveCompactMatrixLayout,
        createController
    });
}));
