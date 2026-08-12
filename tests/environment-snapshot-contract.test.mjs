import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const serverRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const libPhp = ['lib.php', 'lib.environment-snapshot.php', 'lib.environment-transaction.php', 'lib.backup-schedule.php']
    .map((name) => fs.readFileSync(path.join(serverRoot, name), 'utf8'))
    .join('\n');
const endpointPhp = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/environment_snapshot.php'),
    'utf8'
);

test('environment snapshot helpers export folders, prefs, and theme workspace together', () => {
    assert.match(libPhp, /const FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION = 1;/);
    assert.match(libPhp, /const FVPLUS_ENVIRONMENT_SNAPSHOT_KIND = 'environment_snapshot';/);
    assert.match(libPhp, /function exportEnvironmentSnapshotPayload\(\): array/);
    assert.match(libPhp, /'types'\s*=>\s*\[\s*'docker'\s*=>\s*\[/);
    assert.match(libPhp, /'themeWorkspace'\s*=>\s*readThemeWorkspace\(\)/);
});

test('environment snapshot import routes through the atomic rollback and verification transaction', () => {
    assert.match(libPhp, /function importEnvironmentSnapshotPayload\(array \$snapshot, string \$sourceName = ''\): array/);
    assert.match(libPhp, /applyEnvironmentSnapshotTransaction\(\$normalized, \$sourceName/);
    assert.match(libPhp, /createGlobalRollbackSnapshot\('before-' \. \$reason\)/);
    assert.match(libPhp, /createBackupSnapshot\(\$type, 'transaction-' \. \$reason\)/);
    assert.match(libPhp, /writeRawFolderMap\(\$type, \$folders\);/);
    assert.match(libPhp, /writeTypePrefs\(\$type, \$prefs\);/);
    assert.match(libPhp, /fvplusEnvironmentVerifyTarget\(\$normalized\);/);
    assert.match(libPhp, /fvplusEnvironmentRestoreFiles\(\$snapshots\);/);
});

test('global rollback snapshots now include theme workspace state', () => {
    assert.match(libPhp, /'themeWorkspace'\s*=>\s*readThemeWorkspace\(\)/);
    assert.match(libPhp, /if \(is_array\(\$decoded\['themeWorkspace'\] \?\? null\)\) \{\s*writeThemeWorkspace\(\$decoded\['themeWorkspace'\]\);\s*\}/);
});

test('environment snapshot endpoint wraps export, preview, and apply in JSON helper responses', () => {
    assert.match(endpointPhp, /fvplus_json_try\(/);
    assert.match(endpointPhp, /'snapshot'\s*=>\s*\$snapshot/);
    assert.match(endpointPhp, /previewEnvironmentSnapshotPayload/);
    assert.match(endpointPhp, /'import'\s*=>\s*importEnvironmentSnapshotPayload/);
});

test('environment snapshot endpoint exposes read-only FolderView3 discovery and preview', () => {
    assert.match(endpointPhp, /detectFolderView3Installation\(\)/);
    assert.match(endpointPhp, /previewFolderView3Migration\(\$bundle, \$sourceName\)/);
    assert.match(endpointPhp, /decodeFolderView3BundlePayloadString/);
});

test('FolderView3 apply is mutation-guarded and requires a preview digest', () => {
    assert.match(endpointPhp, /\$mutatingActions = \['apply', 'apply_folderview3'\]/);
    assert.match(endpointPhp, /applyFolderView3Migration/);
    assert.match(endpointPhp, /expectedDigest/);
});
