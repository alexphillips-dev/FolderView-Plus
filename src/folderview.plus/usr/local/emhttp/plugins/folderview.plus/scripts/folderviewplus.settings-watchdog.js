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
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const ancestorStyle = win.getComputedStyle ? win.getComputedStyle(ancestor) : null;
            if (!ancestorStyle) continue;
            if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden' || Number(ancestorStyle.opacity) === 0) return false;
            const clipsX = ancestorStyle.overflowX !== 'visible';
            const clipsY = ancestorStyle.overflowY !== 'visible';
            if (!clipsX && !clipsY) continue;
            const bounds = ancestor.getBoundingClientRect();
            if ((clipsX && (rect.right <= bounds.left || rect.left >= bounds.right))
                || (clipsY && (rect.bottom <= bounds.top || rect.top >= bounds.bottom))) return false;
        }
        return true;
    };
    win.FolderViewPlusSettingsIsVisible = isVisible;
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
        if (isVisible(root.querySelector('#fvplus-fatal-banner'))) return true;
        const selectors = [
            'h2[data-fv-advanced="1"]:not(.fv-section-hidden)',
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
        const loading = isVisible(loadingShell);
        if (loading && reason !== 'watchdog-deadline') return;
        if (hasVisibleSettingsContent(root)) return;
        state.failed = true;
        state.lastPhase = state.lastPhase || 'blank-watchdog';
        state.lastAction = loading ? 'Settings loading watchdog fired' : 'Settings blank watchdog fired';
        state.lastStep = String(reason || 'watchdog');
        win.FolderViewPlusFatalBanner?.reportFatalError?.(
            new Error(loading ? 'Settings loading timed out' : 'Settings page rendered no visible FolderView Plus content before bootstrap completed.'),
            {
                context: 'Settings',
                hostSelector: '#fv-settings-root',
                title: loading ? (win.FolderViewPlusEarlyI18n?.messages?.['common.startup.timeout'] || 'Settings loading timed out') : 'Settings page is blank',
                message: loading ? (win.FolderViewPlusEarlyI18n?.messages?.['common.startup.timeout-detail'] || 'FolderView Plus could not finish loading Settings. Reload the page to try again.') : 'FolderView Plus detected that the Settings page became blank before initialization completed.',
                code: loading ? 'FVPLUS-SET-LOAD-001' : 'FVPLUS-SET-BLANK-001',
                phase: state.lastPhase || 'blank-watchdog',
                category: loading ? 'timeout' : 'blank-page',
                detailLabel: loading ? (win.FolderViewPlusEarlyI18n?.messages?.['common.startup.timeout'] || 'Settings loading timed out') : 'Blank page diagnostics',
                details: collectBlankDetails(root)
            }
        );
    };
    win.setTimeout(() => runCheck('watchdog-early'), 3500);
    win.setTimeout(() => runCheck('watchdog-late'), 8500);
    win.setTimeout(() => runCheck('watchdog-deadline'), 60000);
}(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null));
