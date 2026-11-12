import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const bootstrap = fs.readFileSync(`${root}/scripts/folderviewplus.page-bootstrap.js`, 'utf8');
test('editor Aurora heading marker is gated by page context and detected assets', () => {
    for (const page of ['Folder Editor', 'Docker', 'Settings', 'VMs']) {
        for (const detected of [false, true]) {
            const classes = new Set();
            const document = { querySelector: selector => selector.includes('fvplus-runtime-context')
                ? { content: JSON.stringify({ page }) } : null,
                documentElement: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } } };
            vm.runInNewContext(bootstrap, { window: { document,
                FolderViewPlusFoundationModules: { themeIntegration: { readAuroraEnvironment: () => ({ detected }) } } } });
            assert.equal(classes.has('fvplus-editor-hide-aurora-heading'), page === 'Folder Editor' && detected);
            assert.equal(classes.has('fvplus-docker-hide-aurora-heading'), page === 'Docker' && detected);
        }
    }
});
test('editor heading suppression loads before its bootstrap without hiding its native title', () => {
    const page = fs.readFileSync(`${root}/Folder.page`, 'utf8');
    const css = fs.readFileSync(`${root}/styles/folder.header.css`, 'utf8');
    const style = page.match(/<link[^>]*folder\.header\.css[^>]*>/)?.[0] || '';
    assert.ok(style);
    assert.doesNotMatch(style, /media="not all"|data-fvplus-docker-legacy-style/);
    assert.ok(page.indexOf('/styles/folder.header.css') < page.indexOf('/scripts/folderviewplus.theme-integration.js'));
    assert.ok(page.indexOf('/scripts/folderviewplus.theme-integration.js') < page.indexOf('/scripts/folderviewplus.page-bootstrap.js'));
    assert.equal(page.split('/scripts/folderviewplus.theme-integration.js').length - 1, 1);
    assert.match(css, /html\.fvplus-editor-hide-aurora-heading #displaybox > \.tp-heading\s*\{\s*display: none;/);
    assert.doesNotMatch(css, /\.title|h1|h2|fvEditorChrome/);
});
