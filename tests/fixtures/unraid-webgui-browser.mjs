import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const root = process.argv[2];
assert.match(root, /^\/tmp\/fvplus-webgui-test\.[A-Za-z0-9]{8}\/root$/);
assert.equal(fs.realpathSync(root), root);
assert.equal(fs.readFileSync(path.join(root, 'etc/unraid-version'), 'utf8'), 'version="7.4.0"\n');
assert.match(execFileSync('ip', ['-o', 'link', 'show'], { encoding: 'utf8' }).trim(), /^1: lo:[^\n]*$/);
assert.ok(fs.readFileSync(path.join(root, 'var/local/emhttp/var.ini'), 'utf8').includes('fvplus-isolated-webgui-token'));

const origin = 'http://127.0.0.1:18470';
const plugin = path.join(root, 'usr/local/emhttp/plugins/folderview.plus');
const config = path.join(root, 'boot/config/plugins/folderview.plus');
const bootManifest = path.join(root, 'boot/config/plugins/folderview.plus.plg');
const orderFile = path.join(root, 'boot/config/plugins/dockerMan/userprefs.cfg');
const autostartFile = path.join(root, 'var/lib/docker/unraid-autostart');
const manifest = fs.readFileSync(path.join(repo, 'folderview.plus.plg'), 'utf8');
const version = manifest.match(/^<!ENTITY version "([^"]+)">/m)?.[1];
assert.ok(version);

const dockerMembers = ['app-a', 'app-b', 'app-d', 'tool-c'];
const vmMembers = ['Debian 12', 'Home Assistant', 'Windows 11'];
const fixtureContainer = JSON.parse(fs.readFileSync(path.join(root, 'fixture/fixtures/docker.json'), 'utf8')).inspect['app-a'];
const originalOrder = fs.readFileSync(orderFile, 'utf8');
const readOrder = () => [...fs.readFileSync(orderFile, 'utf8').matchAll(/^\d+="([^"]+)"$/gm)].map(match => match[1]);
const emptyOrder = fs.readFileSync(autostartFile, 'utf8');
const shell = (command) => execFileSync('chroot', [
    root, '/usr/bin/env', '-i', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LD_LIBRARY_PATH=/fixture/php', ...command
], { encoding: 'utf8', timeout: 15000 });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1320, height: 900 } });
const page = await context.newPage();
const errors = [];
const runtimeRequests = [];
page.on('pageerror', error => errors.push({ page: new URL(page.url()).pathname, error: error.toString() }));
page.on('response', response => {
    const { pathname } = new URL(response.url());
    if (response.request().resourceType() === 'xhr' || pathname.includes('/server/')) {
        runtimeRequests.push(`${response.status()} ${pathname}`);
    }
});
const waitText = async (selector, value) => page.locator(selector)
    .filter({ hasText: value }).first().waitFor({ state: 'attached', timeout: 20000 });
const open = async (tab) => {
    const response = await page.goto(`${origin}/${tab}`);
    assert.equal(response?.status(), 200, `${tab} must be served by the native webGUI`);
};
const stockRows = async () => {
    await open('Docker');
    for (const name of dockerMembers) await waitText('#docker_list .appname', name);
    assert.ok(await page.locator('#docker_containers').count());
    assert.deepEqual((await page.locator('#docker_list .appname').allTextContents()).map(name => name.trim()), readOrder().filter(name => dockerMembers.includes(name)));
    await open('VMs');
    for (const name of vmMembers) await waitText('#kvm_list tr', name);
    await open('Dashboard');
    for (const name of dockerMembers) await waitText('#docker_view tr', name);
    for (const name of vmMembers) await waitText('#vm_view tr', name);
};

