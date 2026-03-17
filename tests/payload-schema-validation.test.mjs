import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const prefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/prefs.php');
const validationPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php');

test('server wires dedicated validation helpers for API payload boundaries', () => {
    assert.match(libPhp, /require_once\('\/usr\/local\/emhttp\/plugins\/folderview\.plus\/server\/lib\.validation\.php'\);/);
    assert.match(libPhp, /fvplus_assert_folder_payload_shape\(\$decodedContent\);/);
    assert.match(prefsPhp, /fvplus_assert_prefs_payload_shape\(\$decoded\);/);
    assert.match(prefsPhp, /Invalid prefs payload: expected JSON object\./);
});

test('validation helper module defines folder and prefs schema guards', () => {
    assert.match(validationPhp, /function fvplus_assert_folder_payload_shape\(array \$payload\): void/);
    assert.match(validationPhp, /Invalid folder payload: actions must be an array\./);
    assert.match(validationPhp, /function fvplus_assert_prefs_payload_shape\(array \$payload\): void/);
    assert.match(validationPhp, /Invalid prefs payload: 'autoRules' must be an array\./);
    assert.match(validationPhp, /fvplus_validation_assert_assoc_map\(\$payload\['expandedFolderState'\], 'expandedFolderState'/);
});
