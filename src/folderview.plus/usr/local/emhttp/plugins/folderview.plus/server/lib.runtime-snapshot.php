<?php

const FVPLUS_RUNTIME_SNAPSHOT_SCHEMA_VERSION = 1;
const FVPLUS_RUNTIME_SNAPSHOT_KIND = 'runtime_snapshot';

function normalizeRuntimeSnapshotMode(string $mode): string {
    $normalized = strtolower(trim($mode));
    return in_array($normalized, ['config', 'state', 'full', 'check'], true) ? $normalized : 'state';
}

function normalizeRuntimeSnapshotSinceToken(string $value): string {
    $normalized = strtolower(trim($value));
    return preg_match('/^[a-f0-9]{64}$/', $normalized) ? $normalized : '';
}

function runtimeSnapshotBool($value): bool {
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (int)$value === 1;
    }
    return in_array(strtolower(trim((string)$value)), ['1', 'true', 'yes', 'on', 'running', 'started'], true);
}

function runtimeSnapshotStateProjection(string $type, array $runtime): array {
    $safeType = ensureType($type);
    $projection = [];
    foreach ($runtime as $key => $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $name = trim((string)($entry['name'] ?? $entry['Name'] ?? $key));
        if ($name === '') {
            continue;
        }
        if ($safeType === 'vm') {
            $projection[$name] = [
                'identity' => trim((string)($entry['uuid'] ?? '')),
                'state' => strtolower(trim((string)($entry['state'] ?? 'unknown'))),
                'autostart' => runtimeSnapshotBool($entry['autostart'] ?? false)
            ];
            continue;
        }

        $stateNode = is_array($entry['info']['State'] ?? null) ? $entry['info']['State'] : [];
        $running = array_key_exists('running', $entry)
            ? runtimeSnapshotBool($entry['running'])
            : runtimeSnapshotBool($stateNode['Running'] ?? false);
        $paused = array_key_exists('paused', $entry)
            ? runtimeSnapshotBool($entry['paused'])
            : runtimeSnapshotBool($stateNode['Paused'] ?? false);
        $state = strtolower(trim((string)($entry['state'] ?? '')));
        if ($state === '') {
            $state = $running ? ($paused ? 'paused' : 'running') : 'stopped';
        }
        $rawIdentity = preg_replace('/^sha256:/i', '', trim((string)($entry['id'] ?? $entry['shortId'] ?? $entry['Id'] ?? '')));
        $projection[$name] = [
            // State reads already expose Docker's 12-character ID while full reads
            // carry the complete digest. Canonicalize both so switching snapshot
            // detail modes cannot manufacture a false runtime change.
            'identity' => substr((string)$rawIdentity, 0, 12),
            'state' => $state,
            'running' => $running,
            'paused' => $paused,
            'autostart' => runtimeSnapshotBool($entry['autostart'] ?? $stateNode['Autostart'] ?? false),
            'updated' => $entry['Updated'] ?? $stateNode['Updated'] ?? null
        ];
    }
    ksort($projection, SORT_NATURAL | SORT_FLAG_CASE);
    return $projection;
}

function runtimeSnapshotSignature(string $type, array $runtime): string {
    $encoded = json_encode(runtimeSnapshotStateProjection($type, $runtime), JSON_UNESCAPED_SLASHES);
    return hash('sha256', is_string($encoded) ? $encoded : '[]');
}

function runtimeSnapshotOrderFromEntities(string $type, array $runtime): array {
    $safeType = ensureType($type);
    $names = array_keys(runtimeSnapshotStateProjection($safeType, $runtime));
    $prefsPath = $safeType === 'docker'
        ? '/boot/config/plugins/dockerMan/userprefs.cfg'
        : '/boot/config/plugins/dynamix.vm.manager/userprefs.cfg';
    $parsed = is_file($prefsPath) ? @parse_ini_file($prefsPath) : false;
    $preferred = array_values(is_array($parsed) ? $parsed : []);
    $rank = [];
    foreach ($preferred as $index => $name) {
        $normalized = trim((string)$name);
        if ($normalized !== '' && !array_key_exists($normalized, $rank)) {
            $rank[$normalized] = (int)$index;
        }
    }
    $fallbackBase = count($rank) + count($names) + 1;
    $originalIndex = array_flip($names);
    usort($names, static function ($left, $right) use ($rank, $fallbackBase, $originalIndex): int {
        $leftRank = $rank[$left] ?? ($fallbackBase + (int)($originalIndex[$left] ?? 0));
        $rightRank = $rank[$right] ?? ($fallbackBase + (int)($originalIndex[$right] ?? 0));
        if ($leftRank === $rightRank) {
            return strnatcasecmp((string)$left, (string)$right);
        }
        return $leftRank <=> $rightRank;
    });
    return array_values($names);
}

