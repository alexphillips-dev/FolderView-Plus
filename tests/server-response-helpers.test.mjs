import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);
const libPrefsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php'
);
const libDiagnosticsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.diagnostics.php'
);
const libPhp = fs.readFileSync(libPath, 'utf8');
const libPrefsPhp = fs.readFileSync(libPrefsPath, 'utf8');
const libDiagnosticsPhp = fs.readFileSync(libDiagnosticsPath, 'utf8');

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
    assert.match(libPhp, /function getRequestTraceId\s*\(/);
    assert.match(libPhp, /function emitRequestTraceHeader\s*\(/);
    assert.match(libPhp, /header\('X-FV-Trace:\s*'\s*\.\s*getRequestTraceId\(\)\)/);
    assert.match(libPhp, /'traceId'\s*=>\s*getRequestTraceId\(\)/);
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
    assert.match(libPhp, /function normalizeDockerUpdatedStateValue\(\$value\): \?bool/);
    assert.match(libPhp, /function readDockerWebuiInfoCache\(\): array/);
    assert.match(libPhp, /function resolveDockerCachedUpdatedStateValue\(string \$containerName, array \$dockerWebuiInfo = \[\]\): \?bool/);
    assert.match(libPhp, /function resolveDockerUpdatedStateValue\(string \$containerName, string \$containerImage, array \$dockerWebuiInfo = \[\], \$dockerUpdate = null\): \?bool/);
    assert.match(libPhp, /in_array\(\$normalized, \['true', '1', 'yes', 'on', 'up-to-date', 'uptodate', 'current'\], true\)/);
    assert.match(libPhp, /in_array\(\$normalized, \['false', '0', 'no', 'off', 'update-ready', 'update ready', 'apply-update', 'apply update', 'update available'\], true\)/);
    assert.match(libPhp, /'composeProject'\s*=>\s*getComposeProjectValueFromLabels\(\$labels\)/);
    assert.match(libPhp, /\$manager\s*=\s*getNormalizedDockerManagerFromLabels\(\$labels\);/);
    assert.match(libPhp, /\$dockerWebuiInfo = readDockerWebuiInfoCache\(\);/);
    assert.match(
        libPhp,
        /\$ct\['info'\]\['State'\]\['manager'\]\s*=\s*getNormalizedDockerManagerFromLabels\(\$containerLabels\);/
    );
    assert.match(
        libPhp,
        /\$ct\['info'\]\['State'\]\['Updated'\]\s*=\s*\$ct\['info'\]\['State'\]\['manager'\]\s*===\s*'dockerman'[\s\S]*?resolveDockerUpdatedStateValue\(\$containerName, \$containerImage, \$dockerWebuiInfo, \$DockerUpdate\)[\s\S]*?: null;/
    );
    assert.match(
        libPhp,
        /\$cachedUpdated = normalizeDockerUpdatedStateValue\(\$dockerWebuiInfo\[\$safeName\]\['updated'\] \?\? null\);[\s\S]*?return is_bool\(\$cachedUpdated\) \? \$cachedUpdated : null;/
    );
    assert.match(
        libPhp,
        /\$cachedUpdated = resolveDockerCachedUpdatedStateValue\(\$containerName, \$dockerWebuiInfo\);[\s\S]*?if \(is_bool\(\$cachedUpdated\)\) \{[\s\S]*?return \$cachedUpdated;/
    );
    assert.match(
        libPhp,
        /return normalizeDockerUpdatedStateValue\(\$dockerUpdate->getUpdateStatus\(\$containerImage\)\);/
    );
    assert.match(
        libPhp,
        /function readInfoState\(string \$type\): array \{[\s\S]*?\$dockerWebuiInfo = readDockerWebuiInfoCache\(\);[\s\S]*?'Updated'\s*=>\s*\$manager === 'dockerman' \? resolveDockerCachedUpdatedStateValue\(\$name, \$dockerWebuiInfo\) : null,/
    );
});

test('lib.php defines runtime conflict detection and notice helpers', () => {
    assert.match(libPhp, /const FVPLUS_RUNTIME_CONFLICT_PLUGINS\s*=\s*\[/);
    assert.match(libPhp, /'folder\.view3'\s*=>\s*\[/);
    assert.match(libPhp, /'folder\.view2'\s*=>\s*\[/);
    assert.match(libPhp, /'runtimeDir'\s*=>\s*'\/usr\/local\/emhttp\/plugins\/folder\.view3'/);
    assert.match(libPhp, /'runtimeDir'\s*=>\s*'\/usr\/local\/emhttp\/plugins\/folder\.view2'/);
    assert.match(libPhp, /'folder\.view3\.Docker\.page'/);
    assert.match(libPhp, /'folder\.view2\.Docker\.page'/);
    assert.match(libPhp, /'markers'\s*=>\s*\[/);
    assert.match(libPhp, /function fvplus_detect_runtime_plugin_conflicts\s*\(/);
    assert.match(libPhp, /function fvplus_render_runtime_conflict_notice\s*\(/);
    assert.match(libPhp, /\$hasRuntimeMarker\s*=\s*false/);
    assert.match(libPhp, /Safe mode active/);
    assert.match(libPhp, /How to fix/);
    assert.match(libPhp, /Open Plugins/);
    assert.match(libPhp, /class="fv-runtime-conflict-banner"/);
    assert.match(libPhp, /data-conflict-key="/);
    assert.doesNotMatch(libPhp, /class="notice"/);
    assert.match(libPhp, /Keep <strong>FolderView Plus<\/strong> installed/);
    assert.match(libPhp, /target="_blank" rel="noopener noreferrer"[^>]*>Support Thread/);
    assert.match(libPhp, /<button type="button" class="btn"/);
    assert.match(libPhp, /window\.location\.href=\\'\/Plugins\\'/);
    assert.match(libPhp, /localStorage\.setItem\([^)]*fv\.runtimeConflict\.active\.v1/);
    assert.match(libPhp, /localStorage\.removeItem\([^)]*fv\.runtimeConflict\.resolvedPending\.v1/);
    assert.doesNotMatch(libPhp, /Remove either FolderView Plus/);
});

test('lib.php diagnostics include custom icon storage and usage health', () => {
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.diagnostics\.php'\);/);
    assert.match(libDiagnosticsPhp, /function diagnosticsCustomIconExtensions\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsCustomIconNameFromIconValue\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildCustomIconUsageMap\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildCustomIconStorage\s*\(/);
    assert.match(libDiagnosticsPhp, /\$customIcons\s*=\s*diagnosticsBuildCustomIconStorage\(\$privacyMode\);/);
    assert.match(libDiagnosticsPhp, /'customIcons'\s*=>\s*\$customIcons/);
    assert.match(libDiagnosticsPhp, /'inUseIconCount'\s*=>/);
    assert.match(libDiagnosticsPhp, /'orphanedIconCount'\s*=>/);
    assert.match(libDiagnosticsPhp, /'repairHint'\s*=>/);
});

test('lib.php diagnostics include user-facing summary cards and recommended actions', () => {
    assert.match(libDiagnosticsPhp, /function diagnosticsSummaryStatusFromCounts\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSummaryCard\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildRecommendedActions\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildOverviewSummary\s*\(/);
    assert.match(libDiagnosticsPhp, /'recommendedActions'\s*=>\s*diagnosticsBuildRecommendedActions\(\$typesData, \$customIcons\)/);
    assert.match(libDiagnosticsPhp, /'summary'\s*=>\s*diagnosticsBuildOverviewSummary\(\$typesData, \$customIcons, \$update\)/);
    assert.match(libDiagnosticsPhp, /foreach\s*\(\['docker'\s*=>\s*'Docker config',\s*'vm'\s*=>\s*'VM config'\]/);
    assert.match(libDiagnosticsPhp, /'Storage and paths'/);
    assert.match(libDiagnosticsPhp, /'Custom icons'/);
    assert.match(libDiagnosticsPhp, /'Update check'/);
    assert.match(libDiagnosticsPhp, /'repair_paths',\s*'Repair plugin paths'/);
    assert.match(libDiagnosticsPhp, /'normalize_prefs',\s*'Validate and normalize prefs'/);
    assert.match(libDiagnosticsPhp, /'sync_docker_order',\s*'Rebuild Docker order index'/);
});

test('lib.php can resolve requested folder editor context for bootstrap hydration', () => {
    assert.match(libPhp, /function resolveFolderEditorRequestedContext\(string \$type, string \$requestedRef\): array/);
    assert.match(libPhp, /'resolvedBy'\s*=>\s*'key'/);
    assert.match(libPhp, /'resolvedBy'\s*=>\s*'metadata'/);
    assert.match(libPhp, /'resolvedBy'\s*=>\s*'name'/);
    assert.match(libPhp, /normalizeFolderContentPayload\(\$folders\[\$safeCandidateId\] \?\? \[\]\)/);
});

test('lib.php centralizes folder editor mode preference resolution', () => {
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.prefs\.php'\);/);
    assert.match(libPrefsPhp, /function resolveFolderEditorModePreference\(array \$prefs\): array/);
    assert.match(libPrefsPhp, /function resolveTypeFolderEditorModePreference\(string \$type\): array/);
    assert.match(libPrefsPhp, /'source'\s*=>\s*'modern-only'/);
    assert.match(libPrefsPhp, /return resolveFolderEditorModePreference\(readTypePrefs\(\$type\)\);/);
    assert.match(libPrefsPhp, /\$resolvedFolderEditorMode = resolveFolderEditorModePreference\(\$prefs\);/);
    assert.match(libPrefsPhp, /\$normalized\['folderEditorModeExplicit'\] = false;/);
    assert.match(libPrefsPhp, /\$normalized\['folderEditorMode'\] = \(string\)\(\$resolvedFolderEditorMode\['mode'\] \?\? 'modern'\);/);
});
