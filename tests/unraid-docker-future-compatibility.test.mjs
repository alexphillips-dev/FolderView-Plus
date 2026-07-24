import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus'
);
const scriptsRoot = path.join(pluginRoot, 'scripts');
const compatibility = require(path.join(scriptsRoot, 'runtime.host-compatibility.js'));
const transport = require(path.join(scriptsRoot, 'runtime.transport.js'));
const providers = require(path.join(scriptsRoot, 'docker.runtime.providers.js'));
const supportBundleBrowser = require(path.join(scriptsRoot, 'folderviewplus.support-bundle-browser.js'));
const bootstrapSource = fs.readFileSync(path.join(scriptsRoot, 'docker.bootstrap.js'), 'utf8');
const dockerSource = fs.readFileSync(path.join(scriptsRoot, 'docker.js'), 'utf8');
const dashboardAdvancedPreviewSource = fs.readFileSync(
    path.join(scriptsRoot, 'dashboard.advanced-preview.js'),
    'utf8'
);
const dockerPage = fs.readFileSync(path.join(pluginRoot, 'folderview.plus.Docker.page'), 'utf8');
const dashboardPage = fs.readFileSync(path.join(pluginRoot, 'folderview.plus.Dashboard.page'), 'utf8');

const createDocument = (presentSelectors = []) => {
    const present = new Set(presentSelectors);
    return {
        querySelector(selector) {
            return present.has(selector) ? { selector } : null;
        }
    };
};

test('Docker host detector classifies classic, native, mixed, and unknown page shapes', () => {
    const classic = compatibility.detectDockerHost({
        window: {},
        document: createDocument([
            'table#docker_containers',
            'tbody#docker_list',
            '#docker_containers > thead > tr'
        ])
    });
    assert.equal(classic.hostGeneration, 'legacy-docker-table');
    assert.equal(classic.runtimeActivationAllowed, true);
    assert.equal(classic.ownership.folderOverlayAllowed, true);

    const native = compatibility.detectDockerHost({
        window: {},
        document: createDocument(['unraid-docker-container-overview'])
    });
    assert.equal(native.hostGeneration, 'native-docker-vue');
    assert.equal(native.runtimeActivationAllowed, false);
    assert.equal(native.ownership.dockerPage, 'unraid-native');
    assert.equal(native.ownership.nativeOrganizerMutationAllowed, false);
    assert.equal(native.ownership.nativeOrganizerDirectFileWriteAllowed, false);

    const mixed = compatibility.detectDockerHost({
        window: {},
        document: createDocument([
            'unraid-docker-container-overview',
            'table#docker_containers',
            'tbody#docker_list',
            '#docker_containers > thead > tr'
        ])
    });
    assert.equal(mixed.hostGeneration, 'native-docker-vue', 'native ownership wins during a transitional mixed render');
    assert.equal(mixed.runtimeActivationAllowed, false);

    const unknown = compatibility.detectDockerHost({
        window: {},
        document: createDocument([])
    });
    assert.equal(unknown.hostGeneration, 'unknown-docker-host');
    assert.equal(unknown.compatibilityMode, 'safe-unknown');
    assert.equal(unknown.runtimeActivationAllowed, false);
});

