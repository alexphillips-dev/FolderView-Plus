<?php
function diagnosticsResolveSupportBundleChannel(): string {
        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $contents = (string)@file_get_contents($manifestPath);
            if ($contents === '') {
                continue;
            }
            if (preg_match('/<PLUGINURL>[^<]*\\/(dev|main)\\/folderview\\.plus\\.plg<\\/PLUGINURL>/i', $contents, $match)) {
                return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
            }
            if (preg_match('/<!ENTITY\\s+pluginURL\\s+"[^"]*\\/(dev|main)\\/folderview\\.plus\\.plg"\\s*>/i', $contents, $match)) {
                return strtolower((string)$match[1]) === 'dev' ? 'dev' : 'main';
            }
        }
        return 'main';
    }

    function diagnosticsReadSupportBundleBuildMetadata(): array {
        global $sourceDir;
        $metadataPath = rtrim((string)($sourceDir ?? ''), '/\\') . '/build-metadata.json';
        if ($metadataPath === '/build-metadata.json' || !is_file($metadataPath)) {
            return [];
        }
        $decoded = @json_decode((string)@file_get_contents($metadataPath), true);
        return is_array($decoded) ? $decoded : [];
    }

    function diagnosticsResolveSupportBundleManifestMetadata(): array {
        $manifestMetadata = [
            'manifestPath' => null,
            'manifestPathHash' => null,
            'manifestSha256' => null,
            'manifestMd5' => null,
            'manifestUrl' => null,
            'archiveUrl' => null,
            'iconAssetPackVersion' => null,
            'iconAssetPackSha256' => null,
            'iconAssetPackUrl' => null
        ];

        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $contents = (string)@file_get_contents($manifestPath);
            if ($contents === '') {
                continue;
            }
            $manifestMetadata['manifestPath'] = basename(str_replace('\\', '/', $manifestPath));
            $manifestMetadata['manifestPathHash'] = diagnosticsHashShort($manifestPath);
            $manifestMetadata['manifestSha256'] = @hash_file('sha256', $manifestPath) ?: null;
            $manifestEntities = [];
            if (preg_match('/<!ENTITY\s+md5\s+"([^"]+)"/i', $contents, $match)) {
                $manifestMetadata['manifestMd5'] = (string)($match[1] ?? '');
            }
            foreach (['name', 'version', 'github', 'pluginURL', 'iconPackVersion', 'iconPackSha256', 'iconPackURL'] as $entityKey) {
                if (preg_match('/<!ENTITY\s+' . preg_quote($entityKey, '/') . '\s+"([^"]+)"/i', $contents, $match)) {
                    $entityValue = html_entity_decode((string)($match[1] ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
                    if ($entityValue !== '') {
                        $manifestEntities[$entityKey] = $entityValue;
                    }
                }
            }
            if (preg_match('/<!ENTITY\s+github\s+"([^"]+)"/i', $contents, $match)) {
                $githubRepo = trim((string)($match[1] ?? ''));
                $manifestMetadata['githubRepository'] = $githubRepo !== '' ? $githubRepo : null;
            }
            if (preg_match('/<!ENTITY\s+pluginURL\s+"([^"]+)"/i', $contents, $match)) {
                $manifestMetadata['manifestUrl'] = html_entity_decode((string)($match[1] ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
            if (preg_match('/<URL>([^<]*\/archive\/[^<]*&version;\.txz)<\/URL>/i', $contents, $match)) {
                $manifestMetadata['archiveUrl'] = html_entity_decode((string)($match[1] ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
            $manifestMetadata['iconAssetPackVersion'] = trim((string)($manifestEntities['iconPackVersion'] ?? '')) ?: null;
            $manifestMetadata['iconAssetPackSha256'] = preg_match('/^[a-f0-9]{64}$/', (string)($manifestEntities['iconPackSha256'] ?? ''))
                ? (string)$manifestEntities['iconPackSha256']
                : null;
            $manifestMetadata['iconAssetPackUrl'] = trim((string)($manifestEntities['iconPackURL'] ?? '')) ?: null;
            if (!empty($manifestMetadata['githubRepository'])) {
                $githubEntity = (string)$manifestMetadata['githubRepository'];
                foreach (['manifestUrl', 'archiveUrl', 'iconAssetPackUrl'] as $urlKey) {
                    $urlValue = (string)($manifestMetadata[$urlKey] ?? '');
                    if ($urlValue !== '') {
                        $manifestMetadata[$urlKey] = str_replace('&github;', $githubEntity, $urlValue);
                    }
                }
            }
            if (!empty($manifestEntities)) {
                foreach (['manifestUrl', 'archiveUrl', 'iconAssetPackUrl'] as $urlKey) {
                    $urlValue = (string)($manifestMetadata[$urlKey] ?? '');
                    if ($urlValue === '') {
                        continue;
                    }
                    foreach ($manifestEntities as $entityKey => $entityValue) {
                        $urlValue = str_replace('&' . $entityKey . ';', (string)$entityValue, $urlValue);
                    }
                    $manifestMetadata[$urlKey] = $urlValue;
                }
            }
            break;
        }

        return $manifestMetadata;
    }

    function diagnosticsBuildSupportBundleBuildIdentitySection(array $diagnostics): array {
        $buildMetadata = diagnosticsReadSupportBundleBuildMetadata();
        $manifestMetadata = diagnosticsResolveSupportBundleManifestMetadata();
        $sourceCommitSha = trim((string)($buildMetadata['sourceCommitSha'] ?? ''));
        $headCommitSha = trim((string)($buildMetadata['headCommitSha'] ?? ''));
        $sourceTreeSha = trim((string)($buildMetadata['sourceTreeSha'] ?? ''));
        $sourceContentSha256 = trim((string)($buildMetadata['sourceContentSha256'] ?? ''));
        $sourceSnapshotMode = trim((string)($buildMetadata['sourceSnapshotMode'] ?? ''));
        $sourceCommitExact = array_key_exists('sourceCommitExact', $buildMetadata)
            ? filter_var($buildMetadata['sourceCommitExact'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;
        $sourceBranch = trim((string)($buildMetadata['sourceBranch'] ?? diagnosticsResolveSupportBundleChannel()));
        $buildManifestUrl = trim((string)($buildMetadata['manifestUrl'] ?? ''));
        $buildArchiveUrl = trim((string)($buildMetadata['archiveUrl'] ?? ''));
        $resolvedManifestUrl = trim((string)($manifestMetadata['manifestUrl'] ?? ''));
        $resolvedArchiveUrl = trim((string)($manifestMetadata['archiveUrl'] ?? ''));
        $manifestUrl = ($resolvedManifestUrl !== '' && strpos($resolvedManifestUrl, '&') === false)
            ? $resolvedManifestUrl
            : $buildManifestUrl;
        $archiveUrl = ($resolvedArchiveUrl !== '' && strpos($resolvedArchiveUrl, '&') === false)
            ? $resolvedArchiveUrl
            : $buildArchiveUrl;
        $sourceCommitIsExact = is_bool($sourceCommitExact) ? $sourceCommitExact : null;
        $buildBaseCommitSha = $sourceCommitIsExact === false && $headCommitSha !== '' ? $headCommitSha : null;
        $provenanceStatus = $sourceCommitIsExact === true
            ? 'exactCommit'
            : ($sourceSnapshotMode !== '' ? 'sourceSnapshot' : 'unknown');

        return [
            'pluginVersion' => (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'channel' => in_array($sourceBranch, ['dev', 'main'], true)
                ? $sourceBranch
                : diagnosticsResolveSupportBundleChannel(),
            'sourceBranch' => $sourceBranch !== '' ? $sourceBranch : null,
            'sourceCommitSha' => $sourceCommitSha !== '' ? $sourceCommitSha : null,
            'headCommitSha' => $headCommitSha !== '' ? $headCommitSha : null,
            'headCommitRole' => $sourceCommitIsExact === true
                ? 'sourceCommit'
                : ($sourceCommitIsExact === false ? 'buildBaseCommit' : 'unknown'),
            'buildBaseCommitSha' => $buildBaseCommitSha,
            'sourceTreeSha' => $sourceTreeSha !== '' ? $sourceTreeSha : null,
            'sourceContentSha256' => preg_match('/^[a-f0-9]{64}$/', $sourceContentSha256) ? $sourceContentSha256 : null,
            'sourceContentFingerprint' => preg_match('/^[a-f0-9]{64}$/', $sourceContentSha256)
                ? 'sha256:' . $sourceContentSha256
                : ($sourceTreeSha !== '' ? 'git-tree:' . $sourceTreeSha : null),
            'sourceSnapshotMode' => in_array($sourceSnapshotMode, ['content', 'head', 'index', 'worktree', 'fast-worktree', 'unknown'], true)
                ? $sourceSnapshotMode
                : null,
            'sourceCommitExact' => $sourceCommitIsExact,
            'provenanceStatus' => $provenanceStatus,
            'packageVersion' => trim((string)($buildMetadata['packageVersion'] ?? '')) ?: (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'manifestPath' => $manifestMetadata['manifestPath'] ?? null,
            'manifestPathHash' => $manifestMetadata['manifestPathHash'] ?? null,
            'manifestSha256' => $manifestMetadata['manifestSha256'] ?? null,
            'manifestMd5' => $manifestMetadata['manifestMd5'] ?? null,
            'archiveMd5' => $manifestMetadata['manifestMd5'] ?? null,
            'manifestUrl' => $manifestUrl !== '' ? $manifestUrl : null,
            'archiveUrl' => $archiveUrl !== '' ? $archiveUrl : null,
            'iconAssetPackVersion' => trim((string)($buildMetadata['iconAssetPackVersion'] ?? ($manifestMetadata['iconAssetPackVersion'] ?? ''))) ?: null,
            'iconAssetPackSha256' => preg_match('/^[a-f0-9]{64}$/', (string)($buildMetadata['iconAssetPackSha256'] ?? ($manifestMetadata['iconAssetPackSha256'] ?? '')))
                ? (string)($buildMetadata['iconAssetPackSha256'] ?? $manifestMetadata['iconAssetPackSha256'])
                : null,
            'iconAssetPackUrl' => trim((string)($manifestMetadata['iconAssetPackUrl'] ?? ($buildMetadata['iconAssetPackUrl'] ?? ''))) ?: null
        ];
    }

    function diagnosticsBuildSupportBundleMetaSection(array $diagnostics, array $redactor): array {
        $requestedLocale = fvplus_i18n_normalize_locale((string)($_SESSION['locale'] ?? 'en'));
        $localeResolution = fvplus_i18n_resolve_locale($requestedLocale);
        $catalogReport = fvplus_i18n_catalog_report();
        $localeCoverage = is_array($catalogReport['locales'] ?? null) ? $catalogReport['locales'] : [];
        return [
            'bundleType' => 'FolderViewPlusSupportBundle',
            'bundleVersion' => 2,
            'schemaVersion' => (int)($diagnostics['schemaVersion'] ?? 0),
            'generatedAt' => gmdate('c'),
            'traceId' => diagnosticsCurrentTraceId(),
            'transactionId' => diagnosticsCurrentTransactionId(),
            'pluginVersion' => (string)($diagnostics['pluginVersion'] ?? readInstalledVersion()),
            'channel' => diagnosticsResolveSupportBundleChannel(),
            'privacyMode' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)),
            'redactionPolicyVersion' => 1,
            'bundleSaltScope' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)) === 'full' ? 'none' : 'per-bundle',
            'bundleSaltHash' => $redactor['saltFingerprint'] ?? null,
            'localization' => [
                'requestedLocale' => $requestedLocale,
                'resolvedLocale' => (string)($localeResolution['resolved'] ?? 'en'),
                'fallbackChain' => array_values(is_array($localeResolution['fallbackChain'] ?? null) ? $localeResolution['fallbackChain'] : [$requestedLocale, 'en']),
                'direction' => (string)($localeResolution['direction'] ?? 'ltr'),
                'catalogVersion' => FVPLUS_I18N_CATALOG_VERSION,
                'status' => (string)($localeResolution['status'] ?? 'source'),
                'requestedStatus' => (string)($localeResolution['requestedStatus'] ?? 'unregistered'),
                'sourceMessageCount' => (int)($catalogReport['sourceMessageCount'] ?? 0),
                'namespaceCount' => (int)($catalogReport['namespaceCount'] ?? 0),
                'extractionCandidateCount' => (int)($catalogReport['extraction']['candidateCount'] ?? 0),
                'autoBoundMessageCount' => (int)($catalogReport['extraction']['autoBoundMessageCount'] ?? 0),
                'localeCount' => count($localeCoverage),
                'activeLocaleCoverage' => is_array($localeCoverage[$localeResolution['resolved'] ?? 'en'] ?? null)
                    ? $localeCoverage[$localeResolution['resolved'] ?? 'en']
                    : null
            ],
            'buildIdentity' => diagnosticsBuildSupportBundleBuildIdentitySection($diagnostics)
        ];
    }

    function diagnosticsBuildSupportBundlePluginTypeSection(string $type, array $typeData, array $hashes, array &$redactor): array {
        $backupSchedule = is_array($typeData['backupSchedule'] ?? null) ? $typeData['backupSchedule'] : [];
        $lastBackup = is_array($typeData['lastBackup'] ?? null) ? $typeData['lastBackup'] : null;
        $folderPath = (string)($typeData['folderPath'] ?? '');
        $folderFileHash = is_array($hashes[$type . 'Folders'] ?? null) ? $hashes[$type . 'Folders'] : [];
        $prefsFileHash = is_array($hashes[$type . 'Prefs'] ?? null) ? $hashes[$type . 'Prefs'] : [];
        $configMetadata = is_array($typeData['configurationMetadata'] ?? null) ? $typeData['configurationMetadata'] : [];

        return [
            'configurationMetadata' => [
                'schemaVersion' => (int)($configMetadata['schemaVersion'] ?? 0),
                'type' => (string)($configMetadata['type'] ?? $type),
                'createdAt' => (string)($configMetadata['createdAt'] ?? ''),
                'updatedAt' => (string)($configMetadata['updatedAt'] ?? ''),
                'folderRevision' => (int)($configMetadata['folderRevision'] ?? 0),
                'prefsRevision' => (int)($configMetadata['prefsRevision'] ?? 0),
                'folderUpdatedAt' => (string)($configMetadata['folderUpdatedAt'] ?? ''),
                'prefsUpdatedAt' => (string)($configMetadata['prefsUpdatedAt'] ?? ''),
                'folderSha256' => (string)($configMetadata['folderSha256'] ?? ''),
                'prefsSha256' => (string)($configMetadata['prefsSha256'] ?? ''),
                'externalChangeCount' => (int)($configMetadata['externalChangeCount'] ?? 0),
                'lastExternalChangeAt' => (string)($configMetadata['lastExternalChangeAt'] ?? ''),
                'lastTraceId' => (string)($configMetadata['lastTraceId'] ?? ''),
                'lastTransactionId' => (string)($configMetadata['lastTransactionId'] ?? ''),
                'lastMutationAt' => (string)($configMetadata['lastMutationAt'] ?? '')
            ],
            'prefs' => [
                'sortMode' => (string)($typeData['sortMode'] ?? 'created'),
                'dashboard' => is_array($typeData['dashboard'] ?? null) ? $typeData['dashboard'] : [],
                'expandedFolderState' => diagnosticsSupportBundleRedactExpandedFolderState(
                    $redactor,
                    $type,
                    'pluginState.' . $type . '.prefs.expandedFolderState',
                    is_array($typeData['expandedFolderState'] ?? null) ? $typeData['expandedFolderState'] : []
                ),
                'pinnedFolders' => diagnosticsSupportBundleRedactFolderIdList(
                    $redactor,
                    $type,
                    'pluginState.' . $type . '.prefs.pinnedFolders.*',
                    is_array($typeData['pinnedFolderIds'] ?? null) ? $typeData['pinnedFolderIds'] : []
                ),
                'hideEmptyFolders' => (bool)($typeData['hideEmptyFolders'] ?? false),
                'appColumnWidth' => (string)($typeData['appColumnWidth'] ?? 'standard'),
                'setupWizardCompleted' => (bool)($typeData['setupWizardCompleted'] ?? false),
                'settingsMode' => (string)($typeData['settingsMode'] ?? 'basic'),
                'runtimePrefsSchema' => (int)($typeData['runtimePrefsSchema'] ?? 0),
                'liveRefreshEnabled' => (bool)($typeData['liveRefreshEnabled'] ?? false),
                'liveRefreshSeconds' => (int)($typeData['liveRefreshSeconds'] ?? 0),
                'performanceProfile' => (string)($typeData['performanceProfile'] ?? 'standard'),
                'performanceMode' => (bool)($typeData['performanceMode'] ?? false),
                'lazyPreviewEnabled' => (bool)($typeData['lazyPreviewEnabled'] ?? false),
                'lazyPreviewThreshold' => (int)($typeData['lazyPreviewThreshold'] ?? 0),
                'themeCompatibilityMode' => (string)($typeData['themeCompatibilityMode'] ?? 'auto'),
                'health' => is_array($typeData['health'] ?? null) ? $typeData['health'] : [],
                'status' => is_array($typeData['status'] ?? null) ? $typeData['status'] : [],
                'backupSchedule' => $backupSchedule
            ],
            'folders' => [
                'path' => diagnosticsSupportBundleRedactScalar($redactor, 'pluginState.' . $type . '.folders.path', $folderPath, true),
                'pathHash' => diagnosticsSupportBundleHashValue($redactor, 'pluginState.' . $type . '.folders.pathHash', $folderPath),
                'exists' => (bool)($typeData['foldersExists'] ?? false),
                'count' => (int)($typeData['folderCount'] ?? 0),
                'manualOrderCount' => (int)($typeData['manualOrderCount'] ?? 0),
                'pinnedFolderCount' => (int)($typeData['pinnedFolderCount'] ?? 0)
            ],
            'templates' => [
                'count' => (int)($typeData['templateCount'] ?? 0)
            ],
            'fileHashes' => [
                'folders' => diagnosticsSupportBundleRedactPathDescriptor($folderFileHash, 'pluginState.' . $type . '.fileHashes.folders', $redactor),
                'prefs' => diagnosticsSupportBundleRedactPathDescriptor($prefsFileHash, 'pluginState.' . $type . '.fileHashes.prefs', $redactor)
            ],
            'counts' => [
                'folders' => (int)($typeData['folderCount'] ?? 0),
                'rules' => (int)($typeData['ruleCount'] ?? 0),
                'manualOrder' => (int)($typeData['manualOrderCount'] ?? 0),
                'pinnedFolders' => (int)($typeData['pinnedFolderCount'] ?? 0),
                'templates' => (int)($typeData['templateCount'] ?? 0),
                'backups' => (int)($typeData['backupCount'] ?? 0)
            ],
            'lastBackup' => $lastBackup
        ];
    }

    function diagnosticsBuildSupportBundlePluginStateSection(array $diagnostics, array &$redactor): array {
        $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
        $hashes = is_array($diagnostics['hashes'] ?? null) ? $diagnostics['hashes'] : [];
        $section = [];
        foreach (['docker', 'vm'] as $type) {
            $typeData = is_array($types[$type] ?? null) ? $types[$type] : [];
            $section[$type] = diagnosticsBuildSupportBundlePluginTypeSection($type, $typeData, $hashes, $redactor);
        }
        return $section;
    }

    function diagnosticsBuildSupportBundleRuntimeEntityDetails(string $type, array $stateSnapshot, array &$redactor): array {
        $details = is_array($stateSnapshot['entityDetails'] ?? null) ? $stateSnapshot['entityDetails'] : [];
        $entries = [];
        $fieldPath = 'runtimeState.' . $type . '.entityDetails.entries.*';
        foreach (array_values(is_array($details['entries'] ?? null) ? $details['entries'] : []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $name = (string)($entry['name'] ?? '');
            $manager = trim((string)($entry['manager'] ?? ''));
            $updated = array_key_exists('updated', $entry) && is_bool($entry['updated']) ? (bool)$entry['updated'] : null;
            $entries[] = [
                'name' => diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.name', $name),
                'nameHash' => diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.nameHash', $name),
                'state' => in_array((string)($entry['state'] ?? ''), ['started', 'paused', 'stopped'], true)
                    ? (string)$entry['state']
                    : 'stopped',
                'assigned' => (bool)($entry['assigned'] ?? false),
                'manager' => $manager !== '' ? $manager : null,
                'managed' => (bool)($entry['managed'] ?? false),
                'updated' => $updated,
                'updateState' => in_array((string)($entry['updateState'] ?? ''), ['available', 'upToDate', 'unknown'], true)
                    ? (string)$entry['updateState']
                    : 'unknown',
                'provenance' => [
                    'managerSource' => in_array((string)($entry['provenance']['managerSource'] ?? ''), ['infoState', 'topLevelFallback', 'missing'], true)
                        ? (string)$entry['provenance']['managerSource']
                        : 'missing',
                    'updateSource' => in_array((string)($entry['provenance']['updateSource'] ?? ''), ['infoState', 'topLevelFallback', 'missing'], true)
                        ? (string)$entry['provenance']['updateSource']
                        : 'missing'
                ],
                'renderExpectations' => [
                    'statusToken' => in_array((string)($entry['renderExpectations']['statusToken'] ?? ''), ['compose', 'thirdParty', 'updateReady', 'upToDate', 'available', 'unknown'], true)
                        ? (string)$entry['renderExpectations']['statusToken']
                        : 'unknown',
                    'action' => in_array((string)($entry['renderExpectations']['action'] ?? ''), ['none', 'applyUpdate', 'forceUpdate'], true)
                        ? (string)$entry['renderExpectations']['action']
                        : 'none',
                    'actionRequiresAdvancedView' => array_key_exists('actionRequiresAdvancedView', (array)($entry['renderExpectations'] ?? []))
                        ? (bool)$entry['renderExpectations']['actionRequiresAdvancedView']
                        : ((string)($entry['renderExpectations']['action'] ?? '') === 'forceUpdate'),
                    'forceUpdateEligible' => (bool)($entry['renderExpectations']['forceUpdateEligible'] ?? false)
                ]
            ];
        }
        if ((bool)($details['truncated'] ?? false)) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', 'runtimeState.' . $type . '.entityDetails.entries');
        }
        return [
            'total' => (int)($details['total'] ?? count($entries)),
            'maxEntries' => (int)($details['maxEntries'] ?? count($entries)),
            'truncated' => (bool)($details['truncated'] ?? false),
            'managerCounts' => is_array($stateSnapshot['managerCounts'] ?? null) ? $stateSnapshot['managerCounts'] : [],
            'entries' => $entries
        ];
    }

    function diagnosticsBuildSupportBundleRuntimeTypeSection(string $type, array $typeData, array &$redactor): array {
        $stateSnapshot = is_array($typeData['stateSnapshot'] ?? null) ? $typeData['stateSnapshot'] : [];
        $folders = [];
        foreach (array_values(is_array($stateSnapshot['folders'] ?? null) ? $stateSnapshot['folders'] : []) as $index => $folder) {
            if (!is_array($folder)) {
                continue;
            }
            $fieldPath = 'runtimeState.' . $type . '.folderHierarchySummary.folders.*';
            $folderId = (string)($folder['folderId'] ?? '');
            $parentId = (string)($folder['parentId'] ?? '');
            $folderName = (string)($folder['folderName'] ?? '');
            $memberItems = array_values(is_array($folder['members']['items'] ?? null) ? $folder['members']['items'] : []);
            $folder['folderId'] = diagnosticsSupportBundleRedactFolderIdValue($redactor, $type, $fieldPath . '.folderId', $folderId);
            $folder['parentId'] = diagnosticsSupportBundleRedactFolderIdValue($redactor, $type, $fieldPath . '.parentId', $parentId);
            $folder['folderName'] = diagnosticsSupportBundleRedactScalar($redactor, $fieldPath . '.folderName', $folderName);
            $folder['folderNameHash'] = diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.folderNameHash', $folderName !== '' ? $folderName : $folderId);
            if (!isset($folder['members']) || !is_array($folder['members'])) {
                $folder['members'] = [];
            }
            $folder['settings'] = [
                'previewUpdate' => (bool)($folder['settings']['previewUpdate'] ?? false),
                'hideUpdateColumn' => (bool)($folder['settings']['hideUpdateColumn'] ?? false)
            ];
            if ($type === 'docker') {
                $folder['renderExpectations'] = [
                    'updateColumnVisible' => (bool)($folder['renderExpectations']['updateColumnVisible'] ?? false),
                    'statusToken' => in_array((string)($folder['renderExpectations']['statusToken'] ?? ''), ['compose', 'composeAndThirdParty', 'thirdParty', 'updateReady', 'upToDate'], true)
                        ? (string)$folder['renderExpectations']['statusToken']
                        : 'upToDate',
                    'action' => in_array((string)($folder['renderExpectations']['action'] ?? ''), ['none', 'applyUpdate', 'forceUpdate'], true)
                        ? (string)$folder['renderExpectations']['action']
                        : 'none',
                    'actionRequiresAdvancedView' => array_key_exists('actionRequiresAdvancedView', (array)($folder['renderExpectations'] ?? []))
                        ? (bool)$folder['renderExpectations']['actionRequiresAdvancedView']
                        : in_array((string)($folder['renderExpectations']['action'] ?? ''), ['applyUpdate', 'forceUpdate'], true),
                    'forceUpdateEligible' => (bool)($folder['renderExpectations']['forceUpdateEligible'] ?? false),
                    'managerTypes' => array_values(array_filter(array_map('strval', is_array($folder['renderExpectations']['managerTypes'] ?? null) ? $folder['renderExpectations']['managerTypes'] : []), static function ($value): bool {
                        return trim($value) !== '';
                    }))
                ];
            }
            if (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full') {
                $folder['members']['items'] = array_slice(array_map('strval', $memberItems), 0, 40);
            } else {
                $folder['members']['itemHashes'] = array_slice(array_values(array_map(
                    static function ($name) use (&$redactor, $fieldPath): ?string {
                        return diagnosticsSupportBundleHashValue($redactor, $fieldPath . '.members.itemHashes.*', (string)$name);
                    },
                    $memberItems
                )), 0, 40);
                $folder['members']['items'] = [];
                diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', $fieldPath . '.members.items');
            }
            $folders[$index] = $folder;
        }

        $foldersPath = (string)($typeData['folderPath'] ?? '');
        $prefsPath = (string)($typeData['prefsPath'] ?? '');

        return [
            'runtimeSnapshotAvailable' => !empty($stateSnapshot),
            'snapshotSource' => 'serverDiagnostics',
            'entitySummary' => [
                'total' => (int)($stateSnapshot['totalItems'] ?? 0),
                'assigned' => (int)($stateSnapshot['assignedItems'] ?? 0),
                'unassigned' => (int)($stateSnapshot['unassignedItems'] ?? 0),
                'states' => is_array($stateSnapshot['stateCounts'] ?? null) ? $stateSnapshot['stateCounts'] : []
            ],
            'folderHierarchySummary' => [
                'rootFolderCount' => (int)($stateSnapshot['rootFolderCount'] ?? 0),
                'nestedFolderCount' => (int)($stateSnapshot['nestedFolderCount'] ?? 0),
                'maxDepth' => (int)($stateSnapshot['maxDepth'] ?? 0),
                'folders' => $folders
            ],
            'entityDetails' => diagnosticsBuildSupportBundleRuntimeEntityDetails($type, $stateSnapshot, $redactor),
            'updateStateSummary' => is_array($stateSnapshot['updateCounts'] ?? null) ? $stateSnapshot['updateCounts'] : [],
            'preflight' => [
                'foldersPath' => diagnosticsSupportBundleRedactScalar($redactor, 'runtimeState.' . $type . '.preflight.foldersPath', $foldersPath, true),
                'foldersPathHash' => diagnosticsSupportBundleHashValue($redactor, 'runtimeState.' . $type . '.preflight.foldersPathHash', $foldersPath),
                'prefsPath' => diagnosticsSupportBundleRedactScalar($redactor, 'runtimeState.' . $type . '.preflight.prefsPath', $prefsPath, true),
                'prefsPathHash' => diagnosticsSupportBundleHashValue($redactor, 'runtimeState.' . $type . '.preflight.prefsPathHash', $prefsPath),
                'foldersExists' => (bool)($typeData['foldersExists'] ?? false),
                'prefsExists' => (bool)($typeData['prefsExists'] ?? false)
            ]
        ];
    }

    function diagnosticsBuildSupportBundleRuntimeStateSection(array $diagnostics, array &$redactor): array {
        $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
        $detectedConflicts = fvplus_detect_runtime_plugin_conflicts();
        return [
            'docker' => diagnosticsBuildSupportBundleRuntimeTypeSection('docker', is_array($types['docker'] ?? null) ? $types['docker'] : [], $redactor),
            'vm' => diagnosticsBuildSupportBundleRuntimeTypeSection('vm', is_array($types['vm'] ?? null) ? $types['vm'] : [], $redactor),
            'conflicts' => [
                'runtimeSafeMode' => count($detectedConflicts) > 0,
                'detected' => $detectedConflicts
            ]
        ];
    }

    function diagnosticsBuildSupportBundleSystemSection(array $diagnostics, array $integrityFindings, array &$redactor): array {
        $environment = is_array($diagnostics['environment'] ?? null) ? $diagnostics['environment'] : [];
        $customIcons = is_array($diagnostics['customIcons'] ?? null) ? $diagnostics['customIcons'] : [];
        $request = is_array($environment['request'] ?? null) ? $environment['request'] : [];
        $userAgent = (string)($request['userAgent'] ?? '');
        $clientIp = (string)($request['clientIp'] ?? '');
        $customIconsPath = is_array($customIcons['path'] ?? null) ? $customIcons['path'] : [];
        $topReferences = [];
        foreach (array_values(is_array($customIcons['topReferences'] ?? null) ? $customIcons['topReferences'] : []) as $reference) {
            if (!is_array($reference)) {
                continue;
            }
            $name = (string)($reference['name'] ?? '');
            $topReferences[] = [
                'name' => diagnosticsSupportBundleRedactScalar($redactor, 'system.pathHealth.customIcons.topReferences.*.name', $name),
                'nameHash' => diagnosticsSupportBundleHashValue($redactor, 'system.pathHealth.customIcons.topReferences.*.nameHash', $name),
                'referenceCount' => (int)($reference['referenceCount'] ?? 0)
            ];
        }
        $customIcons['path'] = diagnosticsSupportBundleRedactPathDescriptor($customIconsPath, 'system.pathHealth.customIcons.path', $redactor);
        $customIcons['topReferences'] = $topReferences;
        $customIconsRepairHint = (string)($customIcons['repairHint'] ?? '');
        $customIcons['repairHint'] = (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) === 'full')
            ? $customIconsRepairHint
            : null;
        if (($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY) !== 'full' && $customIconsRepairHint !== '') {
            diagnosticsSupportBundleMarkRedaction($redactor, 'omittedFields', 'system.pathHealth.customIcons.repairHint');
        }
        return [
            'unraidVersion' => $environment['unraidVersion'] ?? null,
            'phpVersion' => $environment['phpVersion'] ?? null,
            'kernel' => $environment['os'] ?? null,
            'timezone' => $environment['timezone'] ?? null,
            'serverSoftware' => $environment['serverSoftware'] ?? null,
            'request' => [
                'privacyMode' => normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY)),
                'userAgent' => diagnosticsSupportBundleRedactScalar($redactor, 'system.request.userAgent', $userAgent),
                'userAgentHash' => diagnosticsSupportBundleHashValue($redactor, 'system.request.userAgentHash', $userAgent),
                'clientIp' => diagnosticsSupportBundleMaskIpValue($redactor, 'system.request.clientIp', $clientIp),
                'clientIpHash' => diagnosticsSupportBundleHashValue($redactor, 'system.request.clientIpHash', $clientIp)
            ],
            'pathHealth' => [
                'docker' => diagnosticsSupportBundleRedactPathHealth(
                    is_array($integrityFindings['docker']['pathHealth'] ?? null) ? $integrityFindings['docker']['pathHealth'] : [],
                    'system.pathHealth.docker',
                    $redactor
                ),
                'vm' => diagnosticsSupportBundleRedactPathHealth(
                    is_array($integrityFindings['vm']['pathHealth'] ?? null) ? $integrityFindings['vm']['pathHealth'] : [],
                    'system.pathHealth.vm',
                    $redactor
                ),
                'customIcons' => $customIcons
            ],
            'durableStorage' => is_array($diagnostics['durableStorage'] ?? null) ? $diagnostics['durableStorage'] : [],
            'runtimeIntegrity' => is_array($diagnostics['runtimeIntegrity'] ?? null) ? $diagnostics['runtimeIntegrity'] : [],
            'securityAudit' => is_array($diagnostics['securityAudit'] ?? null) ? $diagnostics['securityAudit'] : [],
            'requestSecurity' => is_array($diagnostics['requestSecurity'] ?? null) ? $diagnostics['requestSecurity'] : [],
            'phpExtensions' => array_values(get_loaded_extensions())
        ];
    }
    function diagnosticsBuildSupportBundleHealthAndHistorySection(array $diagnostics, array $integrityFindings, array &$redactor): array {
        $summary = is_array($diagnostics['summary'] ?? null) ? $diagnostics['summary'] : [];
        $history = is_array($diagnostics['importExportHistory'] ?? null) ? $diagnostics['importExportHistory'] : [];
        $timelineRows = [];
        foreach (array_values(is_array($diagnostics['recentTimeline'] ?? null) ? $diagnostics['recentTimeline'] : []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $timelineRows[] = [
                'timestamp' => (string)($row['timestamp'] ?? ''),
                'action' => (string)($row['action'] ?? ''),
                'type' => $row['type'] ?? null,
                'status' => (string)($row['status'] ?? 'ok'),
                'summary' => diagnosticsSupportBundleRedactRecentTimelineSummary((string)($row['summary'] ?? ''), $redactor)
            ];
        }
        if (count($timelineRows) < count(array_values(is_array($diagnostics['recentTimeline'] ?? null) ? $diagnostics['recentTimeline'] : []))) {
            diagnosticsSupportBundleMarkRedaction($redactor, 'truncatedFields', 'healthAndHistory.recentTimeline');
        }

        $historyEvents = [];
        foreach (array_values(is_array($history['events'] ?? null) ? $history['events'] : []) as $event) {
            if (!is_array($event)) {
                continue;
            }
            $historyEvents[] = [
                'id' => (string)($event['id'] ?? ''),
                'timestamp' => (string)($event['timestamp'] ?? ''),
                'action' => (string)($event['action'] ?? ''),
                'type' => $event['type'] ?? null,
                'status' => (string)($event['status'] ?? 'ok'),
                'source' => (string)($event['source'] ?? 'server'),
                'traceId' => (string)($event['traceId'] ?? ''),
                'transactionId' => (string)($event['transactionId'] ?? ''),
                'details' => diagnosticsSupportBundleRedactEventDetails(
                    is_array($event['details'] ?? null) ? $event['details'] : [],
                    'healthAndHistory.recentMutations.events.*.details',
                    $redactor
                )
            ];
        }

        return [
            'summary' => $summary,
            'integrityFindings' => diagnosticsSupportBundleRedactIntegrityFindings($integrityFindings, $redactor),
            'recommendedActions' => array_values(is_array($summary['recommendedActions'] ?? null) ? $summary['recommendedActions'] : []),
            'recentActions' => diagnosticsBuildSupportBundleRecentActions(
                array_values(is_array($history['events'] ?? null) ? $history['events'] : []),
                $redactor,
                30
            ),
            'recentTimeline' => $timelineRows,
            'recentMutations' => [
                'retained' => (int)($history['retained'] ?? 0),
                'returned' => (int)($history['returned'] ?? 0),
                'events' => $historyEvents
            ],
            'update' => is_array($diagnostics['update'] ?? null) ? $diagnostics['update'] : [],
            'serverLogTail' => diagnosticsBuildSupportBundleServerLogTailSection($redactor)
        ];
    }

    function diagnosticsBuildSupportBundleRedactionManifestSection(array $redactor): array {
        $privacyMode = normalizeDiagnosticsPrivacyMode((string)($redactor['mode'] ?? FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY));
        return [
            'mode' => $privacyMode,
            'saltScope' => $privacyMode === 'full' ? 'none' : 'per-bundle',
            'saltHash' => $privacyMode === 'full' ? null : ($redactor['saltFingerprint'] ?? null),
            'hashedFields' => array_values(array_unique(array_map('strval', is_array($redactor['hashedFields'] ?? null) ? $redactor['hashedFields'] : []))),
            'maskedFields' => array_values(array_unique(array_map('strval', is_array($redactor['maskedFields'] ?? null) ? $redactor['maskedFields'] : []))),
            'omittedFields' => array_values(array_unique(array_map('strval', is_array($redactor['omittedFields'] ?? null) ? $redactor['omittedFields'] : []))),
            'truncatedFields' => array_values(array_unique(array_map('strval', is_array($redactor['truncatedFields'] ?? null) ? $redactor['truncatedFields'] : [])))
        ];
    }

    function getSupportBundlePreviewSnapshot(string $privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY): array {
        $mode = normalizeDiagnosticsPrivacyMode($privacyMode);
        return [
            'bundleMeta' => [
                'bundleType' => 'FolderViewPlusSupportBundle',
                'bundleVersion' => 2,
                'schemaVersion' => FVPLUS_DIAGNOSTICS_SCHEMA_VERSION,
                'generatedAt' => gmdate('c'),
                'traceId' => diagnosticsCurrentTraceId(),
                'transactionId' => diagnosticsCurrentTransactionId(),
                'pluginVersion' => readInstalledVersion(),
                'channel' => diagnosticsResolveSupportBundleChannel(),
                'privacyMode' => $mode,
                'redactionPolicyVersion' => 1,
                'bundleSaltScope' => $mode === 'full' ? 'none' : 'per-bundle',
                'previewOnly' => true
            ],
            // These contract placeholders make the preview useful without running
            // host discovery. Full data is collected only when an export is requested.
            'system' => ['previewOnly' => true],
            'pluginState' => ['previewOnly' => true],
            'runtimeState' => ['previewOnly' => true],
            'uiTelemetry' => ['previewOnly' => true],
            'healthAndHistory' => [
                'previewOnly' => true,
                'summary' => new stdClass(),
                'recentTimeline' => []
            ],
            'redactionManifest' => [
                'mode' => $mode,
                'saltScope' => $mode === 'full' ? 'none' : 'per-bundle',
                'saltHash' => null,
                'hashedFields' => [],
                'maskedFields' => [],
                'omittedFields' => [],
                'truncatedFields' => [],
                'previewOnly' => true
            ]
        ];
    }

    function getSupportBundleV2Snapshot(string $privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY): array {
        $redactor = diagnosticsCreateSupportBundleRedactor($privacyMode);
        $diagnostics = getDiagnosticsSnapshot('full');
        $types = is_array($diagnostics['types'] ?? null) ? $diagnostics['types'] : [];
        $integrityFindings = [
            'docker' => is_array($types['docker']['integrityChecks'] ?? null) ? $types['docker']['integrityChecks'] : [],
            'vm' => is_array($types['vm']['integrityChecks'] ?? null) ? $types['vm']['integrityChecks'] : []
        ];

        return [
            'bundleMeta' => diagnosticsBuildSupportBundleMetaSection($diagnostics, $redactor),
            'system' => diagnosticsBuildSupportBundleSystemSection($diagnostics, $integrityFindings, $redactor),
            'pluginState' => diagnosticsBuildSupportBundlePluginStateSection($diagnostics, $redactor),
            'runtimeState' => diagnosticsBuildSupportBundleRuntimeStateSection($diagnostics, $redactor),
            'uiTelemetry' => new stdClass(),
            'healthAndHistory' => diagnosticsBuildSupportBundleHealthAndHistorySection($diagnostics, $integrityFindings, $redactor),
            'redactionManifest' => diagnosticsBuildSupportBundleRedactionManifestSection($redactor)
        ];
    }
