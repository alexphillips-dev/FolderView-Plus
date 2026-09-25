import assert from 'node:assert/strict';

const sections = [
    ['Operations workspace', '<h2 data-fv-advanced="1">Operations workspace</h2><div class="fv-operations-module-wrap"><div class="rules-panel fv-operations-panel" data-layout-surface></div></div>'],
    ['Bulk assignment', '<h2 data-fv-advanced="1">Bulk assignment</h2><div class="bulk-assign-grid" data-layout-surface><div class="rules-panel"></div></div>'],
    ['Rules', '<h2 data-fv-advanced="1">Auto-assignment rules</h2><div class="rules-bottom-grid fv-rules-grid" data-layout-surface><div class="rules-panel"></div></div>'],
    ['Rule testing', '<h2 data-fv-advanced="1">Rule testing and troubleshooting</h2><div class="rules-bottom-grid fv-rules-grid" data-layout-surface><div class="rules-panel"></div></div>'],
    ['Docker start order', '<div class="fv-docker-start-order-heading-row"><div class="fv-docker-start-order-heading-copy"><h2 data-fv-advanced="1">Docker start order</h2><p>Start order description</p></div></div><div class="fv-operations-module-wrap"><div class="rules-panel fv-operations-panel" data-layout-surface></div></div>'],
    ['Appearance', '<h2 data-fv-advanced="1">Theme workspace</h2><div id="fv-theme-workspace-panel"><div class="rules-panel" data-layout-surface></div></div>'],
    ['Recovery', '<h2 data-fv-advanced="1">Recovery workspace</h2><div class="fv-recovery-module-wrap"><div class="rules-panel fv-recovery-panel" data-layout-surface></div></div>'],
    ['Recovery history', '<h2 data-fv-advanced="1">Undo and recent changes</h2><div class="fv-recovery-module-wrap"><div class="rules-panel fv-recovery-panel" data-layout-surface></div></div>'],
    ['Diagnostics', '<h2 id="fv-diagnostics-title" data-fv-advanced="1">Diagnostics</h2><div id="fv-diagnostics-workspace" class="fv-diagnostics-workspace" data-layout-surface></div>'],
    ['Logs', '<h2 data-fv-advanced="1">Logs</h2><div class="fv-activity-feed-panel" data-layout-surface></div>']
];

export const verifyAdvancedWorkspaceLayout = async (page) => {
    const viewports = [
        { width: 1440, height: 900, theme: 'dark', direction: 'ltr' },
        { width: 1440, height: 900, theme: 'light', direction: 'rtl' },
        { width: 390, height: 800, theme: 'light', direction: 'ltr' }
    ];
    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const layout = await page.evaluate(({ variants, theme, direction }) => {
            const root = document.getElementById('fv-settings-root');
            const content = document.getElementById('fv-advanced-content');
            const previousHtml = content.innerHTML;
            root.dataset.fvThemeClass = theme;
            root.setAttribute('dir', direction);
            document.documentElement.setAttribute('dir', direction);
            const start = (rect) => direction === 'rtl' ? rect.right : rect.left;
            const end = (rect) => direction === 'rtl' ? rect.left : rect.right;
            const samples = variants.map(([name, markup]) => {
                content.innerHTML = markup;
                const title = content.querySelector('h2[data-fv-advanced="1"]');
                const surface = content.querySelector('[data-layout-surface]');
                const heading = title.getBoundingClientRect();
                const panel = surface.getBoundingClientRect();
                return {
                    name,
                    headingTop: heading.top,
                    headingStart: start(heading),
                    panelStart: start(panel),
                    panelEnd: end(panel),
                    panelFits: panel.left >= -1 && panel.right <= innerWidth + 1,
                    fontSize: parseFloat(getComputedStyle(title).fontSize)
                };
            });
            content.innerHTML = previousHtml;
            return { samples, sidebarTop: document.querySelector('.fv-advanced-sidebar-title').getBoundingClientRect().top };
        }, { variants: sections, theme: viewport.theme, direction: viewport.direction });
        const reference = layout.samples[0];
        for (const sample of layout.samples) {
            const aligned = Math.abs(sample.headingTop - reference.headingTop) <= 1.5
                && Math.abs(sample.headingStart - reference.headingStart) <= 1.5
                && Math.abs(sample.headingStart - sample.panelStart) <= 1.5
                && Math.abs(sample.panelEnd - reference.panelEnd) <= 1.5
                && sample.panelFits
                && Math.abs(sample.fontSize - reference.fontSize) <= 0.1
                && (viewport.width <= 960 || Math.abs(sample.headingTop - layout.sidebarTop) <= 1.5);
            assert.ok(aligned, `${viewport.width}px ${viewport.theme} ${viewport.direction} ${sample.name}: ${JSON.stringify({ sample, reference, sidebarTop: layout.sidebarTop })}`);
        }
    }
};
