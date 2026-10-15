<?php
// The v1 envelope gained optional fields over time; its five core maps did not change.
function fvplusFolderView3AssertMap($value, string $field, int $limit = 5000): void {
    if (!is_array($value) || ($value !== [] && array_is_list($value)) || count($value) > $limit) {
        throw new RuntimeException('Invalid FolderView3 ' . $field . ' map. No configuration was imported.');
    }
}

function fvplusFolderView3AssertText($value, string $field, int $limit): void {
    if (!is_string($value) || strlen($value) > $limit || preg_match('//u', $value) !== 1 || strpos($value, "\0") !== false) {
        throw new RuntimeException('Invalid or oversized FolderView3 ' . $field . '. Shorten or correct it before importing.');
    }
}

function fvplusFolderView3AssertNames($value, string $field): void {
    if (!is_array($value) || !array_is_list($value) || count($value) > 5000) {
        throw new RuntimeException('FolderView3 ' . $field . ' must be a list with at most 5000 entries.');
    }
    foreach ($value as $name) {
        fvplusFolderView3AssertText($name, $field . ' entry', 255);
        if ($name === '' || trim($name) !== $name || preg_match('/[\x00-\x1f\x7f]/', $name)) {
            throw new RuntimeException('FolderView3 ' . $field . ' contains an invalid name.');
        }
    }
}

function fvplusFolderView3AssertNested($value, string $path = '', int $depth = 0): void {
    if ($depth > FVPLUS_MAX_FOLDER_NESTED_DEPTH) {
        throw new RuntimeException('FolderView3 folder data exceeds the supported nesting depth.');
    }
    if (is_array($value)) {
        if (count($value) > folderNormalizationCollectionLimit($path)) {
            throw new RuntimeException('FolderView3 folder collection exceeds its supported limit. No entries were truncated.');
        }
        foreach ($value as $key => $item) {
            if (is_string($key) && (strlen($key) > folderNormalizationKeyLimit($path) || trim($key) !== $key
                || in_array(strtolower($key), ['__proto__', 'constructor', 'prototype'], true))) {
                throw new RuntimeException('FolderView3 folder data contains an unsupported property name.');
            }
            fvplusFolderView3AssertNested($item, $path === '' ? (string)$key : $path . '.' . $key, $depth + 1);
        }
    } elseif (is_string($value)) {
        fvplusFolderView3AssertText($value, 'folder text', FVPLUS_MAX_FOLDER_STRING_BYTES);
    } elseif (!is_int($value) && !is_float($value) && !is_bool($value) && $value !== null) {
        throw new RuntimeException('FolderView3 folder data contains an unsupported value.');
    }
}

