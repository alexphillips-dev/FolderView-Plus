import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const runtimeSnapshotLibPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.runtime-snapshot.php';
const runtimeSnapshotEndpointPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/runtime_snapshot.php';
const runtimeSnapshotClientPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-snapshot.js';
const runtimeSnapshotLib = read(runtimeSnapshotLibPath);
const runtimeSnapshotEndpoint = read(runtimeSnapshotEndpointPath);
const runtimeSnapshotClient = read(runtimeSnapshotClientPath);
const dockerPageOrderLib = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-page-order.php');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const dashboardPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const installSmoke = read('scripts/install_smoke.sh');
const releaseGuard = read('scripts/release_guard.sh');
const runtimeSnapshotPhpEnv = {
    ...process.env,
    FVPLUS_TEST_RUNTIME_SNAPSHOT_LIB: path.join(repoRoot, runtimeSnapshotLibPath)
};
const requireRuntimeSnapshotLibPhp = "require getenv('FVPLUS_TEST_RUNTIME_SNAPSHOT_LIB');";

test('Docker full and projected state snapshots agree with the actual backend action policy', () => {
    const lib = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
    const policy = lib.slice(lib.indexOf('    function runtimeActionAllowed('), lib.indexOf('    function executeFolderRuntimeAction('));
    const summary = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics-summary.php');
    const states = summary.slice(summary.indexOf('function diagnosticsStateKindForDockerItem('), summary.indexOf('    function diagnosticsBuildStateSnapshot('));
    const php = "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; } "
        + requireRuntimeSnapshotLibPhp + policy + states
        + "$full = ['running' => ['info' => ['State' => ['Running' => true, 'Paused' => false]]], 'paused' => ['info' => ['State' => ['Running' => true, 'Paused' => true]]], 'stopped' => ['info' => ['State' => ['Running' => false, 'Paused' => false]]]]; "
        + "$allowed = []; foreach (['start', 'stop', 'pause', 'resume'] as $action) foreach ($full as $name => $item) if (runtimeActionAllowed('docker', $action, diagnosticsStateKindForDockerItem($item))) $allowed[$action][] = $name; "
        + "echo json_encode(['full' => $full, 'state' => runtimeSnapshotStateProjection('docker', $full), 'allowed' => $allowed]);";
    const response = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: runtimeSnapshotPhpEnv }));
    const require = createRequire(import.meta.url);
    const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
    for (const action of ['start', 'stop', 'pause', 'resume']) {
        const base = { type: 'docker', folderId: 'apps', folder: { containers: Object.keys(response.full) }, rules: [], action };
        const full = utils.planFolderRuntimeAction({ ...base, infoByName: response.full });
        const light = utils.planFolderRuntimeAction({ ...base, infoByName: response.state });
        assert.deepEqual(light, full, action);
        assert.deepEqual(light.eligible.map(row => row.name).sort(), response.allowed[action].slice().sort(), action);
    }
});

