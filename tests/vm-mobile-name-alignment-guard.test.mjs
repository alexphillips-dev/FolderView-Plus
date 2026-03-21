import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const vmCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);

const vmCss = fs.readFileSync(vmCssPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');

test('vm app-name and dropdown spacing contract preserves right-side gutter', () => {
    assert.match(vmCss, /--fvplus-vm-folder-right-gutter:\s*18px/);
    assert.match(vmCss, /--fvplus-vm-folder-outer-reserved-width:\s*88px/);
    assert.match(vmCss, /--fvplus-vm-folder-dropdown-right-margin:\s*10px/);
    assert.match(vmCss, /td\.vm-name\.folder-name > \.folder-name-sub\s*\{[\s\S]*right:\s*var\(--fvplus-vm-folder-right-gutter,\s*18px\)/);
    assert.match(vmCss, /\.folder-outer\s*\{[\s\S]*max-width:\s*calc\(var\(--fvplus-vm-app-column-width\)\s*-\s*var\(--fvplus-vm-folder-outer-reserved-width,\s*88px\)\)/);
    assert.match(vmCss, /\.folder-dropdown\s*\{[\s\S]*width:\s*16px/);
    assert.match(vmCss, /\.folder-dropdown\s*\{[\s\S]*margin:\s*0 var\(--fvplus-vm-folder-dropdown-right-margin,\s*10px\) 0 auto/);
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
    assert.match(vmJs, /scheduleVmRuntimeWidthReflow\('folder-expand-toggle', 32\)/);
    assert.match(vmJs, /scheduleVmRuntimeWidthReflow\('runtime-prefs', 0\)/);
});

