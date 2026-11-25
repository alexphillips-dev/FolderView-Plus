import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runConfigWriteFixture } from './helpers/config-write-fixture.mjs';

test('a rejected preference save preserves patch state and the revision used for retry', () => {
    for (const type of ['docker', 'vm']) {
        const result = runConfigWriteFixture({ type, kind: 'prefs', stage: 'metadata-open' });
        assert.ok(result.error);
        assert.deepEqual(result.after, result.before);
        assert.equal(result.metadata.prefsRevision, 1);
        assert.equal(result.metadata.folderRevision, 1);
    }
});

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const require = createRequire(import.meta.url);
const prefsStore = require(path.join(pluginRoot, 'scripts/folderviewplus.prefs-store.js'));
const folderDefaults = require(path.join(pluginRoot, 'scripts/folder.editor.defaults.js'));
const utils = require(path.join(pluginRoot, 'scripts/folderviewplus.utils.js'));
const libPath = path.join(pluginRoot, 'server/lib.php');
const prefsEndpoint = fs.readFileSync(path.join(pluginRoot, 'server/prefs.php'), 'utf8');
const phpQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const buildHarness = () => `<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpQuote(libPath)};

$current = defaultTypePrefs();
$current['dashboard']['privacyMaskNames'] = true;
$current['dashboard']['privacyMaskPorts'] = true;
$current['pinnedFolderIds'] = ['one', 'two'];
$merged = mergeTypePrefsPatch($current, [
    'dashboard' => ['privacyMaskPorts' => false],
    'pinnedFolderIds' => ['three']
]);

writeRawFolderMap('docker', [
    'folder-one' => ['name' => 'One', 'containers' => ['alpha']]
]);
writeTypePrefs('docker', $current);
$saved = writeTypePrefs('docker', mergeTypePrefsPatch($current, [
    'backupSchedule' => ['enabled' => false, 'intervalHours' => 24]
]));
$backupsAfterPrefsSave = count(listBackupSnapshots('docker'));
writeTypePrefs('docker', defaultTypePrefs());
$readFolderCount = count((array)json_decode(readFolder('docker'), true));
$backupsAfterFolderRead = count(listBackupSnapshots('docker'));
runScheduledBackups('docker');
$backupsAfterScheduledRun = count(listBackupSnapshots('docker'));
runScheduledBackups('docker');

echo json_encode([
    'dashboard' => $merged['dashboard'],
    'pinnedFolderIds' => $merged['pinnedFolderIds'],
    'defaultSchedule' => defaultTypePrefs()['backupSchedule'],
    'savedSchedule' => $saved['backupSchedule'],
    'backupsAfterPrefsSave' => $backupsAfterPrefsSave,
    'readFolderCount' => $readFolderCount,
    'backupsAfterFolderRead' => $backupsAfterFolderRead,
    'backupsAfterScheduledRun' => $backupsAfterScheduledRun,
    'backupCount' => count(listBackupSnapshots('docker'))
], JSON_UNESCAPED_SLASHES);
`;

