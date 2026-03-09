import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);
const libPhp = fs.readFileSync(libPath, 'utf8');

test('legacy labels and legacy config directories remain supported', () => {
    assert.match(
        libPhp,
        /const FVPLUS_DOCKER_FOLDER_LABEL_KEYS = \[[\s\S]*'folderview\.plus'[\s\S]*'folder\.view3'[\s\S]*'folder\.view2'[\s\S]*'folder\.view'[\s\S]*\];/
    );
    assert.match(
        libPhp,
        /const FVPLUS_LEGACY_CONFIG_DIRS = \[[\s\S]*'\/boot\/config\/plugins\/folder\.view3'[\s\S]*'\/boot\/config\/plugins\/folder\.view2'[\s\S]*'\/boot\/config\/plugins\/folder\.view'[\s\S]*\];/
    );
});

test('self-heal JSON helpers exist and are used in folder/prefs readers', () => {
    assert.match(libPhp, /function getLastGoodJsonPath\(string \$path\): string/);
    assert.match(libPhp, /function writeJsonObjectWithLastGood\(string \$path, array \$payload\): void/);
    assert.match(libPhp, /function recoverJsonObjectFromLastGood\(string \$path\): \?array/);
    assert.match(libPhp, /function normalizeFolderMapPayload\(\$value\): array/);
    assert.match(libPhp, /function readRawFolderMap\(string \$type\): array[\s\S]*recoverJsonObjectFromLastGood\(\$path\)/);
    assert.match(libPhp, /function readTypePrefs\(string \$type\): array[\s\S]*recoverJsonObjectFromLastGood\(\$path\)/);
    assert.match(libPhp, /function writeRawFolderMap\(string \$type, array \$folders\): void[\s\S]*writeJsonObjectWithLastGood\(\$path, \$normalized\)/);
    assert.match(libPhp, /function writeTypePrefs\(string \$type, array \$prefs\): array[\s\S]*writeJsonObjectWithLastGood\(\$path, \$normalized\)/);
});

test('legacy migrations keep normalized folder payloads and last-good snapshots', () => {
    assert.match(
        libPhp,
        /function migrateLegacyTypeDataIfNeeded\(string \$type, string \$kind\): void[\s\S]*normalizeFolderMapPayload\(\$legacyData\)[\s\S]*writeJsonObjectWithLastGood\(\$targetPath, \$legacyData\)/
    );
});
