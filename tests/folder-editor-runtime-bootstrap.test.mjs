import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.runtime-bootstrap.js', 'utf8');
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const createBoot = () => {
    const scripts = [], reports = [], timers = new Map();
    let now = 0, timerId = 0, retry;
    const window = {
        FolderViewPlusFolderEditorPageBuildVersion: 'fixture-version',
        FolderViewPlusReportFolderEditorBootstrap: report => reports.push(report),
        FolderViewPlusFatalBanner: { registerRecoveryHandler: (_name, handler) => { retry = handler; } },
        setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
        clearTimeout: id => timers.delete(id)
    };
    const document = {
        readyState: 'complete', querySelectorAll: () => [],
        createElement: () => ({ dataset: {}, remove() {} }),
        body: { appendChild: script => scripts.push(script) }
    };
    vm.runInNewContext(source, { window, document, console });
    return { window, scripts, reports, retry: () => retry(),
        async advance(milliseconds) {
            now += milliseconds;
            for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
            await flush();
        },
        async finish(marker = true) {
            for (let index = 0; index < 18; index++) {
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
    assert.equal(boot.scripts.length, 18);
    for (const script of boot.scripts) assert.match(script.src, /\?v=fixture-version$/);
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