test('bulk runtime dispatch rejects stale membership and stale eligibility before invoking any command', () => {
    const lib = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
    const implementation = lib.slice(lib.indexOf('    function normalizeRuntimeItemNames('), lib.indexOf('    function getTemplatePath('));
    const summary = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics-summary.php');
    const states = summary.slice(summary.indexOf('function diagnosticsStateKindForDockerItem('), summary.indexOf('    function diagnosticsBuildStateSnapshot('));
    const php = `
        class FVPlusConfigConflictException extends RuntimeException {}
        function ensureType($type) { return $type; }
        function readInfo($type) { return $GLOBALS['inventory']; }
        function readRuntimeSnapshotConfig($type) { return ['folders' => ['media' => []], 'prefs' => []]; }
        function fvplusBuildMembershipSnapshot($type, $folders, $rules, $info) {
            return ['byFolder' => ['media' => ['liveMembers' => $GLOBALS['members']]]];
        }
        ${states}
        function fvplusRunRuntimeItemAction($type, $action, $name) {
            $GLOBALS['calls'][] = [$type, $action, $name];
            return ['ok' => true, 'exitCode' => 0, 'output' => []];
        }
        ${implementation}
        $results = [];
        foreach (['docker', 'vm'] as $type) foreach (['valid','removed','new-member','already-stopped','missing-folder'] as $scenario) {
            $GLOBALS['calls'] = [];
            $GLOBALS['members'] = $scenario === 'removed' ? ['other'] : ($scenario === 'new-member' ? ['original','other'] : ['original']);
            $running = $scenario !== 'already-stopped';
            $GLOBALS['inventory'] = $type === 'docker' ? [
                'original' => ['info' => ['State' => ['Running' => $running, 'Paused' => false]]],
                'other' => ['info' => ['State' => ['Running' => true, 'Paused' => true]]]
            ] : ['original' => ['state' => $running ? 'running' : 'shutoff'], 'other' => ['state' => 'running']];
            try {
                $result = executeFolderRuntimeAction($type, 'stop', ['original'], $scenario === 'missing-folder' ? 'absent' : 'media');
                $results[] = [$type, $scenario, $result['succeeded'], $GLOBALS['calls']];
            } catch (FVPlusConfigConflictException $error) {
                $results[] = [$type, $scenario, 'stale', $GLOBALS['calls']];
            }
        }
        echo json_encode($results);
    `;
    const results = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    for (const [type, scenario, status, calls] of results) {
        assert.equal(status, scenario === 'valid' ? 1 : 'stale', `${type}/${scenario}`);
        assert.deepEqual(calls, scenario === 'valid' ? [[type, 'stop', 'original']] : []);
    }
});

const loadClientApi = () => {
    const context = {
        window: {
            FolderViewPlusRequest: {
                buildUrl: (url, query) => `${url}?${new URLSearchParams(query).toString()}`
            }
        }
    };
    vm.runInNewContext(runtimeSnapshotClient, context, { filename: 'folderviewplus.runtime-snapshot.js' });
    return context.window.FolderViewPlusRuntimeSnapshot;
};

test('runtime snapshot endpoint exposes a versioned, no-cache GET contract', () => {
    assert.match(runtimeSnapshotEndpoint, /require_once\('\/usr\/local\/emhttp\/plugins\/folderview\.plus\/server\/lib\.runtime-snapshot\.php'\)/);
    assert.match(runtimeSnapshotEndpoint, /emitNoCachePageHeaders\(\)/);
    assert.match(runtimeSnapshotEndpoint, /REQUEST_METHOD[\s\S]*GET/);
    assert.match(runtimeSnapshotEndpoint, /buildRuntimeSnapshot\(\$type, \$mode, \$since, \$preferLiveUpdateStatus, \$ttl, \$forceRefresh\)/);
    assert.match(runtimeSnapshotEndpoint, /X-FV-Runtime-Snapshot-Schema/);
    assert.match(runtimeSnapshotEndpoint, /X-FV-Runtime-Snapshot-Token/);
});

