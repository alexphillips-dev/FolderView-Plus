import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { combineIntegrationResponse, investigateStartupCallbacks, requireHostedInvestigation, validateStartupSample } from '../scripts/diagnose_startup_callbacks.mjs';
import { createProductionPerfFixture } from '../scripts/lib/production-perf-fixture.mjs';

const prefix = '/plugins/folderview.plus/scripts/';
const providers = prefix + 'docker.runtime.providers.js';
const integration = prefix + 'docker.runtime.api-integration.js';
const tag = file => `<script src="${file}?v=benchmark"></script>`;

test('callback investigation refuses workspace and untrusted invocations before asset reads or browser launch', async () => {
    const hosted = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'alexphillips-dev/FolderView-Plus', GITHUB_EVENT_NAME: 'workflow_dispatch' };
    for (const env of [{}, { ...hosted, GITHUB_ACTIONS: 'false' }, { ...hosted, GITHUB_ACTIONS: '1' },
        { ...hosted, GITHUB_REPOSITORY: undefined }, { ...hosted, GITHUB_REPOSITORY: 'other/repository' },
        { ...hosted, GITHUB_EVENT_NAME: undefined }, { ...hosted, GITHUB_EVENT_NAME: 'push' },
        { ...hosted, GITHUB_EVENT_NAME: 'pull_request' }]) {
        assert.throws(() => requireHostedInvestigation(env));
        await assert.rejects(investigateStartupCallbacks({ env }));
    }
    assert.doesNotThrow(() => requireHostedInvestigation(hosted));
});

test('paired API integration control preserves original bytes, order, and unrelated responses', () => {
    const preceding = Buffer.from('window.order = ["providers"];\r\n');
    const following = Buffer.from('window.order.push("integration");\n');
    const transform = combineIntegrationResponse(preceding, following);
    const html = '<main>fixture</main>' + tag(providers) + '\r\n' + tag(integration) + tag(prefix + 'docker.runtime.api-coordinator.js');
    assert.equal(transform('/docker', html), html.replace(tag(integration), ''));
    assert.deepEqual(transform(providers, preceding), Buffer.concat([preceding, Buffer.from('\n;\n'), following]));
    const context = vm.createContext({ window: {} });
    vm.runInContext(transform(providers, preceding).toString(), context);
    assert.deepEqual([...context.window.order], ['providers', 'integration']);
    for (const invalid of [tag(providers), tag(providers) + tag(integration) + tag(integration)]) {
        assert.throws(() => transform('/docker', invalid), /exactly one API integration/);
    }
    assert.throws(() => transform('/docker', tag(integration)), /exactly one preceding providers/);
    assert.throws(() => transform('/docker', tag(providers) + tag(providers) + tag(integration)), /exactly one preceding providers/);
    assert.throws(() => transform('/docker', tag(integration) + tag(providers)), /immediately before/);
    assert.throws(() => transform('/docker', tag(providers) + '<div>changed order</div>' + tag(integration)), /immediately before/);
    const binary = Buffer.from([0, 1, 255]);
    for (const url of ['/other.png', '/settings', integration]) assert.equal(transform(url, binary), binary);
});

test('fixture transform affects only explicitly selected Docker responses and retains API/cache behavior', async () => {
    const root = process.cwd();
    const scripts = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
    const preceding = fs.readFileSync(path.join(scripts, path.basename(providers)));
    const following = fs.readFileSync(path.join(scripts, path.basename(integration)));
    const scenario = { folders: 2, members: 3 };
    const original = createProductionPerfFixture(root, scenario);
    const control = createProductionPerfFixture(root, scenario, 'en', { transformResponse: combineIntegrationResponse(preceding, following) });
    for (const fixture of [original, control]) await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
    const origin = fixture => `http://127.0.0.1:${fixture.server.address().port}`;
    try {
        const html = await fetch(origin(original) + '/docker').then(response => response.text());
        assert.equal(await fetch(origin(control) + '/docker').then(response => response.text()), html.replace(tag(integration), ''));
        const asset = await fetch(origin(control) + providers);
        assert.equal(asset.headers.get('cache-control'), 'public, max-age=3600');
        assert.match(asset.headers.get('content-type'), /javascript/);
        assert.deepEqual(Buffer.from(await asset.arrayBuffer()), Buffer.concat([preceding, Buffer.from('\n;\n'), following]));
        assert.deepEqual(Buffer.from(await fetch(origin(original) + providers).then(response => response.arrayBuffer())), preceding);
        const snapshot = '/plugins/folderview.plus/server/runtime_snapshot.php?type=docker';
        const response = await fetch(origin(control) + snapshot);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), await fetch(origin(original) + snapshot).then(value => value.json()));
    } finally {
        for (const fixture of [original, control]) await new Promise(resolve => fixture.server.close(resolve));
    }
});

test('sample validation rejects lost ownership, duplicate rows, hierarchy, locale, cache, and startup errors', () => {
    const fixture = { names: ['one', 'two'], folders: {
        parent: { containers: ['one'] }, child: { containers: ['two'], parentId: 'parent' }
    } };
    const sample = { errors: [], nativeRowIds: ['ct-one', 'ct-two'],
        membership: [{ name: 'one', folderId: 'parent' }, { name: 'two', folderId: 'child' }],
        folderDepths: [{ id: 'parent', depth: 0, parentId: '' }, { id: 'child', depth: 1, parentId: 'parent' }],
        locale: { initialized: true, resolvedLocale: 'ar', direction: 'rtl', loadErrors: [], recentMissingKeys: [] },
        scripts: [providers, integration, prefix + 'docker.js'], mutationCallbacks: 10, mutationRecords: 20,
        domNodes: 30, requests: 3, scriptRequests: 3, cachedScriptRequests: 3 };
    const options = { temperature: 'warm', variant: 'separate', locale: 'ar' };
    assert.doesNotThrow(() => validateStartupSample(sample, fixture, options));
    const combined = structuredClone(sample);
    combined.scripts = combined.scripts.filter(file => file !== integration);
    assert.doesNotThrow(() => validateStartupSample(combined, fixture, { ...options, variant: 'combined' }));
    const invalidMutations = [
        value => { value.membership[0].folderId = 'child'; },
        value => { value.nativeRowIds[1] = value.nativeRowIds[0]; },
        value => { value.folderDepths[1].depth = 0; },
        value => { value.folderDepths[1] = value.folderDepths[0]; },
        value => { value.locale.direction = 'ltr'; },
        value => { value.locale.loadErrors.push('load failed'); },
        value => { value.locale.recentMissingKeys.push('missing'); },
        value => { value.cachedScriptRequests = 0; },
        value => { value.errors.push('startup failed'); },
        value => { value.scripts = value.scripts.filter(file => file !== integration); },
        value => { value.mutationRecords = NaN; }
    ];
    for (const mutate of invalidMutations) {
        const invalid = structuredClone(sample);
        mutate(invalid);
        assert.throws(() => validateStartupSample(invalid, fixture, options));
    }
});
