<?php
require_once __DIR__ . '/lib.input-security.php';
const FVPLUS_WEBUI_PROFILE_MAX_PROFILES = 100;
const FVPLUS_WEBUI_PROFILE_MAX_MEMBERS = 250;
const FVPLUS_WEBUI_PROFILE_MAX_NAME_BYTES = 80;
const FVPLUS_WEBUI_PROFILE_MAX_MEMBER_BYTES = 160;

function fvplusWebuiProfileCleanString($value, int $maxBytes = PHP_INT_MAX): string {
    $clean = preg_replace('/[\x00-\x1F\x7F]/u', '', (string)$value);
    $trimmed = trim(is_string($clean) ? $clean : '');
    return truncateUtf8String($trimmed, $maxBytes);
}

function fvplusAssertWebuiProfileLimits(array $settings): void {
    $profiles = $settings['webui_profiles'] ?? $settings['webuiProfiles'] ?? [];
    if (!is_array($profiles)) return;
    foreach ($profiles as $profile) {
        if (!is_array($profile)) continue;
        $name = $profile['name'] ?? '';
        if (is_scalar($name) && strlen(fvplusWebuiProfileCleanString($name)) > FVPLUS_WEBUI_PROFILE_MAX_NAME_BYTES) {
            throw new InvalidArgumentException('Invalid folder payload.');
        }
        $members = $profile['containers'] ?? $profile['members'] ?? [];
        if (!is_array($members)) continue;
        $distinct = [];
        foreach ($members as $member) {
            if (!is_scalar($member)) continue;
            $name = fvplusWebuiProfileCleanString($member, FVPLUS_WEBUI_PROFILE_MAX_MEMBER_BYTES);
            if ($name === '') continue;
            $distinct[$name] = true;
            if (count($distinct) > FVPLUS_WEBUI_PROFILE_MAX_MEMBERS) throw new InvalidArgumentException('Invalid folder payload.');
        }
    }
}
