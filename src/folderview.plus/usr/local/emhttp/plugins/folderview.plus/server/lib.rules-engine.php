<?php
    function serverRuleRegex(string $pattern): string {
        $translated = '';
        for ($index = 0, $length = strlen($pattern); $index < $length; $index++) {
            if ($pattern[$index] === '\\' && $index + 1 < $length) {
                if ($pattern[$index + 1] === '\\') {
                    $translated .= '\\\\'; $index++; continue;
                }
                if (preg_match('/\A\\\\u\{([a-fA-F0-9]{1,6})\}/', substr($pattern, $index), $match)) {
                    $translated .= '\\x{' . $match[1] . '}'; $index += strlen($match[0]) - 1; continue;
                }
                if (preg_match('/\A\\\\u([a-fA-F0-9]{4})/', substr($pattern, $index), $match)) {
                    $point = hexdec($match[1]); $index += 5;
                    if ($point >= 0xd800 && $point <= 0xdbff && preg_match('/\A\\\\u([dD][c-fC-F][a-fA-F0-9]{2})/', substr($pattern, $index + 1), $low)) {
                        $point = 0x10000 + (($point - 0xd800) << 10) + hexdec($low[1]) - 0xdc00; $index += 6;
                    }
                    $translated .= '\\x{' . dechex($point) . '}'; continue;
                }
                if ($pattern[$index + 1] === 'v') { $translated .= '\\x{b}'; $index++; continue; }
                $translated .= $pattern[$index] . $pattern[++$index]; continue;
            }
            $translated .= $pattern[$index];
        }
        foreach (['~', '#', '%', '!', ';', '@', chr(1)] as $delimiter) {
            if (strpos($translated, $delimiter) === false) return $delimiter . $translated . $delimiter . 'u';
        }
        return '~(?!)~';
    }

    function serverRegexMatches(string $pattern, string $input): bool {
        return $pattern !== '' && @preg_match(serverRuleRegex($pattern), $input) === 1;
    }

    function dockerInfoLabelsForName(array $infoByName, string $name): array {
        $item = $infoByName[$name] ?? null;
        if (!is_array($item)) {
            return [];
        }
        if (isset($item['Labels']) && is_array($item['Labels'])) {
            return $item['Labels'];
        }
        if (isset($item['info']['Config']['Labels']) && is_array($item['info']['Config']['Labels'])) {
            return $item['info']['Config']['Labels'];
        }
        return [];
    }

    function dockerInfoImageForName(array $infoByName, string $name): string {
        $item = $infoByName[$name] ?? null;
        if (!is_array($item)) {
            return '';
        }
        if (isset($item['image']) || isset($item['Image'])) return (string)($item['image'] ?? $item['Image']);
        if (isset($item['info']['Config']['Image'])) {
            return (string)$item['info']['Config']['Image'];
        }
        if (isset($item['Image'])) {
            return (string)$item['Image'];
        }
        return '';
    }

    function dockerInfoComposeProjectForName(array $infoByName, string $name): string {
        $labels = dockerInfoLabelsForName($infoByName, $name);
        return getComposeProjectValueFromLabels($labels);
    }

    function autoRuleMatchesItem(array $rule, string $name, array $infoByName, string $type, ?string $compiledRegex = null): bool {
        $kind = (string)($rule['kind'] ?? 'name_regex');
        if ($kind === 'name_regex') {
            return $compiledRegex === null ? serverRegexMatches((string)($rule['pattern'] ?? ''), $name) : @preg_match($compiledRegex, $name) === 1;
        }
        if ($type !== 'docker') {
            return false;
        }
        if ($kind === 'label') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            if ($labelKey === '') {
                return false;
            }
            $labels = dockerInfoLabelsForName($infoByName, $name);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            $expected = (string)($rule['labelValue'] ?? '');
            return $expected === '' || (string)$labels[$labelKey] === $expected;
        }
        if ($kind === 'label_contains') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            $expected = (string)($rule['labelValue'] ?? '');
            if ($labelKey === '' || $expected === '') {
                return false;
            }
            $labels = dockerInfoLabelsForName($infoByName, $name);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            return @preg_match('/' . preg_quote($expected, '/') . '/iu', (string)$labels[$labelKey]) === 1;
        }
        if ($kind === 'label_starts_with') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            $expected = (string)($rule['labelValue'] ?? '');
            if ($labelKey === '' || $expected === '') {
                return false;
            }
            $labels = dockerInfoLabelsForName($infoByName, $name);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            return @preg_match('/^' . preg_quote($expected, '/') . '/iu', (string)$labels[$labelKey]) === 1;
        }
        if ($kind === 'image_regex') {
            return $compiledRegex === null ? serverRegexMatches((string)($rule['pattern'] ?? ''), dockerInfoImageForName($infoByName, $name)) : @preg_match($compiledRegex, dockerInfoImageForName($infoByName, $name)) === 1;
        }
        if ($kind === 'compose_project_regex') {
            return $compiledRegex === null ? serverRegexMatches((string)($rule['pattern'] ?? ''), dockerInfoComposeProjectForName($infoByName, $name)) : @preg_match($compiledRegex, dockerInfoComposeProjectForName($infoByName, $name)) === 1;
        }
        return false;
    }



    function fvplusRulePatternIsPortable(string $pattern): bool {
        $class = false; $length = strlen($pattern);
        for ($index = 0; $index < $length; $index++) {
            $char = $pattern[$index];
            if ($char === '\\') {
                if (++$index >= $length) return false;
                if ((ctype_alpha($pattern[$index]) && strpos('bBcdDfnrstvwWxupPk', $pattern[$index]) === false) || ($pattern[$index] === 'x' && ($pattern[$index + 1] ?? '') === '{')) return false;
                $escape = $pattern[$index]; $tail = substr($pattern, $index + 1);
                $arguments = [
                    'p' => '/\A\{(?:[LMNPSZC][a-z]?|(?:Script|Script_Extensions|General_Category)=[A-Za-z_]+|ASCII|Any|Assigned|Alphabetic|Lowercase|Uppercase|White_Space|ID_Start|ID_Continue)\}/',
                    'P' => '/\A\{(?:[LMNPSZC][a-z]?|(?:Script|Script_Extensions|General_Category)=[A-Za-z_]+|ASCII|Any|Assigned|Alphabetic|Lowercase|Uppercase|White_Space|ID_Start|ID_Continue)\}/',
                    'k' => '/\A<[A-Za-z_$][A-Za-z0-9_$]*>/', 'c' => '/\A[A-Za-z]/',
                    'x' => '/\A[0-9a-fA-F]{2}/', 'u' => '/\A(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]{1,6}\})/'
                ];
                if (isset($arguments[$escape])) {
                    if (!preg_match($arguments[$escape], $tail, $token)) return false;
                    $index += strlen($token[0]);
                }
                if (!ctype_alnum($escape) && strpos('^$\\.*+?()[]{}|/', $escape) === false && !($class && $escape === '-')) return false;
                if ($escape === '0' && preg_match('/\A[0-9]/', $tail)) return false;
                continue;
            }
            if ($char === '[' && !$class) { $class = true; continue; }
            if ($char === ']' && $class) { $class = false; continue; }
            if ($class) continue;
            if ($char === '(' && ($pattern[$index + 1] ?? '') === '*') return false;
            if ($char === '(' && ($pattern[$index + 1] ?? '') === '?' && !preg_match('/\A\(\?(?:[:=!]|<[=!]|<[A-Za-z_$][A-Za-z0-9_$]*>)/', substr($pattern, $index))) return false;
            if (strpos('*+?}', $char) !== false && ($pattern[$index + 1] ?? '') === '+') return false;
        }
        return true;
    }

    function fvplusCompileRuleSet(array $rules, string $type, ?array $folders = null): array {
        $compiled = []; $issues = [];
        foreach ($rules as $index => $rule) {
            if (is_array($rule) && !normalizeBool($rule['enabled'] ?? true, true)) continue;
            $kind = is_array($rule) ? (string)($rule['kind'] ?? 'name_regex') : '';
            $target = is_array($rule) ? (string)($rule['folderId'] ?? '') : '';
            if (is_array($rule) && ($rule['effect'] ?? 'include') !== 'exclude' && $folders !== null && !array_key_exists($target, $folders)) {
                $issues[] = ['index' => $index, 'code' => 'missing-target']; continue;
            }
            $regex = null; $valid = in_array($kind, FVPLUS_RULE_KINDS, true) && ($type === 'docker' || $kind === 'name_regex');
            if (in_array($kind, ['name_regex', 'image_regex', 'compose_project_regex'], true)) {
                $pattern = (string)($rule['pattern'] ?? '');
                $regex = serverRuleRegex($pattern);
                // PCRE-only constructs have no matching browser rule meaning.
                $valid = $valid && $pattern !== '' && @preg_match($regex, '') !== false
                    && fvplusRulePatternIsPortable($pattern);
            } else {
                $valid = $valid && (string)($rule['labelKey'] ?? '') !== ''
                    && ($kind === 'label' || (string)($rule['labelValue'] ?? '') !== '');
            }
            if (!$valid) { $issues[] = ['index' => $index, 'code' => 'invalid-predicate']; continue; }
            $compiled[] = ['rule' => $rule, 'regex' => $regex];
        }
        return ['compiled' => $compiled, 'issues' => $issues];
    }

    function fvplusEvaluateRules(array $compiled, string $name, array $info, string $type): array {
        foreach ($compiled as $entry) {
            $rule = $entry['rule'];
            if (!autoRuleMatchesItem($rule, $name, $info, $type, $entry['regex'])) continue;
            $exclude = ($rule['effect'] ?? 'include') === 'exclude';
            return ['assignedRule' => $exclude ? null : $rule, 'blockedBy' => $exclude ? $rule : null, 'matchedRule' => $rule];
        }
        return ['assignedRule' => null, 'blockedBy' => null, 'matchedRule' => null];
    }

    function autoRuleDecision(array $rules, string $name, array $infoByName, string $type, ?array $folders = null): array {
        return fvplusEvaluateRules(fvplusCompileRuleSet($rules, $type, $folders)['compiled'], $name, $infoByName, $type);
    }

    function fvplusBuildMembershipSnapshot(string $type, array $folders, array $rules, array $info, ?array $names = null, ?array $displayFolderIds = null): array {
        $names = array_values(array_filter(array_unique(array_merge($names ?? [], array_keys($info))), static fn($name): bool => array_key_exists($name, $info)));
        $info = fvplusRuleFacts($info, $rules);
        $program = fvplusCompileRuleSet($rules, $type, $folders); $decisions = [];
        foreach ($names as $name) $decisions[$name] = fvplusEvaluateRules($program['compiled'], (string)$name, $info, $type);
        $legacy = buildLegacyFolderMembership($folders, $names, $info, $type, $rules, $decisions);
        $byFolder = []; $matchCache = []; $primary = []; $issues = $program['issues'];
        foreach ($folders as $id => $folder) {
            $manual = normalizeFolderMembers($folder['containers'] ?? []); $reasons = [];
            $buckets = ['explicit' => array_values(array_filter($manual, static fn($name): bool => array_key_exists($name, $info))), 'regex' => [], 'label' => [], 'rules' => []];
            foreach ($manual as $name) $reasons[$name] = ['manual'];
            $pattern = (string)($folder['regex'] ?? '');
            $regex = '/' . str_replace('/', '\\/', $pattern) . '/';
            if ($pattern !== '' && @preg_match($regex, '') === false) $issues[] = ['folderId' => (string)$id, 'code' => 'invalid-legacy-regex'];
            foreach ($names as $name) {
                if ($pattern !== '' && @preg_match($regex, (string)$name) === 1) { $buckets['regex'][] = (string)$name; $reasons[$name][] = 'regex'; }
                if ($type === 'docker' && (string)($folder['name'] ?? '') !== '' && getFolderLabelValueFromLabels(dockerInfoLabelsForName($info, (string)$name)) === (string)$folder['name']) {
                    $buckets['label'][] = (string)$name; $reasons[$name][] = 'label';
                }
                if ((string)($decisions[$name]['assignedRule']['folderId'] ?? '') === (string)$id) { $buckets['rules'][] = (string)$name; $reasons[$name][] = 'rule'; }
            }
            if (array_key_exists($id, $legacy)) {
                $reasons = []; foreach ($legacy[$id] as $name) $reasons[$name] = ['legacy'];
                $buckets = ['explicit' => $legacy[$id], 'regex' => [], 'label' => [], 'rules' => []];
            }
            $members = array_map('strval', array_keys($reasons));
            $live = array_values(array_unique(array_merge(...array_values($buckets))));
            $byFolder[$id] = ['parentId' => (string)($folder['parentId'] ?? ''), 'manualMembers' => $manual, 'members' => $members, 'liveMembers' => $live, 'displayMembers' => [], 'reasonsByName' => $reasons];
            $matchCache[$id] = $buckets;
        }
        $displayFolderIds = array_values(array_unique(array_map('strval', array_merge($displayFolderIds ?? [], array_keys($folders)))));
        foreach ($displayFolderIds as $id) {
            if (!array_key_exists($id, $byFolder)) continue;
            foreach ($byFolder[$id]['liveMembers'] as $name) if (!array_key_exists($name, $primary)) {
                $primary[$name] = $id; $byFolder[$id]['displayMembers'][] = (string)$name;
            }
        }
        return ['schemaVersion' => 1, 'type' => $type, 'displayFolderIds' => $displayFolderIds, 'names' => $names, 'decisionsByName' => $decisions, 'byFolder' => $byFolder,
            'factsByName' => $info, 'matchCache' => $matchCache, 'primaryOwnerByName' => $primary, 'issues' => $issues];
    }

    function fvplusRuleFacts(array $info, array $rules = []): array {
        $facts = [];
        $labelKeys = array_fill_keys(FVPLUS_DOCKER_FOLDER_LABEL_KEYS, true);
        foreach ($rules as $rule) {
            if (($rule['enabled'] ?? true) === false) continue;
            if (strpos((string)($rule['kind'] ?? ''), 'label') === 0 && (string)($rule['labelKey'] ?? '') !== '') $labelKeys[(string)$rule['labelKey']] = true;
            if (($rule['kind'] ?? '') === 'compose_project_regex') foreach (['com.docker.compose.project', 'com.docker.compose.project.working_dir', 'com.docker.compose.project.config_files'] as $key) $labelKeys[$key] = true;
        }
        foreach ($info as $name => $item) {
            $labels = array_intersect_key(dockerInfoLabelsForName($info, (string)$name), $labelKeys); ksort($labels, SORT_STRING);
            $facts[$name] = ['id' => (string)($item['id'] ?? $item['Id'] ?? $item['uuid'] ?? $item['info']['Id'] ?? ''),
                'Labels' => $labels, 'Image' => dockerInfoImageForName($info, (string)$name)];
        }
        return $facts;
    }

    function fvplusRulesInputDigest(string $type, array $folders, array $rules, array $info): string {
        $configuration = [];
        foreach ($folders as $id => $folder) $configuration[] = [(string)$id, (string)($folder['name'] ?? ''), (string)($folder['parentId'] ?? ''),
            (string)($folder['membershipPolicy'] ?? ''), normalizeFolderMembers($folder['containers'] ?? []), (string)($folder['regex'] ?? '')];
        $facts = fvplusRuleFacts($info, $rules); ksort($facts, SORT_STRING);
        return hash('sha256', json_encode([1, $type, $configuration, $rules, $facts], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
    }
