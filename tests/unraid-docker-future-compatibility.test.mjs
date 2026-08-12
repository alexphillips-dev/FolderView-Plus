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
const containerModel = require(path.join(scriptsRoot, 'docker.runtime.container-model.js'));
const providers = require(path.join(scriptsRoot, 'docker.runtime.providers.js'));
const providerHealth = require(path.join(scriptsRoot, 'docker.runtime.provider-health.js'));
const dashboardAdvancedPreview = require(path.join(scriptsRoot, 'dashboard.advanced-preview.js'));
const supportBundleBrowser = require(path.join(scriptsRoot, 'folderviewplus.support-bundle-browser.js'));
const bootstrapSource = fs.readFileSync(path.join(scriptsRoot, 'docker.bootstrap.js'), 'utf8');
const dockerSource = fs.readFileSync(path.join(scriptsRoot, 'docker.js'), 'utf8');
const dashboardAdvancedPreviewSource = fs.readFileSync(
    path.join(scriptsRoot, 'dashboard.advanced-preview.js'),
    'utf8'
);
const dockerProviderHealthSource = fs.readFileSync(
    path.join(scriptsRoot, 'docker.runtime.provider-health.js'),
    'utf8'
);
const dockerPage = fs.readFileSync(path.join(pluginRoot, 'folderview.plus.Docker.page'), 'utf8');
const dashboardPage = fs.readFileSync(path.join(pluginRoot, 'folderview.plus.Dashboard.page'), 'utf8');
const dockerPageBootstrapSource = fs.readFileSync(path.join(scriptsRoot, 'docker.page-bootstrap.js'), 'utf8');

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

const capabilityType = (type) => {
    if (type.endsWith('!')) {
        return { kind: 'NON_NULL', name: null, ofType: capabilityType(type.slice(0, -1)) };
    }
    if (type.startsWith('[') && type.endsWith(']')) {
        return { kind: 'LIST', name: null, ofType: capabilityType(type.slice(1, -1)) };
    }
    return { kind: 'SCALAR', name: type, ofType: null };
};
const mutationCapabilityField = (name) => {
    const argumentsByOperation = {
        start: { id: 'PrefixedID!' },
        stop: { id: 'PrefixedID!' },
        restart: { id: 'PrefixedID!' },
        pause: { id: 'PrefixedID!' },
        unpause: { id: 'PrefixedID!' },
        removeContainer: { id: 'PrefixedID!', withImage: 'Boolean' },
        updateContainer: { id: 'PrefixedID!' },
        updateContainers: { ids: '[PrefixedID!]!' },
        updateAllContainers: {},
        updateAutostartConfiguration: {
            entries: '[DockerAutostartEntryInput!]!',
            persistUserPreferences: 'Boolean'
        }
    };
    return {
        name,
        args: Object.entries(argumentsByOperation[name] || {}).map(([argumentName, type]) => ({
            name: argumentName,
            defaultValue: null,
            type: capabilityType(type)
        })),
        type: capabilityType(name === 'removeContainer' ? 'Boolean!' : 'DockerContainer!')
    };
};

