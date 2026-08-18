<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $action = (string)($_REQUEST['action'] ?? 'export');
    $mutatingActions = ['apply', 'apply_folderview3'];
    if (in_array($action, $mutatingActions, true)) {
        requireMutationRequestGuard();
    }

    if ($action === 'export') {
        $snapshot = exportEnvironmentSnapshotPayload();
        $summary = buildEnvironmentSnapshotSummary($snapshot);
        try {
            appendDiagnosticsHistoryEvent('environment_export', null, [
                'dockerCount' => (int)($summary['docker']['folderCount'] ?? 0),
                'vmCount' => (int)($summary['vm']['folderCount'] ?? 0),
                'managedThemeCount' => (int)($summary['themeWorkspace']['managedThemeCount'] ?? 0)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'snapshot' => $snapshot,
            'summary' => $summary
        ];
    }

    if ($action === 'detect_folderview3') {
        return [
            'detection' => detectFolderView3Installation()
        ];
    }

    if ($action === 'preview_folderview3') {
        $sourceKind = strtolower(trim((string)($_POST['sourceKind'] ?? 'export')));
        $sourceName = (string)($_POST['fileName'] ?? '');
        $bundle = $sourceKind === 'installed'
            ? fvplusFolderView3ReadInstalledBundle()
            : decodeFolderView3BundlePayloadString((string)($_POST['payload'] ?? ''));
        return [
            'report' => previewFolderView3Migration($bundle, $sourceName)
        ];
    }

    if ($action === 'apply_folderview3') {
        $sourceKind = strtolower(trim((string)($_POST['sourceKind'] ?? 'export')));
        $sourceName = (string)($_POST['fileName'] ?? '');
        $bundle = $sourceKind === 'installed'
            ? fvplusFolderView3ReadInstalledBundle()
            : decodeFolderView3BundlePayloadString((string)($_POST['payload'] ?? ''));
        return [
            'migration' => applyFolderView3Migration(
                $bundle,
                $sourceName,
                (string)($_POST['expectedDigest'] ?? ''),
                normalizeBool($_POST['includeNativeAutostart'] ?? false, false)
            )
        ];
    }

    $payload = decodeEnvironmentSnapshotPayloadString((string)($_POST['payload'] ?? ''));
    $sourceName = (string)($_POST['fileName'] ?? '');

    if ($action === 'preview') {
        return previewEnvironmentSnapshotPayload($payload, $sourceName);
    }

    if ($action === 'apply') {
        return [
            'import' => importEnvironmentSnapshotPayload($payload, $sourceName)
        ];
    }

    throw new RuntimeException('Unsupported environment snapshot action.');
});
