import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyAdvancedWorkspaceLayout } from '../helpers/advanced-workspace-layout.mjs';
import { verifyAdvancedTitleBadges } from '../helpers/advanced-title-badges.mjs';

const settingsJs = fs.readFileSync(path.join(process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'), 'utf8');
const renderSource = settingsJs.match(/const renderAdvancedNav = \(\) => \{[\s\S]*?\n\};/)?.[0];
assert.ok(renderSource, 'Advanced navigation renderer must be present');

export const registerSettingsAdvancedNavigationCase = ({ test, baseUrl }) => {
    test('Advanced navigation keeps focus and fits desktop, phone, light, and RTL layouts', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
        await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
        await page.addScriptTag({ content: `(() => {
            const $ = window.jQuery;
            const tabs = ['automation', 'rules', 'recovery', 'operations', 'startup', 'appearance', 'diagnostics', 'logs'];
            const ADVANCED_GROUPS = tabs;
            const ADVANCED_GROUP_LABELS = {
                automation: 'Bulk assignment', rules: 'Rules', recovery: 'Recovery', operations: 'Operations',
                startup: 'Docker start order', appearance: 'Appearance', diagnostics: 'Diagnostics', logs: 'Logs'
            };
            const settingsUiState = { mode: 'advanced', advancedTab: 'operations',
                sections: tabs.map((advancedGroup) => ({ advanced: true, advancedGroup })) };
            const surfaceT = (_key, fallback) => fallback;
            const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[char]);
            ${renderSource}
            const root = document.getElementById('fv-settings-root');
            root.classList.add('fv-advanced-mode');
            root.insertAdjacentHTML('beforeend', '<div class="fv-customizations-header"><h2 data-fv-section="customizations">Customizations</h2></div><div id="fv-advanced-workspace" class="fv-advanced-workspace"><div class="fv-advanced-sidebar"><h2 class="fv-advanced-sidebar-title">Customizations</h2><nav id="fv-advanced-nav" class="fv-advanced-nav" aria-label="Advanced sections"></nav></div><div id="fv-advanced-content" class="fv-advanced-content"><h2 data-fv-section="runtime-actions">Operations</h2><div class="rules-panel">Operations content</div></div></div>');
            renderAdvancedNav();
            window.fixtureAdvancedNav = { state: settingsUiState, render: renderAdvancedNav };
        })();` });
        await page.addStyleTag({ content: '#fv-settings-root .fv-advanced-tab { margin-block: 8px; }' });
        const desktop = await page.evaluate(() => {
            const workspace = document.getElementById('fv-advanced-workspace');
            const nav = document.getElementById('fv-advanced-nav');
            const content = document.getElementById('fv-advanced-content');
            const buttons = Array.from(nav.querySelectorAll('.fv-advanced-tab'));
            return {
                columns: getComputedStyle(workspace).gridTemplateColumns.split(' ').length,
                navRight: nav.getBoundingClientRect().right,
                contentLeft: content.getBoundingClientRect().left,
                navWidth: nav.getBoundingClientRect().width,
                buttons: buttons.length,
                buttonMargin: getComputedStyle(buttons[0]).marginTop,
                buttonGap: buttons[1].getBoundingClientRect().top - buttons[0].getBoundingClientRect().bottom,
                pickerHidden: getComputedStyle(nav.querySelector('.fv-advanced-mobile-picker')).display === 'none',
                active: nav.querySelectorAll('.fv-advanced-tab[aria-current="true"]').length,
                sticky: getComputedStyle(workspace.querySelector('.fv-advanced-sidebar')).position,
                aligned: Math.abs(workspace.querySelector('.fv-advanced-sidebar-title').getBoundingClientRect().top - content.querySelector('h2').getBoundingClientRect().top) < 2,
                visibleTitles: Array.from(document.querySelectorAll('.fv-customizations-header h2, .fv-advanced-sidebar-title')).filter((title) => title.getClientRects().length).length,
                labelScale: parseFloat(getComputedStyle(nav.querySelector('.fv-advanced-nav-label')).fontSize) / parseFloat(getComputedStyle(nav.querySelector('.fv-advanced-tab')).fontSize),
                groups: Array.from(nav.querySelectorAll('.fv-advanced-nav-group')).map((group) => Array.from(group.querySelectorAll('.fv-advanced-tab')).map((button) => button.dataset.fvAdvancedTab).join(','))
            };
        });
        assert.equal(desktop.columns, 2);
        assert.ok(desktop.navRight < desktop.contentLeft && desktop.navWidth <= 246);
        assert.equal(desktop.buttons, 8);
        assert.ok(desktop.buttonMargin === '0px' && desktop.buttonGap <= 5, JSON.stringify(desktop));
        assert.equal(desktop.pickerHidden, true);
        assert.equal(desktop.active, 1);
        assert.equal(desktop.sticky, 'sticky');
        assert.ok(desktop.aligned && desktop.visibleTitles === 1 && desktop.labelScale >= 1.2, JSON.stringify(desktop));
        assert.deepEqual(desktop.groups, ['operations,automation,rules,startup', 'appearance', 'recovery,diagnostics,logs']);
        await page.locator('[data-fv-advanced-tab="operations"]').focus();
        const focusKept = await page.evaluate(() => {
            const button = document.activeElement;
            window.fixtureAdvancedNav.state.advancedTab = 'logs';
            window.fixtureAdvancedNav.render();
            return button === document.activeElement
                && button.isConnected
                && document.querySelector('[aria-current="true"]')?.dataset.fvAdvancedTab === 'logs';
        });
        assert.equal(focusKept, true, 'tab changes must update existing controls in place');
        await page.setViewportSize({ width: 390, height: 800 });
        const phone = await page.evaluate(() => {
            const nav = document.getElementById('fv-advanced-nav');
            const bounds = nav.getBoundingClientRect();
            return {
                groupsHidden: getComputedStyle(nav.querySelector('.fv-advanced-nav-groups')).display === 'none',
                pickerVisible: getComputedStyle(nav.querySelector('.fv-advanced-mobile-picker')).display !== 'none',
                pickerValue: nav.querySelector('select').value,
                navPosition: getComputedStyle(nav).position,
                navFits: bounds.left >= -1 && bounds.right <= innerWidth + 1,
                pickerFits: nav.querySelector('select').getBoundingClientRect().right <= bounds.right + 1
            };
        });
        assert.deepEqual(phone, { groupsHidden: true, pickerVisible: true, pickerValue: 'logs', navPosition: 'static', navFits: true, pickerFits: true });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.evaluate(() => {
            const root = document.getElementById('fv-settings-root');
            root.dataset.fvThemeClass = 'light';
            root.setAttribute('dir', 'rtl');
            document.documentElement.setAttribute('dir', 'rtl');
        });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.fv-advanced-tab.is-active')).boxShadow.includes('-3px'));
        const colors = await page.evaluate(() => {
            const active = document.querySelector('.fv-advanced-tab.is-active');
            return {
                shadow: getComputedStyle(active).boxShadow,
                background: getComputedStyle(active).backgroundColor,
                contentRight: document.getElementById('fv-advanced-content').getBoundingClientRect().right,
                navLeft: document.getElementById('fv-advanced-nav').getBoundingClientRect().left
            };
        });
        assert.match(colors.shadow, /-3px/, JSON.stringify(colors));
        assert.notEqual(colors.background, 'rgba(0, 0, 0, 0)');
        assert.ok(colors.contentRight < colors.navLeft, 'RTL rail must appear to the right of content');
        await verifyAdvancedWorkspaceLayout(page);
        await verifyAdvancedTitleBadges(page);
    });
};
