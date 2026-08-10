import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const serverRoot = path.join(pluginRoot, 'server');
const libPath = path.join(serverRoot, 'lib.php');

const directWriteAllowlist = new Map([
    ['lib.php', new Map([
        ['fv3_debug_log', 1],
        ['(debug-startup)', 1],
        ['fv3_write_json_cache_payload', 2],
        ['writeReadInfoCache', 2],
        ['fvplus_log_api_exception', 1],
        ['markDockerSyncOrderPending', 1]
    ])],
    ['lib.security.php', new Map([
        ['fvplus_security_with_state_lock', 1]
    ])],
    ['third_party_icons.php', new Map([
        ['writeThirdPartyIconCache', 2]
    ])],
    ['upload_custom_icon.php', new Map([
        ['writeCustomIconUploadRateBucket', 2],
        ['validateAndNormalizeSvgContent', 1],
        ['writeInlineIconTempFile', 1]
    ])]
]);

const directWriteContexts = (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split(/\r?\n/);
    const contexts = [];
    let currentFunction = '';
    lines.forEach((line, index) => {
        const functionMatch = line.match(/^\s*function\s+([A-Za-z0-9_]+)\s*\(/);
        if (functionMatch) currentFunction = functionMatch[1];
        const matches = line.match(/file_put_contents\s*\(/g) || [];
        for (const _match of matches) {
            let context = currentFunction || '(top-level)';
            if (
                path.basename(filePath) === 'lib.php'
                && line.includes('FolderView Plus lib.php readInfo Start')
            ) {
                context = '(debug-startup)';
            }
            contexts.push({ context, line: index + 1 });
        }
    });
    return contexts;
};

test('all direct PHP writes are limited to classified logs, caches, markers, and upload staging', () => {
    const actual = new Map();
    for (const entry of fs.readdirSync(serverRoot, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.php')) continue;
        const contexts = directWriteContexts(path.join(serverRoot, entry.name));
        if (contexts.length === 0) continue;
        const counts = new Map();
        for (const { context } of contexts) counts.set(context, (counts.get(context) || 0) + 1);
        actual.set(entry.name, counts);
    }
    assert.deepEqual(actual, directWriteAllowlist);
});

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const harness = `<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
$_SERVER['HTTP_X_FV_TRACE'] = 'fv-storage-test';
$_SERVER['HTTP_X_FV_TRANSACTION'] = 'tx-storage-test';
require_once ${phpSingleQuote(libPath)};

$root = getenv('FVPLUS_TEST_STORAGE_DIR');
$target = $root . '/state.json';
$original = ['value' => 'original'];
writeJsonObjectWithLastGood($target, $original);
$originalText = file_get_contents($target);
$criticalStages = ['parent-create', 'read-only', 'temp-create', 'temp-write', 'interrupted-write', 'disk-full', 'file-flush', 'rename'];
$failures = [];
putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
foreach ($criticalStages as $stage) {
    putenv('FVPLUS_STORAGE_FAILURE_STAGE=' . $stage);
    $threw = false;
    try {
        writeJsonObjectAtomic($target, ['value' => $stage]);
    } catch (Throwable $error) {
        $threw = true;
    }
    $failures[$stage] = [
        'threw' => $threw,
        'preserved' => file_get_contents($target) === $originalText,
        'temps' => count(glob($target . '.tmp.*') ?: []),
        'snapshot' => getDurableStorageRuntimeSnapshot()
    ];
}

putenv('FVPLUS_STORAGE_FAILURE_STAGE=directory-flush');
$directoryFlushResult = writeDurableFileAtomic($target, json_encode(['value' => 'directory-flush']));

putenv('FVPLUS_STORAGE_FAILURE_STAGE=last-good');
$lastGoodBefore = file_get_contents($target . '.lastgood');
writeJsonObjectWithLastGood($target, ['value' => 'primary-committed']);
$lastGoodAfter = file_get_contents($target . '.lastgood');

putenv('FVPLUS_STORAGE_FAILURE_INJECTION=0');
putenv('FVPLUS_STORAGE_FAILURE_STAGE=');
file_put_contents($target, '{corrupt-primary');
$recovered = recoverJsonObjectFromLastGood($target);
file_put_contents($target, '{corrupt-primary-again');
file_put_contents($target . '.lastgood', '{corrupt-last-good');
$corruptLastGood = recoverJsonObjectFromLastGood($target);

echo json_encode([
    'failures' => $failures,
    'directoryFlushResult' => $directoryFlushResult,
    'lastGoodPreserved' => $lastGoodBefore === $lastGoodAfter,
    'recovered' => $recovered,
    'corruptLastGood' => $corruptLastGood
], JSON_UNESCAPED_SLASHES);
`;

test('durable writer preserves committed data across every injected failure stage', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-durable-storage-'));
    const harnessPath = path.join(tempDir, 'storage.php');
    const documentRoot = path.join(tempDir, 'document-root');
    const storageDir = path.join(tempDir, 'storage');
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(harnessPath, harness, 'utf8');
    try {
        const result = JSON.parse(execFileSync('php', [harnessPath], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000,
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: path.join(tempDir, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(tempDir, 'runtime'),
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot,
                FVPLUS_TEST_STORAGE_DIR: storageDir
            }
        }));
        for (const stage of ['parent-create', 'read-only', 'temp-create', 'temp-write', 'interrupted-write', 'disk-full', 'file-flush', 'rename']) {
            assert.equal(result.failures[stage].threw, true, `${stage} must report failure`);
            assert.equal(result.failures[stage].preserved, true, `${stage} must preserve the committed target`);
            assert.equal(result.failures[stage].temps, 0, `${stage} must remove temporary files`);
            assert.equal(result.failures[stage].snapshot.ok, false);
            assert.equal(result.failures[stage].snapshot.failedStage, stage);
            assert.equal(result.failures[stage].snapshot.traceId, 'fv-storage-test');
            assert.equal(result.failures[stage].snapshot.transactionId, 'tx-storage-test');
        }
        assert.equal(result.directoryFlushResult.ok, true);
        assert.equal(result.directoryFlushResult.directoryFlushed, false);
        assert.equal(result.lastGoodPreserved, true);
        assert.deepEqual(result.recovered, { value: 'original' });
        assert.equal(result.corruptLastGood, null);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('durable configuration surfaces use the shared storage service', () => {
    const lib = fs.readFileSync(libPath, 'utf8');
    const diagnostics = fs.readFileSync(path.join(serverRoot, 'lib.diagnostics.php'), 'utf8');
    const iconUpload = fs.readFileSync(path.join(serverRoot, 'upload_custom_icon.php'), 'utf8');
    assert.match(lib, /writeDurableFileAtomic\(\$path, \$token, \['mode' => 0600\]\)/);
    assert.match(lib, /writeDurableFileAtomic\(getLegacyMigrationMarkerPath/);
    assert.match(lib, /writeJsonObjectWithLastGood\(getThemeWorkspacePath/);
    assert.match(lib, /writeJsonObjectWithLastGood\(\$filePath, \[\]\)/);
    assert.match(lib, /writeDurableFileAtomic\(\$autoStartFile/);
    assert.match(lib, /function fvplusCopyCustomIconStorageFile[\s\S]*?writeDurableFileAtomic\(\$targetPath, \$contents/);
    assert.match(diagnostics, /writeJsonObjectWithLastGood\(\$path, array_values\(\$events\)\)/);
    assert.match(iconUpload, /writeDurableFileAtomic\(\$targetPath, \$iconContents/);
});
