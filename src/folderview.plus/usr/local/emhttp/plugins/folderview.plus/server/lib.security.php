<?php

if (!class_exists('FVPlusSecurityRequestException')) {
    final class FVPlusSecurityRequestException extends RuntimeException
    {
    }
}

function requireMutationRequestGuard(): void
{
    if (($GLOBALS['fvplusMutationGuardComplete'] ?? false) === true) {
        return;
    }
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
        throw new RuntimeException('Unsupported method.');
    }
    $tokenMode = getRequestTokenEnforcementMode();
    $hasMutationMarker = hasExplicitMutationRequestHeader();
    if ($tokenMode === 'strict') {
        if (getConfiguredRequestToken() === '') {
            throw new RuntimeException('Request token is unavailable.');
        }
        if (!$hasMutationMarker || !validateOptionalRequestToken() || !isTrustedMutationContext()) {
            throw new RuntimeException('Blocked by request guard.');
        }
        acquireConfigMutationLock();
        fvplus_enforce_mutation_security_controls();
        $GLOBALS['fvplusMutationGuardComplete'] = true;
        return;
    }

    $tokenRequiredForBypass = $tokenMode !== 'off' && getConfiguredRequestToken() !== '';
    $tokenValidated = validateOptionalRequestToken();
    $headerValidated = $hasMutationMarker && ($tokenValidated || !$tokenRequiredForBypass);
    if (!isTrustedMutationContext() && !$headerValidated) {
        throw new RuntimeException('Blocked by request guard.');
    }
    acquireConfigMutationLock();
    fvplus_enforce_mutation_security_controls();
    $GLOBALS['fvplusMutationGuardComplete'] = true;
}

function fvplus_security_state_path(): string
{
    $override = trim((string)getenv('FVPLUS_TEST_SECURITY_STATE_PATH'));
    return $override !== '' ? $override : '/var/run/folderview.plus/security-state.json';
}

function fvplus_security_state_lock_path(): string
{
    return fvplus_security_state_path() . '.lock';
}

function fvplus_security_normalize_state($decoded): array
{
    $state = is_array($decoded) ? $decoded : [];
    return [
        'schemaVersion' => 1,
        'nonces' => array_values(is_array($state['nonces'] ?? null) ? $state['nonces'] : []),
        'transactions' => array_values(is_array($state['transactions'] ?? null) ? $state['transactions'] : []),
        'rateBuckets' => is_array($state['rateBuckets'] ?? null) ? $state['rateBuckets'] : []
    ];
}

function fvplus_security_with_state_lock(callable $callback)
{
    $path = fvplus_security_state_path();
    $lockPath = fvplus_security_state_lock_path();
    $parent = dirname($path);
    if (!is_dir($parent) && !@mkdir($parent, 0700, true) && !is_dir($parent)) {
        throw new FVPlusSecurityRequestException('Security request state is unavailable.', 503);
    }
    @chmod($parent, 0700);
    $lock = @fopen($lockPath, 'c+');
    if (!is_resource($lock) || !@flock($lock, LOCK_EX)) {
        if (is_resource($lock)) {
            @fclose($lock);
        }
        throw new FVPlusSecurityRequestException('Security request state is busy.', 503);
    }
    @chmod($lockPath, 0600);

    try {
        $decoded = null;
        if (is_file($path)) {
            $decoded = @json_decode((string)@file_get_contents($path), true);
        }
        $state = fvplus_security_normalize_state($decoded);
        $result = null;
        $callbackError = null;
        try {
            $result = $callback($state);
        } catch (Throwable $error) {
            $callbackError = $error;
        }
        $encoded = json_encode($state, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            throw new FVPlusSecurityRequestException('Security request state could not be encoded.', 500);
        }
        $tmpPath = $path . '.tmp.' . bin2hex(random_bytes(6));
        if (@file_put_contents($tmpPath, $encoded, LOCK_EX) === false) {
            @unlink($tmpPath);
            throw new FVPlusSecurityRequestException('Security request state could not be written.', 503);
        }
        @chmod($tmpPath, 0600);
        if (!@rename($tmpPath, $path)) {
            @unlink($tmpPath);
            throw new FVPlusSecurityRequestException('Security request state could not be committed.', 503);
        }
        @chmod($path, 0600);
        if ($callbackError instanceof Throwable) {
            throw $callbackError;
        }
        return $result;
    } finally {
        @flock($lock, LOCK_UN);
        @fclose($lock);
    }
}

