<?php

if (!defined('FVPLUS_I18N_CATALOG_VERSION')) {
    define('FVPLUS_I18N_CATALOG_VERSION', '2026.07.17.1');
}

if (!function_exists('fvplus_i18n_registry')) {
    function fvplus_i18n_registry(): array {
        return [
            'en' => ['name' => 'English', 'nativeName' => 'English', 'direction' => 'ltr', 'status' => 'source', 'reviewed' => true],
            'cs' => ['name' => 'Czech', 'nativeName' => 'Čeština', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'de' => ['name' => 'German', 'nativeName' => 'Deutsch', 'direction' => 'ltr', 'status' => 'partial', 'reviewed' => false],
            'es' => ['name' => 'Spanish', 'nativeName' => 'Español', 'direction' => 'ltr', 'status' => 'partial', 'reviewed' => false],
            'fr' => ['name' => 'French', 'nativeName' => 'Français', 'direction' => 'ltr', 'status' => 'partial', 'reviewed' => false],
            'it' => ['name' => 'Italian', 'nativeName' => 'Italiano', 'direction' => 'ltr', 'status' => 'partial', 'reviewed' => false],
            'ja' => ['name' => 'Japanese', 'nativeName' => '日本語', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'ko' => ['name' => 'Korean', 'nativeName' => '한국어', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'nl' => ['name' => 'Dutch', 'nativeName' => 'Nederlands', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'pl' => ['name' => 'Polish', 'nativeName' => 'Polski', 'direction' => 'ltr', 'status' => 'partial', 'reviewed' => false],
            'pt' => ['name' => 'Portuguese', 'nativeName' => 'Português', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'ro' => ['name' => 'Romanian', 'nativeName' => 'Română', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'ru' => ['name' => 'Russian', 'nativeName' => 'Русский', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'sv' => ['name' => 'Swedish', 'nativeName' => 'Svenska', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'tr' => ['name' => 'Turkish', 'nativeName' => 'Türkçe', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'uk' => ['name' => 'Ukrainian', 'nativeName' => 'Українська', 'direction' => 'ltr', 'status' => 'placeholder', 'reviewed' => false],
            'zh' => ['name' => 'Chinese', 'nativeName' => '中文', 'direction' => 'ltr', 'status' => 'partial', 'reviewed' => false]
        ];
    }
}

if (!function_exists('fvplus_i18n_normalize_locale')) {
    function fvplus_i18n_normalize_locale(string $locale): string {
        $normalized = str_replace('_', '-', trim($locale));
        if ($normalized === '' || !preg_match('/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $normalized)) {
            return 'en';
        }
        $parts = explode('-', $normalized);
        $parts[0] = strtolower($parts[0]);
        foreach ($parts as $index => $part) {
            if ($index === 0) {
                continue;
            }
            if (strlen($part) === 2 || (strlen($part) === 3 && ctype_digit($part))) {
                $parts[$index] = strtoupper($part);
            } elseif (strlen($part) === 4) {
                $parts[$index] = ucfirst(strtolower($part));
            } else {
                $parts[$index] = strtolower($part);
            }
        }
        return implode('-', $parts);
    }
}

if (!function_exists('fvplus_i18n_resolve_locale')) {
    function fvplus_i18n_resolve_locale(string $requestedLocale): array {
        $registry = fvplus_i18n_registry();
        $requested = fvplus_i18n_normalize_locale($requestedLocale);
        $parts = explode('-', $requested);
        $language = strtolower((string)($parts[0] ?? 'en'));
        $rtlLanguages = ['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'ur', 'yi'];
        $candidates = array_values(array_unique([$requested, $language, 'en']));
        $resolved = 'en';
        foreach ($candidates as $candidate) {
            $key = strtolower($candidate);
            if (!isset($registry[$key])) {
                continue;
            }
            $status = (string)($registry[$key]['status'] ?? 'placeholder');
            if ($key === 'en' || in_array($status, ['partial', 'complete', 'source'], true)) {
                $resolved = $key;
                break;
            }
        }
        return [
            'requested' => $requested,
            'language' => $language,
            'resolved' => $resolved,
            'fallbackChain' => $candidates,
            'direction' => in_array($language, $rtlLanguages, true)
                ? 'rtl'
                : (string)($registry[$resolved]['direction'] ?? 'ltr'),
            'status' => (string)($registry[$resolved]['status'] ?? 'source')
        ];
    }
}

if (!function_exists('fvplus_i18n_public_registry')) {
    function fvplus_i18n_public_registry(): array {
        $output = [];
        foreach (fvplus_i18n_registry() as $locale => $entry) {
            $output[$locale] = [
                'name' => (string)($entry['name'] ?? $locale),
                'nativeName' => (string)($entry['nativeName'] ?? $locale),
                'direction' => (string)($entry['direction'] ?? 'ltr'),
                'status' => (string)($entry['status'] ?? 'placeholder'),
                'reviewed' => (bool)($entry['reviewed'] ?? false)
            ];
        }
        return $output;
    }
}
