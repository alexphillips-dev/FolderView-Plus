<?php
function fvplusJsonKeyedMap(array $map): array|object {
    // Contiguous numeric identifiers are PHP array indexes, but are keys on the wire.
    return $map !== [] && array_is_list($map) ? (object)$map : $map;
}
function fvplusJsonTypeConfig(array $payload): array {
    unset($payload['metadata']['prefsStartupConflictCount']);
    if (is_array($payload['folders'] ?? null)) $payload['folders'] = fvplusJsonKeyedMap($payload['folders']);
    if (is_array($payload['prefs']['expandedFolderState'] ?? null)) {
        $payload['prefs']['expandedFolderState'] = fvplusJsonKeyedMap($payload['prefs']['expandedFolderState']);
    }
    if (is_array($payload['prefs']['dockerStartOrder']['containerWaits'] ?? null)) {
        $payload['prefs']['dockerStartOrder']['containerWaits'] = fvplusJsonKeyedMap($payload['prefs']['dockerStartOrder']['containerWaits']);
    }
    return $payload;
}