function fvplus_security_normalize_endpoint(string $endpoint): string
{
    $raw = strtolower(trim(str_replace('\\', '/', $endpoint)));
    if ($raw === '' || $raw !== basename($raw)) {
        return '';
    }
    $endpoint = $raw;
    return preg_match('/^[a-z0-9_.-]+\.php$/', $endpoint) ? $endpoint : '';
}

function fvplus_security_normalize_action(string $action): string
{
    $action = strtolower(trim($action));
    return preg_match('/^[a-z0-9_.:-]{0,80}$/', $action) ? $action : '';
}

function fvplus_security_declared_target_contract(string $endpoint, string $action): array
{
    $endpoint = fvplus_security_normalize_endpoint($endpoint);
    $action = fvplus_security_normalize_action($action);
    $manifest = fvplus_load_api_endpoint_manifest();
    $definition = $manifest['endpoints'][$endpoint] ?? null;
    if ($endpoint === '' || !is_array($definition)) {
        throw new FVPlusSecurityRequestException('Mutation nonce target is invalid.', 400);
    }
    $defaults = is_array($manifest['defaults'] ?? null) ? $manifest['defaults'] : [];
    $effective = array_replace($defaults, $definition);
    $actions = is_array($definition['actions'] ?? null) ? $definition['actions'] : null;
    if (is_array($actions)) {
        if ($action === '') {
            $action = fvplus_security_normalize_action((string)($definition['defaultAction'] ?? ''));
        }
        if (!is_array($actions[$action] ?? null)) {
            throw new FVPlusSecurityRequestException('Mutation nonce action is invalid.', 400);
        }
        $effective = array_replace($effective, $actions[$action]);
    } elseif ($action !== '') {
        throw new FVPlusSecurityRequestException('Mutation nonce action is not supported.', 400);
    }
    $methods = array_map('strtoupper', is_array($effective['methods'] ?? null) ? $effective['methods'] : []);
    if (!in_array('POST', $methods, true)) {
        throw new FVPlusSecurityRequestException('Mutation nonce target does not accept POST.', 405);
    }
    $effective['endpoint'] = $endpoint;
    $effective['action'] = $action;
    return $effective;
}

function fvplus_issue_mutation_nonce(string $endpoint, string $action = ''): array
{
    $contract = fvplus_security_declared_target_contract($endpoint, $action);
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $now = time();
    $expiresAt = $now + FVPLUS_MUTATION_NONCE_TTL_SECONDS;

    fvplus_security_with_state_lock(static function (array &$state) use ($contract, $tokenHash, $now, $expiresAt): void {
        $state['nonces'] = array_values(array_filter($state['nonces'], static function ($row) use ($now): bool {
            return is_array($row) && (int)($row['expiresAt'] ?? 0) >= $now;
        }));
        $state['nonces'][] = [
            'tokenHash' => $tokenHash,
            'endpoint' => (string)$contract['endpoint'],
            'action' => (string)$contract['action'],
            'issuedAt' => $now,
            'expiresAt' => $expiresAt
        ];
        if (count($state['nonces']) > FVPLUS_MUTATION_NONCE_MAX_ACTIVE) {
            $state['nonces'] = array_slice($state['nonces'], -FVPLUS_MUTATION_NONCE_MAX_ACTIVE);
        }
    });

    return [
        'nonce' => $token,
        'endpoint' => (string)$contract['endpoint'],
        'action' => (string)$contract['action'],
        'expiresAt' => gmdate('c', $expiresAt)
    ];
}

function fvplus_security_request_nonce(): string
{
    return trim((string)($_POST['_fv_nonce'] ?? getRequestHeaderValue('X-FV-Nonce')));
}

