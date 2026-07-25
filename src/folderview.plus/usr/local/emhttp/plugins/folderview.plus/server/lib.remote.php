<?php

function fvplusResolveRedirectUrl(string $baseUrl, string $location): string {
    $location = trim($location);
    if ($location === '') {
        return '';
    }
    if (preg_match('#^https://#i', $location)) {
        return $location;
    }
    $base = @parse_url($baseUrl);
    if (!is_array($base) || strtolower((string)($base['scheme'] ?? '')) !== 'https') {
        return '';
    }
    $host = strtolower((string)($base['host'] ?? ''));
    if ($host === '') {
        return '';
    }
    if (str_starts_with($location, '//')) {
        return 'https:' . $location;
    }
    if (str_starts_with($location, '/')) {
        return 'https://' . $host . $location;
    }
    $path = (string)($base['path'] ?? '/');
    $directory = preg_replace('#/[^/]*$#', '/', $path) ?: '/';
    return 'https://' . $host . $directory . $location;
}

function fvplusFetchRemoteTextBounded(
    string $url,
    array $allowedHosts,
    int $maxBytes,
    int $timeoutSeconds = 10,
    int $maxRedirects = 3
): array {
    $requestUrl = trim($url);
    $normalizedHosts = array_values(array_unique(array_filter(array_map(
        static fn($host): string => strtolower(trim((string)$host)),
        $allowedHosts
    ))));
    $limit = max(1, min(8 * 1024 * 1024, $maxBytes));
    $redirectsRemaining = max(0, min(5, $maxRedirects));

    while (true) {
        $parts = @parse_url($requestUrl);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        $host = strtolower((string)($parts['host'] ?? ''));
        $port = isset($parts['port']) ? (int)$parts['port'] : 443;
        if ($scheme !== 'https' || $port !== 443 || $host === '' || !in_array($host, $normalizedHosts, true)) {
            return ['ok' => false, 'error' => 'Remote URL is not an allowed HTTPS endpoint.', 'content' => '', 'status' => '', 'headers' => []];
        }

        $context = stream_context_create([
            'http' => [
                'timeout' => max(2, min(20, $timeoutSeconds)),
                'ignore_errors' => true,
                'follow_location' => 0,
                'max_redirects' => 0,
                'header' => "Cache-Control: no-cache\r\nPragma: no-cache\r\nUser-Agent: FolderViewPlus/1.0\r\nAccept: application/json, text/plain, text/css, */*\r\n"
            ]
        ]);
        $handle = @fopen($requestUrl, 'rb', false, $context);
        if (!is_resource($handle)) {
            return ['ok' => false, 'error' => 'Unable to fetch remote content.', 'content' => '', 'status' => '', 'headers' => []];
        }
        $metadata = stream_get_meta_data($handle);
        $headers = is_array($metadata['wrapper_data'] ?? null) ? $metadata['wrapper_data'] : [];
        $statusLine = (string)($headers[0] ?? '');
        $statusCode = preg_match('/\s(\d{3})(?:\s|$)/', $statusLine, $match) ? (int)$match[1] : 0;

        if ($statusCode >= 300 && $statusCode < 400) {
            fclose($handle);
            $location = '';
            foreach ($headers as $header) {
                if (stripos((string)$header, 'Location:') === 0) {
                    $location = trim(substr((string)$header, strlen('Location:')));
                    break;
                }
            }
            if ($redirectsRemaining <= 0 || $location === '') {
                return ['ok' => false, 'error' => 'Remote redirect limit was exceeded.', 'content' => '', 'status' => $statusLine, 'headers' => $headers];
            }
            $requestUrl = fvplusResolveRedirectUrl($requestUrl, $location);
            if ($requestUrl === '') {
                return ['ok' => false, 'error' => 'Remote redirect was invalid.', 'content' => '', 'status' => $statusLine, 'headers' => $headers];
            }
            $redirectsRemaining -= 1;
            continue;
        }

        $content = stream_get_contents($handle, $limit + 1);
        fclose($handle);
        if (!is_string($content)) {
            return ['ok' => false, 'error' => 'Unable to read remote content.', 'content' => '', 'status' => $statusLine, 'headers' => $headers];
        }
        if (strlen($content) > $limit) {
            return ['ok' => false, 'error' => 'Remote content exceeded the allowed size.', 'content' => '', 'status' => $statusLine, 'headers' => $headers];
        }
        if ($statusCode !== 0 && ($statusCode < 200 || $statusCode >= 300)) {
            return ['ok' => false, 'error' => 'Remote endpoint returned a non-success status.', 'content' => $content, 'status' => $statusLine, 'headers' => $headers];
        }
        return ['ok' => true, 'error' => '', 'content' => $content, 'status' => $statusLine, 'headers' => $headers];
    }
}
