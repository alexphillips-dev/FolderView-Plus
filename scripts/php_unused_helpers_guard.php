<?php
declare(strict_types=1);

$rootDir = realpath(__DIR__ . '/..');
if ($rootDir === false) {
    fwrite(STDERR, "ERROR: Could not resolve repo root.\n");
    exit(1);
}

$pluginDir = $rootDir . '/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
$baselinePath = $rootDir . '/scripts/php_unused_helpers_baseline.json';
$maxPrint = 40;
$arguments = array_slice($argv, 1);
$writeBaseline = in_array('--write-baseline', $arguments, true);
$strictMode = in_array('--strict', $arguments, true) || preg_match('/^(1|true|yes|on)$/i', (string)(getenv('FVPLUS_PHP_UNUSED_STRICT') ?: '')) === 1;

function failPhpUnusedGuard(string $message, string $details = ''): void
{
    fwrite(STDERR, "ERROR: {$message}\n");
    if ($details !== '') {
        fwrite(STDERR, rtrim($details) . "\n");
    }
    exit(1);
}

function normalizeRelativePhpPath(string $rootDir, string $absolutePath): string
{
    $relative = ltrim(str_replace($rootDir, '', $absolutePath), "\\/");
    return str_replace('\\', '/', $relative);
}

function comparePhpFinding(array $left, array $right): int
{
    return strcmp($left['file'], $right['file'])
        ?: strcmp($left['symbol'], $right['symbol'])
        ?: ($left['line'] <=> $right['line']);
}

function nextSignificantPhpTokenIndex(array $tokens, int $index): ?int
{
    $count = count($tokens);
    for ($cursor = $index + 1; $cursor < $count; $cursor++) {
        $token = $tokens[$cursor];
        if (is_array($token)) {
            if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            return $cursor;
        }
        if (trim((string)$token) === '') {
            continue;
        }
        return $cursor;
    }
    return null;
}

function previousSignificantPhpTokenIndex(array $tokens, int $index): ?int
{
    for ($cursor = $index - 1; $cursor >= 0; $cursor--) {
        $token = $tokens[$cursor];
        if (is_array($token)) {
            if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            return $cursor;
        }
        if (trim((string)$token) === '') {
            continue;
        }
        return $cursor;
    }
    return null;
}

function tokenText($token): string
{
    return is_array($token) ? $token[1] : (string)$token;
}

function tokenId($token): ?int
{
    return is_array($token) ? $token[0] : null;
}

function collectPhpFiles(string $pluginDir): array
{
    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($pluginDir, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $entry) {
        if (!$entry->isFile()) {
            continue;
        }
        $extension = strtolower($entry->getExtension());
        if ($extension !== 'php' && $extension !== 'page') {
            continue;
        }
        $files[] = $entry->getPathname();
    }
    sort($files, SORT_STRING);
    return $files;
}

function collectPhpDeclarationsAndCalls(string $rootDir, array $files): array
{
    $declarations = [];
    $calls = [];

    foreach ($files as $absolutePath) {
        $relativePath = normalizeRelativePhpPath($rootDir, $absolutePath);
        $source = file_get_contents($absolutePath);
        if ($source === false) {
            failPhpUnusedGuard("Could not read PHP source: {$relativePath}");
        }

        try {
            $tokens = token_get_all($source, TOKEN_PARSE);
        } catch (ParseError $error) {
            failPhpUnusedGuard("PHP tokenizer could not parse {$relativePath}.", $error->getMessage());
        }

        $count = count($tokens);
        for ($index = 0; $index < $count; $index++) {
            $token = $tokens[$index];
            if (!is_array($token)) {
                continue;
            }

            if ($token[0] === T_FUNCTION) {
                $nameIndex = nextSignificantPhpTokenIndex($tokens, $index);
                if ($nameIndex === null) {
                    continue;
                }
                $nameToken = $tokens[$nameIndex];
                if ($nameToken === '&') {
                    $nameIndex = nextSignificantPhpTokenIndex($tokens, $nameIndex);
                    if ($nameIndex === null) {
                        continue;
                    }
                    $nameToken = $tokens[$nameIndex];
                }
                if (is_array($nameToken) && $nameToken[0] === T_STRING) {
                    $name = strtolower($nameToken[1]);
                    if (!isset($declarations[$name])) {
                        $declarations[$name] = [
                            'file' => $relativePath,
                            'symbol' => $nameToken[1],
                            'line' => (int)$nameToken[2]
                        ];
                    }
                }
                continue;
            }

            if ($token[0] !== T_STRING) {
                continue;
            }

            $nextIndex = nextSignificantPhpTokenIndex($tokens, $index);
            if ($nextIndex === null || tokenText($tokens[$nextIndex]) !== '(') {
                continue;
            }

            $previousIndex = previousSignificantPhpTokenIndex($tokens, $index);
            if ($previousIndex !== null) {
                $previousToken = $tokens[$previousIndex];
                $previousId = tokenId($previousToken);
                $previousText = tokenText($previousToken);
                if (in_array($previousId, [T_FUNCTION, T_NEW, T_OBJECT_OPERATOR, T_DOUBLE_COLON, defined('T_NULLSAFE_OBJECT_OPERATOR') ? T_NULLSAFE_OBJECT_OPERATOR : -1], true)) {
                    continue;
                }
                if (in_array($previousText, ['->', '::'], true)) {
                    continue;
                }
            }

            $calls[] = [
                'name' => strtolower($token[1]),
                'file' => $relativePath,
                'line' => (int)$token[2]
            ];
        }
    }

    return [$declarations, $calls];
}