test('snapshot assembly keeps configuration reads under one mutation boundary', () => {
    assert.match(runtimeSnapshotLib, /const FVPLUS_RUNTIME_SNAPSHOT_SCHEMA_VERSION = 1/);
    const configReader = runtimeSnapshotLib.match(/^function readRuntimeSnapshotConfigUnlocked\([\s\S]*?^\}/m)?.[0] || '';
    assert.match(configReader, /readFolder\(\$safeType\)[\s\S]*readTypePrefs\(\$safeType\)[\s\S]*readConfigMetadata\(\$safeType, true\)/);
    assert.match(configReader, /\$nativeSavedOrder = \$safeType === 'docker' \? readDockerNativePageOrder\(\) : json_decode\(readUserPrefs\(\$safeType\), true\)/);
    assert.match(configReader, /composeDockerSavedOrder\(\$nativeSavedOrder, \$folders, \$prefs, \$dockerLiveNames \?\? \[\]\)/);
    assert.match(runtimeSnapshotLib, /function readRuntimeSnapshotConfig\(string \$type, \?array \$dockerLiveNames = null\): array \{\s*\$safeType = ensureType\(\$type\);\s*return withConfigMutationLock\(static function \(\) use \(\$safeType, \$dockerLiveNames\): array \{\s*return readRuntimeSnapshotConfigUnlocked\(\$safeType, \$dockerLiveNames\);/);
    assert.match(runtimeSnapshotLib, /function buildRuntimeConfigBootstrapSnapshot\(\): array \{[\s\S]*withConfigMutationLock\(static function[\s\S]*readRuntimeSnapshotConfigUnlocked\('docker'\)[\s\S]*readRuntimeSnapshotConfigUnlocked\('vm'\)/);
    assert.match(runtimeSnapshotLib, /function runtimeSnapshotToken\([\s\S]*folderRevision[\s\S]*prefsRevision[\s\S]*runtimeSignature/);
    assert.match(runtimeSnapshotLib, /\$notModified = \$safeMode === 'check'[\s\S]*hash_equals\(\$snapshotToken, \$safeSinceToken\)/);
    assert.match(runtimeSnapshotLib, /if \(\$safeMode === 'check'\) \{\s*return \$response;\s*\}/);
});

test('state and full runtime shapes produce the same conditional signature', () => {
    const php = [
        "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; }",
        requireRuntimeSnapshotLibPhp,
        "$state = ['app' => ['name' => 'app', 'id' => 'abc123000000', 'state' => 'running', 'running' => true, 'paused' => false, 'autostart' => true, 'Updated' => true]];",
        "$full = ['app' => ['Id' => 'abc123000000full-docker-id', 'info' => ['Name' => 'app', 'State' => ['Running' => true, 'Paused' => false, 'Autostart' => true, 'Updated' => true]]]];",
        "echo json_encode([runtimeSnapshotSignature('docker', $state), runtimeSnapshotSignature('docker', $full)]);"
    ].join(' ');
    const signatures = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: runtimeSnapshotPhpEnv }));
    assert.equal(signatures[0], signatures[1]);
    assert.match(signatures[0], /^[a-f0-9]{64}$/);
});

test('conditional runtime signatures notice matching metadata with unchanged state', () => {
    const php = [
        "function ensureType(string $type): string { return $type; }", requireRuntimeSnapshotLibPhp,
        "$base = ['app' => ['id' => 'abc123000000', 'Image' => 'repo/old', 'Labels' => ['stack' => 'media']]];",
        "$labels = $base; $labels['app']['Labels'] = [];",
        "$image = $base; $image['app']['Image'] = 'repo/new';",
        "echo json_encode(array_map(static fn($map) => runtimeSnapshotSignature('docker', $map), [$base, $labels, $image]));"
    ].join(' ');
    const signatures = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: runtimeSnapshotPhpEnv }));
    assert.equal(new Set(signatures).size, 3);
});

