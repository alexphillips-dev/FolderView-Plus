<?php

function fvplusSetupAssistantFence(string $name): string {
    $path = getGlobalRollbackSnapshotPath($name);
    $checkpointHash = configMetadataHashFromPath($path);
    if ($checkpointHash === '') throw new RuntimeException('Rollback snapshot file not found.');
    $state = [$name, $checkpointHash];
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $metadata = readConfigMetadata($type, true, false);
        $state[] = [$metadata['folderRevision'], $metadata['folderSha256'],
            $metadata['prefsRevision'], $metadata['prefsSha256']];
    }
    $workspace = fvplusTransactionCaptureFile(getThemeWorkspacePath());
    $state[] = [$workspace['exists'], hash('sha256', $workspace['content']), $workspace['mode']];
    return hash_hmac('sha256', json_encode($state, JSON_THROW_ON_ERROR), getConfiguredRequestToken());
}

function fvplusAssertSetupAssistantFence(string $name, $fence): void {
    if (!is_string($fence) || !preg_match('/^[a-f0-9]{64}$/D', $fence)
        || !hash_equals(fvplusSetupAssistantFence($name), $fence)) {
        throw new FVPlusConfigConflictException('The preview changed. Run the preview again before applying.');
    }
}

function fvplusCreateSetupAssistantCheckpoint(): array {
    return withConfigMutationLock(static function (): array {
        $checkpoint = createGlobalRollbackSnapshot('setup_assistant_apply');
        return $checkpoint + ['setupFence' => fvplusSetupAssistantFence($checkpoint['name'])];
    });
}

function fvplusRunSetupAssistantMutation($name, $fence, callable $mutate): array {
    return withConfigMutationLock(static function () use ($name, $fence, $mutate): array {
        if ($name === null && $fence === null) return $mutate();
        if (!is_string($name) || $name === '') throw new RuntimeException('Rollback snapshot file not found.');
        fvplusAssertSetupAssistantFence($name, $fence);
        // Apply the native order only after the wizard finishes accepting changes.
        $GLOBALS['fvplus_setup_docker_order_sync'] = false;
        try {
            $result = $mutate();
            return $result + ['setupFence' => fvplusSetupAssistantFence($name),
                'setupNeedsDockerSync' => $GLOBALS['fvplus_setup_docker_order_sync']];
        } finally {
            unset($GLOBALS['fvplus_setup_docker_order_sync']);
        }
    });
}