function readRuntimeSnapshotConfig(string $type): array {
    $safeType = ensureType($type);
    return withConfigMutationLock(static function () use ($safeType): array {
        $folders = json_decode(readFolder($safeType), true);
        if (!is_array($folders)) {
            $folders = [];
        }
        $prefs = readTypePrefs($safeType);
        $order = json_decode(readUserPrefs($safeType), true);
        if (!is_array($order)) {
            $order = [];
        }
        $metadata = readConfigMetadata($safeType, true);
        return [
            'folders' => $folders,
            'prefs' => $prefs,
            'order' => array_values($order),
            'metadata' => $metadata
        ];
    });
}

function runtimeSnapshotToken(string $type, array $config, array $unraidOrder, string $runtimeSignature): string {
    $metadata = is_array($config['metadata'] ?? null) ? $config['metadata'] : [];
    $identity = [
        'schemaVersion' => FVPLUS_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
        'type' => ensureType($type),
        'folderRevision' => max(0, (int)($metadata['folderRevision'] ?? 0)),
        'prefsRevision' => max(0, (int)($metadata['prefsRevision'] ?? 0)),
        'folderSha256' => strtolower(trim((string)($metadata['folderSha256'] ?? ''))),
        'prefsSha256' => strtolower(trim((string)($metadata['prefsSha256'] ?? ''))),
        'order' => array_values(is_array($config['order'] ?? null) ? $config['order'] : []),
        'unraidOrder' => array_values($unraidOrder),
        'runtimeSignature' => $runtimeSignature
    ];
    $encoded = json_encode($identity, JSON_UNESCAPED_SLASHES);
    return hash('sha256', is_string($encoded) ? $encoded : '[]');
}

function buildRuntimeSnapshot(
    string $type,
    string $mode = 'state',
    string $sinceToken = '',
    bool $preferLiveUpdateStatus = false,
    ?int $ttlSeconds = null,
    bool $forceRefresh = false
): array {
    $startedAt = microtime(true);
    $safeType = ensureType($type);
    $safeMode = normalizeRuntimeSnapshotMode($mode);
    $safeSinceToken = normalizeRuntimeSnapshotSinceToken($sinceToken);
    if ($safeMode === 'config') {
        $runtime = [];
    } elseif ($safeMode === 'full') {
        $runtime = readInfoCached($safeType, 'full', $ttlSeconds, $forceRefresh);
    } else {
        $runtime = $preferLiveUpdateStatus
            ? readInfoState($safeType, true)
            : readInfoCached($safeType, 'state', $ttlSeconds, $forceRefresh || $safeMode === 'check');
    }
    if (!is_array($runtime)) {
        $runtime = [];
    }

    $config = readRuntimeSnapshotConfig($safeType);
    $unraidOrder = $safeMode === 'config' ? [] : runtimeSnapshotOrderFromEntities($safeType, $runtime);
    $runtimeSignature = runtimeSnapshotSignature($safeType, $runtime);
    $snapshotToken = runtimeSnapshotToken($safeType, $config, $unraidOrder, $runtimeSignature);
    $metadata = is_array($config['metadata'] ?? null) ? $config['metadata'] : [];
    $notModified = $safeMode === 'check'
        && $safeSinceToken !== ''
        && hash_equals($snapshotToken, $safeSinceToken);
    $response = [
        'kind' => FVPLUS_RUNTIME_SNAPSHOT_KIND,
        'schemaVersion' => FVPLUS_RUNTIME_SNAPSHOT_SCHEMA_VERSION,
        'type' => $safeType,
        'mode' => $safeMode,
        'generatedAt' => gmdate('c'),
        'durationMs' => max(0, (int)round((microtime(true) - $startedAt) * 1000)),
        'snapshotToken' => $snapshotToken,
        'runtimeSignature' => $runtimeSignature,
        'notModified' => $notModified,
        'payloadIncluded' => $safeMode !== 'check',
        'runtimeIncluded' => $safeMode !== 'config' && $safeMode !== 'check',
        'revisions' => [
            'folder' => max(0, (int)($metadata['folderRevision'] ?? 0)),
            'prefs' => max(0, (int)($metadata['prefsRevision'] ?? 0))
        ],
        'counts' => [
            'folders' => count((array)($config['folders'] ?? [])),
            'entities' => count($runtime),
            'order' => count((array)($config['order'] ?? []))
        ]
    ];
    if ($safeMode === 'check') {
        return $response;
    }
    $response['folders'] = is_array($config['folders'] ?? null) ? $config['folders'] : [];
    $response['order'] = array_values(is_array($config['order'] ?? null) ? $config['order'] : []);
    $response['unraidOrder'] = $unraidOrder;
    $response['prefs'] = is_array($config['prefs'] ?? null) ? $config['prefs'] : [];
    $response['metadata'] = $metadata;
    if ($safeMode !== 'config') {
        $response['runtime'] = $runtime;
    }
    return $response;
}
