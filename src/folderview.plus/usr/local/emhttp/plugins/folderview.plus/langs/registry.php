<?php

if (!defined('FVPLUS_I18N_CATALOG_VERSION')) {
    define('FVPLUS_I18N_CATALOG_VERSION', '2026.07.24.1');
}

if (!function_exists('fvplus_i18n_registry')) {
    function fvplus_i18n_registry(): array {
        return [
            'en' => ['name' => 'English', 'nativeName' => 'English', 'direction' => 'ltr', 'status' => 'source', 'reviewed' => true],
            'cs' => ['name' => 'Czech', 'nativeName' => 'Čeština', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'de' => ['name' => 'German', 'nativeName' => 'Deutsch', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'es' => ['name' => 'Spanish', 'nativeName' => 'Español', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'fr' => ['name' => 'French', 'nativeName' => 'Français', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'it' => ['name' => 'Italian', 'nativeName' => 'Italiano', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'ja' => ['name' => 'Japanese', 'nativeName' => '日本語', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'ko' => ['name' => 'Korean', 'nativeName' => '한국어', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'nl' => ['name' => 'Dutch', 'nativeName' => 'Nederlands', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'pl' => ['name' => 'Polish', 'nativeName' => 'Polski', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'pt-BR' => ['name' => 'Portuguese (Brazil)', 'nativeName' => 'Português (Brasil)', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'pt-PT' => ['name' => 'Portuguese (Portugal)', 'nativeName' => 'Português (Portugal)', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'ro' => ['name' => 'Romanian', 'nativeName' => 'Română', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'ru' => ['name' => 'Russian', 'nativeName' => 'Русский', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'sv' => ['name' => 'Swedish', 'nativeName' => 'Svenska', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'tr' => ['name' => 'Turkish', 'nativeName' => 'Türkçe', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'uk' => ['name' => 'Ukrainian', 'nativeName' => 'Українська', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true],
            'zh-Hans' => ['name' => 'Chinese (Simplified)', 'nativeName' => '简体中文', 'direction' => 'ltr', 'status' => 'complete', 'reviewed' => true]
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

if (!function_exists('fvplus_i18n_registry_key')) {
    function fvplus_i18n_registry_key(string $locale): ?string {
        $needle = strtolower(fvplus_i18n_normalize_locale($locale));
        foreach (array_keys(fvplus_i18n_registry()) as $registeredLocale) {
            if (strtolower($registeredLocale) === $needle) {
                return $registeredLocale;
            }
        }
        return null;
    }
}

if (!function_exists('fvplus_i18n_locale_candidates')) {
    function fvplus_i18n_locale_candidates(string $requestedLocale): array {
        $requested = fvplus_i18n_normalize_locale($requestedLocale);
        $language = strtolower((string)(explode('-', $requested)[0] ?? 'en'));
        $requestedLower = strtolower($requested);
        $regionalAlias = null;
        if ($language === 'zh') {
            if (in_array($requestedLower, ['zh', 'zh-cn', 'zh-sg', 'zh-my', 'zh-hans'], true)) {
                $regionalAlias = 'zh-Hans';
            } elseif (in_array($requestedLower, ['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'], true)) {
                $regionalAlias = 'zh-Hant';
            }
        } elseif ($requestedLower === 'pt') {
            $regionalAlias = 'pt-PT';
        }
        $baseCandidate = $language === 'zh' ? null : $language;
        return array_values(array_unique(array_filter([$requested, $regionalAlias, $baseCandidate, 'en'])));
    }
}

if (!function_exists('fvplus_i18n_resolve_locale')) {
    function fvplus_i18n_resolve_locale(string $requestedLocale): array {
        $registry = fvplus_i18n_registry();
        $requested = fvplus_i18n_normalize_locale($requestedLocale);
        $language = strtolower((string)(explode('-', $requested)[0] ?? 'en'));
        $rtlLanguages = ['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'ur', 'yi'];
        $candidates = fvplus_i18n_locale_candidates($requested);
        $resolved = 'en';
        $requestedRegistryKey = fvplus_i18n_registry_key($requested);
        if ($requestedRegistryKey === null) {
            foreach ($candidates as $candidate) {
                $candidateRegistryKey = fvplus_i18n_registry_key($candidate);
                if ($candidateRegistryKey !== null && $candidateRegistryKey !== 'en') {
                    $requestedRegistryKey = $candidateRegistryKey;
                    break;
                }
            }
        }
        foreach ($candidates as $candidate) {
            $registryKey = fvplus_i18n_registry_key($candidate);
            if ($registryKey === null) {
                continue;
            }
            $status = (string)($registry[$registryKey]['status'] ?? 'placeholder');
            if ($registryKey === 'en' || in_array($status, ['partial', 'complete', 'source'], true)) {
                $resolved = $registryKey;
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
            'status' => (string)($registry[$resolved]['status'] ?? 'source'),
            'requestedStatus' => $requestedRegistryKey === null
                ? 'unregistered'
                : (string)($registry[$requestedRegistryKey]['status'] ?? 'placeholder')
        ];
    }
}

if (!function_exists('fvplus_i18n_read_catalog_file')) {
    function fvplus_i18n_read_catalog_file(string $path): array {
        if (!is_file($path) || !is_readable($path)) {
            return [];
        }
        $decoded = json_decode((string)file_get_contents($path), true);
        return is_array($decoded) ? $decoded : [];
    }
}

if (!function_exists('fvplus_i18n_catalog_file_has_messages')) {
    function fvplus_i18n_catalog_file_has_messages(string $path): bool {
        foreach (fvplus_i18n_read_catalog_file($path) as $key => $_value) {
            if ($key !== '@metadata') {
                return true;
            }
        }
        return false;
    }
}

if (!function_exists('fvplus_i18n_catalog_report')) {
    function fvplus_i18n_catalog_report(array $localeFilter = []): array {
        static $cache = [];
        $normalizedFilter = [];
        foreach ($localeFilter as $locale) {
            $registryKey = fvplus_i18n_registry_key((string)$locale);
            if ($registryKey !== null) {
                $normalizedFilter[] = $registryKey;
            }
        }
        $normalizedFilter = array_values(array_unique($normalizedFilter));
        sort($normalizedFilter);
        $cacheKey = $normalizedFilter === [] ? '*' : implode('|', $normalizedFilter);
        if (is_array($cache[$cacheKey] ?? null)) {
            return $cache[$cacheKey];
        }
        $langDir = __DIR__;
        $namespaceRoot = $langDir . '/namespaces';
        $sourceMessages = [];
        $sourceByNamespace = [];
        $sourceFiles = ['legacy' => $langDir . '/en.json'];
        foreach (glob($namespaceRoot . '/en/*.json') ?: [] as $path) {
            $sourceFiles[pathinfo($path, PATHINFO_FILENAME)] = $path;
        }
        foreach ($sourceFiles as $namespace => $path) {
            $catalog = fvplus_i18n_read_catalog_file($path);
            $sourceByNamespace[$namespace] = [];
            foreach ($catalog as $key => $value) {
                if ($key === '@metadata' || !is_string($value)) {
                    continue;
                }
                $sourceMessages[$key] = $value;
                $sourceByNamespace[$namespace][$key] = $value;
            }
        }
        $sourceTotal = count($sourceMessages);
        $extractionReport = fvplus_i18n_read_catalog_file($langDir . '/extraction-report.json');
        $rows = [];
        foreach (fvplus_i18n_registry() as $locale => $entry) {
            if ($normalizedFilter !== [] && !in_array($locale, $normalizedFilter, true)) {
                continue;
            }
            $rootCatalog = fvplus_i18n_read_catalog_file($langDir . '/' . $locale . '.json');
            $metadata = is_array($rootCatalog['@metadata'] ?? null) ? $rootCatalog['@metadata'] : [];
            $translatedByNamespace = [];
            $loadedMessages = [];
            foreach ($sourceByNamespace as $namespace => $namespaceSource) {
                $catalog = $namespace === 'legacy'
                    ? $rootCatalog
                    : fvplus_i18n_read_catalog_file($namespaceRoot . '/' . $locale . '/' . $namespace . '.json');
                $translated = 0;
                foreach ($namespaceSource as $key => $sourceValue) {
                    $translatedValue = $catalog[$key] ?? null;
                    if (is_string($translatedValue) && $translatedValue !== '') {
                        $translated++;
                        $loadedMessages[$key] = $translatedValue;
                    }
                }
                $translatedByNamespace[$namespace] = [
                    'translated' => $locale === 'en' ? count($namespaceSource) : $translated,
                    'total' => count($namespaceSource)
                ];
            }
            $translatedTotal = $locale === 'en' ? $sourceTotal : count($loadedMessages);
            $sourceRevision = (string)($metadata['source-revision'] ?? '');
            $reviewedCurrent = $locale === 'en' || ($sourceRevision === FVPLUS_I18N_CATALOG_VERSION && ($entry['reviewed'] ?? false) === true);
            $rows[$locale] = [
                'name' => (string)($entry['name'] ?? $locale),
                'nativeName' => (string)($entry['nativeName'] ?? $locale),
                'direction' => (string)($entry['direction'] ?? 'ltr'),
                'status' => (string)($entry['status'] ?? 'placeholder'),
                'reviewed' => (bool)($entry['reviewed'] ?? false),
                'reviewedAgainstCurrentSource' => $reviewedCurrent,
                'sourceRevision' => $sourceRevision,
                'lastUpdated' => $metadata['last-updated'] ?? null,
                'lastReviewed' => $metadata['last-reviewed'] ?? null,
                'translatedMessages' => $translatedTotal,
                'totalSourceMessages' => $sourceTotal,
                'missingMessages' => max(0, $sourceTotal - $translatedTotal),
                'coveragePercent' => $sourceTotal > 0 ? (int)round(($translatedTotal / $sourceTotal) * 100) : 0,
                'potentiallyStaleMessages' => $reviewedCurrent ? 0 : $translatedTotal,
                'namespaces' => $translatedByNamespace
            ];
        }
        $cache[$cacheKey] = [
            'catalogVersion' => FVPLUS_I18N_CATALOG_VERSION,
            'sourceLocale' => 'en',
            'sourceMessageCount' => $sourceTotal,
            'namespaceCount' => count($sourceByNamespace),
            'extraction' => [
                'candidateCount' => (int)($extractionReport['candidate-count'] ?? 0),
                'autoBoundMessageCount' => (int)($extractionReport['auto-bound-message-count'] ?? 0),
                'catalogMessageCount' => (int)($extractionReport['catalog-message-count'] ?? $sourceTotal),
                'largestSurfaces' => is_array($extractionReport['largest-surfaces'] ?? null) ? $extractionReport['largest-surfaces'] : []
            ],
            'locales' => $rows
        ];
        return $cache[$cacheKey];
    }
}

if (!function_exists('fvplus_i18n_public_registry')) {
    function fvplus_i18n_public_registry(?array $catalogReport = null): array {
        $coverageRows = ($catalogReport ?? fvplus_i18n_catalog_report())['locales'] ?? [];
        $output = [];
        foreach (fvplus_i18n_registry() as $locale => $entry) {
            $coverage = is_array($coverageRows[$locale] ?? null) ? $coverageRows[$locale] : [];
            $output[$locale] = [
                'name' => (string)($entry['name'] ?? $locale),
                'nativeName' => (string)($entry['nativeName'] ?? $locale),
                'direction' => (string)($entry['direction'] ?? 'ltr'),
                'status' => (string)($entry['status'] ?? 'placeholder'),
                'reviewed' => (bool)($entry['reviewed'] ?? false),
                'coveragePercent' => (int)($coverage['coveragePercent'] ?? 0),
                'translatedMessages' => (int)($coverage['translatedMessages'] ?? 0),
                'totalSourceMessages' => (int)($coverage['totalSourceMessages'] ?? 0),
                'reviewedAgainstCurrentSource' => (bool)($coverage['reviewedAgainstCurrentSource'] ?? false)
            ];
        }
        return $output;
    }
}
