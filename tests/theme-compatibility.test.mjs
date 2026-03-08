import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');

test('settings page wraps plugin UI in a theme-safe root container', () => {
    assert.match(settingsPage, /<div id="fv-settings-root" class="fv-theme-safe">/);
    assert.match(settingsPage, /<div id="fv-settings-topbar"><\/div>/);
    assert.match(settingsPage, /<div id="fv-settings-action-bar"><\/div>/);
});

test('theme compatibility: global focus and body selectors are scoped to plugin root', () => {
    assert.match(settingsCss, /#fv-settings-root\s*\{\s*[\s\S]*padding-bottom:\s*calc\(64px\s*\+\s*var\(--fv-unraid-bottom-bar-offset\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
    assert.match(settingsCss, /#fv-settings-root button:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root input:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root select:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root textarea:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root a:focus-visible/);
    assert.doesNotMatch(settingsCss, /\nbody\s*\{/);
    assert.doesNotMatch(settingsCss, /\nbutton:focus-visible,\s*\ninput:focus-visible,/);
});
