<?php
function recordFolderView3DiagnosticsOutcome(array $details, string $status = 'error'): void {
    $safe = [];
    foreach (['phase' => ['validation', 'stale-preview', 'capture', 'writing', 'verification', 'verified'], 'outcome' => ['validation-rejected', 'stale-preview', 'capture-failed', 'write-failed', 'verification-failed', 'applied'], 'rollback' => ['not-needed', 'complete', 'failed'], 'sourceKind' => ['installed', 'export'], 'operation' => ['preview', 'apply']] as $key => $allowed) {
        $safe[$key] = in_array($details[$key] ?? null, $allowed, true) ? $details[$key] : $allowed[0];
    }
    foreach (['dockerCount', 'vmCount', 'warningCount'] as $key) $safe[$key] = is_int($details[$key] ?? null) ? min(1000000, max(0, $details[$key])) : 0;
    foreach (['verified', 'checkpointAvailable', 'nativeAutostartRequested', 'nativeAutostartIncluded'] as $key) $safe[$key] = ($details[$key] ?? false) === true;
    try {
        appendDiagnosticsHistoryEvent($safe['operation'] === 'preview' ? 'folderview3_preview' : 'folderview3_migration', null, $safe, $status === 'ok' ? 'ok' : 'error', 'server');
    } catch (Throwable $error) { /* Keep diagnostics failures independent of migration outcomes. */ }
}

function withFolderView3Diagnostics(callable $operation, array $context): array {
    $progress = ['phase' => 'validation', 'rollback' => 'not-needed', 'checkpointAvailable' => false];
    $context['operation'] = 'apply';
    try {
        $result = $operation($progress);
    } catch (Throwable $error) {
        $outcomes = ['validation' => 'validation-rejected', 'stale-preview' => 'stale-preview', 'capture' => 'capture-failed', 'writing' => 'write-failed', 'verification' => 'verification-failed'];
        recordFolderView3DiagnosticsOutcome(array_merge($context, $progress, ['outcome' => $outcomes[$progress['phase']] ?? 'verification-failed']));
        throw $error;
    }
    $verified = ($result['transaction']['verified'] ?? false) === true;
    recordFolderView3DiagnosticsOutcome(array_merge($context, $progress, [
        'dockerCount' => (int)($result['report']['summary']['dockerFolderCount'] ?? 0),
        'vmCount' => (int)($result['report']['summary']['vmFolderCount'] ?? 0),
        'warningCount' => count((array)($result['report']['warnings'] ?? [])), 'outcome' => $verified ? 'applied' : 'verification-failed',
        'verified' => $verified, 'nativeAutostartIncluded' => $verified && ($context['nativeAutostartRequested'] ?? false) === true
    ]), $verified ? 'ok' : 'error');
    return $result;
}