test('live snapshot tokens agree across state, full and check while config-only tokens omit runtime', () => {
    const dockerOrderPhp = dockerPageOrderLib.slice(dockerPageOrderLib.indexOf('function fvplus_append_unique_name('),
        dockerPageOrderLib.indexOf('function readDockerNativePageOrder('))
        + dockerPageOrderLib.slice(dockerPageOrderLib.indexOf('function composeDockerSavedOrder('),
            dockerPageOrderLib.indexOf('function buildDockerPageOrderModel('));
    const php = [
        "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; }",
        "function withConfigMutationLock(callable $callback) { return $callback(); }",
        "function readFolder(string $type): string { return json_encode(['folder-a' => ['name' => 'Media']]); }",
        "function readTypePrefs(string $type): array { return ['sortMode' => 'manual']; }",
        "function readDockerNativePageOrder(): array { return $GLOBALS['savedNativeOrder'] ?? ['app']; }",
        dockerOrderPhp,
        "function readUserPrefs(string $type): string { return '[]'; }",
        "function readConfigMetadata(string $type, bool $reconcile = true): array { return ['folderRevision' => (int)($GLOBALS['snapshotTestFolderRevision'] ?? 7), 'prefsRevision' => 9, 'folderSha256' => 'folder-hash', 'prefsSha256' => 'prefs-hash']; }",
        `function readInfoCached(string $type, string $mode = 'full', ?int $ttl = null, bool $force = false): array {
            $runtime = [];
            foreach (['app' => 'abc123000000', 'folder-folder-a' => 'def123000000'] as $name => $id) {
                $runtime[$name] = $mode === 'full'
                    ? ['Id' => $id . 'full-docker-id', 'info' => ['Name' => $name, 'State' => ['Running' => true, 'Paused' => false, 'Autostart' => true, 'Updated' => true]]]
                    : ['name' => $name, 'id' => $id, 'state' => 'running', 'running' => true, 'paused' => false, 'autostart' => true, 'Updated' => true];
            }
            return $runtime;
        }`,
        requireRuntimeSnapshotLibPhp,
        "$state = buildRuntimeSnapshot('docker', 'state');",
        "$full = buildRuntimeSnapshot('docker', 'full');",
        "$config = buildRuntimeSnapshot('docker', 'config');",
        "$combinedConfig = buildRuntimeConfigBootstrapSnapshot()['snapshots']['docker'];",
        "$check = buildRuntimeSnapshot('docker', 'check', $state['snapshotToken']);",
        "$GLOBALS['savedNativeOrder'] = ['folder-folder-a', 'app'];",
        "$reordered = buildRuntimeSnapshot('docker', 'state');",
        "$reorderedConfig = buildRuntimeSnapshot('docker', 'config');",
        "unset($GLOBALS['savedNativeOrder']);",
        "$GLOBALS['snapshotTestFolderRevision'] = 8;",
        "$changed = buildRuntimeSnapshot('docker', 'check', $state['snapshotToken']);",
        "echo json_encode(compact('state', 'full', 'config', 'combinedConfig', 'check', 'reordered', 'reorderedConfig', 'changed'));"
    ].join(' ');
    const result = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: runtimeSnapshotPhpEnv }));
    assert.deepEqual(result.state.order, ['app']);
    assert.deepEqual(result.full.order, result.state.order);
    assert.deepEqual(result.config.order, ['folder-folder-a', 'app']);
    assert.deepEqual(result.state.nativeSavedOrder, ['app']);
    assert.deepEqual(result.config.nativeSavedOrder, result.state.nativeSavedOrder);
    assert.deepEqual(result.combinedConfig.nativeSavedOrder, result.state.nativeSavedOrder);
    assert.deepEqual(result.reordered.order, ['folder-folder-a', 'app']);
    assert.deepEqual(result.reordered.nativeSavedOrder, ['folder-folder-a', 'app']);
    assert.deepEqual(result.reorderedConfig.nativeSavedOrder, result.reordered.nativeSavedOrder);
    assert.deepEqual(result.reordered.revisions, result.state.revisions);
    assert.equal(result.reordered.runtimeSignature, result.state.runtimeSignature);
    assert.notEqual(result.reordered.snapshotToken, result.state.snapshotToken);
    assert.equal(result.config.runtimeIncluded, false);
    assert.equal(result.config.snapshotToken, result.combinedConfig.snapshotToken);
    assert.notEqual(result.config.snapshotToken, result.state.snapshotToken);
    assert.equal(result.state.snapshotToken, result.full.snapshotToken);
    assert.equal(result.check.snapshotToken, result.state.snapshotToken);
    assert.equal(result.check.notModified, true);
    assert.equal(result.check.payloadIncluded, false);
    assert.equal(Object.hasOwn(result.check, 'folders'), false);
    assert.equal(Object.hasOwn(result.check, 'runtime'), false);
    assert.deepEqual(result.check.revisions, { folder: 7, prefs: 9 });
    assert.equal(result.changed.notModified, false);
    assert.notEqual(result.changed.snapshotToken, result.state.snapshotToken);
    assert.deepEqual(result.changed.revisions, { folder: 8, prefs: 9 });
});

