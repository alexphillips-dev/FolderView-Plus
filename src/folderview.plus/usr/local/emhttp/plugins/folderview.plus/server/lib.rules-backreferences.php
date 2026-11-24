<?php
function fvplusRuleUsesLegacyRegex(array $rule): bool {
    return ($rule['kind'] ?? 'name_regex') === 'name_regex' && ($rule['regexMode'] ?? '') === 'legacy';
}

function fvplusTranslateRuleBackreferences(string $pattern): string {
    // JavaScript matches unset captures as empty strings. Keep ordinary PCRE references
    // in lookbehind so they retain their original width on PHP's fixed-width engines.
    if (!preg_match('/\\\\(?:[1-9]|k<)/', $pattern)) return $pattern;
    $inClass = false;
    $depth = 0;
    $lookbehinds = [];
    return preg_replace_callback('/\\\\(?:[1-9][0-9]*|k<[A-Za-z_][A-Za-z_0-9]*>|.)|\(\?<[=!]|\(|\)|\[|\]/s',
        static function (array $match) use (&$inClass, &$depth, &$lookbehinds): string {
            $token = $match[0];
            if ($token === '[') {
                $inClass = true;
            } elseif ($token === ']') {
                $inClass = false;
            } elseif (!$inClass) {
                if ($token[0] === '(') {
                    ++$depth;
                    if (strlen($token) === 4) $lookbehinds[$depth] = true;
                } elseif ($token === ')') {
                    unset($lookbehinds[$depth]);
                    --$depth;
                } elseif (!$lookbehinds && strlen($token) >= 2) {
                    if ($token[1] >= '1' && $token[1] <= '9') {
                        $group = substr($token, 1);
                        return '(?(' . $group . ')\\g{' . $group . '}|)';
                    }
                    if (str_starts_with($token, '\\k<')) {
                        $group = substr($token, 3, -1);
                        return "(?(<$group>)\\k<$group>|)";
                    }
                }
            }
            return $token;
        }, $pattern) ?? $pattern;
}
