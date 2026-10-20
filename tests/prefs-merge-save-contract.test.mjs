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

const runHarness = (source = buildHarness()) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-prefs-save-'));
    const harnessPath = path.join(tempDir, 'prefs-save.php');
    const documentRoot = path.join(tempDir, 'document-root');
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.writeFileSync(harnessPath, source, 'utf8');
    try {
        return JSON.parse(execFileSync('php', [harnessPath], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000,
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: path.join(tempDir, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(tempDir, 'runtime'),
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        }));
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
