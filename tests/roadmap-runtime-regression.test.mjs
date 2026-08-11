import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';

test('preview overflow, row separators, and per-member visibility are persisted across every layer', () => {
    const page = read(`${plugin}/Folder.page`);
    const editor = read(`${plugin}/scripts/folder.js`);
    const shared = read(`${plugin}/scripts/docker.runtime.shared.js`);
    const server = read(`${plugin}/server/lib.php`);
    const css = read(`${plugin}/styles/docker.css`);

    assert.match(page, /name="preview_overflow"/);
    assert.match(page, /name="preview_row_separator"/);
    assert.match(page, /Show in preview/);
    assert.match(editor, /preview_overflow:/);
    assert.match(editor, /preview_row_separator:/);
    assert.match(shared, /const normalizeFolderPreviewOverflow/);
    assert.match(shared, /folder-preview-row-separator/);
    assert.match(server, /preview_row_separator/);
    assert.match(css, /\.folder-preview\.fv-preview-overflow-scroll/);
});

test('expanded privacy preferences normalize, render, and apply without destructive text replacement', () => {
    const settings = read(`${plugin}/FolderViewPlus.page`);
    const prefs = read(`${plugin}/server/lib.prefs.php`);
    const privacy = read(`${plugin}/scripts/runtime.privacy.js`);
    const docker = read(`${plugin}/scripts/docker.js`);
    const vmRuntime = read(`${plugin}/scripts/vm.js`);

    for (const key of ['privacyMaskVolumePaths', 'privacyMaskImageRegistry', 'privacyMaskVmDiskPaths', 'privacyMaskMacAddresses', 'privacyMaskPublicIps', 'privacyMaskInterfaces', 'privacyMaskExternalUrls']) {
        assert.match(prefs, new RegExp(key));
        assert.match(settings, new RegExp(key));
    }
    assert.match(privacy, /MutationObserver/);
    assert.doesNotMatch(privacy, /node\.nodeValue\s*=/);
    assert.match(docker, /FolderViewPlusRuntimePrivacy\?\.apply\('docker'/);
    assert.match(vmRuntime, /FolderViewPlusRuntimePrivacy\?\.apply\('vm'/);
});

test('privacy classifier distinguishes public and private IP values', () => {
    const source = read(`${plugin}/scripts/runtime.privacy.js`);
    const window = { setTimeout, requestAnimationFrame: (callback) => callback() };
    const document = { readyState: 'loading', addEventListener() {}, body: null };
    const context = { window, document, URL, Element: class {}, NodeFilter: {}, MutationObserver: class {} };
    vm.runInNewContext(source, context);
    const api = window.FolderViewPlusRuntimePrivacy;
    assert.equal(api.isPublicIpv4('8.8.8.8'), true);
    assert.equal(api.isPublicIpv4('10.0.0.4'), false);
    assert.equal(api.isPublicIpv4('172.20.1.2'), false);
    assert.equal(api.isPublicIpv4('192.168.1.9'), false);
    assert.equal(api.isPublicIpv6('2606:4700:4700::1111'), true);
    assert.equal(api.isPublicIpv6('fd00::1'), false);
    assert.equal(api.isPublicIpv6('fe80::1'), false);
    assert.equal(api.isPublicIpv6('::1'), false);
    assert.equal(api.isPublicIpv6('2001:db8::1'), false);
    assert.deepEqual(Array.from(api.categoriesForText('/mnt/user/media/movie.mkv')), ['volumePaths']);
    assert.deepEqual(Array.from(api.categoriesForText('fd00::1')), []);
    assert.deepEqual(Array.from(api.categoriesForText('2606:4700:4700::1111')), ['publicIps']);
});

test('runtime transport exposes capability-driven GraphQL, subscription, action, and diagnostics APIs', () => {
    const source = read(`${plugin}/scripts/runtime.transport.js`);
    const window = { fetch() {}, setInterval, clearInterval };
    vm.runInNewContext(source, { window, URL, Date, JSON, Promise, Error, Object, String, Number, Array, Math, setInterval, clearInterval });
    const transport = window.FolderViewPlusRuntimeTransport;
    assert.equal(typeof transport.query, 'function');
    assert.equal(typeof transport.subscribe, 'function');
    assert.equal(typeof transport.runDockerAction, 'function');
    assert.equal(transport.capabilities().graphql, true);
    assert.equal(transport.capabilities().websocket, false);
});

test('Dashboard chart assets are loaded only when an advanced preview needs them', () => {
    const page = read(`${plugin}/folderview.plus.Dashboard.page`);
    const pageBootstrap = read(`${plugin}/scripts/folderviewplus.page-bootstrap.js`);
    const loader = read(`${plugin}/scripts/runtime.asset-loader.js`);
    const preview = read(`${plugin}/scripts/dashboard.advanced-preview.js`);
    assert.match(page, /emitJsonBootstrapMeta\('fvplus-page-data'/);
    assert.match(pageBootstrap, /win\.FolderViewPlusAssetUrls = Object\.freeze/);
    assert.match(page, /runtime\.asset-loader\.js/);
    assert.doesNotMatch(page, /<script src="<\?php fvplus_asset\('\/plugins\/folderview\.plus\/scripts\/include\/chart\.min\.js/);
    assert.match(loader, /const ensureChartStack/);
    assert.match(preview, /FolderViewPlusAssetLoader\?\.ensureChartStack/);
});

test('Dashboard adds and normalizes the Embossed layout and status color locking', () => {
    const settings = read(`${plugin}/FolderViewPlus.page`);
    const utils = read(`${plugin}/scripts/folderviewplus.utils.js`);
    const dashboardCss = read(`${plugin}/styles/dashboard.css`);
    const folderPage = read(`${plugin}/Folder.page`);
    const runtime = read(`${plugin}/scripts/docker.runtime.shared.js`);
    assert.match(settings, /option value="embossed"[^>]*>Embossed/);
    assert.match(utils, /embossed: 'Embossed'/);
    assert.match(dashboardCss, /fv-dashboard-layout-embossed/);
    assert.match(folderPage, /name="status_color_lock"/);
    assert.match(runtime, /locked \? 'important' : ''/);
});
