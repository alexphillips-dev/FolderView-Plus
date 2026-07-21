import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const runtimeSnapshotLibPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.runtime-snapshot.php';
const runtimeSnapshotEndpointPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/runtime_snapshot.php';
const runtimeSnapshotClientPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-snapshot.js';
const runtimeSnapshotLib = read(runtimeSnapshotLibPath);
const runtimeSnapshotEndpoint = read(runtimeSnapshotEndpointPath);
const runtimeSnapshotClient = read(runtimeSnapshotClientPath);
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
    assert.match(runtimeSnapshotLib, /function readRuntimeSnapshotConfigUnlocked\(string \$type\): array \{[\s\S]*readFolder\(\$safeType\)[\s\S]*readTypePrefs\(\$safeType\)[\s\S]*readUserPrefs\(\$safeType\)[\s\S]*readConfigMetadata\(\$safeType, true\)/);
    assert.match(runtimeSnapshotLib, /function readRuntimeSnapshotConfig\(string \$type\): array \{[\s\S]*withConfigMutationLock\(static function[\s\S]*readRuntimeSnapshotConfigUnlocked\(\$safeType\)/);
    assert.match(runtimeSnapshotLib, /function buildRuntimeConfigBootstrapSnapshot\(\): array \{[\s\S]*withConfigMutationLock\(static function[\s\S]*readRuntimeSnapshotConfigUnlocked\('docker'\)[\s\S]*readRuntimeSnapshotConfigUnlocked\('vm'\)/);
    assert.match(runtimeSnapshotLib, /function runtimeSnapshotToken\([\s\S]*folderRevision[\s\S]*prefsRevision[\s\S]*runtimeSignature/);
    assert.match(runtimeSnapshotLib, /\$notModified = \$safeMode === 'check'[\s\S]*hash_equals\(\$snapshotToken, \$safeSinceToken\)/);
    assert.match(runtimeSnapshotLib, /if \(\$safeMode === 'check'\) \{\s*return \$response;\s*\}/);
});

test('state and full runtime shapes produce the same conditional signature', () => {
    const absoluteLib = path.join(repoRoot, runtimeSnapshotLibPath).replace(/\\/g, '/').replace(/'/g, "\\'");
    const php = [
        "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; }",
        `require '${absoluteLib}';`,
        "$state = ['app' => ['name' => 'app', 'id' => 'abc123000000', 'state' => 'running', 'running' => true, 'paused' => false, 'autostart' => true, 'Updated' => true]];",
        "$full = ['app' => ['Id' => 'abc123000000full-docker-id', 'info' => ['Name' => 'app', 'State' => ['Running' => true, 'Paused' => false, 'Autostart' => true, 'Updated' => true]]]];",
        "echo json_encode([runtimeSnapshotSignature('docker', $state), runtimeSnapshotSignature('docker', $full)]);"
    ].join(' ');
    const signatures = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    assert.equal(signatures[0], signatures[1]);
    assert.match(signatures[0], /^[a-f0-9]{64}$/);
});

test('snapshot tokens are mode-independent and unchanged checks omit payloads', () => {
    const absoluteLib = path.join(repoRoot, runtimeSnapshotLibPath).replace(/\\/g, '/').replace(/'/g, "\\'");
    const php = [
        "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; }",
        "function withConfigMutationLock(callable $callback) { return $callback(); }",
        "function readFolder(string $type): string { return json_encode(['folder-a' => ['name' => 'Media']]); }",
        "function readTypePrefs(string $type): array { return ['sortMode' => 'manual']; }",
        "function readUserPrefs(string $type): string { return json_encode(['folder-folder-a', 'app']); }",
        "function readConfigMetadata(string $type, bool $reconcile = true): array { return ['folderRevision' => (int)($GLOBALS['snapshotTestFolderRevision'] ?? 7), 'prefsRevision' => 9, 'folderSha256' => 'folder-hash', 'prefsSha256' => 'prefs-hash']; }",
        "function readInfoCached(string $type, string $mode = 'full', ?int $ttl = null, bool $force = false): array { if ($mode === 'full') { return ['app' => ['Id' => 'abc123000000full-docker-id', 'info' => ['Name' => 'app', 'State' => ['Running' => true, 'Paused' => false, 'Autostart' => true, 'Updated' => true]]]]; } return readInfoState($type); }",
        "function readInfoState(string $type, bool $live = false): array { return ['app' => ['name' => 'app', 'id' => 'abc123000000', 'state' => 'running', 'running' => true, 'paused' => false, 'autostart' => true, 'Updated' => true]]; }",
        `require '${absoluteLib}';`,
        "$state = buildRuntimeSnapshot('docker', 'state');",
        "$full = buildRuntimeSnapshot('docker', 'full');",
        "$check = buildRuntimeSnapshot('docker', 'check', $state['snapshotToken']);",
        "$GLOBALS['snapshotTestFolderRevision'] = 8;",
        "$changed = buildRuntimeSnapshot('docker', 'check', $state['snapshotToken']);",
        "echo json_encode(['stateToken' => $state['snapshotToken'], 'fullToken' => $full['snapshotToken'], 'check' => $check, 'changed' => $changed]);"
    ].join(' ');
    const result = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    assert.equal(result.stateToken, result.fullToken);
    assert.equal(result.check.notModified, true);
    assert.equal(result.check.payloadIncluded, false);
    assert.equal(Object.hasOwn(result.check, 'folders'), false);
    assert.equal(Object.hasOwn(result.check, 'runtime'), false);
    assert.deepEqual(result.check.revisions, { folder: 7, prefs: 9 });
    assert.equal(result.changed.notModified, false);
    assert.notEqual(result.changed.snapshotToken, result.stateToken);
    assert.deepEqual(result.changed.revisions, { folder: 8, prefs: 9 });
});

test('config snapshots return saved layout without touching host runtime discovery', () => {
    const absoluteLib = path.join(repoRoot, runtimeSnapshotLibPath).replace(/\\/g, '/').replace(/'/g, "\\'");
    const php = [
        "function ensureType(string $type): string { return $type === 'vm' ? 'vm' : 'docker'; }",
        "function withConfigMutationLock(callable $callback) { return $callback(); }",
        "function readFolder(string $type): string { return json_encode(['folder-a' => ['name' => 'Media', 'containers' => ['app']]]); }",
        "function readTypePrefs(string $type): array { return ['sortMode' => 'manual']; }",
        "function readUserPrefs(string $type): string { return json_encode(['folder-folder-a', 'app']); }",
        "function readConfigMetadata(string $type, bool $reconcile = true): array { return ['folderRevision' => 7, 'prefsRevision' => 9, 'folderSha256' => 'folder-hash', 'prefsSha256' => 'prefs-hash']; }",
        "function readInfoCached(string $type, string $mode = 'full', ?int $ttl = null, bool $force = false): array { throw new RuntimeException('runtime discovery must not run'); }",
        "function readInfoState(string $type, bool $live = false): array { throw new RuntimeException('runtime discovery must not run'); }",
        `require '${absoluteLib}';`,
        "$result = buildRuntimeSnapshot('docker', 'config');",
        "$combined = buildRuntimeConfigBootstrapSnapshot();",
        "echo json_encode(['single' => $result, 'combined' => $combined]);"
    ].join(' ');
    const result = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
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
    assert.match(dashboardJs, /const refreshDashboardTypeRuntimeStateInPlace = async \(type\) =>/);
    assert.match(dashboardJs, /runtimeSnapshotApi\.diffRuntimeRows\(resolvedType,\s*dashboardRuntimeInfoByType\[resolvedType\],\s*nextRuntimeInfo\)/);
    assert.match(dashboardJs, /syncDashboardRuntimeRows\(resolvedType,\s*rowDiff\.changed\)/);
});

test('Docker, VM, and Dashboard bootstrap and polling use the coherent endpoint', () => {
    assert.match(dockerJs, /createProjectedBundle\([\s\S]*\['folders', 'order', 'runtime', 'prefsResponse'\]/);
    assert.match(dockerJs, /buildUrl\('docker', 'check'/);
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
    assert.match(settingsJs, /diagnosticsPrefsCoordinator\.reconcile\(resolvedType, snapshotPrefs/);
    assert.match(settingsJs, /const fallbackRequests = \[fetchFolders\(type\), fetchPrefs\(type\)\];[\s\S]*if \(!configOnly\) \{\s*fallbackRequests\.push\(fetchTypeInfo\(type\)\);/);
    assert.match(settingsJs, /fetchSettingsCombinedConfigSnapshots\(\)[\s\S]*snapshot: combined\.snapshots\.docker[\s\S]*snapshot: combined\.snapshots\.vm[\s\S]*per-type-config-fallback/);
    assert.match(settingsJs, /const runtimeHydrationPromise = Promise\.allSettled\(\[\s*refreshType\('docker'\),\s*refreshType\('vm'\)\s*\]\);/);
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