test('native Docker compatibility mode records aggregate evidence without changing host DOM or hooks', async () => {
    const records = new Map();
    const component = { marker: 'fixture-private-native-object' };
    const document = {
        querySelector(selector) {
            return selector === 'unraid-docker-container-overview' ? component : null;
        }
    };
    const originalLoadlist = () => 'native-loadlist';
    const events = [];
    const window = {
        document,
        loadlist: originalLoadlist,
        localStorage: {
            getItem: (key) => records.get(key) || null,
            setItem: (key, value) => records.set(key, value)
        },
        CustomEvent: class CustomEvent {
            constructor(type, options = {}) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        dispatchEvent: (event) => events.push(event)
    };
    const controller = compatibility.createController({ window, document });
    const snapshot = controller.evaluateDockerRuntime({ pluginVersion: 'test-version' });
    assert.equal(snapshot.hostGeneration, 'native-docker-vue');
    assert.equal(snapshot.runtimeActivationAllowed, false);
    assert.equal(document.querySelector('unraid-docker-container-overview'), component);
    assert.equal(window.loadlist, originalLoadlist);
    assert.equal(events.length, 1);

    const persisted = JSON.parse(records.get(compatibility.DOCKER_COMPATIBILITY_STORAGE_KEY));
    assert.equal(persisted.pageShape.nativeDockerComponent, true);
    assert.equal(persisted.hookAvailability.loadlist, true);
    assert.equal(JSON.stringify(persisted).includes('fixture-private-native-object'), false);
});

test('docker.js exits before legacy initialization on native and unknown host generations', () => {
    for (const hostGeneration of ['native-docker-vue', 'unknown-docker-host']) {
        let prepared = 0;
        let disposed = 0;
        let pagehide = null;
        const window = {
            document: { querySelector: () => null },
            FolderViewPlusHostCompatibility: {
                getDefaultController: () => ({
                    evaluateDockerRuntime: () => ({
                        hostGeneration,
                        runtimeActivationAllowed: false
                    })
                })
            },
            FolderViewPlusDockerProviders: {
                getDefaultRegistry: () => ({
                    prepare: async () => { prepared += 1; },
                    dispose: () => { disposed += 1; }
                })
            },
            addEventListener(type, handler) {
                if (type === 'pagehide') pagehide = handler;
            }
        };
        vm.runInNewContext(dockerSource, { window });
        assert.equal(prepared, 1);
        assert.equal(typeof pagehide, 'function');
        pagehide();
        assert.equal(disposed, 1);
        assert.equal(window.getDockerHostAdapterSnapshot, undefined);
        assert.equal(window.createFolderBtn, undefined);
    }
});

test('Docker bootstrap re-detects the final host and keeps all legacy assets inert in native mode', async () => {
    const events = [];
    const style = { media: 'not all' };
    const window = {
        document: {
            querySelector: () => null,
            querySelectorAll: () => [style],
            createElement: () => {
                throw new Error('native mode must not create a runtime script');
            }
        },
        FolderViewPlusDockerHostCompatibilityDecision: {
            hostGeneration: 'unknown-docker-host',
            runtimeActivationAllowed: false
        },
        FolderViewPlusHostCompatibility: {
            getDefaultController: () => ({
                evaluateDockerRuntime: () => ({
                    hostGeneration: 'native-docker-vue',
                    runtimeActivationAllowed: false
                })
            })
        },
        FolderViewPlusDockerProviders: {
            getDefaultRegistry: () => ({
                prepare: async ({ hostGeneration }) => events.push(`provider:${hostGeneration}`),
                dispose: () => events.push('dispose')
            })
        },
        FolderViewPlusDockerLoadCustomScripts: () => {
            events.push('custom');
            return Promise.resolve();
        },
        addEventListener: () => {}
    };
    vm.runInNewContext(bootstrapSource, { window });
    const result = await window.FolderViewPlusDockerBootstrapPromise;
    assert.equal(result.loaded, false);
    assert.equal(result.hostGeneration, 'native-docker-vue');
    assert.deepEqual(events, ['provider:native-docker-vue']);
    assert.equal(style.media, 'not all');
});

test('Docker bootstrap enables styles and loads custom overrides before the legacy runtime', async () => {
    const events = [];
    const style = { media: 'not all' };
    const document = {
        querySelector: () => null,
        querySelectorAll: () => [style],
        createElement: () => ({ dataset: {} }),
        head: {
            appendChild(script) {
                events.push(`runtime:${script.src}`);
                script.onload();
            }
        }
    };
    const window = {
        document,
        FolderViewPlusDockerRuntimeAssetUrl: '/plugins/folderview.plus/scripts/docker.js?v=test',
        FolderViewPlusHostCompatibility: {
            getDefaultController: () => ({
                evaluateDockerRuntime: () => ({
                    hostGeneration: 'legacy-docker-table',
                    runtimeActivationAllowed: true
                })
            })
        },
        FolderViewPlusDockerProviders: {
            getDefaultRegistry: () => ({
                prepare: async ({ hostGeneration }) => events.push(`provider:${hostGeneration}`)
            })
        },
        FolderViewPlusDockerLoadCustomScripts: async () => {
            events.push('custom');
        }
    };
    vm.runInNewContext(bootstrapSource, { window });
    const result = await window.FolderViewPlusDockerBootstrapPromise;
    assert.equal(result.loaded, true);
    assert.equal(style.media, 'all');
    assert.deepEqual(events, [
        'provider:legacy-docker-table',
        'custom',
        'runtime:/plugins/folderview.plus/scripts/docker.js?v=test'
    ]);
});

const graphqlResponse = (data, { status = 200, errors = null } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
        return errors ? { data, errors } : { data };
    }
});

