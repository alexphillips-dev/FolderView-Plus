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