function dedupePhpFindings(array $findings): array
{
    $byKey = [];
    foreach ($findings as $finding) {
        $key = $finding['file'] . '::' . $finding['symbol'];
        if (!isset($byKey[$key]) || comparePhpFinding($finding, $byKey[$key]) < 0) {
            $byKey[$key] = $finding;
        }
    }
    $deduped = array_values($byKey);
    usort($deduped, 'comparePhpFinding');
    return $deduped;
}

function readPhpBaseline(string $baselinePath): array
{
    if (!is_file($baselinePath)) {
        return ['version' => 1, 'findings' => []];
    }
    $raw = file_get_contents($baselinePath);
    if ($raw === false) {
        failPhpUnusedGuard("Could not read PHP unused-helper baseline: {$baselinePath}");
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed) || ($parsed['version'] ?? null) !== 1 || !is_array($parsed['findings'] ?? null)) {
        failPhpUnusedGuard("Invalid PHP unused-helper baseline: {$baselinePath}");
    }
    return $parsed;
}

function writePhpBaseline(string $baselinePath, array $findings): void
{
    $payload = [
        'version' => 1,
        'scope' => 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/**/*.{php,page}',
        'generatedAt' => gmdate('c'),
        'findings' => $findings
    ];
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        failPhpUnusedGuard('Could not encode PHP unused-helper baseline JSON.');
    }
    file_put_contents($baselinePath, $json . "\n");
}

$files = collectPhpFiles($pluginDir);
[$declarations, $calls] = collectPhpDeclarationsAndCalls($rootDir, $files);

$usedNames = [];
foreach ($calls as $call) {
    $usedNames[$call['name']] = true;
}

$findings = [];
foreach ($declarations as $normalizedName => $declaration) {
    if (isset($usedNames[$normalizedName])) {
        continue;
    }
    $findings[] = $declaration;
}
$findings = dedupePhpFindings($findings);

if ($writeBaseline) {
    writePhpBaseline($baselinePath, $findings);
    $relativeBaselinePath = normalizeRelativePhpPath($rootDir, $baselinePath);
    fwrite(STDOUT, "Wrote PHP unused-helper baseline with " . count($findings) . " finding(s): {$relativeBaselinePath}\n");
    exit(0);
}

if ($strictMode && count($findings) > 0) {
    $lines = array_map(
        static fn(array $item): string => " - {$item['file']}:{$item['line']} {$item['symbol']}",
        array_slice($findings, 0, $maxPrint)
    );
    failPhpUnusedGuard(
        'PHP unused-helper guard failed in strict mode with ' . count($findings) . ' finding(s).',
        implode("\n", $lines)
    );
}

$baseline = readPhpBaseline($baselinePath);
$baselineMap = [];
foreach ($baseline['findings'] as $item) {
    $baselineMap[$item['file'] . '::' . $item['symbol']] = $item;
}
$currentMap = [];
foreach ($findings as $item) {
    $currentMap[$item['file'] . '::' . $item['symbol']] = $item;
}

$unexpected = array_values(array_filter(
    $findings,
    static fn(array $item): bool => !isset($baselineMap[$item['file'] . '::' . $item['symbol']])
));
$resolved = array_values(array_filter(
    $baseline['findings'],
    static fn(array $item): bool => !isset($currentMap[$item['file'] . '::' . $item['symbol']])
));

if (count($unexpected) > 0) {
    $lines = array_map(
        static fn(array $item): string => " - {$item['file']}:{$item['line']} {$item['symbol']}",
        array_slice($unexpected, 0, $maxPrint)
    );
    failPhpUnusedGuard(
        'PHP unused-helper guard found ' . count($unexpected) . ' new finding(s) beyond the baseline.',
        implode("\n", $lines)
    );
}

if (count($findings) === 0) {
    fwrite(STDOUT, "PHP unused-helper guard passed: no unused global PHP helpers detected.\n");
    exit(0);
}

$relativeBaselinePath = normalizeRelativePhpPath($rootDir, $baselinePath);
fwrite(STDOUT, 'PHP unused-helper guard passed: ' . count($findings) . " baseline finding(s), 0 regressions.\n");
if (count($resolved) > 0) {
    fwrite(STDOUT, 'INFO: ' . count($resolved) . " baseline finding(s) are gone; refresh {$relativeBaselinePath} when convenient.\n");
}
