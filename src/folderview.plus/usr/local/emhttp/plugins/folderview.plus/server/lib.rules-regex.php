<?php
require_once __DIR__ . '/lib.rules-backreferences.php';
// Shift legacy UTF-16 units past the surrogate gap while preserving character-class order.
function fvplusLegacyRegexCodeUnits(string $value): string {
    return preg_replace_callback('/[\x{e000}-\x{10ffff}]/u', static function (array $match): string {
        $byte = unpack('C*', $match[0]);
        if ($byte === false) return $match[0];
        if (count($byte) === 3) {
            $point = (($byte[1] & 15) << 12) | (($byte[2] & 63) << 6) | ($byte[3] & 63);
            return html_entity_decode('&#' . ($point + 0x800) . ';', ENT_HTML5, 'UTF-8');
        }
        $point = ((($byte[1] & 7) << 18) | (($byte[2] & 63) << 12) | (($byte[3] & 63) << 6) | ($byte[4] & 63)) - 0x10000;
        return html_entity_decode('&#' . (0xe000 + ($point >> 10)) . ';&#' . (0xe400 + ($point & 1023)) . ';', ENT_HTML5, 'UTF-8');
    }, $value) ?? $value;
}

function serverRuleRegex(string $pattern, bool $unicode = true): string {
    if ($unicode) $pattern = fvplusTranslateRuleBackreferences($pattern);
    $whitespace = '\x{9}-\x{d}\x{20}\x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}';
    $nonWhitespace = '\x{0}-\x{8}\x{e}-\x{1f}\x{21}-\x{9f}\x{a1}-\x{167f}\x{1681}-\x{1fff}'
        . '\x{200b}-\x{2027}\x{202a}-\x{202e}\x{2030}-\x{205e}\x{2060}-\x{2fff}\x{3001}-\x{fefe}\x{ff00}-\x{10ffff}';
    if (!$unicode) {
        $pattern = fvplusLegacyRegexCodeUnits($pattern);
        $whitespace = str_replace('\x{feff}', '\x{106ff}', $whitespace);
        $nonWhitespace = str_replace(['\x{fefe}', '\x{ff00}'], ['\x{106fe}', '\x{10700}'], $nonWhitespace);
    }
    $translated = '';
    $inClass = false;
    for ($index = 0, $length = strlen($pattern); $index < $length; $index++) {
        $char = $pattern[$index];
        if ($char === '\\' && $index + 1 < $length) {
            $escape = $pattern[$index + 1];
            if ($escape === '\\') {
                $translated .= '\\\\'; $index++; continue;
            }
            if ($unicode && $escape === 'u' && preg_match('/\A\\\\u\{([a-fA-F0-9]{1,6})\}/', substr($pattern, $index), $match)) {
                $translated .= '\\x{' . $match[1] . '}'; $index += strlen($match[0]) - 1; continue;
            }
            if ($escape === 'u' && preg_match('/\A\\\\u([a-fA-F0-9]{4})/', substr($pattern, $index), $match)) {
                $point = hexdec($match[1]); $index += 5;
                if (!$unicode && $point >= 0xd800) {
                    $point += 0x800;
                } elseif ($point >= 0xd800 && $point <= 0xdbff && preg_match('/\A\\\\u([dD][c-fC-F][a-fA-F0-9]{2})/', substr($pattern, $index + 1), $low)) {
                    $point = 0x10000 + (($point - 0xd800) << 10) + hexdec($low[1]) - 0xdc00; $index += 6;
                }
                $translated .= '\\x{' . dechex($point) . '}'; continue;
            }
            if ($escape === 'v') { $translated .= '\\x{b}'; $index++; continue; }
            if ($escape === 's' || $escape === 'S') {
                $set = $escape === 's' ? $whitespace : $nonWhitespace;
                $translated .= $inClass ? $set : '[' . $set . ']';
                $index++;
                continue;
            }
            if (!$unicode && ctype_alpha($escape) && !str_contains('bBcdDfnrtwWxk', $escape)) {
                $translated .= $escape; $index++; continue;
            }
            $translated .= $char . $pattern[++$index]; continue;
        }
        if ($char === '[' && !$inClass) {
            if (substr($pattern, $index, 3) === '[^]') {
                $translated .= '[\s\S]'; $index += 2; continue;
            }
            if (($pattern[$index + 1] ?? '') === ']') {
                $translated .= '(?:(?!))'; $index++; continue;
            }
            $inClass = true;
        } elseif ($char === ']' && $inClass) {
            $inClass = false;
        }
        if ($char === '.' && !$inClass) {
            $translated .= '[^\r\n\x{2028}\x{2029}]';
        } else {
            $translated .= $char === '~' ? '\~' : $char;
        }
    }
    // (*UTF) enables code points without PHP's /u modifier also enabling
    // Unicode shorthand classes. JavaScript \w, \d and \b use ASCII.
    return '~(*UTF)' . $translated . '~D';
}
function serverRegexMatches(string $pattern, string $input): bool {
    return $pattern !== '' && @preg_match(serverRuleRegex($pattern), $input) === 1;
}