const runHarness = (source = buildHarness(), run = invoke => invoke()) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-prefs-save-'));
    const harnessPath = path.join(tempDir, 'prefs-save.php');
    const documentRoot = path.join(tempDir, 'document-root');
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.writeFileSync(harnessPath, source, 'utf8');
    try {
        return run((...args) => JSON.parse(execFileSync('php', [harnessPath, ...args], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000,
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: path.join(tempDir, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(tempDir, 'runtime'),
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        })));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

test('saved defaults replace and clear through client patches, PHP persistence and new-folder inheritance', () => {
    const initial = { sourceId: 'source', sourceName: 'Source', profile: {
        icon: '/plugins/folderview.plus/images/folder-icon.png', settings: { preview: 4, preview_rows: 3 },
        actions: [{ name: 'Fixture action', type: 1, command: 'echo fixture' }]
    } };
    const smaller = { sourceId: 'other', sourceName: 'Other', profile: { icon: '', settings: { preview: 1 }, actions: [] } };
    const empty = { sourceId: '', sourceName: '', profile: { icon: '', settings: {}, actions: [] } };
    const baseline = { folderDefaults: initial, dashboard: { privacyMaskNames: true, privacyMaskPorts: true } };
    const replacement = prefsStore.cleanPatch({ folderDefaults: smaller }, baseline);
    const clear = prefsStore.cleanPatch({ folderDefaults: empty }, baseline);
    assert.deepEqual(prefsStore.mergePatch(baseline, replacement).folderDefaults, smaller);
    assert.deepEqual(prefsStore.mergePatch(baseline, clear).folderDefaults, empty);
    assert.deepEqual(prefsStore.cleanPatch({ ...baseline, dashboard: { ...baseline.dashboard, privacyMaskPorts: false } }, baseline),
        { dashboard: { privacyMaskPorts: false } }, 'unmodified profiles must stay out of unrelated broad writes');
    const result = runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpQuote(libPath)};
$initial = json_decode(${phpQuote(JSON.stringify(initial))}, true);
$patches = json_decode(${phpQuote(JSON.stringify([replacement, clear]))}, true);
$result = [];
foreach (['docker', 'vm'] as $type) {
    $prefs = defaultTypePrefs();
    $prefs['folderDefaults'] = $initial;
    $prefs['dashboard']['privacyMaskNames'] = false;
    writeTypePrefs($type, $prefs);
    $result[$type][] = ['prefs' => readTypePrefs($type)];
    foreach ($patches as $patch) {
        $before = readConfigMetadata($type, false);
        writeTypePrefs($type, mergeTypePrefsPatch(readTypePrefs($type), $patch));
        $saved = readTypePrefs($type);
        $after = readConfigMetadata($type, false);
        $result[$type][] = ['prefs' => $saved, 'before' => $before, 'after' => $after];
    }
}
echo json_encode($result, JSON_UNESCAPED_SLASHES);`);
    for (const type of ['docker', 'vm']) {
        const [original, replaced, cleared] = result[type];
        assert.equal(folderDefaults.readProfile(original.prefs).folder.actions.length, 1);
        assert.equal(original.prefs.folderDefaults.profile.settings.preview_rows, 3);
        assert.equal(original.prefs.folderDefaults.profile.icon, initial.profile.icon);
        assert.equal(replaced.prefs.folderDefaults.profile.settings.preview, 1);
        assert.equal(replaced.prefs.folderDefaults.profile.settings.preview_rows, undefined);
        assert.equal(replaced.prefs.folderDefaults.profile.actions.length, 0);
        assert.equal(folderDefaults.readProfile(replaced.prefs).folder.settings.preview, 1);
        assert.equal(folderDefaults.readProfile(cleared.prefs), null);
        assert.equal(Object.keys(cleared.prefs.folderDefaults.profile.settings).length, 0);
        for (const step of [replaced, cleared]) {
            assert.equal(step.prefs.dashboard.privacyMaskNames, false);
            assert.equal(step.after.prefsRevision, step.before.prefsRevision + 1);
            assert.equal(step.after.folderRevision, step.before.folderRevision);
        }
    }
});

test('folder editor bootstraps the defaults profile and revision together before a competing save', async () => {
    const page = fs.readFileSync(path.join(pluginRoot, 'Folder.page'), 'utf8');
    const bootstrap = page.match(/try \{\r?\n    \$folderEditorPageType = ensureType[\s\S]+?(?=\r?\n\?>)/)?.[0];
    assert.ok(bootstrap, 'exercise the shipped editor bootstrap');
    const endpoint = prefsEndpoint.replace(/^<\?php\s+require_once\([^;]+;\s*/u, '');
    assert.notEqual(endpoint, prefsEndpoint);
    const results = await runHarness(`<?php
namespace EditorDefaultsFixture {
    function readTypePrefs(string $type): array {
        $prefs = \\readTypePrefs($type);
        // A second request can write now only if the page has released the configuration lock.
        if (is_resource($GLOBALS['fvplus_config_mutation_lock_handle'] ?? null)) $GLOBALS['fixtureWritePending'] = true;
        else \\fixtureConcurrentSave($type);
        return $prefs;
    }
}
namespace {
    $_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
    putenv('FVPLUS_TEST_SECURITY_STATE_PATH=' . dirname(getenv('FVPLUS_TEST_CONFIG_DIR')) . '/security-state.json');
    require_once ${phpQuote(libPath)};

    function fixtureConcurrentSave(string $type): void {
        $prefs = readTypePrefs($type);
        $prefs['folderDefaults']['profile']['icon'] = '/icons/concurrent.png';
        writeTypePrefs($type, $prefs);
    }

    $type = $argv[2];
    if ($argv[1] === 'bootstrap') {
        writeTypePrefs($type, ['folderDefaults' => ['profile' => ['icon' => '/icons/original.png', 'settings' => ['preview' => 1]]]]);
        $_GET = ['type' => $type, 'defaults' => '1'];
        $folderEditorBootstrapContext = ['requestedId' => '', 'resolvedId' => '', 'folder' => null];
        eval('namespace EditorDefaultsFixture;' . ${phpQuote(bootstrap)});
        if (!empty($GLOBALS['fixtureWritePending'])) fixtureConcurrentSave($type);
        echo json_encode(['prefs' => $folderEditorTypePrefs, 'metadata' => $folderEditorBootstrapContext['metadata'],
            'currentRevision' => readConfigMetadata($type, false)['prefsRevision']]);
        return;
    }

    $_SERVER['SCRIPT_FILENAME'] = 'prefs.php';
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['HTTP_ORIGIN'] = 'http://localhost';
    $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $_SERVER['HTTP_X_FV_TOKEN'] = getConfiguredRequestToken();
    $_POST = $_REQUEST = json_decode($argv[3], true) + ['_fv_nonce' => fvplus_issue_mutation_nonce('prefs.php')['nonce']];
    ob_start();
    eval(${phpQuote(endpoint)});
    $response = json_decode(ob_get_clean(), true);
    releaseConfigMutationLock();
    echo json_encode(['status' => http_response_code(), 'response' => $response, 'prefs' => readTypePrefs($type)]);
}`, invoke => Promise.all(['docker', 'vm'].map(type => {
        const snapshot = invoke('bootstrap', type);
        const { folder } = folderDefaults.readProfile(snapshot.prefs);
        assert.equal(folder.icon, '/icons/original.png');
        assert.equal(snapshot.metadata.prefsRevision, snapshot.prefs._metadata.prefsRevision);
        assert.equal(snapshot.currentRevision, snapshot.prefs._metadata.prefsRevision + 1);
        folder.settings.preview = 2;
        return folderDefaults.save({ folder, type, prefs: snapshot.prefs,
            transfer: { normalizeFolderSettingsPayload: payload => ({ payload }) },
            post: (_url, payload) => invoke('save', type, JSON.stringify(payload)) });
    })));
    for (const { status, response, prefs } of results) {
        assert.equal(status, 409, JSON.stringify(response));
        assert.equal(response.ok, false);
        assert.equal(prefs.folderDefaults.profile.icon, '/icons/concurrent.png');
        assert.equal(prefs.folderDefaults.profile.settings.preview, 1);
    }
});

test('health threshold pairs preserve zero and agree after JavaScript and PHP reload normalization', () => {
    const cases = [[0, 90, 0, 90], [0, 0, 0, 5], [60, 20, 60, 65], [95, 10, 95, 100], [100, 0, 100, 100],
        [-20, 150, 0, 100], ['invalid', 'invalid', 60, 90]];
    const saved = runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpQuote(libPath)};
$cases = json_decode(${phpQuote(JSON.stringify(cases))}, true);
$result = [];
foreach ($cases as $case) {
    writeTypePrefs('docker', ['health' => ['warnStoppedPercent' => $case[0], 'criticalStoppedPercent' => $case[1]]]);
    $result[] = readTypePrefs('docker')['health'];
}
echo json_encode($result);`);
    cases.forEach(([warn, critical, expectedWarn, expectedCritical], index) => {
        const client = utils.normalizePrefs({ health: { warnStoppedPercent: warn, criticalStoppedPercent: critical } }).health;
        assert.equal(client.warnStoppedPercent, expectedWarn);
        assert.equal(client.criticalStoppedPercent, expectedCritical);
        assert.equal(saved[index].warnStoppedPercent, expectedWarn);
        assert.equal(saved[index].criticalStoppedPercent, expectedCritical);
    });
});

