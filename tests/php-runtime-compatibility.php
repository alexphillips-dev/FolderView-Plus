<?php
declare(strict_types=1);

function getRequestHeaderValue(string $name): string {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string)($_SERVER[$key] ?? ''));
}

function getRequestTokenEnforcementMode(): string {
    return 'strict';
}

require dirname(__DIR__) . '/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.request-authority.php';

function fvplusAssert(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "PHP runtime compatibility assertion failed: {$message}\n");
        exit(1);
    }
}

$https = parseRequestUrlAuthority('https://example.test/path');
fvplusAssert(($https['host'] ?? '') === 'example.test', 'HTTPS host normalization');
fvplusAssert(($https['port'] ?? 0) === 443, 'HTTPS default port');

$ipv6 = parseRequestUrlAuthority('http://[2001:db8::1]:8080/path');
fvplusAssert(($ipv6['host'] ?? '') === '2001:db8::1', 'IPv6 normalization');
fvplusAssert(($ipv6['port'] ?? 0) === 8080, 'IPv6 explicit port');

$_SERVER['HTTP_HOST'] = 'proxy.example.test';
$_SERVER['HTTPS'] = 'on';
$_SERVER['HTTP_X_FORWARDED_HOST'] = 'proxy.example.test';
$_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
$_SERVER['HTTP_X_FORWARDED_PORT'] = '443';
$forwarded = resolveForwardedRequestAuthority();
fvplusAssert(($forwarded['status'] ?? '') === 'valid', 'forwarded authority validation');
fvplusAssert(isSameOriginHeaderValue('https://proxy.example.test/settings'), 'forwarded same-origin validation');

echo "PHP request-authority compatibility contract passed.\n";
