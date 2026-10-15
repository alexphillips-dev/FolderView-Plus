<?php
function fvplusFolderView3ValidateCssSize(string $css): void {
    if (strlen($css) > FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES) {
        throw new RuntimeException('FolderView3 CSS exceeds the 64 KB appearance-layer limit. Split it into smaller profiles before importing.');
    }
}
function fvplusFolderView3PreserveAppearanceMetadata(array $profile, array $config, array &$warnings): array {
    $metadata = array_intersect_key($config, array_fill_keys(['preset', 'user_notes', 'toggle_style', 'page_presets', 'page_values'], true));
    if ($metadata !== []) {
        $encoded = json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($encoded) > 65536) throw new RuntimeException('FolderView3 appearance recovery metadata exceeds the 64 KB limit.');
        $profile['legacyMetadata'] = $encoded;
        $warnings[] = 'Legacy appearance notes, toggle preferences and preset assignments are retained as recovery metadata in the inactive profile. Unsupported UI preferences are not activated.';
    }
    return fvplusThemeProfileNormalize($profile);
}

function fvplusFolderView3PresetProfiles(array $bundle, array &$warnings): array {
    $profiles = [];
    foreach (($bundle['css_config']['custom_presets'] ?? []) as $preset) {
        $copy = $bundle;
        $copy['css_config'] = ['global' => $preset['values']];
        $profile = fvplusFolderView3BuildThemeProfile($copy, $warnings);
        $profile['id'] = 'folderview3-preset-' . substr(hash('sha256', json_encode($preset, JSON_THROW_ON_ERROR)), 0, 16);
        $profile['name'] = $preset['name'];
        $profiles[] = $profile;
    }
    return $profiles;
}