test('unassigned grouping saves a narrow preference patch and refreshes only the selected type', () => {
    const endpoint = prefsEndpoint.replace(/^<\?php\s+require_once\([^\r\n]+\);\s*/, '');
    assert.notEqual(endpoint, prefsEndpoint, 'load the shipped endpoint using the isolated source directory');
    for (const [type, enabled] of [['docker', true], ['vm', false]]) {
        const result = runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
putenv('FVPLUS_TEST_SECURITY_STATE_PATH=' . dirname(getenv('FVPLUS_TEST_CONFIG_DIR')) . '/security-state.json');
require_once ${phpQuote(libPath)};
require_once ${phpQuote(path.join(pluginRoot, 'server/lib.runtime-snapshot.php'))};
$type = ${phpQuote(type)};
$otherType = $type === 'docker' ? 'vm' : 'docker';
$group = ${enabled ? 'true' : 'false'};
$seed = ['hideEmptyFolders' => true, 'dashboard' => ['layout' => 'accordion']];
if (!$group) $seed['groupUnassignedItems'] = true;
writeTypePrefs($type, $seed);
writeTypePrefs($otherType, ['groupUnassignedItems' => !$group]);
$snapshot = static fn($type) => buildRuntimeConfigSnapshotFromConfig($type, readRuntimeSnapshotConfig($type));
$before = $snapshot($type);
$otherBefore = $snapshot($otherType);
$_SERVER['SCRIPT_FILENAME'] = 'prefs.php';
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['HTTP_ORIGIN'] = 'http://localhost';
$_SERVER['HTTP_X_FV_REQUEST'] = '1';
$_SERVER['HTTP_X_FV_TOKEN'] = getConfiguredRequestToken();
$_POST = [
    'type' => $type, 'expectedRevision' => (string)$before['revisions']['prefs'],
    'prefs' => json_encode(['groupUnassignedItems' => $group]),
    '_fv_nonce' => fvplus_issue_mutation_nonce('prefs.php')['nonce']
];
ob_start();
eval(${phpQuote(endpoint)});
$response = json_decode(ob_get_clean(), true);
releaseConfigMutationLock();
$after = $snapshot($type);
$otherAfter = $snapshot($otherType);
$environment = normalizeEnvironmentSnapshotPayload(['types' => [
    $type => ['prefs' => $after['prefs']], $otherType => ['prefs' => $otherAfter['prefs']]
]]);
$malformedRejected = false;
try { fvplus_assert_prefs_payload_shape(['groupUnassignedItems' => ['bad' => true]]); }
catch (RuntimeException $error) { $malformedRejected = true; }
echo json_encode(compact('before', 'after', 'otherBefore', 'otherAfter', 'response', 'environment', 'malformedRejected'));`);
        const { before, after, otherBefore, otherAfter, response, environment, malformedRejected } = result;
        assert.equal(response.ok, true, JSON.stringify(response));
        assert.equal(response.prefs.groupUnassignedItems, enabled);
        assert.equal(before.prefs.groupUnassignedItems, !enabled);
        assert.equal(utils.normalizePrefs(after.prefs).groupUnassignedItems, enabled);
        assert.equal(after.prefs.hideEmptyFolders, true);
        assert.equal(after.prefs.dashboard.layout, 'accordion');
        assert.equal(after.revisions.folder, before.revisions.folder);
        assert.equal(after.revisions.prefs, before.revisions.prefs + 1);
        assert.notEqual(after.snapshotToken, before.snapshotToken);
        assert.equal(otherAfter.snapshotToken, otherBefore.snapshotToken);
        assert.equal(environment.types[type].prefs.groupUnassignedItems, enabled);
        assert.equal(malformedRejected, true);
    }
    assert.equal(utils.normalizePrefs({}).groupUnassignedItems, false);
    assert.equal(utils.normalizePrefs({ groupUnassignedItems: 'true' }).groupUnassignedItems, false);
});

test('Docker row placement round trips through guarded preferences and snapshot reads without syncing native order', () => {
    const endpoint = prefsEndpoint.replace(/^<\?php\s+require_once\([^;]+;\s*/u, '');
    assert.notEqual(endpoint, prefsEndpoint);
    assert.equal(utils.normalizePrefs({}).dockerRowPlacement, 'folders-first');
    assert.equal(utils.normalizePrefs({ dockerRowPlacement: ['saved-order'] }).dockerRowPlacement, 'folders-first');
    runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
putenv('FVPLUS_TEST_SECURITY_STATE_PATH=' . dirname(getenv('FVPLUS_TEST_CONFIG_DIR')) . '/security-state.json');
require_once ${phpQuote(libPath)};
$stage = $argv[1];
$nativeOrder = getenv('FVPLUS_TEST_CONFIG_DIR') . '/fixture-autostart';
putenv('FVPLUS_TEST_DOCKER_AUTOSTART_FILE=' . $nativeOrder);
$result = [];
if ($stage === 'seed') {
    writeRawFolderMap('docker', ['example' => ['name' => 'Example', 'containers' => ['fixture-a']]]);
    writeTypePrefs('docker', ['sortMode' => 'manual', 'manualOrder' => ['example'], 'dockerStartOrder' => ['mode' => 'unmanaged']]);
    writeTypePrefs('vm', defaultTypePrefs());
    file_put_contents($nativeOrder, "fixture-b\nfixture-a\n");
} elseif ($stage === 'save') {
    $_SERVER['SCRIPT_FILENAME'] = 'prefs.php';
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['HTTP_ORIGIN'] = 'http://localhost';
    $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $_SERVER['HTTP_X_FV_TOKEN'] = getConfiguredRequestToken();
    $_POST = $_REQUEST = ['type' => 'docker', 'expectedRevision' => $argv[2], 'prefs' => $argv[3],
        '_fv_nonce' => fvplus_issue_mutation_nonce('prefs.php')['nonce']];
    $fixture = <<<'STUB'
namespace DockerRowPlacementFixture;
function syncContainerOrder(string $type): array {
    throw new \\LogicException('A presentation setting must not sync native order.');
}
STUB;
    ob_start();
    eval($fixture . "\n" . ${phpQuote(endpoint)});
    $result = ['status' => http_response_code(), 'body' => json_decode(ob_get_clean(), true)];
    releaseConfigMutationLock();
} elseif ($stage === 'backup') {
    $backup = createBackupSnapshot('docker', 'manual');
    $result['backupPlacement'] = readBackupSnapshot('docker', $backup['name'])['prefs']['dockerRowPlacement'];
}
$prefs = readTypePrefs('docker');
$meta = readConfigMetadata('docker', true);
$vm = readTypePrefs('vm');
$environment = normalizeEnvironmentSnapshotPayload(['types' => ['docker' => ['prefs' => $prefs], 'vm' => ['prefs' => $vm]]]);
echo json_encode($result + ['prefs' => $prefs, 'meta' => $meta, 'vmRevision' => readConfigMetadata('vm', true)['prefsRevision'],
    'nativeOrder' => file_get_contents($nativeOrder), 'environmentPlacement' => $environment['types']['docker']['prefs']['dockerRowPlacement']]);`,
    invoke => {
        const initial = invoke('seed');
        assert.equal(initial.prefs.dockerRowPlacement, 'folders-first');
        const save = (previous, value) => invoke('save', String(previous.meta.prefsRevision), JSON.stringify({ dockerRowPlacement: value }));
        const saved = save(initial, 'saved-order');
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        assert.equal(saved.prefs.dockerRowPlacement, 'saved-order');
        assert.equal(saved.body.prefs.dockerRowPlacement, 'saved-order');
        assert.equal(utils.normalizePrefs(saved.prefs).dockerRowPlacement, 'saved-order');
        assert.equal(saved.environmentPlacement, 'saved-order');
        assert.equal(saved.meta.prefsRevision, initial.meta.prefsRevision + 1);
        const backup = invoke('backup');
        assert.equal(backup.backupPlacement, 'saved-order');
        const malformed = save(saved, ['folders-first']);
        assert.equal(malformed.status, 400);
        assert.equal(malformed.prefs.dockerRowPlacement, 'saved-order');
        assert.equal(malformed.meta.prefsRevision, saved.meta.prefsRevision);
        const restored = save(saved, 'folders-first');
        assert.equal(restored.status, 200, JSON.stringify(restored.body));
        assert.equal(restored.prefs.dockerRowPlacement, 'folders-first');
        for (const state of [saved, malformed, restored]) {
            assert.equal(state.meta.folderRevision, initial.meta.folderRevision);
            assert.equal(state.vmRevision, initial.vmRevision);
            assert.deepEqual(state.prefs.manualOrder, initial.prefs.manualOrder);
            assert.deepEqual(state.prefs.dockerStartOrder, initial.prefs.dockerStartOrder);
            assert.equal(state.nativeOrder, initial.nativeOrder);
        }
    });
});

