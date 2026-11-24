<?php

function fvplusDockerPreviewEnvMap($environment): array {
    $entries = [];
    foreach (is_array($environment) ? $environment : [] as $entry) {
        if (!is_string($entry)) continue;
        $parts = explode('=', $entry, 2);
        $name = $parts[0];
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,127}$/D', $name)) continue;
        $entries[$name] = array_key_exists($name, $entries) ? null : ($parts[1] ?? null);
    }
    ksort($entries, SORT_STRING);
    return $entries;
}

function fvplusDockerPreviewIdentifyComposeLabel($value): ?string {
    return is_string($value) && preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/D', $value) ? $value : null;
}

function fvplusBuildDockerPreviewSummary(array $container, ?array $image): array {
    $labels = is_array($container['Config']['Labels'] ?? null) ? $container['Config']['Labels'] : [];
    $environment = fvplusDockerPreviewEnvMap($container['Config']['Env'] ?? []);
    $imageConfig = $image['Config'] ?? null;
    $imageEnv = $imageConfig['Env'] ?? null;
    $hasDefaults = is_array($imageConfig) && array_key_exists('Env', $imageConfig)
        && ($imageEnv === null || is_array($imageEnv));
    $defaults = fvplusDockerPreviewEnvMap($imageEnv);
    $names = [];
    foreach (array_slice($environment, 0, 256, true) as $name => $value) {
        $overridden = null;
        if ($hasDefaults && $value !== null) {
            if (!array_key_exists($name, $defaults)) $overridden = false;
            elseif ($defaults[$name] !== null) $overridden = $defaults[$name] !== $value;
        }
        $names[] = ['name' => $name, 'overridden' => $overridden];
    }

    $restartPolicy = $container['HostConfig']['RestartPolicy']['Name'] ?? null;
    $networkMode = $container['HostConfig']['NetworkMode'] ?? null;
    if (is_string($networkMode) && $networkMode !== '') {
        if (str_starts_with($networkMode, 'container:')) {
            $networkMode = 'container';
        } elseif (!in_array($networkMode, ['bridge', 'host', 'none', 'default', 'nat'], true)) {
            $networkMode = 'custom';
        }
    } else {
        $networkMode = null;
    }

    return [
        'composeProject' => fvplusDockerPreviewIdentifyComposeLabel($labels['com.docker.compose.project'] ?? null),
        'composeService' => fvplusDockerPreviewIdentifyComposeLabel($labels['com.docker.compose.service'] ?? null),
        'restartPolicy' => in_array($restartPolicy, ['no', 'always', 'unless-stopped', 'on-failure'], true) ? $restartPolicy : null,
        'networkMode' => $networkMode,
        'environment' => $names
    ];
}

function fvplusReadDockerPreviewSummary(DockerClient $client, string $containerId): ?array {
    $container = @$client->getContainerDetails($containerId);
    if (!is_array($container) || ($container['Id'] ?? null) !== $containerId) return null;

    $image = null;
    $imageId = $container['Image'] ?? null;
    if (is_string($imageId) && preg_match('/^sha256:[a-f0-9]{64}$/D', $imageId)) {
        try {
            $details = @$client->getDockerJSON("/images/$imageId/json");
            if (is_array($details) && ($details['Id'] ?? null) === $imageId) $image = $details;
        } catch (Throwable $error) {
            // Container details remain available when Docker cannot inspect the image.
        }
    }
    return fvplusBuildDockerPreviewSummary($container, $image);
}
