<?php

if (!function_exists('normalizeRequestTokenEnforcementMode')) {
    function normalizeRequestTokenEnforcementMode(string $mode): string {
        $normalized = strtolower(trim($mode));
        if (in_array($normalized, ['off', 'compat', 'strict'], true)) {
            return $normalized;
        }
        return 'compat';
    }
}

if (!function_exists('normalizeFolderIdValue')) {
    function normalizeFolderIdValue($value): string {
        $id = trim((string)$value);
        if ($id === '' || strlen($id) > 128 || !preg_match('/^[A-Za-z0-9._:-]+$/D', $id)) {
            return '';
        }
        if (in_array(strtolower($id), ['__proto__', 'prototype', 'constructor'], true)) {
            return '';
        }
        return $id;
    }
}
