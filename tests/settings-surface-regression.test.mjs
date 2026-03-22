import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const diagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
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
    assert.match(diagnosticsJs, /const renderPerformanceDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const collectThemeDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /const runThemeDiagnostics = \(\) =>/);
    assert.match(diagnosticsJs, /window\.FolderViewPlusDiagnostics = Object\.freeze\(\{/);
    assert.match(diagnosticsJs, /collectClientPerformanceTelemetry/);
    assert.match(diagnosticsJs, /runThemeSelfHeal/);
});

test('wizard apply path records perf telemetry and settings CSS keeps simplified mobile reorder selectors', () => {
    assert.match(wizardJs, /recordPerformanceDiagnosticsSample\('wizard', 'apply'/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact:is\(\.fv-mobile-tree-reorder-docker, \.fv-mobile-tree-reorder-vm\)/);
    assert.match(settingsCss, /body\.fv-mobile-compact #fv-settings-root:is\(\.fv-mobile-tree-reorder-docker, \.fv-mobile-tree-reorder-vm\)/);
    assert.doesNotMatch(settingsCss, /\.fv-settings-label\s*\{/);
});
