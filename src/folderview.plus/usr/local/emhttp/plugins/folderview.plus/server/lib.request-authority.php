<?php
function normalizeHostForCompare(string $host): string {
    $host = strtolower(trim($host));
    if ($host === '') {
        return '';
    }
    if ($host[0] === '[' && substr($host, -1) === ']') {
        return substr($host, 1, -1);
    }
    return $host;
}

function parseRequestUrlAuthority(string $url): array {
    $url = trim($url);
    if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x1F\x7F]/', $url)) {
        return [];
    }
    $parts = @parse_url($url);
    if (!is_array($parts)) {
        return [];
    }
    $scheme = strtolower(trim((string)($parts['scheme'] ?? '')));
    if (!in_array($scheme, ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass'])) {
        return [];
    }
    $host = normalizeHostForCompare((string)($parts['host'] ?? ''));
    if ($host === '') {
        return [];
    }
    $explicitPort = isset($parts['port']);
    $port = $explicitPort ? (int)$parts['port'] : ($scheme === 'https' ? 443 : 80);
    if ($port < 1 || $port > 65535) {
        return [];
    }
    return [
        'scheme' => $scheme,
        'host' => $host,
        'port' => $port,
        'explicitPort' => $explicitPort
    ];
}

function parseHostPortFromUrl(string $url): array {
    $authority = parseRequestUrlAuthority($url);
    return empty($authority) ? ['', null] : [(string)$authority['host'], (int)$authority['port']];
}

function parseRequestHostAuthority(string $hostHeader, string $scheme): array {
    $hostHeader = trim($hostHeader);
    $scheme = strtolower(trim($scheme));
    if (
        $hostHeader === ''
        || strlen($hostHeader) > 512
        || !in_array($scheme, ['http', 'https'], true)
        || preg_match('~[\x00-\x20\x7F,@/\\\\?#]~', $hostHeader)
    ) {
        return [];
    }
    return parseRequestUrlAuthority($scheme . '://' . $hostHeader);
}

function parseCurrentRequestAuthority(): array {
    $hostHeader = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    $isHttps = !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
    return parseRequestHostAuthority($hostHeader, $isHttps ? 'https' : 'http');
}

function parseCurrentRequestHostPort(): array {
    $authority = parseCurrentRequestAuthority();
    return empty($authority) ? ['', null] : [(string)$authority['host'], (int)$authority['port']];
}

function resolveForwardedRequestAuthority(): array {
    $forwardedHost = getRequestHeaderValue('X-Forwarded-Host');
    $forwardedProto = getRequestHeaderValue('X-Forwarded-Proto');
    $forwardedPort = getRequestHeaderValue('X-Forwarded-Port');
    $providedCount = ($forwardedHost !== '' ? 1 : 0)
        + ($forwardedProto !== '' ? 1 : 0)
        + ($forwardedPort !== '' ? 1 : 0);
    if ($providedCount === 0) {
        return ['status' => 'absent'];
    }
    if ($providedCount !== 3) {
        return ['status' => 'partial'];
    }
    foreach ([$forwardedHost, $forwardedProto, $forwardedPort] as $value) {
        if (strlen($value) > 512 || strpos($value, ',') !== false || preg_match('/[\x00-\x1F\x7F]/', $value)) {
            return ['status' => 'invalid'];
        }
    }
    $forwardedProto = strtolower($forwardedProto);
    if (!in_array($forwardedProto, ['http', 'https'], true)) {
        return ['status' => 'invalid-proto'];
    }
    if (!preg_match('/^[0-9]{1,5}$/', $forwardedPort)) {
        return ['status' => 'invalid-port'];
    }
    $port = (int)$forwardedPort;
    if ($port < 1 || $port > 65535) {
        return ['status' => 'invalid-port'];
    }
    [$directHost] = parseCurrentRequestHostPort();
    $forwardedAuthority = parseRequestHostAuthority($forwardedHost, $forwardedProto);
    if ($directHost === '' || empty($forwardedAuthority)) {
        return ['status' => 'invalid-host'];
    }
    if ((string)$forwardedAuthority['host'] !== $directHost) {
        return ['status' => 'host-mismatch'];
    }
    if (!empty($forwardedAuthority['explicitPort']) && (int)$forwardedAuthority['port'] !== $port) {
        return ['status' => 'port-mismatch'];
    }
    $forwardedAuthority['port'] = $port;
    $forwardedAuthority['status'] = 'valid';
    return $forwardedAuthority;
}

