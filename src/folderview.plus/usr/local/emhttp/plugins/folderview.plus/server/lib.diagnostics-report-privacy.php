<?php

function diagnosticsProjectBackupRecord(?array $backup, string $fieldPath, array &$redactor): ?array {
    if ($backup === null || ($redactor['mode'] ?? 'sanitized') === 'full') {
        return $backup;
    }
    $safeReasons = ['scheduled', 'manual', 'manual-diagnostics'];
    foreach (['name', 'reason', 'traceId', 'transactionId'] as $key) {
        if (!isset($backup[$key]) || ($key === 'reason' && in_array($backup[$key], $safeReasons, true))) {
            continue;
        }
        $backup[$key] = diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.' . $key, $backup[$key]);
    }
    return $backup;
}

function diagnosticsProjectHistoryEvents(array $events, string $fieldPath, array &$redactor): array {
    $projected = [];
    foreach ($events as $event) {
        if (!is_array($event)) continue;
        $projected[] = [
            'id' => (string)($event['id'] ?? ''),
            'timestamp' => (string)($event['timestamp'] ?? ''),
            'action' => diagnosticsSupportBundleEventLabel((string)($event['action'] ?? ''), 'action', $fieldPath . '.action', $redactor),
            'type' => isset($event['type']) ? diagnosticsSupportBundleEventLabel((string)$event['type'], 'type', $fieldPath . '.type', $redactor) : null,
            'status' => diagnosticsSupportBundleEventLabel((string)($event['status'] ?? 'ok'), 'status', $fieldPath . '.status', $redactor),
            'source' => diagnosticsSupportBundleEventLabel((string)($event['source'] ?? 'server'), 'source', $fieldPath . '.source', $redactor),
            'traceId' => (string)($event['traceId'] ?? ''),
            'transactionId' => (string)($event['transactionId'] ?? ''),
            'details' => diagnosticsSupportBundleRedactEventDetails(
                is_array($event['details'] ?? null) ? $event['details'] : [], $fieldPath . '.details', $redactor
            )
        ];
    }
    return $projected;
}

function diagnosticsProjectTimeline(array $rows, string $fieldPath, array &$redactor): array {
    $projected = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $projected[] = [
            'timestamp' => (string)($row['timestamp'] ?? ''),
            'action' => diagnosticsSupportBundleEventLabel((string)($row['action'] ?? ''), 'action', $fieldPath . '.*.action', $redactor),
            'type' => isset($row['type']) ? diagnosticsSupportBundleEventLabel((string)$row['type'], 'type', $fieldPath . '.*.type', $redactor) : null,
            'status' => diagnosticsSupportBundleEventLabel((string)($row['status'] ?? 'ok'), 'status', $fieldPath . '.*.status', $redactor),
            'summary' => diagnosticsSupportBundleRedactRecentTimelineSummary((string)($row['summary'] ?? ''), $redactor)
        ];
    }
    if (count($projected) < count($rows)) diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', $fieldPath);
    return $projected;
}

function diagnosticsRedactIntegrityIdentifiers(array $integrity, string $type, string $fieldPath, array &$redactor): array {
    if (($redactor['mode'] ?? 'sanitized') === 'full') return $integrity;
    foreach ([
        'invalidFolderRegex' => 'folderIds', 'invalidFolderIconPaths' => 'folderIds',
        'missingManualOrderIds' => 'ids', 'missingPinnedFolderIds' => 'ids', 'missingHiddenFolderIds' => 'ids'
    ] as $check => $key) {
        if (!isset($integrity[$check][$key])) continue;
        $integrity[$check][$key] = diagnosticsSupportBundleRedactFolderIdList(
            $redactor, $type, $fieldPath . '.' . $check . '.' . $key . '.*', $integrity[$check][$key]
        );
    }
    if (!empty($integrity['invalidAutoRules']['rules'])) {
        foreach ($integrity['invalidAutoRules']['rules'] as &$rule) {
            if (!isset($rule['id'])) continue;
            $rule['id'] = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.invalidAutoRules.rules.*.id', $rule['id']);
        }
    }
    return $integrity;
}