test('numeric VM names stay keyed in snapshots and remain strings in native order', () => {
    const php = [
        "function ensureType(string $type): string { return $type; }",
        "function withConfigMutationLock(callable $callback) { return $callback(); }",
        "function readFolder(string $type): string { return '{}'; }",
        "function readTypePrefs(string $type): array { return []; }",
        "function readUserPrefs(string $type): string { return '[]'; }",
        "function readConfigMetadata(string $type, bool $reconcile = true): array { return []; }",
        "function readInfoCached(string $type, string $mode = 'full', ?int $ttl = null, bool $force = false): array { return $GLOBALS['fixtureVmInventory']; }",
        requireRuntimeSnapshotLibPhp,
        "$GLOBALS['fixtureVmInventory'] = ['0' => ['name' => '0', 'uuid' => 'fixture-zero', 'state' => 'running']];",
        "$state = buildRuntimeSnapshot('vm', 'state');",
        "$full = buildRuntimeSnapshot('vm', 'full');",
        "$GLOBALS['fixtureVmInventory'] = [];",
        "echo json_encode([$state, $full, buildRuntimeSnapshot('vm', 'state')]);"
    ].join(' ');
    const [state, full, empty] = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: runtimeSnapshotPhpEnv }));
    const client = loadClientApi();
    for (const snapshot of [state, full]) {
        assert.deepEqual(snapshot.unraidOrder, ['0']);
        assert.deepEqual(client.projectValue(client.parsePayload(snapshot), 'runtime'), {
            '0': { name: '0', uuid: 'fixture-zero', state: 'running' }
        });
    }
    assert.deepEqual(empty.runtime, []);
    assert.deepEqual(empty.unraidOrder, []);
});

test('numeric folder IDs and their expansion survive the real configuration endpoints and backup round trip', () => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-numeric-folder-'));
    const server = path.dirname(path.join(repoRoot, runtimeSnapshotLibPath));
    const require = createRequire(import.meta.url);
    const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
    try {
        for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
        const result = JSON.parse(execFileSync('php', ['tests/fixtures/numeric-folder-config.php', server, root], {
            encoding: 'utf8', timeout: 30000, env: {
                ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
                FVPLUS_TEST_STORAGE_DIR: root, FVPLUS_TEST_SECURITY_STATE_PATH: path.join(root, 'security/state.json'),
                FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'config/autostart')
            }
        }));
        assert.deepEqual(result.ids, ['0']);
        assert.equal(result.stablePrefsAfterReads, true);
        assert.deepEqual(result.manualOrder, ['0']);
        assert.deepEqual(result.reordered, ['0']);
        assert.equal(result.restored, 1);
        assert.deepEqual(result.expandedDelta, { '0': false, '1': true });
        for (const folders of [result.direct, result.metadata, result.snapshot.folders, result.backup.folders,
            result.backupFile.folders, result.environment.folders]) {
            assert.equal(Array.isArray(folders), false);
            assert.equal(utils.normalizeFolderMap(folders)['0'].name, 'Numeric ID');
        }
        for (const expanded of [result.saved, result.loaded, result.snapshot.prefs.expandedFolderState,
            result.backup.prefs.expandedFolderState, result.environment.prefs.expandedFolderState]) {
            assert.deepEqual(expanded, { '0': true });
            assert.deepEqual(utils.normalizePrefs({ expandedFolderState: expanded }).expandedFolderState, { '0': true });
        }
        const legacyBackup = { ...result.backupFile, folders: Object.values(result.backupFile.folders) };
        assert.equal(utils.parseImportPayload(legacyBackup, 'vm').folders['0'].name, 'Numeric ID');
    } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), base);
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('config snapshots return saved layout without touching host runtime discovery', () => {
    const php = [
        "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; }",
        "function withConfigMutationLock(callable $callback) { return $callback(); }",
        "function readFolder(string $type): string { return json_encode(['folder-a' => ['name' => 'Media', 'containers' => ['app']]]); }",
        "function readTypePrefs(string $type): array { return ['sortMode' => 'manual']; }",
        "function readDockerNativePageOrder(): array { return ['app']; }",
        "function composeDockerSavedOrder(array $order, array $folders, array $prefs, array $names): array { return ['folder-folder-a', ...$order]; }",
        "function readUserPrefs(string $type): string { return '[]'; }",
        "function readConfigMetadata(string $type, bool $reconcile = true): array { return ['folderRevision' => 7, 'prefsRevision' => 9, 'folderSha256' => 'folder-hash', 'prefsSha256' => 'prefs-hash']; }",
        "function readInfoCached(string $type, string $mode = 'full', ?int $ttl = null, bool $force = false): array { throw new RuntimeException('runtime discovery must not run'); }",
        "function readInfoState(string $type, bool $live = false): array { throw new RuntimeException('runtime discovery must not run'); }",
        requireRuntimeSnapshotLibPhp,
        "$result = buildRuntimeSnapshot('docker', 'config');",
        "$combined = buildRuntimeConfigBootstrapSnapshot();",
        "echo json_encode(['single' => $result, 'combined' => $combined]);"
    ].join(' ');
    const result = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8', env: runtimeSnapshotPhpEnv }));
    assert.equal(result.single.mode, 'config');
    assert.equal(result.single.payloadIncluded, true);
    assert.equal(result.single.runtimeIncluded, false);
    assert.equal(Object.hasOwn(result.single, 'runtime'), false);
    assert.equal(result.single.folders['folder-a'].name, 'Media');
    assert.deepEqual(result.single.order, ['folder-folder-a', 'app']);
    assert.equal(result.combined.kind, 'runtime_config_bootstrap');
    assert.equal(result.combined.snapshots.docker.folders['folder-a'].name, 'Media');
    assert.equal(result.combined.snapshots.vm.runtimeIncluded, false);
});

