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

const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');
const folderJs = fs.readFileSync(folderJsPath, 'utf8');
const dockerCss = fs.readFileSync(dockerCssPath, 'utf8');
const vmCss = fs.readFileSync(vmCssPath, 'utf8');

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
