import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runInventoryRepair } from './helpers/runtime-inventory-fixture.mjs';
import { execFileSync } from 'node:child_process';

test('failed and partial inventory cannot remove members or mutate files, backups, revisions, history or native order', () => {
    const scenarios = { docker: ['failed-list', 'disabled', 'http-error', 'malformed-body', 'missing-body', 'object-body', 'echo-error', 'malformed-list', 'duplicate'],
        vm: ['failed-connect', 'failed-native-connect', 'disabled', 'failed-list', 'failed-lookup', 'failed-detail', 'missing-state', 'missing-uuid', 'malformed-list', 'duplicate'] };
    for (const [type, cases] of Object.entries(scenarios)) for (const scenario of cases) {
        const result = runInventoryRepair({ type, scenario });
        assert.ok(result.error, `${type}/${scenario} must refuse`);
        assert.deepEqual(result.after, result.before, `${type}/${scenario} must leave exact state unchanged`);
        assert.deepEqual(result.backups, []);
        assert.deepEqual(result.orderCalls, []);
        assert.doesNotMatch(result.error, /private-socket-marker/);
        assert.equal(result.localized.errorKey, 'common.server.repair-members-unverified');
    }
});

for (const type of ['docker', 'vm']) {
    test(`${type} healthy inventory ignores stale caches and repairs only missing references`, () => {
        const result = runInventoryRepair({ type, scenario: 'stale-cache' });
        assert.equal(result.error, '');
        assert.deepEqual(result.folders.fixture.containers, [`${type}-present`]);
        assert.equal(result.repair.repairedMemberCount, 1);
        assert.equal(result.backups.length, 1);
        assert.deepEqual(result.otherFolders.fixture.containers, [type === 'docker' ? 'vm-present' : 'docker-present',
            type === 'docker' ? 'vm-missing' : 'docker-missing']);
        assert.equal(result.native, 'docker-present 0\nstale-host-entry 0\n');
        assert.ok(result.calls.some(([call, args, unchunk]) => type === 'docker'
            ? call === 'docker-list' && args === 5 && unchunk === true : call === 'vm-native-connect' && args === true));
        assert.ok(result.calls.every(([call]) => !['docker-detail', 'vm-wrapper-list'].includes(call)));
    });
    test(`${type} a confirmed empty inventory remains a valid repair result`, () => {
        const result = runInventoryRepair({ type, scenario: 'empty', legacy: true });
        assert.equal(result.error, '');
        assert.deepEqual(result.legacy, []);
        assert.deepEqual(result.folders.fixture.containers, []);
        assert.equal(result.repair.repairedMemberCount, 2);
        assert.equal(result.backups.length, 1);
    });
    test(`${type} display state readers retain tolerant array responses on enumeration failure`, () => {
        const result = runInventoryRepair({ type, scenario: 'failed-list', legacy: true });
        assert.deepEqual(result.legacy, []);
        assert.ok(result.error);
        assert.deepEqual(result.after, result.before);
    });
    test(`${type} recognized renames defer to existing identity reconciliation without deleting members`, () => {
        const result = runInventoryRepair({ type, scenario: 'renamed' });
        assert.ok(result.error);
        assert.deepEqual(result.after, result.before);
        assert.deepEqual(result.backups, []);
        assert.deepEqual(result.orderCalls, []);
    });
    test(`${type} failed inventory precedes recovery and normalization of corrupt configuration`, () => {
        const result = runInventoryRepair({ type, scenario: 'failed-list', corruptConfig: true });
        assert.ok(result.error);
        assert.deepEqual(result.after, result.before);
        assert.deepEqual(result.orderCalls, []);
    });
    test(`${type} a transient failure can be retried without stale inventory or a stuck lock`, () => {
        const result = runInventoryRepair({ type, scenario: 'failed-list', retry: true });
        assert.ok(result.error);
        assert.deepEqual(result.after, result.before);
        assert.equal(result.retry.repairedMemberCount, 1);
        assert.deepEqual(result.folders.fixture.containers, [`${type}-present`]);
        assert.equal(result.backups.length, 1);
    });
}

