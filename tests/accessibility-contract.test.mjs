import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pluginRoot = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');

test('Dashboard folder headers are one keyboard-operable disclosure surface', () => {
    const source = read('scripts/dashboard.js');
    assert.match(source, /role="button" tabindex="0" data-fv-dashboard-folder-toggle/);
    assert.match(source, /aria-expanded="false" aria-controls="folder-showcase-docker-\$\{id\}"/);
    assert.match(source, /aria-expanded="false" aria-controls="folder-showcase-vm-\$\{id\}"/);
    assert.match(source, /alt="" aria-hidden="true"/);
    assert.match(source, /click\.fvDashboardFolderToggle/);
    assert.match(source, /keydown\.fvDashboardFolderToggle/);
    assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
    assert.doesNotMatch(source, /onclick='expandFolder(?:Docker|VM)\(/);
});

test('Dashboard disclosures retain a visible keyboard focus state without button override debt', () => {
    const css = read('styles/dashboard.css');
    assert.match(css, /span\.outer\[data-fv-dashboard-folder-toggle\]:focus-visible\s*\{[\s\S]*outline:\s*2px solid/);
    assert.doesNotMatch(css, /\.fv-dashboard-expand-toggle-btn\s*\{[\s\S]{0,800}!important/);
});

test('shared UI primitives expose focus and reduced-motion behavior', () => {
    const css = read('styles/ui.primitives.css');
    const ui = read('scripts/folderviewplus.ui.js');
    assert.match(css, /\.fv-ui-disclosure > summary:focus-visible/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /\.fv-ui-spinner \{ animation: none; \}/);
    assert.match(ui, /role="dialog" aria-modal="true" aria-labelledby=/);
    assert.match(ui, /role="status" aria-live="polite"/);
});
