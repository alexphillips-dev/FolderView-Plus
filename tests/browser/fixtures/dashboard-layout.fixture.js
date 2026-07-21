(() => {
    const telemetry = [];
    const state = {
        layout: 'compactmatrix',
        health: false,
        density: false,
        settingsOpened: false
    };
    const controller = window.FolderViewPlusDashboardLayoutQuickRail.createController({
        window,
        $: window.jQuery,
        ui: window.FolderViewPlusUI,
        normalizeDashboardPrefsForType: () => ({
            layout: state.layout,
            expandToggle: true,
            greyscale: false,
            folderLabel: true
        }),
        dashboardLayoutLabels: {
            classic: 'Classic', legacy: 'Legacy', fullwidth: 'Full Width', accordion: 'Accordion',
            inset: 'Inset', compactmatrix: 'Compact Matrix', embossed: 'Embossed'
        },
        isDashboardPrefsHydratedForType: () => true,
        isDashboardRenderCompleteForType: () => true,
        getDashboardStartedOnlySelectorForType: (type) => (type === 'vm' ? '#vms' : '#apps'),
        isDashboardStartedOnlyEnabledForType: (type) => document.querySelector(type === 'vm' ? '#vms' : '#apps').checked,
        readDashboardHealthEmphasisStateForType: () => state.health,
        readDashboardCompactDensityStateForType: () => state.density,
        resolveFolderIdFromCard: ($card) => String($card.index()),
        updateExpandToggleIcon: () => {},
        onLayoutCycle: async (_type, layout) => {
            state.layout = layout;
            controller.applyDashboardLayoutStateForType('docker');
            return { ok: true };
        },
        onToggleExpandAll: () => {
            const cards = [...document.querySelectorAll('.folder-showcase-outer')];
            const expand = cards.some((card) => card.getAttribute('expanded') !== 'true');
            cards.forEach((card) => card.setAttribute('expanded', expand ? 'true' : 'false'));
        },
        onSetStartedOnlyEnabled: (_type, enabled) => {
            const toggle = document.querySelector('#apps');
            toggle.checked = enabled;
            toggle.dispatchEvent(new Event('change', { bubbles: true }));
            controller.applyDashboardStartedOnlyFilterForType('docker');
        },
        onToggleHealthEmphasis: (_type, enabled) => { state.health = enabled; },
        onToggleDensity: (_type, enabled) => { state.density = enabled; },
        onResetView: () => {
            document.querySelector('#apps').checked = false;
            state.health = false;
            state.density = false;
            document.querySelectorAll('.folder-showcase-outer').forEach((card) => card.setAttribute('expanded', 'false'));
            controller.syncDashboardWidgetLayoutQuickControlForType('docker');
        },
        onOpenSettings: () => { state.settingsOpened = true; },
        onLayoutTelemetry: (_type, snapshot) => telemetry.push(snapshot)
    });
    controller.bindDashboardQuickActionSyncHandlers();
    controller.applyDashboardLayoutStateForType('docker');
    controller.applyDashboardStartedOnlyFilterForType('docker');

    window.fixtureDashboardLayout = {
        controller,
        telemetry,
        state,
        applyStartedOnly: () => controller.applyDashboardStartedOnlyFilterForType('docker'),
        setRuntimeState: (selector, runtimeState) => {
            const node = document.querySelector(selector);
            node.dataset.fvRuntimeState = runtimeState;
            node.classList.remove('started', 'running', 'paused', 'stopped');
            node.classList.add(runtimeState === 'running' ? 'started' : runtimeState);
            return controller.applyDashboardStartedOnlyFilterForType('docker');
        },
        resize: (width) => {
            document.querySelector('#fixture-widget').style.width = `${Math.max(280, Number(width) || 0)}px`;
            window.dispatchEvent(new Event('resize'));
        },
        snapshot: () => {
            const host = document.querySelector('#fixture-dashboard-host');
            const memberTiles = [...host.querySelectorAll('.folder-showcase > span.outer')];
            return {
                folderColumns: Number(host.dataset.fvCompactmatrixFolderColumns || 0),
                memberColumns: Number(host.dataset.fvCompactmatrixMemberColumns || 0),
                hostWidth: Math.round(host.getBoundingClientRect().width),
                tileWidths: memberTiles.map((node) => Math.round(node.getBoundingClientRect().width)),
                horizontalOverflow: memberTiles.some((node) => node.scrollWidth > node.clientWidth + 1),
                visibleQuickActions: [...document.querySelectorAll('.fv-dashboard-quick-action')]
                    .filter((node) => getComputedStyle(node).display !== 'none')
                    .map((node) => node.dataset.fvQuickAction),
                telemetry: telemetry.at(-1) || null
            };
        }
    };
})();
