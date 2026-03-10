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

const endpointsUsingHelpers = [
    'backup.php',
    'bulk_assign.php',
    'bulk_folder_action.php',
    'create.php',
    'delete.php',
    'diagnostics.php',
    'prefs.php',
    'reorder.php',
    'sync_order.php',
    'templates.php',
    'update.php',
    'update_check.php',
    'update_notes.php',
    'upload_custom_icon.php'
];

test('lib.php defines centralized JSON response helpers', () => {
    assert.match(libPhp, /function fvplus_json_response\s*\(/);
    assert.match(libPhp, /function fvplus_json_ok\s*\(/);
    assert.match(libPhp, /function fvplus_json_error\s*\(/);
    assert.match(libPhp, /function fvplus_json_try\s*\(/);
});

test('JSON endpoints use centralized response helper wrapper', () => {
    for (const name of endpointsUsingHelpers) {
        const fullPath = path.join(
            repoRoot,
            `src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/${name}`
        );
        const source = fs.readFileSync(fullPath, 'utf8');
        assert.match(source, /fvplus_json_try\s*\(/, `${name} should use fvplus_json_try()`);
    }
});

test('backup restore validates payload type against requested type', () => {
    assert.match(libPhp, /function validateBackupPayloadType\s*\(array \$decoded, string \$type\): void/);
    assert.match(libPhp, /validateBackupPayloadType\(\$decoded, \$type\);/);
});

test('lib.php normalizes compose manager and compose project labels', () => {
    assert.match(libPhp, /function getComposeProjectValueFromLabels\s*\(/);
    assert.match(libPhp, /function getNormalizedDockerManagerFromLabels\s*\(/);
    assert.match(libPhp, /'composeProject'\s*=>\s*getComposeProjectValueFromLabels\(\$labels\)/);
    assert.match(libPhp, /\$manager\s*=\s*getNormalizedDockerManagerFromLabels\(\$labels\);/);
    assert.match(
        libPhp,
        /\$ct\['info'\]\['State'\]\['manager'\]\s*=\s*getNormalizedDockerManagerFromLabels\(\$ct\['Labels'\]\s*\?\?\s*\[\]\);/
    );
});

test('lib.php defines runtime conflict detection and notice helpers', () => {
    assert.match(libPhp, /const FVPLUS_RUNTIME_CONFLICT_PLUGINS\s*=\s*\[/);
    assert.match(libPhp, /function fvplus_detect_runtime_plugin_conflicts\s*\(/);
    assert.match(libPhp, /function fvplus_render_runtime_conflict_notice\s*\(/);
    assert.match(libPhp, /Safe mode active/);
    assert.match(libPhp, /How to fix/);
    assert.match(libPhp, /Open Plugins/);
    assert.match(libPhp, /class="fv-runtime-conflict-banner"/);
    assert.doesNotMatch(libPhp, /class="notice"/);
    assert.match(libPhp, /Keep <strong>FolderView Plus<\/strong> installed/);
    assert.match(libPhp, /target="_blank" rel="noopener noreferrer">Support Thread/);
    assert.doesNotMatch(libPhp, /Remove either FolderView Plus/);
});
