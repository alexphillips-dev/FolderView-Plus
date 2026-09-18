<?php
// Add stable UI message keys without changing diagnostic text or response status.
function fvplus_localize_response_keys(array $payload): array {
    static $messageKeys = null;
    if ($messageKeys === null) {
        $messageKeys = [];
        $file = __DIR__ . '/../langs/namespaces/en/common.json';
        $catalog = is_file($file) ? json_decode((string)file_get_contents($file), true) : [];
        foreach (is_array($catalog) ? $catalog : [] as $key => $value) {
            if (strpos($key, 'common.server.') === 0 && is_string($value)) {
                $messageKeys[$value] = $key;
            }
        }
    }
    foreach (['error', 'message'] as $field) {
        if (isset($payload[$field]) && is_string($payload[$field]) && isset($messageKeys[$payload[$field]])) {
            $payload[$field . 'Key'] = $messageKeys[$payload[$field]];
        }
    }
    return $payload;
}