function fvplus_security_consume_nonce(array &$state, string $nonce, string $endpoint, string $action, int $now): void
{
    if (!preg_match('/^[a-f0-9]{64}$/', $nonce)) {
        throw new FVPlusSecurityRequestException('A valid one-time mutation nonce is required.', 409);
    }
    $nonceHash = hash('sha256', $nonce);
    $matched = null;
    $remaining = [];
    foreach ($state['nonces'] as $row) {
        if (!is_array($row) || (int)($row['expiresAt'] ?? 0) < $now) {
            continue;
        }
        if ($matched === null && hash_equals((string)($row['tokenHash'] ?? ''), $nonceHash)) {
            $matched = $row;
            continue;
        }
        $remaining[] = $row;
    }
    $state['nonces'] = $remaining;
    if (!is_array($matched)) {
        throw new FVPlusSecurityRequestException('Mutation nonce is expired, invalid, or already used.', 409);
    }
    if (!hash_equals((string)($matched['endpoint'] ?? ''), $endpoint)
        || !hash_equals((string)($matched['action'] ?? ''), $action)) {
        throw new FVPlusSecurityRequestException('Mutation nonce does not match this operation.', 409);
    }
}

function fvplus_security_consume_transaction(array &$state, string $transactionId, string $endpoint, string $action, int $now): void
{
    $transactionId = normalizeRequestTransactionId($transactionId);
    if ($transactionId === '' || $transactionId === 'tx-fallback') {
        throw new FVPlusSecurityRequestException('A valid mutation transaction ID is required.', 409);
    }
    $retained = [];
    foreach ($state['transactions'] as $row) {
        if (!is_array($row) || (int)($row['expiresAt'] ?? 0) < $now) {
            continue;
        }
        if (hash_equals((string)($row['transactionId'] ?? ''), $transactionId)) {
            throw new FVPlusSecurityRequestException('Duplicate mutation transaction rejected.', 409);
        }
        $retained[] = $row;
    }
    $retained[] = [
        'transactionId' => $transactionId,
        'endpoint' => $endpoint,
        'action' => $action,
        'expiresAt' => $now + FVPLUS_MUTATION_TRANSACTION_TTL_SECONDS
    ];
    $state['transactions'] = array_slice($retained, -FVPLUS_MUTATION_TRANSACTION_MAX);
}

function fvplus_security_enforce_rate_limit(array &$state, array $contract, int $now): void
{
    $rateLimit = is_array($contract['rateLimit'] ?? null) ? $contract['rateLimit'] : [];
    $windowSeconds = max(1, min(3600, (int)($rateLimit['windowSeconds'] ?? 60)));
    $maxRequests = max(1, min(10000, (int)($rateLimit['maxRequests'] ?? 180)));
    $category = substr(trim((string)($contract['auditCategory'] ?? 'mutation')), 0, 120);
    $bucketKey = hash('sha256', $category);
    $windowStart = $now - $windowSeconds;
    $timestamps = array_values(array_filter(
        is_array($state['rateBuckets'][$bucketKey] ?? null) ? $state['rateBuckets'][$bucketKey] : [],
        static fn($timestamp): bool => (int)$timestamp > $windowStart
    ));
    if (count($timestamps) >= $maxRequests) {
        if (!headers_sent()) {
            $retryAfter = max(1, ((int)$timestamps[0] + $windowSeconds) - $now);
            header('Retry-After: ' . $retryAfter);
        }
        throw new FVPlusSecurityRequestException('This operation is temporarily rate limited. Try again shortly.', 429);
    }
    $timestamps[] = $now;
    $state['rateBuckets'][$bucketKey] = $timestamps;
    foreach ($state['rateBuckets'] as $key => $rows) {
        $filtered = array_values(array_filter(
            is_array($rows) ? $rows : [],
            static fn($timestamp): bool => (int)$timestamp > ($now - 3600)
        ));
        if (count($filtered) === 0) {
            unset($state['rateBuckets'][$key]);
        } else {
            $state['rateBuckets'][$key] = array_slice($filtered, -10000);
        }
    }
}

function fvplus_security_current_contract(): array
{
    $contract = $GLOBALS['fvplusApiContractContext'] ?? null;
    if (is_array($contract) && !empty($contract['endpoint'])) {
        return $contract;
    }
    $endpoint = fvplus_current_api_endpoint_name();
    return $endpoint !== '' ? fvplus_resolve_api_endpoint_contract($endpoint) : [];
}

