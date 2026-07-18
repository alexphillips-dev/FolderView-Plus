<?php
    require_once('/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
    require_once('/usr/local/emhttp/plugins/folderview.plus/langs/registry.php');

    $requestedLocale = fvplus_i18n_normalize_locale((string)($_SESSION['locale'] ?? 'en'));
    $localeResolution = fvplus_i18n_resolve_locale($requestedLocale);
    $resolvedLocale = (string)($localeResolution['resolved'] ?? 'en');
    $requestedNamespaces = isset($fvplusI18nNamespaces) && is_array($fvplusI18nNamespaces)
        ? $fvplusI18nNamespaces
        : ['common'];
    $requestedNamespaces = array_values(array_unique(array_filter(array_map(static function ($namespace): string {
        $safe = strtolower(trim((string)$namespace));
        return preg_match('/^[a-z][a-z0-9-]*$/', $safe) ? $safe : '';
    }, $requestedNamespaces))));
    if (!in_array('common', $requestedNamespaces, true)) {
        array_unshift($requestedNamespaces, 'common');
    }

    $localeAssets = [[
        'locale' => 'en',
        'namespace' => 'legacy',
        'url' => fvplus_versioned_plugin_asset_path('/plugins/folderview.plus/langs/en.json')
    ]];
    foreach ($requestedNamespaces as $namespace) {
        $namespacePath = "/plugins/folderview.plus/langs/namespaces/en/$namespace.json";
        $namespaceSourcePath = "/usr/local/emhttp/plugins/folderview.plus/langs/namespaces/en/$namespace.json";
        if (is_file($namespaceSourcePath) && fvplus_i18n_catalog_file_has_messages($namespaceSourcePath)) {
            $localeAssets[] = [
                'locale' => 'en',
                'namespace' => $namespace,
                'url' => fvplus_versioned_plugin_asset_path($namespacePath)
            ];
        }
    }
    if ($resolvedLocale !== 'en') {
        $localeAssets[] = [
            'locale' => $resolvedLocale,
            'namespace' => 'legacy',
            'url' => fvplus_versioned_plugin_asset_path("/plugins/folderview.plus/langs/$resolvedLocale.json")
        ];
        foreach ($requestedNamespaces as $namespace) {
            $namespaceSourcePath = "/usr/local/emhttp/plugins/folderview.plus/langs/namespaces/$resolvedLocale/$namespace.json";
            if (is_file($namespaceSourcePath) && fvplus_i18n_catalog_file_has_messages($namespaceSourcePath)) {
                $localeAssets[] = [
                    'locale' => $resolvedLocale,
                    'namespace' => $namespace,
                    'url' => fvplus_versioned_plugin_asset_path("/plugins/folderview.plus/langs/namespaces/$resolvedLocale/$namespace.json")
                ];
            }
        }
    }
    $catalogReport = in_array('diagnostics', $requestedNamespaces, true)
        ? fvplus_i18n_catalog_report()
        : fvplus_i18n_catalog_report(['en', $requestedLocale, $resolvedLocale]);
    $i18nBootstrap = [
        'requestedLocale' => $requestedLocale,
        'resolvedLocale' => $resolvedLocale,
        'fallbackChain' => $localeResolution['fallbackChain'] ?? [$requestedLocale, 'en'],
        'direction' => $localeResolution['direction'] ?? 'ltr',
        'catalogVersion' => FVPLUS_I18N_CATALOG_VERSION,
        'catalogReport' => $catalogReport,
        'namespaces' => $requestedNamespaces,
        'registry' => fvplus_i18n_public_registry($catalogReport),
        'assets' => $localeAssets
    ];
?>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/CLDRPluralRuleParser.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.messagestore.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.fallbacks.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.language.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.parser.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/include/jquery.i18n.emitter.bidi.js')?>"></script>
<script src="<?php fvplus_asset('/plugins/folderview.plus/scripts/folderviewplus.i18n.js')?>"></script>
<script>
    if(typeof folderi18n === 'undefined' ) {
        folderi18n = () => {};
    }
    window.FolderViewPlusI18n.configure(<?php echo json_encode($i18nBootstrap, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>).catch((error) => {
        console.warn('[FolderView Plus] Localization initialization failed; English fallback remains active.', error);
    });
</script>
