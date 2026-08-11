<?php
function readInstalledVersion(): string {
        global $configDir;
        $versionPath = "$configDir/version";
        if (!file_exists($versionPath)) {
            return '0.0.0';
        }
        $version = trim((string)@file_get_contents($versionPath));
        return $version === '' ? '0.0.0' : $version;
    }

    function readInstalledManifestPathCandidates(): array {
        global $configDir, $sourceDir;
        $candidates = [
            "$configDir/folderview.plus.plg",
            '/boot/config/plugins/folderview.plus.plg',
            "$sourceDir/folderview.plus.plg"
        ];
        $unique = [];
        foreach ($candidates as $path) {
            $normalized = trim((string)$path);
            if ($normalized === '' || in_array($normalized, $unique, true)) {
                continue;
            }
            if (is_file($normalized)) {
                $unique[] = $normalized;
            }
        }
        return $unique;
    }

    function normalizeChangesBlockLines(string $block): array {
        $lines = [];
        foreach (explode("\n", str_replace(["\r\n", "\r"], "\n", $block)) as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '') {
                continue;
            }
            $trimmed = preg_replace('/^\s*[-*]\s*/', '', $trimmed);
            $trimmed = trim((string)$trimmed);
            if ($trimmed !== '') {
                $lines[] = $trimmed;
            }
        }
        return $lines;
    }

    function isChangesBoilerplateLine(string $line): bool {
        $lowered = strtolower(trim($line));
        if ($lowered === '') {
            return false;
        }
        return $lowered === 'maintenance: release metadata and packaging sync.'
            || $lowered === 'maintenance: release metadata and packaging sync'
            || $lowered === 'maintenance: automated release metadata update.'
            || $lowered === 'maintenance: automated release metadata update';
    }

    function filterBoilerplateChangesLines(array $lines): array {
        if (count($lines) <= 1) {
            return $lines;
        }
        $filtered = [];
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '') {
                continue;
            }
            if (isChangesBoilerplateLine($trimmed)) {
                continue;
            }
            $filtered[] = $trimmed;
        }
        return count($filtered) > 0 ? $filtered : $lines;
    }

    function applyChangesLineLimit(array $lines, int $maxLines): array {
        if ($maxLines > 0 && count($lines) > $maxLines) {
            $lines = array_slice($lines, 0, $maxLines);
            $lines[] = '...';
        }
        return $lines;
    }

    function extractChangesBlockForVersion(string $content, string $version): array {
        $version = trim($version);
        if ($version === '') {
            return [];
        }
        $pattern = '/^###\s*' . preg_quote($version, '/') . '\s*$(.*?)(?=^###\s*[0-9][0-9A-Za-z._-]*\s*$|\z)/ms';
        if (!preg_match($pattern, $content, $match)) {
            return [];
        }
        $block = trim((string)($match[1] ?? ''));
        if ($block === '') {
            return [];
        }
        return normalizeChangesBlockLines($block);
    }

    function extractLatestChangesBlock(string $content): array {
        if (!preg_match('/^###\s*([0-9][0-9A-Za-z._-]*)\s*$(.*?)(?=^###\s*[0-9][0-9A-Za-z._-]*\s*$|\z)/ms', $content, $match)) {
            return [];
        }
        $version = trim((string)($match[1] ?? ''));
        $block = trim((string)($match[2] ?? ''));
        if ($version === '' || $block === '') {
            return [];
        }
        return [
            'sourceVersion' => $version,
            'lines' => normalizeChangesBlockLines($block)
        ];
    }

    function extractChangesEntries(string $content): array {
        if (!preg_match_all('/^###\s*([0-9][0-9A-Za-z._-]*)\s*$(.*?)(?=^###\s*[0-9][0-9A-Za-z._-]*\s*$|\z)/ms', $content, $matches, PREG_SET_ORDER)) {
            return [];
        }
        $entries = [];
        foreach ($matches as $match) {
            $version = trim((string)($match[1] ?? ''));
            if ($version === '') {
                continue;
            }
            $block = trim((string)($match[2] ?? ''));
            $entries[] = [
                'version' => $version,
                'lines' => normalizeChangesBlockLines($block)
            ];
        }
        return $entries;
    }

    function extractPreviousChangesEntry(string $content, string $version): array {
        $targetVersion = trim($version);
        if ($targetVersion === '') {
            return [];
        }
        $entries = extractChangesEntries($content);
        $entryCount = count($entries);
        if ($entryCount === 0) {
            return [];
        }
        for ($index = 0; $index < $entryCount; $index += 1) {
            $entryVersion = trim((string)($entries[$index]['version'] ?? ''));
            if ($entryVersion !== $targetVersion) {
                continue;
            }
            if (($index + 1) >= $entryCount) {
                return [];
            }
            return (array)$entries[$index + 1];
        }
        return [];
    }

    function buildUniqueCurrentChangesLines(array $currentLines, array $previousLines): array {
        if (count($currentLines) === 0 || count($previousLines) === 0) {
            return $currentLines;
        }
        $previousLookup = [];
        foreach ($previousLines as $line) {
            $normalized = trim((string)$line);
            if ($normalized === '') {
                continue;
            }
            $previousLookup[$normalized] = true;
        }
        if (count($previousLookup) === 0) {
            return $currentLines;
        }
        $unique = [];
        foreach ($currentLines as $line) {
            $normalized = trim((string)$line);
            if ($normalized === '') {
                continue;
            }
            if (isset($previousLookup[$normalized])) {
                continue;
            }
            $unique[] = $normalized;
        }
        if (count($unique) === 0) {
            return $currentLines;
        }
        return $unique;
    }

    function readChangesSummaryForVersion(string $version, int $maxLines = 14, bool $allowFallback = true): array {
        $requestedVersion = trim($version);
        if ($requestedVersion === '') {
            $requestedVersion = readInstalledVersion();
        }

        $latestFallback = [];
        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $raw = @file_get_contents($manifestPath);
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $content = str_replace(["\r\n", "\r"], "\n", $raw);
            $matchedLines = extractChangesBlockForVersion($content, $requestedVersion);
            if (count($matchedLines) > 0) {
                $displayLines = $matchedLines;
                $previousEntry = extractPreviousChangesEntry($content, $requestedVersion);
                $displayLines = buildUniqueCurrentChangesLines($displayLines, (array)($previousEntry['lines'] ?? []));
                $displayLines = filterBoilerplateChangesLines($displayLines);
                return [
                    'version' => $requestedVersion,
                    'sourceVersion' => $requestedVersion,
                    'lines' => applyChangesLineLimit($displayLines, $maxLines),
                    'usedFallback' => false,
                    'manifestPath' => $manifestPath
                ];
            }

            if (count($latestFallback) === 0) {
                $latestFallback = extractLatestChangesBlock($content);
                if (count($latestFallback) > 0) {
                    $latestFallback['manifestPath'] = $manifestPath;
                }
            }
        }

        if ($allowFallback && count($latestFallback) > 0 && count($latestFallback['lines'] ?? []) > 0) {
            $latestLines = filterBoilerplateChangesLines((array)($latestFallback['lines'] ?? []));
            return [
                'version' => $requestedVersion,
                'sourceVersion' => (string)($latestFallback['sourceVersion'] ?? ''),
                'lines' => applyChangesLineLimit($latestLines, $maxLines),
                'usedFallback' => true,
                'manifestPath' => (string)($latestFallback['manifestPath'] ?? '')
            ];
        }

        return [
            'version' => $requestedVersion,
            'sourceVersion' => '',
            'lines' => [],
            'usedFallback' => false,
            'manifestPath' => ''
        ];
    }

    function readReleaseNoteCategoryContract(): array {
        static $contract = null;
        if (is_array($contract)) {
            return $contract;
        }

        $contract = [
            'schemaVersion' => 1,
            'categories' => []
        ];
        $contractPath = dirname(__DIR__) . '/release-note-categories.json';
        $decoded = readJsonObjectFile($contractPath);
        if (!is_array($decoded) || !is_array($decoded['categories'] ?? null)) {
            return $contract;
        }

        $allowedSummaryCategories = ['feature', 'bugfix', 'security', 'performance', 'ui', 'maintenance'];
        $seen = [];
        foreach ($decoded['categories'] as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $tag = trim((string)($entry['tag'] ?? ''));
            $summaryCategory = strtolower(trim((string)($entry['summaryCategory'] ?? '')));
            $tagKey = strtolower($tag);
            if (
                $tag === ''
                || !preg_match('/^[A-Za-z][A-Za-z0-9 \/-]{0,39}$/', $tag)
                || isset($seen[$tagKey])
                || !in_array($summaryCategory, $allowedSummaryCategories, true)
            ) {
                continue;
            }
            $seen[$tagKey] = true;
            $contract['categories'][] = [
                'tag' => $tag,
                'summaryCategory' => $summaryCategory
            ];
        }
        $contract['schemaVersion'] = max(1, (int)($decoded['schemaVersion'] ?? 1));
        return $contract;
    }

    function releaseNoteCategoryTags(): array {
        return array_values(array_map(static function (array $entry): string {
            return (string)($entry['tag'] ?? '');
        }, (array)(readReleaseNoteCategoryContract()['categories'] ?? [])));
    }

    function releaseNoteCategorySummaryMap(): array {
        $map = [];
        foreach ((array)(readReleaseNoteCategoryContract()['categories'] ?? []) as $entry) {
            $tag = strtolower(trim((string)($entry['tag'] ?? '')));
            $summaryCategory = strtolower(trim((string)($entry['summaryCategory'] ?? '')));
            if ($tag !== '' && $summaryCategory !== '') {
                $map[$tag] = $summaryCategory;
            }
        }
        return $map;
    }

    function classifyChangesCategory(array $lines): array {
        $text = strtolower(implode("\n", array_map(static function ($line): string {
            return trim((string)$line);
        }, $lines)));
        if (trim($text) === '') {
            return [
                'id' => 'bugfix',
                'label' => 'Bug Fix Update'
            ];
        }

        $scores = [
            'feature' => 0,
            'bugfix' => 0,
            'security' => 0,
            'performance' => 0,
            'ui' => 0,
            'maintenance' => 0
        ];
        $keywords = [
            'feature' => ['add', 'added', 'new', 'introduce', 'enhancement', 'support', 'wizard', 'module', 'column'],
            'bugfix' => ['fix', 'fixed', 'bug', 'regression', 'resolve', 'issue', 'broken', 'correct'],
            'security' => ['security', 'harden', 'token', 'guard', 'sanitize', 'xss', 'csrf', 'permission', 'auth'],
            'performance' => ['performance', 'optimiz', 'faster', 'cache', 'latency', 'speed', 'efficient'],
            'ui' => ['ui', 'ux', 'layout', 'style', 'responsive', 'mobile', 'visual', 'usability', 'alignment'],
            'maintenance' => ['maintenance', 'release', 'metadata', 'packaging', 'sync', 'build', 'ci', 'test', 'docs', 'documentation', 'cleanup', 'refactor', 'lint', 'guardrail', 'quality']
        ];

        $tagSummaryMap = releaseNoteCategorySummaryMap();
        foreach ($lines as $line) {
            $trimmed = ltrim(trim((string)$line), '-* ');
            $separator = strpos($trimmed, ':');
            if ($separator === false) {
                continue;
            }
            $tagKey = strtolower(trim(substr($trimmed, 0, $separator)));
            $summaryCategory = (string)($tagSummaryMap[$tagKey] ?? '');
            if ($summaryCategory !== '' && array_key_exists($summaryCategory, $scores)) {
                $scores[$summaryCategory] += 3;
            }
        }

        foreach ($keywords as $category => $terms) {
            $score = 0;
            foreach ($terms as $term) {
                if (strpos($text, $term) !== false) {
                    $score += 1;
                }
            }
            $scores[$category] += $score;
        }

        arsort($scores);
        $orderedCategories = array_keys($scores);
        $topCategory = (string)($orderedCategories[0] ?? 'bugfix');
        $topScore = (int)($scores[$topCategory] ?? 0);
        $secondCategory = (string)($orderedCategories[1] ?? '');
        $secondScore = (int)($scores[$secondCategory] ?? 0);

        if ($topScore > 0 && $secondScore > 0 && abs($topScore - $secondScore) <= 1) {
            return [
                'id' => 'mixed',
                'label' => 'Mixed Update'
            ];
        }

        if ($topScore <= 0) {
            $topCategory = 'bugfix';
        }

        $labels = [
            'feature' => 'Feature Update',
            'bugfix' => 'Bug Fix Update',
            'security' => 'Security Update',
            'performance' => 'Performance Update',
            'ui' => 'UI/UX Update',
            'maintenance' => 'Maintenance Update',
            'mixed' => 'Mixed Update'
        ];
        return [
            'id' => $topCategory,
            'label' => (string)$labels[$topCategory]
        ];
    }

    function stripChangesLineDecoration(string $line): string {
        $cleaned = trim($line);
        $cleaned = preg_replace('/^#{1,6}\s+/', '', $cleaned);
        $categoryTags = releaseNoteCategoryTags();
        if (count($categoryTags) > 0) {
            $escapedTags = array_map(static function (string $tag): string {
                return preg_quote($tag, '/');
            }, $categoryTags);
            $cleaned = preg_replace('/^(?:' . implode('|', $escapedTags) . '):\s*/i', '', (string)$cleaned);
        }
        return trim((string)$cleaned);
    }

    function buildChangesHeadline(array $lines, string $version = ''): string {
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if (preg_match('/^#{1,6}\s+\S/', $trimmed)) {
                $heading = stripChangesLineDecoration($trimmed);
                if ($heading !== '') {
                    return $heading;
                }
            }
        }

        $fallbackLines = [];
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '' || $trimmed === '...') {
                continue;
            }
            $cleaned = stripChangesLineDecoration($trimmed);
            if ($cleaned === '') {
                continue;
            }
            $fallbackLines[] = $cleaned;
            if (!preg_match('/^(?:Quality|Test|Maintenance):\s*/i', $trimmed)) {
                return $cleaned;
            }
        }

        if (count($fallbackLines) > 0) {
            return (string)$fallbackLines[0];
        }

        $safeVersion = trim($version);
        return $safeVersion !== ''
            ? "Release notes are unavailable for FolderView Plus {$safeVersion}."
            : 'Release notes are unavailable for this installed version.';
    }

    function filterChangesDetailLines(array $lines): array {
        $details = [];
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '' || preg_match('/^#{1,6}\s+\S/', $trimmed)) {
                continue;
            }
            $details[] = $trimmed;
        }
        return $details;
    }

    function readCurrentVersionChangeSummary(int $maxLines = 14): array {
        $summary = readChangesSummaryForVersion(readInstalledVersion(), $maxLines, false);
        $releaseLines = (array)($summary['lines'] ?? []);
        $category = classifyChangesCategory($releaseLines);
        $summary['category'] = (string)($category['id'] ?? 'bugfix');
        $summary['categoryLabel'] = (string)($category['label'] ?? 'Bug Fix Update');
        $summary['headline'] = buildChangesHeadline($releaseLines, (string)($summary['version'] ?? ''));
        $summary['lines'] = filterChangesDetailLines($releaseLines);
        return $summary;
    }
