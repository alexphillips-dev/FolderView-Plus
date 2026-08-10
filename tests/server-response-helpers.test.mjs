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
const readInfoPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/read_info.php'
);
const libPhp = fs.readFileSync(libPath, 'utf8');
const libPrefsPhp = fs.readFileSync(libPrefsPath, 'utf8');
const libDiagnosticsPhp = fs.readFileSync(libDiagnosticsPath, 'utf8');
const readInfoPhp = fs.readFileSync(readInfoPath, 'utf8');
const diagnosticsEndpointPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/diagnostics.php'
);
const diagnosticsEndpointPhp = fs.readFileSync(diagnosticsEndpointPath, 'utf8');

const endpointsUsingHelpers = [
    'apply_folder_settings.php',
    'backup.php',
    'bulk_assign.php',
    'bulk_folder_action.php',
    'create.php',
    'delete.php',
    'diagnostics.php',
    'docker_start_order.php',
    'environment_snapshot.php',
    'prefs.php',
    'reorder.php',
    'runtime_snapshot.php',
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
    assert.match(libPhp, /\$payload\['transactionId'\]\s*=\s*getRequestTransactionId\(\)/);
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

test('lib.php supports guarded folder settings transfer for existing folders', () => {
    assert.match(libPhp, /function normalizeFolderSettingsTransferPayload\(array \$payload\): array/);
    assert.match(libPhp, /fvplus_assert_folder_settings_payload_shape\(\$payload\);/);
    assert.match(libPhp, /function applyFolderSettingsPayload\(string \$type, array \$targetIds, array \$settingsPayload\): array/);
    assert.match(libPhp, /createBackupSnapshot\(\$type, 'before-apply-folder-settings'\)/);
    assert.match(libPhp, /appendDiagnosticsHistoryEvent\('folder_settings_apply', \$type,/);
    assert.match(libPhp, /\$existingFolder\['icon'\] = \$normalizedSettings\['icon'\] \?\? '';/);
    assert.match(libPhp, /\$existingFolder\['settings'\] = is_array\(\$normalizedSettings\['settings'\] \?\? null\) \? \$normalizedSettings\['settings'\] : \[\];/);
    assert.match(libPhp, /\$existingFolder\['actions'\] = is_array\(\$normalizedSettings\['actions'\] \?\? null\) \? \$normalizedSettings\['actions'\] : \[\];/);
});

test('lib.php repairs custom icon directories and can clear missing custom icon references', () => {
    assert.match(libPhp, /function fvplusCustomIconDirPath\(\): string/);
    assert.match(libPhp, /return "\$configDir\/images\/custom";/);
    assert.match(libPhp, /function fvplusCustomIconRuntimeDirPath\(\): string/);
    assert.match(libPhp, /return "\$sourceDir\/images\/custom";/);
    assert.match(libPhp, /if \(\$safeName === 'README\.txt'\) \{\s*return \$includeMetadata;/);
    assert.match(libPhp, /function fvplusEnsureCustomIconStorageReady\(bool \$requireWritable = false\): array/);
    assert.match(libPhp, /function fvplusBootstrapCustomIconStorage\(\): void/);
    assert.match(libPhp, /fvplusBootstrapCustomIconStorage\(\);/);
    assert.match(libPhp, /function fvplusRepairMissingCustomIconReferences\(\): array/);
    assert.match(libPhp, /diagnosticsCustomIconNameFromIconValue\(\(string\)\(\$folder\['icon'\] \?\? ''\)\)/);
    assert.match(libPhp, /\$folder\['icon'\] = '';/);
    assert.match(libPhp, /createBackupSnapshot\(\$type, 'before-repair-missing-custom-icons'\)/);
    assert.match(libPhp, /appendDiagnosticsHistoryEvent\(\s*'repair_missing_custom_icons'/);
    assert.match(libPhp, /\$customIconDir = fvplusCustomIconDirPath\(\);/);
    assert.match(libPhp, /if \(is_dir\(\$customIconDir\)\) \{/);
    assert.match(libPhp, /'customIconDir'\s*=>\s*\$customIconDir/);
});

test('lib.php can prune orphaned member references from saved folders', () => {
    assert.match(libPhp, /function fvplusRepairOrphanedMemberReferences\(\): array/);
    assert.match(libPhp, /\$infoByName = readInfo\(\$type\);/);
    assert.match(libPhp, /\$normalizedFolder\['containers'\] = array_values\(array_filter\(\$members,/);
    assert.match(libPhp, /createBackupSnapshot\(\$type, 'before-repair-orphaned-members'\)/);
    assert.match(libPhp, /appendDiagnosticsHistoryEvent\(\s*'repair_orphaned_members'/);
    assert.match(libPhp, /'repairedMemberCount'\s*=>\s*count\(\$repairedMembers\)/);
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
        /function readInfoState\(string \$type,\s*bool \$preferLiveUpdateStatus = false\): array \{[\s\S]*?\$dockerWebuiInfo = readDockerWebuiInfoCache\(\);[\s\S]*?'Updated'\s*=>\s*\$manager === 'dockerman'[\s\S]*?resolveDockerCachedUpdatedStateValue\(\$name, \$dockerWebuiInfo\)[\s\S]*?: null,/
    );
    assert.match(
        readInfoPhp,
        /\$preferLiveUpdateStatus = \$mode === 'state'[\s\S]*?if \(\$preferLiveUpdateStatus\) \{[\s\S]*?readInfoState\(\$type,\s*true\)/
    );
});

test('lib.php coalesces docker order sync and uses lightweight state snapshots', () => {
    assert.match(libPhp, /function dockerSyncOrderLockPath\(\): string/);
    assert.match(libPhp, /function dockerSyncOrderPendingPath\(\): string/);
    assert.match(libPhp, /function markDockerSyncOrderPending\(\): void/);
    assert.match(libPhp, /function clearDockerSyncOrderPending\(\): void/);
    assert.match(libPhp, /function hasDockerSyncOrderPending\(\): bool/);
    assert.match(libPhp, /function syncContainerOrderUnlocked\(\): void/);
    assert.match(libPhp, /\$infoByName = readInfoState\('docker'\);/);
    assert.match(libPhp, /@flock\(\$lockHandle, LOCK_EX \| LOCK_NB\)/);
    assert.match(libPhp, /markDockerSyncOrderPending\(\);[\s\S]*?return;/);
    assert.match(libPhp, /clearDockerSyncOrderPending\(\);[\s\S]*?syncContainerOrderUnlocked\(\);/);
    assert.match(libPhp, /while \(\$shouldRerun && \$attempt < 3\)/);
    assert.match(libPhp, /\$currentPrefs = file_exists\(\$prefsFile\) \? @parse_ini_file\(\$prefsFile\) : false;/);
    assert.match(libPhp, /userprefs\.cfg is not written here; Unraid owns drag-order persistence\./);
    assert.doesNotMatch(libPhp, /file_put_contents\(\$prefsFile/);
    assert.match(libPhp, /if \(\(string\)\$currentAutoStartContent !== \$nextAutoStartContent\) \{/);
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
    assert.match(libDiagnosticsPhp, /fvplusCustomIconDirPath\(\)/);
    assert.match(libDiagnosticsPhp, /'\/boot\/config\/plugins\/folderview\.plus\/images\/custom'/);
    assert.match(libDiagnosticsPhp, /\$customIcons\s*=\s*diagnosticsBuildCustomIconStorage\(\$privacyMode\);/);
    assert.match(libDiagnosticsPhp, /'customIcons'\s*=>\s*\$customIcons/);
    assert.match(libDiagnosticsPhp, /'inUseIconCount'\s*=>/);
    assert.match(libDiagnosticsPhp, /'orphanedIconCount'\s*=>/);
    assert.match(libDiagnosticsPhp, /'missingReferenceCount'\s*=>/);
    assert.match(libDiagnosticsPhp, /'missingReferencedIconCount'\s*=>/);
    assert.match(libDiagnosticsPhp, /'missingReferencedIcons'\s*=>/);
    assert.match(libDiagnosticsPhp, /'repairHint'\s*=>/);
});

test('lib.php diagnostics include user-facing summary cards and recommended actions', () => {
    assert.match(libDiagnosticsPhp, /function diagnosticsSummaryStatusFromCounts\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSummaryCard\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildRecommendedActions\s*\(/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildOverviewSummary\s*\(/);
    assert.match(libDiagnosticsPhp, /'recommendedActions'\s*=>\s*diagnosticsBuildRecommendedActions\(\$typesData, \$customIcons\)/);
    assert.match(libDiagnosticsPhp, /'summary'\s*=>\s*diagnosticsBuildOverviewSummary\(\$typesData, \$customIcons, \$update, \$runtimeIntegrity, \$securityAudit\)/);
    assert.match(libDiagnosticsPhp, /foreach\s*\(\['docker'\s*=>\s*'Docker config',\s*'vm'\s*=>\s*'VM config'\]/);
    assert.match(libDiagnosticsPhp, /'Storage and paths'/);
    assert.match(libDiagnosticsPhp, /'Custom icons'/);
    assert.match(libDiagnosticsPhp, /'Update check'/);
    assert.match(libDiagnosticsPhp, /'repair_paths',\s*'Repair plugin paths'/);
    assert.match(libDiagnosticsPhp, /'repair_missing_custom_icons',\s*'Reset missing custom icon refs'/);
    assert.match(libDiagnosticsPhp, /'repair_orphaned_members',\s*'Remove orphaned member refs'/);
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

test('lib.php no longer carries retired folder editor mode preference resolution', () => {
    assert.match(libPhp, /require_once\(__DIR__ \. '\/lib\.prefs\.php'\);/);
    assert.doesNotMatch(libPrefsPhp, /function (?:normalize|resolve(?:Type)?)FolderEditorMode/);
    assert.doesNotMatch(libPrefsPhp, /folderEditorMode(?:Explicit)?/);
});

test('diagnostics endpoint emits support bundle v2 shape only', () => {
    assert.match(libDiagnosticsPhp, /function diagnosticsCreateSupportBundleRedactor\(string \$privacyMode\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsSupportBundleMarkRedaction\(array &\$redactor, string \$bucket, string \$fieldPath\): void/);
    assert.match(libDiagnosticsPhp, /function diagnosticsSupportBundleHashValue\(array &\$redactor, string \$fieldPath, string \$value\): \?string/);
    assert.match(libDiagnosticsPhp, /function diagnosticsSupportBundleMaskIpValue\(array &\$redactor, string \$fieldPath, string \$value\): string/);
    assert.match(libDiagnosticsPhp, /function diagnosticsSupportBundleRedactScalar\(array &\$redactor, string \$fieldPath, \$value, bool \$preserveBasename = false\)/);
    assert.match(libDiagnosticsPhp, /function diagnosticsResolveSupportBundleChannel\(\): string/);
    assert.match(libDiagnosticsPhp, /function diagnosticsReadSupportBundleBuildMetadata\(\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleBuildIdentitySection\(array \$diagnostics\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleRecentActions\(array \$events, array &\$redactor, int \$limit = 30\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleServerLogTailSection\(array &\$redactor, int \$limit = 40\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleMetaSection\(array \$diagnostics, array \$redactor\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundlePluginStateSection\(array \$diagnostics, array &\$redactor\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleRuntimeStateSection\(array \$diagnostics, array &\$redactor\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleSystemSection\(array \$diagnostics, array \$integrityFindings, array &\$redactor\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleHealthAndHistorySection\(array \$diagnostics, array \$integrityFindings, array &\$redactor\): array/);
    assert.match(libDiagnosticsPhp, /function diagnosticsBuildSupportBundleRedactionManifestSection\(array \$redactor\): array/);
    assert.match(libDiagnosticsPhp, /function getSupportBundlePreviewSnapshot\(string \$privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY\): array/);
    assert.match(libDiagnosticsPhp, /function getSupportBundleV2Snapshot\(string \$privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY\): array/);
    assert.match(diagnosticsEndpointPhp, /if \(\$action === 'support_bundle_preview'\) \{/);
    assert.match(diagnosticsEndpointPhp, /'bundle'\s*=>\s*getSupportBundlePreviewSnapshot\(\$privacyMode\)/);
    assert.match(diagnosticsEndpointPhp, /if \(\$action === 'support_bundle'\) \{/);
    assert.match(diagnosticsEndpointPhp, /'bundle'\s*=>\s*getSupportBundleV2Snapshot\(\$privacyMode\)/);
    assert.match(libDiagnosticsPhp, /'bundleMeta'\s*=>\s*diagnosticsBuildSupportBundleMetaSection\(\$diagnostics, \$redactor\)/);
    assert.match(libDiagnosticsPhp, /'pluginState'\s*=>\s*diagnosticsBuildSupportBundlePluginStateSection\(\$diagnostics, \$redactor\)/);
    assert.match(libDiagnosticsPhp, /'runtimeState'\s*=>\s*diagnosticsBuildSupportBundleRuntimeStateSection\(\$diagnostics, \$redactor\)/);
    assert.match(libDiagnosticsPhp, /'system'\s*=>\s*diagnosticsBuildSupportBundleSystemSection\(\$diagnostics, \$integrityFindings, \$redactor\)/);
    assert.match(libDiagnosticsPhp, /'uiTelemetry'\s*=>\s*new stdClass\(\)/);
    assert.match(libDiagnosticsPhp, /'healthAndHistory'\s*=>\s*diagnosticsBuildSupportBundleHealthAndHistorySection\(\$diagnostics, \$integrityFindings, \$redactor\)/);
    assert.match(libDiagnosticsPhp, /'redactionManifest'\s*=>\s*diagnosticsBuildSupportBundleRedactionManifestSection\(\$redactor\)/);
    assert.match(libDiagnosticsPhp, /'bundleVersion'\s*=>\s*2/);
    assert.match(libDiagnosticsPhp, /'bundleSaltScope'\s*=>\s*normalizeDiagnosticsPrivacyMode\(/);
    assert.match(libDiagnosticsPhp, /'bundleSaltHash'\s*=>\s*\$redactor\['saltFingerprint'\] \?\? null/);
    assert.match(libDiagnosticsPhp, /'saltScope'\s*=>\s*\$privacyMode === 'full' \? 'none' : 'per-bundle'/);
    assert.match(libDiagnosticsPhp, /'saltHash'\s*=>\s*\$privacyMode === 'full' \? null : \(\$redactor\['saltFingerprint'\] \?\? null\)/);
    assert.match(libDiagnosticsPhp, /getDiagnosticsSnapshot\('full'\)/);
    assert.match(diagnosticsEndpointPhp, /\$mutatingActions = \['track_event', 'sync_docker_order', 'normalize_prefs', 'repair_config_metadata', 'repair_paths', 'repair_missing_custom_icons', 'repair_orphaned_members', 'create_backup'\];/);
    assert.match(diagnosticsEndpointPhp, /if \(\$action === 'repair_missing_custom_icons'\) \{/);
    assert.match(diagnosticsEndpointPhp, /'repair'\s*=>\s*\$repair,/);
    assert.match(diagnosticsEndpointPhp, /fvplusRepairMissingCustomIconReferences\(\)/);
    assert.match(diagnosticsEndpointPhp, /if \(\$action === 'repair_orphaned_members'\) \{/);
    assert.match(diagnosticsEndpointPhp, /fvplusRepairOrphanedMemberReferences\(\)/);
    assert.doesNotMatch(diagnosticsEndpointPhp, /'bundleType'\s*=>\s*'FolderViewPlusSupportBundle',\s*[\r\n]+\s*'bundleVersion'\s*=>\s*1,/);
    assert.doesNotMatch(diagnosticsEndpointPhp, /'diagnostics'\s*=>\s*\$diagnostics/);
});