function fvplus_enforce_mutation_security_controls(): array
{
    $contract = fvplus_security_current_contract();
    $endpoint = fvplus_security_normalize_endpoint((string)($contract['endpoint'] ?? fvplus_current_api_endpoint_name()));
    $action = fvplus_security_normalize_action((string)($contract['action'] ?? ''));
    if ($endpoint === '') {
        throw new FVPlusSecurityRequestException('Mutation endpoint context is unavailable.', 500);
    }
    $now = time();
    $replayProtection = ($contract['replayProtection'] ?? true) !== false;
    $nonce = fvplus_security_request_nonce();
    $transactionId = getRequestTransactionId();

    fvplus_security_with_state_lock(static function (array &$state) use (
        $contract,
        $endpoint,
        $action,
        $now,
        $replayProtection,
        $nonce,
        $transactionId
    ): void {
        if ($replayProtection) {
            fvplus_security_consume_nonce($state, $nonce, $endpoint, $action, $now);
            fvplus_security_consume_transaction($state, $transactionId, $endpoint, $action, $now);
        }
        fvplus_security_enforce_rate_limit($state, $contract, $now);
    });

    fvplus_append_security_audit_event('mutation_authorized', 'ok', [
        'endpoint' => $endpoint,
        'action' => $action,
        'auditCategory' => (string)($contract['auditCategory'] ?? 'mutation'),
        'replayProtected' => $replayProtection
    ]);
    return $contract;
}

function fvplus_require_nonce_bootstrap_guard(): void
{
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
        throw new FVPlusSecurityRequestException('Unsupported method.', 405);
    }
    if (!hasExplicitMutationRequestHeader() || !validateOptionalRequestToken() || !isTrustedMutationContext()) {
        throw new FVPlusSecurityRequestException('Blocked by request guard.', 403);
    }
    $contract = fvplus_security_current_contract();
    $now = time();
    fvplus_security_with_state_lock(static function (array &$state) use ($contract, $now): void {
        fvplus_security_enforce_rate_limit($state, $contract, $now);
    });
}

function fvplus_security_audit_path(): string
{
    global $configDir;
    return "$configDir/security.audit.json";
}

function fvplus_security_canonicalize($value)
{
    if (!is_array($value)) {
        return $value;
    }
    if (array_is_list($value)) {
        return array_map('fvplus_security_canonicalize', $value);
    }
    ksort($value, SORT_STRING);
    foreach ($value as $key => $item) {
        $value[$key] = fvplus_security_canonicalize($item);
    }
    return $value;
}

function fvplus_security_event_hash(array $event, string $secret): string
{
    unset($event['eventHash']);
    $encoded = json_encode(fvplus_security_canonicalize($event), JSON_UNESCAPED_SLASHES);
    $payload = is_string($encoded) ? $encoded : '{}';
    return $secret !== '' ? hash_hmac('sha256', $payload, $secret) : hash('sha256', $payload);
}

function fvplus_append_security_audit_event(string $eventName, string $status, array $context = []): array
{
    $path = fvplus_security_audit_path();
    $events = readJsonObjectFile($path);
    if (!is_array($events)) {
        $events = recoverJsonObjectFromLastGood($path);
    }
    $events = is_array($events) ? array_values($events) : [];
    $previousHash = '';
    if (count($events) > 0) {
        $previousHash = (string)($events[count($events) - 1]['eventHash'] ?? '');
    }
    $event = [
        'schemaVersion' => 1,
        'id' => generateId(16),
        'timestamp' => gmdate('c'),
        'event' => substr(trim($eventName), 0, 80),
        'status' => substr(trim($status), 0, 24),
        'endpoint' => fvplus_security_normalize_endpoint((string)($context['endpoint'] ?? '')),
        'action' => fvplus_security_normalize_action((string)($context['action'] ?? '')),
        'auditCategory' => substr(trim((string)($context['auditCategory'] ?? 'security')), 0, 120),
        'replayProtected' => (bool)($context['replayProtected'] ?? false),
        'traceId' => getRequestTraceId(),
        'transactionId' => getRequestTransactionId(),
        'previousHash' => $previousHash
    ];
    $event['eventHash'] = fvplus_security_event_hash($event, getConfiguredRequestToken());
    $events[] = $event;
    if (count($events) > FVPLUS_SECURITY_AUDIT_HISTORY_MAX) {
        $events = array_slice($events, -FVPLUS_SECURITY_AUDIT_HISTORY_MAX);
        if (count($events) > 0) {
            $events[0]['previousHash'] = '';
            $events[0]['eventHash'] = fvplus_security_event_hash($events[0], getConfiguredRequestToken());
            for ($index = 1; $index < count($events); $index++) {
                $events[$index]['previousHash'] = (string)$events[$index - 1]['eventHash'];
                $events[$index]['eventHash'] = fvplus_security_event_hash($events[$index], getConfiguredRequestToken());
            }
        }
    }
    writeJsonObjectWithLastGood($path, $events);
    return $event;
}

