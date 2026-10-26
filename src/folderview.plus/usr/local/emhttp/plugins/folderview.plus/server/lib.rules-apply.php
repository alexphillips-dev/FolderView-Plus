<?php
// Stateful boundary: previews never migrate, repair, back up or write configuration.
function fvplusReadRulePreviewSource(string $type): array {
    $type = ensureType($type);
    $values = []; $hashes = [];
    foreach (['folders' => getFolderFilePath($type), 'prefs' => getTypePrefsPath($type), 'metadata' => getConfigMetadataPath($type)] as $key => $path) {
        $raw = is_file($path) ? @file_get_contents($path) : null;
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (($key !== 'metadata' || $raw !== null) && !is_array($decoded)) {
            throw new RuntimeException('Configuration is unavailable. Reload Settings before previewing rules.');
        }
        $values[$key] = $decoded ?? [];
        $hashes[$key] = is_string($raw) ? hash('sha256', $raw) : '';
    }
    foreach ($values['prefs']['autoRules'] ?? [] as $rule) {
        if (!is_array($rule) || trim((string)($rule['id'] ?? '')) === '') {
            throw new RuntimeException('Configuration is unavailable. Reload Settings before previewing rules.');
        }
    }
    $folders = normalizeFolderMapPayload($values['folders']);
    if (jsonObjectsDiffer($folders, $values['folders']) || jsonObjectsDiffer(normalizeTypePrefs($values['prefs']), $values['prefs'])) {
        throw new RuntimeException('Configuration is unavailable. Reload Settings before previewing rules.');
    }
    return ['folders' => $folders, 'rules' => normalizeTypePrefs($values['prefs'])['autoRules'], 'hashes' => $hashes];
}

function fvplusBuildRulePreview(string $type, ?array $verifiedInventory = null): array {
    $type = ensureType($type);
    $source = fvplusReadRulePreviewSource($type);
    $info = $verifiedInventory ?? fvplusReadRepairInventory($type);
    $snapshot = fvplusBuildMembershipSnapshot($type, $source['folders'], $source['rules'], $info);
    $rows = []; $assignments = [];
    foreach ($snapshot['decisionsByName'] as $name => $decision) {
        $target = (string)($decision['assignedRule']['folderId'] ?? '');
        $owners = [];
        foreach ($snapshot['byFolder'] as $id => $folder) if (in_array((string)$name, $folder['manualMembers'], true)) $owners[] = (string)$id;
        $change = $target !== '' && $owners !== [$target];
        if ($change) $assignments[$target][] = (string)$name;
        $rows[] = ['item' => (string)$name, 'result' => $target !== '' ? 'assigned' : ($decision['blockedBy'] ? 'blocked' : 'unassigned'),
            'folderId' => $target, 'folderName' => (string)($source['folders'][$target]['name'] ?? ''), 'matchedRule' => $decision['matchedRule'], 'apply' => $change];
    }
    $digest = hash('sha256', json_encode([$source['hashes'], fvplusRulesInputDigest($type, $source['folders'], $source['rules'], $info)], JSON_THROW_ON_ERROR));
    return ['rows' => $rows, 'digest' => $digest, 'assignments' => array_map(static fn($id, $items): array => ['folderId' => (string)$id, 'items' => $items], array_keys($assignments), array_values($assignments)),
        'issues' => $snapshot['issues'], 'ready' => count(array_filter($snapshot['issues'], static fn($issue): bool => $issue['code'] === 'invalid-predicate')) === 0];
}

function fvplusApplyRulePreview(string $type, string $expectedDigest, ?array $verifiedInventory = null): array {
    $type = ensureType($type);
    if (!preg_match('/^[a-f0-9]{64}$/', $expectedDigest)) throw new RuntimeException('Invalid preview digest.');
    return withConfigMutationLock(static function () use ($type, $expectedDigest, $verifiedInventory): array {
        $info = $verifiedInventory ?? fvplusReadRepairInventory($type);
        $preview = fvplusBuildRulePreview($type, $info);
        if (!hash_equals($expectedDigest, $preview['digest'])) throw new FVPlusConfigConflictException('The preview changed. Run the preview again before applying.');
        if (!$preview['ready']) throw new RuntimeException('Correct invalid rules before applying the preview.');
        if (!$preview['assignments']) return ['assignedCount' => 0, 'results' => [], 'backup' => null];
        // Validate and back up within the same configuration lock as the existing transaction.
        $backup = createBackupSnapshot($type, 'before-rule-preview-assign');
        $result = bulkAssignItemsToFolders($type, $preview['assignments'], $info);
        $result['backup'] = $backup;
        return $result;
    });
}

function fvplusValidateRuleChanges(string $type, array $current, array $next): void {
    if ($current === $next) return;
    $changed = []; $remaining = array_map(static function ($rule) { if (is_array($rule)) ksort($rule); return $rule; }, $current);
    foreach ($next as $rule) {
        $comparison = $rule; if (is_array($comparison)) ksort($comparison);
        $index = array_search($comparison, $remaining, true);
        if ($index !== false) { unset($remaining[$index]); continue; }
        if (!is_array($rule) || !in_array($rule['effect'] ?? 'include', FVPLUS_RULE_EFFECTS, true)) throw new RuntimeException('Correct invalid rules before saving.');
        foreach (['id', 'folderId', 'effect', 'kind', 'pattern', 'labelKey', 'labelValue', 'source'] as $key) {
            if (array_key_exists($key, $rule) && !is_string($rule[$key])) throw new RuntimeException('Correct invalid rules before saving.');
        }
        if (!is_string($rule['id'] ?? null) || trim($rule['id']) === '' || (array_key_exists('enabled', $rule) && !is_bool($rule['enabled']))) throw new RuntimeException('Correct invalid rules before saving.');
        $sameId = array_filter($next, static fn($entry): bool => is_array($entry) && ($entry['id'] ?? null) === $rule['id']);
        if (count($sameId) > 1) throw new RuntimeException('Correct invalid rules before saving.');
        $changed[] = $rule;
    }
    $compiled = fvplusCompileRuleSet($changed, $type, readRawFolderMap($type));
    if ($compiled['issues']) throw new RuntimeException('Correct invalid rules before saving.');
}
