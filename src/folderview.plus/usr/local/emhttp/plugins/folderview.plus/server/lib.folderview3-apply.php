<?php
function fvplusFolderView3NativeAutostartPath(): string {
    return fvplusEnvironmentDockerAutostartPath();
}

function fvplusFolderView3NativeAutostartContent(array $entries): string {
    $lines = [];
    foreach (array_slice($entries, 0, 2000) as $entry) {
        $name = truncateUtf8String(trim((string)($entry['name'] ?? '')), 255);
        if ($name === '' || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*$/', $name)) {
            continue;
        }
        $wait = normalizeIntInRange($entry['wait'] ?? 0, 0, 3600, 0);
        $lines[] = $wait > 0 ? $name . ' ' . $wait : $name;
    }
    return count($lines) > 0 ? implode("\n", $lines) . "\n" : '';
}

function applyFolderView3Migration(array $bundle, string $sourceName, string $expectedDigest, bool $includeNativeAutostart = false, array $options = []): array {
    $plan = buildFolderView3MigrationPlan($bundle, $sourceName);
    $actualDigest = strtolower(trim((string)($plan['source']['digest'] ?? '')));
    $expected = strtolower(trim($expectedDigest));
    if (!preg_match('/^[a-f0-9]{64}$/', $expected) || !hash_equals($actualDigest, $expected)) {
        throw new RuntimeException('FolderView3 source changed after preview. Preview it again before applying.');
    }
    $nativeEntries = (array)($plan['nativeAutostart'] ?? []);
    $nativePath = fvplusFolderView3NativeAutostartPath();
    $nativeContent = fvplusFolderView3NativeAutostartContent($nativeEntries);
    if ($includeNativeAutostart && count($nativeEntries) === 0) {
        throw new RuntimeException('No native Docker autostart entries are available to include.');
    }
    $transactionOptions = [
        'reason' => 'folderview3-migration',
        'afterStage' => $options['afterStage'] ?? null,
        'syncDockerOrder' => $includeNativeAutostart
    ];
    if ($includeNativeAutostart) {
        $transactionOptions['extraPaths'] = [$nativePath];
        $transactionOptions['externalApply'] = static function() use ($nativePath, $nativeContent): void {
            writeDurableFileAtomic($nativePath, $nativeContent);
            if ((string)@file_get_contents($nativePath) !== $nativeContent) {
                throw new RuntimeException('Native Docker autostart verification failed.');
            }
        };
    }
    $transaction = applyEnvironmentSnapshotTransaction((array)$plan['target'], $sourceName, $transactionOptions);
    $report = folderView3MigrationReport($plan);
    foreach ($report['operations'] as &$operation) {
        if (($operation['id'] ?? '') === 'native-autostart') {
            $operation['selected'] = $includeNativeAutostart;
        }
    }
    unset($operation);
    try {
        appendDiagnosticsHistoryEvent('folderview3_migration', null, [
            'dockerCount' => (int)($report['summary']['dockerFolderCount'] ?? 0),
            'vmCount' => (int)($report['summary']['vmFolderCount'] ?? 0),
            'nativeAutostartIncluded' => $includeNativeAutostart,
            'rollbackName' => (string)($transaction['rollback']['name'] ?? '')
        ], 'ok', 'server');
    } catch (Throwable $error) {
        // Keep a successful migration non-fatal if diagnostics logging fails.
    }
    return [
        'report' => $report,
        'transaction' => $transaction,
        'nativeAutostartIncluded' => $includeNativeAutostart,
        'appliedAt' => gmdate('c')
    ];
}