test('guarded Docker visibility changes retain peer edits without saving mutation instructions', () => {
    const endpoint = prefsEndpoint.replace(/^<\?php\s+require_once\([^;]+;\s*/u, '');
    runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
putenv('FVPLUS_TEST_SECURITY_STATE_PATH=' . dirname(getenv('FVPLUS_TEST_CONFIG_DIR')) . '/security-state.json');
require_once ${phpQuote(libPath)};
$type = $argv[1];
$stage = $argv[2];
$response = [];
if ($stage === 'seed') {
    writeRawFolderMap($type, ['one' => ['name' => 'One'], 'two' => ['name' => 'Two'], '0' => ['name' => 'Zero']]);
    writeTypePrefs($type, defaultTypePrefs());
} else {
    $_SERVER['SCRIPT_FILENAME'] = 'prefs.php';
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['HTTP_ORIGIN'] = 'http://localhost';
    $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $_SERVER['HTTP_X_FV_TOKEN'] = getConfiguredRequestToken();
    $_POST = $_REQUEST = ['type' => $type, 'expectedRevision' => $argv[3], 'prefs' => $argv[4],
        '_fv_nonce' => fvplus_issue_mutation_nonce('prefs.php')['nonce']];
    ob_start();
    eval(${phpQuote(endpoint)});
    $response = ['status' => http_response_code(), 'body' => json_decode(ob_get_clean(), true)];
    releaseConfigMutationLock();
}
echo json_encode($response + ['prefs' => readTypePrefs($type), 'meta' => readConfigMetadata($type, false)], JSON_THROW_ON_ERROR);
`, invoke => {
        const initial = invoke('docker', 'seed');
        const save = (from, patch, type = 'docker') => invoke(type, 'save', String(from.meta.prefsRevision), JSON.stringify(patch));
        const first = save(initial, { hiddenFolderIdChanges: { one: true } });
        assert.equal(first.status, 200, JSON.stringify(first.body));
        assert.deepEqual(first.prefs.hiddenFolderIds, ['one']);
        const stale = save(initial, { hiddenFolderIdChanges: { two: true } });
        assert.equal(stale.status, 409);
        assert.deepEqual(stale.prefs.hiddenFolderIds, ['one']);
        const retried = save(stale, { hiddenFolderIdChanges: { two: true } });
        assert.equal(retried.status, 200, JSON.stringify(retried.body));
        assert.deepEqual(retried.prefs.hiddenFolderIds, ['one', 'two']);
        const restored = save(retried, { hiddenFolderIdChanges: { one: false } });
        assert.deepEqual(restored.prefs.hiddenFolderIds, ['two']);
        const reset = save(restored, { hiddenFolderIds: [], hiddenFolderIdChanges: { 0: true } });
        assert.deepEqual(reset.prefs.hiddenFolderIds, ['0']);
        assert.equal(Object.hasOwn(reset.prefs, 'hiddenFolderIdChanges'), false);
        assert.equal(reset.meta.folderRevision, initial.meta.folderRevision);
        assert.equal(save(reset, { hiddenFolderIdChanges: { two: 'true' } }).status, 400);
        assert.equal(save(reset, { hiddenFolderIdChanges: { '': true } }).status, 400);
        const vm = invoke('vm', 'seed');
        assert.equal(save(vm, { hiddenFolderIdChanges: { two: true } }, 'vm').status, 400);
    });
});

test('server enables stopped badges once on upgrade and preserves later opt-outs through saves and reloads', () => {
    const cases = [{}, { badges: {} }, { badges: { running: false } }, { badges: { stopped: false } },
        { badges: { updates: false } }, { badges: { running: false, stopped: false, updates: false } }]
        .map(input => ({ ...input, runtimePrefsSchema: 5 }))
        .concat([undefined, 0, 1, 2, 3, 4].map(runtimePrefsSchema => ({
            runtimePrefsSchema, badges: { running: false, stopped: false, updates: false }
        })));
    const result = runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpQuote(libPath)};
$cases = json_decode(${phpQuote(JSON.stringify(cases))}, true);
$result = [];
foreach (['docker', 'vm'] as $type) {
    $result[$type]['fresh'] = readTypePrefs($type)['badges'];
    $result[$type]['freshDiagnostics'] = diagnosticsBuildStateSnapshot($type, [], [], [], 'sanitized')['summary']['badgePrefs'];
    foreach ($cases as $input) {
        writeJsonObjectWithLastGood(getTypePrefsPath($type), $input);
        $loaded = readTypePrefs($type);
        $persisted = readJsonObjectFile(getTypePrefsPath($type));
        $saved = writeTypePrefs($type, mergeTypePrefsPatch($loaded, ['hideEmptyFolders' => true]));
        $result[$type]['cases'][] = [
            'loaded' => $loaded['badges'], 'persisted' => $persisted['badges'],
            'saved' => $saved['badges'], 'reloaded' => readTypePrefs($type)['badges'],
            'diagnostics' => diagnosticsBuildStateSnapshot($type, [], $loaded, [], 'sanitized')['summary']['badgePrefs']
        ];
        writeTypePrefs($type, mergeTypePrefsPatch($saved, ['badges' => ['stopped' => false]]));
        $result[$type]['optOuts'][] = readTypePrefs($type)['badges']['stopped'];
        $result[$type]['schemas'][] = readJsonObjectFile(getTypePrefsPath($type))['runtimePrefsSchema'];
    }
}
echo json_encode($result, JSON_UNESCAPED_SLASHES);
`);
    const defaults = { running: true, stopped: true, updates: true };
    for (const type of ['docker', 'vm']) {
        assert.deepEqual(result[type].fresh, defaults);
        assert.deepEqual(result[type].freshDiagnostics, defaults);
        for (const [index, input] of cases.entries()) {
            const expected = { ...defaults, ...input.badges };
            if ((input.runtimePrefsSchema ?? 0) < 5) expected.stopped = true;
            for (const [stage, badges] of Object.entries(result[type].cases[index])) {
                assert.deepEqual(badges, expected, `${type} case ${index}: ${stage}`);
            }
            assert.equal(result[type].optOuts[index], false, `${type} case ${index}: later opt-out`);
            assert.equal(result[type].schemas[index], 5, `${type} case ${index}: persisted migration`);
        }
    }
});