function fvplusFolderView3AssertFolder(array $folder, string $type = 'docker'): void {
    fvplusFolderView3AssertText($folder['name'] ?? null, 'folder name', 160);
    if (trim($folder['name']) === '' || trim($folder['name']) !== $folder['name']) {
        throw new RuntimeException('FolderView3 folder names must be nonempty and have no surrounding whitespace.');
    }
    foreach (['containers', 'hidden_preview'] as $key) {
        if (array_key_exists($key, $folder)) fvplusFolderView3AssertNames($folder[$key], $key);
    }
    foreach (['icon' => 2048, 'regex' => 1024] as $key => $limit) {
        if (array_key_exists($key, $folder)) fvplusFolderView3AssertText($folder[$key], $key, $limit);
    }
    foreach (['settings'] as $key) {
        if (array_key_exists($key, $folder)) fvplusFolderView3AssertMap($folder[$key], $key);
    }
    foreach (['containerIds', 'containerImages'] as $key) {
        if (!array_key_exists($key, $folder)) continue;
        if (!is_array($folder[$key]) || count($folder[$key]) > 5000) throw new RuntimeException('Invalid FolderView3 member identity collection.');
        foreach ($folder[$key] as $value) {
            fvplusFolderView3AssertText($value, 'member identity', $key === 'containerIds' ? ($type === 'vm' ? 128 : 64) : 512);
            if ($type === 'vm' && $key === 'containerIds' && $value !== '' && !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i', $value)) throw new RuntimeException('FolderView3 VM identity is not a valid UUID.');
        }
    }
    foreach (($folder['settings'] ?? []) as $value) {
        if (!is_scalar($value) && $value !== null) throw new RuntimeException('FolderView3 folder settings must contain scalar values.');
    }
    if (isset($folder['actions'])) {
        if (!is_array($folder['actions']) || !array_is_list($folder['actions']) || count($folder['actions']) > 200) {
            throw new RuntimeException('FolderView3 actions must contain at most 200 action records.');
        }
        foreach ($folder['actions'] as $action) {
            fvplusFolderView3AssertMap($action, 'action', 32);
            foreach (['containers', 'conatiners'] as $key) {
                if (array_key_exists($key, $action)) fvplusFolderView3AssertNames($action[$key], 'action targets');
            }
        }
    }
    fvplusFolderView3AssertNested($folder);
    $pattern = $folder['regex'] ?? '';
    if (trim($pattern) !== '' && (@preg_match('/' . str_replace('/', '\\/', $pattern) . '/', '') === false
        || preg_match('/\(\?(?![:=!]|<[=!]|<[A-Za-z_$][A-Za-z0-9_$]*>)|\(\*|\\\\(?:[AKRXCQELNZzaehHvV]|p\{|P\{|g[<{])|(?:[*+?]|\})\+/', $pattern))) {
        throw new RuntimeException('FolderView3 regex is invalid or uses unsupported JavaScript/PHP syntax. Correct the original expression before importing.');
    }
}

function fvplusFolderView3ValidateBundle(array $bundle): void {
    if (($bundle['fv3_export_version'] ?? null) !== 1) throw new RuntimeException('Unsupported FolderView3 export version.');
    foreach (['docker', 'vm', 'settings', 'css_config', 'custom_styles'] as $key) {
        if (!array_key_exists($key, $bundle)) throw new RuntimeException('FolderView3 backup is missing required ' . $key . ' data.');
        fvplusFolderView3AssertMap($bundle[$key], $key);
    }
    foreach (['docker', 'vm'] as $type) {
        $seen = [];
        foreach ($bundle[$type] as $id => $folder) {
            if (normalizeFolderIdValue($id) === '' || (string)$id !== normalizeFolderIdValue($id) || !is_array($folder)) {
                throw new RuntimeException('FolderView3 contains an invalid folder identifier or record.');
            }
            fvplusFolderView3AssertFolder($folder, $type);
            if (isset($seen[$folder['name']])) throw new RuntimeException('FolderView3 contains ambiguous duplicate folder names. Rename them before importing.');
            $seen[$folder['name']] = true;
        }
    }
    foreach ($bundle['settings'] as $value) {
        if (!is_string($value) && !is_int($value) && !is_bool($value)) throw new RuntimeException('FolderView3 global settings must contain scalar values.');
    }
    foreach ($bundle['settings'] as $key => $value) {
        if (is_string($value)) fvplusFolderView3AssertText($value, 'global setting', 2048);
        $token = (string)$value;
        if (preg_match('/^(?:default_.*(?:hover|grayscale|webui|logs|console|update|update_folder|vertical_bars|border|separator|column)|dashboard_.*(?:animation|expand_toggle|greyscale|folder_label|update_container|update_folder))$/', (string)$key)
            && !in_array($token, ['yes', 'no'], true)) throw new RuntimeException('FolderView3 boolean global setting must use yes or no.');
        if (in_array($key, ['dashboard_docker_layout', 'dashboard_vm_layout'], true) && !in_array($token, ['classic', 'fullwidth', 'accordion', 'inset', 'embossed'], true)) throw new RuntimeException('Unsupported FolderView3 Dashboard layout.');
        if ($key === 'default_preview_status' && !in_array($token, ['none', 'symbol', 'grayscale'], true)) throw new RuntimeException('Unsupported FolderView3 preview status.');
        if (in_array($key, ['dashboard_context', 'dashboard_context_trigger', 'dashboard_context_graph'], true)
            && (!ctype_digit($token) || (int)$token > ($key === 'dashboard_context_trigger' ? 1 : ($key === 'dashboard_context' ? 3 : 4)))) throw new RuntimeException('Unsupported FolderView3 Dashboard context value.');
        if ($key === 'dashboard_context_graph_time' && (!ctype_digit($token) || (int)$token < 5 || (int)$token > 600)) throw new RuntimeException('Unsupported FolderView3 Dashboard context value.');
    }
    foreach (['plugin_version', 'unraid_version', 'exported'] as $key) {
        if (array_key_exists($key, $bundle)) fvplusFolderView3AssertText($bundle[$key], $key, 255);
    }
    if (array_key_exists('autostart', $bundle)) {
        fvplusFolderView3AssertMap($bundle['autostart'], 'autostart');
        if (!in_array($bundle['autostart']['mode'] ?? null, ['off', 'folder', 'custom'], true)) throw new RuntimeException('Invalid FolderView3 autostart mode.');
        fvplusFolderView3AssertNames($bundle['autostart']['sequence'] ?? [], 'autostart sequence');
        if (count($bundle['autostart']['sequence'] ?? []) > 2000) throw new RuntimeException('FolderView3 autostart sequence exceeds the 2000-entry startup limit.');
        foreach (($bundle['autostart']['sequence'] ?? []) as $name) if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*$/D', $name)) throw new RuntimeException('Invalid FolderView3 autostart sequence name.');
    }
    foreach ($bundle['custom_styles'] as $path => $content) {
        fvplusFolderView3AssertText($content, 'stylesheet', 2097152);
        if (!is_string($path) || $path === '' || strlen($path) > 2048 || trim($path) !== $path || str_contains($path, '..') || preg_match('~^(?:[/\\\\]|[A-Za-z]:)|[\x00-\x1f\x7f]~', $path)) {
            throw new RuntimeException('FolderView3 contains an unsafe stylesheet filename.');
        }
    }
    foreach (['global', 'docker', 'vm', 'dashboard'] as $scope) {
        if (array_key_exists($scope, $bundle['css_config'])) {
            fvplusFolderView3AssertMap($bundle['css_config'][$scope], 'CSS variables', 96);
            foreach ($bundle['css_config'][$scope] as $name => $value) {
                if (!preg_match('/^[A-Za-z0-9_-]+$/', (string)$name)) throw new RuntimeException('Unsupported FolderView3 CSS variable name.');
                fvplusFolderView3AssertText($value, 'CSS variable value', 200);
            }
        }
    }
    $presets = $bundle['css_config']['custom_presets'] ?? [];
    if (!is_array($presets) || !array_is_list($presets) || count($presets) > 30) throw new RuntimeException('FolderView3 has too many or malformed appearance presets.');
    $presetNames = [];
    foreach ($presets as $preset) {
        if (!is_array($preset)) throw new RuntimeException('Invalid FolderView3 appearance preset.');
        fvplusFolderView3AssertText($preset['name'] ?? null, 'preset name', 96);
        if (trim($preset['name']) === '' || trim($preset['name']) !== $preset['name']) throw new RuntimeException('Invalid FolderView3 appearance preset name.');
        if (isset($presetNames[$preset['name']])) throw new RuntimeException('FolderView3 appearance preset names are duplicated.');
        $presetNames[$preset['name']] = true;
        fvplusFolderView3AssertMap($preset['values'] ?? null, 'preset values', 96);
        foreach ($preset['values'] as $value) fvplusFolderView3AssertText($value, 'preset value', 200);
    }
    foreach (['custom_css', 'custom_css_docker', 'custom_css_vm', 'custom_css_dashboard'] as $key) {
        if (array_key_exists($key, $bundle['css_config'])) fvplusFolderView3AssertText($bundle['css_config'][$key], 'custom CSS', 65536);
    }
    foreach (['page_values', 'page_presets'] as $key) {
        if (!array_key_exists($key, $bundle['css_config'])) continue;
        fvplusFolderView3AssertMap($bundle['css_config'][$key], 'page appearance', 8);
        foreach ($bundle['css_config'][$key] as $value) {
            if ($key === 'page_presets') {
                if ($value !== null) fvplusFolderView3AssertText($value, 'page preset', 96);
            } else {
                fvplusFolderView3AssertMap($value, 'page variables', 96);
                foreach ($value as $entry) fvplusFolderView3AssertText($entry, 'page variable value', 200);
            }
        }
    }
    foreach (['user_notes' => 60000, 'toggle_style' => 96, 'preset' => 96] as $key => $limit) {
        if (array_key_exists($key, $bundle['css_config'])) fvplusFolderView3AssertText($bundle['css_config'][$key], 'appearance metadata', $limit);
    }
    if (array_key_exists('native_autostart', $bundle)) {
        $nativeNames = [];
        if (!is_array($bundle['native_autostart']) || !array_is_list($bundle['native_autostart']) || count($bundle['native_autostart']) > 2000) throw new RuntimeException('Invalid or oversized FolderView3 native autostart list.');
        foreach ($bundle['native_autostart'] as $line) {
            fvplusFolderView3AssertText($line, 'native autostart entry', 270);
            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*(?: [0-9]{1,4})?$/D', $line)) throw new RuntimeException('Invalid FolderView3 native autostart entry.');
            $parts = explode(' ', $line);
            if (strlen($parts[0]) > 255 || isset($nativeNames[$parts[0]])) throw new RuntimeException('Invalid FolderView3 native autostart entry.');
            $nativeNames[$parts[0]] = true;
            if (isset($parts[1]) && (int)$parts[1] > 3600) throw new RuntimeException('FolderView3 native autostart wait exceeds 3600 seconds.');
        }
    }
}

function fvplusFolderView3AssertUniqueJsonKeys(string $raw): void {
    preg_match_all('/"(?:[^"\\\\]|\\\\.)*"|[{}\[\]:,]/s', $raw, $matches);
    $stack = [];
    foreach ($matches[0] as $index => $token) {
        if ($token === '{' || $token === '[') {
            $stack[] = ['kind' => $token, 'keys' => []];
            if (count($stack) > 16) throw new RuntimeException('FolderView3 JSON exceeds the supported nesting depth.');
        } elseif ($token === '}' || $token === ']') {
            array_pop($stack);
        } elseif (($matches[0][$index + 1] ?? '') === ':' && $stack !== [] && $stack[count($stack) - 1]['kind'] === '{') {
            $key = json_decode($token, true, 512, JSON_THROW_ON_ERROR);
            $level = count($stack) - 1;
            if (array_key_exists($key, $stack[$level]['keys'])) throw new RuntimeException('FolderView3 JSON contains duplicate property names. Correct the export before importing.');
            $stack[$level]['keys'][$key] = true;
        }
    }
}