test('Docker repair does not depend on optional detail hydration that can omit a listed container', () => {
    const result = runInventoryRepair({ type: 'docker', scenario: 'failed-detail' });
    assert.equal(result.error, '');
    assert.deepEqual(result.folders.fixture.containers, ['docker-present']);
    assert.ok(result.calls.every(([call]) => call !== 'docker-detail'));
    assert.equal(result.native, 'docker-present 0\nstale-host-entry 0\n');
});

test('Docker repair validates the complete multiline body instead of the host decoder merge result', () => {
    const result = runInventoryRepair({ type: 'docker', scenario: 'multiline', legacy: true });
    assert.deepEqual(result.legacy, []);
    assert.equal(result.error, '');
    assert.deepEqual(result.folders.fixture.containers, ['docker-present']);
    assert.equal(result.repair.repairedMemberCount, 1);
});

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const quotePhp = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const runRepair = (type, { repeat = false, failBackup = false, failInventory = false } = {}) => {
    const endpoint = fs.readFileSync(path.join(server, 'diagnostics.php'), 'utf8')
        .replace(/^<\?php\s*/, '').replace(/^require_once\([^\n]+\);\s*/m, '');
    const ensureType = fs.readFileSync(path.join(server, 'lib.php'), 'utf8')
        .match(/    function ensureType\(string \$type\): string \{[\s\S]*?\n    \}/)[0];
    const code = `
const FVPLUS_ALLOWED_TYPES = ['docker', 'vm'];
const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
${ensureType}
$maps = [
    'docker' => ['d' => ['name' => 'Docker fixture', 'containers' => ['docker-present', 'docker-missing']]],
    'vm' => ['v' => ['name' => 'VM fixture', 'containers' => ['vm-present', 'vm-missing']]]
];
$before = $maps;
$revisions = ['docker' => 10, 'vm' => 20];
$backups = []; $events = []; $history = []; $locked = false; $guarded = 0; $responses = [];
$failBackup = ${failBackup ? 'true' : 'false'}; $failInventory = ${failInventory ? 'true' : 'false'};
function withConfigMutationLock(callable $callback) {
    global $locked;
    $locked = true;
    try { return $callback(); } finally { $locked = false; }
}
function readRawFolderMap($type) {
    global $maps, $events, $locked;
    if (!$locked) throw new RuntimeException('Read outside mutation lock');
    $events[] = ['read', $type]; return $maps[$type];
}
function fvplusReadRepairInventory($type) {
    global $events, $failInventory; $events[] = ['inventory', $type];
    if ($failInventory) throw new RuntimeException('Inventory unavailable');
    return [$type . '-present' => []];
}
function fvplusAssertRepairMembersNotRenamed($type, $folders, $inventory) {}
function normalizeFolderContentPayload($folder) { return $folder; }
function normalizeFolderMembers($members) { return array_values(array_unique($members)); }
function createBackupSnapshot($type, $reason) {
    global $maps, $backups, $events, $failBackup;
    if ($failBackup) throw new RuntimeException('Synthetic backup failure');
    $events[] = ['backup', $type]; $backups[$type][] = $maps[$type]; return [];
}
function writeRawFolderMap($type, $folders) {
    global $maps, $events, $revisions, $locked;
    if (!$locked) throw new RuntimeException('Write outside mutation lock');
    $events[] = ['write', $type]; $maps[$type] = $folders; $revisions[$type]++;
}
function syncContainerOrder($type) { global $events; $events[] = ['order', $type]; }
function appendDiagnosticsHistoryEvent($action, $type, $details, $status, $source) {
    global $history; $history[] = compact('action', 'type', 'details', 'status'); return [];
}
function normalizeDiagnosticsPrivacyMode($mode) { return $mode; }
function ensureThemeWorkspaceManagedAssets() {}
function requireMutationRequestGuard() { global $guarded; $guarded++; }
function getDiagnosticsSnapshot($mode) { global $maps, $events; $events[] = ['snapshot', 'both']; return ['privacyMode' => $mode, 'fixtureMaps' => $maps]; }
function fvplus_json_try($callback) {
    global $responses;
    try { $responses[] = ['ok' => true, 'response' => $callback()]; }
    catch (Throwable $error) { $responses[] = ['ok' => false, 'error' => $error->getMessage()]; }
}
require ${quotePhp(path.join(server, 'lib.custom-icon-storage.php'))};
$_REQUEST = ['action' => 'repair_orphaned_members', 'privacy' => 'full'];
$_POST = json_decode(${quotePhp(JSON.stringify(type === undefined ? {} : { type }))}, true);
eval(${quotePhp(endpoint)});
${repeat ? `eval(${quotePhp(endpoint)});` : ''}
echo json_encode(compact('before', 'maps', 'revisions', 'backups', 'events', 'history', 'locked', 'guarded', 'responses'));
`;
    return JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8', timeout: 30000 }));
};

