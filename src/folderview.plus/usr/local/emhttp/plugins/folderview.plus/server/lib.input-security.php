<?php

function truncateUtf8String(string $value, int $maxBytes): string {
    if ($maxBytes <= 0) {
        return '';
    }
    if (strlen($value) <= $maxBytes) {
        return $value;
    }
    // Preserve existing handling of malformed input; JSON writers reject it.
    if (preg_match('//u', $value) !== 1) {
        return substr($value, 0, $maxBytes);
    }
    // The first excluded byte must not be a UTF-8 continuation byte.
    while ((ord($value[$maxBytes]) & 0xC0) === 0x80) {
        $maxBytes--;
    }
    return substr($value, 0, $maxBytes);
}

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