const capabilityPayload = ({
    currentQuery = true,
    legacyQuery = false,
    restart = true,
    organizer = true,
    subscription = true
} = {}) => ({
    queryType: {
        fields: [
            ...(currentQuery ? [{ name: 'docker' }] : []),
            ...(legacyQuery ? [{ name: 'dockerContainers' }] : []),
            { name: 'info' }
        ]
    },
    mutationType: {
        fields: [
            { name: 'docker' },
            ...(organizer ? [{ name: 'createDockerFolder' }] : [])
        ]
    },
    subscriptionType: {
        fields: subscription ? [{ name: 'dockerContainerStats' }] : []
    },
    dockerType: {
        fields: [
            ...(currentQuery ? [{ name: 'containers' }] : []),
            ...(organizer ? [{ name: 'organizer' }] : [])
        ]
    },
    dockerMutationsType: {
        fields: ['start', 'stop', 'pause', 'unpause', ...(restart ? ['restart'] : [])]
            .map((name) => ({ name }))
    }
});

const createGraphqlWindow = (options = {}) => {
    const calls = [];
    const window = {
        csrf_token: 'fixture-csrf-token',
        location: { href: 'https://unraid.test/Docker' },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        AbortController,
        async fetch(_url, request) {
            const body = JSON.parse(request.body);
            calls.push({ body, headers: request.headers });
            if (body.query.includes('FVPlusDockerCapabilities')) {
                return graphqlResponse(capabilityPayload(options));
            }
            if (body.query.includes('FVPlusApiVersion')) {
                return graphqlResponse({
                    info: { versions: { core: { unraid: '7.4.0-beta.1', api: '4.40.0' } } }
                });
            }
            if (body.query.includes('FVPlusLegacyDockerContainers')) {
                return graphqlResponse({
                    dockerContainers: [{
                        id: 'server:abcdef1234567890',
                        names: ['/legacy-app'],
                        state: 'RUNNING',
                        status: 'Up',
                        autoStart: true
                    }]
                });
            }
            if (body.query.includes('FVPlusDockerContainers')) {
                return graphqlResponse({
                    docker: {
                        containers: [{
                            id: 'server:abcdef1234567890',
                            names: ['/current-app'],
                            state: 'RUNNING',
                            status: 'Up',
                            autoStart: true
                        }]
                    }
                });
            }
            if (body.query.includes('mutation FVPlusDocker')) {
                return graphqlResponse({
                    docker: {
                        start: {
                            id: body.variables.id,
                            names: ['/current-app'],
                            state: 'RUNNING',
                            status: 'Up'
                        }
                    }
                });
            }
            return graphqlResponse({ __typename: 'Query' });
        }
    };
    return { window, calls };
};

test('GraphQL transport sends CSRF, detects versions and operation capabilities, and gates restart', async () => {
    const harness = createGraphqlWindow({ restart: false });
    const snapshot = await transport.probeCapabilities({
        window: harness.window,
        force: true
    });
    assert.equal(snapshot.endpointAvailable, true);
    assert.equal(snapshot.apiVersion, '4.40.0');
    assert.equal(snapshot.unraidVersion, '7.4.0-beta.1');
    assert.equal(snapshot.query.shape, 'docker.containers');
    assert.equal(snapshot.mutation.start, true);
    assert.equal(snapshot.mutation.restart, false);
    assert.equal(snapshot.subscription.dockerContainerStats, true);
    assert.equal(snapshot.organizer.query, true);
    assert.equal(snapshot.organizer.mutation, true);
    assert.ok(harness.calls.every((call) => call.headers['x-csrf-token'] === 'fixture-csrf-token'));

    await assert.rejects(
        () => transport.runDockerAction(
            { action: 'restart', containerId: 'server:abcdef1234567890' },
            { window: harness.window, forceGraphql: true, capabilitySnapshot: snapshot }
        ),
        (error) => error.category === 'capability-unavailable'
    );
});

test('GraphQL transport classifies permission and partial-data responses without exposing server detail', async () => {
    const permissionWindow = {
        fetch: async () => graphqlResponse(null, { status: 403 })
    };
    await assert.rejects(
        () => transport.query('query PermissionFixture { __typename }', {}, {
            window: permissionWindow,
            operation: 'permission-fixture'
        }),
        (error) => (
            error.category === 'permission-denied'
            && error.status === 403
            && error.retryable === false
        )
    );

    const partialWindow = {
        fetch: async () => graphqlResponse(
            { docker: { containers: [] } },
            {
                errors: [{
                    message: 'private upstream detail',
                    extensions: { code: 'FORBIDDEN' }
                }]
            }
        )
    };
    const partial = await transport.query('query PartialFixture { docker { __typename } }', {}, {
        window: partialWindow,
        operation: 'partial-fixture',
        allowPartialData: true
    });
    assert.deepEqual(partial, { docker: { containers: [] } });
    assert.doesNotMatch(JSON.stringify(transport.diagnostics()), /private upstream detail/i);
});

