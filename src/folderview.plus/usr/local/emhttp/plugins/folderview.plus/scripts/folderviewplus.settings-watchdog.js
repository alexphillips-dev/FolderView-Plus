(function installSettingsBlankWatchdog(win, doc) {
    'use strict';

    if (!win || !doc || win.FolderViewPlusSettingsBlankWatchdogInstalled === true) return;
    win.FolderViewPlusSettingsBlankWatchdogInstalled = true;
    const state = win.FolderViewPlusSettingsBootstrapState = Object.assign({
        runtimeLoaded: false,
        ready: false,
        failed: false,
        degraded: false,
        lastPhase: 'page-shell',
        lastAction: 'Settings page shell loaded',
        lastStep: 'Settings page shell loaded',
        lastUpdatedAt: new Date().toISOString()
    }, win.FolderViewPlusSettingsBootstrapState || {});
    win.FolderViewPlusMarkSettingsBootstrapState = function markSettingsBootstrapState(patch) {
        const update = patch && typeof patch === 'object' ? patch : {};
        Object.assign(state, update, { lastUpdatedAt: new Date().toISOString() });
        return state;
    };
    const isVisible = (node) => {
        if (!node || node.nodeType !== 1) return false;
        const style = win.getComputedStyle ? win.getComputedStyle(node) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) return false;
        const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
        return Boolean((rect && rect.width > 0 && rect.height > 0) || node.offsetWidth > 0 || node.offsetHeight > 0);
    };
    const collectBlankDetails = (root) => {
        const topbar = doc.getElementById('fv-settings-topbar');
        const visibleSections = root ? root.querySelectorAll('h2[data-fv-section]:not(.fv-section-hidden)').length : 0;
        const hiddenSections = root ? root.querySelectorAll('h2[data-fv-section].fv-section-hidden').length : 0;
        const visibleRows = root ? root.querySelectorAll('tbody#docker tr:not(.fv-section-hidden), tbody#vms tr:not(.fv-section-hidden)').length : 0;
        const wizardOverlay = doc.getElementById('fv-setup-assistant-overlay');
        return [
            `runtimeLoaded=${state.runtimeLoaded === true ? 'yes' : 'no'}`,
            `ready=${state.ready === true ? 'yes' : 'no'}`,
            `failed=${state.failed === true ? 'yes' : 'no'}`,
            `degraded=${state.degraded === true ? 'yes' : 'no'}`,
            `lastPhase=${String(state.lastPhase || '(empty)')}`,
            `lastAction=${String(state.lastAction || '(empty)')}`,
            `lastStep=${String(state.lastStep || '(empty)')}`,
            `rootChildren=${root ? root.children.length : 0}`,
            `topbarChildren=${topbar ? topbar.children.length : 0}`,
            `visibleSections=${visibleSections}`,
            `hiddenSections=${hiddenSections}`,
            `visibleRows=${visibleRows}`,
            `wizardOverlayVisible=${isVisible(wizardOverlay) ? 'yes' : 'no'}`
        ];
    };
    const hasVisibleSettingsContent = (root) => {
        if (!root || !isVisible(root)) return false;
        if (root.querySelector('#fvplus-fatal-banner')) return true;
        const selectors = [
            '#fv-settings-topbar > *',
            'h2[data-fv-section]:not(.fv-section-hidden)',
            '.settings-mini-card:not(.fv-section-hidden)',
            '.folder-table:not(.fv-section-hidden)',
            'tbody#docker tr:not(.fv-section-hidden)',
            'tbody#vms tr:not(.fv-section-hidden)',
            '#fv-setup-assistant-overlay',
            '#fv-first-run-panel:not(.fv-csp-hidden)'
        ];
        return selectors.some((selector) => [...root.querySelectorAll(selector)].some(isVisible));
    };
    const runCheck = (reason) => {
        if (state.ready === true || state.failed === true) return;
        const root = doc.getElementById('fv-settings-root');
        if (!root) return;
        const loadingShell = doc.getElementById('fv-settings-bootstrap-shell');
        if (String(reason || '') === 'watchdog-early' && isVisible(loadingShell)) return;
        if (hasVisibleSettingsContent(root)) return;
        state.failed = true;
        state.lastPhase = state.lastPhase || 'blank-watchdog';
        state.lastAction = 'Settings blank watchdog fired';
        state.lastStep = String(reason || 'watchdog');
        win.FolderViewPlusFatalBanner?.reportFatalError?.(
            new Error('Settings page rendered no visible FolderView Plus content before bootstrap completed.'),
            {
                context: 'Settings',
                hostSelector: '#fv-settings-root',
                title: 'Settings page is blank',
                message: 'FolderView Plus detected that the Settings page became blank before initialization completed.',
                code: 'FVPLUS-SET-BLANK-001',
                phase: state.lastPhase || 'blank-watchdog',
                category: 'blank-page',
                detailLabel: 'Blank page diagnostics',
                details: collectBlankDetails(root)
            }
        );
    };
    win.setTimeout(() => runCheck('watchdog-early'), 3500);
    win.setTimeout(() => runCheck('watchdog-late'), 8500);
}(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null));
