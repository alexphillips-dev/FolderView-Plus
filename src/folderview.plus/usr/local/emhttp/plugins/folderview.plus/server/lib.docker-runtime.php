<?php

function getDockerTemplateIndexCached(DockerTemplates $dockerTemplates): array {
    try {
        $templateFiles = $dockerTemplates->getTemplates('all');
    } catch (Throwable $error) {
        fv3_debug_log("getDockerTemplateIndexCached: DockerTemplates->getTemplates('all') failed: " . $error->getMessage());
        return [];
    }
    if (!is_array($templateFiles) || empty($templateFiles)) {
        return [];
    }
    $signature = buildDockerTemplateSignature($templateFiles);
    $cached = readDockerTemplateCache($signature);
    if (is_array($cached)) {
        return $cached;
    }
    try {
        $templates = buildDockerTemplateIndex($templateFiles);
    } catch (Throwable $error) {
        fv3_debug_log("getDockerTemplateIndexCached: buildDockerTemplateIndex failed: " . $error->getMessage());
        return [];
    }
    writeDockerTemplateCache($signature, $templates);
    return $templates;
}

function resolveDockerLightweightWebuiMetadata(array $labels, string $manager): array {
    $rawWebUi = trim((string)($labels['net.unraid.docker.webui'] ?? ''));
    $rawTsWebUi = trim((string)($labels['net.unraid.docker.tailscale.webui'] ?? ''));
    $hasDeclaredWebui = $rawWebUi !== '' || $rawTsWebUi !== '';
    $capability = $hasDeclaredWebui
        ? true
        : ($manager === 'dockerman' ? null : false);
    $isDirectHint = static function (string $value): bool {
        if ($value === '') {
            return false;
        }
        return strpos($value, '[') === false
            && strpos($value, ']') === false
            && strpos($value, '{') === false
            && strpos($value, '}') === false;
    };

    return [
        'WebUi' => $isDirectHint($rawWebUi) ? $rawWebUi : '',
        'TSWebUi' => $isDirectHint($rawTsWebUi) ? $rawTsWebUi : '',
        'Shell' => trim((string)($labels['net.unraid.docker.shell'] ?? 'sh')) ?: 'sh',
        'webuiCapability' => $capability,
        'webuiHydrationPending' => $capability !== false
            && !$isDirectHint($rawWebUi)
            && !$isDirectHint($rawTsWebUi)
    ];
}
