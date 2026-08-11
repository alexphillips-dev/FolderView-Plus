<?php
function diagnosticsStateKindForDockerItem(array $item): string {
        $state = is_array($item['info']['State'] ?? null) ? $item['info']['State'] : [];
        $running = (bool)($state['Running'] ?? false);
        $paused = (bool)($state['Paused'] ?? false);
        if ($running && !$paused) {
            return 'started';
        }
        if ($running && $paused) {
            return 'paused';
        }
        return 'stopped';
    }

    function diagnosticsStateKindForVmItem(array $item): string {
        $state = strtolower(trim((string)($item['state'] ?? '')));
        if ($state === 'running') {
            return 'started';
        }
        if (in_array($state, ['paused', 'pmsuspended', 'unknown'], true)) {
            return 'paused';
        }
        return 'stopped';
    }

    function diagnosticsBuildStateSnapshot(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode): array {
        $validNames = array_keys($infoByName);
        $validNameSet = array_fill_keys($validNames, true);
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $ruleTargetByName = [];
        foreach ($validNames as $name) {
            $rule = diagnosticsFirstMatchingRule($rules, $name, $infoByName, $type);
            $ruleTargetByName[$name] = $rule ? (string)($rule['folderId'] ?? '') : '';
        }

        $badges = is_array($prefs['badges'] ?? null) ? $prefs['badges'] : [];
        $showRunningBadge = !array_key_exists('running', $badges) ? true : (bool)$badges['running'];
        $showStoppedBadge = array_key_exists('stopped', $badges) && (bool)$badges['stopped'];
        $showUpdateBadge = !array_key_exists('updates', $badges) ? true : (bool)$badges['updates'];

        $parentById = [];
        foreach ($folders as $folderId => $folder) {
            $safeFolderId = (string)$folderId;
            $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
            $parentById[$safeFolderId] = $parentId !== ''
                && $parentId !== $safeFolderId
                && array_key_exists($parentId, $folders)
                    ? $parentId
                    : '';
        }

        $depthById = [];
        $rootFolderCount = 0;
        $nestedFolderCount = 0;
        $maxDepth = 0;
        foreach (array_keys($folders) as $folderId) {
            $safeFolderId = (string)$folderId;
            $depth = 0;
            $cursor = $safeFolderId;
            $seen = [$safeFolderId => true];
            while (($parentById[$cursor] ?? '') !== '') {
                $parentId = (string)$parentById[$cursor];
                if (isset($seen[$parentId])) {
                    break;
                }
                $seen[$parentId] = true;
                $depth++;
                $cursor = $parentId;
            }
            $depthById[$safeFolderId] = $depth;
            if ($depth > 0) {
                $nestedFolderCount++;
            } else {
                $rootFolderCount++;
            }
            if ($depth > $maxDepth) {
                $maxDepth = $depth;
            }
        }

        $snapshotFolders = [];
        $folderStatusTotals = ['running' => 0, 'paused' => 0, 'stopped' => 0];
        $memberTotals = ['started' => 0, 'paused' => 0, 'stopped' => 0, 'total' => 0];
        $entityStateCounts = ['started' => 0, 'paused' => 0, 'stopped' => 0];
        $updateCounts = ['available' => 0, 'upToDate' => 0, 'unknown' => 0, 'total' => 0];
        $assignedItemSet = [];

        foreach ($infoByName as $name => $item) {
            if (!is_array($item)) {
                continue;
            }
            $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
            if (isset($entityStateCounts[$kind])) {
                $entityStateCounts[$kind]++;
            }
            if ($type === 'docker') {
                $updated = $item['info']['State']['Updated'] ?? null;
                if ($updated === true) {
                    $updateCounts['upToDate']++;
                } elseif ($updated === false) {
                    $updateCounts['available']++;
                } else {
                    $updateCounts['unknown']++;
                }
            } else {
                $updateCounts['unknown']++;
            }
            $updateCounts['total']++;
        }

        foreach ($folders as $folderId => $folder) {
            $safeFolderId = (string)$folderId;
            $members = normalizeFolderMembers($folder['containers'] ?? []);
            $regex = (string)($folder['regex'] ?? '');
            if ($regex !== '' && diagnosticsRegexIsValid($regex)) {
                foreach ($validNames as $name) {
                    if (diagnosticsRegexMatches($regex, $name) && !in_array($name, $members, true)) {
                        $members[] = $name;
                    }
                }
            }
            if ($type === 'docker') {
                $folderName = trim((string)($folder['name'] ?? ''));
                if ($folderName !== '') {
                    foreach ($validNames as $name) {
                        $labelValue = getFolderLabelValueFromLabels(dockerInfoLabelsForName($infoByName, $name));
                        if ($labelValue !== '' && $labelValue === $folderName && !in_array($name, $members, true)) {
                            $members[] = $name;
                        }
                    }
                }
            }
            foreach ($validNames as $name) {
                if (($ruleTargetByName[$name] ?? '') === (string)$folderId && !in_array($name, $members, true)) {
                    $members[] = $name;
                }
            }

            $started = 0;
            $paused = 0;
            $stopped = 0;
            $folderManagerTypes = [];
            $folderManagedCount = 0;
            $folderUpToDate = true;
            foreach ($members as $name) {
                $item = $infoByName[$name] ?? null;
                if (!is_array($item)) {
                    continue;
                }
                if (isset($validNameSet[$name])) {
                    $assignedItemSet[$name] = true;
                }
                $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
                if ($kind === 'started') {
                    $started++;
                } elseif ($kind === 'paused') {
                    $paused++;
                } else {
                    $stopped++;
                }
                if ($type === 'docker') {
                    $memberManager = trim((string)($item['info']['State']['manager'] ?? ($item['manager'] ?? '')));
                    if ($memberManager !== '') {
                        $folderManagerTypes[$memberManager] = true;
                    }
                    if ($memberManager === 'dockerman') {
                        $folderManagedCount++;
                        $memberUpdated = $item['info']['State']['Updated'] ?? ($item['Updated'] ?? null);
                        if ($memberUpdated === false) {
                            $folderUpToDate = false;
                        }
                    }
                }
            }

            $total = count($members);
            $statusKind = 'stopped';
            $statusCount = $stopped;
            if ($started > 0) {
                $statusKind = 'running';
                $statusCount = $started;
            } elseif ($paused > 0) {
                $statusKind = 'paused';
                $statusCount = $paused;
            }
            $statusText = sprintf('%d/%d %s', $statusCount, $total, $statusKind === 'running' ? 'started' : $statusKind);
            $badgeVisible = true;
            if ($statusKind === 'running') {
                $badgeVisible = $showRunningBadge;
            } elseif ($statusKind === 'stopped') {
                $badgeVisible = $showStoppedBadge;
            }
            $hideUpdateColumn = diagnosticsFolderSettingBool(is_array($folder) ? $folder : [], 'update_column', false);
            $previewUpdate = diagnosticsFolderSettingBool(is_array($folder) ? $folder : [], 'preview_update', false);

            $folderStatusTotals[$statusKind]++;
            $memberTotals['started'] += $started;
            $memberTotals['paused'] += $paused;
            $memberTotals['stopped'] += $stopped;
            $memberTotals['total'] += $total;

            $snapshotFolders[$safeFolderId] = [
                'folderId' => $safeFolderId,
                'folderName' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)($folder['name'] ?? $folderId) : null,
                'folderNameHash' => diagnosticsHashShort((string)($folder['name'] ?? $folderId)),
                'parentId' => (string)($parentById[$safeFolderId] ?? ''),
                'depth' => (int)($depthById[$safeFolderId] ?? 0),
                'members' => [
                    'total' => $total,
                    'started' => $started,
                    'paused' => $paused,
                    'stopped' => $stopped,
                    'items' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? array_slice($members, 0, 40) : []
                ],
                'status' => [
                    'kind' => $statusKind,
                    'text' => $statusText,
                    'badgeVisible' => $badgeVisible,
                    'colors' => diagnosticsFolderStatusColors(is_array($folder) ? $folder : [])
                ],
                'settings' => [
                    'previewUpdate' => $previewUpdate,
                    'hideUpdateColumn' => $hideUpdateColumn
                ]
            ];
            if ($type === 'docker') {
                $snapshotFolders[$safeFolderId]['renderExpectations'] = diagnosticsDockerFolderRenderExpectations(
                    array_keys($folderManagerTypes),
                    $folderUpToDate,
                    $folderManagedCount,
                    $showUpdateBadge,
                    $hideUpdateColumn
                );
            }
        }

        $entityDetails = [];
        $entityDetailsTotal = 0;
        $entityDetailsMaxEntries = 200;
        $managerCounts = [];
        foreach ($validNames as $name) {
            $item = $infoByName[$name] ?? null;
            if (!is_array($item)) {
                continue;
            }
            $entityDetailsTotal++;
            $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
            $manager = '';
            $updated = null;
            if ($type === 'docker') {
                $manager = trim((string)($item['info']['State']['manager'] ?? ($item['manager'] ?? '')));
                $updated = $item['info']['State']['Updated'] ?? ($item['Updated'] ?? null);
                $managerKey = $manager !== '' ? $manager : 'unclassified';
                $managerCounts[$managerKey] = (int)($managerCounts[$managerKey] ?? 0) + 1;
            }
            if (!is_bool($updated)) {
                $updated = null;
            }
            if ($entityDetailsTotal > $entityDetailsMaxEntries) {
                continue;
            }
            $provenance = [
                'managerSource' => 'missing',
                'updateSource' => 'missing'
            ];
            $renderExpectations = [
                'statusToken' => $updated === true ? 'upToDate' : ($updated === false ? 'available' : 'unknown'),
                'action' => 'none',
                'forceUpdateEligible' => false
            ];
            if ($type === 'docker') {
                $provenance = [
                    'managerSource' => diagnosticsDockerStateFieldSource($item, 'manager'),
                    'updateSource' => diagnosticsDockerStateFieldSource($item, 'updated')
                ];
                $renderExpectations = diagnosticsDockerMemberRenderExpectations($manager !== '' ? $manager : null, $updated);
            }
            $entityDetails[] = [
                'name' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)$name : null,
                'nameHash' => diagnosticsHashShort((string)$name),
                'state' => $kind,
                'assigned' => isset($assignedItemSet[$name]),
                'manager' => $manager !== '' ? $manager : null,
                'managed' => $manager === 'dockerman',
                'updated' => $updated,
                'updateState' => $updated === true ? 'upToDate' : ($updated === false ? 'available' : 'unknown'),
                'provenance' => $provenance,
                'renderExpectations' => $renderExpectations
            ];
        }
        if (!empty($managerCounts)) {
            ksort($managerCounts);
        }

        $totalItems = count($validNames);
        $assignedItems = count($assignedItemSet);
        $unassignedItems = max(0, $totalItems - $assignedItems);

        return [
            'totalItems' => $totalItems,
            'assignedItems' => $assignedItems,
            'unassignedItems' => $unassignedItems,
            'stateCounts' => $entityStateCounts,
            'rootFolderCount' => $rootFolderCount,
            'nestedFolderCount' => $nestedFolderCount,
            'maxDepth' => $maxDepth,
            'updateCounts' => $updateCounts,
            'managerCounts' => $managerCounts,
            'entityDetails' => [
                'total' => $entityDetailsTotal,
                'maxEntries' => $entityDetailsMaxEntries,
                'truncated' => $entityDetailsTotal > count($entityDetails),
                'entries' => $entityDetails
            ],
            'summary' => [
                'folderTotalsByStatus' => $folderStatusTotals,
                'memberTotals' => $memberTotals,
                'badgePrefs' => [
                    'running' => $showRunningBadge,
                    'stopped' => $showStoppedBadge,
                    'updates' => $showUpdateBadge
                ]
            ],
            'folders' => $snapshotFolders
        ];
    }

    function diagnosticsSummaryStatusFromCounts(int $errorCount, int $warningCount = 0): string {
        if ($errorCount > 0) {
            return 'error';
        }
        if ($warningCount > 0) {
            return 'warning';
        }
        return 'healthy';
    }

    function diagnosticsBuildSummaryCard(string $key, string $label, string $status, string $headline, string $detail = '', array $extra = []): array {
        return array_merge([
            'key' => $key,
            'label' => $label,
            'status' => in_array($status, ['healthy', 'warning', 'error'], true) ? $status : 'healthy',
            'headline' => $headline,
            'detail' => $detail
        ], $extra);
    }

    function diagnosticsBuildIntegrityIssueDetail(array $integrity): string {
        $pathIssues = array_values(array_filter(array_map('strval', (array)($integrity['pathHealth']['issues'] ?? []))));
        if (!empty($pathIssues)) {
            return $pathIssues[0];
        }
        $metadataIssues = array_values(array_filter(array_map('strval', (array)($integrity['configurationMetadata']['issues'] ?? []))));
        if (!empty($metadataIssues)) {
            return $metadataIssues[0];
        }

        $orphanedCount = max(0, (int)($integrity['orphanedMembers']['count'] ?? 0));
        if ($orphanedCount > 0) {
            $orphanedFolderCount = count(array_values(is_array($integrity['orphanedMembers']['folders'] ?? null) ? $integrity['orphanedMembers']['folders'] : []));
            $orphanedFolderCount = max(1, $orphanedFolderCount);
            return sprintf(
                '%d orphaned member reference%s found in %d folder%s.',
                $orphanedCount,
                $orphanedCount === 1 ? '' : 's',
                $orphanedFolderCount,
                $orphanedFolderCount === 1 ? '' : 's'
            );
        }

        $effectiveDuplicateCount = max(0, (int)($integrity['duplicateAssignments']['effective']['count'] ?? 0));
        if ($effectiveDuplicateCount > 0) {
            return sprintf(
                '%d item assignment conflict%s found after rules and members were combined.',
                $effectiveDuplicateCount,
                $effectiveDuplicateCount === 1 ? '' : 's'
            );
        }

        $invalidRuleCount = max(0, (int)($integrity['invalidAutoRules']['count'] ?? 0));
        if ($invalidRuleCount > 0) {
            return sprintf(
                '%d auto-assignment rule%s failed validation.',
                $invalidRuleCount,
                $invalidRuleCount === 1 ? '' : 's'
            );
        }

        $invalidRegexCount = max(0, (int)($integrity['invalidFolderRegex']['count'] ?? 0));
        if ($invalidRegexCount > 0) {
            return sprintf(
                '%d folder regex pattern%s failed validation.',
                $invalidRegexCount,
                $invalidRegexCount === 1 ? '' : 's'
            );
        }

        $invalidIconPathCount = max(0, (int)($integrity['invalidFolderIconPaths']['count'] ?? 0));
        if ($invalidIconPathCount > 0) {
            return sprintf(
                '%d folder icon path%s %s invalid.',
                $invalidIconPathCount,
                $invalidIconPathCount === 1 ? '' : 's',
                $invalidIconPathCount === 1 ? 'is' : 'are'
            );
        }

        $missingManualOrderIds = max(0, (int)($integrity['missingManualOrderIds']['count'] ?? 0));
        if ($missingManualOrderIds > 0) {
            return sprintf(
                '%d saved manual-order id%s no longer %s an existing folder.',
                $missingManualOrderIds,
                $missingManualOrderIds === 1 ? '' : 's',
                $missingManualOrderIds === 1 ? 'matches' : 'match'
            );
        }

        $missingPinnedFolderIds = max(0, (int)($integrity['missingPinnedFolderIds']['count'] ?? 0));
        if ($missingPinnedFolderIds > 0) {
            return sprintf(
                '%d pinned folder id%s no longer %s an existing folder.',
                $missingPinnedFolderIds,
                $missingPinnedFolderIds === 1 ? '' : 's',
                $missingPinnedFolderIds === 1 ? 'matches' : 'match'
            );
        }

        $duplicateNameCount = max(0, (int)($integrity['duplicateFolderNames']['count'] ?? 0));
        if ($duplicateNameCount > 0) {
            return sprintf(
                '%d duplicate folder name%s found.',
                $duplicateNameCount,
                $duplicateNameCount === 1 ? '' : 's'
            );
        }

        return '';
    }

    function diagnosticsFolderSettingBool(array $folder, string $key, bool $default = false): bool {
        $settings = is_array($folder['settings'] ?? null) ? $folder['settings'] : [];
        if (!array_key_exists($key, $settings)) {
            return $default;
        }
        return normalizeBool($settings[$key], $default);
    }

    function diagnosticsDockerStateFieldSource(array $item, string $field): string {
        $state = is_array($item['info']['State'] ?? null) ? $item['info']['State'] : [];
        if ($field === 'manager') {
            if (trim((string)($state['manager'] ?? '')) !== '') {
                return 'infoState';
            }
            if (trim((string)($item['manager'] ?? '')) !== '') {
                return 'topLevelFallback';
            }
            return 'missing';
        }
        if ($field === 'updated') {
            if (is_bool($state['Updated'] ?? null)) {
                return 'infoState';
            }
            if (is_bool($item['Updated'] ?? null)) {
                return 'topLevelFallback';
            }
            return 'missing';
        }
        return 'missing';
    }

    function diagnosticsDockerMemberRenderExpectations(?string $manager, ?bool $updated): array {
        $safeManager = trim((string)($manager ?? ''));
        if ($safeManager === 'composeman') {
            return [
                'statusToken' => 'compose',
                'action' => 'none',
                'actionRequiresAdvancedView' => false,
                'forceUpdateEligible' => false
            ];
        }
        if ($safeManager !== '' && $safeManager !== 'dockerman') {
            return [
                'statusToken' => 'thirdParty',
                'action' => 'none',
                'actionRequiresAdvancedView' => false,
                'forceUpdateEligible' => false
            ];
        }
        if ($safeManager === 'dockerman' && $updated === false) {
            return [
                'statusToken' => 'updateReady',
                'action' => 'applyUpdate',
                'actionRequiresAdvancedView' => false,
                'forceUpdateEligible' => false
            ];
        }
        return [
            'statusToken' => 'upToDate',
            'action' => 'forceUpdate',
            'actionRequiresAdvancedView' => true,
            'forceUpdateEligible' => true
        ];
    }

    function diagnosticsDockerFolderRenderExpectations(array $managerTypes, bool $upToDate, int $managedCount, bool $showUpdateBadge, bool $hideUpdateColumn): array {
        $safeManagerTypes = array_values(array_filter(array_map('strval', $managerTypes), static function ($value): bool {
            return trim($value) !== '';
        }));
        $safeManagerTypes = array_values(array_unique($safeManagerTypes));
        sort($safeManagerTypes);

        $hasDockerMan = in_array('dockerman', $safeManagerTypes, true);
        $hasCompose = in_array('composeman', $safeManagerTypes, true);
        $hasThirdParty = count(array_filter($safeManagerTypes, static function ($value): bool {
            return $value !== 'dockerman' && $value !== 'composeman';
        })) > 0;

        $statusToken = 'upToDate';
        $action = 'none';
        if (!$hasDockerMan && $hasCompose && $hasThirdParty) {
            $statusToken = 'composeAndThirdParty';
        } elseif (!$hasDockerMan && $hasCompose) {
            $statusToken = 'compose';
        } elseif (!$hasDockerMan) {
            $statusToken = 'thirdParty';
        } elseif (!$upToDate) {
            $statusToken = 'updateReady';
            $action = 'applyUpdate';
        } elseif ($managedCount > 0) {
            $action = 'forceUpdate';
        }

        return [
            'updateColumnVisible' => $showUpdateBadge && !$hideUpdateColumn,
            'statusToken' => $statusToken,
            'action' => $action,
            'actionRequiresAdvancedView' => in_array($action, ['applyUpdate', 'forceUpdate'], true),
            'forceUpdateEligible' => $action === 'forceUpdate',
            'managerTypes' => $safeManagerTypes
        ];
    }

    function diagnosticsBuildRecommendedActions(array $typesData, array $customIcons): array {
        $actions = [];
        $addAction = static function (string $action, string $label, string $reason) use (&$actions): void {
            if (isset($actions[$action])) {
                return;
            }
            $actions[$action] = [
                'action' => $action,
                'label' => $label,
                'reason' => $reason
            ];
        };

        $dockerIntegrity = is_array($typesData['docker']['integrityChecks'] ?? null)
            ? $typesData['docker']['integrityChecks']
            : [];
        $vmIntegrity = is_array($typesData['vm']['integrityChecks'] ?? null)
            ? $typesData['vm']['integrityChecks']
            : [];

        if (((int)($dockerIntegrity['missingManualOrderIds']['count'] ?? 0)) > 0) {
            $addAction(
                'sync_docker_order',
                'Rebuild Docker order index',
                'Docker manual order still references missing folder ids.'
            );
        }

        $orphanedMemberCount = max(0, (int)($dockerIntegrity['orphanedMembers']['count'] ?? 0))
            + max(0, (int)($vmIntegrity['orphanedMembers']['count'] ?? 0));
        if ($orphanedMemberCount > 0) {
            $addAction(
                'repair_orphaned_members',
                'Remove orphaned member refs',
                'Saved folder members still reference Docker or VM items that no longer exist.'
            );
        }

        $prefsNeedCleanup = false;
        $metadataNeedsRepair = false;
        foreach ([$dockerIntegrity, $vmIntegrity] as $integrity) {
            $metadataNeedsRepair = $metadataNeedsRepair
                || ((int)($integrity['configurationMetadata']['issuesCount'] ?? 0)) > 0;
            $prefsNeedCleanup = $prefsNeedCleanup
                || ((int)($integrity['invalidAutoRules']['count'] ?? 0)) > 0
                || ((int)($integrity['invalidFolderRegex']['count'] ?? 0)) > 0
                || ((int)($integrity['invalidFolderIconPaths']['count'] ?? 0)) > 0
                || ((int)($integrity['missingPinnedFolderIds']['count'] ?? 0)) > 0
                || ((int)($integrity['missingManualOrderIds']['count'] ?? 0)) > 0;
            if ($prefsNeedCleanup) {
                break;
            }
        }
        if ($prefsNeedCleanup) {
            $addAction(
                'normalize_prefs',
                'Validate and normalize prefs',
                'Folder rules or saved preference ids need cleanup.'
            );
        }
        if ($metadataNeedsRepair) {
            $addAction(
                'repair_config_metadata',
                'Rebuild configuration metadata',
                'Saved configuration fingerprints or revisions need to be reconciled.'
            );
        }

        $pathIssues = [];
        foreach (['docker', 'vm'] as $type) {
            $integrity = is_array($typesData[$type]['integrityChecks'] ?? null)
                ? $typesData[$type]['integrityChecks']
                : [];
            foreach ((array)($integrity['pathHealth']['issues'] ?? []) as $issue) {
                $text = trim((string)$issue);
                if ($text !== '') {
                    $pathIssues[] = $text;
                }
            }
        }
        $customIconIssues = array_values(array_filter(array_map('strval', (array)($customIcons['issues'] ?? []))));
        if (!empty($pathIssues) || !empty($customIconIssues)) {
            $reason = !empty($pathIssues)
                ? 'Plugin paths or permissions need repair.'
                : 'Custom icon storage reported problems.';
            if (!empty($pathIssues) && !empty($customIconIssues)) {
                $reason .= ' Custom icon storage also reported problems.';
            }
            $addAction(
                'repair_paths',
                'Repair plugin paths',
                $reason
            );
        }
        if (((int)($customIcons['missingReferenceCount'] ?? 0)) > 0) {
            $addAction(
                'repair_missing_custom_icons',
                'Reset missing custom icon refs',
                'Some folders still point to uploaded icons that no longer exist.'
            );
        }

        return array_values($actions);
    }

    function diagnosticsBuildOverviewSummary(
        array $typesData,
        array $customIcons,
        array $update,
        array $runtimeIntegrity = [],
        array $securityAudit = []
    ): array {
        $cards = [];
        $errorCount = 0;
        $warningCount = 0;
        $totalIssues = 0;
        $pathIssues = [];

        foreach (['docker' => 'Docker config', 'vm' => 'VM config'] as $type => $label) {
            $typeData = is_array($typesData[$type] ?? null) ? $typesData[$type] : [];
            $integrity = is_array($typeData['integrityChecks'] ?? null) ? $typeData['integrityChecks'] : [];
            $issueCount = max(0, (int)($integrity['issuesCount'] ?? 0));
            $folderCount = max(0, (int)($typeData['folderCount'] ?? 0));
            $ruleCount = max(0, (int)($typeData['ruleCount'] ?? 0));
            $backupCount = max(0, (int)($typeData['backupCount'] ?? 0));
            $typePathIssues = array_values(array_filter(array_map('strval', (array)($integrity['pathHealth']['issues'] ?? []))));
            $primaryIssueDetail = $issueCount > 0 ? diagnosticsBuildIntegrityIssueDetail($integrity) : '';
            $pathIssues = array_merge($pathIssues, $typePathIssues);

            $status = $issueCount > 0 ? 'error' : 'healthy';
            if ($status === 'error') {
                $errorCount++;
                $totalIssues += $issueCount;
            }

            $cards[] = diagnosticsBuildSummaryCard(
                $type,
                $label,
                $status,
                $issueCount > 0 ? sprintf('%d issue(s) need attention.', $issueCount) : 'No issues detected.',
                $issueCount > 0 && $primaryIssueDetail !== ''
                    ? $primaryIssueDetail
                    : sprintf('%d folder(s), %d rule(s), %d backup(s).', $folderCount, $ruleCount, $backupCount),
                ['count' => $issueCount]
            );
        }

        if (($runtimeIntegrity['status'] ?? 'unavailable') === 'critical') {
            $pathIssues[] = (string)($runtimeIntegrity['reason'] ?? 'Installed runtime integrity verification failed.');
        }
        if (($securityAudit['status'] ?? 'unavailable') === 'critical') {
            $pathIssues[] = 'The security audit chain failed integrity verification.';
        }
        $pathIssues = array_values(array_unique(array_filter(array_map('strval', $pathIssues))));
        $pathIssueCount = count($pathIssues);
        if ($pathIssueCount > 0) {
            $errorCount++;
        }
        $cards[] = diagnosticsBuildSummaryCard(
            'storage',
            'Storage and paths',
            $pathIssueCount > 0 ? 'error' : 'healthy',
            $pathIssueCount > 0 ? sprintf('%d path or permission issue(s) detected.', $pathIssueCount) : 'Paths look healthy.',
            $pathIssueCount > 0
                ? implode(' ', array_slice($pathIssues, 0, 2))
                : (($runtimeIntegrity['status'] ?? 'unavailable') === 'healthy'
                    ? 'Folder maps, prefs, backups, and installed runtime files passed integrity checks.'
                    : 'Folder maps, prefs, and backups look readable and writable.'),
            ['count' => $pathIssueCount]
        );

        $customIconIssues = array_values(array_filter(array_map('strval', (array)($customIcons['issues'] ?? []))));
        $customIconIssueCount = count($customIconIssues);
        $orphanedIconCount = max(0, (int)($customIcons['orphanedIconCount'] ?? 0));
        $iconStatus = $customIconIssueCount > 0 ? 'error' : ($orphanedIconCount > 0 ? 'warning' : 'healthy');
        if ($iconStatus === 'error') {
            $errorCount++;
            $totalIssues += $customIconIssueCount;
        } elseif ($iconStatus === 'warning') {
            $warningCount++;
        }
        $cards[] = diagnosticsBuildSummaryCard(
            'custom_icons',
            'Custom icons',
            $iconStatus,
            $customIconIssueCount > 0
                ? sprintf('%d storage issue(s) detected.', $customIconIssueCount)
                : ($orphanedIconCount > 0 ? sprintf('%d orphaned icon(s) found.', $orphanedIconCount) : 'Custom icon storage looks healthy.'),
            $customIconIssueCount > 0
                ? implode(' ', array_slice($customIconIssues, 0, 2))
                : ($orphanedIconCount > 0
                    ? 'Unused custom icons can be cleaned up later if needed.'
                    : sprintf('%d icon file(s) tracked.', max(0, (int)($customIcons['fileCount'] ?? 0)))),
            ['count' => $customIconIssueCount > 0 ? $customIconIssueCount : $orphanedIconCount]
        );

        $updateOk = (bool)($update['ok'] ?? false);
        $updateAvailable = (bool)($update['updateAvailable'] ?? false);
        $updateStatus = !$updateOk ? 'warning' : ($updateAvailable ? 'warning' : 'healthy');
        if ($updateStatus === 'warning') {
            $warningCount++;
        }
        $cards[] = diagnosticsBuildSummaryCard(
            'update',
            'Update check',
            $updateStatus,
            !$updateOk
                ? 'Update check failed.'
                : ($updateAvailable
                    ? sprintf('Update available: %s', (string)($update['remoteVersion'] ?? 'unknown'))
                    : 'Plugin is up to date.'),
            !$updateOk
                ? (string)($update['error'] ?? 'Unable to reach the remote manifest.')
                : ($updateAvailable
                    ? sprintf('Current %s, remote %s.', (string)($update['currentVersion'] ?? 'unknown'), (string)($update['remoteVersion'] ?? 'unknown'))
                    : sprintf('Current version %s.', (string)($update['currentVersion'] ?? 'unknown'))),
            ['count' => $updateAvailable ? 1 : 0]
        );

        $status = diagnosticsSummaryStatusFromCounts($errorCount, $warningCount);
        $headline = $totalIssues > 0
            ? sprintf('Detected %d issue(s) that may affect FolderView Plus.', $totalIssues)
            : ($warningCount > 0
                ? 'Plugin is healthy, but there are a few follow-up items.'
                : 'No major plugin health issues detected.');
        $detail = $totalIssues > 0
            ? 'Start with the suggested fixes below. If the problem continues, copy the issue report or export a support bundle.'
            : ($warningCount > 0
                ? 'Review the warning cards below, then decide if any follow-up is needed.'
                : 'Use support exports only if you need to share diagnostics with someone else.');

        return [
            'status' => $status,
            'headline' => $headline,
            'detail' => $detail,
            'errorCount' => $errorCount,
            'warningCount' => $warningCount,
            'totalIssues' => $totalIssues,
            'cards' => $cards,
            'recommendedActions' => diagnosticsBuildRecommendedActions($typesData, $customIcons)
        ];
    }