for (const type of ['docker', 'vm']) {
    test(`${type} repair changes only its own saved references, backup, revision, and history`, () => {
        const other = type === 'docker' ? 'vm' : 'docker';
        const result = runRepair(type, { repeat: true });
        assert.ok(result.responses.every((response) => response.ok));
        assert.deepEqual(result.maps[other], result.before[other]);
        assert.deepEqual(Object.values(result.maps[type])[0].containers, [`${type}-present`]);
        assert.deepEqual(result.backups[type], [result.before[type]], 'backup must precede the first change; repeat is a no-op');
        assert.equal(result.backups[other], undefined);
        assert.equal(result.revisions[other], other === 'docker' ? 10 : 20);
        assert.equal(result.revisions[type], type === 'docker' ? 11 : 21);
        assert.ok(result.events.filter(([event]) => event !== 'snapshot').every((event) => event[1] === type));
        assert.deepEqual(result.events.filter((event) => ['backup', 'write'].includes(event[0])).map((event) => event[0]), ['backup', 'write']);
        assert.equal(result.events.some((event) => event[0] === 'order'), type === 'docker');
        assert.equal(result.history.length, 1);
        assert.equal(result.history[0].type, type);
        assert.equal(result.history[0].details.repairedMemberCount, 1);
        assert.equal(result.responses[0].response.repair.typeCounts[other], 0);
        assert.equal(result.responses[1].response.repair.repairedMemberCount, 0);
        assert.equal(result.guarded, 2);
        assert.equal(result.locked, false);
    });
}

test('missing, empty, and invalid repair types fail before any configuration or inventory access', () => {
    for (const type of [undefined, '', 'all', 'invalid', 'VM']) {
        const result = runRepair(type);
        assert.equal(result.responses[0].ok, false);
        assert.match(result.responses[0].error, /Invalid type/);
        assert.deepEqual(result.maps, result.before);
        assert.deepEqual(result.events, []);
        assert.equal(result.guarded, 1);
    }
});

test('a failed backup preserves both configurations and releases the mutation lock', () => {
    const result = runRepair('vm', { failBackup: true });
    assert.equal(result.responses[0].ok, false);
    assert.match(result.responses[0].error, /Synthetic backup failure/);
    assert.deepEqual(result.maps, result.before);
    assert.deepEqual(result.revisions, { docker: 10, vm: 20 });
    assert.equal(result.history.length, 0);
    assert.equal(result.locked, false);
});

test('the guarded endpoint reports refusal without refreshing diagnostics or reading either configuration', () => {
    for (const type of ['docker', 'vm']) {
        const result = runRepair(type, { failInventory: true });
        assert.equal(result.responses[0].ok, false);
        assert.equal(result.responses[0].error, 'Inventory unavailable');
        assert.deepEqual(result.events, [['inventory', type]]);
        assert.deepEqual(result.maps, result.before);
        assert.deepEqual(result.backups, []);
        assert.deepEqual(result.history, []);
        assert.equal(result.guarded, 1);
        assert.equal(result.locked, false);
    }
});