function fvplus_get_security_audit_snapshot(): array
{
    $events = readJsonObjectFile(fvplus_security_audit_path());
    if (!is_array($events)) {
        $events = recoverJsonObjectFromLastGood(fvplus_security_audit_path());
    }
    if (!is_array($events)) {
        return [
            'status' => 'unavailable',
            'retained' => 0,
            'chainValid' => null,
            'checkedAt' => gmdate('c')
        ];
    }
    $secret = getConfiguredRequestToken();
    $previousHash = '';
    $valid = true;
    $brokenIndex = null;
    foreach (array_values($events) as $index => $event) {
        if (!is_array($event)
            || !hash_equals($previousHash, (string)($event['previousHash'] ?? ''))
            || !hash_equals((string)($event['eventHash'] ?? ''), fvplus_security_event_hash($event, $secret))) {
            $valid = false;
            $brokenIndex = $index;
            break;
        }
        $previousHash = (string)$event['eventHash'];
    }
    return [
        'status' => $valid ? 'healthy' : 'critical',
        'retained' => count($events),
        'chainValid' => $valid,
        'brokenIndex' => $brokenIndex,
        'checkedAt' => gmdate('c')
    ];
}

function fvplus_runtime_integrity_should_track(string $relativePath): bool
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    if ($relativePath === '' || $relativePath === 'runtime-integrity.json') {
        return false;
    }
    if (preg_match('/^[^\/]+\.(?:page|php|json)$/i', $relativePath)) {
        return true;
    }
    if (!preg_match('#^(?:server|scripts|styles)/#', $relativePath)) {
        return false;
    }
    return (bool)preg_match('/\.(?:php|js|sh|css|json)$/i', $relativePath);
}

