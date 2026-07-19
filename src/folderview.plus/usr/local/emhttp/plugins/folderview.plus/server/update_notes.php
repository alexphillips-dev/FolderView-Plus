<?php
require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");

fvplus_json_try(function (): array {
    $summary = readCurrentVersionChangeSummary(18);
    return [
        'version' => (string)($summary['version'] ?? readInstalledVersion()),
        'sourceVersion' => (string)($summary['sourceVersion'] ?? ''),
        'usedFallback' => (($summary['usedFallback'] ?? false) === true),
        'category' => (string)($summary['category'] ?? 'bugfix'),
        'categoryLabel' => (string)($summary['categoryLabel'] ?? 'Bug Fix Update'),
        'categoryTags' => releaseNoteCategoryTags(),
        'headline' => (string)($summary['headline'] ?? ''),
        'lines' => (array)($summary['lines'] ?? [])
    ];
});
