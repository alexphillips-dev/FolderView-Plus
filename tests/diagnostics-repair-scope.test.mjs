import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const quotePhp = (value) => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const runRepair = (type, { repeat = false, failBackup = false } = {}) => {
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
$failBackup = ${failBackup ? 'true' : 'false'};
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
function readInfo($type) { global $events; $events[] = ['inventory', $type]; return [$type . '-present' => []]; }
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
function getDiagnosticsSnapshot($mode) { global $maps; return ['privacyMode' => $mode, 'fixtureMaps' => $maps]; }
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
        assert.ok(result.events.every((event) => event[1] === type));
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