test('client projects one snapshot into legacy renderer inputs and falls back per field', async () => {
    const api = loadClientApi();
    const snapshot = {
        ok: true,
        kind: 'runtime_snapshot',
        schemaVersion: 1,
        type: 'docker',
        folders: { folder1: { name: 'Media' } },
        order: ['folder-folder1'],
        unraidOrder: ['app'],
        prefs: { sortMode: 'manual' },
        metadata: { folderRevision: 4, prefsRevision: 6 },
        runtime: { app: { state: 'running' } }
    };
    const projected = api.createProjectedBundle(
        Promise.resolve(JSON.stringify(snapshot)),
        ['folders', 'order', 'runtime', 'prefsResponse']
    );
    const values = (await Promise.all(projected)).map((value) => JSON.parse(value));
    assert.equal(values[0].folder1.name, 'Media');
    assert.deepEqual(Array.from(values[1]), ['folder-folder1']);
    assert.equal(values[2].app.state, 'running');
    assert.equal(values[3].prefs.sortMode, 'manual');
    assert.equal(values[3].metadata.folderRevision, 4);

    const fallback = api.createProjectedBundle(
        Promise.resolve('{}'),
        ['folders'],
        { fallbackFactories: [() => Promise.resolve('{"legacy":true}')] }
    );
    assert.deepEqual(JSON.parse(await fallback[0]), { legacy: true });
    assert.match(api.buildUrl('docker', 'check', { since: 'a'.repeat(64) }), /runtime_snapshot\.php\?type=docker&mode=check&since=/);
    assert.match(api.buildUrl('vm', 'config', { liveUpdateStatus: true }), /runtime_snapshot\.php\?type=vm&mode=config/);
    assert.doesNotMatch(api.buildUrl('docker', 'config', { liveUpdateStatus: true }), /liveupdate=/);
    assert.match(api.buildConfigBootstrapUrl(), /runtime_snapshot\.php\?type=all&mode=config/);
});

test('runtime order keys preserve sequence and distinguish an omitted order from an empty one', () => {
    const api = loadClientApi();
    const base = { order: ['folder-A', 'folder-B'], unraidOrder: ['0', '1'] };
    assert.equal(api.buildRuntimeOrderKey(base), api.buildRuntimeOrderKey({ ...base, unraidOrder: [0, 1], runtime: {} }));
    assert.notEqual(api.buildRuntimeOrderKey(base), api.buildRuntimeOrderKey({ ...base, order: base.order.toReversed() }));
    assert.notEqual(api.buildRuntimeOrderKey(base), api.buildRuntimeOrderKey({ ...base, unraidOrder: base.unraidOrder.toReversed() }));
    assert.notEqual(api.buildRuntimeOrderKey({ order: [], unraidOrder: [] }), null);
    assert.equal(api.buildRuntimeOrderKey({ order: base.order }), null);
});

