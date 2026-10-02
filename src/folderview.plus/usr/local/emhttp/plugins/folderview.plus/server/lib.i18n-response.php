<?php
// Keep original error details and status fields intact for support diagnostics.
function fvplus_attach_response_translations(array $payload, array $messageKeys): array {
    foreach (['error', 'message'] as $field) {
        if (!isset($payload[$field]) || !is_string($payload[$field])) continue;
        if (isset($messageKeys[$payload[$field]])) {
            $payload[$field . 'Key'] = $messageKeys[$payload[$field]];
            continue;
        }
        foreach ($messageKeys as $message => $key) {
            // Only reviewed trailing-detail templates can carry dynamic data.
            if (substr($message, -2) !== '$1' || substr_count($message, '$') !== 1) continue;
            $prefix = substr($message, 0, -2);
            if ($prefix !== '' && strpos($payload[$field], $prefix) === 0) {
                $payload[$field . 'Key'] = $key;
                $payload[$field . 'Params'] = [substr($payload[$field], strlen($prefix))];
                break;
            }
        }
    }
    return $payload;
}
