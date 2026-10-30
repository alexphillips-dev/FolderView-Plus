<?php
function fvplusAllowedCustomIconExtensions(): array {
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
}

function fvplusNormalizeCustomIconReferencePath(string $value): string {
    $path = trim($value);
    if ($path === '') return '';
    $path = explode('#', $path, 2)[0];
    $path = explode('?', $path, 2)[0];
    $decoded = rawurldecode($path);
    if ($decoded !== '') $path = $decoded;
    $trimmed = preg_replace('#^https?://[^/]+#i', '', $path);
    if (is_string($trimmed) && $trimmed !== '') $path = $trimmed;
    return str_replace('\\', '/', trim($path));
}

function fvplusCustomIconNameFromReference(string $value): string {
    $path = fvplusNormalizeCustomIconReferencePath($value);
    foreach (['/plugins/folderview.plus/images/custom/', '/usr/local/emhttp/plugins/folderview.plus/images/custom/',
        'plugins/folderview.plus/images/custom/', 'usr/local/emhttp/plugins/folderview.plus/images/custom/'] as $prefix) {
        if (strpos($path, $prefix) !== 0) continue;
        $name = basename(substr($path, strlen($prefix)));
        return $name !== '' && $name === trim($name)
            && in_array(strtolower((string)pathinfo($name, PATHINFO_EXTENSION)), fvplusAllowedCustomIconExtensions(), true)
            ? $name : '';
    }
    return '';
}

function fvplusVisitCustomIconReferences(string $type, array &$folders, array &$prefs, callable $visitor): void {
    $visit = static function (array &$record, array $reference) use ($type, $visitor): void {
        if (!is_string($record['icon'] ?? null)) return;
        $name = fvplusCustomIconNameFromReference($record['icon']);
        if ($name !== '') $visitor($name, array_merge(['type' => $type], $reference), $record);
    };
    foreach ($folders as $id => &$folder) {
        if (is_array($folder)) $visit($folder, ['scope' => 'folder', 'folderId' => (string)$id,
            'folderName' => trim((string)($folder['name'] ?? $id))]);
    }
    unset($folder);
    if (is_array($prefs['folderDefaults']['profile'] ?? null)) {
        $visit($prefs['folderDefaults']['profile'], ['scope' => 'defaults', 'folderId' => '', 'folderName' => '']);
    }
    if (!is_array($prefs['folderGroups'] ?? null)) return;
    foreach ($prefs['folderGroups'] as &$group) {
        if (!is_array($group) || !is_array($group['folders'] ?? null)) continue;
        foreach ($group['folders'] as &$folder) {
            if (is_array($folder)) $visit($folder, ['scope' => 'group', 'folderId' => '',
                'folderName' => trim((string)($folder['name'] ?? ''))]);
        }
        unset($folder);
    }
    unset($group);
}

function fvplusCustomIconReferenceInputs(string $type, bool $strict): array {
    $paths = ['folders' => getFolderFilePath($type), 'prefs' => getTypePrefsPath($type)];
    $values = [];
    foreach ($paths as $kind => $path) {
        $present = file_exists($path) || is_link($path);
        $mirror = getLastGoodJsonPath($path);
        $value = !is_link($path) && is_file($path) && is_readable($path) ? readJsonObjectFile($path) : null;
        if ($strict && (($present && !is_array($value))
            || (!$present && (file_exists($mirror) || is_link($mirror))))) {
            throw new RuntimeException('Icon references could not be verified. Reload Settings and try again.');
        }
        if (!$strict && !is_array($value) && !is_link($mirror)) $value = readJsonObjectFile($mirror);
        $values[$kind] = $value ?? [];
    }
    // Match the existing legacy-adoption policy without writing/normalizing saved aliases.
    if (!$values['folders'] && !hasLegacyMigrationMarker($type, 'folders')) {
        foreach (getLegacyConfigDirCandidates() as $directory) {
            if (basename($directory) === 'folder.view3') continue;
            $legacy = readJsonObjectFile($directory . '/' . $type . '.json');
            if (is_array($legacy) && normalizeFolderMapPayload($legacy)) { $values['folders'] = $legacy; break; }
        }
    }
    $sources = [$values['prefs']];
    if (!hasLegacyMigrationMarker($type, 'prefs') && normalizeTypePrefs($values['prefs']) === defaultTypePrefs()) {
        foreach (getLegacyConfigDirCandidates() as $directory) {
            $legacy = readJsonObjectFile($directory . '/' . $type . '.prefs.json');
            if (is_array($legacy) && normalizeTypePrefs($legacy) !== defaultTypePrefs()) { $sources[] = $legacy; break; }
        }
    }
    return ['folders' => $values['folders'], 'prefsSources' => $sources];
}

function fvplusCustomIconUsageMap(bool $strict = false): array {
    return withConfigMutationLock(static function () use ($strict): array {
        $usage = [];
        foreach (['docker', 'vm'] as $type) {
            $inputs = fvplusCustomIconReferenceInputs($type, $strict);
            foreach ($inputs['prefsSources'] as $index => $prefs) {
                $folders = $index === 0 ? $inputs['folders'] : [];
                fvplusVisitCustomIconReferences($type, $folders, $prefs,
                    static function (string $name, array $reference, array &$record) use (&$usage): void {
                        $usage[$name][] = $reference;
                    });
            }
        }
        foreach ($usage as &$references) {
            usort($references, static function (array $left, array $right): int {
                return strcmp($left['type'], $right['type']) ?: strcasecmp($left['folderName'], $right['folderName']);
            });
        }
        unset($references);
        return $usage;
    });
}
