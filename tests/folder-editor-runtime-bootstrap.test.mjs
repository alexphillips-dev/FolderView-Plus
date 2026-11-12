import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.runtime-bootstrap.js', 'utf8');
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const createBoot = ({ preloadSupport = true, rejectPreload = false } = {}) => {
    const scripts = [], links = [], reports = [], timers = new Map();
    let now = 0, timerId = 0, retry;
    const window = {
        FolderViewPlusFolderEditorPageBuildVersion: 'fixture-version',
        FolderViewPlusReportFolderEditorBootstrap: report => reports.push(report),
        FolderViewPlusFatalBanner: { registerRecoveryHandler: (_name, handler) => { retry = handler; } },
        setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
        clearTimeout: id => timers.delete(id)
    };
    const document = {
        readyState: 'complete', querySelectorAll: () => [...scripts, ...links].filter(node => !node.removed),
        createElement: () => ({ dataset: {}, relList: { supports: () => preloadSupport }, remove() { this.removed = true; } }),
        head: { appendChild: link => { if (rejectPreload) throw Error('Resource hints unavailable'); links.push(link); } },
        body: { appendChild: script => scripts.push(script) }
    };
    vm.runInNewContext(source, { window, document, console });
    return { window, scripts, links, reports, retry: () => retry(),
        async advance(milliseconds) {
            now += milliseconds;
            for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
            await flush();
        },
        async finish(marker = true) {
            for (let index = 0; index < 20; index++) {
                await flush();
                const script = scripts.at(-1);
                if (script.id && marker) window.FolderViewPlusFolderEditorRuntimeLoaded = true;
                script.onload();
            }
            await flush();
        }
    };
};

test('healthy sequential editor loading can exceed old warning deadlines without a boot incident', async () => {
    const boot = createBoot();
    await flush();
    await boot.advance(3000);
    assert.deepEqual(boot.reports, []);
    await boot.finish();
    assert.deepEqual(boot.reports, []);
    assert.equal(boot.scripts.length, 20);
    for (const script of boot.scripts) assert.match(script.src, /\?v=fixture-version$/);
});

test('editor resources preload together while execution still advances one script at a time', async () => {
    const boot = createBoot();
    await flush();
    assert.equal(boot.links.length, 20);
    assert.equal(boot.scripts.length, 1);
    for (const link of boot.links) {
        assert.equal(link.rel, 'preload');
        assert.equal(link.as, 'script');
        assert.equal(link.removed, undefined);
    }
    assert.equal(boot.links[0].href, boot.scripts[0].src);
    boot.scripts[0].onload();
    await flush();
    assert.equal(boot.scripts.length, 2);
    assert.equal(boot.links[1].href, boot.scripts[1].src);
});

test('successful editor loading removes resource hints and preserves exact script URL order', async () => {
    const boot = createBoot();
    await boot.finish();
    assert.deepEqual(boot.scripts.map(script => script.src), boot.links.map(link => link.href));
    assert.equal(boot.links.every(link => link.removed), true);
    assert.deepEqual(boot.reports, []);
});

test('failed editor loading removes preload hints, stops execution and preloads fresh URLs on retry', async () => {
    const boot = createBoot();
    await flush();
    boot.scripts[0].onerror();
    await flush();
    assert.equal(boot.scripts.length, 1);
    assert.equal(boot.links.every(link => link.removed), true);
    const retry = boot.retry();
    await flush();
    const nextLinks = boot.links.slice(20);
    assert.equal(nextLinks.length, 20);
    for (const link of nextLinks) assert.match(link.href, /\?v=fixture-version&boot=.+&attempt=2$/);
    assert.equal(nextLinks[0].href, boot.scripts.at(-1).src);
    await boot.finish();
    await retry;
    assert.equal(boot.links.every(link => link.removed), true);
});

test('unsupported or rejected preload hints retain healthy ordered editor loading', async () => {
    for (const options of [{ preloadSupport: false }, { rejectPreload: true }]) {
        const boot = createBoot(options);
        await boot.finish();
        assert.equal(boot.links.length, 0);
        assert.equal(boot.scripts.length, 20);
        assert.deepEqual(boot.reports, []);
    }
});

test('completed editor assets without the runtime marker still report a startup failure', async () => {
    const boot = createBoot();
    await boot.finish(false);
    assert.equal(boot.reports.length, 1);
    assert.equal(boot.reports[0].stage, 'runtime-script-still-pending');
    assert.equal(boot.reports[0].tone, 'invalid');
});

test('failed editor assets stop the queue and an explicit retry bypasses the asset cache', async () => {
    const boot = createBoot();
    await flush();
    boot.scripts[0].onerror();
    await flush();
    assert.equal(boot.scripts.length, 1);
    assert.equal(boot.reports[0].stage, 'runtime-asset-load-failed');
    const retry = boot.retry();
    await flush();
    assert.match(boot.scripts.at(-1).src, /\?v=fixture-version&boot=.+&attempt=2$/);
    await boot.finish();
    await retry;
    assert.equal(boot.reports.length, 1);
});

test('stalled editor asset times out once and stops the queue', async () => {
    const boot = createBoot();
    await flush();
    await boot.advance(8000);
    assert.equal(boot.reports.length, 1);
    assert.match(boot.reports[0].details, /Timed out loading/);
    assert.equal(boot.scripts.length, 1);
    assert.equal(boot.links.every(link => link.removed), true);
    boot.scripts[0].onerror();
    await flush();
    assert.equal(boot.reports.length, 1);
});

test('retry rejects when loaded editor assets still do not initialize the runtime', async () => {
    const boot = createBoot();
    await boot.finish(false);
    const retry = boot.retry();
    const rejected = assert.rejects(retry, /startup marker/);
    await boot.finish(false);
    await rejected;
    assert.equal(boot.reports.at(-1).stage, 'runtime-script-still-pending');
});
