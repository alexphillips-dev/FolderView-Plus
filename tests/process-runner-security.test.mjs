import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const processLibPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.process.php'
);
const mainLibPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);
const filesystemSecurityLibPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.filesystem-security.php'
);
const processSource = fs.readFileSync(processLibPath, 'utf8');
const mainSource = fs.readFileSync(mainLibPath, 'utf8');
const filesystemSecuritySource = fs.readFileSync(filesystemSecurityLibPath, 'utf8');
const phpQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

test('runtime processes use one shell-free allowlisted execution boundary', () => {
    assert.match(processSource, /proc_open\(\$command/);
    assert.match(processSource, /'bypass_shell'\s*=>\s*true/);
    assert.match(processSource, /docker-tailscale-ip/);
    assert.match(processSource, /docker-runtime/);
    assert.match(processSource, /virsh-runtime/);
    assert.match(processSource, /timeoutSeconds/);
    assert.match(processSource, /maxOutputBytes/);
    assert.doesNotMatch(mainSource, /@?exec\s*\(/);
    assert.doesNotMatch(mainSource, /runShellActionCommand/);
});

test('durable storage targets use a dedicated filesystem security boundary', () => {
    assert.match(filesystemSecuritySource, /fvplusAssertDurableWriteTarget/);
    assert.match(filesystemSecuritySource, /fvplusPathHasSymlinkComponent/);
    assert.match(filesystemSecuritySource, /outside an approved plugin or host directory/);
    assert.doesNotMatch(filesystemSecuritySource, /\b(?:exec|shell_exec|system|passthru)\s*\(/);
});

test('durable storage boundary accepts approved children and rejects prefix confusion', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-storage-boundary-'));
    try {
        const code = `
require_once ${phpQuote(filesystemSecurityLibPath)};
$configDir = ${phpQuote(path.join(tempDir, 'config'))};
$sourceDir = ${phpQuote(path.join(tempDir, 'source'))};
$results = [];
foreach ([
  ['path' => $configDir . '/prefs.json', 'allowed' => true],
  ['path' => $sourceDir . '/managed/theme.css', 'allowed' => true],
  ['path' => $configDir . '-escape/prefs.json', 'allowed' => false],
  ['path' => ${phpQuote(path.join(tempDir, 'outside', 'prefs.json'))}, 'allowed' => false]
] as $case) {
  try {
    fvplusAssertDurableWriteTarget($case['path']);
    $results[] = $case['allowed'];
  } catch (Throwable $error) {
    $results[] = !$case['allowed'];
  }
}
echo json_encode($results);
`;
        const results = JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8' }));
        assert.deepEqual(results, [true, true, true, true]);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('process profiles construct fixed argument arrays and reject command fragments', () => {
    const code = `
require_once ${phpQuote(processLibPath)};
$valid = [
  fvplusBuildProcessArguments('docker-runtime', ['name' => 'safe-container', 'action' => 'start']),
  fvplusBuildProcessArguments('virsh-runtime', ['name' => 'Windows 11', 'action' => 'shutdown']),
  fvplusBuildProcessArguments('docker-tailscale-status', ['name' => 'safe-container'])
];
$rejected = [];
foreach ([
  ['docker-runtime', ['name' => 'safe;touch /tmp/pwned', 'action' => 'start']],
  ['docker-runtime', ['name' => 'safe', 'action' => 'start;id']],
  ['virsh-runtime', ['name' => '../escape', 'action' => 'start']]
] as $case) {
  try { fvplusBuildProcessArguments($case[0], $case[1]); $rejected[] = false; }
  catch (Throwable $error) { $rejected[] = true; }
}
echo json_encode(['valid' => $valid, 'rejected' => $rejected], JSON_UNESCAPED_SLASHES);
`;
    const result = JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8' }));
    assert.deepEqual(result.valid[0], ['start', 'safe-container']);
    assert.deepEqual(result.valid[1], ['shutdown', 'Windows 11']);
    assert.deepEqual(result.valid[2], ['exec', 'safe-container', 'tailscale', 'status', '--peers=false', '--json']);
    assert.deepEqual(result.rejected, [true, true, true]);
});

test('allowlisted process runner preserves arguments without shell interpretation', {
    skip: process.platform === 'win32' ? 'Executable wrapper contract runs in Linux CI.' : false
}, () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-process-runner-'));
    const binDir = path.join(tempDir, 'bin');
    fs.mkdirSync(binDir);
    const dockerPath = path.join(binDir, 'docker');
    fs.writeFileSync(dockerPath, '#!/bin/sh\nprintf \"%s\\\\n\" \"$@\"\n', 'utf8');
    fs.chmodSync(dockerPath, 0o755);
    try {
        const code = `
require_once ${phpQuote(processLibPath)};
echo json_encode(fvplusRunProcessProfile('docker-runtime', ['name' => 'safe-container', 'action' => 'start']), JSON_UNESCAPED_SLASHES);
`;
        const result = JSON.parse(execFileSync('php', ['-r', code], {
            encoding: 'utf8',
            env: { ...process.env, FVPLUS_TEST_PROCESS_BIN_DIR: binDir }
        }));
        assert.equal(result.ok, true);
        assert.equal(result.exitCode, 0);
        assert.deepEqual(result.output, ['start', 'safe-container']);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
