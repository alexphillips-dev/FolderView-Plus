import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);
const folderJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const dockerCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'
);
const vmCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css'
);
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const settingsWizardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js'
);
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');
const folderJs = fs.readFileSync(folderJsPath, 'utf8');
const dockerCss = fs.readFileSync(dockerCssPath, 'utf8');
const vmCss = fs.readFileSync(vmCssPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const settingsWizardJs = fs.readFileSync(settingsWizardJsPath, 'utf8');
const settingsRuntime = `${settingsJs}\n${settingsWizardJs}`;
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');

test('docker runtime includes touch-mode detection and avoids hover-only trigger on touch', () => {
    assert.match(dockerJs, /const FOLDER_VIEW_TOUCH_MODE = \(\(\) =>/);
    assert.match(dockerJs, /folder\.settings\.preview_hover && !FOLDER_VIEW_TOUCH_MODE/);
    assert.match(dockerJs, /context_trigger === 1 && !FOLDER_VIEW_TOUCH_MODE \? 'hover' : 'click'/);
});

test('vm runtime includes touch-mode detection and avoids hover-only preview on touch', () => {
    assert.match(vmJs, /const FV_VM_TOUCH_MODE = \(\(\) =>/);
    assert.match(vmJs, /folder\.settings\.preview_hover && !FV_VM_TOUCH_MODE/);
});

test('folder editor binds outside-click close handler for pointer and touch events', () => {
    assert.match(folderJs, /pointerdown\.fviconpicker/);
    assert.match(folderJs, /touchstart\.fviconpicker/);
});

test('docker and vm styles include responsive touch/mobile fallbacks', () => {
    assert.match(dockerCss, /@media \(hover: none\), \(pointer: coarse\)/);
    assert.match(dockerCss, /@media \(max-width: 980px\)/);
    assert.match(vmCss, /@media \(hover: none\), \(pointer: coarse\)/);
    assert.match(vmCss, /@media \(max-width: 980px\)/);
});

test('settings advanced sections include mobile-safe expand/collapse handlers', () => {
    assert.match(settingsJs, /const shouldUseMobileSectionToggle = \(\) =>/);
    assert.match(settingsJs, /const toggleAdvancedSectionByKey = \(sectionKey\) =>/);
    assert.match(settingsJs, /click\.fvsectionheader/);
    assert.match(settingsJs, /h2\[data-fv-section\]\[data-fv-advanced="1"\]/);
    assert.match(settingsRuntime, /mobileSidebarSummaryOpen/);
    assert.match(settingsRuntime, /fv-setup-sidebar-toggle/);
});

test('settings styles include responsive advanced accordion controls on mobile', () => {
    assert.match(settingsCss, /\.fv-section-toggle::before/);
    assert.match(settingsCss, /\.fv-section-toggle\.is-collapsed::before/);
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /h2\[data-fv-section\]\[data-fv-advanced="1"\]/);
    assert.match(settingsCss, /\.fv-advanced-tabs/);
    assert.match(settingsCss, /\.fv-settings-search-wrap/);
    assert.match(settingsCss, /\.fv-setup-sidebar-toggle/);
    assert.match(settingsCss, /\[data-fv-mobile-summary-open="0"\] \.fv-setup-sidebar-summary/);
});
