<?php
function fvplusAllowedCustomIconExtensions(): array {
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
}
function fvplusNormalizeCustomIconReferencePath(string $value): string {
    $reference = trim(str_replace(["\t", "\r", "\n"], '', $value));
    $path = str_replace('\\', '/', preg_split('/[?#]/', $reference, 2)[0]);
    if (str_starts_with($path, '//')) return '';
    // Establish ownership before decoding the path, which may contain encoded separators.
    if (preg_match('#^([a-z][a-z0-9+.-]*):/*([^/]+)(/.*)?$#i', $path, $absolute)) {
        $path = isSameOriginHeaderValue($absolute[1] . '://' . $absolute[2]) ? ($absolute[3] ?? '') : '';
    }
    $path = rawurldecode($path);
    if ($path === '' || preg_match('#(?:^|/)\.{0,2}$#D', $path) || preg_match('/[\x00-\x1F\x7F]/', $path)) return '';
    $segments = [];
    foreach (explode('/', $path) as $segment) {
        if ($segment === '..') array_pop($segments);
        elseif ($segment !== '' && $segment !== '.') $segments[] = $segment;
    }
    return '/' . implode('/', $segments);
}

function fvplusCustomIconNameFromReference(string $value): string {
    $path = fvplusNormalizeCustomIconReferencePath($value);
    if (!preg_match('#^/(?:usr/local/emhttp/)?plugins/folderview\.plus/images/custom/([^/]+)$#D', $path, $reference)) return '';
    $name = $reference[1];
    return $name === trim($name) && !str_contains($name, '\\')
        && in_array(strtolower((string)pathinfo($name, PATHINFO_EXTENSION)), fvplusAllowedCustomIconExtensions(), true) ? $name : '';
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
    $paths = ['folders' => getFolderFilePath($type), 'prefs' => getTypePrefsPath($type), 'templates' => getTemplatePath($type)];
    $values = [];
    foreach ($paths as $kind => $path) {
        $mirror = getLastGoodJsonPath($path);
        $read = $kind === 'templates' ? 'readFolderTemplateFile' : 'readJsonObjectFile';
        $value = !is_link($path) && is_file($path) && is_readable($path) ? $read($path) : null;
        if ($strict && $value === null && (file_exists($path) || is_link($path) || file_exists($mirror) || is_link($mirror))) {
            throw new RuntimeException('Icon references could not be verified. Reload Settings and try again.');
        }
        if (!$strict && !is_array($value) && !is_link($mirror)) $value = $read($mirror);
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
    $defaults = normalizeTypePrefs(defaultTypePrefs());
    if (!hasLegacyMigrationMarker($type, 'prefs') && normalizeTypePrefs($values['prefs']) === $defaults) {
        foreach (getLegacyConfigDirCandidates() as $directory) {
            $legacy = readJsonObjectFile($directory . '/' . $type . '.prefs.json');
            if (is_array($legacy) && normalizeTypePrefs($legacy) !== $defaults) { $sources[] = $legacy; break; }
        }
    }
    return ['folders' => $values['folders'], 'prefsSources' => $sources, 'templates' => $values['templates']];
}

function fvplusCustomIconUsageMap(bool $strict = false): array {
    return withConfigMutationLock(static function () use ($strict): array {
        $usage = [];
        $appendUsage = static function (string $name, array $reference) use (&$usage): void { $usage[$name][] = $reference; };
        foreach (['docker', 'vm'] as $type) {
            $inputs = fvplusCustomIconReferenceInputs($type, $strict);
            foreach ($inputs['prefsSources'] as $index => $prefs) {
                $folders = $index === 0 ? $inputs['folders'] : [];
                fvplusVisitCustomIconReferences($type, $folders, $prefs, $appendUsage);
            }
            foreach ($inputs['templates'] as $template) {
                $name = is_string($template['icon'] ?? null) ? fvplusCustomIconNameFromReference($template['icon']) : '';
                if ($name === '') continue;
                $usage[$name][] = ['type' => $type, 'scope' => 'template', 'folderId' => '',
                    'folderName' => is_string($template['name'] ?? null) ? trim($template['name']) : ''];
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