const capabilityPayload = ({
    currentQuery = true,
    legacyQuery = false,
    restart = true,
    organizer = true,
    subscription = true,
    rich = true
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
            ...(rich ? [{ name: 'refreshDockerDigests' }] : []),
            ...(organizer ? [{ name: 'createDockerFolder' }] : [])
        ]
    },
    subscriptionType: {
        fields: subscription ? [{ name: 'dockerContainerStats' }] : []
    },
    dockerType: {
        fields: [
            ...(currentQuery ? [{ name: 'containers' }] : []),
            ...(currentQuery && rich
                ? ['container', 'networks', 'portConflicts', 'logs', 'containerUpdateStatuses']
                    .map((name) => ({ name }))
                : []),
            ...(organizer ? [{ name: 'organizer' }] : [])
        ]
    },
    dockerMutationsType: {
        fields: [
            'start',
            'stop',
            'pause',
            'unpause',
            ...(restart ? ['restart'] : []),
            ...(rich
                ? [
                    'removeContainer',
                    'updateContainer',
                    'updateContainers',
                    'updateAllContainers',
                    'updateAutostartConfiguration'
                ]
                : [])
        ]
            .map(mutationCapabilityField)
    },
    dockerContainerType: {
        fields: rich
            ? [
                'id',
                'names',
                'state',
                'status',
                'autoStart',
                'image',
                'ports',
                'mounts',
                'autoStartOrder',
                'autoStartWait',
                'templatePath',
                'iconUrl',
                'webUiUrl',
                'shell',
                'isOrphaned',
                'isUpdateAvailable',
                'isRebuildReady'
            ].map((name) => ({ name }))
            : []
    },
    dockerAutostartInput: {
        inputFields: rich
            ? ['id', 'autoStart', 'wait'].map((name) => ({ name }))
            : []
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
                            autoStart: true,
                            image: 'example/current:latest',
                            ports: [{ ip: '0.0.0.0', privatePort: 8080, publicPort: 8080, type: 'TCP' }],
                            mounts: [{ Type: 'bind', Source: '/mnt/user/appdata/current', Destination: '/config' }],
                            autoStartOrder: 2,
                            autoStartWait: 5,
                            templatePath: '/boot/config/plugins/dockerMan/templates-user/my-current.xml',
                            iconUrl: '/plugins/dynamix.docker.manager/images/question.png',
                            webUiUrl: 'http://[IP]:[PORT:8080]',
                            shell: 'bash',
                            isOrphaned: false,
                            isUpdateAvailable: true,
                            isRebuildReady: false
                        }]
                    }
                });
            }
            if (body.query.includes('FVPlusDockerContainer(')) {
                return graphqlResponse({
                    docker: {
                        container: {
                            id: body.variables.id,
                            names: ['/current-app'],
                            state: 'RUNNING',
                            status: 'Up',
                            autoStart: true,
                            image: 'example/current:latest',
                            ports: [],
                            mounts: [],
                            isOrphaned: false,
                            isUpdateAvailable: false,
                            isRebuildReady: false
                        }
                    }
                });
            }
            if (body.query.includes('FVPlusDockerPortConflicts')) {
                return graphqlResponse({
                    docker: {
                        portConflicts: {
                            containerPorts: [{
                                privatePort: 8080,
                                type: 'TCP',
                                containers: [
                                    { id: 'server:abcdef1234567890', name: 'current-app' },
                                    { id: 'server:fedcba0987654321', name: 'other-app' }
                                ]
                            }],
                            lanPorts: []
                        }
                    }
                });
            }
            if (body.query.includes('FVPlusDockerUpdate(')) {
                return graphqlResponse({
                    docker: {
                        updateContainer: {
                            id: body.variables.id,
                            names: ['/current-app'],
                            state: 'RUNNING',
                            status: 'Up'
                        }
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
    assert.equal(snapshot.mutation.updateContainer, true);
    assert.equal(snapshot.mutation.updateAutostartConfiguration, true);
    assert.equal(snapshot.rootMutation.refreshDockerDigests, true);
    assert.equal(snapshot.subscription.dockerContainerStats, true);
    assert.equal(snapshot.query.container, true);
    assert.equal(snapshot.query.portConflicts, true);
    assert.equal(snapshot.query.logs, true);
    assert.equal(snapshot.containerFields.iconUrl, true);
    assert.equal(snapshot.operations.getContainer.available, true);
    assert.equal(snapshot.operations.updateContainer.available, true);
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

    const incompatibleUpdate = {
        ...snapshot,
        operations: {
            ...snapshot.operations,
            updateContainer: {
                ...snapshot.operations.updateContainer,
                arguments: [{
                    name: 'id',
                    type: 'ID!',
                    required: true,
                    hasDefault: false
                }]
            }
        }
    };
    const callCount = harness.calls.length;
    await assert.rejects(
        () => transport.runDockerMutation(
            { operation: 'updateContainer', containerId: 'server:abcdef1234567890' },
            { window: harness.window, capabilitySnapshot: incompatibleUpdate }
        ),
        (error) => error.category === 'capability-unavailable'
    );
    assert.equal(harness.calls.length, callCount, 'signature drift must fail before a request is sent');
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

test('shared Docker container model normalizes GraphQL and PHP-shaped runtime data', () => {
    const graphql = containerModel.normalizeContainer({
        id: 'server:abcdef1234567890',
        names: ['/current-app'],
        state: 'RUNNING',
        autoStart: true,
        ports: [{ ip: '0.0.0.0', privatePort: 8080, publicPort: 18080, type: 'TCP' }],
        mounts: [{ Type: 'bind', Source: '/mnt/user/appdata/current', Destination: '/config' }],
        isUpdateAvailable: true
    }, { source: 'unraid-graphql' });
    const php = containerModel.normalizeContainer({
        shortId: 'fedcba098765',
        info: {
            Id: 'fedcba0987654321',
            Name: 'legacy-app',
            Config: { Image: 'example/legacy:latest' },
            State: { Running: true, Paused: false, Autostart: true }
        },
        Mounts: []
    }, { source: 'legacy-runtime' });
    assert.equal(graphql.name, 'current-app');
    assert.equal(graphql.state, 'running');
    assert.equal(graphql.ports[0].publicPort, 18080);
    assert.equal(graphql.mounts[0].destination, '/config');
    assert.equal(graphql.isUpdateAvailable, true);
    assert.equal(php.name, 'legacy-app');
    assert.equal(php.image, 'example/legacy:latest');
    assert.equal(php.state, 'running');
    assert.equal(php.autoStart, true);
    assert.equal(
        containerModel.resolveContainerIdentity('abcdef123456', [graphql, php]),
        graphql
    );
});

test('legacy Docker UI selects hybrid provider with GraphQL reads and host-owned actions', async () => {
    const harness = createGraphqlWindow();
    const hostActions = [];
    harness.window.eventControl = (request, refreshTarget) => {
        hostActions.push({ request, refreshTarget });
    };
    const registry = providers.createRegistry({
        window: harness.window,
        compatibilityModule: compatibility,
        transport
    });
    const provider = registry.select({
        hostGeneration: compatibility.HOST_GENERATIONS.LEGACY_DOCKER_TABLE
    });
    assert.equal(provider.id, providers.PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL);
    const containers = await provider.listContainers({ force: true });
    assert.equal(containers[0].source, 'unraid-graphql');
    assert.equal(containers[0].iconUrl, '/plugins/dynamix.docker.manager/images/question.png');
    await provider.executeAction({ action: 'start', container: 'abcdef1234567890' });
    assert.equal(hostActions.length, 1);
    assert.equal(hostActions[0].request.action, 'start');
    assert.equal(hostActions[0].refreshTarget, 'loadlist');
    assert.equal(
        harness.calls.filter((call) => call.body.query.includes('mutation FVPlusDockerStart')).length,
        0,
        'legacy UI lifecycle actions remain owned by eventControl'
    );
    registry.dispose();
});

test('hybrid capability discovery never blocks legacy Docker runtime activation', async () => {
    let resolveProbe;
    let probeSettled = false;
    let discoverySignal = null;
    const pendingProbe = new Promise((resolve) => {
        resolveProbe = (value) => {
            probeSettled = true;
            resolve(value);
        };
    });
    const window = {
        eventControl() {},
        fetch() {},
        document: createDocument([])
    };
    const registry = providers.createRegistry({
        window,
        compatibilityModule: compatibility,
        compatibilityController: { updateProviderEvidence() {} },
        transport: {
            getCapabilitySnapshot: () => ({
                checkedAt: null,
                endpointAvailable: false,
                query: {},
                mutation: {},
                rootMutation: {},
                subscription: {},
                organizer: {}
            }),
            probeCapabilities: (options) => {
                discoverySignal = options.signal;
                return pendingProbe;
            },
            runDockerAction: async () => ({ transport: 'host-event-control' }),
            subscribe: () => () => {}
        }
    });
    const prepared = await registry.prepare({
        hostGeneration: compatibility.HOST_GENERATIONS.LEGACY_DOCKER_TABLE
    });
    assert.equal(prepared.id, providers.PROVIDER_IDS.HYBRID_LEGACY_GRAPHQL);
    assert.equal(probeSettled, false, 'legacy preparation resolves before GraphQL discovery');
    resolveProbe({
        endpointAvailable: false,
        query: {},
        mutation: {},
        rootMutation: {},
        subscription: {},
        organizer: {}
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(discoverySignal?.aborted, false);
    registry.dispose();
    assert.equal(discoverySignal?.aborted, true);
});

test('GraphQL provider uses targeted reconciliation, aggregate health, and guarded update mutation', async () => {
    const harness = createGraphqlWindow();
    const provider = providers.createGraphqlProvider({
        window: harness.window,
        transport
    });
    await provider.listContainers({ force: true });
    const targeted = await provider.getContainer('abcdef123456');
    assert.equal(targeted.id, 'server:abcdef1234567890');
    assert.equal(targeted.isUpdateAvailable, false);
    const health = await provider.health.getSummary({ force: true });
    assert.equal(health.detailsAvailable, true);
    assert.equal(health.containerPortConflictCount, 1);
    assert.equal(health.affectedContainerCount, 2);
    assert.equal(Object.hasOwn(health, 'containerIds'), false);
    await provider.mutations.update({ container: 'abcdef123456' });
    assert.ok(
        harness.calls.some((call) => call.body.query.includes('mutation FVPlusDockerUpdate('))
    );
    assert.ok(
        harness.calls.filter((call) => call.body.query.includes('FVPlusDockerContainer(')).length >= 2
    );
    provider.dispose();
});

test('Dashboard GraphQL stats parser accepts matching prefixed ids and rejects unrelated data', () => {
    const api = dashboardAdvancedPreview.createApi({});
    assert.deepEqual(
        api.parseGraphqlStats({
            dockerContainerStats: {
                id: 'server:abcdef1234567890',
                cpuPercent: 24,
                memPercent: 50,
                memUsage: '512MB / 1GB',
                netIO: '1MB / 2MB',
                blockIO: '3MB / 4MB'
            }
        }, { shortId: 'abcdef123456' }, 2),
        {
            cpu: 12,
            mem: 50,
            memUsage: '512MB / 1GB',
            netIO: '1MB / 2MB',
            blockIO: '3MB / 4MB'
        }
    );
    assert.equal(
        api.parseGraphqlStats({
            dockerContainerStats: { id: 'server:other', cpuPercent: 1, memPercent: 1 }
        }, { shortId: 'abcdef123456' }, 1),
        null
    );
});

test('provider health controller derives aggregate severity and has a disposal boundary', async () => {
    const controller = providerHealth.createController({
        providerRegistry: {
            getDefault: () => ({
                health: {
                    getLastSummary: () => null,
                    getSummary: async () => ({
                        checkedAt: new Date().toISOString(),
                        detailsAvailable: true,
                        updateAvailableCount: 2,
                        rebuildReadyCount: 1,
                        orphanedCount: 1,
                        containerPortConflictCount: 1,
                        lanPortConflictCount: 1
                    })
                }
            })
        }
    });
    await controller.refresh({ force: true });
    const model = controller.getModel();
    assert.equal(model.severity, 'danger');
    assert.equal(model.updates, 2);
    assert.equal(model.rebuilds, 1);
    assert.equal(model.orphaned, 1);
    assert.equal(model.conflicts, 2);
    assert.match(model.text, /2 port conflicts/);
    controller.dispose();
    assert.equal(controller.getSnapshot().disposed, true);
});

test('provider health disposal aborts an in-flight aggregate request', async () => {
    let capturedSignal = null;
    let resolveHealth;
    const controller = providerHealth.createController({
        providerRegistry: {
            getDefault: () => ({
                health: {
                    getLastSummary: () => null,
                    getSummary: (options) => {
                        capturedSignal = options.signal;
                        return new Promise((resolve) => {
                            resolveHealth = resolve;
                        });
                    }
                }
            })
        }
    });
    const pending = controller.refresh({ force: true });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(capturedSignal?.aborted, false);
    controller.dispose();
    assert.equal(capturedSignal?.aborted, true);
    resolveHealth(null);
    assert.equal(await pending, null);
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
        const containerModelIndex = page.indexOf('/plugins/folderview.plus/scripts/docker.runtime.container-model.js');
        const providersIndex = page.indexOf('/plugins/folderview.plus/scripts/docker.runtime.providers.js');
        const providerHealthIndex = page.indexOf('/plugins/folderview.plus/scripts/docker.runtime.provider-health.js');
        const runtimeIndex = page.indexOf(runtimeAsset);
        assert.ok(transportIndex >= 0, `${label} transport include is missing`);
        assert.ok(hostAdapterIndex >= 0, `${label} host adapter include is missing`);
        assert.ok(compatibilityIndex > hostAdapterIndex, `${label} compatibility detector must load after the host adapter`);
        assert.ok(containerModelIndex > compatibilityIndex, `${label} container model must load after compatibility detection`);
        assert.ok(providersIndex > containerModelIndex, `${label} providers must load after the container model`);
        if (label === 'Docker') {
            assert.ok(providerHealthIndex > providersIndex, 'Docker provider health must load after providers');
            assert.ok(runtimeIndex > providerHealthIndex, 'Docker runtime must load after provider health');
        }
        assert.ok(runtimeIndex > providersIndex, `${label} runtime must load after provider registration`);
    }
    assert.match(dockerPageBootstrapSource, /FolderViewPlusDockerHostCompatibilityDecision\s*=/);
    assert.match(dockerPage, /\$fvplusDockerLegacyConditionalAssets = true;/);
    assert.match(dockerPage, /data-fvplus-docker-legacy-style="true"/);
    assert.match(bootstrapSource, /link\.media = 'all'/);
});

test('Dashboard actions use provider capabilities and contain rejected action promises', () => {
    assert.match(dashboardAdvancedPreviewSource, /dockerActionProvider\?\.capabilities\?\.executeActions === true/);
    assert.match(dashboardAdvancedPreviewSource, /Promise\.resolve\(\)\s*\.then\(handler\)\s*\.catch/);
    assert.match(dashboardAdvancedPreviewSource, /FolderView action failed/);
});

test('legacy Docker health badge consumes only aggregate provider health metadata', () => {
    assert.match(dockerSource, /FolderViewPlusDockerProviderHealth\?\.createController/);
    assert.match(dockerSource, /dockerProviderHealthController\?\.getModel/);
    assert.match(dockerProviderHealthSource, /health\.getSummary/);
    assert.match(dockerProviderHealthSource, /containerPortConflictCount/);
    assert.match(dockerProviderHealthSource, /lanPortConflictCount/);
    assert.match(dockerProviderHealthSource, /updateAvailableCount/);
    assert.match(dockerProviderHealthSource, /rebuildReadyCount/);
    assert.match(dockerProviderHealthSource, /orphanedCount/);
    assert.doesNotMatch(
        dockerProviderHealthSource,
        /summary\.(?:containerIds|containerNames|paths|urls)/
    );
});
