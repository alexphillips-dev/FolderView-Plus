<?php
function fvplusRuntimeInventoryFailure(): void {
    throw new RuntimeException('Saved members could not be verified safely. Check the selected service, refresh the page, and retry the repair.');
}

function fvplusReadRuntimeEntityList(string $type, object $client, bool $requireComplete = false): ?array {
    if (!$requireComplete) {
        $items = $type === 'docker' ? $client->getDockerJSON('/containers/json?all=1') : $client->get_domains();
        return is_array($items) ? $items : null;
    }
    if ($type === 'docker') {
        // Unraid's client also returns [] on socket failure and merges individually decoded lines.
        // HTTP/1.0 avoids chunk framing; validate the complete body and response status ourselves.
        $status = null;
        $body = '';
        $client->getDockerJSON('/containers/json?all=1', 'GET', $status, static function ($line) use (&$body): void {
            $body .= $line;
        }, true);
        $items = json_decode($body, true);
        if ($status !== true || json_last_error() !== JSON_ERROR_NONE || substr(ltrim($body), 0, 1) !== '[') {
            fvplusRuntimeInventoryFailure();
        }
    } else {
        // The host wrapper turns a successful empty list into false. The native API preserves [].
        $connection = libvirt_connect('null', true);
        if (!$connection) fvplusRuntimeInventoryFailure();
        $items = libvirt_list_domains($connection);
    }
    if (!is_array($items) || !array_is_list($items)) fvplusRuntimeInventoryFailure();
    $names = [];
    $ids = [];
    foreach ($items as $item) {
        if ($type === 'docker') {
            $name = is_array($item) && is_string($item['Names'][0] ?? null) ? ltrim($item['Names'][0], '/') : '';
            $id = is_array($item) && is_string($item['Id'] ?? null) ? $item['Id'] : '';
            if (!preg_match('/^[a-f0-9]{64}$/D', $id) || isset($ids[$id])) fvplusRuntimeInventoryFailure();
            $ids[$id] = true;
        } else {
            $name = is_string($item) ? $item : '';
        }
        if ($name === '' || trim($name) !== $name || isset($names[$name])) fvplusRuntimeInventoryFailure();
        $names[$name] = true;
    }
    return $items;
}

function fvplusReadVmInfoState(bool $requireComplete = false): array {
    global $lv;
    $client = $requireComplete ? new Libvirt() : ($lv ?? null);
    if ($requireComplete || !isset($client)) {
        $client = $client ?? new Libvirt();
        if (!$requireComplete) $lv = $client;
        if (!$client->connect()) {
            if ($requireComplete) fvplusRuntimeInventoryFailure();
            return [];
        }
    }
    $vms = fvplusReadRuntimeEntityList('vm', $client, $requireComplete);
    if (!is_array($vms)) return [];
    $info = [];
    foreach ($vms as $vm) {
        $res = $client->get_domain_by_name($vm);
        if (!$res) {
            if ($requireComplete) fvplusRuntimeInventoryFailure();
            continue;
        }
        $dom = $client->domain_get_info($res);
        if (!is_array($dom) || ($requireComplete && !isset($dom['state']))) {
            if ($requireComplete) fvplusRuntimeInventoryFailure();
            continue;
        }
        $state = strtolower(trim((string)$client->domain_state_translate($dom['state'] ?? '')));
        if ($state === '') $state = 'stopped';
        $name = trim((string)$vm);
        if ($name === '') continue;
        $uuid = (string)$client->domain_get_uuid($res);
        if ($requireComplete && !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iD', $uuid)) {
            fvplusRuntimeInventoryFailure();
        }
        $info[$name] = ['name' => $name, 'uuid' => $uuid, 'state' => $state,
            'autostart' => (bool)$client->domain_get_autostart($res)];
    }
    ksort($info);
    return $info;
}

function fvplusAssertRepairMembersNotRenamed(string $type, array $folders, array $inventory): void {
    foreach ($folders as $folder) {
        foreach (normalizeFolderMembers($folder['containers'] ?? []) as $name) {
            if (isset($inventory[$name])) continue;
            $identity = $folder['memberIdentities'][$name] ?? [];
            $savedId = (string)($identity[$type === 'docker' ? 'containerId' : 'uuid'] ?? '');
            if ($savedId === '') continue;
            foreach ($inventory as $entity) {
                $currentId = (string)($entity[$type === 'docker' ? 'id' : 'uuid'] ?? '');
                if ($currentId !== '' && ($type === 'docker'
                    ? substr($savedId, 0, 12) === $currentId : strcasecmp($savedId, $currentId) === 0)) {
                    fvplusRuntimeInventoryFailure();
                }
            }
        }
    }
}