test('GraphQL transport rejects superseded responses as stale', async () => {
    const pending = [];
    const staleWindow = {
        fetch: () => new Promise((resolve) => pending.push(resolve))
    };
    const first = transport.query('query FirstFixture { __typename }', {}, {
        window: staleWindow,
        staleKey: 'stale-fixture'
    });
    const second = transport.query('query SecondFixture { __typename }', {}, {
        window: staleWindow,
        staleKey: 'stale-fixture'
    });
    pending[1](graphqlResponse({ second: true }));
    assert.deepEqual(await second, { second: true });
    pending[0](graphqlResponse({ first: true }));
    await assert.rejects(first, (error) => error.category === 'stale-response');
});

test('GraphQL subscription sends CSRF and cancels scheduled reconnect on disposal', () => {
    const timers = new Map();
    const clearedTimers = [];
    let nextTimer = 1;
    class FixtureWebSocket {
        static instances = [];
        constructor(url, protocol) {
            this.url = url;
            this.protocol = protocol;
            this.readyState = 0;
            this.listeners = new Map();
            this.sent = [];
            FixtureWebSocket.instances.push(this);
        }
        addEventListener(type, handler) {
            this.listeners.set(type, handler);
        }
        send(payload) {
            this.sent.push(JSON.parse(payload));
        }
        close(code) {
            this.readyState = 3;
            this.closeCode = code;
        }
        emit(type, event = {}) {
            this.listeners.get(type)?.(event);
        }
    }
    const subscriptionWindow = {
        csrf_token: 'subscription-csrf-fixture',
        location: { href: 'https://unraid.test/Docker' },
        WebSocket: FixtureWebSocket,
        setTimeout(handler) {
            const id = nextTimer++;
            timers.set(id, handler);
            return id;
        },
        clearTimeout(id) {
            clearedTimers.push(id);
            timers.delete(id);
        }
    };
    const dispose = transport.subscribe({
        window: subscriptionWindow,
        autoWebSocket: true,
        document: 'subscription Fixture { dockerContainerStats { id } }'
    });
    const socket = FixtureWebSocket.instances[0];
    socket.readyState = 1;
    socket.emit('open');
    assert.equal(socket.sent[0].payload['x-csrf-token'], 'subscription-csrf-fixture');
    socket.emit('close', { code: 1006 });
    assert.equal(dispose.snapshot().status, 'reconnecting');
    dispose();
    assert.equal(dispose.snapshot().disposed, true);
    assert.ok(clearedTimers.length >= 1);
    assert.equal(timers.size, 0);
});

test('provider disposal closes every subscription it owns', () => {
    let closed = 0;
    const provider = providers.createGraphqlProvider({
        window: {},
        transport: {
            getCapabilitySnapshot: () => ({
                subscription: { dockerContainerStats: false }
            }),
            subscribe: () => () => {
                closed += 1;
            }
        }
    });
    provider.subscribe({ poll: async () => [] });
    provider.subscribe({ poll: async () => [] });
    provider.dispose();
    provider.dispose();
    assert.equal(closed, 2);
});

test('GraphQL provider supports current and documented legacy container query shapes', async () => {
    for (const shape of [
        { currentQuery: true, legacyQuery: false, expectedName: 'current-app' },
        { currentQuery: false, legacyQuery: true, expectedName: 'legacy-app' }
    ]) {
        const harness = createGraphqlWindow(shape);
        const provider = providers.createGraphqlProvider({
            window: harness.window,
            transport
        });
        const containers = await provider.listContainers({ force: true });
        assert.equal(containers.length, 1);
        assert.equal(containers[0].name, shape.expectedName);
        assert.equal(
            providers.resolveContainerIdentity('abcdef123456', containers)?.id,
            'server:abcdef1234567890'
        );
        await provider.executeAction({
            action: 'start',
            container: 'abcdef123456'
        }, { force: true });
        const mutationCall = harness.calls.find((call) => call.body.query.includes('mutation FVPlusDockerStart'));
        assert.equal(mutationCall.body.variables.id, 'server:abcdef1234567890');
        await assert.rejects(
            () => provider.organization.write({}),
            (error) => error.category === 'native-organization-owned-by-unraid'
        );
    }
});

