import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPhp = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'),
    'utf8'
);
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

test('environment snapshot import creates rollback and per-type safety backups before apply', () => {
    assert.match(libPhp, /function importEnvironmentSnapshotPayload\(array \$snapshot, string \$sourceName = ''\): array/);
    assert.match(libPhp, /createGlobalRollbackSnapshot\('before-environment-import'\)/);
    assert.match(libPhp, /createBackupSnapshot\(\$type, 'before-environment-import'\)/);
    assert.match(libPhp, /writeRawFolderMap\(\$type, \$folders\);/);
    assert.match(libPhp, /writeTypePrefs\(\$type, \$prefs\);/);
    assert.match(libPhp, /writeThemeWorkspace\(\$normalized\['themeWorkspace'\] \?\? defaultThemeWorkspace\(\)\);/);
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
