import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js',
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
const dashboardVisualDiagnosticsScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.visual-diagnostics.js'
);
const dashboardAdvancedPreviewScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.advanced-preview.js'
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
const libPrefsPhpPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php'
);
const dashboardQuickRailModule = require(dashboardQuickRailScriptPath);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsScript = settingsScriptPaths.map((scriptPath) => fs.readFileSync(scriptPath, 'utf8')).join('\n');
const dashboardScript = fs.readFileSync(dashboardScriptPath, 'utf8');
const dashboardQuickRailScript = fs.readFileSync(dashboardQuickRailScriptPath, 'utf8');
const dashboardVisualDiagnosticsScript = fs.readFileSync(dashboardVisualDiagnosticsScriptPath, 'utf8');
const dashboardAdvancedPreviewScript = fs.readFileSync(dashboardAdvancedPreviewScriptPath, 'utf8');
const dashboardCss = fs.readFileSync(dashboardCssPath, 'utf8');
const dashboardPage = fs.readFileSync(dashboardPagePath, 'utf8');
const dockerPage = fs.readFileSync(dockerPagePath, 'utf8');
const vmPage = fs.readFileSync(vmPagePath, 'utf8');
const folderPage = fs.readFileSync(folderPagePath, 'utf8');
const pageBootstrapScript = fs.readFileSync(path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.page-bootstrap.js'), 'utf8');
const folderEditorPageBootstrapScript = fs.readFileSync(path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.page-bootstrap.js'), 'utf8');
const folderScript = fs.readFileSync(folderScriptPath, 'utf8');
const libPhp = fs.readFileSync(libPhpPath, 'utf8');
const libPrefsPhp = fs.readFileSync(libPrefsPhpPath, 'utf8');

test('settings exposes dashboard layout controls for docker and vm', () => {
    assert.doesNotMatch(settingsPage, /id="docker-view-mode"/);
    assert.doesNotMatch(settingsPage, /id="vm-view-mode"/);
    assert.match(settingsPage, /id="docker-dashboard-layout"/);
    assert.match(settingsPage, /<option value="legacy">Legacy<\/option>/);
    assert.match(settingsPage, /<option value="compactmatrix">Compact Matrix<\/option>/);
    assert.match(settingsPage, /id="docker-dashboard-expand-toggle"/);
    assert.match(settingsPage, /id="docker-dashboard-greyscale"/);
    assert.match(settingsPage, /id="docker-dashboard-folder-label"/);
    assert.match(settingsPage, /id="docker-dashboard-preview-context"/);
    assert.match(settingsPage, /id="docker-dashboard-preview-trigger"/);
    assert.match(settingsPage, /id="docker-dashboard-preview-graph"/);
    assert.match(settingsPage, /id="docker-dashboard-preview-graph-time"/);
    assert.match(settingsPage, /id="vm-dashboard-layout"/);
    assert.match(settingsPage, /id="vm-dashboard-expand-toggle"/);
    assert.match(settingsPage, /id="vm-dashboard-greyscale"/);
    assert.match(settingsPage, /id="vm-dashboard-folder-label"/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'layout', this\.value\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'layout', this\.value\)/);
});

test('dashboard layout preference commits are narrow, immediate, verified, and hydration-gated', () => {
    assert.match(settingsScript, /immediate: key === 'layout' \|\| key === 'privacyMode' \|\| key\.startsWith\('privacyMask'\) \|\| key\.startsWith\('preview'\)/);
    assert.match(settingsScript, /Dashboard layout save mismatch: requested \$\{nextDashboard\.layout\}, received \$\{committedLayout\}/);
    assert.match(settingsScript, /protectDashboardLayoutFromBroadPrefsWrite/);
    assert.match(dashboardScript, /const patch = \{ dashboard: \{ layout: normalizedLayout \} \};/);
    assert.match(dashboardScript, /dashboardPrefsCoordinator\.save\(resolvedType, patch,/);
    assert.doesNotMatch(dashboardScript, /dashboardPrefsCoordinator\.save\(resolvedType, prefsPayload/);
    assert.match(dashboardScript, /Dashboard layout save mismatch: requested \$\{nextLayout\}, received \$\{committedLayout\}/);
    assert.match(dashboardScript, /isDashboardPrefsHydratedForType:/);
    assert.match(dashboardScript, /isDashboardRenderCompleteForType:/);
    assert.match(dashboardQuickRailScript, /deps\.isDashboardPrefsHydratedForType\(meta\.type\) !== true/);
    assert.match(dashboardQuickRailScript, /layout !== 'compactmatrix' \|\| renderComplete !== true \|\| metrics\.containerWidth <= 0/);
    assert.doesNotMatch(dashboardQuickRailScript, /publishDashboardCompactMatrixTelemetry\(resolvedType, layout, deriveCompactMatrixLayout\(\)\)/);
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
    assert.match(settingsScript, /code: 'FVPLUS-SET-BOOT-003'/);
    assert.match(settingsScript, /phase: 'module-load'/);
    assert.match(settingsScript, /phase: error\?\.fvplusPhase \|\| 'bootstrap'/);
    assert.match(settingsScript, /category: 'degraded-mode'/);
    assert.match(settingsScript, /buildSettingsBootstrapDegradedReason\(type, 'runtime info', infoResult\.reason\)/);
    assert.match(settingsScript, /const currentBootstrapState = window\.FolderViewPlusSettingsBootstrapState \|\| \{\};/);
    assert.match(settingsScript, /if \(bootstrapDegradedReasons\.length <= 0 && currentBootstrapState\.degraded !== true\) \{\s*clearFatalBannerResolvedState\(\);/);
    assert.match(settingsScript, /legacy/);
    assert.match(settingsScript, /compactmatrix/);
    assert.match(settingsScript, /previewContext: dashboard\.previewContext === 'advanced' \? 'advanced' : 'native'/);
    assert.match(settingsScript, /previewTrigger: dashboard\.previewTrigger === 'hover' \? 'hover' : 'click'/);
    assert.match(settingsScript, /const renderDashboardControls = \(type\) =>/);
    assert.match(settingsScript, /const changeDashboardPref = async \(type, key, value\) =>/);
    assert.match(settingsScript, /const dashboard = normalizeDashboardPrefsForType\(resolvedType, current\);/);
    assert.match(settingsScript, /dashboard:\s*\{\s*\[key\]: nextDashboard\[key\]\s*\}/);
    assert.match(settingsScript, /renderDashboardControls\(type\);/);
    assert.match(settingsScript, /const recordFatalBannerRequestResult = \(method, url, source, outcome, error = null\) =>/);
    assert.match(settingsScript, /extractFatalBannerTraceId/);
    assert.match(settingsScript, /extractFatalBannerStatus/);
    assert.match(settingsScript, /inferFatalBannerCategory/);
    assert.match(settingsScript, /registerActions\(window,\s*\{[\s\S]*changeDashboardPref/);
});

test('server normalizes compact matrix dashboard layout', () => {
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.prefs\.php'\);/);
    assert.doesNotMatch(libPrefsPhp, /function normalizeViewMode\(\$value\): string/);
    assert.match(libPrefsPhp, /function normalizeDashboardLayout\(\$value\): string/);
    assert.match(libPrefsPhp, /function normalizeDashboardPreviewContext\(\$value\): string/);
    assert.match(libPrefsPhp, /function normalizeDashboardPreviewTrigger\(\$value\): string/);
    assert.match(libPrefsPhp, /\['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed'\]/);
    assert.match(libPrefsPhp, /function normalizeThemeCompatibilityMode\(\$value\): string/);
    assert.match(libPrefsPhp, /\['auto', 'host', 'safe', 'highcontrast'\]/);
    assert.doesNotMatch(libPrefsPhp, /'viewMode'\s*=>\s*'table'/);
    assert.match(libPrefsPhp, /'themeCompatibilityMode'\s*=>\s*'auto'/);
});

test('dashboard runtime supports layout classes, accordion guards, and overflow metadata', () => {
    assert.match(dashboardScript, /const DASHBOARD_LAYOUT_MODES = Array\.isArray\(utils\.DASHBOARD_LAYOUT_OPTIONS\)/);
    assert.doesNotMatch(dashboardScript, /const EDITOR_PREFILL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.v1';/);
    assert.doesNotMatch(dashboardScript, /const EDITOR_DEBUG_LAUNCH_STORAGE_KEY = 'fv\.folder\.editor\.debug\.launch\.v1';/);
    assert.doesNotMatch(dashboardScript, /const recordDashboardFolderEditorLaunchDebug = \(sourcePage, folderType, id, targetUrl\) =>/);
    assert.doesNotMatch(dashboardScript, /const seedDashboardFolderEditorPrefill = \(folderType,\s*id\) =>/);
    assert.match(dashboardScript, /DASHBOARD_LAYOUT_OPTIONS: Object\.freeze\(\['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed'\]\)/);
    assert.match(dashboardScript, /const DASHBOARD_LAYOUT_LABEL_FALLBACKS = utils\.DASHBOARD_LAYOUT_LABELS \|\| Object\.freeze\(/);
    assert.match(dashboardScript, /classic: dashboardT\('dashboard\.layout\.classic'/);
    assert.match(dashboardScript, /compactmatrix: dashboardT\('dashboard\.layout\.compactmatrix'/);
    assert.match(dashboardScript, /const dashboardAdvancedPreviewModule = window\.FolderViewPlusDashboardAdvancedPreview \|\| null;/);
    assert.match(dashboardScript, /const attachDashboardAdvancedPreviewIfEnabled = \(\$containerEl, ct, folder, id\) =>/);
    assert.match(dashboardScript, /let dashboardDockerCpuCores = 1;/);
    assert.match(dashboardScript, /const refreshDashboardDockerCpuCores = \(\) => requestClient\.getText\('\/plugins\/folderview\.plus\/server\/cpu\.php'\)/);
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
    assert.match(dashboardScript, /const parseDashboardPayloadOr = \(payload, fallback\) =>/);
    assert.match(dashboardScript, /let prefsResponse = parseDashboardPayloadOr\(prom\[4\], \{\}\);/);
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
    assert.match(dashboardScript, /attachDashboardAdvancedPreviewIfEnabled\(\$containerEl, ct, folder, id\);/);
    assert.match(dashboardScript, /class="fv-dashboard-expand-toggle-btn"/);
    assert.match(dashboardScript, /aria-controls="folder-showcase-docker-\$\{id\}"/);
    assert.match(dashboardScript, /aria-controls="folder-showcase-vm-\$\{id\}"/);
    assert.match(dashboardScript, /\$surface\.attr\('aria-expanded', expanded === true \? 'true' : 'false'\)/);
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
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('layout-menu', 'fa-columns'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('expand-toggle'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('running-only'/);
    assert.match(dashboardQuickRailScript, /ensureQuickAction\('view-options'/);
    assert.match(dashboardQuickRailScript, /toggleRow\('health-emphasis'/);
    assert.match(dashboardQuickRailScript, /toggleRow\('density-toggle'/);
    assert.match(dashboardQuickRailScript, /data-fv-view-action="reset-view"/);
    assert.match(dashboardQuickRailScript, /data-fv-view-action="open-settings"/);
    assert.match(dashboardQuickRailScript, /ui\.openPopover/);
    assert.match(dashboardQuickRailScript, /aria-pressed/);
    assert.match(dashboardQuickRailScript, /data-fv-layout-select/);
    assert.doesNotMatch(dashboardQuickRailScript, /data-fv-layout-option/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-layout-inline-host/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-layout-quick-rail/);
    assert.match(dashboardQuickRailScript, /\$host\.parent\(\)\.is\(\$container\)/);
    assert.match(dashboardQuickRailScript, /\$container\.prepend\(\$host\)/);
    assert.match(dashboardQuickRailScript, /fv-dashboard-has-visible-quick-rail/);
    assert.match(dashboardQuickRailScript, /bindDashboardQuickActionSyncHandlers/);
});

test('Dashboard visual diagnostics loads before runtime and captures bounded privacy-safe layout evidence', () => {
    const quickRailIndex = dashboardPage.indexOf('dashboard.layout-quickrail.js');
    const visualIndex = dashboardPage.indexOf('dashboard.visual-diagnostics.js');
    const runtimeIndex = dashboardPage.indexOf('scripts/dashboard.js');
    assert.ok(quickRailIndex >= 0 && visualIndex > quickRailIndex && runtimeIndex > visualIndex);
    assert.match(dashboardPage, /fvplus-page-data/);
    assert.match(pageBootstrapScript, /FolderViewPlusDashboardPluginVersion/);
    assert.match(dashboardVisualDiagnosticsScript, /const HISTORY_LIMIT = 12;/);
    assert.match(dashboardVisualDiagnosticsScript, /const PROBLEM_SAMPLE_LIMIT = 8;/);
    assert.match(dashboardVisualDiagnosticsScript, /labelFingerprint: fingerprintValue\(text, sessionSalt\)/);
    assert.doesNotMatch(dashboardVisualDiagnosticsScript, /labelText:/);
    assert.match(dashboardVisualDiagnosticsScript, /folder-column-mismatch/);
    assert.match(dashboardVisualDiagnosticsScript, /unexpected-label-clipping/);
    assert.match(dashboardQuickRailScript, /data-fv-view-action="capture-diagnostics"/);
    assert.match(dashboardQuickRailScript, /deps\.onVisualDiagnostics/);
    assert.match(dashboardScript, /dashboardVisualDiagnosticsModule\.createController/);
    assert.match(dashboardScript, /dashboardBootstrapMissingModules\.push\('dashboard\.visual-diagnostics\.js'\)/);
    assert.match(settingsPage, /id="fv-support-bundle-preview" class="fv-support-bundle-preview"/);
    assert.match(settingsPage, /folderviewplus\.support-bundle-preview\.js/);
});

test('Dashboard Started only reconciles folder members without a full widget reload', () => {
    assert.match(dashboardQuickRailScript, /const applyDashboardStartedOnlyFilterForType = \(type\) =>/);
    assert.match(dashboardQuickRailScript, /span\.folder-element-vm/);
    assert.match(dashboardQuickRailScript, /span\.folder-element-docker/);
    assert.match(dashboardQuickRailScript, /\.folder-storage/);
    assert.match(dashboardQuickRailScript, /\.folder-showcase/);
    assert.match(dashboardQuickRailScript, /hasVisibleChildFolder/);
    assert.match(dashboardQuickRailScript, /input#apps, input#vms[\s\S]*applyDashboardStartedOnlyFilterForType\('docker'\)[\s\S]*applyDashboardStartedOnlyFilterForType\('vm'\)/);
    assert.match(dashboardScript, /'data-fv-runtime-state': getDashboardRuntimeStateMeta\('docker', ct\)\.state/);
    assert.match(dashboardScript, /'data-fv-runtime-state': getDashboardRuntimeStateMeta\('vm', ct\)\.state/);
    assert.match(dashboardScript, /syncDashboardRuntimeRows[\s\S]*applyDashboardStartedOnlyFilterForType\(resolvedType\)/);
    assert.match(dashboardScript, /toggleFolderExpansion[\s\S]*applyDashboardStartedOnlyFilterForType\(meta\.type\)/);
    assert.doesNotMatch(dashboardScript, /tbody#docker_view > tr\.updated > td > div > span\.outer\.stopped/);
    assert.doesNotMatch(dashboardScript, /tbody#vm_view > tr\.updated > td > div > span\.outer\.stopped/);
    assert.match(dashboardCss, /tbody#docker_view \.fv-dashboard-started-only-hidden,[\s\S]*display:\s*none !important/);
});

test('dashboard advanced preview module is loaded before dashboard runtime and exposes attach api', () => {
    assert.match(dashboardPage, /chart\.min\.js[\s\S]*chartjs-plugin-streaming\.min\.js[\s\S]*dashboard\.advanced-preview\.js[\s\S]*dashboard\.js/);
    assert.match(dashboardAdvancedPreviewScript, /root\.FolderViewPlusDashboardAdvancedPreview = factory\(\)/);
    assert.match(dashboardAdvancedPreviewScript, /const attachAdvancedPreview = \(\{ triggerEl, ct, folder = \{\}, id = '', settings = \{\}, cpus = 1 \} = \{\}\) =>/);
    assert.match(dashboardAdvancedPreviewScript, /const parseStatsMessage = \(event, ct, cpus = 1\) =>/);
    assert.match(dashboardAdvancedPreviewScript, /attachedListener/);
    assert.match(dashboardAdvancedPreviewScript, /chart\.canvas/);
    assert.doesNotMatch(dashboardScript, /FolderViewPlusNativeOrganizer|syncDockerOrganizer/);
});

test('shared fatal banner runtime is exposed on settings and runtime pages and exposes fatal reporting helpers', () => {
    const fatalBannerScript = fs.readFileSync(
        path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js'),
        'utf8'
    );
    assert.match(settingsPage, /folderviewplus\.fatal-banner\.js[\s\S]*folderviewplus\.utils\.js/);
    assert.match(dockerPage, /folderviewplus\.fatal-banner\.js[\s\S]*folderviewplus\.utils\.js/);
    assert.match(vmPage, /folderviewplus\.fatal-banner\.js[\s\S]*folderviewplus\.utils\.js/);
    assert.match(dockerPage, /'hostSelector'\s*=>\s*'#fvplus-docker-runtime-banner-host, \.canvas'/);
    assert.match(vmPage, /'hostSelector'\s*=>\s*'#fvplus-vm-runtime-banner-host'/);
    assert.match(settingsPage, /'unraidVersion'\s*=>/);
    assert.match(folderPage, /fvplus-runtime-context[\s\S]*'page'\s*=>\s*'Folder Editor'[\s\S]*folderviewplus\.fatal-banner\.js/);
    assert.match(dashboardPage, /fvplus-runtime-context[\s\S]*'page'\s*=>\s*'Dashboard'[\s\S]*folderviewplus\.fatal-banner\.js/);
    assert.match(pageBootstrapScript, /FolderViewPlusFatalRuntimeContext/);
    assert.match(folderEditorPageBootstrapScript, /FolderViewPlusFolderEditorPageMode/);
    assert.match(dashboardPage, /id="fvplus-dashboard-runtime-banner-host"/);
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
    assert.match(fatalBannerScript, /const buildSupportReport = \(issue = null, options = \{\}\) =>/);
    assert.match(fatalBannerScript, /const clearResolvedIssue = \(\) =>/);
    assert.match(fatalBannerScript, /Copy support code/);
    assert.match(fatalBannerScript, /Download startup report/);
    assert.match(fatalBannerScript, /diagnostics\.cards\.technical-details/);
    assert.match(fatalBannerScript, /`severity: \$\{trimString\(activeIssue\.severity/);
    assert.match(fatalBannerScript, /`category: \$\{trimString\(activeIssue\.category/);
    assert.match(fatalBannerScript, /`lastAction: \$\{protect\(trimString\(state\.lastAction/);
    assert.match(fatalBannerScript, /\[affected-areas\]/);
    assert.match(fatalBannerScript, /const DIAGNOSTIC_REQUEST_LIMIT = 16/);
    assert.match(fatalBannerScript, /\[recent-actions\]/);
    assert.match(fatalBannerScript, /\[module-events\]/);
    assert.match(fatalBannerScript, /\[recovery-attempts\]/);
    assert.match(fatalBannerScript, /const registerRecoveryHandler = \(name, handler\) =>/);
    assert.match(fatalBannerScript, /const getStartupIncidentSnapshot = \(\) =>/);
    assert.match(fatalBannerScript, /win\.addEventListener\('securitypolicyviolation'/);
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
    assert.match(dashboardQuickRailScript, /const syncDashboardCompactMatrixOrderFlowForType = \(type, layout, trigger = 'layout-apply'\) =>/);
    assert.match(dashboardQuickRailScript, /const deriveCompactMatrixLayout = \(\{ containerWidth = 0, folderCount = 0 \} = \{\}\) =>/);
    assert.match(dashboardQuickRailScript, /--fv-dashboard-compactmatrix-columns/);
    assert.match(dashboardQuickRailScript, /--fv-dashboard-compactmatrix-member-columns/);
    assert.match(dashboardQuickRailScript, /new win\.ResizeObserver/);
    assert.match(dashboardQuickRailScript, /syncDashboardCompactMatrixOrderFlowForType\(meta\.type, layout, 'layout-apply'\);/);
    assert.doesNotMatch(dashboardQuickRailScript, /iconClass\.includes\('angle-down'\)/);
    assert.doesNotMatch(dashboardQuickRailScript, /iconClass\.includes\('chevron-down'\)/);
});

test('compact matrix derives folder and member columns from the widget width', () => {
    const derive = dashboardQuickRailModule.deriveCompactMatrixLayout;
    assert.equal(typeof derive, 'function');
    assert.deepEqual(
        { ...derive({ containerWidth: 1200, folderCount: 5 }) },
        {
            containerWidth: 1200,
            folderCount: 5,
            folderColumns: 3,
            folderRows: 2,
            estimatedFolderWidth: 394,
            memberColumns: 1,
            estimatedMemberWidth: 394
        }
    );
    assert.equal(derive({ containerWidth: 900, folderCount: 5 }).folderColumns, 2);
    assert.equal(derive({ containerWidth: 520, folderCount: 5 }).folderColumns, 1);
    assert.equal(derive({ containerWidth: 350, folderCount: 5 }).folderColumns, 1);
    assert.equal(derive({ containerWidth: 1080, folderCount: 2 }).memberColumns, 2);
});

test('dashboard css includes non-classic controls and overflow rendering modes', () => {
    assert.match(dashboardCss, /\.fv-dashboard-layout-inline-host/);
    assert.match(dashboardCss, /--fvplus-dashboard-quick-rail-gutter:\s*36px/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-inline-container\.fv-dashboard-has-visible-quick-rail\s*\{[\s\S]*padding-right:\s*var\(--fvplus-dashboard-quick-rail-gutter\)/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail\.is-clamped/);
    assert.match(dashboardCss, /\.fv-dashboard-layout-quick-rail\.is-compact-grid/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action/);
    assert.match(dashboardCss, /\.fv-dashboard-view-popover-shell/);
    assert.match(dashboardCss, /select\.fv-dashboard-layout-select:focus-visible/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*border:\s*0 !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*border-radius:\s*5px/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-dashboard-quick-action-bg-top\),\s*var\(--fvplus-dashboard-quick-action-bg-bottom\)\) !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*box-shadow:\s*var\(--fvplus-dashboard-quick-action-shadow\) !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action:hover\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-dashboard-quick-action-hover-top\),\s*var\(--fvplus-dashboard-quick-action-hover-bottom\)\) !important/);
    assert.doesNotMatch(dashboardCss, /\.fv-dashboard-quick-action:hover\s*\{[\s\S]*transform:\s*translateY\(-1px\)/);
    assert.match(dashboardCss, /data-fv-layout="legacy"/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-health-emphasis-enabled/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-density-compact/);
    assert.match(dashboardCss, /data-fv-layout="accordion"/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-show-expand-toggle/);
    assert.match(dashboardCss, /\.fv-dashboard-expand-toggle-btn\s*\{/);
    assert.match(dashboardCss, /\.fv-dashboard-expand-toggle-btn\s*\{[\s\S]*width:\s*24px/);
    assert.match(dashboardCss, /span\.outer\[data-fv-dashboard-folder-toggle\]:focus-visible/);
    assert.doesNotMatch(dashboardCss, /\.fv-dashboard-expand-toggle-btn\s*\{[\s\S]{0,800}!important/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-greyscale-enabled/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-hide-folder-label/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-fullwidth/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-accordion/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-inset/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-compactmatrix/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-compactmatrix > tr\.updated > td \{/);
    assert.match(dashboardCss, /grid-template-columns:\s*repeat\(var\(--fv-dashboard-compactmatrix-columns,\s*1\),\s*minmax\(0,\s*1fr\)\)/);
    assert.match(dashboardCss, /grid-template-rows:\s*repeat\(var\(--fv-dashboard-compactmatrix-rows,\s*1\),\s*max-content\)/);
    assert.match(dashboardCss, /grid-auto-flow:\s*column/);
    assert.match(dashboardCss, /grid-template-columns:\s*repeat\(var\(--fv-dashboard-compactmatrix-member-columns,\s*1\),\s*minmax\(0,\s*1fr\)\)/);
    assert.doesNotMatch(dashboardCss, /--fv-dashboard-compactmatrix-rows-(?:desktop|tablet|mobile)/);
    assert.match(dashboardCss, /tbody\.fv-dashboard-layout-compactmatrix \.fv-dashboard-expand-toggle-btn \{/);
    assert.doesNotMatch(dashboardCss, /\.folder-hand-docker[\s\S]{0,160}display:\s*none !important/);
    assert.doesNotMatch(dashboardCss, /\.folder-hand-vm[\s\S]{0,160}display:\s*none !important/);
    assert.match(dashboardCss, /\.folder-showcase > span\.outer:not\(\.folder-docker\):not\(\.folder-vm\)\s*\{[\s\S]*overflow:\s*hidden/);
    assert.match(dashboardCss, /\.folder-showcase \.fv-dashboard-member-actions\s*\{[\s\S]*display:\s*flex/);
    assert.match(dashboardCss, /\.folder-showcase \.fv-dashboard-member-actions\s*\{[\s\S]*margin:\s*3px 0 0/);
    assert.match(dashboardCss, /\.fv-dashboard-advanced-preview\s*\{/);
    assert.match(dashboardCss, /\.fv-dashboard-advanced-preview-actions/);
    assert.match(dashboardCss, /\.fv-dashboard-advanced-preview-graphs canvas/);
    assert.match(dashboardCss, /data-fv-dashboard-overflow="scroll"/);
    assert.match(dashboardCss, /data-fv-dashboard-overflow="expand_row"/);
});

test('folder editor supports per-folder dashboard overflow mode', () => {
    assert.match(folderPage, /name="dashboard_overflow"/);
    assert.match(folderPage, /name="preview_status"/);
    assert.match(folderPage, /<option value="symbol" selected>Show status symbol<\/option>/);
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

test('dashboard render waits for successful folder hydration and has request fallbacks', () => {
    assert.match(dashboardScript, /const dashboardRequestDiagnostics = \{\s*docker: \[\],\s*vm: \[\]\s*\};/);
    assert.match(dashboardScript, /const getDashboardRequestWithFallback = \(type, label, url, fallback\) => requestClient\.getText\(url\)/);
    assert.match(dashboardScript, /recordDashboardRequestFallback\(type, label, error\);/);
    assert.match(dashboardScript, /const prepareDashboardFolderRequestsForType = \(type\) => \{/);
    assert.match(dashboardScript, /runtimeSnapshotApi\.buildUrl\(resolvedType, 'full'/);
    assert.match(dashboardScript, /runtimeSnapshotApi\.createProjectedBundle\([\s\S]*\['folders', 'order', 'runtime', 'unraidOrder', 'prefsResponse'\]/);
    assert.match(dashboardScript, /const legacyFactories = \[[\s\S]*getDashboardRequestWithFallback\(resolvedType, 'runtime info'/);
    assert.match(dashboardScript, /fallbackFactories: legacyFactories/);
    assert.match(dashboardScript, /prepareFolderRequests: prepareDashboardFolderRequestsForType/);
    assert.match(dashboardScript, /const queueCreateFoldersRender = \(\) => \{/);
    assert.match(dashboardScript, /let createFoldersPromise = null;/);
    assert.match(dashboardScript, /return createFoldersPromise \|\| Promise\.resolve\(false\);/);
    assert.match(dashboardScript, /createFoldersPromise = Promise\.resolve\(\)[\s\S]*\.then\(\(\) => createFolders\(\)\)[\s\S]*\.then\(\(\) => true\)/);
    assert.match(dashboardScript, /renderFolders: queueCreateFoldersRender/);
    assert.doesNotMatch(dashboardScript, /let loadedFolder =/);
});

test('dashboard status and diagnostics include paused state and sanitized render details', () => {
    assert.match(dashboardScript, /const sanitizeDashboardInfoForDebug = \(type, info\) =>/);
    assert.match(dashboardScript, /const collectDashboardRenderDiagnosticsForType = \(type\) =>/);
    assert.match(dashboardScript, /containersInfo: sanitizeDashboardInfoForDebug\('docker', containersInfo\)/);
    assert.match(dashboardScript, /vmInfo: sanitizeDashboardInfoForDebug\('vm', vmInfo\)/);
    assert.match(dashboardScript, /let paused = 0;/);
    assert.match(dashboardScript, /paused \+= newFolder\[container\]\.state && newFolder\[container\]\.pause \? 1 : 0;/);
    assert.match(dashboardScript, /const isVmPaused = vmState === 'paused' \|\| vmState === 'pmsuspended';/);
    assert.match(dashboardScript, /folder\.status\.paused = paused;/);
    assert.match(dashboardScript, /const statusClass = allStartedArePaused \? 'paused' : 'started';/);
});