test('transport diagnostics expose only aggregate GraphQL evidence', async () => {
    const harness = createGraphqlWindow();
    await transport.probeCapabilities({ window: harness.window, force: true });
    await transport.query(
        'query FVPlusDockerShape { docker { __typename } }',
        {},
        { window: harness.window, operation: 'privacy-check' }
    );
    const serialized = JSON.stringify(transport.diagnostics());
    assert.doesNotMatch(serialized, /fixture-csrf-token|abcdef1234567890|current-app|unraid\.test/);
    assert.match(serialized, /capability-probe|privacy-check/);
});

test('support-bundle browser collector exports sanitized Docker compatibility evidence', () => {
    const record = {
        schemaVersion: 1,
        hostGeneration: 'native-docker-vue',
        pageShape: {
            nativeDockerComponent: true,
            classicDockerTable: false
        },
        hookAvailability: {
            loadlist: false,
            eventControl: false
        },
        provider: {
            selected: 'unraid-graphql',
            state: 'ready',
            fallback: 'none'
        },
        graphql: {
            endpointAvailable: true,
            apiVersion: '4.40.0',
            queryShape: 'docker.containers',
            mutations: { start: true, restart: true },
            subscriptions: { dockerContainerStats: true },
            organizer: { query: true, mutation: true, policy: 'detect-only' }
        }
    };
    const collectors = supportBundleBrowser.createCollectors({
        storageKeys: {
            dockerCompatibility: 'fixture.compatibility'
        },
        readClientDiagnosticsStorageRecord: (key) => (
            key === 'fixture.compatibility' ? record : null
        )
    });
    const output = collectors.collectDockerCompatibilityDiagnostics({
        sanitizeValue: (_path, _key, value) => JSON.parse(JSON.stringify(value))
    });
    assert.equal(output.available, true);
    assert.equal(output.hostGeneration, 'native-docker-vue');
    assert.equal(output.graphql.organizer.policy, 'detect-only');
    assert.doesNotMatch(JSON.stringify(output), /containerName|containerId|10\.\d|\/mnt\/|https?:/i);
});

test('Docker and Dashboard pages load compatibility and provider modules in dependency order', () => {
    for (const [label, page, runtimeAsset] of [
        ['Docker', dockerPage, '/plugins/folderview.plus/scripts/docker.js'],
        ['Dashboard', dashboardPage, '/plugins/folderview.plus/scripts/dashboard.js']
    ]) {
        const transportIndex = page.indexOf('/plugins/folderview.plus/scripts/runtime.transport.js');
        const hostAdapterIndex = page.indexOf('/plugins/folderview.plus/scripts/runtime.host-adapter.js');
        const compatibilityIndex = page.indexOf('/plugins/folderview.plus/scripts/runtime.host-compatibility.js');
        const providersIndex = page.indexOf('/plugins/folderview.plus/scripts/docker.runtime.providers.js');
        const runtimeIndex = page.indexOf(runtimeAsset);
        assert.ok(transportIndex >= 0, `${label} transport include is missing`);
        assert.ok(hostAdapterIndex >= 0, `${label} host adapter include is missing`);
        assert.ok(compatibilityIndex > hostAdapterIndex, `${label} compatibility detector must load after the host adapter`);
        assert.ok(providersIndex > compatibilityIndex, `${label} providers must load after compatibility detection`);
        assert.ok(runtimeIndex > providersIndex, `${label} runtime must load after provider registration`);
    }
    assert.match(dockerPage, /window\.FolderViewPlusDockerHostCompatibilityDecision\s*=/);
    assert.match(dockerPage, /\$fvplusDockerLegacyConditionalAssets = true;/);
    assert.match(dockerPage, /data-fvplus-docker-legacy-style="true"/);
    assert.match(dockerPage, /link\.media = 'all'/);
});

test('Dashboard actions use provider capabilities and contain rejected action promises', () => {
    assert.match(dashboardAdvancedPreviewSource, /dockerActionProvider\?\.capabilities\?\.executeActions === true/);
    assert.match(dashboardAdvancedPreviewSource, /Promise\.resolve\(\)\s*\.then\(handler\)\s*\.catch/);
    assert.match(dashboardAdvancedPreviewSource, /FolderView action failed/);
});
