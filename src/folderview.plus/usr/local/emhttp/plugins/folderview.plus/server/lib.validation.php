<?php

if (!function_exists('fvplus_validation_is_scalarish')) {
    function fvplus_validation_is_scalarish($value): bool {
        return is_string($value) || is_int($value) || is_float($value) || is_bool($value) || $value === null;
    }
}

if (!function_exists('fvplus_validation_assert_list_of_scalarish')) {
    function fvplus_validation_assert_list_of_scalarish($value, string $path, int $maxItems = 5000): void {
        if (!is_array($value)) {
            throw new RuntimeException("Invalid payload: '$path' must be an array.");
        }
        $count = 0;
        foreach ($value as $item) {
            $count += 1;
            if ($count > $maxItems) {
                throw new RuntimeException("Invalid payload: '$path' exceeds maximum item count.");
            }
            if (!fvplus_validation_is_scalarish($item)) {
                throw new RuntimeException("Invalid payload: '$path' entries must be scalar values.");
            }
        }
    }
}

if (!function_exists('fvplus_validation_assert_assoc_map')) {
    function fvplus_validation_assert_assoc_map($value, string $path, int $maxItems = 5000): void {
        if (!is_array($value)) {
            throw new RuntimeException("Invalid payload: '$path' must be an object/map.");
        }
        $count = 0;
        foreach ($value as $key => $entry) {
            $count += 1;
            if ($count > $maxItems) {
                throw new RuntimeException("Invalid payload: '$path' exceeds maximum item count.");
            }
            if (!is_string($key) && !is_int($key)) {
                throw new RuntimeException("Invalid payload: '$path' keys must be string-like.");
            }
            if (!fvplus_validation_is_scalarish($entry)) {
                throw new RuntimeException("Invalid payload: '$path' values must be scalar-like.");
            }
        }
    }
}

if (!function_exists('fvplus_assert_folder_payload_shape')) {
    function fvplus_assert_folder_payload_shape(array $payload): void {
        if (array_key_exists('name', $payload) && !fvplus_validation_is_scalarish($payload['name'])) {
            throw new RuntimeException('Invalid folder payload: name must be a scalar value.');
        }
        if (array_key_exists('icon', $payload) && !fvplus_validation_is_scalarish($payload['icon'])) {
            throw new RuntimeException('Invalid folder payload: icon must be a scalar value.');
        }
        if (array_key_exists('regex', $payload) && !fvplus_validation_is_scalarish($payload['regex'])) {
            throw new RuntimeException('Invalid folder payload: regex must be a scalar value.');
        }
        if (array_key_exists('parentId', $payload) && !fvplus_validation_is_scalarish($payload['parentId'])) {
            throw new RuntimeException('Invalid folder payload: parentId must be a scalar value.');
        }
        if (array_key_exists('containers', $payload)) {
            fvplus_validation_assert_list_of_scalarish($payload['containers'], 'containers', 5000);
        }
        if (array_key_exists('settings', $payload) && !is_array($payload['settings'])) {
            throw new RuntimeException('Invalid folder payload: settings must be an object.');
        }
        if (array_key_exists('actions', $payload)) {
            if (!is_array($payload['actions'])) {
                throw new RuntimeException('Invalid folder payload: actions must be an array.');
            }
            $actionCount = 0;
            foreach ($payload['actions'] as $action) {
                $actionCount += 1;
                if ($actionCount > 250) {
                    throw new RuntimeException('Invalid folder payload: actions exceed maximum item count.');
                }
                if (!is_array($action)) {
                    throw new RuntimeException('Invalid folder payload: each action must be an object.');
                }
            }
        }
    }
}

if (!function_exists('fvplus_assert_prefs_payload_shape')) {
    function fvplus_assert_prefs_payload_shape(array $payload): void {
        $scalarKeys = [
            'sortMode',
            'hideEmptyFolders',
            'appColumnWidth',
            'setupWizardCompleted',
            'settingsMode',
            'runtimePrefsSchema',
            'liveRefreshEnabled',
            'liveRefreshSeconds',
            'performanceMode',
            'lazyPreviewEnabled',
            'lazyPreviewThreshold'
        ];
        foreach ($scalarKeys as $key) {
            if (array_key_exists($key, $payload) && !fvplus_validation_is_scalarish($payload[$key])) {
                throw new RuntimeException("Invalid prefs payload: '$key' must be a scalar value.");
            }
        }

        if (array_key_exists('manualOrder', $payload)) {
            fvplus_validation_assert_list_of_scalarish($payload['manualOrder'], 'manualOrder', 10000);
        }
        if (array_key_exists('pinnedFolderIds', $payload)) {
            fvplus_validation_assert_list_of_scalarish($payload['pinnedFolderIds'], 'pinnedFolderIds', 10000);
        }
        if (array_key_exists('expandedFolderState', $payload)) {
            fvplus_validation_assert_assoc_map($payload['expandedFolderState'], 'expandedFolderState', 20000);
        }

        $objectKeys = ['badges', 'health', 'status', 'backupSchedule', 'importPresets'];
        foreach ($objectKeys as $key) {
            if (array_key_exists($key, $payload) && !is_array($payload[$key])) {
                throw new RuntimeException("Invalid prefs payload: '$key' must be an object.");
            }
        }

        if (array_key_exists('autoRules', $payload)) {
            if (!is_array($payload['autoRules'])) {
                throw new RuntimeException("Invalid prefs payload: 'autoRules' must be an array.");
            }
            $ruleCount = 0;
            foreach ($payload['autoRules'] as $rule) {
                $ruleCount += 1;
                if ($ruleCount > 2000) {
                    throw new RuntimeException("Invalid prefs payload: 'autoRules' exceeds maximum item count.");
                }
                if (!is_array($rule)) {
                    throw new RuntimeException("Invalid prefs payload: each auto rule must be an object.");
                }
            }
        }

        if (array_key_exists('importPresets', $payload) && is_array($payload['importPresets'])) {
            $presets = $payload['importPresets'];
            if (array_key_exists('defaultId', $presets) && !fvplus_validation_is_scalarish($presets['defaultId'])) {
                throw new RuntimeException("Invalid prefs payload: 'importPresets.defaultId' must be a scalar value.");
            }
            if (array_key_exists('custom', $presets)) {
                if (!is_array($presets['custom'])) {
                    throw new RuntimeException("Invalid prefs payload: 'importPresets.custom' must be an array.");
                }
                foreach ($presets['custom'] as $row) {
                    if (!is_array($row)) {
                        throw new RuntimeException("Invalid prefs payload: each custom import preset must be an object.");
                    }
                }
            }
        }
    }
}
