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

function fvplusDockerNamespaceRebuildStates(array $containers, DockerClient $client, bool $complete = false): array {
    $needsVerification = [];
    $states = [];
    $references = static function (array $rows): array {
        $names = [];
        $ids = [];
        foreach ($rows as $row) {
            $id = $row['Id'] ?? '';
            if (is_string($id) && preg_match('/^[a-f0-9]{64}$/D', $id)) $ids[$id] = $row['HostConfig']['NetworkMode'] ?? '';
            foreach ((array)($row['Names'] ?? []) as $name) {
                if (is_string($name)) $names[ltrim($name, '/')] = true;
            }
        }
        return [$names, $ids];
    };
    $exists = static function (string $target, array $names, array $ids): bool {
        if (isset($names[$target]) || array_key_exists($target, $ids)) return true;
        if (!preg_match('/^[a-f0-9]{12,63}$/D', $target)) return false;
        foreach ($ids as $id => $_mode) {
            if (str_starts_with((string)$id, $target)) return true;
        }
        return false;
    };
    [$names, $ids] = $references($containers);
    foreach ($ids as $id => $mode) {
        if (!is_string($mode) || $mode === '') continue;
        if (!str_starts_with($mode, 'container:')) { $states[$id] = false; continue; }
        $target = ltrim(substr($mode, 10), '/');
        if ($target === '???') { $states[$id] = true; continue; }
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/D', $target)) continue;
        if ($exists($target, $names, $ids)) { $states[$id] = false; continue; }
        $needsVerification[$id] = [$mode, $target];
    }
    if (!$needsVerification) return $states;
    if (!$complete) {
        // The normal Unraid reader can return partial data. Query the full list only for unresolved namespace owners.
        try {
            [$names, $ids] = $references(fvplusReadRuntimeEntityList('docker', $client, true) ?? []);
        } catch (RuntimeException $_error) {
            return $states;
        }
    }
    foreach ($needsVerification as $id => [$mode, $target]) {
        if (($ids[$id] ?? null) === $mode) $states[$id] = !$exists($target, $names, $ids);
    }
    return $states;
}

function fvplusDockerListUsesImageId(array $container): bool {
    $image = $container['Image'] ?? '';
    return is_string($image) && preg_match('/^sha256:[a-f0-9]{64}$/D', $image)
        && $image === ($container['ImageID'] ?? null);
}

function fvplusDockerRuntimeUpdated(array $container, string $name, string $configuredImage, array $cache, ?DockerUpdate $update, bool $preferLive = false): ?bool {
    if (fvplusDockerListUsesImageId($container)) {
        if ($configuredImage === '') return null;
        $tagged = !str_contains($configuredImage, '@')
            && !preg_match('/^(?:sha256:)?[a-f0-9]{12,64}$/iD', $configuredImage);
        if ($tagged) {
            // The raw ImageID is also emitted if the original tag no longer resolves.
            // Only a confirmed per-image update can distinguish that from a moved tag.
            $live = normalizeDockerUpdatedStateValue(($update ?? new DockerUpdate())->getUpdateStatus($configuredImage));
            return $live === false ? false : null;
        }
    }
    return resolveDockerUpdatedStateValue($name, $configuredImage, $cache, $update, $preferLive);
}
