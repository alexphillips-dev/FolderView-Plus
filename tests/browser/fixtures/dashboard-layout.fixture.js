(() => {
    const telemetry = [];
    const controller = window.FolderViewPlusDashboardLayoutQuickRail.createController({
        window,
        $: window.jQuery,
        normalizeDashboardPrefsForType: () => ({
            layout: 'compactmatrix',
            expandToggle: true,
            greyscale: false,
            folderLabel: true
        }),
        isDashboardPrefsHydratedForType: () => true,
        isDashboardRenderCompleteForType: () => true,
        resolveFolderIdFromCard: ($card) => String($card.index()),
        updateExpandToggleIcon: () => {},
        onLayoutTelemetry: (_type, snapshot) => telemetry.push(snapshot)
    });
    controller.applyDashboardLayoutStateForType('docker');

    window.fixtureDashboardLayout = {
        controller,
        telemetry,
        resize: (width) => {
            document.querySelector('#fixture-widget').style.width = `${Math.max(280, Number(width) || 0)}px`;
        },
        snapshot: () => {
            const host = document.querySelector('#fixture-dashboard-host');
            const memberTiles = [...document.querySelectorAll('.folder-showcase > span.outer')];
            return {
                folderColumns: Number(host.dataset.fvCompactmatrixFolderColumns || 0),
                memberColumns: Number(host.dataset.fvCompactmatrixMemberColumns || 0),
                hostWidth: Math.round(host.getBoundingClientRect().width),
                tileWidths: memberTiles.map((node) => Math.round(node.getBoundingClientRect().width)),
                horizontalOverflow: memberTiles.some((node) => node.scrollWidth > node.clientWidth + 1),
                telemetry: telemetry.at(-1) || null
            };
        }
    };
})();
