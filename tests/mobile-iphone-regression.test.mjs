import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsScriptPaths = [
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
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const settingsJs = settingsScriptPaths.map((scriptPath) => fs.readFileSync(scriptPath, 'utf8')).join('\n');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');

test('settings runtime keeps iPhone/mobile compact-layout detection wired', () => {
    assert.match(settingsJs, /const MOBILE_LAYOUT_BREAKPOINT_PX = 1100;/);
    assert.match(settingsJs, /const MOBILE_LAYOUT_COARSE_BREAKPOINT_PX = 1600;/);
    assert.match(settingsJs, /android\|iphone\|ipod\|ipad\|mobile\|windows phone/i);
    assert.match(settingsJs, /const shouldUseCompactMobileLayout = \(\) =>/);
    assert.match(settingsJs, /root\.classList\.toggle\('fv-mobile-compact', enabled\)/);
    assert.match(settingsJs, /document\.body\.classList\.toggle\('fv-mobile-compact', enabled\)/);
});

test('settings stylesheet keeps iPhone/touch control chrome reset guard', () => {
    assert.match(settingsCss, /@media \(hover: none\), \(pointer: coarse\)/);
    assert.match(settingsCss, /#fv-settings-root \.row-order-actions button/);
    assert.match(settingsCss, /#fv-settings-root \.folder-action-btn/);
    assert.match(settingsCss, /#fv-settings-root \.folder-overflow-btn/);
    assert.match(settingsCss, /#fv-settings-root \.folder-tree-toggle/);
    assert.match(settingsCss, /-webkit-appearance:\s*none !important/);
    assert.match(settingsCss, /appearance:\s*none !important/);
    assert.match(settingsCss, /background-image:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root \.folder-tree-toggle::before/);
    assert.match(settingsCss, /#fv-settings-root \.folder-tree-toggle::after/);
    assert.match(settingsCss, /content:\s*none !important/);
});

test('mobile compact mode keeps optional tree reorder controls and path hints for narrow screens', () => {
    assert.match(settingsCss, /\.fv-tree-path-hint/);
    assert.match(settingsCss, /\.tree-management-controls > button\.is-active/);
    assert.match(settingsCss, /\.fv-mobile-tree-reorder-docker/);
    assert.match(settingsCss, /\.fv-mobile-tree-reorder-vm/);
    assert.match(settingsCss, /\.fv-mobile-tree-reorder-docker tbody#docker td:nth-child\(1\)/);
    assert.match(settingsCss, /\.fv-mobile-tree-reorder-vm tbody#vms td:nth-child\(1\)/);
    assert.doesNotMatch(settingsCss, /:is\(tbody#docker, tbody#vms\)/);
    assert.match(settingsCss, /\.fv-mobile-tree-reorder-docker tbody#docker \.row-order-actions/);
    assert.match(settingsCss, /\.fv-mobile-tree-reorder-vm tbody#vms \.row-order-actions/);
    assert.match(settingsJs, /let mobileTreeReorderModeByType = \{/);
    assert.match(settingsJs, /const toggleMobileTreeReorderMode = \(type\) =>/);
    assert.match(settingsJs, /class="folder-tree-action fv-mobile-reorder-step"[\s\S]*moveFolderRow\('\$\{type\}','\$\{escapeHtml\(id\)\}',-1\)/);
    assert.match(settingsJs, /class="folder-tree-action fv-mobile-reorder-step"[\s\S]*moveFolderRow\('\$\{type\}','\$\{escapeHtml\(id\)\}',1\)/);
    assert.match(settingsJs, /registerActions\(window,\s*\{[\s\S]*toggleMobileTreeReorderMode/);
});

test('folder action sheet remains iPhone safe-area bounded and scroll-safe', () => {
    assert.match(settingsCss, /@media \(max-width: 620px\)/);
    assert.match(settingsCss, /\.fv-folder-action-sheet-backdrop[\s\S]*padding:[\s\S]*env\(safe-area-inset-top\)[\s\S]*env\(safe-area-inset-right\)[\s\S]*env\(safe-area-inset-bottom\)[\s\S]*env\(safe-area-inset-left\)/);
    assert.match(settingsCss, /\.fv-folder-action-sheet-body[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;[\s\S]*-webkit-overflow-scrolling:\s*touch/);
    assert.match(settingsJs, /const closeFolderActionSheet = \(\{ restoreFocus = true \} = \{\}\) =>/);
    assert.match(settingsJs, /if \(event\.key === 'Escape'\)/);
    assert.match(settingsJs, /if \(event\.key !== 'Tab'\)/);
});
