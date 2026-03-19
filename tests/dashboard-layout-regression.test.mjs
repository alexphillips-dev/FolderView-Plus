import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);
const settingsScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const dashboardScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
);
const dashboardCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css'
);
const folderPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page'
);
const folderScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const libPhpPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsScript = fs.readFileSync(settingsScriptPath, 'utf8');
const dashboardScript = fs.readFileSync(dashboardScriptPath, 'utf8');
const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf8');
const folderPage = fs.readFileSync(folderPagePath, 'utf8');
const folderScript = fs.readFileSync(folderScriptPath, 'utf8');
const libPhp = fs.readFileSync(libPhpPath, 'utf8');

test('settings exposes dashboard layout controls for docker and vm', () => {
    assert.match(settingsPage, /id="docker-dashboard-layout"/);
    assert.match(settingsPage, /<option value="compactmatrix">Compact Matrix<\/option>/);
    assert.match(settingsPage, /id="docker-dashboard-expand-toggle"/);
    assert.match(settingsPage, /id="docker-dashboard-greyscale"/);
    assert.match(settingsPage, /id="docker-dashboard-folder-label"/);
    assert.match(settingsPage, /id="vm-dashboard-layout"/);
    assert.match(settingsPage, /id="vm-dashboard-expand-toggle"/);
    assert.match(settingsPage, /id="vm-dashboard-greyscale"/);
    assert.match(settingsPage, /id="vm-dashboard-folder-label"/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'layout', this\.value\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'layout', this\.value\)/);
});

test('settings runtime persists dashboard prefs and exports handler', () => {
    assert.match(settingsScript, /const normalizeDashboardPrefsForType = \(type, prefsOverride = null\) =>/);
    assert.match(settingsScript, /compactmatrix/);
    assert.match(settingsScript, /const renderDashboardControls = \(type\) =>/);
    assert.match(settingsScript, /const changeDashboardPref = async \(type, key, value\) =>/);
    assert.match(settingsScript, /dashboard:\s*\{\s*\.\.\.\(prefs\?\.dashboard \|\| \{\}\)/);
    assert.match(settingsScript, /renderDashboardControls\(type\);/);
    assert.match(settingsScript, /window\.changeDashboardPref = changeDashboardPref;/);
});

test('server normalizes compact matrix dashboard layout', () => {
    assert.match(libPhp, /function normalizeDashboardLayout\(\$value\): string/);
    assert.match(libPhp, /\['classic', 'fullwidth', 'accordion', 'inset', 'compactmatrix'\]/);
});

test('dashboard runtime supports layout classes, accordion guards, and overflow metadata', () => {
    assert.match(dashboardScript, /const DASHBOARD_LAYOUT_MODES = \['classic', 'fullwidth', 'accordion', 'inset', 'compactmatrix'\]/);
    assert.match(dashboardScript, /const ensureDashboardWidgetLayoutQuickSwitchForType = \(type\) =>/);
    assert.match(dashboardScript, /const resolveDashboardWidgetInlineHostForType = \(type\) =>/);
    assert.match(dashboardScript, /fv-dashboard-layout-inline-host/);
    assert.match(dashboardScript, /fv-dashboard-layout-quick-rail/);
    assert.match(dashboardScript, /ensureQuickAction\('layout-cycle'/);
    assert.match(dashboardScript, /ensureQuickAction\('expand-toggle'/);
    assert.match(dashboardScript, /ensureQuickAction\('running-only'/);
    assert.match(dashboardScript, /ensureQuickAction\('health-emphasis'/);
    assert.match(dashboardScript, /ensureQuickAction\('density-toggle'/);
    assert.match(dashboardScript, /ensureQuickAction\('reset-view'/);
    assert.match(dashboardScript, /ensureQuickAction\('open-settings'/);
    assert.match(dashboardScript, /const toggleDashboardExpandAllForType = \(type\) =>/);
    assert.match(dashboardScript, /const setDashboardStartedOnlyEnabledForType = \(type, enabled\) =>/);
    assert.match(dashboardScript, /const readDashboardHealthEmphasisStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const readDashboardCompactDensityStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const resetDashboardWidgetViewStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const openFolderViewPlusSettings = \(\) =>/);
    assert.match(dashboardScript, /fv-dashboard-health-emphasis-enabled/);
    assert.match(dashboardScript, /fv-dashboard-density-compact/);
    assert.match(dashboardScript, /fv-dashboard-layout-compactmatrix/);
    assert.match(dashboardScript, /handleDashboardWidgetLayoutQuickSwitch/);
    assert.match(dashboardScript, /FolderViewPlusRequest/);
    assert.match(dashboardScript, /\/plugins\/folderview\.plus\/server\/prefs\.php/);
    assert.match(dashboardScript, /prefsResponse = parseJsonPayloadSafe\(prom\[4\]\);/);
    assert.match(dashboardScript, /ensureQuickAction\('layout-cycle', 'fa-columns', 'Cycle layout view', 'fv-dashboard-layout-quick'\)/);
    assert.match(dashboardScript, /const normalizeDashboardOverflowMode = \(value\) =>/);
    assert.match(dashboardScript, /const applyDashboardLayoutStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const scheduleDashboardLayoutApplyForType = \(type\) =>/);
    assert.match(dashboardScript, /if \(layout === 'accordion'\) \{/);
    assert.match(dashboardScript, /data-fv-dashboard-overflow="\$\{overflowMode\}"/);
    assert.match(dashboardScript, /class="fv-dashboard-expand-toggle-btn"/);
    assert.match(dashboardScript, /scheduleDashboardLayoutApplyForType\('docker'\)/);
    assert.match(dashboardScript, /scheduleDashboardLayoutApplyForType\('vm'\)/);
});

test('dashboard css includes non-classic controls and overflow rendering modes', () => {
    assert.match(dashboardCss, /\.fv-dashboard-layout-inline-host/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-health-emphasis-enabled/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-density-compact/);
    assert.match(dashboardCss, /data-fv-layout="accordion"/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-show-expand-toggle/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-greyscale-enabled/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-hide-folder-label/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-fullwidth/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-accordion/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-inset/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-compactmatrix/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-compactmatrix > tr\.updated > td \{/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-compactmatrix \.fv-dashboard-expand-toggle-btn \{/);
    assert.match(dashboardCss, /data-fv-dashboard-overflow="scroll"/);
    assert.match(dashboardCss, /data-fv-dashboard-overflow="expand_row"/);
});

test('folder editor supports per-folder dashboard overflow mode', () => {
    assert.match(folderPage, /name="dashboard_overflow"/);
    assert.match(folderPage, /<option value="default">Default<\/option>/);
    assert.match(folderPage, /<option value="expand_row">Expand row<\/option>/);
    assert.match(folderPage, /<option value="scroll">Scrollable panel<\/option>/);
    assert.match(folderScript, /const normalizeDashboardOverflowMode = \(value\) =>/);
    assert.match(folderScript, /form\.dashboard_overflow\.value = normalizeDashboardOverflowMode\(currFolder\.settings\.dashboard_overflow\);/);
    assert.match(folderScript, /dashboard_overflow: normalizeDashboardOverflowMode\(e\.dashboard_overflow\?\.value\)/);
});
