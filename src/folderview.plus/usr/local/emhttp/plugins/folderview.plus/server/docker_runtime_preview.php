<?php
define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
define('FVPLUS_READ_ONLY_REQUEST', true);
require_once(PHP_SAPI === 'cli' ? __DIR__ . '/lib.php' : '/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
require_once __DIR__ . '/lib.docker-preview-summary.php';

function fvplusDockerPreviewPrivacyAllowsRead(): bool {
    $prefsPath = getTypePrefsPath('docker');
    clearstatcache(true, $prefsPath);
    $prefs = readJsonObjectFile($prefsPath);
    if ($prefs === null) {
        $lastGood = getLastGoodJsonPath($prefsPath);
        $prefs = readJsonObjectFile($lastGood);
        if ($prefs === null && (file_exists($prefsPath) || file_exists($lastGood))) return false;
    }
    return !normalizeTypePrefs($prefs ?? [])['dashboard']['privacyMode'];
}

fvplus_json_try(static function () use ($documentRoot): ?array {
    $surface = getRequestHeaderValue('X-FV-Surface');
    $token = trim((string)@file_get_contents(getOptionalRequestTokenPath(), false, null, 0, 130));
    if (!in_array($surface, ['docker', 'dashboard'], true)
        || getRequestHeaderValue('X-FV-Request') !== '1'
        || !isTrustedMutationContext()
        || !preg_match('/^[A-Za-z0-9._~-]{16,128}$/D', $token)
        || !hash_equals($token, getRequestHeaderValue('X-FV-Token'))) {
        fvplus_json_error('Request is not allowed.', 403);
        return null;
    }

    if (!fvplusDockerPreviewPrivacyAllowsRead()) {
        fvplus_json_error('Runtime details unavailable.', 403);
        return null;
    }

    $containerId = getRequestHeaderValue('X-FV-Container');
    if (!preg_match('/^[a-f0-9]{64}$/D', $containerId)) {
        fvplus_json_error('Request is not allowed.', 400);
        return null;
    }
    ob_start();
    try {
        if (!class_exists('DockerClient')) {
            fvplus_safe_require_once('docker', "$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
        }
        $summary = class_exists('DockerClient') ? fvplusReadDockerPreviewSummary(new DockerClient(), $containerId) : null;
    } catch (Throwable $error) {
        $summary = null;
    } finally {
        ob_end_clean();
    }
    if ($summary === null) {
        fvplus_json_error('Runtime details unavailable.', 404);
        return null;
    }
    if (!fvplusDockerPreviewPrivacyAllowsRead()) {
        fvplus_json_error('Runtime details unavailable.', 403);
        return null;
    }
    return ['summary' => $summary];
});