test('server preference merge preserves nested siblings, hourly defaults, and explicit schedules without backup files', () => {
    const result = runHarness();
    assert.equal(result.dashboard.privacyMaskNames, true);
    assert.equal(result.dashboard.privacyMaskPorts, false);
    assert.deepEqual(result.pinnedFolderIds, ['three']);
    assert.equal(result.defaultSchedule.enabled, true);
    assert.equal(result.defaultSchedule.intervalHours, 1);
    assert.equal(result.savedSchedule.enabled, false);
    assert.equal(result.savedSchedule.intervalHours, 24);
    assert.equal(result.backupsAfterPrefsSave, 0);
    assert.equal(result.readFolderCount, 1);
    assert.equal(result.backupsAfterFolderRead, 0);
    assert.equal(result.backupsAfterScheduledRun, 1);
    assert.equal(result.backupCount, 1);
});

test('preference endpoint exposes revision-safe merge and mutation diagnostics', () => {
    assert.match(prefsEndpoint, /mergeTypePrefsPatch\(\$current, \$decoded\)/);
    assert.match(prefsEndpoint, /clientMutationId/);
    assert.doesNotMatch(prefsEndpoint, /createBackupSnapshot\(|createCoalescedPrefsBackupSnapshot\(/);
    assert.match(prefsEndpoint, /'backupRequired'/);
    assert.match(prefsEndpoint, /'backupCoalesced'/);
});

test('guarded preferences publish only complete order and classify temporary storage failures as retryable', () => {
    const endpoint = prefsEndpoint.replace(/^<\?php\s+require_once\([^;]+;\s*/u, '');
    runHarness(`<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
putenv('FVPLUS_TEST_SECURITY_STATE_PATH=' . dirname(getenv('FVPLUS_TEST_CONFIG_DIR')) . '/security-state.json');
require_once ${phpQuote(libPath)};
$result = [];
if (($argv[1] ?? '') === 'init') {
    writeRawFolderMap('vm', ['a' => ['name' => 'A'], 'b' => ['name' => 'B']]);
    writeTypePrefs('vm', defaultTypePrefs());
} else {
$_SERVER['SCRIPT_FILENAME'] = 'prefs.php';
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['HTTP_ORIGIN'] = 'http://localhost';
$_SERVER['HTTP_X_FV_REQUEST'] = '1';
$_SERVER['HTTP_X_FV_TOKEN'] = getConfiguredRequestToken();
$_POST = $_REQUEST = ['type' => 'vm', 'expectedRevision' => $argv[2], 'prefs' => $argv[3],
    'clientMutationId' => $argv[4], '_fv_nonce' => fvplus_issue_mutation_nonce('prefs.php')['nonce']];
$injection = <<<'FAULT'
namespace PrefsFixture;
function writeTypePrefs(string $type, array $prefs, string $receipt) {
    putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
    putenv('FVPLUS_STORAGE_FAILURE_STAGE=rename');
    try { return \\writeTypePrefs($type, $prefs, $receipt); }
    finally {
        putenv('FVPLUS_STORAGE_FAILURE_INJECTION');
        putenv('FVPLUS_STORAGE_FAILURE_STAGE');
    }
}
FAULT;
ob_start();
eval((($argv[1] ?? '') === 'fault' ? $injection . "\n" : '') . ${phpQuote(endpoint)});
$result = ['status' => http_response_code(), 'body' => json_decode(ob_get_clean(), true),
    'lastStorageTarget' => getDurableStorageRuntimeSnapshot()['target'] ?? ''];
}
echo json_encode($result + ['prefs' => readTypePrefs('vm'),
    'revision' => readConfigMetadata('vm', false)['prefsRevision']]);
`, invoke => {
        const initial = invoke('init');
        const submit = (stage, revision, patch, mutationId) => invoke(stage, String(revision), JSON.stringify(patch), mutationId);
        const order = submit('write', initial.revision, { sortMode: 'manual', manualOrder: ['b'] }, 'fixture-order');
        assert.equal(order.status, 200);
        assert.deepEqual(order.prefs.manualOrder, ['b', 'a']);
        assert.equal(order.revision, initial.revision + 1);
        const exactOrderReplay = submit('write', initial.revision, { sortMode: 'manual', manualOrder: ['b'] }, 'fixture-order');
        assert.equal(exactOrderReplay.status, 200);
        assert.equal(exactOrderReplay.body.configChanged, false);
        assert.equal(exactOrderReplay.revision, order.revision);
        assert.equal(Object.hasOwn(exactOrderReplay.body.metadata, 'prefsMutationReceipt'), false);
        const changedOrderReplay = submit('write', initial.revision, { sortMode: 'manual', manualOrder: ['a'] }, 'fixture-order');
        assert.equal(changedOrderReplay.status, 409);
        const patch = { groupUnassignedItems: true };
        const failure = submit('fault', order.revision, patch, 'fixture-grouping');
        assert.equal(failure.status, 503);
        assert.equal(failure.body.ok, false);
        assert.equal(failure.lastStorageTarget, 'vm.prefs.json');
        assert.equal(failure.prefs.groupUnassignedItems, false);
        assert.equal(failure.revision, order.revision);
        const retry = submit('write', order.revision, patch, 'fixture-grouping');
        assert.equal(retry.status, 200);
        assert.equal(retry.prefs.groupUnassignedItems, true);
        const staleOrderReplay = submit('write', initial.revision, { sortMode: 'manual', manualOrder: ['b'] }, 'fixture-order');
        assert.equal(staleOrderReplay.status, 409);
        const validation = submit('write', retry.revision, { groupUnassignedItems: ['bogus'] }, 'fixture-invalid');
        assert.equal(validation.status, 400);
    });
});
