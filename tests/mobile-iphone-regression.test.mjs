import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
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
    assert.match(settingsCss, /fv-mobile-tree-reorder-docker/);
    assert.match(settingsCss, /fv-mobile-tree-reorder-vm/);
    assert.match(settingsCss, /tbody#docker td:nth-child\(1\)/);
    assert.match(settingsCss, /tbody#vms td:nth-child\(1\)/);
    assert.match(settingsCss, /tbody#docker \.row-order-actions/);
    assert.match(settingsCss, /tbody#vms \.row-order-actions/);
    assert.match(settingsJs, /let mobileTreeReorderModeByType = \{/);
    assert.match(settingsJs, /const toggleMobileTreeReorderMode = \(type\) =>/);
    assert.match(settingsJs, /window\.toggleMobileTreeReorderMode = toggleMobileTreeReorderMode;/);
});

test('quick-actions modal remains iPhone safe-area bounded and scroll-safe', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*left:\s*calc\(env\(safe-area-inset-left\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*right:\s*calc\(env\(safe-area-inset-right\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*top:\s*calc\(env\(safe-area-inset-top\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*bottom:\s*calc\(env\(safe-area-inset-bottom\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*overflow-y:\s*auto !important/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*-webkit-overflow-scrolling:\s*touch/);
    assert.match(settingsJs, /\$\('\.sweet-alert'\)\.removeClass\('fv-row-quick-actions-modal'\);/);
    assert.match(settingsJs, /\$\('\.sweet-alert:visible'\)\.addClass\('fv-row-quick-actions-modal'\);/);
});
