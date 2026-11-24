<?php
// Preserve the browser/PCRE intersection. Lookbehind can change the order
// captures are set. PCRE retains captures from earlier repetitions.
function fvplusRegexBackreferencesArePortable(string $pattern): bool {
    if (!preg_match('/\\\\(?:[1-9]|k<)/', $pattern)) return true;
    preg_match_all('/\\\\(?:[1-9][0-9]*|k<[A-Za-z_$][A-Za-z0-9_$]*>|.)|\(\?<[=!]|\(\?<([A-Za-z_$][A-Za-z0-9_$]*)>|\(\?[:=!]|\(|\[|\]|\)(?:[*+]|\{[0-9]+(?:,[0-9]*)?\})?/s',
        $pattern, $matches, PREG_SET_ORDER);
    $stack = []; $captures = []; $repeated = []; $references = [];
    $inClass = false;
    foreach ($matches as [$token]) {
        if ($token === '[') { $inClass = true; continue; }
        if ($token === ']') { $inClass = false; continue; }
        if ($inClass) continue;
        if ($token[0] === '(') {
            $name = preg_match('/^\(\?<([A-Za-z_$][A-Za-z0-9_$]*)>$/D', $token, $capture) ? $capture[1] : null;
            if ($token === '(' || $name !== null) $captures[] = $name;
            $stack[] = ['start' => count($captures), 'lookbehind' => $token === '(?<=' || $token === '(?<!' || (end($stack)['lookbehind'] ?? false)];
        } elseif ($token[0] === ')') {
            $group = array_pop($stack);
            $limit = explode(',', substr($token, 2, -1));
            if ($group && (preg_match('/^\)[*+]/', $token) || ($limit[1] ?? null) === '' || (int)end($limit) > 1)) {
                $repeated[] = [$group['start'], count($captures)];
            }
        } elseif (preg_match('/^\\\\(?:[1-9]|k<)/', $token)) {
            if (end($stack)['lookbehind'] ?? false) return false;
            $references[] = str_starts_with($token, '\\k<') ? substr($token, 3, -1) : (int)substr($token, 1) - 1;
        }
    }
    foreach ($references as $reference) {
        $index = is_string($reference) ? array_search($reference, $captures, true) : $reference;
        if ($index === false) continue;
        foreach ($repeated as [$start, $end]) {
            if ($index >= $start && $index < $end) return false;
        }
    }
    return true;
}
