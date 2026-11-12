<?php
function fvplusThemeWorkspaceScanCss(string $css): array {
    // Scan the browser-visible escape spelling without changing the saved CSS.
    $scanCss = preg_replace_callback('/\\\\(?:([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|(\r\n|[\r\n\f])|(.))/is', static function ($match) {
        if (($match[1] ?? '') !== '') {
            $codepoint = hexdec($match[1]);
            return $codepoint > 0 && $codepoint < 128 ? chr($codepoint) : "\xEF\xBF\xBD";
        }
        return $match[3] ?? '';
    }, $css);
    $severe = [];
    $rules = [
        ['pattern' => '/expression\s*\(/i', 'message' => 'CSS contains expression().'],
        ['pattern' => '/javascript\s*:/i', 'message' => 'CSS contains javascript: URLs.'],
        ['pattern' => '/behavior\s*:/i', 'message' => 'CSS contains behavior: rules.'],
        ['pattern' => '/-moz-binding\s*:/i', 'message' => 'CSS contains legacy executable binding rules.'],
        ['pattern' => '/@import\b/i', 'message' => 'CSS contains @import, which is not permitted in managed themes.'],
        ['pattern' => '/url\s*\(\s*["\']?(?:https?:)?\/\//i', 'message' => 'CSS contains an external network URL.'],
        ['pattern' => '/url\s*\(\s*["\']?data:text\/html/i', 'message' => 'CSS contains a data:text/html URL.']
    ];
    foreach ($rules as $rule) {
        if (preg_match($rule['pattern'], $scanCss)) {
            $severe[] = $rule['message'];
        }
    }
    return [
        'warnings' => [],
        'severe' => array_values(array_unique($severe))
    ];
}