function fvplus_get_runtime_integrity_snapshot(string $privacyMode = 'sanitized'): array
{
    global $sourceDir;
    $manifestPath = rtrim($sourceDir, '/\\') . '/runtime-integrity.json';
    $runtimeRoot = realpath($sourceDir);
    $runtimeRoot = is_string($runtimeRoot) ? rtrim(str_replace('\\', '/', $runtimeRoot), '/') : '';
    $checkedAt = gmdate('c');
    if ($runtimeRoot === '' || !is_file($manifestPath)) {
        return [
            'status' => 'unavailable',
            'checkedAt' => $checkedAt,
            'reason' => 'Runtime integrity manifest is unavailable.',
            'expectedCount' => 0,
            'checkedCount' => 0,
            'missingCount' => 0,
            'modifiedCount' => 0,
            'unexpectedCount' => 0,
            'modeChangedCount' => 0
        ];
    }
    $manifest = @json_decode((string)@file_get_contents($manifestPath), true);
    $entries = is_array($manifest['files'] ?? null) ? array_values($manifest['files']) : [];
    if (!is_array($manifest) || (int)($manifest['schemaVersion'] ?? 0) !== 1 || count($entries) > 1000) {
        return [
            'status' => 'critical',
            'checkedAt' => $checkedAt,
            'reason' => 'Runtime integrity manifest is invalid.',
            'expectedCount' => count($entries),
            'checkedCount' => 0,
            'missingCount' => 0,
            'modifiedCount' => 0,
            'unexpectedCount' => 0,
            'modeChangedCount' => 0
        ];
    }

    $expected = [];
    $findings = [];
    $missingCount = 0;
    $modifiedCount = 0;
    $modeChangedCount = 0;
    $checkedCount = 0;
    foreach ($entries as $entry) {
        if (!is_array($entry)) {
            $modifiedCount++;
            continue;
        }
        $relative = ltrim(str_replace('\\', '/', (string)($entry['path'] ?? '')), '/');
        if (!fvplus_runtime_integrity_should_track($relative) || str_contains($relative, '../')) {
            $modifiedCount++;
            continue;
        }
        $expected[$relative] = true;
        $absolute = rtrim($sourceDir, '/\\') . '/' . $relative;
        $resolvedAbsolute = realpath($absolute);
        $resolvedAbsolute = is_string($resolvedAbsolute) ? str_replace('\\', '/', $resolvedAbsolute) : '';
        if (!is_file($absolute)
            || is_link($absolute)
            || $resolvedAbsolute === ''
            || !str_starts_with($resolvedAbsolute, $runtimeRoot . '/')) {
            $missingCount++;
            $findings[] = ['kind' => 'missing', 'path' => $relative];
            continue;
        }
        $checkedCount++;
        $actualHash = @hash_file('sha256', $absolute);
        if (!is_string($actualHash) || !hash_equals((string)($entry['sha256'] ?? ''), $actualHash)) {
            $modifiedCount++;
            $findings[] = ['kind' => 'modified', 'path' => $relative];
        }
        $expectedMode = (string)($entry['mode'] ?? '0755');
        $actualMode = sprintf('%04o', ((int)@fileperms($absolute)) & 0777);
        if ($expectedMode !== '' && $expectedMode !== $actualMode) {
            $modeChangedCount++;
            $findings[] = ['kind' => 'mode', 'path' => $relative];
        }
    }

    $unexpectedCount = 0;
    $scanRoots = [
        rtrim($sourceDir, '/\\') . '/server',
        rtrim($sourceDir, '/\\') . '/scripts',
        rtrim($sourceDir, '/\\') . '/styles'
    ];
    $candidates = [];
    foreach ($scanRoots as $scanRoot) {
        if (!is_dir($scanRoot)) {
            continue;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($scanRoot, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }
            $candidates[] = str_replace('\\', '/', substr($fileInfo->getPathname(), strlen(rtrim($sourceDir, '/\\')) + 1));
        }
    }
    foreach (glob(rtrim($sourceDir, '/\\') . '/*') ?: [] as $rootEntry) {
        if (is_file($rootEntry)) {
            $candidates[] = basename($rootEntry);
        }
    }
    foreach (array_values(array_unique($candidates)) as $relative) {
        if (fvplus_runtime_integrity_should_track($relative) && !isset($expected[$relative])) {
            $unexpectedCount++;
            $findings[] = ['kind' => 'unexpected', 'path' => $relative];
        }
    }

    $problemCount = $missingCount + $modifiedCount + $unexpectedCount + $modeChangedCount;
    $safeFindings = [];
    foreach (array_slice($findings, 0, 25) as $finding) {
        $path = (string)($finding['path'] ?? '');
        $safeFindings[] = [
            'kind' => (string)($finding['kind'] ?? 'unknown'),
            'path' => strtolower(trim($privacyMode)) === 'full'
                ? $path
                : 'file-' . substr(hash('sha256', $path), 0, 12)
        ];
    }
    return [
        'status' => $problemCount > 0 ? 'critical' : 'healthy',
        'checkedAt' => $checkedAt,
        'reason' => $problemCount > 0
            ? sprintf('%d installed runtime integrity finding(s) detected.', $problemCount)
            : 'Installed runtime files match the packaged integrity manifest.',
        'algorithm' => 'sha256',
        'expectedCount' => count($entries),
        'checkedCount' => $checkedCount,
        'missingCount' => $missingCount,
        'modifiedCount' => $modifiedCount,
        'unexpectedCount' => $unexpectedCount,
        'modeChangedCount' => $modeChangedCount,
        'findings' => $safeFindings
    ];
}
