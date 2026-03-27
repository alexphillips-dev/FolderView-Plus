import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const diagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const settingsSectionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js');
const wizardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js');

test('settings page loads smart-detect config before starter templates and diagnostics modules', () => {
    const configIndex = settingsPage.indexOf('folderviewplus.smart-detect-config.js');
    const templatesIndex = settingsPage.indexOf('folderviewplus.starter-templates.js');
    const diagnosticsIndex = settingsPage.indexOf('folderviewplus.activity-diagnostics.js');
    assert.ok(configIndex >= 0, 'smart-detect config include is missing');
    assert.ok(templatesIndex >= 0, 'starter templates include is missing');
    assert.ok(diagnosticsIndex >= 0, 'activity diagnostics include is missing');
    assert.ok(configIndex < templatesIndex, 'smart-detect config must load before starter templates');
    assert.ok(configIndex < diagnosticsIndex, 'smart-detect config must load before diagnostics');
});

test('settings diagnostics exports client perf and theme telemetry helpers', () => {
    assert.match(diagnosticsJs, /const collectClientPerformanceTelemetry = \(\) =>/);
    assert.match(diagnosticsJs, /const collectFolderEditorDebugDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const renderFolderEditorDebugDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const copyFolderEditorDebugDiagnostics = async \(\) =>/);
    assert.match(diagnosticsJs, /const renderPerformanceDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const renderDiagnosticsSummary = \(diagnostics\) =>/);
    assert.match(diagnosticsJs, /const collectThemeDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const runThemeDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const exportFullDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const exportFullSupportBundle = \(\) =>/);
    assert.match(settingsPage, /id="fv-diagnostics-summary"/);
    assert.match(settingsPage, /id="fv-diagnostics-actions"/);
    assert.doesNotMatch(settingsPage, /id="fv-diagnostics-technical"/);
    assert.doesNotMatch(settingsPage, /id="folder-editor-diagnostics-output"/);
    assert.doesNotMatch(settingsPage, /renderFolderEditorDebugDiagnostics\(\)/);
    assert.doesNotMatch(settingsPage, /copyFolderEditorDebugDiagnostics\(\)/);
    assert.doesNotMatch(settingsPage, /exportFullDiagnostics\(\)/);
    assert.doesNotMatch(settingsPage, /exportFullSupportBundle\(\)/);
    assert.match(diagnosticsJs, /window\.FolderViewPlusDiagnostics = Object\.freeze\(\{/);
    assert.match(diagnosticsJs, /collectClientPerformanceTelemetry/);
    assert.match(diagnosticsJs, /collectFolderEditorDebugDiagnostics/);
    assert.match(diagnosticsJs, /runThemeSelfHeal/);
    assert.doesNotMatch(diagnosticsJs, /cancelButtonText:\s*'Sanitized export'/);
    assert.doesNotMatch(diagnosticsJs, /confirmButtonText:\s*'Full export'/);
});

test('wizard apply path records perf telemetry and settings CSS keeps simplified mobile reorder selectors', () => {
    assert.match(wizardJs, /recordPerformanceDiagnosticsSample\('wizard', 'apply'/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact:is\(\.fv-mobile-tree-reorder-docker, \.fv-mobile-tree-reorder-vm\)/);
    assert.match(settingsCss, /body\.fv-mobile-compact #fv-settings-root:is\(\.fv-mobile-tree-reorder-docker, \.fv-mobile-tree-reorder-vm\)/);
    assert.doesNotMatch(settingsCss, /\.fv-settings-label\s*\{/);
});

test('settings headings keep dedicated orange title accents across dark themes', () => {
    assert.match(settingsCss, /--fvplus-settings-title-accent:\s*#ff9a3c/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fvplus-settings-title-accent:\s*#be6b18/);
    assert.match(settingsCss, /#fv-settings-root h2\[data-fv-section\],[\s\S]*#fv-settings-root \.settings-mini-title,[\s\S]*#fv-settings-root \.rules-header h3,[\s\S]*color:\s*var\(--fvplus-settings-title-accent\) !important;/);
});

test('folder health section uses the simplified summary-card layout', () => {
    assert.match(settingsPage, /Simple folder health snapshot/);
    assert.match(settingsJs, /folder-health-card-headline/);
    assert.match(settingsJs, /folder-health-pill-row/);
    assert.match(settingsJs, /folder-health-filter-row/);
    assert.match(settingsCss, /\.folder-health-card-headline/);
    assert.match(settingsCss, /\.folder-health-pill-row/);
    assert.match(settingsCss, /\.folder-health-filter-row/);
    assert.doesNotMatch(settingsJs, /folder-health-metrics/);
    assert.doesNotMatch(settingsCss, /\.folder-health-metrics/);
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
    assert.match(settingsPage, /<h2 data-fv-section="conflict-inspector" data-fv-advanced="1" data-fv-advanced-group="rules">Conflict inspector<\/h2>/);
    assert.match(settingsPage, /<h2 data-fv-section="bulk-assignment" data-fv-advanced="1" data-fv-advanced-group="automation">Bulk assignment<\/h2>/);
    assert.match(settingsSectionsJs, /const ADVANCED_GROUPS = \['automation', 'rules', 'recovery', 'operations', 'diagnostics'\];/);
    assert.match(settingsSectionsJs, /rules:\s*'Rules'/);
    assert.match(settingsSectionsJs, /'auto-assignment':\s*'rules'/);
    assert.match(settingsSectionsJs, /'conflict-inspector':\s*'rules'/);
    assert.match(settingsSectionsJs, /rules:\s*Object\.freeze\(\[\]\)/);
    const autoAssignmentIndex = settingsPage.indexOf('<h2 data-fv-section="auto-assignment" data-fv-advanced="1" data-fv-advanced-group="rules">Auto-assignment rules</h2>');
    const conflictInspectorIndex = settingsPage.indexOf('<h2 data-fv-section="conflict-inspector" data-fv-advanced="1" data-fv-advanced-group="rules">Conflict inspector</h2>');
    const bulkAssignmentIndex = settingsPage.indexOf('<h2 data-fv-section="bulk-assignment" data-fv-advanced="1" data-fv-advanced-group="automation">Bulk assignment</h2>');
    assert.ok(autoAssignmentIndex >= 0, 'auto-assignment section should be present');
    assert.ok(conflictInspectorIndex > autoAssignmentIndex, 'conflict inspector should render after auto-assignment within the Rules tab');
    assert.ok(bulkAssignmentIndex > conflictInspectorIndex, 'bulk assignment should remain after the Rules sections');
});

test('bulk assignment returns to a two-column desktop layout while conflict inspector keeps inset module width', () => {
    assert.match(settingsPage, /<h2 data-fv-section="conflict-inspector" data-fv-advanced="1" data-fv-advanced-group="rules">Conflict inspector<\/h2>\s*<div class="rules-bottom-grid">/);
    assert.match(settingsCss, /@media \(min-width: 1080px\) \{\s*\.bulk-assign-grid \{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\) !important;/);
    assert.doesNotMatch(settingsCss, /@media \(min-width: 1080px\) \{[\s\S]*\.bulk-assign-grid,\s*\.backup-grid,\s*\.template-grid \{\s*grid-template-columns:\s*minmax\(0,\s*1fr\) !important;/);
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
    assert.match(settingsCss, /\.bulk-stage\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.018\);/);
    assert.match(settingsCss, /\.bulk-result-actions\.is-hidden\s*\{[\s\S]*display:\s*none !important;/);
});
