<?php
function getDockerTemplateCachePath(): string {
        return fv3_cache_root() . '/docker-template-index/cache.json';
    }

    function buildDockerTemplateSignature(array $templateFiles): string {
        $parts = [];
        foreach ($templateFiles as $templateFile) {
            $path = trim((string)($templateFile['path'] ?? ''));
            if ($path === '') {
                continue;
            }
            $parts[] = $path . '|' . (int)@filemtime($path) . '|' . (int)@filesize($path);
        }
        sort($parts, SORT_STRING);
        return hash('sha256', implode("\n", $parts));
    }

    function readDockerTemplateCache(string $signature): ?array {
        $payload = fv3_read_json_cache_payload(getDockerTemplateCachePath());
        if (!is_array($payload)) {
            return null;
        }
        if (($payload['signature'] ?? '') !== $signature) {
            return null;
        }
        $generatedAt = strtotime((string)($payload['generatedAt'] ?? ''));
        if ($generatedAt <= 0 || (time() - $generatedAt) > FVPLUS_DOCKER_TEMPLATE_CACHE_TTL) {
            return null;
        }
        $templates = $payload['templates'] ?? null;
        return is_array($templates) ? $templates : null;
    }

    function writeDockerTemplateCache(string $signature, array $templates): void {
        fv3_write_json_cache_payload(getDockerTemplateCachePath(), [
            'signature' => $signature,
            'generatedAt' => gmdate('c'),
            'templates' => $templates
        ]);
    }

    function buildDockerTemplateIndex(array $templateFiles): array {
        $allXmlTemplates = [];
        foreach ($templateFiles as $templateFile) {
            $path = trim((string)($templateFile['path'] ?? ''));
            if ($path === '' || !is_file($path)) {
                continue;
            }
            $doc = new DOMDocument();
            if (!@$doc->load($path)) {
                continue;
            }
            $templateName = trim((string)($doc->getElementsByTagName('Name')->item(0)->nodeValue ?? ''));
            $templateImage = DockerUtil::ensureImageTag((string)($doc->getElementsByTagName('Repository')->item(0)->nodeValue ?? ''));
            if ($templateName === '' || $templateImage === '') {
                continue;
            }
            $allXmlTemplates[$templateName . '|' . $templateImage] = [
                'WebUi' => trim((string)($doc->getElementsByTagName('WebUI')->item(0)->nodeValue ?? '')),
                'TSUrlRaw' => trim((string)($doc->getElementsByTagName('TailscaleWebUI')->item(0)->nodeValue ?? '')),
                'TSServeMode' => trim((string)($doc->getElementsByTagName('TailscaleServe')->item(0)->nodeValue ?? 'no')),
                'TSTailscaleEnabled' => strtolower(trim((string)($doc->getElementsByTagName('TailscaleEnabled')->item(0)->nodeValue ?? 'false'))) === 'true',
                'registry' => trim((string)($doc->getElementsByTagName('Registry')->item(0)->nodeValue ?? '')),
                'Support' => trim((string)($doc->getElementsByTagName('Support')->item(0)->nodeValue ?? '')),
                'Project' => trim((string)($doc->getElementsByTagName('Project')->item(0)->nodeValue ?? '')),
                'DonateLink' => trim((string)($doc->getElementsByTagName('DonateLink')->item(0)->nodeValue ?? '')),
                'ReadMe' => trim((string)($doc->getElementsByTagName('ReadMe')->item(0)->nodeValue ?? '')),
                'Shell' => trim((string)($doc->getElementsByTagName('Shell')->item(0)->nodeValue ?? 'sh')),
                'path' => $path
            ];
        }
        return $allXmlTemplates;
    }

    function readInfoState(string $type, bool $preferLiveUpdateStatus = false): array {
        $type = ensureType($type);
        $info = [];

        if ($type === 'docker') {
            global $dockerManPaths;
            $dockerClient = new DockerClient();
            $dockerUpdate = $preferLiveUpdateStatus ? new DockerUpdate() : null;
            $containers = $dockerClient->getDockerJSON("/containers/json?all=1");
            if (!is_array($containers)) {
                return [];
            }

            $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
            $dockerWebuiInfo = readDockerWebuiInfoCache();
            $autoStartSet = [];
            foreach ($autoStartLines as $line) {
                $trimmed = trim((string)$line);
                if ($trimmed === '') {
                    continue;
                }
                $parts = preg_split('/\s+/', $trimmed, 2);
                $name = trim((string)($parts[0] ?? ''));
                if ($name !== '') {
                    $autoStartSet[$name] = true;
                }
            }

            foreach ($containers as $container) {
                $name = ltrim((string)($container['Names'][0] ?? ''), '/');
                if ($name === '') {
                    continue;
                }
                $labels = is_array($container['Labels'] ?? null) ? $container['Labels'] : [];
                $stateRaw = strtolower(trim((string)($container['State'] ?? '')));
                $statusRaw = trim((string)($container['Status'] ?? ''));
                $running = $stateRaw === 'running';
                $paused = ($stateRaw === 'paused') || (stripos($statusRaw, 'paused') !== false);
                $stateKind = $running ? ($paused ? 'paused' : 'running') : 'stopped';
                $manager = getNormalizedDockerManagerFromLabels($labels);
                $containerImage = DockerUtil::ensureImageTag(trim((string)($container['Image'] ?? '')));
                $webuiMetadata = resolveDockerLightweightWebuiMetadata($labels, $manager);

                $info[$name] = [
                    'name' => $name,
                    'id' => substr(str_replace('sha256:', '', (string)($container['Id'] ?? '')), 0, 12),
                    'shortImageId' => substr(str_replace('sha256:', '', (string)($container['ImageID'] ?? '')), 0, 12),
                    'Image' => trim((string)($container['Image'] ?? '')),
                    'Labels' => $labels,
                    'Mounts' => is_array($container['Mounts'] ?? null) ? $container['Mounts'] : [],
                    'state' => $stateKind,
                    'running' => $running,
                    'paused' => $paused,
                    'status' => $statusRaw,
                    'autostart' => isset($autoStartSet[$name]),
                    'Updated' => $manager === 'dockerman'
                        ? ($preferLiveUpdateStatus
                            ? resolveDockerUpdatedStateValue($name, $containerImage, $dockerWebuiInfo, $dockerUpdate)
                            : resolveDockerCachedUpdatedStateValue($name, $dockerWebuiInfo))
                        : null,
                    'manager' => $manager,
                    'composeProject' => getComposeProjectValueFromLabels($labels),
                    'folderLabel' => getFolderLabelValueFromLabels($labels),
                    'WebUi' => $webuiMetadata['WebUi'],
                    'TSWebUi' => $webuiMetadata['TSWebUi'],
                    'Shell' => $webuiMetadata['Shell'],
                    'webuiCapability' => $webuiMetadata['webuiCapability'],
                    'webuiHydrationPending' => $webuiMetadata['webuiHydrationPending']
                ];
            }
            ksort($info);
            return $info;
        }

        if ($type === 'vm') {
            global $lv;
            if (!isset($lv)) {
                $lv = new Libvirt();
                if (!$lv->connect()) {
                    return [];
                }
            }
            $vms = $lv->get_domains();
            if (!is_array($vms)) {
                return [];
            }
            foreach ($vms as $vm) {
                $res = $lv->get_domain_by_name($vm);
                if (!$res) {
                    continue;
                }
                $dom = $lv->domain_get_info($res);
                if (!is_array($dom)) {
                    continue;
                }
                $state = strtolower(trim((string)$lv->domain_state_translate($dom['state'] ?? '')));
                if ($state === '') {
                    $state = 'stopped';
                }
                $name = trim((string)$vm);
                if ($name === '') {
                    continue;
                }
                $info[$name] = [
                    'name' => $name,
                    'uuid' => (string)$lv->domain_get_uuid($res),
                    'state' => $state,
                    'autostart' => (bool)$lv->domain_get_autostart($res)
                ];
            }
            ksort($info);
            return $info;
        }

        return [];
    }

    function readInfo(string $type): array {
        fv3_debug_log("readInfo called for type: $type");
        $info = [];
        if ($type == "docker") {
            global $dockerManPaths, $documentRoot;
            global $driver, $host;
            if (!isset($driver) || !is_array($driver)) { $driver = DockerUtil::driver(); fv3_debug_log("Initialized \$driver: " . json_encode($driver)); }
            if (!isset($host)) { $host = DockerUtil::host(); fv3_debug_log("Initialized \$host: " . $host); }

            $dockerClient = new DockerClient();
            $DockerUpdate = new DockerUpdate();
            $dockerTemplates = new DockerTemplates();

            $cts = $dockerClient->getDockerJSON("/containers/json?all=1");
            if (!is_array($cts)) {
                fv3_debug_log("readInfo: Docker container list unavailable.");
                return [];
            }
            $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
            $autoStart = array_map('var_split', $autoStartLines);
            $dockerWebuiInfo = readDockerWebuiInfoCache();

            // Remove stale entries from autostart file (containers that no longer exist)
            $allCtNames = array_map(function($c) { return ltrim($c['Names'][0] ?? '', '/'); }, $cts);
            $cleanedLines = array_filter($autoStartLines, function($line) use ($allCtNames) {
                $parts = explode(' ', $line, 2);
                return in_array($parts[0], $allCtNames);
            });
            if (count($cleanedLines) < count($autoStartLines)) {
                writeDurableFileAtomic($autoStartFile, implode("\n", $cleanedLines) . "\n");
                fv3_debug_log("readInfo: removed " . (count($autoStartLines) - count($cleanedLines)) . " stale autostart entries");
                $autoStart = array_map('var_split', $cleanedLines);
            }

            $allXmlTemplates = getDockerTemplateIndexCached($dockerTemplates);

            foreach ($cts as $key => &$ct) {
                $ct['info'] = $dockerClient->getContainerDetails($ct['Id'] ?? null);
                if (empty($ct['info'])) { fv3_debug_log("Skipped container due to empty details: ID " . ($ct['Id'] ?? 'N/A')); continue; }

                $containerLabels = is_array($ct['Labels'] ?? null) ? $ct['Labels'] : [];
                $configLabels = is_array($ct['info']['Config']['Labels'] ?? null) ? $ct['info']['Config']['Labels'] : [];
                if (empty($containerLabels) && !empty($configLabels)) {
                    $containerLabels = $configLabels;
                }
                $containerName = ltrim((string)($ct['info']['Name'] ?? ''), '/');
                if ($containerName === '') {
                    fv3_debug_log("Skipped container due to missing name: ID " . ($ct['Id'] ?? 'N/A'));
                    continue;
                }
                $ct['info']['Name'] = $containerName;
                fv3_debug_log("Processing Container: $containerName (ID: " . ($ct['Id'] ?? 'N/A') . ")");

                $ct['info']['State']['Autostart'] = in_array($containerName, $autoStart);
                $containerImage = DockerUtil::ensureImageTag((string)($ct['info']['Config']['Image'] ?? ''));
                $ct['info']['Config']['Image'] = $containerImage;
                $ct['info']['State']['manager'] = getNormalizedDockerManagerFromLabels($containerLabels);
                $ct['info']['State']['Updated'] = $ct['info']['State']['manager'] === 'dockerman'
                    ? resolveDockerUpdatedStateValue($containerName, $containerImage, $dockerWebuiInfo, $DockerUpdate)
                    : null;
                $ct['shortId'] = substr(str_replace('sha256:', '', (string)($ct['Id'] ?? '')), 0, 12);
                $ct['shortImageId'] = substr(str_replace('sha256:', '', (string)($ct['ImageID'] ?? '')), 0, 12);
                $ct['info']['State']['WebUi'] = ''; $ct['info']['State']['TSWebUi'] = '';
                $ct['info']['Shell'] = 'sh'; $ct['info']['template'] = null;
                $rawWebUiString = ''; $rawTsXmlUrl = ''; $tsServeModeFromXml = 'no';
                $isTailscaleEnabledForContainer = false;

                $templateKey = $containerName . '|' . $ct['info']['Config']['Image'];
                $templateData = $allXmlTemplates[$templateKey] ?? null;

                if ($ct['info']['State']['manager'] == 'dockerman' && !is_null($templateData)) {
                    $rawWebUiString = $templateData['WebUi']; $rawTsXmlUrl = $templateData['TSUrlRaw'];
                    $tsServeModeFromXml = $templateData['TSServeMode'];
                    $isTailscaleEnabledForContainer = $templateData['TSTailscaleEnabled'];
                    $ct['info']['registry'] = $templateData['registry']; $ct['info']['Support'] = $templateData['Support']; $ct['info']['Project'] = $templateData['Project']; $ct['info']['DonateLink'] = $templateData['DonateLink']; $ct['info']['ReadMe'] = $templateData['ReadMe']; $ct['info']['Shell'] = $templateData['Shell'] ?: 'sh'; $ct['info']['template'] = ['path' => $templateData['path']];
                } else {
                    $rawWebUiString = (string)($containerLabels['net.unraid.docker.webui'] ?? '');
                    $rawTsXmlUrl = (string)($containerLabels['net.unraid.docker.tailscale.webui'] ?? '');
                    $tailscaleFunnelEnabled = strtolower(trim((string)($containerLabels['net.unraid.docker.tailscale.funnel'] ?? 'false'))) === 'true';
                    $tsServeModeFromXml = (string)($containerLabels['net.unraid.docker.tailscale.servemode'] ?? ($tailscaleFunnelEnabled ? 'funnel' : 'no'));
                    $isTailscaleEnabledForContainer = strtolower((string)($containerLabels['net.unraid.docker.tailscale.enabled'] ?? 'false')) === 'true';
                    $ct['info']['Shell'] = (string)($containerLabels['net.unraid.docker.shell'] ?? 'sh');
                }
                fv3_debug_log("  $containerName: Using ".($templateData && $ct['info']['State']['manager'] == 'dockerman' ? "XML" : "Label")." data. TailscaleEnabled: " . ($isTailscaleEnabledForContainer ? 'true' : 'false'));
                fv3_debug_log("    $containerName: Raw WebUI: '$rawWebUiString', Raw TS XML URL: '$rawTsXmlUrl', TS Serve Mode: '$tsServeModeFromXml'");

                // --- Populate $ct['info']['Ports'] ---
                $ct['info']['Ports'] = [];
                $currentNetworkMode = $ct['info']['HostConfig']['NetworkMode'] ?? ($ct['HostConfig']['NetworkMode'] ?? 'unknown');
                $currentNetworkDriver = $driver[$currentNetworkMode] ?? null;

                $containerIpAddress = null;
                if ($currentNetworkMode !== 'host' && $currentNetworkDriver !== 'bridge') {
                    $containerNetworks = is_array($ct['NetworkSettings']['Networks'] ?? null) ? $ct['NetworkSettings']['Networks'] : [];
                    $containerNetworkSettings = $containerNetworks[$currentNetworkMode] ?? null;
                    if ($containerNetworkSettings && !empty($containerNetworkSettings['IPAddress'])) { $containerIpAddress = $containerNetworkSettings['IPAddress']; }
                } elseif ($currentNetworkMode === 'host') {
                    $containerIpAddress = $host;
                }
                fv3_debug_log("  $containerName: NetworkMode: $currentNetworkMode, Driver: " . ($currentNetworkDriver ?: 'N/A') . ", ContainerIP (for custom/host): " . ($containerIpAddress ?: 'N/A'));
                fv3_debug_log("  $containerName: HostConfig.PortBindings: " . json_encode($ct['info']['HostConfig']['PortBindings'] ?? []));
                fv3_debug_log("  $containerName: Config.ExposedPorts: " . json_encode($ct['info']['Config']['ExposedPorts'] ?? []));

                if (isset($ct['info']['HostConfig']['PortBindings']) && is_array($ct['info']['HostConfig']['PortBindings']) && !empty($ct['info']['HostConfig']['PortBindings'])) {
                    fv3_debug_log("  $containerName: Processing HostConfig.PortBindings...");
                    foreach ($ct['info']['HostConfig']['PortBindings'] as $containerPortProtocol => $hostBindings) {
                        if (is_array($hostBindings) && !empty($hostBindings)) {
                            list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                            $protocol = strtoupper($protocol ?: 'TCP');
                            $hostBinding = $hostBindings[0];
                            $publicIp = ($hostBinding['HostIp'] === '0.0.0.0' || empty($hostBinding['HostIp'])) ? $host : $hostBinding['HostIp'];
                            $publicPort = $hostBinding['HostPort'] ?? null;

                            fv3_debug_log("    $containerName Binding: Private=$privatePort/$protocol, Public=$publicIp:" . ($publicPort ?: 'N/A'));
                            $ct['info']['Ports'][] = [
                                'PrivateIP'   => null, // For bridge mappings, the "private IP" is internal to Docker, not usually the container's specific IP on another net
                                'PrivatePort' => $privatePort,
                                'PublicIP'    => $publicIp,
                                'PublicPort'  => $publicPort,
                                'NAT'         => true,
                                'Type'        => $protocol
                            ];
                        }
                    }
                } elseif (isset($ct['info']['Config']['ExposedPorts']) && is_array($ct['info']['Config']['ExposedPorts'])) {
                    fv3_debug_log("  $containerName: Processing Config.ExposedPorts (Network: $currentNetworkMode)...");
                    foreach ($ct['info']['Config']['ExposedPorts'] as $containerPortProtocol => $emptyValue) {
                        list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                        $protocol = strtoupper($protocol ?: 'TCP');

                        $effectiveIp = null;
                        $effectivePort = $privatePort;

                        if ($currentNetworkMode === 'host') {
                            $effectiveIp = $host;
                        } elseif ($currentNetworkMode !== 'none' && $containerIpAddress) {
                            $effectiveIp = $containerIpAddress;
                        }

                        fv3_debug_log("    $containerName Exposed: Private=$privatePort/$protocol, EffectiveIP=" . ($effectiveIp ?: 'null') . ", EffectivePort=$effectivePort");
                        $ct['info']['Ports'][] = [
                            'PrivateIP'   => $containerIpAddress,
                            'PrivatePort' => $privatePort,
                            'PublicIP'    => $effectiveIp,
                            'PublicPort'  => $effectivePort,
                            'NAT'         => false,
                            'Type'        => $protocol
                        ];
                     }
                }

                if ($currentNetworkMode === 'none') {
                    fv3_debug_log("  $containerName: NetworkMode is 'none'. Adjusting public port aspects.");
                    $tempPorts = [];
                    if(isset($ct['info']['Config']['ExposedPorts']) && is_array($ct['info']['Config']['ExposedPorts'])){
                        foreach($ct['info']['Config']['ExposedPorts'] as $containerPortProtocol => $emptyValue) {
                            list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                            $protocol = strtoupper($protocol ?: 'TCP');
                            $tempPorts[] = [
                                'PrivateIP'   => null, // No specific container IP accessible
                                'PrivatePort' => $privatePort,
                                'PublicIP'    => null,
                                'PublicPort'  => null,
                                'NAT'         => false,
                                'Type'        => $protocol
                            ];
                        }
                    }
                    $ct['info']['Ports'] = $tempPorts;
                }
                ksort($ct['info']['Ports']);
                fv3_debug_log("  $containerName: Final ct[info][Ports]: " . json_encode($ct['info']['Ports']));

                $finalWebUi = '';
                if (!empty($rawWebUiString)) {
                    if (strpos($rawWebUiString, '[IP]') === false && strpos($rawWebUiString, '[PORT:') === false) { $finalWebUi = $rawWebUiString; }
                    else {
                        $webUiIp = $host;
                        if ($currentNetworkMode === 'host') { $webUiIp = $host; }
                        elseif ($currentNetworkDriver !== 'bridge' && $containerIpAddress) { $webUiIp = $containerIpAddress; }
                        if (strpos($currentNetworkMode, 'container:') === 0 || $currentNetworkMode === 'none') { $finalWebUi = ''; }
                        else {
                            $tempWebUi = str_replace("[IP]", $webUiIp ?: '', $rawWebUiString);
                            if (preg_match("%\[PORT:(\d+)\]%", $tempWebUi, $matches)) {
                                $internalPortFromTemplate = $matches[1]; $mappedPublicPort = $internalPortFromTemplate;
                                foreach ($ct['info']['Ports'] as $p) {
                                    if (isset($p['PrivatePort']) && $p['PrivatePort'] == $internalPortFromTemplate) {
                                        $isNatEquivalent = (($p['NAT'] ?? false) === true);
                                        $mappedPublicPort = ($isNatEquivalent && !empty($p['PublicPort'])) ? $p['PublicPort'] : $p['PrivatePort'];
                                        break;
                                    }
                                }
                                $tempWebUi = preg_replace("%\[PORT:\d+\]%", $mappedPublicPort, $tempWebUi);
                            }
                            $finalWebUi = $tempWebUi;
                        }
                    }
                }
                $ct['info']['State']['WebUi'] = $finalWebUi;
                fv3_debug_log("  $containerName: Resolved Standard WebUi: '$finalWebUi'");

                $finalTsWebUi = '';
                if ($isTailscaleEnabledForContainer) {
                    fv3_debug_log("  $containerName: Tailscale is ENABLED. Attempting to resolve TS WebUI.");
                    $baseTsTemplateFromHelper = '';
                    if (!empty($rawTsXmlUrl)) {
                        $baseTsTemplateFromHelper = generateTSwebui($rawTsXmlUrl, $tsServeModeFromXml, $rawWebUiString);
                    } elseif (!empty($ct['Labels']['net.unraid.docker.tailscale.webui'])) {
                        $baseTsTemplateFromHelper = $ct['Labels']['net.unraid.docker.tailscale.webui'];
                    }
                    fv3_debug_log("    $containerName: Base TS WebUI from generateTSwebui/label: '$baseTsTemplateFromHelper'");

                    if (!empty($baseTsTemplateFromHelper)) {
                        if (strpos($baseTsTemplateFromHelper, '[hostname]') !== false || strpos($baseTsTemplateFromHelper, '[HOSTNAME]') !== false) {
                            $tsFqdn = fv3_get_tailscale_fqdn_from_container($containerName, (bool)($ct['info']['State']['Running'] ?? false));
                            if ($tsFqdn) {
                                $finalTsWebUi = str_replace(["[hostname][magicdns]", "[HOSTNAME][MAGICDNS]"], $tsFqdn, $baseTsTemplateFromHelper);
                                if (strpos($baseTsTemplateFromHelper, 'http://[hostname]') === 0) {
                                    $finalTsWebUi = str_replace('http://', 'https://', $finalTsWebUi);
                                }
                            } else { fv3_debug_log("    $containerName: TS WebUI: Could not resolve [hostname] via exec."); $finalTsWebUi = ''; }
                        } elseif (strpos($baseTsTemplateFromHelper, '[noserve]') !== false || strpos($baseTsTemplateFromHelper, '[NOSERVE]') !== false) {
                            $tsIP = fv3_get_tailscale_ip_from_container($containerName, (bool)($ct['info']['State']['Running'] ?? false));
                            if ($tsIP) {
                                $finalTsWebUi = str_replace(["[noserve]", "[NOSERVE]"], $tsIP, $baseTsTemplateFromHelper);
                                $internalPortForTS = null;
                                if (preg_match('/\[PORT:(\d+)\]/i', $baseTsTemplateFromHelper, $portMatches)) {
                                    $internalPortForTS = $portMatches[1];
                                } elseif (preg_match('/\[PORT:(\d+)\]/i', $rawWebUiString, $portMatches)) {
                                    $internalPortForTS = $portMatches[1];
                                } elseif (preg_match('/:(\d+)/', $finalTsWebUi, $portMatchesNoserve)) {
                                    $internalPortForTS = $portMatchesNoserve[1];
                                }

                                if ($internalPortForTS !== null) {
                                   $finalTsWebUi = preg_replace('/\[PORT:\d+\]/i', $internalPortForTS, $finalTsWebUi);
                                   if (strpos($baseTsTemplateFromHelper, '[noserve]:[PORT:') === false && preg_match('/:(\d+)/', $baseTsTemplateFromHelper, $portMatchesRawBase)) {
                                       if ($portMatchesRawBase[1] != $internalPortForTS) {
                                          $finalTsWebUi = str_replace(":$portMatchesRawBase[1]", ":$internalPortForTS", $finalTsWebUi);
                                       }
                                   }
                                }
                            } else { fv3_debug_log("    $containerName: TS WebUI: Could not resolve [noserve] via exec."); $finalTsWebUi = ''; }
                        } else {
                            $finalTsWebUi = $baseTsTemplateFromHelper;
                        }
                    }
                } else {
                    fv3_debug_log("  $containerName: Tailscale is NOT enabled or no TS URL defined in template/label.");
                }
                $ct['info']['State']['TSWebUi'] = $finalTsWebUi;
                $ct['info']['State']['WebUiCapability'] = $rawWebUiString !== '' || $rawTsXmlUrl !== '';
                $ct['info']['State']['WebUiHydrationPending'] = false;
                fv3_debug_log("  $containerName: Resolved TS WebUi: '$finalTsWebUi'");

                $info[$containerName] = $ct;
            }
            unset($ct);

        } elseif ($type == "vm") {
            global $lv;
            if (!isset($lv)) {
                $lv = new Libvirt();
                if (!$lv->connect()) { fv3_debug_log("VM: Libvirt connection failed."); return []; }
            }
            $vms = $lv->get_domains();
            $vmCount = is_array($vms) ? count($vms) : 0;
            fv3_debug_log("VM: Found " . $vmCount . " VMs.");
            if (!is_array($vms)) {
                fv3_debug_log("VM: Domain list unavailable.");
                return [];
            }
            if (!empty($vms)) {
                foreach ($vms as $vm) {
                    $res = $lv->get_domain_by_name($vm);
                    if (!$res) { fv3_debug_log("VM: Could not get domain by name for $vm."); continue; }
                    $dom = $lv->domain_get_info($res);
                    if (!is_array($dom)) {
                        fv3_debug_log("VM: Could not get domain info for $vm.");
                        continue;
                    }
                    $vcpus = (int)($dom['nrVirtCpu'] ?? 0);
                    $memoryKiB = (int)($dom['memory'] ?? 0);
                    if ($memoryKiB <= 0) {
                        $memoryKiB = (int)($dom['maxMem'] ?? 0);
                    }
                    $storageBytes = 0;
                    if (method_exists($lv, 'domain_get_xml') && function_exists('simplexml_load_string')) {
                        $domainXml = @((string)$lv->domain_get_xml($res));
                        if ($domainXml !== '') {
                            $xml = @simplexml_load_string($domainXml);
                            if ($xml !== false && isset($xml->devices->disk)) {
                                foreach ($xml->devices->disk as $diskNode) {
                                    $deviceType = strtolower(trim((string)($diskNode['device'] ?? '')));
                                    if ($deviceType !== '' && $deviceType !== 'disk') {
                                        continue;
                                    }
                                    $sourcePath = trim((string)($diskNode->source['file'] ?? ''));
                                    if ($sourcePath === '') {
                                        continue;
                                    }
                                    $diskBytes = @filesize($sourcePath);
                                    if ($diskBytes !== false && $diskBytes > 0) {
                                        $storageBytes += (int)$diskBytes;
                                    }
                                }
                            }
                        }
                    }
                    $info[$vm] = [
                        'uuid' => $lv->domain_get_uuid($res), 'name' => $vm,
                        'description' => $lv->domain_get_description($res),
                        'autostart' => $lv->domain_get_autostart($res),
                        'state' => $lv->domain_state_translate($dom['state'] ?? ''),
                        'vcpus' => $vcpus,
                        'memoryKiB' => $memoryKiB,
                        'storageBytes' => $storageBytes,
                        'icon' => $lv->domain_get_icon_url($res),
                        'logs' => (is_file("/var/log/libvirt/qemu/$vm.log") ? "libvirt/qemu/$vm.log" : '')
                    ];
                }
            }
        }
        fv3_debug_log("readInfo for type: $type completed.");
        return $info;
    }

    function readUnraidOrder(string $type): array {
        fv3_debug_log("readUnraidOrder called for type: $type");
        $user_prefs_path = "/boot/config/plugins";
        $order = [];
        if ($type == "docker") {
            $dockerClient = new DockerClient();
            $containersFromUnraid = $dockerClient->getDockerContainers();
            $prefs_file = "$user_prefs_path/dockerMan/userprefs.cfg";

            if (file_exists($prefs_file)) {
                $prefs_ini = @parse_ini_file($prefs_file);
                if ($prefs_ini) {
                    $prefs_array = array_values($prefs_ini);
                    $sort = [];
                    $count_containers = count($containersFromUnraid);
                    foreach ($containersFromUnraid as $ct_item)  {
                        $search = array_search($ct_item['Name'], $prefs_array);
                        $sort[] = ($search === false) ? ($count_containers + count($sort) + 1) : $search;
                    }
                    if (!empty($sort)) {
                         @array_multisort($sort,SORT_NUMERIC,$containersFromUnraid);
                    } else {
                         @usort($containersFromUnraid, function($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
                    }
                } else {
                    @usort($containersFromUnraid, function($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
                }
            } else {
                 @usort($containersFromUnraid, function($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
            }
            $order = array_column($containersFromUnraid, 'Name');

        } elseif ($type == "vm") {
            global $lv;
            if (!isset($lv)) { $lv = new Libvirt(); if (!$lv->connect()) { fv3_debug_log("VM Order: Libvirt connection failed."); return []; } }

            $prefs_file = "$user_prefs_path/dynamix.vm.manager/userprefs.cfg";
            $vms = $lv->get_domains();

            if (!empty($vms)) {
                if (file_exists($prefs_file)) {
                    $prefs_ini = @parse_ini_file($prefs_file);
                     if ($prefs_ini) {
                        $prefs_array = array_values($prefs_ini);
                        $sort = [];
                        $count_vms = count($vms);
                        foreach ($vms as $vm_name) {
                            $search = array_search($vm_name, $prefs_array);
                            $sort[] = ($search === false) ? ($count_vms + count($sort) + 1) : $search;
                        }
                        if (!empty($sort)) {
                            @array_multisort($sort, SORT_NUMERIC, $vms);
                        } else {
                             natcasesort($vms);
                        }
                    } else {
                       natcasesort($vms);
                    }
                } else {
                    natcasesort($vms);
                }
                $order = array_values($vms);
            }
        }
        fv3_debug_log("readUnraidOrder for type: $type completed. Order: " . json_encode($order));
        return $order;
    }
    function pathToMultiDimArray($dir) {
        $final = [];
        try {
            if (!is_dir($dir) || !is_readable($dir)) return $final;
            $elements = array_diff(scandir($dir), ['.', '..']);
            foreach ($elements as $el) {
                $newEl = "{$dir}/{$el}";
                if(is_dir($newEl)) {
                    array_push($final, ["name" => $el, "path" => $newEl, "sub" => pathToMultiDimArray($newEl)]);
                } else if(is_file($newEl)) {
                    array_push($final, ["name" => $el, "path" => $newEl]);
                }
            }
        } catch (Throwable $err) { fv3_debug_log("Error in pathToMultiDimArray for $dir: " . $err->getMessage()); }
        return $final;
    }
    function dirToArrayOfFiles($dir, $fileFilter = NULL, $folderFilter = NULL) {
        $final = [];
        if (!is_array($dir)) return $final;
        foreach ($dir as $el) {
            if (!is_array($el) || !isset($el['name'])) continue;
            if(isset($el['sub']) && (!isset($folderFilter) || (isset($folderFilter) && !preg_match($folderFilter, $el['name'])))) {
                $final = array_merge($final, dirToArrayOfFiles($el['sub'], $fileFilter, $folderFilter));
            } else if(!isset($el['sub']) && (!isset($fileFilter) || (isset($fileFilter) && preg_match($fileFilter, $el['name'])))) {
                array_push($final, $el);
            }
        }
        return $final;
    }
?>
