(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusWizardSmartDetect = factory();
    root.FolderViewPlusWizardSmartDetectModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
        const normalizeManagedType = typeof deps.normalizeManagedType === 'function'
            ? deps.normalizeManagedType
            : ((value) => value === 'vm' ? 'vm' : 'docker');
        const getBulkAssignableNames = typeof deps.getBulkAssignableNames === 'function'
            ? deps.getBulkAssignableNames
            : (() => []);
        const getInfoByType = typeof deps.getInfoByType === 'function'
            ? deps.getInfoByType
            : (() => ({}));
        const utils = deps.utils || {};
        const runtimeRoot = typeof globalThis !== 'undefined'
            ? globalThis
            : (typeof window !== 'undefined' ? window : {});

        const normalizeSetupAssistantMatchText = (value) => (
            String(value || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .trim()
        );

        const wizardSmartDetectConfig = runtimeRoot.FolderViewPlusSmartDetectConfig || {};
        const SETUP_ASSISTANT_TEMPLATE_FALLBACK_BY_TYPE = Object.freeze({
            docker: String(wizardSmartDetectConfig.fallbackByType?.docker || 'Utilities'),
            vm: String(wizardSmartDetectConfig.fallbackByType?.vm || 'Utility VMs')
        });
        const SETUP_ASSISTANT_TEMPLATE_MATCH_THRESHOLD = Number(wizardSmartDetectConfig.matchThreshold) > 0
            ? Number(wizardSmartDetectConfig.matchThreshold)
            : 4;
        const SETUP_ASSISTANT_TEMPLATE_CONFIDENT_THRESHOLD = Number(wizardSmartDetectConfig.confidentThreshold) > 0
            ? Number(wizardSmartDetectConfig.confidentThreshold)
            : 8;
        const SETUP_ASSISTANT_MATCH_ALIASES = Object.freeze({
            docker: Object.freeze({ ...(wizardSmartDetectConfig.matchAliases?.docker || {}) }),
            vm: Object.freeze({ ...(wizardSmartDetectConfig.matchAliases?.vm || {}) })
        });

        const collectSetupAssistantItemMatchProfile = (type, itemName, itemInfo) => {
            const resolvedType = normalizeManagedType(type);
            const tokenSet = new Set();
            const phraseSet = new Set();
            const textParts = [];
            const sourceTexts = {
                name: [],
                image: [],
                path: [],
                metadata: [],
                labels: [],
                template: []
            };
            const pushSourceText = (bucket, normalizedText) => {
                const safeBucket = Object.prototype.hasOwnProperty.call(sourceTexts, bucket) ? bucket : 'metadata';
                if (!normalizedText) {
                    return;
                }
                if (!sourceTexts[safeBucket].includes(normalizedText)) {
                    sourceTexts[safeBucket].push(normalizedText);
                }
            };
            const addTokens = (value, options = {}) => {
                const normalizedText = normalizeSetupAssistantMatchText(value);
                if (!normalizedText) {
                    return;
                }
                pushSourceText(options.bucket, normalizedText);
                if (options.allowPhrase !== false && normalizedText.length >= 3) {
                    phraseSet.add(normalizedText);
                    textParts.push(normalizedText);
                }
                normalizedText.split(/\s+/).forEach((token) => {
                    const normalized = String(token || '').trim();
                    if (normalized.length >= 3) {
                        tokenSet.add(normalized);
                    }
                });
                if (options.expandAliases === false) {
                    return;
                }
                const aliasMap = SETUP_ASSISTANT_MATCH_ALIASES[resolvedType] || {};
                Object.entries(aliasMap).forEach(([token, aliases]) => {
                    if (!normalizedText.includes(token)) {
                        return;
                    }
                    (Array.isArray(aliases) ? aliases : []).forEach((alias) => addTokens(alias, {
                        allowPhrase: false,
                        expandAliases: false,
                        bucket: options.bucket || 'metadata'
                    }));
                });
            };

            addTokens(itemName, { bucket: 'name' });
            if (resolvedType === 'docker') {
                const labels = itemInfo?.Labels || itemInfo?.info?.Config?.Labels || {};
                addTokens(itemInfo?.Image, { bucket: 'image' });
                addTokens(itemInfo?.info?.Config?.Image, { bucket: 'image' });
                addTokens(itemInfo?.composeProject, { bucket: 'metadata' });
                addTokens(itemInfo?.folderLabel, { bucket: 'labels' });
                addTokens(itemInfo?.manager, { bucket: 'metadata' });
                addTokens(itemInfo?.info?.State?.manager, { bucket: 'metadata' });
                addTokens(itemInfo?.info?.registry, { bucket: 'metadata' });
                addTokens(itemInfo?.info?.Project, { bucket: 'metadata' });
                addTokens(itemInfo?.info?.Support, { bucket: 'metadata' });
                addTokens(itemInfo?.info?.ReadMe, { bucket: 'metadata' });
                addTokens(itemInfo?.info?.template?.path, { bucket: 'template' });
                (Array.isArray(itemInfo?.info?.HostConfig?.Binds) ? itemInfo.info.HostConfig.Binds : []).forEach((bind) => addTokens(bind, { bucket: 'path' }));
                (Array.isArray(itemInfo?.Mounts) ? itemInfo.Mounts : []).concat(Array.isArray(itemInfo?.info?.Mounts) ? itemInfo.info.Mounts : []).forEach((mount) => {
                    addTokens(mount?.Source, { bucket: 'path' });
                    addTokens(mount?.Destination, { bucket: 'path' });
                    addTokens(mount?.Name, { bucket: 'path' });
                });
                if (utils && typeof utils.getComposeProjectFromLabels === 'function') {
                    addTokens(utils.getComposeProjectFromLabels(labels), { bucket: 'metadata' });
                }
                Object.entries(labels || {}).forEach(([key, value]) => {
                    addTokens(key, { bucket: 'labels' });
                    addTokens(value, { bucket: 'labels' });
                });
            } else {
                addTokens(itemInfo?.domain, { bucket: 'metadata' });
                addTokens(itemInfo?.description, { bucket: 'metadata' });
                addTokens(itemInfo?.template, { bucket: 'template' });
                addTokens(itemInfo?.os, { bucket: 'metadata' });
            }
            return {
                tokens: tokenSet,
                phrases: phraseSet,
                normalizedText: textParts.join(' '),
                sourceTexts
            };
        };

        const scoreSetupAssistantTemplateMatch = (profile, blueprint, type = 'docker') => {
            const tokens = profile instanceof Set ? profile : profile?.tokens;
            const phrases = profile?.phrases instanceof Set ? profile.phrases : new Set();
            const normalizedText = String(profile?.normalizedText || '').trim();
            if (!(tokens instanceof Set) || tokens.size <= 0 || !blueprint || typeof blueprint !== 'object') {
                return 0;
            }
            const detectKeywords = Array.isArray(blueprint.detect) && blueprint.detect.length > 0
                ? blueprint.detect
                : [String(blueprint.name || '')];
            let score = 0;
            const consumeKeyword = (keyword, weight = 1) => {
                const normalized = normalizeSetupAssistantMatchText(keyword);
                if (!normalized) {
                    return;
                }
                const parts = normalized.split(/\s+/).filter((part) => part.length >= 3);
                if (parts.length <= 0) {
                    return;
                }
                let keywordScore = 0;
                if (phrases.has(normalized)) {
                    keywordScore = Math.max(keywordScore, 12 * weight);
                } else if (normalizedText.includes(normalized)) {
                    keywordScore = Math.max(keywordScore, 8 * weight);
                }
                let matchedParts = 0;
                parts.forEach((part) => {
                    if (tokens.has(part)) {
                        matchedParts += 1;
                        return;
                    }
                    if (part.length >= 4) {
                        for (const token of tokens) {
                            if (token.includes(part) || part.includes(token)) {
                                matchedParts += 1;
                                break;
                            }
                        }
                    }
                });
                if (matchedParts === parts.length) {
                    keywordScore = Math.max(keywordScore, (5 + (matchedParts * 2)) * weight);
                } else if (matchedParts > 0) {
                    keywordScore = Math.max(keywordScore, matchedParts * weight);
                }
                score += keywordScore;
            };
            const hasTokenEndingWith = (suffix) => {
                const normalizedSuffix = String(suffix || '').trim().toLowerCase();
                if (!normalizedSuffix) {
                    return false;
                }
                for (const token of tokens) {
                    if (token.endsWith(normalizedSuffix)) {
                        return true;
                    }
                }
                return false;
            };
            const hasTokenContainingAny = (values = []) => {
                const safeValues = Array.isArray(values) ? values : [];
                for (const rawValue of safeValues) {
                    const value = normalizeSetupAssistantMatchText(rawValue);
                    if (!value) {
                        continue;
                    }
                    for (const token of tokens) {
                        if (token === value || token.includes(value) || value.includes(token)) {
                            return true;
                        }
                    }
                    if (normalizedText.includes(value)) {
                        return true;
                    }
                }
                return false;
            };
            const normalizedName = normalizeSetupAssistantMatchText(blueprint?.name).replace(/\s+/g, '-');
            const getHeuristicBoost = () => {
                if (type === 'docker' && normalizedName === 'media') {
                    let next = 0;
                    if (hasTokenEndingWith('arr')) {
                        next += 12;
                    }
                    if (hasTokenContainingAny(['seerr', 'wizarr', 'listenarr', 'cleanuparr', 'agregarr', 'watch', 'request', 'discover'])) {
                        next += 10;
                    }
                    if (hasTokenContainingAny(['media', 'movies', 'shows', 'tv', 'music', 'books', 'audiobooks', 'anime', 'comics', 'photos'])) {
                        next += 6;
                    }
                    return next;
                }
                if (normalizedName === 'game-servers' || normalizedName === 'gaming') {
                    return hasTokenContainingAny(['crafty', 'pterodactyl', 'pelican', 'satisfactory', 'minecraft', 'palworld', 'valheim', 'steamcmd', 'gameserver', 'server']) ? 10 : 0;
                }
                if (normalizedName === 'monitoring') {
                    return hasTokenContainingAny(['myspeed', 'speedtest', 'latency', 'uptime', 'metrics']) ? 10 : 0;
                }
                if (normalizedName === 'cloud-&-sync') {
                    return hasTokenContainingAny(['nextcloud', 'owncloud', 'seafile', 'cloud', 'sync', 'drive', 'collabora', 'onlyoffice']) ? 10 : 0;
                }
                if (normalizedName === 'notifications') {
                    return hasTokenContainingAny(['notify', 'notification', 'ntfy', 'gotify', 'apprise', 'notifiarr', 'pushover', 'webhook']) ? 10 : 0;
                }
                if (normalizedName === 'utilities') {
                    let next = hasTokenContainingAny(['qdirstat', 'diskspeed', 'icons', 'icon', 'tool', 'utility', 'manager']) ? 10 : 0;
                    if (hasTokenContainingAny(['appdata', 'storage', 'tools'])) {
                        next += 6;
                    }
                    return next;
                }
                if (normalizedName === 'security') {
                    return hasTokenContainingAny(['clamav', 'antivirus', 'vaultwarden', 'authentik', 'authelia', 'crowdsec', 'fail2ban', 'security']) ? 10 : 0;
                }
                if (type !== 'vm') {
                    return 0;
                }
                if (normalizedName === 'production-vms') {
                    return hasTokenContainingAny(['production', 'prod', 'server', 'srv', 'node']) ? 10 : 0;
                }
                if (normalizedName === 'desktop-vms') {
                    return hasTokenContainingAny(['desktop', 'workstation', 'ubuntu', 'fedora', 'pop', 'linuxmint', 'macos']) ? 10 : 0;
                }
                if (normalizedName === 'windows-vms') {
                    return hasTokenContainingAny(['windows', 'win10', 'win11', 'server2019', 'server2022', 'windows-server']) ? 10 : 0;
                }
                if (normalizedName === 'lab-vms' || normalizedName === 'dev-test-vms') {
                    return hasTokenContainingAny(['lab', 'test', 'qa', 'sandbox', 'staging', 'dev']) ? 10 : 0;
                }
                if (normalizedName === 'utility-vms' || normalizedName === 'management-vms') {
                    return hasTokenContainingAny(['utility', 'tools', 'helper', 'management', 'admin', 'jumpbox', 'proxmox', 'pve', 'truenas', 'openmediavault']) ? 10 : 0;
                }
                if (normalizedName === 'infrastructure-vms' || normalizedName === 'network-vms') {
                    return hasTokenContainingAny(['infra', 'infrastructure', 'domain', 'controller', 'gateway', 'router', 'firewall', 'pfsense', 'opnsense', 'vyos', 'dns', 'proxy', 'unifi']) ? 10 : 0;
                }
                if (normalizedName === 'security-vms' || normalizedName === 'identity-vms') {
                    return hasTokenContainingAny(['security', 'siem', 'wazuh', 'ids', 'ips', 'identity', 'ldap', 'auth', 'freeipa', 'keycloak', 'domain controller']) ? 10 : 0;
                }
                if (normalizedName === 'backups' || normalizedName === 'recovery-vms') {
                    return hasTokenContainingAny(['backup', 'vault', 'archive', 'replica', 'recovery', 'restore', 'disaster', 'snapshot']) ? 10 : 0;
                }
                if (normalizedName === 'media-vms' || normalizedName === 'streaming-vms') {
                    return hasTokenContainingAny(['media', 'plex', 'jellyfin', 'emby', 'stream', 'obs', 'transcode']) ? 10 : 0;
                }
                if (normalizedName === 'gaming-vms' || normalizedName === 'cloud-gaming-vms') {
                    return hasTokenContainingAny(['gaming', 'steam', 'gpu', 'parsec', 'moonlight', 'sunshine']) ? 10 : 0;
                }
                return 0;
            };
            detectKeywords.forEach((keyword) => consumeKeyword(keyword, 1));
            consumeKeyword(blueprint.name, 0.6);
            score += getHeuristicBoost();
            return score;
        };

        const describeSetupAssistantTemplateMatch = (profile, blueprint, type = 'docker', options = {}) => {
            const resolvedType = normalizeManagedType(type);
            const detectKeywords = Array.isArray(blueprint?.detect) && blueprint.detect.length > 0
                ? blueprint.detect
                : [String(blueprint?.name || '')];
            const sourceTexts = profile?.sourceTexts && typeof profile.sourceTexts === 'object' ? profile.sourceTexts : {};
            const safeSources = {
                name: Array.isArray(sourceTexts.name) ? sourceTexts.name : [],
                image: Array.isArray(sourceTexts.image) ? sourceTexts.image : [],
                path: Array.isArray(sourceTexts.path) ? sourceTexts.path : [],
                metadata: Array.isArray(sourceTexts.metadata) ? sourceTexts.metadata : [],
                labels: Array.isArray(sourceTexts.labels) ? sourceTexts.labels : [],
                template: Array.isArray(sourceTexts.template) ? sourceTexts.template : []
            };
            const findKeywordInBucket = (bucketName) => {
                const bucket = safeSources[bucketName] || [];
                for (const rawKeyword of detectKeywords.concat([String(blueprint?.name || '')])) {
                    const keyword = normalizeSetupAssistantMatchText(rawKeyword);
                    if (!keyword) {
                        continue;
                    }
                    for (const value of bucket) {
                        if (value.includes(keyword) || keyword.includes(value)) {
                            return rawKeyword;
                        }
                    }
                }
                return '';
            };
            const fallbackTemplateName = String(SETUP_ASSISTANT_TEMPLATE_FALLBACK_BY_TYPE[resolvedType] || '').trim();
            if (options.usedFallback === true) {
                return fallbackTemplateName ? `Suggested fallback: ${fallbackTemplateName}` : 'Suggested fallback bucket';
            }
            const nameKeyword = findKeywordInBucket('name');
            if (nameKeyword) {
                return `Name match: ${nameKeyword}`;
            }
            const imageKeyword = findKeywordInBucket('image');
            if (imageKeyword) {
                return `Image match: ${imageKeyword}`;
            }
            const pathKeyword = findKeywordInBucket('path');
            if (pathKeyword) {
                return `Path match: ${pathKeyword}`;
            }
            const labelKeyword = findKeywordInBucket('labels');
            if (labelKeyword) {
                return `Label match: ${labelKeyword}`;
            }
            const metadataKeyword = findKeywordInBucket('metadata') || findKeywordInBucket('template');
            if (metadataKeyword) {
                return `Metadata match: ${metadataKeyword}`;
            }
            if (resolvedType === 'docker') {
                const tokens = profile?.tokens instanceof Set ? profile.tokens : new Set();
                for (const token of tokens) {
                    if (token.endsWith('arr')) {
                        return 'ARR-family heuristic';
                    }
                }
            }
            return `Keyword score ${Math.round(Number(options.score) || 0)}`;
        };

        const getSetupAssistantTemplateConfidence = (score) => {
            const safeScore = Number(score) || 0;
            if (safeScore >= SETUP_ASSISTANT_TEMPLATE_CONFIDENT_THRESHOLD) {
                return 'high';
            }
            if (safeScore >= SETUP_ASSISTANT_TEMPLATE_MATCH_THRESHOLD) {
                return 'review';
            }
            return 'none';
        };

        const resolveSetupAssistantTemplateBestMatch = (type, profile, blueprints) => {
            const resolvedType = normalizeManagedType(type);
            let bestBlueprint = null;
            let bestScore = 0;
            let bestIndex = -1;
            (Array.isArray(blueprints) ? blueprints : []).forEach((blueprint, index) => {
                const score = scoreSetupAssistantTemplateMatch(profile, blueprint, resolvedType);
                if (score > bestScore) {
                    bestBlueprint = blueprint;
                    bestScore = score;
                    bestIndex = index;
                }
            });
            return { bestBlueprint, bestScore, bestIndex };
        };

        const resolveSetupAssistantSmartBlueprintIndexes = (type, blueprints) => {
            const resolvedType = normalizeManagedType(type);
            const safeBlueprints = Array.isArray(blueprints) ? blueprints : [];
            const itemNames = getBulkAssignableNames(resolvedType);
            const info = getInfoByType(resolvedType);
            const matchedIndexes = new Set();
            let matched = 0;
            let unmatched = 0;
            itemNames.forEach((itemName) => {
                const profile = collectSetupAssistantItemMatchProfile(resolvedType, itemName, info[itemName] || {});
                const { bestScore, bestIndex } = resolveSetupAssistantTemplateBestMatch(resolvedType, profile, safeBlueprints);
                if (bestIndex >= 0 && bestScore >= SETUP_ASSISTANT_TEMPLATE_MATCH_THRESHOLD) {
                    matchedIndexes.add(bestIndex);
                    matched += 1;
                    return;
                }
                unmatched += 1;
            });
            return {
                indexes: matchedIndexes,
                totalItems: itemNames.length,
                matched,
                unmatched
            };
        };

        const buildSetupAssistantTemplateAssignmentPreview = (type, selectedBlueprints) => {
            const resolvedType = normalizeManagedType(type);
            const blueprints = Array.isArray(selectedBlueprints) ? selectedBlueprints : [];
            const itemNames = getBulkAssignableNames(resolvedType);
            const info = getInfoByType(resolvedType);
            const assignedByTemplate = {};
            const itemDetails = [];
            const reviewItems = [];
            blueprints.forEach((blueprint) => {
                const name = String(blueprint?.name || '').trim();
                if (name) {
                    assignedByTemplate[name] = [];
                }
            });
            const fallbackTemplateName = String(SETUP_ASSISTANT_TEMPLATE_FALLBACK_BY_TYPE[resolvedType] || '').trim();
            const fallbackBlueprint = blueprints.find((blueprint) => String(blueprint?.name || '').trim() === fallbackTemplateName) || null;

            let matched = 0;
            let unmatched = 0;
            itemNames.forEach((itemName) => {
                const profile = collectSetupAssistantItemMatchProfile(resolvedType, itemName, info[itemName] || {});
                let { bestBlueprint, bestScore } = resolveSetupAssistantTemplateBestMatch(resolvedType, profile, blueprints);
                let usedFallback = false;
                if (!bestBlueprint && fallbackBlueprint) {
                    bestBlueprint = fallbackBlueprint;
                    bestScore = 0;
                    usedFallback = true;
                }
                const confidence = getSetupAssistantTemplateConfidence(bestScore);
                if (bestBlueprint) {
                    const templateName = String(bestBlueprint?.name || '').trim();
                    if (!assignedByTemplate[templateName]) {
                        assignedByTemplate[templateName] = [];
                    }
                    assignedByTemplate[templateName].push(itemName);
                    itemDetails.push({
                        itemName,
                        templateName,
                        score: bestScore,
                        confidence,
                        usedFallback,
                        reason: describeSetupAssistantTemplateMatch(profile, bestBlueprint, resolvedType, {
                            usedFallback,
                            score: bestScore
                        })
                    });
                    if (confidence === 'none' || confidence === 'review') {
                        reviewItems.push(itemName);
                    } else {
                        matched += 1;
                    }
                    return;
                }
                unmatched += 1;
                reviewItems.push(itemName);
                itemDetails.push({
                    itemName,
                    templateName: '',
                    score: 0,
                    confidence: 'none',
                    usedFallback: false,
                    reason: 'No smart match found'
                });
            });

            return {
                assignedByTemplate,
                itemDetails,
                reviewItems,
                totalItems: itemNames.length,
                matched,
                unmatched
            };
        };

        return Object.freeze({
            normalizeSetupAssistantMatchText,
            collectSetupAssistantItemMatchProfile,
            scoreSetupAssistantTemplateMatch,
            describeSetupAssistantTemplateMatch,
            getSetupAssistantTemplateConfidence,
            resolveSetupAssistantTemplateBestMatch,
            resolveSetupAssistantSmartBlueprintIndexes,
            buildSetupAssistantTemplateAssignmentPreview
        });
    };

    return Object.freeze({
        createApi
    });
}));
