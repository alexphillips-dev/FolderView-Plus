import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('const createFolders = async () => {'), source.indexOf('const queueCreateFoldersRender = () => {'));
const queueSource = source.slice(source.indexOf('const queueCreateFoldersRender = () => {'), source.indexOf('const renderFolderUpdateColumn = '));
const flush = () => new Promise(resolve => setImmediate(resolve));

function renderFixture() {
    const effects = [];
    let resolve, reject;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    const record = name => () => effects.push(name);
    const context = vm.createContext({
        dockerRuntimePageDisposed: false, dockerBootstrapGeneration: 1,
        dockerDeferredPreviewController: { flush: record('flush') },
        dockerAdvancedPreviewContextBindersByName: { clear: record('clear') },
        document: { querySelector: () => null },
        dockerRuntimePerformanceTelemetry: { observe() {}, mark() {}, begin: record('prepare') },
        dockerPerf: { begin() {}, end: record('perf-end') },
        dockerRuntimeWidthState: { pendingRenderGeneration: 1 },
        globalFolders: {}, folderReq: { generation: 1, render: [pending] },
        dockerRuntimeLastRenderGeneration: 0, nextDockerRenderSuppressLoadingUi: false,
        activeDockerRenderSuppressLoadingUi: false, dockerHostLoadOwnsLoadingUi: true,
        dockerLastRenderMs: 0, FOLDER_VIEW_PERF_MODE: false,
        setDockerFatalBannerPhase: record('phase'),
        ensureDockerExpandedStateLifecycleHooks: record('lifecycle'),
        markDockerFatalBannerStep: record('step'),
        persistDockerExpandedStateFromDom: record('persist'),
        showDockerRuntimeLoadingOverlay: record('show-overlay'),
        showDockerRuntimeLoadingRow: record('show-row'),
        completeDockerRuntimeWidthBootstrap: record('complete-width'),
        hideDockerRuntimeLoadingOverlay: record('hide-overlay'),
        hideDockerRuntimeLoadingRow: record('hide-row'),
        reportDockerFatalRuntimeError: record('fatal'),
        inferDockerFatalBannerCategory: () => 'runtime'
    });
    vm.runInContext(`${renderSource}\nglobalThis.render = createFolders;`, context);
    return { context, effects, resolve, reject };
}

for (const staleMode of ['disposed', 'superseded']) {
    for (const rejected of [false, true]) {
        test(`Docker pending render ${rejected ? 'rejection' : 'response'} has no effects when ${staleMode}`, async () => {
            const fixture = renderFixture();
            const result = fixture.context.render().catch(() => {});
            if (staleMode === 'disposed') fixture.context.dockerRuntimePageDisposed = true;
            fixture.context.dockerBootstrapGeneration = 2;
            fixture.effects.length = 0;
            if (rejected) fixture.reject(new Error('Fixture request failure'));
            else fixture.resolve('invalid stale payload');
            await result;
            assert.deepEqual(fixture.effects, [], 'stale completion must not parse, report, or finalize the current UI');
            assert.equal(fixture.context.dockerHostLoadOwnsLoadingUi, true);
        });
    }
}

test('current Docker render rejection still reports and releases loading UI', async () => {
    const fixture = renderFixture();
    const result = fixture.context.render();
    fixture.reject(new Error('Fixture current failure'));
    await assert.rejects(result, /Fixture current failure/);
    assert.ok(fixture.effects.includes('fatal'));
    assert.ok(fixture.effects.includes('hide-overlay'));
    assert.equal(fixture.context.dockerHostLoadOwnsLoadingUi, false);
});

test('Docker render queued before pagehide does not start after its microtask resumes', async () => {
    const fixture = renderFixture();
    const result = Promise.resolve().then(() => fixture.context.render());
    fixture.context.dockerRuntimePageDisposed = true;
    await result;
    assert.deepEqual(fixture.effects, []);
});

for (const disposed of [false, true]) {
    test(`Docker render queue ${disposed ? 'ignores a disposed page' : 'replays active queued work'}`, async () => {
        let renders = 0;
        const context = vm.createContext({
            dockerRuntimePageDisposed: disposed, createFoldersInFlight: false, createFoldersQueued: false,
            createFolders: async () => { renders++; }, nextDockerRenderSuppressLoadingUi: false
        });
        vm.runInContext(`${queueSource}\nglobalThis.queue = queueCreateFoldersRender;`, context);
        context.queue(); context.queue();
        await flush();
        assert.equal(renders, disposed ? 0 : 2);
        assert.equal(context.createFoldersInFlight, false);
    });
}