function diagnosticsRedactReportFolderReferences(array $typeData, string $type, string $fieldPath, array &$redactor): array {
    $folders = [];
    foreach ($typeData['stateSnapshot']['folders'] as $folder) {
        foreach (['folderId', 'parentId'] as $key) {
            $folder[$key] = diagnosticsSupportBundleRedactFolderIdValue(
                $redactor, $type, $fieldPath . '.stateSnapshot.folders.*.' . $key, $folder[$key]
            );
        }
        $folders[$folder['folderId']] = $folder;
    }
    $typeData['stateSnapshot']['folders'] = $folders;

    $integrity = diagnosticsRedactIntegrityIdentifiers($typeData['integrityChecks'], $type, $fieldPath . '.integrityChecks', $redactor);
    foreach ($integrity['orphanedMembers']['folders'] as &$row) {
        $row['folderId'] = diagnosticsSupportBundleRedactFolderIdValue(
            $redactor, $type, $fieldPath . '.integrityChecks.orphanedMembers.folders.*.folderId', $row['folderId']
        );
    }
    unset($row);
    foreach ($integrity['duplicateFolderNames']['examples'] as &$row) {
        $row['folderIds'] = diagnosticsSupportBundleRedactFolderIdList(
            $redactor, $type, $fieldPath . '.integrityChecks.duplicateFolderNames.examples.*.folderIds.*', $row['folderIds']
        );
    }
    unset($row);
    foreach ($integrity['duplicateAssignments'] as $group => &$assignment) {
        foreach ($assignment['examples'] as &$row) {
            $row['folderIds'] = diagnosticsSupportBundleRedactFolderIdList(
                $redactor, $type, $fieldPath . '.integrityChecks.duplicateAssignments.' . $group . '.examples.*.folderIds.*', $row['folderIds']
            );
        }
        unset($row);
    }
    $typeData['integrityChecks'] = $integrity;
    return $typeData;
}

function diagnosticsSanitizeReport(array $report): array {
    $redactor = diagnosticsCreateSupportBundleRedactor('sanitized');
    foreach ($report['types'] as $type => &$typeData) {
        $fieldPath = 'types.' . $type;
        foreach (['pinnedFolderIds', 'hiddenFolderIds'] as $key) {
            $typeData[$key] = diagnosticsSupportBundleRedactFolderIdList($redactor, $type, $fieldPath . '.' . $key . '.*', $typeData[$key]);
        }
        $typeData['expandedFolderState'] = diagnosticsSupportBundleRedactExpandedFolderState(
            $redactor, $type, $fieldPath . '.expandedFolderState', $typeData['expandedFolderState']
        );
        $typeData['lastBackup'] = diagnosticsProjectBackupRecord($typeData['lastBackup'], $fieldPath . '.lastBackup', $redactor);
        $typeData = diagnosticsRedactReportFolderReferences($typeData, $type, $fieldPath, $redactor);
    }
    unset($typeData);
    foreach ($report['customIcons']['missingReferencedIcons'] as &$icon) {
        foreach ($icon['references'] as &$reference) {
            $reference['folderId'] = diagnosticsSupportBundleRedactFolderIdValue(
                $redactor, $reference['type'], 'customIcons.missingReferencedIcons.*.references.*.folderId', $reference['folderId']
            );
        }
        unset($reference);
    }
    $report['importExportHistory']['events'] = diagnosticsProjectHistoryEvents(
        $report['importExportHistory']['events'], 'importExportHistory.events.*', $redactor
    );
    $report['recentTimeline'] = diagnosticsProjectTimeline($report['recentTimeline'], 'recentTimeline', $redactor);
    return $report;
}
