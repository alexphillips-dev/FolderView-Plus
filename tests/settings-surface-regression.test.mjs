import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const themeWorkspacePhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/theme_workspace.php');
const supportBundlePreviewJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js');
const supportBundleBrowserJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-browser.js');
const supportBundleTelemetryJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js');
const diagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const settingsJs = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
].map((relativePath) => read(relativePath)).join('\n');
const settingsSectionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js');
const themeWorkspaceJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-workspace.js');
const wizardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js');

test('settings first paint is cloaked until config-only folder data is ready', () => {
    assert.match(settingsPage, /id="fv-settings-root" class="fv-theme-safe fv-settings-bootstrap-pending" aria-busy="true"/);
    assert.match(settingsPage, /id="fv-settings-bootstrap-shell"[\s\S]*Loading FolderView Plus settings/);
    assert.match(settingsCss, /#fv-settings-root\.fv-settings-bootstrap-pending > :not\(#fv-settings-bootstrap-shell\):not\(#fvplus-fatal-banner\)/);
    assert.match(settingsJs, /const revealSettingsBootstrapSurface = \(\) => \{[\s\S]*classList\.remove\('fv-settings-bootstrap-pending'\)/);
    assert.match(settingsJs, /const result = await refreshCoreData\(\);[\s\S]*setSettingsMode\(settingsUiState\.mode\);[\s\S]*revealSettingsBootstrapSurface\(\);/);
});

test('settings loading shell avoids false blank alarms and bootstrap request storms', () => {
    assert.match(settingsPage, /String\(reason \|\| ''\) === 'watchdog-early' && isVisible\(loadingShell\)/);
    assert.match(settingsJs, /configureThemeResolverRuntimeApi\(\{\s*getMode: getEffectiveThemeCompatibilityMode,[\s\S]*trackEvent: null/);
    assert.doesNotMatch(settingsJs, /eventType: 'theme_reflow'/);
    const initializeBlock = diagnosticsJs.match(/const initializeClientDiagnosticsPanels = \(\) => \{[\s\S]*?\n\};/)?.[0] || '';
    assert.doesNotMatch(initializeBlock, /refreshSupportBundlePreview/);
    assert.match(diagnosticsJs, /const hydrateDiagnosticsPreview = async \(\{ force = false \} = \{\}\) =>/);
    assert.match(settingsJs, /const hydrateActiveDiagnosticsPreview = \(\) => \{[\s\S]*settingsUiState\.advancedTab !== 'diagnostics'[\s\S]*FolderViewPlusHydrateDiagnosticsPreview/);
});

test('settings page loads smart-detect config before starter templates and diagnostics modules', () => {
    const configIndex = settingsPage.indexOf('folderviewplus.smart-detect-config.js');
    const templatesIndex = settingsPage.indexOf('folderviewplus.starter-templates.js');
    const supportBundlePreviewIndex = settingsPage.indexOf('folderviewplus.support-bundle-preview.js');
    const supportBundleBrowserIndex = settingsPage.indexOf('folderviewplus.support-bundle-browser.js');
    const supportBundleTelemetryIndex = settingsPage.indexOf('folderviewplus.support-bundle-telemetry.js');
    const diagnosticsIndex = settingsPage.indexOf('folderviewplus.activity-diagnostics.js');
    const bulkAssignmentSharedIndex = settingsPage.indexOf('folderviewplus.bulk-assignment.shared.js');
    assert.ok(configIndex >= 0, 'smart-detect config include is missing');
    assert.ok(templatesIndex >= 0, 'starter templates include is missing');
    assert.ok(supportBundlePreviewIndex >= 0, 'support bundle preview include is missing');
    assert.ok(supportBundleBrowserIndex >= 0, 'support bundle browser include is missing');
    assert.ok(supportBundleTelemetryIndex >= 0, 'support bundle telemetry include is missing');
    assert.ok(diagnosticsIndex >= 0, 'activity diagnostics include is missing');
    assert.ok(bulkAssignmentSharedIndex >= 0, 'bulk assignment shared include is missing');
    assert.ok(configIndex < templatesIndex, 'smart-detect config must load before starter templates');
    assert.ok(templatesIndex < supportBundlePreviewIndex, 'starter templates must load before support bundle preview module');
    assert.ok(supportBundlePreviewIndex < supportBundleBrowserIndex, 'support bundle preview module must load before support bundle browser helper');
    assert.ok(supportBundleBrowserIndex < supportBundleTelemetryIndex, 'support bundle browser helper must load before support bundle telemetry');
    assert.ok(supportBundlePreviewIndex < supportBundleTelemetryIndex, 'support bundle preview module must load before support bundle telemetry');
    assert.ok(supportBundleTelemetryIndex < diagnosticsIndex, 'support bundle telemetry module must load before diagnostics');
    assert.ok(configIndex < diagnosticsIndex, 'smart-detect config must load before diagnostics');
    assert.ok(diagnosticsIndex < bulkAssignmentSharedIndex, 'activity diagnostics must load before bulk assignment shared module');
});

test('settings diagnostics exports client perf and theme telemetry helpers', () => {
    assert.match(supportBundlePreviewJs, /FolderViewPlusSupportBundlePreviewModuleLoaded = true/);
    assert.match(supportBundlePreviewJs, /const createApi = \(deps = \{\}\) =>/);
    assert.match(supportBundlePreviewJs, /const buildSupportBundlePreviewSectionCards = \(bundle\) =>/);
    assert.match(supportBundlePreviewJs, /const buildSupportBundleRedactionPreviewHtml = \(bundle\) =>/);
    assert.match(supportBundlePreviewJs, /const buildDashboardCaptureStatusHtml = \(bundle\) =>/);
    assert.match(supportBundlePreviewJs, /const buildDiagnosticDomainsHtml = \(bundle\) =>/);
    assert.match(supportBundleBrowserJs, /FolderViewPlusSupportBundleBrowserModuleLoaded = true/);
    assert.match(supportBundleBrowserJs, /const readCookieValue = \(name\) => \{/);
    assert.match(supportBundleBrowserJs, /dockerListViewModeCookie: normalizeDockerListViewMode\(readCookieValue\('docker_listview_mode'\)\),/);
    assert.match(supportBundleBrowserJs, /const collectLoadedAssetTelemetry = \(uiRedactor, options = \{\}\) =>/);
    assert.match(supportBundleBrowserJs, /const fallbackVersionToken = normalizeAssetVersionToken\(options\?\.pluginVersion \|\| ''\);/);
    assert.match(supportBundleBrowserJs, /rawVersionQuery,/);
    assert.match(supportBundleBrowserJs, /versionSource,/);
    assert.match(supportBundleBrowserJs, /const collectBrowserConsoleErrors = \(options = \{\}\) =>/);
    assert.match(supportBundleBrowserJs, /const collectDockerPageDiagnostics = \(uiRedactor\) => \{/);
    assert.match(supportBundleBrowserJs, /const collectDockerBulkUpdateTrace = \(uiRedactor\) => \{/);
    assert.match(supportBundleTelemetryJs, /FolderViewPlusSupportBundleTelemetryModuleLoaded = true/);
    assert.match(supportBundleTelemetryJs, /const createApi = \(deps = \{\}\) =>/);
    assert.match(supportBundleTelemetryJs, /const createUiTelemetryRedactor = \(bundle, privacy = 'sanitized'\) =>/);
    assert.match(supportBundleTelemetryJs, /const browserModule = root\?\.FolderViewPlusSupportBundleBrowser \|\| null;/);
    assert.match(supportBundleTelemetryJs, /const collectBrowserCapabilities = browserCollectors\?\.collectBrowserCapabilities \|\| \(\(\) => \(\{\}\)\);/);
    assert.match(supportBundleTelemetryJs, /const collectClientStorageDiagnostics = browserCollectors\?\.collectClientStorageDiagnostics \|\| \(\(\) => \(\{/);
    assert.match(supportBundleTelemetryJs, /dockerListViewModeCookie:\s*null,/);
    assert.match(supportBundleTelemetryJs, /const collectCurrentPageTelemetry = browserCollectors\?\.collectCurrentPageTelemetry \|\| \(\(uiRedactor\) => \{/);
    assert.match(supportBundleTelemetryJs, /const collectSupportBundleUiTelemetry = \(bundle\) =>/);
    assert.match(diagnosticsJs, /const normalizeSupportBundleV2Payload = \(bundle, privacy = 'sanitized'\) =>/);
    assert.match(diagnosticsJs, /const getSupportBundleTelemetryApi = \(\) =>/);
    assert.match(diagnosticsJs, /const collectSupportBundleUiTelemetry = \(bundle\) =>/);
    assert.match(diagnosticsJs, /const renderSupportBundlePreview = \(bundle = null\) =>/);
    assert.match(diagnosticsJs, /const refreshSupportBundlePreview = async \(\{ privacy = 'sanitized', quiet = true \} = \{\}\) =>/);
    assert.match(diagnosticsJs, /getDiagnosticsSummary:\s*\(\) => lastDiagnostics\?\.summary \|\| null/);
    assert.match(diagnosticsJs, /enrichSupportBundlePreview:\s*collectSupportBundleUiTelemetry/);
    assert.match(supportBundleTelemetryJs, /payload\.bundleMeta\?\.previewOnly === true/);
    assert.match(supportBundleTelemetryJs, /payload\.healthAndHistory\.summary = \{ \.\.\.diagnosticsSummary \};/);
    assert.match(supportBundlePreviewJs, /lastSupportBundlePreview = await enrichSupportBundlePreview\(bundle\)/);
    assert.match(diagnosticsJs, /const diagnosticsShowError = \(title, error\) => \{/);
    assert.match(diagnosticsJs, /const diagnosticsEscapeHtml = \(value\) => \{/);
    assert.match(diagnosticsJs, /const diagnosticsToPrettyJson = \(value\) =>/);
    assert.match(diagnosticsJs, /const diagnosticsFormatTimestamp = \(isoString\) => \{/);
    assert.match(diagnosticsJs, /const diagnosticsDownloadFile = \(name, content\) => \{/);
    assert.match(diagnosticsJs, /escapeHtml:\s*diagnosticsEscapeHtml/);
    assert.match(diagnosticsJs, /showError:\s*diagnosticsShowError/);
    assert.doesNotMatch(diagnosticsJs, /(?<!\.)\bescapeHtml\(/);
    assert.doesNotMatch(diagnosticsJs, /(?<!\.)\btoPrettyJson\(/);
    assert.doesNotMatch(diagnosticsJs, /(?<!\.)\bformatTimestamp\(/);
    assert.doesNotMatch(diagnosticsJs, /(?<!\.)\bdownloadFile\(/);
    assert.doesNotMatch(diagnosticsJs, /(?<!window\.)\bshowError\(/);
    assert.match(diagnosticsJs, /const collectClientPerformanceTelemetry = \(\) =>/);
    assert.match(diagnosticsJs, /const collectFolderEditorDebugDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const EDITOR_DEBUG_SURFACE_STORAGE_KEY = 'fv\.folder\.editor\.debug\.surface\.v1';/);
    assert.match(diagnosticsJs, /const surface = readClientDiagnosticsStorageRecord\(EDITOR_DEBUG_SURFACE_STORAGE_KEY\);/);
    assert.match(diagnosticsJs, /const renderFolderEditorDebugDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const copyFolderEditorDebugDiagnostics = async \(\) =>/);
    assert.match(diagnosticsJs, /const renderPerformanceDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_BUDGET_MS = Object\.freeze\(\{/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_SAMPLE_TTL_MS = 24 \* 60 \* 60 \* 1000;/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_EVALUATION_WINDOW_MS = 30 \* 60 \* 1000;/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_STORAGE_KEY = 'fv\.performance\.diagnostics\.history\.v1';/);
    assert.match(diagnosticsJs, /restorePerformanceDiagnosticsHistory\(\);/);
    assert.match(settingsJs, /recordPerformanceDiagnosticsSample\('runtimeHydration'/);
    assert.match(diagnosticsJs, /action=support_bundle_preview/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_RECENT_WINDOW = 3;/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_REPEAT_THRESHOLD = 2;/);
    assert.match(diagnosticsJs, /const PERF_DIAGNOSTICS_EXTREME_MULTIPLIER = 3;/);
    assert.match(diagnosticsJs, /const resolvePerformanceDiagnosticsBudgetMs = \(bucket, type = 'global'\) =>/);
    assert.match(diagnosticsJs, /overBudget:\s*repeatedOverBudget \|\| extremeOverBudget/);
    assert.match(diagnosticsJs, /coldLoad:\s*row\?\.details\?\.coldLoad === true/);
    assert.match(diagnosticsJs, /const buildPerformanceBudgetDiagnosticsSummaryCard = \(\) => \{/);
    assert.match(diagnosticsJs, /label:\s*'Performance Budgets'/);
    assert.match(diagnosticsJs, /const advisoryCards = performanceBudgetCard \? \[performanceBudgetCard\] : \[\];/);
    assert.match(diagnosticsJs, /const optionalCards = \[nativeOrganizerCard, localizationCard\]\.filter\(Boolean\);/);
    assert.match(diagnosticsJs, /label: 'Performance advisories'/);
    assert.match(diagnosticsJs, /label: 'Optional integrations'/);
    assert.match(diagnosticsJs, /const retestPerformanceDiagnostics = async \(\) => \{/);
    assert.match(diagnosticsJs, /window\.FolderViewPlusRefreshCoreData/);
    assert.match(settingsJs, /window\.FolderViewPlusRefreshCoreData = async \(\) => \{[\s\S]*await result\?\.runtimeHydrationPromise;/);
    assert.match(settingsJs, /coldLoad: settingsUiState\.initialized !== true/);
    assert.match(settingsCss, /\.fv-diagnostics-card-sections\s*\{/);
    assert.match(settingsCss, /\.fv-diagnostics-card-section\.is-core\s*\{\s*grid-column:\s*1 \/ -1;/);
    assert.match(settingsCss, /\.fv-diagnostics-card-section\.is-advisory\s*\{\s*grid-column:\s*span 1;/);
    assert.match(settingsCss, /\.fv-diagnostics-card-section\.is-optional\s*\{\s*grid-column:\s*span 2;/);
    assert.match(settingsCss, /\.fv-diagnostics-card-section\.is-optional > \.fv-diagnostics-card-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
    assert.match(settingsCss, /\.fv-diagnostics-card-section-head strong\s*\{[\s\S]*?font-size:\s*1\.3rem;/);
    assert.match(settingsCss, /\.fv-diagnostics-lane-head strong\s*\{[\s\S]*?font-size:\s*1\.3rem;/);
    assert.match(settingsPage, /class="fv-diagnostics-lane-head is-support"[\s\S]*?>Share with support<\/strong>/);
    assert.match(settingsCss, /\.fv-diagnostics-lane-head\.is-support > strong\s*\{\s*color:\s*var\(--fvplus-settings-chip-info\);/);
    assert.match(settingsCss, /\.fv-diagnostics-card-details\s*\{/);
    assert.match(diagnosticsJs, /diagnosticsT\('diagnostics\.performance\.budget', 'Budget'\)/);
    assert.match(diagnosticsJs, /const renderDiagnosticsSummary = \(diagnostics\) =>/);
    assert.doesNotMatch(diagnosticsJs, /resolveDiagnosticsRecommendedActions|renderDiagnosticsActionCards|fv-diagnostics-actions|diagnostics\.fixes\./);
    assert.match(diagnosticsJs, /const NATIVE_ORGANIZER_STATUS_STORAGE_KEY = 'fv\.native\.organizer\.status\.v1';/);
    assert.match(diagnosticsJs, /const buildNativeOrganizerDiagnosticsSummaryCard = \(diagnostics\) =>/);
    assert.match(diagnosticsJs, /Native organizer sync status is waiting for the Docker page/);
    assert.match(diagnosticsJs, /info:\s*Object\.freeze\(\{ label: 'Optional'/);
    assert.match(diagnosticsJs, /const checkNativeOrganizerDiagnostics = async \(\) =>/);
    assert.match(diagnosticsJs, /actionKey = 'check_native_organizer'/);
    assert.match(diagnosticsJs, /status:\s*'info',[\s\S]{0,240}Optional native organizer integration is unavailable/);
    assert.match(diagnosticsJs, /nativeOrganizerCard/);
    assert.match(diagnosticsJs, /const collectThemeDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const runThemeDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const collectThemeTelemetrySnapshot = \(\) =>/);
    assert.match(diagnosticsJs, /const exportFullDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const exportFullSupportBundle = \(\) =>/);
    assert.match(settingsPage, /id="fv-diagnostics-summary"/);
    assert.doesNotMatch(settingsPage, /Suggested fixes|fv-diagnostics-actions|diagnostics\.fixes\./);
    assert.match(settingsPage, /id="fv-support-bundle-preview" class="fv-support-bundle-preview"/);
    assert.doesNotMatch(settingsPage, /id="fv-diagnostics-technical"/);
    assert.doesNotMatch(settingsPage, /id="folder-editor-diagnostics-output"/);
    assert.doesNotMatch(settingsPage, /renderFolderEditorDebugDiagnostics\(\)/);
    assert.doesNotMatch(settingsPage, /copyFolderEditorDebugDiagnostics\(\)/);
    assert.doesNotMatch(settingsPage, /exportFullDiagnostics\(\)/);
    assert.doesNotMatch(settingsPage, /exportFullSupportBundle\(\)/);
    assert.match(diagnosticsJs, /window\.FolderViewPlusDiagnostics = Object\.freeze\(\{/);
    assert.match(diagnosticsJs, /collectClientPerformanceTelemetry/);
    assert.match(diagnosticsJs, /collectFolderEditorDebugDiagnostics/);
    assert.match(diagnosticsJs, /supportBundleTelemetryModule && typeof supportBundleTelemetryModule\.createApi === 'function'/);
    assert.match(diagnosticsJs, /telemetryApi\.collectSupportBundleUiTelemetry\(bundle\)/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.browserCapabilities = collectBrowserCapabilities\(\);/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.clientStorage = collectClientStorageDiagnostics\(\);/);
    assert.match(supportBundleBrowserJs, /nativeOrganizerSource/);
    assert.match(supportBundleBrowserJs, /failureCategory: normalizeEnum\(nativeOrganizerSource\.failureCategory, NATIVE_ORGANIZER_FAILURE_CATEGORIES\)/);
    assert.match(diagnosticsJs, /nativeOrganizer: NATIVE_ORGANIZER_STATUS_STORAGE_KEY/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.currentPage = collectCurrentPageTelemetry\(uiRedactor\);/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.loadedAssets = collectLoadedAssetTelemetry\(uiRedactor, \{/);
    assert.match(supportBundleTelemetryJs, /pluginVersion: payload\.bundleMeta\?\.pluginVersion \|\| ''/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.requestErrors = uiRedactor\.sanitizeValue\(/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.browserConsoleErrors = uiRedactor\.sanitizeValue\(/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.dockerDiagnostics = \{/);
    assert.match(supportBundleTelemetryJs, /pageSnapshot: collectDockerPageDiagnostics\(uiRedactor\),/);
    assert.match(supportBundleTelemetryJs, /bulkUpdateTrace: collectDockerBulkUpdateTrace\(uiRedactor\),/);
    assert.match(supportBundleTelemetryJs, /requestBundleTrace: collectDockerRequestBundleTrace\(uiRedactor\),/);
    assert.match(supportBundleTelemetryJs, /traceHealth: collectDockerTraceHealth\(uiRedactor\)/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.folderEditorDebug = uiRedactor\.sanitizeValue\(/);
    assert.match(supportBundleTelemetryJs, /existingUiTelemetry\.theme = collectThemeTelemetrySnapshot\(\);/);
    assert.match(supportBundleTelemetryJs, /payload\.uiTelemetry = existingUiTelemetry;/);
    assert.match(diagnosticsJs, /dockerPage: 'fv\.support\.bundle\.docker\.page\.v1',/);
    assert.match(diagnosticsJs, /dockerBulkUpdateTrace: 'fv\.support\.bundle\.docker\.bulkUpdateTrace\.v1',/);
    assert.match(diagnosticsJs, /dockerRequestBundleTrace: 'fv\.support\.bundle\.docker\.requestBundleTrace\.v1',/);
    assert.match(diagnosticsJs, /dockerTraceHealth: 'fv\.support\.bundle\.docker\.traceHealth\.v1'/);
    assert.match(diagnosticsJs, /previewApi \? previewApi\.getLastSupportBundlePreview\(\) : null/);
    assert.match(diagnosticsJs, /void refreshSupportBundlePreview\(\{ privacy: 'sanitized', quiet: true \}\);/);
    assert.match(diagnosticsJs, /const report = normalizeSupportBundleV2Payload\(diagnostics \|\| \{\}, diagnostics\?\.bundleMeta\?\.privacyMode \|\| 'sanitized'\);/);
    assert.match(diagnosticsJs, /report\.bundleMeta\?\.generatedAt/);
    assert.match(diagnosticsJs, /report\.pluginState\?\.\[type\]/);
    assert.match(diagnosticsJs, /report\.healthAndHistory\?\.recentTimeline/);
    assert.match(diagnosticsJs, /report\.uiTelemetry\?\.folderEditorDebug/);
    assert.match(diagnosticsJs, /Folder details:/);
    assert.match(diagnosticsJs, /Rules details:/);
    assert.match(diagnosticsJs, /Backup details:/);
    assert.match(diagnosticsJs, /Integrity details:/);
    assert.match(diagnosticsJs, /surfaceSummary/);
    assert.match(diagnosticsJs, /Bootstrap banner:/);
    assert.doesNotMatch(diagnosticsJs, /repair_missing_custom_icons:\s*Object\.freeze\(\{|repair_orphaned_members:\s*Object\.freeze\(\{|repairMissingIconsAction/);
    assert.match(diagnosticsJs, /Theme diagnostics are live before a full health check\./);
    assert.match(diagnosticsJs, /return response;/);
    assert.match(diagnosticsJs, /runThemeDiagnostics\(\);\s*initializeClientDiagnosticsPanels\(\);/);
    assert.match(diagnosticsJs, /runThemeSelfHeal/);
    assert.doesNotMatch(diagnosticsJs, /payload\.clientTelemetry = existingClientTelemetry;/);
    assert.doesNotMatch(diagnosticsJs, /bundle\.clientTelemetry = existingClientTelemetry;/);
    assert.doesNotMatch(diagnosticsJs, /report\.clientTelemetry\?\.folderEditorDebug/);
    assert.doesNotMatch(diagnosticsJs, /cancelButtonText:\s*'Sanitized export'/);
    assert.doesNotMatch(diagnosticsJs, /confirmButtonText:\s*'Full export'/);
});

test('wizard apply path records perf telemetry and settings CSS keeps type-scoped mobile reorder selectors', () => {
    assert.match(wizardJs, /recordPerformanceDiagnosticsSample\('wizard', 'apply'/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact\.fv-mobile-tree-reorder-docker tbody#docker/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact\.fv-mobile-tree-reorder-vm tbody#vms/);
    assert.doesNotMatch(settingsCss, /#fv-settings-root\.fv-mobile-compact:is\(\.fv-mobile-tree-reorder-docker, \.fv-mobile-tree-reorder-vm\)/);
    assert.doesNotMatch(settingsCss, /body\.fv-mobile-compact #fv-settings-root:is\(\.fv-mobile-tree-reorder-docker, \.fv-mobile-tree-reorder-vm\)/);
    assert.doesNotMatch(settingsCss, /\.fv-settings-label\s*\{/);
});

test('settings headings keep dedicated orange title accents across dark themes', () => {
    assert.match(settingsCss, /--fvplus-settings-title-accent:\s*var\(--fvplus-graphite-accent-strong,\s*#ff9d36\)/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fvplus-settings-title-accent:\s*#be6b18/);
    assert.match(settingsCss, /#fv-settings-root h2\[data-fv-section\],[\s\S]*#fv-settings-root \.settings-mini-title,[\s\S]*#fv-settings-root \.rules-header h3,[\s\S]*color:\s*var\(--fvplus-settings-title-accent\) !important;/);
});

test('settings bootstrap verifies visible content after ready and recovers blank surfaces', () => {
    assert.match(settingsJs, /const hasVisibleSettingsSurface = \(\) => \{/);
    assert.match(settingsJs, /const recoverBlankSettingsSurface = \(reason = 'post-bootstrap'\) => \{/);
    assert.match(settingsJs, /settingsUiState\.mode = 'basic';/);
    assert.match(settingsJs, /settingsUiState\.query = '';/);
    assert.match(settingsJs, /root\.style\.display = 'block';/);
    assert.match(settingsJs, /FVPLUS-SET-BLANK-RECOVERED/);
    assert.match(settingsJs, /FVPLUS-SET-BLANK-002/);
    assert.match(settingsJs, /scheduleBlankSettingsRecoveryChecks/);
    assert.match(settingsJs, /recoverBlankSettingsSurface\('ready'\)/);
    assert.match(settingsJs, /recoverBlankSettingsSurface\('post-ready-early'\)/);
    assert.match(settingsJs, /recoverBlankSettingsSurface\('post-ready-late'\)/);
});

test('advanced diagnostics omits the retired simple folder health snapshot', () => {
    assert.doesNotMatch(settingsPage, /Simple folder health snapshot/);
    assert.doesNotMatch(settingsPage, /data-fv-section="folder-health"/);
    assert.doesNotMatch(settingsPage, /id="folder-health-content"/);
    assert.doesNotMatch(settingsJs, /renderFolderHealthCards/);
    assert.doesNotMatch(settingsJs, /buildCleanHealthCardHtml/);
    assert.doesNotMatch(settingsJs, /data-fv-health-(?:filter|action)/);
    assert.doesNotMatch(settingsCss, /\.folder-health-(?:card|grid|empty|filter|actions|stat|issue)/);
    assert.doesNotMatch(settingsSectionsJs, /'folder-health'/);
});

test('advanced settings no longer render quick profile preset strip', () => {
    assert.doesNotMatch(settingsPage, /Quick profile presets/);
    assert.doesNotMatch(settingsPage, /data-fv-quick-preset=/);
    assert.doesNotMatch(settingsJs, /renderQuickProfilePresetButtons/);
    assert.doesNotMatch(settingsJs, /applyQuickProfilePreset/);
    assert.doesNotMatch(settingsCss, /\.fv-quick-presets/);
});

test('advanced settings no longer render the top maintenance action buttons', () => {
    assert.doesNotMatch(settingsPage, /Open File Manager/);
    assert.doesNotMatch(settingsPage, /Check for updates now/);
    assert.doesNotMatch(settingsPage, /Force-refresh install helper/);
    assert.doesNotMatch(settingsPage, /Create rollback checkpoint/);
    assert.doesNotMatch(settingsPage, /Rollback to previous snapshot/);
    assert.doesNotMatch(settingsPage, /onclick="fileManager\(\)"/);
    assert.doesNotMatch(settingsPage, /onclick="checkForUpdatesNow\(\)"/);
    assert.doesNotMatch(settingsPage, /onclick="showDevForceRefreshHelper\(\)"/);
    assert.doesNotMatch(settingsPage, /onclick="createRollbackCheckpoint\(\)"/);
    assert.doesNotMatch(settingsPage, /onclick="rollbackLatestCheckpoint\(\)"/);
});

test('advanced settings split auto-assignment rules into a dedicated Rules tab', () => {
    assert.match(settingsPage, /<h2 data-fv-section="auto-assignment" data-fv-advanced="1" data-fv-advanced-group="rules">Auto-assignment rules<\/h2>/);
    assert.match(settingsPage, /<h2 data-fv-section="conflict-inspector" data-fv-advanced="1" data-fv-advanced-group="rules">Rule testing and troubleshooting<\/h2>/);
    assert.match(settingsPage, /<h2 data-fv-section="bulk-assignment" data-fv-advanced="1" data-fv-advanced-group="automation">Bulk assignment<\/h2>/);
    assert.match(settingsSectionsJs, /const ADVANCED_GROUPS = \['automation', 'rules', 'recovery', 'operations', 'startup', 'appearance', 'diagnostics'\];/);
    assert.match(settingsSectionsJs, /rules:\s*'Rules'/);
    assert.match(settingsSectionsJs, /'auto-assignment':\s*'rules'/);
    assert.match(settingsSectionsJs, /'conflict-inspector':\s*'rules'/);
    assert.match(settingsSectionsJs, /rules:\s*Object\.freeze\(\[\]\)/);
    const autoAssignmentIndex = settingsPage.indexOf('<h2 data-fv-section="auto-assignment" data-fv-advanced="1" data-fv-advanced-group="rules">Auto-assignment rules</h2>');
    const conflictInspectorIndex = settingsPage.indexOf('<h2 data-fv-section="conflict-inspector" data-fv-advanced="1" data-fv-advanced-group="rules">Rule testing and troubleshooting</h2>');
    const bulkAssignmentIndex = settingsPage.indexOf('<h2 data-fv-section="bulk-assignment" data-fv-advanced="1" data-fv-advanced-group="automation">Bulk assignment</h2>');
    assert.ok(autoAssignmentIndex >= 0, 'auto-assignment section should be present');
    assert.ok(conflictInspectorIndex > autoAssignmentIndex, 'conflict inspector should render after auto-assignment within the Rules tab');
    assert.ok(bulkAssignmentIndex > conflictInspectorIndex, 'bulk assignment should remain after the Rules sections');
});

test('theme workspace lives in its own Appearance advanced tab', () => {
    assert.match(settingsPage, /<h2 data-fv-section="theme-workspace" data-fv-advanced="1" data-fv-advanced-group="appearance">Theme workspace<\/h2>/);
    assert.match(settingsPage, /id="fv-theme-workspace-summary"/);
    assert.match(settingsPage, /id="fv-theme-scan-result"/);
    assert.match(settingsPage, /onclick="scanThemeWorkspaceGithub\(\)"/);
    assert.match(settingsPage, /id="fv-theme-preview-sample"/);
    assert.match(themeWorkspaceJs, /scanGithub:\s*\(source\) => safeAction\('Theme scan'/);
    assert.match(themeWorkspaceJs, /updateTheme:\s*\(themeId\) => safeAction\('Theme update'/);
    assert.match(themeWorkspaceJs, /resetTokens/);
    assert.doesNotMatch(themeWorkspaceJs, /fv-theme-workspace-preview-style/);
    assert.match(themeWorkspacePhp, /scan_github/);
    assert.match(themeWorkspacePhp, /update_theme/);
    assert.match(libPhp, /function scanThemeWorkspaceGithub\(string \$sourceInput\): array/);
    assert.match(libPhp, /function updateThemeWorkspaceTheme\(string \$themeId\): array/);
    assert.match(libPhp, /function fvplusThemeWorkspaceNormalizeColorValue\(\$value\): string/);
    assert.match(settingsSectionsJs, /appearance:\s*'Appearance'/);
    assert.match(settingsSectionsJs, /'theme-workspace':\s*'appearance'/);
    assert.match(settingsSectionsJs, /appearance:\s*Object\.freeze\(\[\]\)/);
    assert.match(settingsCss, /\.fv-theme-import-row > button,/);
    assert.match(settingsCss, /\.fv-theme-customize-actions > button,/);
    assert.match(settingsCss, /\.fv-theme-workspace-entry-actions > button,/);
});

test('rules tab uses a source-switched workspace and bulk assignment keeps the two-column desktop layout', () => {
    assert.match(settingsPage, /class="fv-rules-source-switch"[\s\S]*setRulesWorkspaceType\('docker'\)[\s\S]*setRulesWorkspaceType\('vm'\)/);
    assert.match(settingsPage, /class="rules-panel fv-rules-workspace" data-fv-rules-type="docker"[\s\S]*id="docker-rules-status"[\s\S]*id="docker-rules-selection-summary"[\s\S]*id="docker-rules"/);
    assert.match(settingsPage, /class="rules-panel fv-rules-workspace" data-fv-rules-type="vm" hidden[\s\S]*id="vm-rules-status"[\s\S]*id="vm-rules-selection-summary"[\s\S]*id="vm-rules"/);
    assert.match(settingsPage, /class="rules-panel fv-rule-troubleshoot-panel" data-fv-rules-type="docker"[\s\S]*id="docker-rule-test-output"[\s\S]*id="docker-conflict-output"/);
    assert.match(settingsPage, /class="rules-panel fv-rule-troubleshoot-panel" data-fv-rules-type="vm" hidden[\s\S]*id="vm-rule-test-output"[\s\S]*id="vm-conflict-output"/);
    assert.match(settingsJs, /const normalizeRulesWorkspaceType = \(value\) =>/);
    assert.match(settingsJs, /const setRulesWorkspaceType = \(type, persist = true\) =>/);
    assert.match(settingsJs, /activeRulesWorkspaceType = normalizeRulesWorkspaceType\(localStorage\.getItem\(RULES_WORKSPACE_STORAGE_KEY\) \|\| 'docker'\)/);
    assert.match(settingsCss, /@media \(min-width: 1080px\) \{\s*\.bulk-assign-grid \{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\) !important;/);
    assert.doesNotMatch(settingsCss, /@media \(min-width: 1080px\) \{[\s\S]*\.bulk-assign-grid,\s*\.backup-grid,\s*\.template-grid \{\s*grid-template-columns:\s*minmax\(0,\s*1fr\) !important;/);
});

test('recovery tab uses a source-switched workspace with overview cards, snapshot history, and undo timeline', () => {
    assert.match(settingsPage, /<h2 data-fv-section="backups" data-fv-advanced="1" data-fv-advanced-group="recovery">Recovery workspace<\/h2>/);
    assert.match(settingsPage, /class="fv-rules-source-switch fv-recovery-source-switch"[\s\S]*setRecoveryWorkspaceType\('docker'\)[\s\S]*setRecoveryWorkspaceType\('vm'\)/);
    assert.match(settingsPage, /id="fv-recovery-overview"/);
    assert.match(settingsPage, /<section class="fv-recovery-stage fv-recovery-policy">[\s\S]*id="fv-recovery-policy-summary"/);
    assert.match(settingsPage, /id="fv-recovery-backup-list"/);
    assert.match(settingsPage, /id="recovery-change-history-list"/);
    assert.match(settingsPage, /onclick="restoreLatestActiveRecoveryBackup\(\)"/);
    assert.match(settingsPage, /onclick="createActiveRecoveryBackup\(\)"/);
    assert.match(settingsPage, /onclick="runActiveRecoveryScheduler\(\)"/);
    assert.match(settingsPage, /onclick="exportEnvironmentSnapshot\(\)"/);
    assert.match(settingsPage, /onclick="importEnvironmentSnapshot\(\)"/);
    assert.match(settingsPage, /id="fv-recovery-environment-summary"/);
    assert.match(settingsPage, /onclick="undoActiveRecoveryChange\(\)"/);
    assert.match(settingsJs, /FolderViewPlusSettingsWorkspacesModuleLoaded = true/);
    assert.match(settingsJs, /const normalizeRecoveryWorkspaceType = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.normalizeRecoveryWorkspaceType\(\.\.\.args\);/);
    assert.match(settingsJs, /const setRecoveryWorkspaceType = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.setRecoveryWorkspaceType\(\.\.\.args\);/);
    assert.match(settingsJs, /id="recovery-backup-entry-select"[\s\S]*selectActiveRecoveryBackup\(this\.value\)/);
    assert.match(settingsJs, /restoreSelectedActiveRecoveryBackup\(\)[\s\S]*downloadSelectedActiveRecoveryBackup\(\)[\s\S]*deleteSelectedActiveRecoveryBackup\(\)/);
    assert.match(settingsJs, /activeRecoveryWorkspaceType = normalizeRecoveryWorkspaceType\(localStorage\.getItem\(RECOVERY_WORKSPACE_STORAGE_KEY\) \|\| 'docker'\)/);
    assert.match(diagnosticsJs, /const renderRecoveryChangeHistoryFromDiagnostics = \(diagnostics = lastDiagnostics\) =>/);
    assert.match(settingsCss, /\.fv-recovery-source-switch/);
    assert.match(settingsCss, /\.fv-recovery-overview/);
    assert.match(settingsCss, /\.fv-recovery-stat-grid/);
    assert.match(settingsCss, /\.fv-recovery-environment-meta/);
    assert.match(settingsCss, /\.fv-recovery-history-picker-row/);
    assert.match(settingsCss, /\.fv-recovery-history-list,\s*\.fv-recovery-change-history-list/);
    assert.match(settingsCss, /\.fv-recovery-timeline-card/);
});

test('operations tab uses one source-switched workspace for runtime actions and templates', () => {
    assert.match(settingsPage, /<h2 data-fv-section="runtime-actions" data-fv-advanced="1" data-fv-advanced-group="operations">Operations workspace<\/h2>/);
    assert.match(settingsPage, /class="fv-rules-source-switch fv-operations-source-switch"[\s\S]*setOperationsWorkspaceType\('docker'\)[\s\S]*setOperationsWorkspaceType\('vm'\)/);
    assert.match(settingsPage, /data-fv-operations-panel="docker"[\s\S]*id="docker-operations-overview"[\s\S]*id="docker-runtime-preview-output"[\s\S]*id="docker-operations-template-library"/);
    assert.match(settingsPage, /data-fv-operations-panel="vm"[\s\S]*id="vm-operations-overview"[\s\S]*id="vm-runtime-preview-output"[\s\S]*id="vm-operations-template-library"/);
    assert.doesNotMatch(settingsPage, /<h2 data-fv-section="folder-templates"/);
    assert.match(settingsJs, /const OPERATIONS_WORKSPACE_STORAGE_KEY = 'fv\.settings\.operationsWorkspace\.v1';/);
    assert.match(settingsJs, /const buildOperationsOverviewHtml = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.buildOperationsOverviewHtml\(\.\.\.args\);/);
    assert.match(settingsJs, /const renderOperationsWorkspace = \(\.\.\.args\) => \{\s*const result = getSettingsWorkspacesApi\(\)\.renderOperationsWorkspace\(\.\.\.args\);[\s\S]*renderNativeDockerOrganizerStatus\(\);/);
    assert.match(settingsJs, /const setOperationsWorkspaceType = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.setOperationsWorkspaceType\(\.\.\.args\);/);
    assert.match(settingsJs, /const renderTemplateRows = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.renderTemplateRows\(\.\.\.args\);/);
    assert.match(settingsJs, /selectOperationsTemplate\('/);
    assert.match(settingsJs, /exportTemplateEntry\('/);
    assert.match(settingsCss, /\.fv-operations-source-switch/);
    assert.match(settingsCss, /\.fv-operations-stage-grid/);
    assert.match(settingsCss, /\.fv-operations-runtime-output/);
    assert.match(settingsCss, /\.fv-operations-template-library/);
    assert.match(settingsCss, /\.fv-recovery-empty-state\.is-ok/);
    assert.match(settingsCss, /\.fv-recovery-empty-state\.is-warning/);
    assert.doesNotMatch(settingsSectionsJs, /'folder-templates':\s*'operations'/);
});

test('Docker start order lives in its own startup advanced tab', () => {
    assert.match(settingsSectionsJs, /startup:\s*'Start Order'/);
    assert.match(settingsSectionsJs, /'docker-start-order':\s*'startup'/);
    assert.match(settingsPage, /<h2 data-fv-section="docker-start-order" data-fv-advanced="1" data-fv-advanced-group="startup">Docker start order<\/h2>/);
    assert.match(settingsPage, /id="docker-start-order-workspace"/);
    assert.doesNotMatch(settingsPage, /data-fv-operations-panel="docker"[\s\S]*id="docker-start-order-workspace"[\s\S]*data-fv-operations-panel="vm"/);
});

test('bulk assignment modules reserve equal item-list height and disable outer panel scrolling', () => {
    assert.match(settingsCss, /\.bulk-assign-grid,\s*\.backup-grid,\s*\.template-grid\s*\{[\s\S]*align-items:\s*stretch;/);
    assert.match(settingsCss, /\.bulk-assign-grid > \.rules-panel\s*\{[\s\S]*max-height:\s*none !important;[\s\S]*overflow-y:\s*hidden !important;/);
    assert.match(settingsCss, /\.bulk-items-list\s*\{[\s\S]*grid-auto-rows:\s*max-content;[\s\S]*align-content:\s*start;[\s\S]*min-height:\s*210px;[\s\S]*max-height:\s*210px;/);
});

test('bulk assignment uses staged workflow cards with summary metrics and hidden retry actions by default', () => {
    assert.match(settingsPage, /class="rules-panel bulk-module" data-fv-bulk-type="docker"[\s\S]*class="bulk-step-strip"[\s\S]*id="docker-bulk-target-summary"[\s\S]*id="docker-bulk-action-summary"/);
    assert.match(settingsPage, /class="rules-panel bulk-module" data-fv-bulk-type="vm"[\s\S]*class="bulk-step-strip"[\s\S]*id="vm-bulk-target-summary"[\s\S]*id="vm-bulk-action-summary"/);
    assert.match(settingsCss, /\.bulk-step-strip\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;/);
    assert.match(settingsCss, /\.bulk-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(settingsCss, /\.bulk-stage\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-faint\);[\s\S]*background:\s*var\(--fvplus-settings-surface-muted\);/);
    assert.match(settingsCss, /\.bulk-result-actions\.is-hidden\s*\{[\s\S]*display:\s*none !important;/);
});

test('advanced modules use shared theme-safe surfaces instead of hardcoded dark-only colors', () => {
    assert.match(settingsCss, /\.rules-panel\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-subtle\);[\s\S]*background:\s*var\(--fvplus-settings-surface-panel\);[\s\S]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.match(settingsCss, /\.rules-help\s*\{[\s\S]*color:\s*var\(--fvplus-settings-text-muted\);[\s\S]*opacity:\s*1;/);
    assert.match(settingsCss, /\.bulk-summary-card\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-faint\);[\s\S]*background:\s*var\(--fvplus-settings-surface-strong\);/);
    assert.match(settingsCss, /\.bulk-items-list\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-subtle\);[\s\S]*background:\s*var\(--fvplus-settings-surface-strong\);/);
    assert.match(settingsCss, /\.bulk-preview-panel,\s*\.bulk-result-panel\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-subtle\);[\s\S]*background:\s*var\(--fvplus-settings-surface-strong\);[\s\S]*color:\s*var\(--fvplus-settings-text-primary\);/);
});

test('diagnostics tab keeps inner side gutters for summary and workbench modules', () => {
    const diagnosticsSummaryIndex = settingsPage.indexOf('id="fv-diagnostics-summary"');
    const shareWithSupportIndex = settingsPage.indexOf('>Share with support</strong>');
    assert.match(settingsPage, /<div class="fv-diagnostics-module-wrap">/);
    assert.match(settingsPage, /<div class="fv-diagnostics-section-body">/);
    assert.ok(diagnosticsSummaryIndex >= 0, 'diagnostics summary is missing');
    assert.ok(shareWithSupportIndex > diagnosticsSummaryIndex, 'share with support should remain below the health summary');
    assert.doesNotMatch(settingsPage, /Suggested fixes|fv-diagnostics-actions|diagnostics\.fixes\./);
    assert.doesNotMatch(settingsCss, /\.fv-diagnostics-action-(?:list|card|title|copy)/);
    assert.match(settingsCss, /\.fv-diagnostics-module-wrap\s*>\s*\.rules-panel\s*\{[\s\S]*margin-inline:\s*var\(--fv-advanced-side-padding\);/);
    assert.match(settingsCss, /\.fv-diagnostics-section-body\s*\{[\s\S]*padding-inline:\s*clamp\(8px,\s*1\.15vw,\s*18px\);/);
    assert.match(settingsCss, /\.fv-diagnostics-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*align-items:\s*start;/);
    assert.match(settingsCss, /\.fv-diagnostics-lane\s*\{[\s\S]*align-content:\s*start;/);
    assert.match(settingsCss, /\.fv-support-bundle-preview\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-subtle\);[\s\S]*background:\s*var\(--fvplus-settings-surface-strong\);/);
    assert.match(settingsCss, /\.fv-support-bundle-section-card,[\s\S]*\.fv-support-bundle-redaction-card\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-muted\);/);
    assert.match(settingsCss, /\.fv-support-bundle-section-card\.is-ready \.fv-support-bundle-section-badge\s*\{[\s\S]*color:\s*var\(--fvplus-settings-chip-success\);/);
});
