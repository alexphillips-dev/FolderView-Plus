import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');

test('runtime conflict map includes both legacy plugins with marker-based detection', () => {
    assert.match(libPhp, /const FVPLUS_RUNTIME_CONFLICT_PLUGINS = \[/);
    assert.match(libPhp, /'folder\.view3'\s*=>\s*\[/);
    assert.match(libPhp, /'folder\.view2'\s*=>\s*\[/);
    assert.match(libPhp, /'runtimeDir'\s*=>\s*'\/usr\/local\/emhttp\/plugins\/folder\.view3'/);
    assert.match(libPhp, /'runtimeDir'\s*=>\s*'\/usr\/local\/emhttp\/plugins\/folder\.view2'/);
    assert.match(libPhp, /'markers'\s*=>\s*\[/);
    assert.match(libPhp, /\$hasRuntimeMarker\s*=\s*false/);
    assert.match(libPhp, /if \(\$hasRuntimeMarker\) \{/);
});

test('safe-mode banner explains one-way remediation and keeps FolderView Plus installed', () => {
    assert.match(libPhp, /Safe mode active/);
    assert.match(libPhp, /Keep <strong>FolderView Plus<\/strong> installed/);
    assert.match(libPhp, /Remove: <strong>' \. \$pluginText \. '<\/strong>/);
    assert.match(libPhp, /window\.location\.href=\\'\/Plugins\\'/);
    assert.match(libPhp, /Support Thread/);
    assert.doesNotMatch(libPhp, /Remove either FolderView Plus/);
});

test('resolved-banner lifecycle covers both install orders (before/after conflict appears)', () => {
    assert.match(settingsJs, /const RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY = 'fv\.runtimeConflict\.active\.v1';/);
    assert.match(settingsJs, /const RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY = 'fv\.runtimeConflict\.resolvedPending\.v1';/);
    assert.match(settingsJs, /const syncRuntimeConflictResolutionBanner = \(\) =>/);
    assert.match(settingsJs, /if \(activeBanner\) \{[\s\S]*writeConflictStorageValue\(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY, activeKey\);[\s\S]*writeConflictStorageValue\(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY, ''\);/);
    assert.match(settingsJs, /const previousActiveKey = readConflictStorageValue\(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY\);/);
    assert.match(settingsJs, /writeConflictStorageValue\(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY, previousActiveKey\);/);
    assert.match(settingsJs, /writeConflictStorageValue\(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY, ''\);/);
    assert.match(settingsJs, /Conflict removed\. FolderView Plus is active again\./);
});
