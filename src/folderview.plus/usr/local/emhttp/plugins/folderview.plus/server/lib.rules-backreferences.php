<?php
function fvplusRuleUsesLegacyRegex(array $rule): bool {
    return ($rule['kind'] ?? 'name_regex') === 'name_regex' && ($rule['regexMode'] ?? '') === 'legacy';
}
function fvplusTranslateRuleBackreferences(string $pattern, bool $legacy = false): string {
    // Match JavaScript's empty unset captures while preserving fixed lookbehind width.
    if (!preg_match('/\\\\(?:[1-9]|k<)/', $pattern)) return $pattern;
    $tokens = '/\\\\(?:[1-9][0-9]*|k<[A-Za-z_][A-Za-z_0-9]*>|.)|\(\?<[=!]|\(\?<([A-Za-z_][A-Za-z_0-9]*)>|\(\?[:=!]|\(|\)|\[|\]/s';
    $captureCount = 0; $inClass = false;
    if ($legacy) {
        preg_match_all($tokens, $pattern, $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $token = $match[0];
            if ($token === '[' || $token === ']') $inClass = $token === '[';
            if (!$inClass && ($token === '(' || isset($match[1]))) $captureCount++;
        }
    }
    $inClass = false; $depth = 0; $lookbehinds = [];
    return preg_replace_callback($tokens,
        static function (array $match) use (&$inClass, &$depth, &$lookbehinds, $legacy, $captureCount): string {
            $token = $match[0];
            if ($token === '[' || $token === ']') {
                $inClass = $token === '[';
            } elseif ($inClass) {
                return $token;
            } elseif ($token[0] === '(') {
                ++$depth;
                if ($token === '(?<=' || $token === '(?<!') $lookbehinds[$depth] = true;
            } elseif ($token === ')') {
                unset($lookbehinds[$depth--]);
            } elseif (!$lookbehinds && strlen($token) >= 2) {
                if ($token[1] >= '1' && $token[1] <= '9') {
                    $group = substr($token, 1);
                    if ($legacy && (int)$group > $captureCount) return $token; // Legacy octal escape.
                    return '(?(' . $group . ')\\g{' . $group . '}|)';
                }
                if (str_starts_with($token, '\\k<')) {
                    $group = substr($token, 3, -1);
                    return "(?(<$group>)\\k<$group>|)";
                }
            }
            return $token;
        }, $pattern) ?? $pattern;
}