test('combined configuration bootstrap validates both per-type snapshots', () => {
    const api = loadClientApi();
    const result = api.parseConfigBootstrapPayload({
        ok: true,
        kind: 'runtime_config_bootstrap',
        schemaVersion: 1,
        snapshots: {
            docker: { kind: 'runtime_snapshot', schemaVersion: 1, type: 'docker', mode: 'config', folders: {} },
            vm: { kind: 'runtime_snapshot', schemaVersion: 1, type: 'vm', mode: 'config', folders: {} }
        }
    });
    assert.equal(result.snapshots.docker.type, 'docker');
    assert.equal(result.snapshots.vm.type, 'vm');
    assert.throws(() => api.parseConfigBootstrapPayload({ kind: 'runtime_config_bootstrap', schemaVersion: 1, snapshots: {} }));
});

test('runtime row diff isolates state changes and distinguishes structural changes', () => {
    const api = loadClientApi();
    assert.equal(
        api.buildRuntimeRowToken('docker', {
            shortId: 'abc123000000',
            Labels: { 'folderview.plus': 'Media' },
            info: { State: { Running: true, Paused: false, Autostart: true, Updated: true, manager: 'dockerman' } }
        }),
        api.buildRuntimeRowToken('docker', {
            id: 'abc123000000',
            folderLabel: 'Media',
            running: true,
            paused: false,
            autostart: true,
            Updated: true,
            manager: 'dockerman'
        })
    );
    const previousDocker = {
        app: { id: 'abc123000000', running: true, paused: false, autostart: true, Updated: true },
        db: { id: 'def456000000', running: true, paused: false, autostart: true, Updated: true }
    };
    const nextDocker = {
        app: { id: 'abc123000000', running: false, paused: false, autostart: true, Updated: true },
        db: { id: 'def456000000', running: true, paused: false, autostart: true, Updated: true }
    };
    const stateDiff = api.diffRuntimeRows('docker', previousDocker, nextDocker);
    assert.deepEqual(Array.from(stateDiff.changed), ['app']);
    assert.deepEqual(Array.from(stateDiff.unchanged), ['db']);
    assert.equal(stateDiff.structuralChanged, false);
    assert.equal(stateDiff.hasChanges, true);

    const structuralDiff = api.diffRuntimeRows('vm', {
        media: { uuid: 'vm-1', state: 'running', autostart: true }
    }, {
        media: { uuid: 'vm-1', state: 'running', autostart: true },
        backup: { uuid: 'vm-2', state: 'shutoff', autostart: false }
    });
    assert.deepEqual(Array.from(structuralDiff.added), ['backup']);
    assert.equal(structuralDiff.structuralChanged, true);
});

