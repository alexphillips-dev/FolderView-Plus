import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);
const settingsScriptPaths = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-metadata.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
].map((relativePath) => path.join(repoRoot, relativePath));
const dashboardScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
);
const dashboardQuickRailScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.layout-quickrail.js'
);
const dashboardCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css'
);
const dashboardPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page'
);
const dockerPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page'
);
const vmPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page'
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
const settingsScript = settingsScriptPaths.map((scriptPath) => fs.readFileSync(scriptPath, 'utf8')).join('\n');
const dashboardScript = fs.readFileSync(dashboardScriptPath, 'utf8');
const dashboardQuickRailScript = fs.readFileSync(dashboardQuickRailScriptPath, 'utf8');
const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf8');
const dashboardPage = fs.readFileSync(dashboardPagePath, 'utf8');
const dockerPage = fs.readFileSync(dockerPagePath, 'utf8');
const vmPage = fs.readFileSync(vmPagePath, 'utf8');
const folderPage = fs.readFileSync(folderPagePath, 'utf8');
const folderScript = fs.readFileSync(folderScriptPath, 'utf8');
const libPhp = fs.readFileSync(libPhpPath, 'utf8');

test('settings exposes dashboard layout controls for docker and vm', () => {
    assert.match(settingsPage, /id="docker-dashboard-layout"/);
    assert.match(settingsPage, /<option value="legacy">Legacy<\/option>/);
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
    assert.match(settingsScript, /const markFatalBannerStep = \(step\) =>/);
    assert.match(settingsScript, /const setFatalBannerModuleStatus = \(name, status, detail = ''\) =>/);
    assert.match(settingsScript, /const recordFatalBannerRequest = \(entry = \{\}\) =>/);
    assert.match(settingsScript, /const setFatalBannerPrefsStatus = \(patch = \{\}\) =>/);
    assert.match(settingsScript, /const setFatalBannerEnvironment = \(patch = \{\}\) =>/);
    assert.match(settingsScript, /const setFatalBannerPhase = \(phase\) =>/);
    assert.match(settingsScript, /const recordFatalBannerAction = \(action\) =>/);
    assert.match(settingsScript, /const reportFatalBannerDegradedState = \(error, options = \{\}\) =>/);
    assert.match(settingsScript, /const clearFatalBannerResolvedState = \(\) =>/);
    assert.match(settingsScript, /const withFatalBannerPhase = async \(/);
    assert.match(settingsScript, /const buildSettingsBootstrapDegradedReason = \(type, area, error\) =>/);
    assert.match(settingsScript, /code: 'FVPLUS-SET-BOOT-001'/);
    assert.match(settingsScript, /code: 'FVPLUS-SET-BOOT-002'/);
    assert.match(settingsScript, /code: settingsUiState\.mode === 'advanced' \? 'FVPLUS-SET-BOOT-004' : 'FVPLUS-SET-BOOT-003'/);
    assert.match(settingsScript, /phase: 'module-load'/);
    assert.match(settingsScript, /phase: error\?\.fvplusPhase \|\| 'bootstrap'/);
    assert.match(settingsScript, /category: 'degraded-mode'/);
    assert.match(settingsScript, /buildSettingsBootstrapDegradedReason\(type, 'runtime info', infoResult\.reason\)/);
    assert.match(settingsScript, /if \(bootstrapDegradedReasons\.length <= 0\) \{\s*clearFatalBannerResolvedState\(\);/);
    assert.match(settingsScript, /legacy/);
    assert.match(settingsScript, /compactmatrix/);
    assert.match(settingsScript, /const renderDashboardControls = \(type\) =>/);
    assert.match(settingsScript, /const changeDashboardPref = async \(type, key, value\) =>/);
    assert.match(settingsScript, /const dashboard = normalizeDashboardPrefsForType\(type, current\);/);
    assert.match(settingsScript, /dashboard:\s*nextDashboard/);
    assert.match(settingsScript, /renderDashboardControls\(type\);/);
    assert.match(settingsScript, /const recordFatalBannerRequestResult = \(method, url, source, outcome, error = null\) =>/);
    assert.match(settingsScript, /extractFatalBannerTraceId/);
    assert.match(settingsScript, /extractFatalBannerStatus/);
    assert.match(settingsScript, /inferFatalBannerCategory/);
    assert.match(settingsScript, /registerWindowActions\(window,\s*\{[\s\S]*changeDashboardPref[\s\S]*\}\);/);
});

test('server normalizes compact matrix dashboard layout', () => {
    assert.match(libPhp, /function normalizeDashboardLayout\(\$value\): string/);
    assert.match(libPhp, /\['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'\]/);
    assert.match(libPhp, /function normalizeThemeCompatibilityMode\(\$value\): string/);
    assert.match(libPhp, /\['auto', 'host', 'safe', 'highcontrast'\]/);
    assert.match(libPhp, /'themeCompatibilityMode'\s*=>\s*'auto'/);
});

test('dashboard runtime supports layout classes, accordion guards, and overflow metadata', () => {
    assert.match(dashboardScript, /const DASHBOARD_LAYOUT_MODES = Array\.isArray\(utils\.DASHBOARD_LAYOUT_OPTIONS\)/);
    assert.doesNotMatch(dashboardScript, /const EDITOR_PREFILL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.v1';/);
    assert.doesNotMatch(dashboardScript, /const EDITOR_DEBUG_LAUNCH_STORAGE_KEY = 'fv\.folder\.editor\.debug\.launch\.v1';/);
    assert.doesNotMatch(dashboardScript, /const recordDashboardFolderEditorLaunchDebug = \(sourcePage, folderType, id, targetUrl\) =>/);
    assert.doesNotMatch(dashboardScript, /const seedDashboardFolderEditorPrefill = \(folderType,\s*id\) =>/);
    assert.match(dashboardScript, /DASHBOARD_LAYOUT_OPTIONS: Object\.freeze\(\['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'\]\)/);
    assert.match(dashboardScript, /const DASHBOARD_LAYOUT_LABELS = utils\.DASHBOARD_LAYOUT_LABELS \|\| Object\.freeze\(/);
    assert.match(dashboardScript, /const dashboardLayoutQuickRailModule = window\.FolderViewPlusDashboardLayoutQuickRail \|\| null;/);
    assert.match(dashboardScript, /buildFolderChildrenIndex,/);
    assert.match(dashboardScript, /const getDashboardQuickRailController = \(\) =>/);
    assert.match(dashboardScript, /dashboardLayoutQuickRailModule\.createController\(/);
    assert.match(dashboardScript, /const isDashboardLegacyLayoutForType = \(type\) =>/);
    assert.match(dashboardScript, /const isDashboardLayoutTransitionInFlightForType = \(type\) =>/);
    assert.match(dashboardScript, /const restoreDashboardNativeRowsForType = async \(type\) =>/);
    assert.match(dashboardScript, /const rerenderDashboardWidgetStructureForType = async \(type\) =>/);
    assert.match(dashboardScript, /const prepareDashboardFolderRequestsForType = \(type\) =>/);
    assert.match(dashboardScript, /const resolveDashboardWidgetInlineHostForType = \(type\) =>/);
    assert.doesNotMatch(dashboardScript, /const ensureDashboardWidgetLayoutQuickSwitchForType = \(type\) =>/);
    assert.doesNotMatch(dashboardScript, /const isDashboardWidgetCollapsedForType = \(type\) =>/);
    assert.doesNotMatch(dashboardScript, /const ensureDashboardWidgetInlineHostMountForType = \(type, hostOverride = null\) =>/);
    assert.doesNotMatch(dashboardScript, /const syncDashboardWidgetQuickRailFitForType = \(type, parentRect, offsetTop\) =>/);
    assert.match(dashboardScript, /const toggleDashboardExpandAllForType = \(type\) =>/);
    assert.match(dashboardScript, /const setDashboardStartedOnlyEnabledForType = \(type, enabled\) =>/);
    assert.match(dashboardScript, /const readDashboardHealthEmphasisStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const readDashboardCompactDensityStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const resetDashboardWidgetViewStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const openFolderViewPlusSettings = \(\) =>/);
    assert.match(dashboardScript, /handleDashboardWidgetLayoutQuickSwitch/);
    assert.match(dashboardScript, /FolderViewPlusRequest/);
    assert.match(dashboardScript, /\/plugins\/folderview\.plus\/server\/prefs\.php/);
    assert.match(dashboardScript, /prefsResponse = parseJsonPayloadSafe\(prom\[4\]\);/);
    assert.match(dashboardScript, /const normalizeDashboardOverflowMode = typeof utils\.normalizeDashboardOverflowMode === 'function'/);
    assert.match(dashboardScript, /const createFolders = async \(types = \['docker', 'vm'\]\) =>/);
    assert.match(dashboardScript, /const dockerTreeIndex = buildFolderChildrenIndex\(allDockerFolders\);/);
    assert.match(dashboardScript, /const vmTreeIndex = buildFolderChildrenIndex\(allVmFolders\);/);
    assert.match(dashboardScript, /if \(renderTypes\.has\('docker'\) && \$\('tbody#docker_view'\)\.length > 0\) \{/);
    assert.match(dashboardScript, /if \(renderTypes\.has\('vm'\) && \$\('tbody#vm_view'\)\.length > 0\) \{/);
    assert.doesNotMatch(dashboardScript, /const applyDashboardLayoutStateForType = \(type\) =>/);
    assert.match(dashboardScript, /const scheduleDashboardLayoutApplyForType = \(type\) =>/);
    assert.match(dashboardScript, /const requiresStructureReload = previousDashboard\.layout === 'legacy' \|\| nextLayout === 'legacy';/);
    assert.match(dashboardScript, /if \(requiresStructureReload\) \{\s*dashboardLayoutTransitionInFlightByType\[resolvedType\] = true;/);
    assert.match(dashboardScript, /dashboardLayoutTransitionInFlightByType\[resolvedType\] = true;/);
    assert.match(dashboardScript, /dashboardLayoutTransitionInFlightByType\[resolvedType\] = false;/);
    assert.match(dashboardScript, /await rerenderDashboardWidgetStructureForType\(resolvedType\);/);
    assert.match(dashboardScript, /if \(isDashboardLegacyLayoutForType\('docker'\)\) \{/);
    assert.match(dashboardScript, /if \(isDashboardLegacyLayoutForType\('vm'\)\) \{/);
    assert.match(dashboardScript, /if \(layout === 'accordion'\) \{/);
    assert.match(dashboardScript, /data-fv-dashboard-overflow="\$\{overflowMode\}"/);
    assert.match(dashboardScript, /class="fv-dashboard-expand-toggle-btn"/);
    assert.match(dashboardScript, /scheduleDashboardLayoutApplyForType\('docker'\)/);
    assert.match(dashboardScript, /scheduleDashboardLayoutApplyForType\('vm'\)/);
    assert.match(dashboardQuickRailScript, /\|\| \(typeof deps\.isDashboardLayoutTransitionInFlightForType === 'function' && deps\.isDashboardLayoutTransitionInFlightForType\(resolvedType\)\)/);
    assert.match(dashboardQuickRailScript, /\|\| \(typeof deps\.isDashboardLegacyLayoutForType === 'function' && deps\.isDashboardLegacyLayoutForType\(resolvedType\)\)/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-health-emphasis-enabled/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-density-compact/);
});

test('dashboard quick-rail module is loaded before dashboard runtime and owns quick-rail DOM control logic', () => {
    assert.match(dashboardPage, /dashboard\.layout-quickrail\.js/);
    assert.match(dashboardPage, /dashboard\.layout-quickrail\.js[\s\S]*dashboard\.js/);
    assert.match(dashboardQuickRailScript, /root\.FolderViewPlusDashboardLayoutQuickRail = factory\(\)/);
    assert.match(dashboardQuickRailScript, /root\.FolderViewPlusDashboardLayoutQuickRailModuleLoaded = true/);
    assert.match(dashboardQuickRailScript, /const createController = \(deps = \{\}\) =>/);
    assert.match(dashboardQuickRailScript, /const resolveDashboardWidgetInlineHostForType = \(type\) =>/);
    assert.match(dashboardQuickRailScript, /const syncDashboardWidgetQuickRailFitForType = \(type, parentRect, offsetTop\) =>/);
    assert.match(dashboardQuickRailScript, /const syncDashboardWidgetLayoutQuickControlForType = \(type\) =>/);
    assert.match(dashboardQuickRailScript, /const ensureDashboardWidgetLayoutQuickSwitchForType = \(type\) =>/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('layout-cycle', 'fa-columns', 'Cycle layout view', 'fv-dashboard-layout-quick'\)/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('expand-toggle'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('running-only'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('health-emphasis'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('density-toggle'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('reset-view'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('open-settings'/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-layout-inline-host/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-layout-quick-rail/);
    assert.match(dashboardQuickRailScript, /\$host\.parent\(\)\.is\(\$container\)/);
    assert.match(dashboardQuickRailScript, /\$container\.prepend\(\$host\)/);
    assert.match(dashboardQuickRailScript, /bindDashboardQuickActionSyncHandlers/);
});

test('shared fatal banner runtime is exposed on settings and runtime pages and exposes fatal reporting helpers', () => {
    const fatalBannerScript = fs.readFileSync(
        path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js'),
        'utf8'
    );
    assert.match(settingsPage, /folderviewplus\.fatal-banner\.js[\s\S]*folderviewplus\.utils\.js/);
    assert.match(dockerPage, /folderviewplus\.fatal-banner\.js[\s\S]*folderviewplus\.utils\.js/);
    assert.match(vmPage, /folderviewplus\.fatal-banner\.js[\s\S]*folderviewplus\.utils\.js/);
    assert.match(dockerPage, /hostSelector:\s*'#fvplus-docker-runtime-banner-host,\s*\.canvas'/);
    assert.match(vmPage, /hostSelector:\s*'#fvplus-vm-runtime-banner-host'/);
    assert.match(settingsPage, /unraidVersion:/);
    assert.doesNotMatch(folderPage, /folderviewplus\.fatal-banner\.js/);
    assert.doesNotMatch(dashboardPage, /folderviewplus\.fatal-banner\.js/);
    assert.match(fatalBannerScript, /win\.FolderViewPlusFatalBanner = api/);
    assert.match(fatalBannerScript, /win\.FolderViewPlusFatalBannerModuleLoaded = true/);
    assert.match(fatalBannerScript, /\.flatMap\(\(entry\) => typeof entry === 'string' \? entry\.split\(','\) : \[\]\)/);
    assert.match(fatalBannerScript, /const setEnvironment = \(patch = \{\}\) =>/);
    assert.match(fatalBannerScript, /state\.environment\.pluginVersion = trimString\(config\.pluginVersion \|\| state\.environment\.pluginVersion \|\| 'unknown'\) \|\| 'unknown';/);
    assert.match(fatalBannerScript, /const markStep = \(step\) =>/);
    assert.match(fatalBannerScript, /const setPhase = \(phase\) =>/);
    assert.match(fatalBannerScript, /const recordAction = \(action\) =>/);
    assert.match(fatalBannerScript, /const setModuleStatus = \(name, status = 'ok', detail = ''\) =>/);
    assert.match(fatalBannerScript, /const recordRequest = \(entry = \{\}\) =>/);
    assert.match(fatalBannerScript, /const setPrefsStatus = \(patch = \{\}\) =>/);
    assert.match(fatalBannerScript, /const buildSupportReport = \(issue = null\) =>/);
    assert.match(fatalBannerScript, /const clearResolvedIssue = \(\) =>/);
    assert.match(fatalBannerScript, /Copy diagnostics/);
    assert.match(fatalBannerScript, /Show technical details/);
    assert.match(fatalBannerScript, /Severity: \$\{severity\}/);
    assert.match(fatalBannerScript, /Category: \$\{category\}/);
    assert.match(fatalBannerScript, /Last action: \$\{state\.lastAction\}/);
    assert.match(fatalBannerScript, /\[affected-areas\]/);
    assert.match(fatalBannerScript, /const DIAGNOSTIC_REQUEST_LIMIT = 16/);
    assert.match(fatalBannerScript, /\[recent-actions\]/);
    assert.match(fatalBannerScript, /const reportMissingModules = \(missingModules = \[\], options = \{\}\) =>/);
    assert.match(fatalBannerScript, /const reportFatalError = \(error, options = \{\}\) =>/);
    assert.match(fatalBannerScript, /const reportDegradedState = \(error, options = \{\}\) =>/);
    assert.match(fatalBannerScript, /win\.addEventListener\('error', \(event\) =>/);
    assert.match(fatalBannerScript, /win\.addEventListener\('unhandledrejection', \(event\) =>/);
});

test('dashboard quick rail collapse detection is row-visibility based and not icon-heuristic based', () => {
    assert.match(dashboardQuickRailScript, /const isDashboardWidgetCollapsedForType = \(type\) =>/);
    assert.match(dashboardQuickRailScript, /const \$updatedRow = getDashboardWidgetUpdatedRowForType\(resolvedType\);/);
    assert.match(dashboardQuickRailScript, /return !isDashboardNodeVisible\(updatedNode\);/);
    assert.doesNotMatch(dashboardQuickRailScript, /iconClass\.includes\('angle-down'\)/);
    assert.doesNotMatch(dashboardQuickRailScript, /iconClass\.includes\('chevron-down'\)/);
});

test('dashboard css includes non-classic controls and overflow rendering modes', () => {
    assert.match(dashboardCss, /\.fv-dashboard-layout-inline-host/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail\.is-clamped/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail\.is-compact-grid/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*border:\s*0 !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*border-radius:\s*5px/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-dashboard-quick-action-bg-top\),\s*var\(--fvplus-dashboard-quick-action-bg-bottom\)\) !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*box-shadow:\s*var\(--fvplus-dashboard-quick-action-shadow\) !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action:hover,\s*[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-dashboard-quick-action-hover-top\),\s*var\(--fvplus-dashboard-quick-action-hover-bottom\)\) !important/);
    assert.doesNotMatch(dashboardCss, /\.fv-dashboard-quick-action:hover,\s*[\s\S]*transform:\s*translateY\(-1px\)/);
    assert.match(dashboardCss, /data-fv-layout="legacy"/);
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
    assert.match(folderPage, /<option value="2" data-i18n="preview-option-2">Only icon \(clean\)<\/option>/);
    assert.match(folderScript, /const utils = window\.FolderViewPlusUtils \|\| null;/);
    assert.match(folderScript, /const normalizeDashboardOverflowMode = typeof utils\?\.normalizeDashboardOverflowMode === 'function'/);
    assert.match(folderScript, /setFieldValue\('dashboard_overflow',\s*normalizeDashboardOverflowMode\(normalizedFolder\.settings\.dashboard_overflow\)\);/);
    assert.match(folderScript, /dashboard_overflow: normalizeDashboardOverflowMode\(e\.dashboard_overflow\?\.value\)/);
    assert.doesNotMatch(folderPage, /name="preview_member_display"/);
    assert.doesNotMatch(folderScript, /preview_member_display/);
});