try {
    await stockRows();
    assert.equal(await page.locator('script[src*="/plugins/folderview.plus/"]').count(), 0);
    assert.equal(fs.readFileSync(orderFile, 'utf8'), originalOrder);
    console.log('PASS stock Unraid 7.4.0 Docker, VM, and Dashboard rows');

    fs.cpSync(path.join(repo, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus'), plugin, { recursive: true });
    fs.mkdirSync(config);
    fs.writeFileSync(path.join(config, 'version'), `${version}\n`);
    const folder = (name, containers, parentId = '') => ({
        name, icon: '', regex: '', containers, parentId, settings: { preview: 1, context: 2, context_trigger: 0 }, actions: []
    });
    fs.writeFileSync(path.join(config, 'docker.json'), JSON.stringify({
        'fixture-media': folder('Fixture Media', ['app-a']),
        'fixture-child': folder('Fixture Child', ['app-b'], 'fixture-media')
    }));
    fs.writeFileSync(path.join(config, 'vm.json'), JSON.stringify({ 'fixture-lab': folder('Fixture Lab', ['Debian 12']) }));
    fs.writeFileSync(path.join(config, 'docker.prefs.json'), JSON.stringify({
        setupWizardCompleted: true, pageViewMode: 'folderview', dockerStartOrder: { mode: 'unmanaged' }
    }));
    fs.writeFileSync(path.join(config, 'vm.prefs.json'), JSON.stringify({
        setupWizardCompleted: true, pageViewMode: 'folderview'
    }));

    await open('Docker');
    await waitText('#docker_list tr.folder', 'Fixture Media');
    assert.ok(await page.locator('#docker_containers').count());
    await page.locator(`#folder-preview-${fixtureContainer.Id.slice(0, 12)}`).first().click();
    const details = page.locator('.fv-runtime-preview-summary');
    await details.waitFor();
    assert.equal(await details.evaluate(node => node.open), false);
    assert.ok(!runtimeRequests.some(request => request.endsWith('/docker_runtime_preview.php')));
    const summaryResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/docker_runtime_preview.php'));
    await details.locator('summary').click();
    const response = await summaryResponse;
    assert.equal(response.status(), 200);
    assert.equal(await response.request().headerValue('X-FV-Container'), fixtureContainer.Id);
    const { summary } = await response.json();
    assert.deepEqual(summary, {
        composeProject: 'fixture-project', composeService: 'fixture-service', restartPolicy: 'no', networkMode: 'bridge',
        environment: [{ name: 'FIXTURE_MODE', overridden: true }, { name: 'PATH', overridden: false }]
    });
    await details.getByText('fixture-project', { exact: true }).waitFor();
    await details.getByText('Overridden', { exact: true }).waitFor();
    assert.doesNotMatch(await response.text(), /synthetic-(runtime|image)-value/);
    console.log('PASS native Docker runtime preview reads only sanitized Compose and environment-name details on demand');
    await open('VMs');
    await waitText('#kvm_list tr.folder', 'Fixture Lab');
    const vmSnapshot = url => url.pathname.endsWith('/runtime_snapshot.php')
        && url.searchParams.get('type') === 'vm' && url.searchParams.get('mode') === 'full';
    const release = Promise.withResolvers();
    await page.route(vmSnapshot, async route => {
        await release.promise;
        await route.continue();
    });
    try {
        await Promise.all([page.waitForRequest(request => vmSnapshot(new URL(request.url()))), open('Dashboard')]);
        await waitText('#docker_view', 'Fixture Media');
        assert.equal(await page.getByText('Fixture Lab', { exact: true }).count(), 0);
        await waitText('#vm_view', 'Debian 12');
    } finally {
        release.resolve();
    }
    await waitText('#vm_view', 'Fixture Lab');
    await page.unrouteAll({ behavior: 'wait' });
    console.log('PASS Plus folder projection in native Docker and VM pages and independent Dashboard tile startup');

    await open('Docker');
    await waitText('#docker_list tr.folder', 'Fixture Media');
    assert.equal(fs.readFileSync(orderFile, 'utf8'), originalOrder);
    await page.locator('[data-fvplus-docker-menu="tools"]').click();
    await page.locator('[data-fvplus-docker-tool="save-native-order"]').click();
    const preview = page.locator('.fvplus-native-order-name');
    await preview.first().waitFor();
    const names = await preview.allTextContents();
    assert.deepEqual([...names].sort(), dockerMembers);
    assert.equal(fs.readFileSync(orderFile, 'utf8'), originalOrder);
    const write = page.waitForResponse(response => response.url().endsWith('/UserPrefs.php') && response.request().method() === 'POST');
    await page.locator('[data-fv-ui-action="modal-confirm"]').click();
    assert.equal((await write).status(), 200);
    await page.getByText('The order of the containers was saved', { exact: true }).waitFor();
    const savedOrder = fs.readFileSync(orderFile, 'utf8');
    assert.notEqual(savedOrder, originalOrder);
    assert.ok(readOrder().includes('folder-fixture-media'));
    assert.ok(readOrder().includes('folder-fixture-child'));
    assert.deepEqual(readOrder().filter(name => dockerMembers.includes(name)), names);
    const savedAutostart = fs.readFileSync(autostartFile, 'utf8');
    assert.deepEqual(savedAutostart.trim().split('\n').map(line => line.split(' ')[0]), names.filter(name => ['app-a', 'app-d'].includes(name)));
    assert.deepEqual(savedAutostart.trim().split('\n').sort(), emptyOrder.trim().split('\n').sort());
    await page.reload();
    await waitText('#docker_list tr.folder', 'Fixture Media');
    assert.equal(fs.readFileSync(orderFile, 'utf8'), savedOrder);
    console.log('PASS Plus preview, native UserPrefs save, autostart, and reload');

    await page.goto('about:blank');
    fs.writeFileSync(bootManifest, manifest);
    fs.symlinkSync('/boot/config/plugins/folderview.plus.plg', path.join(root, 'var/log/plugins/folderview.plus.plg'));
    shell(['php', '-d', 'short_open_tag=1', '/usr/local/emhttp/plugins/dynamix.plugin.manager/scripts/plugin', 'remove', 'folderview.plus.plg']);
    assert.throws(() => fs.statSync(plugin), { code: 'ENOENT' });
    assert.throws(() => fs.statSync(config), { code: 'ENOENT' });
    assert.throws(() => fs.statSync(bootManifest), { code: 'ENOENT' });
    assert.equal(fs.readFileSync(path.join(root, 'var/log/fvplus-package-removal.log'), 'utf8'), `folderview.plus-${version}\n`);
    await stockRows();
    assert.equal(fs.readFileSync(orderFile, 'utf8'), savedOrder);
    assert.equal(fs.readFileSync(autostartFile, 'utf8'), savedAutostart);
    const unexpectedErrors = errors.filter(({ page, error }) =>
        page !== '/Dashboard' || error !== 'ReferenceError: cpuPowerSubscription is not defined');
    assert.deepEqual(unexpectedErrors, []);
    console.log('PASS native order and autostart survive Plus uninstall');
    if (errors.length) console.log('Stock Dashboard CPU telemetry service is absent from the synthetic host');
} catch (error) {
    console.error('Fixture page errors:', errors);
    console.error('Recent fixture requests:', runtimeRequests.slice(-35));
    console.error('Runtime preflight:', await page.locator('meta[name="fvplus-runtime-preflight"]').evaluateAll(entries => entries.map(entry => entry.content)));
    console.error('Current fixture page:', page.url(), await page.locator('#kvm_list tr, #docker_list tr').evaluateAll(rows => rows.map(row => ({
        className: row.className, name: row.querySelector('.vm-name')?.textContent?.trim()
    }))));
    throw error;
} finally {
    await browser.close();
}