test('runtime pages patch state changes incrementally and retain structural fallbacks', () => {
    assert.match(dockerJs, /runtimeSnapshotApi\.diffRuntimeRows\('docker',\s*previousRuntimeInfo,\s*nextRuntimeInfo\)/);
    assert.match(dockerJs, /syncDockerVisibleFoldersFromRuntimeCache\(rowDiff\.changed\)/);
    assert.match(dockerJs, /if \(rowDiff\.structuralChanged\) \{[\s\S]*mode: 'structural-fallback'/);
    assert.match(dockerJs, /await refreshDockerRuntimeStateInPlace\(\{[\s\S]*liveUpdateStatus:/);
    assert.match(vmJs, /const refreshVmRuntimeStateInPlace = async \(options = \{\}\) =>/);
    assert.match(vmJs, /runtimeSnapshotApi\.diffRuntimeRows\('vm',\s*vmRuntimeInfoByName,\s*nextRuntimeInfo\)/);
    assert.match(vmJs, /syncVmRuntimeRows\(rowDiff\.changed\)/);
    assert.match(dashboardJs, /const refreshDashboardTypeRuntimeStateInPlace = async \(type, \{ isCurrent = \(\) => true \} = \{\}\) =>/);
    assert.match(dashboardJs, /runtimeSnapshotApi\.diffRuntimeRows\(resolvedType,\s*dashboardRuntimeInfoByType\[resolvedType\],\s*nextRuntimeInfo\)/);
    assert.match(dashboardJs, /syncDashboardRuntimeRows\(resolvedType,\s*rowDiff\.changed,\s*nextRuntimeInfo\)/);
});

test('runtime bootstraps use coherent snapshots while Docker polling is API-first', () => {
    assert.match(dockerJs, /createProjectedBundle\([\s\S]*\['folders', 'order', 'runtime', 'prefsResponse'\]/);
    assert.match(dockerJs, /buildUrl\('docker', 'config'/);
    assert.match(dockerJs, /dockerApiCoordinatorModule\?\.createIntegration/);
    assert.doesNotMatch(dockerJs, /buildUrl\('docker', 'check'/);
    assert.match(dockerJs, /lastDockerRuntimeSnapshotToken/);
    assert.match(vmJs, /createProjectedBundle\([\s\S]*\['folders', 'order', 'runtime', 'unraidOrder', 'prefsResponse'\]/);
    assert.match(vmJs, /buildUrl\('vm', 'check'/);
    assert.match(vmJs, /lastVmRuntimeSnapshotToken/);
    assert.match(dashboardJs, /createProjectedBundle\([\s\S]*\['folders', 'order', 'runtime', 'unraidOrder', 'prefsResponse'\]/);
    assert.match(dashboardJs, /buildUrl\(resolvedType, 'check'/);
    assert.match(dashboardJs, /lastDashboardSnapshotTokens/);
});

test('Settings bootstrap paints config first and hydrates Docker and VM runtime independently', () => {
    assert.match(settingsJs, /const runtimeSnapshotApi = window\.FolderViewPlusRuntimeSnapshot \|\| null;/);
    assert.match(settingsJs, /const fetchSettingsCoreSnapshot = async \(type, options = \{\}\) => \{[\s\S]*const mode = configOnly \? 'config' : 'state';[\s\S]*runtimeSnapshotApi\.buildUrl\(resolvedType, mode/);
    assert.match(settingsJs, /const fetchSettingsCombinedConfigSnapshots = async \(\) => \{[\s\S]*buildConfigBootstrapUrl[\s\S]*parseConfigBootstrapPayload/);
    assert.match(settingsJs, /runtimeSnapshotApi\.parsePayload\(await apiGetJson\(url\)\)/);
    assert.match(settingsJs, /folderRevision: readSettingsFolderRevision\(snapshot\.metadata\)/);
    assert.match(settingsJs, /folderSnapshotsByType\[type\] = \{ folders, revision: folderRevision, sequence \};[\s\S]*diagnosticsPrefsCoordinator\.reconcile\(type, normalizedPrefs/);
    assert.match(settingsJs, /const fallbackRequests = \[fetchFolders\(type\), fetchPrefs\(type\)\];[\s\S]*if \(!configOnly\) \{\s*fallbackRequests\.push\(fetchTypeInfo\(type\)\);/);
    assert.match(settingsJs, /fetchSettingsCombinedConfigSnapshots\(\)[\s\S]*snapshot: combined\.snapshots\.docker[\s\S]*snapshot: combined\.snapshots\.vm[\s\S]*per-type-config-fallback/);
    assert.match(settingsJs, /const runtimeHydrationPromise = hydrateSettingsRuntime\(options\.initialBootstrap === true\);/);
    assert.match(settingsJs, /window\.FolderViewPlusSettingsRuntimeHydrationPromise = runtimeHydrationPromise;/);
    assert.match(settingsJs, /const hideEmptyFolders = runtimeReady[\s\S]*hideEmptyFolders === true;/);
});

test('all runtime pages load the snapshot client before their main runtime', () => {
    const assertOrder = (page, runtimePath) => {
        const snapshotIndex = page.indexOf('/plugins/folderview.plus/scripts/folderviewplus.runtime-snapshot.js');
        const runtimeIndex = page.indexOf(runtimePath);
        assert.ok(snapshotIndex >= 0);
        assert.ok(runtimeIndex >= 0);
        assert.ok(snapshotIndex < runtimeIndex);
    };
    assertOrder(dockerPage, '/plugins/folderview.plus/scripts/docker.js');
    assertOrder(vmPage, '/plugins/folderview.plus/scripts/vm.js');
    assertOrder(dashboardPage, '/plugins/folderview.plus/scripts/dashboard.js');
    assertOrder(settingsPage, '/plugins/folderview.plus/scripts/folderviewplus.js');
    assert.match(installSmoke, /server\/runtime_snapshot\.php/);
    assert.match(installSmoke, /scripts\/folderviewplus\.runtime-snapshot\.js/);
    assert.match(releaseGuard, /server\/runtime_snapshot\.php/);
});
