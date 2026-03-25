import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const vmCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css'
);
const runtimeSharedCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css'
);
const vmPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);

const vmCss = fs.readFileSync(vmCssPath, 'utf8');
const runtimeSharedCss = fs.readFileSync(runtimeSharedCssPath, 'utf8');
const vmPage = fs.readFileSync(vmPagePath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');

test('vm app-name and dropdown spacing contract preserves right-side gutter', () => {
    assert.match(vmCss, /--fvplus-vm-folder-right-gutter:\s*18px/);
    assert.match(vmCss, /--fvplus-vm-folder-outer-reserved-width:\s*88px/);
    assert.match(vmCss, /--fvplus-vm-folder-dropdown-right-margin:\s*10px/);
    assert.match(vmCss, /--fvplus-folder-dropdown-hover-color:\s*#ff9a3c/);
    assert.match(vmCss, /--fvplus-folder-dropdown-hover-bg:\s*rgba\(255,\s*154,\s*60,\s*0\.18\)/);
    assert.match(vmCss, /\.hover div\.folder-preview div:not\(\.folder-preview-row\):not\(\.folder-preview-divider\)\s*\{[\s\S]*visibility:\s*hidden/);
    assert.match(vmCss, /td\.vm-name\.folder-name\s*\{[\s\S]*position:\s*relative/);
    assert.match(vmCss, /td\.vm-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*position:\s*absolute/);
    assert.match(vmCss, /td\.vm-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*left:\s*8px/);
    assert.match(vmCss, /td\.vm-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*right:\s*var\(--fvplus-vm-folder-right-gutter,\s*18px\)/);
    assert.match(vmCss, /td\.vm-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*transform:\s*translateY\(-50%\)/);
    assert.match(vmCss, /\.folder-outer\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-vm-app-column-width\)\s*-\s*var\(--fvplus-vm-folder-outer-reserved-width,\s*88px\)\)/);
    assert.match(vmPage, /runtime\.shared\.css/);
    assert.match(runtimeSharedCss, /\.folder-dropdown\s*\{[\s\S]*margin:\s*0 var\(--fvplus-folder-dropdown-right-margin,\s*16px\) 0 auto/);
    assert.match(runtimeSharedCss, /\.folder-dropdown\s*\{[\s\S]*display:\s*inline-flex/);
    assert.match(runtimeSharedCss, /\.folder-dropdown:hover,\s*[\s\S]*visibility:\s*visible !important/);
    assert.match(runtimeSharedCss, /\.folder-dropdown:hover > i,\s*[\s\S]*opacity:\s*1 !important/);
});

test('vm mobile width contract keeps names visible before truncation and dropdown compact', () => {
    assert.match(vmCss, /@media \(max-width: 980px\)[\s\S]*\.folder-name\s*\{[\s\S]*width:\s*var\(--fvplus-vm-app-column-width-mobile\)/);
    assert.match(vmCss, /@media \(max-width: 980px\)[\s\S]*\.folder-outer\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-vm-app-column-width-mobile\)\s*-\s*72px\)/);
    assert.match(vmCss, /@media \(max-width: 980px\)[\s\S]*td\.vm-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*right:\s*10px/);
    assert.match(vmCss, /@media \(max-width: 980px\)[\s\S]*\.folder-dropdown\s*\{[\s\S]*margin:\s*0 6px 0 auto/);
});

test('vm runtime width scheduler keeps deterministic reflow hooks for name/dropdown alignment', () => {
    assert.match(vmJs, /const VM_RUNTIME_APP_CHROME_WIDTH = 122;/);
    assert.match(vmJs, /const VM_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS = 72;/);
    assert.match(vmJs, /const adjustVmRuntimeAppWidthForRenderedOverflow = \(baseWidth = null\) =>/);
    assert.match(vmJs, /const runVmRuntimeWidthReflow = \(reason = 'direct'\) =>/);
    assert.match(vmJs, /const scheduleVmRuntimeWidthReflow = \(reason = 'event', delayMs = VM_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS\) =>/);
    assert.match(vmJs, /auxSelectors:\s*\['\.folder-state'\]/);
    assert.match(vmJs, /scheduleVmRuntimeWidthReflow\('folder-expand-toggle', 32\)/);
    assert.match(vmJs, /scheduleVmRuntimeWidthReflow\('runtime-prefs', 0\)/);
});