function evaluateSameOriginHeaderValue(string $urlValue): array {
    if ($urlValue === '' || strtolower($urlValue) === 'null') {
        return ['trusted' => false, 'status' => 'invalid'];
    }
    [$headerHost, $headerPort] = parseHostPortFromUrl($urlValue);
    $headerAuthority = parseRequestUrlAuthority($urlValue);
    if ($headerHost === '' || $headerPort === null || empty($headerAuthority)) {
        return ['trusted' => false, 'status' => 'invalid'];
    }
    $directAuthority = parseCurrentRequestAuthority();
    if (
        !empty($directAuthority)
        && (string)$headerAuthority['scheme'] === (string)$directAuthority['scheme']
        && $headerHost === (string)$directAuthority['host']
        && $headerPort === (int)$directAuthority['port']
    ) {
        return ['trusted' => true, 'status' => 'direct'];
    }
    $forwardedAuthority = resolveForwardedRequestAuthority();
    if (
        ($forwardedAuthority['status'] ?? '') === 'valid'
        && (string)$headerAuthority['scheme'] === (string)$forwardedAuthority['scheme']
        && $headerHost === (string)$forwardedAuthority['host']
        && $headerPort === (int)$forwardedAuthority['port']
    ) {
        return ['trusted' => true, 'status' => 'forwarded'];
    }
    return ['trusted' => false, 'status' => 'mismatch'];
}

function isSameOriginHeaderValue(string $urlValue): bool {
    return !empty(evaluateSameOriginHeaderValue($urlValue)['trusted']);
}

function getMutationRequestSecurityDiagnostics(): array {
    $origin = getRequestHeaderValue('Origin');
    $referer = getRequestHeaderValue('Referer');
    $originResult = $origin === ''
        ? ['trusted' => true, 'status' => 'not-provided']
        : evaluateSameOriginHeaderValue($origin);
    $refererResult = $referer === ''
        ? ['trusted' => true, 'status' => 'not-provided']
        : evaluateSameOriginHeaderValue($referer);
    $sources = [];
    foreach ([$originResult, $refererResult] as $result) {
        if (in_array(($result['status'] ?? ''), ['direct', 'forwarded'], true)) {
            $sources[] = (string)$result['status'];
        }
    }
    $sources = array_values(array_unique($sources));
    $authoritySource = empty($sources) ? 'not-required' : (count($sources) === 1 ? $sources[0] : 'mixed');
    return [
        'schemaVersion' => 1,
        'enforcementMode' => getRequestTokenEnforcementMode(),
        'trustedContext' => !empty($originResult['trusted']) && !empty($refererResult['trusted']),
        'authoritySource' => $authoritySource,
        'forwardedAuthorityStatus' => (string)(resolveForwardedRequestAuthority()['status'] ?? 'invalid'),
        'originStatus' => (string)($originResult['status'] ?? 'invalid'),
        'refererStatus' => (string)($refererResult['status'] ?? 'invalid')
    ];
}

function isTrustedMutationContext(): bool {
    // Missing browser origin headers remain allowed for compatibility; supplied
    // values must match either the direct or one coherent forwarded authority.
    $origin = getRequestHeaderValue('Origin');
    if ($origin !== '' && !isSameOriginHeaderValue($origin)) {
        return false;
    }
    $referer = getRequestHeaderValue('Referer');
    return $referer === '' || isSameOriginHeaderValue($referer);
}
