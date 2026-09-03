/* Starter template blueprints and picker helpers extracted from folderviewplus.js. */
const DEFAULT_STARTER_FOLDER_ICON = '/plugins/folderview.plus/images/folder-icon.png';

const STARTER_TEMPLATE_CATEGORY_META = Object.freeze({
    smart: Object.freeze({ label: 'Smart' }),
    homelab: Object.freeze({ label: 'Homelab' }),
    media: Object.freeze({ label: 'Media' }),
    minimal: Object.freeze({ label: 'Minimal' }),
    network: Object.freeze({ label: 'Network' }),
    automation: Object.freeze({ label: 'Automation' }),
    database: Object.freeze({ label: 'Database' }),
    security: Object.freeze({ label: 'Security' }),
    ops: Object.freeze({ label: 'Ops' }),
    dev: Object.freeze({ label: 'Dev' }),
    gaming: Object.freeze({ label: 'Gaming' }),
    lab: Object.freeze({ label: 'Lab' }),
    server: Object.freeze({ label: 'Server' }),
    desktop: Object.freeze({ label: 'Desktop' }),
    utility: Object.freeze({ label: 'Utility' }),
    backup: Object.freeze({ label: 'Backup' })
});

const normalizeStarterTemplateCategory = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    return normalized;
};

const STARTER_TEMPLATE_BLUEPRINTS = Object.freeze({
    docker: Object.freeze([
        Object.freeze({
            name: 'Media',
            icon: '/plugins/folderview.plus/images/icons/folder-media.svg',
            categories: Object.freeze(['media', 'homelab']),
            detect: Object.freeze(['plex', 'jellyfin', 'emby', 'sonarr', 'radarr', 'lidarr', 'readarr', 'bazarr', 'tautulli', 'audiobookshelf', 'audiobook', 'prowlarr', 'overseerr', 'jellyseerr', 'seerr', 'wizarr', 'listenarr', 'cleanuparr', 'agregarr', 'seekandwatch', 'whisparr', 'recyclarr', 'unpackerr', 'tdarr', 'fileflows', 'calibre', 'calibre-web', 'komga', 'kavita', 'navidrome', 'airsonic', 'tubearchivist', 'immich', 'photoprism', 'paperless', 'romm'])
        }),
        Object.freeze({
            name: 'Downloads',
            icon: '/plugins/folderview.plus/images/icons/folder-backup.svg',
            categories: Object.freeze(['media', 'minimal']),
            detect: Object.freeze(['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget', 'jdownloader', 'aria2', 'slskd', 'soulseek', 'cross-seed', 'torrent', 'nzb'])
        }),
        Object.freeze({
            name: 'Monitoring',
            icon: '/plugins/folderview.plus/images/icons/folder-cloud.svg',
            categories: Object.freeze(['ops', 'homelab', 'minimal']),
            detect: Object.freeze(['grafana', 'prometheus', 'netdata', 'zabbix', 'telegraf', 'influx', 'influxdb', 'loki', 'promtail', 'uptime', 'uptime-kuma', 'dozzle', 'glances', 'beszel', 'scrutiny', 'cadvisor', 'healthchecks', 'myspeed', 'speedtest'])
        }),
        Object.freeze({
            name: 'Network',
            icon: '/plugins/folderview.plus/images/icons/folder-network.svg',
            categories: Object.freeze(['network', 'homelab', 'minimal']),
            detect: Object.freeze(['nginx', 'traefik', 'proxy', 'caddy', 'dns', 'pihole', 'adguard', 'adguardhome', 'wireguard', 'tailscale', 'zerotier', 'cloudflared', 'ddns', 'vpn'])
        }),
        Object.freeze({
            name: 'Reverse Proxy',
            icon: '/plugins/folderview.plus/images/icons/folder-network.svg',
            categories: Object.freeze(['network', 'ops', 'homelab']),
            detect: Object.freeze(['nginx-proxy-manager', 'npm', 'traefik', 'caddy', 'swag', 'reverse-proxy'])
        }),
        Object.freeze({
            name: 'DNS & Routing',
            icon: '/plugins/folderview.plus/images/icons/folder-network.svg',
            categories: Object.freeze(['network', 'ops', 'homelab']),
            detect: Object.freeze(['pihole', 'adguard', 'adguardhome', 'dns', 'unbound', 'bind', 'dhcp'])
        }),
        Object.freeze({
            name: 'Remote Access',
            icon: '/plugins/folderview.plus/images/icons/folder-security.svg',
            categories: Object.freeze(['network', 'security', 'homelab']),
            detect: Object.freeze(['wireguard', 'openvpn', 'tailscale', 'zerotier', 'wg-easy'])
        }),
        Object.freeze({
            name: 'Utilities',
            icon: '/plugins/folderview.plus/images/icons/folder-tools.svg',
            categories: Object.freeze(['utility', 'ops', 'minimal', 'homelab']),
            detect: Object.freeze(['portainer', 'watchtower', 'filebrowser', 'homarr', 'homepage', 'dashy', 'krusader', 'commander', 'mc', 'it-tools', 'utilities', 'tools', 'qdirstat', 'diskspeed', 'ncdu', 'baobab', 'icons', 'vm_custom_icons'])
        }),
        Object.freeze({
            name: 'Dashboards',
            icon: '/plugins/folderview.plus/images/icons/folder-home.svg',
            categories: Object.freeze(['utility', 'automation', 'homelab']),
            detect: Object.freeze(['homarr', 'homepage', 'dashy', 'organizr', 'heimdall', 'dashboard'])
        }),
        Object.freeze({
            name: 'Cloud & Sync',
            icon: '/plugins/folderview.plus/images/icons/folder-cloud.svg',
            categories: Object.freeze(['utility', 'homelab', 'minimal']),
            detect: Object.freeze(['nextcloud', 'owncloud', 'seafile', 'filerun', 'syncthing', 'resilio', 'cloud', 'drive', 'sync', 'collabora', 'onlyoffice'])
        }),
        Object.freeze({
            name: 'Notifications',
            icon: '/plugins/folderview.plus/images/icons/folder-automation.svg',
            categories: Object.freeze(['automation', 'ops', 'homelab']),
            detect: Object.freeze(['notify', 'notification', 'notifications', 'ntfy', 'gotify', 'apprise', 'notifiarr', 'pushover', 'pushbullet', 'webhook', 'discord', 'telegram', 'signal'])
        }),
        Object.freeze({
            name: 'Backup & Recovery',
            icon: '/plugins/folderview.plus/images/icons/folder-backup.svg',
            categories: Object.freeze(['backup', 'ops', 'minimal', 'homelab']),
            detect: Object.freeze(['duplicati', 'restic', 'borg', 'kopia', 'urbackup', 'rsync', 'backup'])
        }),
        Object.freeze({
            name: 'Archives',
            icon: '/plugins/folderview.plus/images/icons/folder-backup.svg',
            categories: Object.freeze(['backup', 'media', 'homelab']),
            detect: Object.freeze(['archive', 'cold', 'storage', 'rclone', 'syncthing', 'sftp'])
        }),
        Object.freeze({
            name: 'Automation',
            icon: '/plugins/folderview.plus/images/icons/folder-automation.svg',
            categories: Object.freeze(['automation', 'homelab']),
            detect: Object.freeze(['homeassistant', 'home-assistant', 'openhab', 'node-red', 'n8n', 'automation', 'mosquitto', 'mqtt', 'zigbee', 'zwave', 'zwavejs', 'esphome', 'scrypted', 'deconz'])
        }),
        Object.freeze({
            name: 'Workflows',
            icon: '/plugins/folderview.plus/images/icons/folder-automation.svg',
            categories: Object.freeze(['automation', 'dev', 'homelab']),
            detect: Object.freeze(['n8n', 'node-red', 'airflow', 'prefect', 'workflows'])
        }),
        Object.freeze({
            name: 'Database',
            icon: '/plugins/folderview.plus/images/icons/folder-database.svg',
            categories: Object.freeze(['database', 'ops', 'homelab']),
            detect: Object.freeze(['postgres', 'postgresql', 'pgadmin', 'mysql', 'mariadb', 'mongo', 'mongodb', 'redis', 'redisinsight', 'adminer', 'influxdb', 'database'])
        }),
        Object.freeze({
            name: 'Cache & Queue',
            icon: '/plugins/folderview.plus/images/icons/folder-database.svg',
            categories: Object.freeze(['database', 'automation', 'ops', 'homelab']),
            detect: Object.freeze(['redis', 'rabbitmq', 'kafka', 'nats', 'queue', 'cache'])
        }),
        Object.freeze({
            name: 'Security',
            icon: '/plugins/folderview.plus/images/icons/folder-security.svg',
            categories: Object.freeze(['security', 'ops', 'homelab']),
            detect: Object.freeze(['authentik', 'authelia', 'vaultwarden', 'crowdsec', 'fail2ban', 'wazuh', 'security', 'clamav', 'antivirus', 'malware'])
        }),
        Object.freeze({
            name: 'Identity & Access',
            icon: '/plugins/folderview.plus/images/icons/folder-security.svg',
            categories: Object.freeze(['security', 'ops', 'homelab']),
            detect: Object.freeze(['authentik', 'authelia', 'keycloak', 'ldap', 'sso', 'oauth'])
        }),
        Object.freeze({
            name: 'Development',
            icon: '/plugins/folderview.plus/images/icons/folder-dev.svg',
            categories: Object.freeze(['dev', 'homelab']),
            detect: Object.freeze(['gitlab', 'gitea', 'jenkins', 'runner', 'registry', 'npm', 'dev', 'code-server', 'vscode', 'coder', 'devcontainer'])
        }),
        Object.freeze({
            name: 'CI/CD',
            icon: '/plugins/folderview.plus/images/icons/folder-dev.svg',
            categories: Object.freeze(['dev', 'ops', 'homelab']),
            detect: Object.freeze(['jenkins', 'gitlab-runner', 'drone', 'argocd', 'ci', 'cd', 'runner'])
        }),
        Object.freeze({
            name: 'Gaming',
            icon: '/plugins/folderview.plus/images/icons/folder-gaming.svg',
            categories: Object.freeze(['gaming', 'homelab']),
            detect: Object.freeze(['steam', 'minecraft', 'game', 'gaming', 'palworld', 'valheim', 'factorio', 'crafty', 'pterodactyl', 'pelican', 'satisfactory'])
        }),
        Object.freeze({
            name: 'Game Servers',
            icon: '/plugins/folderview.plus/images/icons/folder-gaming.svg',
            categories: Object.freeze(['gaming', 'homelab']),
            detect: Object.freeze(['steamcmd', 'minecraft', 'palworld', 'valheim', 'ark', 'gameserver', 'crafty', 'crafty-controller', 'pterodactyl', 'pelican', 'satisfactory', 'satisfactory-server', 'terraria', 'enshrouded', 'project-zomboid'])
        })
    ]),
    vm: Object.freeze([
        Object.freeze({
            name: 'Production VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-default.svg',
            categories: Object.freeze(['server', 'homelab', 'minimal']),
            detect: Object.freeze(['prod', 'production', 'server', 'srv'])
        }),
        Object.freeze({
            name: 'Desktop VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-home.svg',
            categories: Object.freeze(['desktop', 'homelab']),
            detect: Object.freeze(['desktop', 'workstation', 'windows', 'win11', 'ubuntu-desktop', 'ubuntu desktop', 'macos', 'fedora-workstation', 'linuxmint'])
        }),
        Object.freeze({
            name: 'Windows VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-home.svg',
            categories: Object.freeze(['desktop', 'server', 'homelab']),
            detect: Object.freeze(['windows', 'win10', 'win11', 'server2022', 'server2019'])
        }),
        Object.freeze({
            name: 'Lab VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-dev.svg',
            categories: Object.freeze(['lab', 'dev', 'homelab']),
            detect: Object.freeze(['lab', 'test', 'dev', 'sandbox', 'staging'])
        }),
        Object.freeze({
            name: 'Dev/Test VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-dev.svg',
            categories: Object.freeze(['lab', 'dev', 'homelab']),
            detect: Object.freeze(['dev', 'test', 'qa', 'sandbox', 'build'])
        }),
        Object.freeze({
            name: 'Utility VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-tools.svg',
            categories: Object.freeze(['utility', 'minimal', 'homelab']),
            detect: Object.freeze(['utility', 'tools', 'helper', 'management', 'omv', 'openmediavault', 'truenas'])
        }),
        Object.freeze({
            name: 'Management VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-tools.svg',
            categories: Object.freeze(['utility', 'ops', 'homelab']),
            detect: Object.freeze(['management', 'controller', 'admin', 'jumpbox', 'proxmox', 'pve', 'hypervisor'])
        }),
        Object.freeze({
            name: 'Infrastructure VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-default.svg',
            categories: Object.freeze(['server', 'network', 'ops', 'homelab']),
            detect: Object.freeze(['infra', 'infrastructure', 'domain', 'controller', 'gateway', 'dns', 'proxy', 'unifi', 'k3s', 'k8s'])
        }),
        Object.freeze({
            name: 'Network VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-network.svg',
            categories: Object.freeze(['network', 'homelab']),
            detect: Object.freeze(['router', 'firewall', 'pfsense', 'opnsense', 'vyos', 'network', 'dns', 'proxy', 'unifi'])
        }),
        Object.freeze({
            name: 'Security VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-security.svg',
            categories: Object.freeze(['security', 'ops', 'homelab']),
            detect: Object.freeze(['security', 'siem', 'wazuh', 'ids', 'ips', 'firewall', 'sentinel', 'edr'])
        }),
        Object.freeze({
            name: 'Identity VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-security.svg',
            categories: Object.freeze(['security', 'server', 'homelab']),
            detect: Object.freeze(['auth', 'identity', 'ldap', 'ad', 'domain-controller', 'freeipa', 'keycloak'])
        }),
        Object.freeze({
            name: 'Backups',
            icon: '/plugins/folderview.plus/images/icons/folder-backup.svg',
            categories: Object.freeze(['backup', 'ops', 'server', 'homelab']),
            detect: Object.freeze(['backup', 'vault', 'archive', 'replica'])
        }),
        Object.freeze({
            name: 'Recovery VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-backup.svg',
            categories: Object.freeze(['backup', 'ops', 'server', 'homelab']),
            detect: Object.freeze(['recovery', 'restore', 'disaster', 'dr', 'snapshot'])
        }),
        Object.freeze({
            name: 'Media VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-media.svg',
            categories: Object.freeze(['media', 'homelab']),
            detect: Object.freeze(['media', 'plex', 'jellyfin', 'emby'])
        }),
        Object.freeze({
            name: 'Streaming VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-media.svg',
            categories: Object.freeze(['media', 'desktop', 'homelab']),
            detect: Object.freeze(['stream', 'obs', 'media', 'encode', 'transcode'])
        }),
        Object.freeze({
            name: 'Gaming VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-gaming.svg',
            categories: Object.freeze(['gaming', 'desktop', 'homelab']),
            detect: Object.freeze(['gaming', 'steam', 'gpu', 'parsec', 'moonlight'])
        }),
        Object.freeze({
            name: 'Cloud Gaming VMs',
            icon: '/plugins/folderview.plus/images/icons/folder-gaming.svg',
            categories: Object.freeze(['gaming', 'desktop', 'homelab']),
            detect: Object.freeze(['cloud-gaming', 'parsec', 'sunshine', 'moonlight', 'gaming', 'steam'])
        })
    ])
});

const sharedSmartDetectConfig = window.FolderViewPlusSmartDetectConfig || {};
const STARTER_TEMPLATE_SMART_THRESHOLD = Number(sharedSmartDetectConfig.matchThreshold) > 0
    ? Number(sharedSmartDetectConfig.matchThreshold)
    : 4;
const STARTER_TEMPLATE_FALLBACK_BY_TYPE = Object.freeze({
    docker: String(sharedSmartDetectConfig.fallbackByType?.docker || 'Utilities'),
    vm: String(sharedSmartDetectConfig.fallbackByType?.vm || 'Utility VMs')
});
const STARTER_TEMPLATE_MATCH_ALIASES = Object.freeze({
    docker: Object.freeze({ ...(sharedSmartDetectConfig.matchAliases?.docker || {}) }),
    vm: Object.freeze({ ...(sharedSmartDetectConfig.matchAliases?.vm || {}) })
});

const normalizeStarterTemplateMatchText = (value) => (
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
);

const buildStarterTemplateHeuristicMap = (type, blueprintName) => {
    const resolvedType = normalizeManagedType(type);
    const normalizedName = normalizeStarterTemplateMatchText(blueprintName).replace(/\s+/g, '-');
    if (resolvedType === 'docker') {
        const dockerMap = {
            media: { contains: ['seerr', 'wizarr', 'listenarr', 'cleanuparr', 'agregarr', 'watch', 'request', 'discover'], pathContains: ['media', 'movies', 'shows', 'tv', 'music', 'books', 'audiobooks', 'anime', 'comics', 'photos'] },
            downloads: { contains: ['download', 'torrent', 'nzb', 'slsk', 'seed'] },
            monitoring: { contains: ['myspeed', 'speedtest', 'latency', 'uptime', 'metrics', 'telemetry'] },
            'cloud-&-sync': { contains: ['nextcloud', 'owncloud', 'seafile', 'cloud', 'sync', 'drive', 'collabora', 'onlyoffice'] },
            notifications: { contains: ['notify', 'notification', 'ntfy', 'gotify', 'apprise', 'notifiarr', 'pushover', 'webhook'] },
            utilities: { contains: ['qdirstat', 'diskspeed', 'ncdu', 'baobab', 'icons', 'icon', 'tool', 'utility', 'manager'], pathContains: ['appdata', 'storage', 'tools'] },
            automation: { contains: ['homeassistant', 'node-red', 'n8n', 'mqtt', 'esphome', 'zigbee', 'zwave'] },
            database: { contains: ['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'database', 'db'] },
            security: { contains: ['clamav', 'antivirus', 'vaultwarden', 'authentik', 'authelia', 'crowdsec', 'fail2ban', 'security'] },
            development: { contains: ['git', 'code', 'dev', 'build', 'registry', 'runner', 'vscode'] },
            'ci-cd': { contains: ['jenkins', 'runner', 'drone', 'argocd', 'ci', 'cd'] },
            gaming: { contains: ['crafty', 'minecraft', 'palworld', 'valheim', 'satisfactory', 'steam', 'gameserver', 'server'] },
            'game-servers': { contains: ['crafty', 'pterodactyl', 'pelican', 'steamcmd', 'minecraft', 'palworld', 'valheim', 'satisfactory', 'terraria', 'enshrouded', 'gameserver', 'server'] }
        };
        return dockerMap[normalizedName] || null;
    }
    const vmMap = {
        'production-vms': { contains: ['production', 'prod', 'server', 'srv', 'node'] },
        'desktop-vms': { contains: ['desktop', 'workstation', 'windows', 'ubuntu', 'fedora', 'macos'] },
        'windows-vms': { contains: ['windows', 'win10', 'win11', 'server2019', 'server2022', 'windows-server'] },
        'lab-vms': { contains: ['lab', 'test', 'qa', 'sandbox', 'staging', 'dev'] },
        'dev-test-vms': { contains: ['dev', 'test', 'qa', 'sandbox', 'build'] },
        'utility-vms': { contains: ['utility', 'tools', 'helper', 'management', 'admin', 'openmediavault', 'omv', 'truenas'] },
        'management-vms': { contains: ['management', 'controller', 'admin', 'jumpbox', 'proxmox', 'pve', 'hypervisor'] },
        'infrastructure-vms': { contains: ['infra', 'infrastructure', 'domain', 'controller', 'gateway', 'dns', 'proxy', 'unifi', 'k3s', 'k8s'] },
        'network-vms': { contains: ['router', 'firewall', 'pfsense', 'opnsense', 'vyos', 'dns', 'proxy', 'unifi'] },
        'security-vms': { contains: ['security', 'siem', 'wazuh', 'ids', 'ips', 'firewall', 'sentinel', 'edr'] },
        'identity-vms': { contains: ['security', 'identity', 'auth', 'ldap', 'ad', 'freeipa', 'keycloak', 'domain-controller'] },
        backups: { contains: ['backup', 'vault', 'archive', 'replica'] },
        'recovery-vms': { contains: ['recovery', 'restore', 'disaster', 'snapshot'] },
        'media-vms': { contains: ['media', 'plex', 'jellyfin', 'emby'] },
        'streaming-vms': { contains: ['stream', 'obs', 'media', 'encode', 'transcode'] },
        'gaming-vms': { contains: ['gaming', 'steam', 'parsec', 'moonlight', 'sunshine', 'gpu'] },
        'cloud-gaming-vms': { contains: ['cloud-gaming', 'parsec', 'sunshine', 'moonlight', 'gaming', 'steam'] }
    };
    return vmMap[normalizedName] || null;
};

const collectStarterTemplateSmartSignals = (type) => {
    const resolvedType = normalizeManagedType(type);
    const infoByName = infoByType[resolvedType] && typeof infoByType[resolvedType] === 'object' ? infoByType[resolvedType] : {};
    const tokenSet = new Set();
    const phraseSet = new Set();
    const textParts = [];
    const addTokens = (value, options = {}) => {
        const normalizedText = normalizeStarterTemplateMatchText(value);
        if (!normalizedText) {
            return;
        }
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
        if (options.expandAliases !== false) {
            const aliasMap = STARTER_TEMPLATE_MATCH_ALIASES[resolvedType] || {};
            Object.entries(aliasMap).forEach(([token, aliases]) => {
                if (!normalizedText.includes(token)) {
                    return;
                }
                (Array.isArray(aliases) ? aliases : []).forEach((alias) => addTokens(alias, {
                    allowPhrase: false,
                    expandAliases: false
                }));
            });
        }
    };
    Object.entries(infoByName).forEach(([itemName, itemInfo]) => {
        addTokens(itemName);
        if (resolvedType === 'docker') {
            const labels = itemInfo?.Labels || itemInfo?.info?.Config?.Labels || {};
            addTokens(itemInfo?.Image);
            addTokens(itemInfo?.info?.Config?.Image);
            addTokens(itemInfo?.composeProject);
            addTokens(itemInfo?.folderLabel);
            addTokens(itemInfo?.manager);
            addTokens(itemInfo?.info?.State?.manager);
            addTokens(itemInfo?.info?.registry);
            addTokens(itemInfo?.info?.Project);
            addTokens(itemInfo?.info?.Support);
            addTokens(itemInfo?.info?.ReadMe);
            addTokens(itemInfo?.info?.template?.path);
            (Array.isArray(itemInfo?.info?.HostConfig?.Binds) ? itemInfo.info.HostConfig.Binds : []).forEach((bind) => addTokens(bind));
            (Array.isArray(itemInfo?.Mounts) ? itemInfo.Mounts : []).concat(Array.isArray(itemInfo?.info?.Mounts) ? itemInfo.info.Mounts : []).forEach((mount) => {
                addTokens(mount?.Source);
                addTokens(mount?.Destination);
                addTokens(mount?.Name);
            });
            Object.entries(labels || {}).forEach(([key, value]) => {
                addTokens(key);
                addTokens(value);
            });
        } else {
            addTokens(itemInfo?.domain);
            addTokens(itemInfo?.description);
            addTokens(itemInfo?.template);
            addTokens(itemInfo?.os);
        }
    });
    return {
        tokens: tokenSet,
        phrases: phraseSet,
        normalizedText: textParts.join(' ')
    };
};

const resolveStarterTemplateSmartIndexes = (type, templateList) => {
    const list = Array.isArray(templateList) ? templateList : [];
    const profile = collectStarterTemplateSmartSignals(type);
    const tokens = profile?.tokens instanceof Set ? profile.tokens : new Set();
    const phrases = profile?.phrases instanceof Set ? profile.phrases : new Set();
    const normalizedText = String(profile?.normalizedText || '').trim();
    const matched = new Set();
    const matchesKeyword = (keyword) => {
        const normalized = normalizeStarterTemplateMatchText(keyword);
        if (!normalized) {
            return 0;
        }
        const parts = normalized.split(/\s+/).filter((part) => part.length >= 3);
        if (parts.length <= 0) {
            return 0;
        }
        let score = 0;
        if (phrases.has(normalized)) {
            score = Math.max(score, 12);
        } else if (normalizedText.includes(normalized)) {
            score = Math.max(score, 8);
        }
        let matchedParts = 0;
        for (const part of parts) {
            if (tokens.has(part)) {
                matchedParts += 1;
                continue;
            }
            if (part.length >= 4) {
                for (const token of tokens) {
                    if (token.includes(part) || part.includes(token)) {
                        matchedParts += 1;
                        break;
                    }
                }
            }
        }
        if (matchedParts === parts.length) {
            score = Math.max(score, 5 + (matchedParts * 2));
        } else if (matchedParts > 0) {
            score = Math.max(score, matchedParts);
        }
        return score;
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
            const value = normalizeStarterTemplateMatchText(rawValue);
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
    const getHeuristicBoost = (entry) => {
        const heuristic = buildStarterTemplateHeuristicMap(type, entry?.name);
        if (!heuristic) {
            return 0;
        }
        let score = 0;
        if (type === 'docker' && normalizeStarterTemplateMatchText(entry?.name).replace(/\s+/g, '-') === 'media' && hasTokenEndingWith('arr')) {
            score += 12;
        }
        if (hasTokenContainingAny(heuristic.contains)) {
            score += 10;
        }
        if (hasTokenContainingAny(heuristic.pathContains)) {
            score += 6;
        }
        return score;
    };
    list.forEach((entry, index) => {
        const detectKeywords = Array.isArray(entry?.detect) && entry.detect.length > 0
            ? entry.detect
            : [String(entry?.name || '')];
        let bestScore = 0;
        detectKeywords.forEach((keyword) => {
            bestScore = Math.max(bestScore, matchesKeyword(keyword));
        });
        bestScore = Math.max(bestScore, matchesKeyword(entry?.name));
        bestScore += getHeuristicBoost(entry);
        if (bestScore >= STARTER_TEMPLATE_SMART_THRESHOLD) {
            matched.add(index);
        }
    });
    if (matched.size === 0 && tokens.size > 0) {
        const fallbackName = String(STARTER_TEMPLATE_FALLBACK_BY_TYPE[normalizeManagedType(type)] || '').trim().toLowerCase();
        const fallbackIndex = list.findIndex((entry) => String(entry?.name || '').trim().toLowerCase() === fallbackName);
        if (fallbackIndex >= 0) {
            matched.add(fallbackIndex);
        }
    }
    if (matched.size > 0) {
        return matched;
    }
    list.forEach((entry, index) => {
        const categories = Array.isArray(entry?.categories) ? entry.categories.map((value) => normalizeStarterTemplateCategory(value)) : [];
        if (categories.includes('homelab') || categories.includes('minimal')) {
            matched.add(index);
        }
    });
    if (matched.size > 0) {
        return matched;
    }
    list.forEach((_, index) => {
        matched.add(index);
    });
    return matched;
};

const buildStarterFolderPayload = (name, iconPath = DEFAULT_STARTER_FOLDER_ICON) => ({
    name: String(name || '').trim(),
    icon: String(iconPath || '').trim() || DEFAULT_STARTER_FOLDER_ICON,
    containers: [],
    settings: {
        folder_webui: false,
        folder_webui_url: '',
        preview: 1,
        preview_hover: false,
        preview_hover_animation: 'none',
        previewHoverAnimation: 'none',
        preview_update: false,
        preview_text_width: '',
        preview_status: 'symbol',
        preview_grayscale: false,
        preview_webui: false,
        preview_logs: false,
        preview_console: false,
        preview_vertical_bars: false,
        context: 1,
        context_trigger: 0,
        context_graph: 1,
        context_graph_time: 60,
        preview_border: true,
        preview_border_color: '#afa89e',
        preview_vertical_bars_color: '#afa89e',
        folder_accent_enabled: false,
        folder_accent_color: '#ffca63',
        status_color_started: '#55b72d',
        status_color_paused: '#b8860b',
        status_color_stopped: '#ff4d4d', status_color_text: '#ffffff', status_color_text_explicit: false,
        health_warn_stopped_percent: '',
        health_critical_stopped_percent: '',
        health_profile: '',
        health_updates_mode: '',
        health_all_stopped_mode: '',
        status_warn_stopped_percent: '',
        update_column: false,
        default_action: false,
        expand_tab: false,
        override_default_actions: false,
        expand_dashboard: false,
        dashboard_overflow: 'default'
    },
    actions: []
});

const promptStarterTemplateSelection = async (type, blueprints) => {
    const resolvedType = normalizeManagedType(type);
    const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    const templateList = Array.isArray(blueprints) ? blueprints.filter((entry) => String(entry?.name || '').trim() !== '') : [];
    if (!templateList.length) {
        return [];
    }

    const categoryIndexBuckets = new Map();
    const addCategoryIndex = (categoryId, index) => {
        const normalizedId = normalizeStarterTemplateCategory(categoryId);
        if (!normalizedId) {
            return;
        }
        if (!categoryIndexBuckets.has(normalizedId)) {
            categoryIndexBuckets.set(normalizedId, new Set());
        }
        categoryIndexBuckets.get(normalizedId).add(index);
    };
    const smartIndexes = resolveStarterTemplateSmartIndexes(resolvedType, templateList);
    smartIndexes.forEach((index) => addCategoryIndex('smart', index));
    templateList.forEach((entry, index) => {
        const entryCategories = Array.isArray(entry?.categories) ? entry.categories : [];
        for (const rawCategory of entryCategories) {
            addCategoryIndex(rawCategory, index);
        }
    });
    const preferredCategoryOrder = ['smart', 'homelab', 'media', 'minimal', 'network', 'automation', 'database', 'security', 'ops', 'dev', 'gaming', 'server', 'desktop', 'utility', 'backup', 'lab'];
    const categoryIds = [];
    for (const categoryId of preferredCategoryOrder) {
        if (categoryIndexBuckets.has(categoryId)) {
            categoryIds.push(categoryId);
        }
    }
    for (const categoryId of categoryIndexBuckets.keys()) {
        if (!categoryIds.includes(categoryId)) {
            categoryIds.push(categoryId);
        }
    }
    const getCategoryLabel = (categoryId) => {
        const fallback = categoryId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
        return String(STARTER_TEMPLATE_CATEGORY_META[categoryId]?.label || fallback);
    };
    const getCategoryCount = (categoryId) => {
        const indexes = categoryIndexBuckets.get(categoryId);
        return indexes instanceof Set ? indexes.size : 0;
    };
    const defaultCategoryId = categoryIds.includes('smart') ? 'smart' : (categoryIds.includes('homelab') ? 'homelab' : (categoryIds[0] || 'smart'));

    if (typeof window.swal !== 'function') {
        const categoryChoices = categoryIds
            .map((categoryId, index) => `${index + 1}. ${getCategoryLabel(categoryId)} (${getCategoryCount(categoryId)})`)
            .join('\n');
        const categoryRaw = window.prompt(
            `Choose ${typeLabel} template category:\n\n${categoryChoices}\n\nEnter number or category name. Leave blank for ${getCategoryLabel(defaultCategoryId)}.`,
            ''
        );
        if (categoryRaw === null) {
            return [];
        }
        const normalizedCategoryRaw = normalizeStarterTemplateCategory(categoryRaw);
        const categoryIndex = Number(String(categoryRaw || '').trim());
        let activeCategoryId = defaultCategoryId;
        if (Number.isInteger(categoryIndex) && categoryIndex > 0) {
            const mapped = categoryIds[categoryIndex - 1] || '';
            if (mapped) {
                activeCategoryId = mapped;
            }
        } else if (normalizedCategoryRaw && categoryIds.includes(normalizedCategoryRaw)) {
            activeCategoryId = normalizedCategoryRaw;
        }
        const categoryTemplates = Array.from(categoryIndexBuckets.get(activeCategoryId) || []).map((index) => templateList[index]).filter(Boolean);
        if (!categoryTemplates.length) {
            return [];
        }
        const numbered = categoryTemplates.map((entry, index) => `${index + 1}. ${String(entry.name || '').trim()}`).join('\n');
        const raw = window.prompt(
            `Select ${typeLabel} ${getCategoryLabel(activeCategoryId)} templates by number (comma-separated).\nLeave blank for all shown:\n\n${numbered}`,
            ''
        );
        if (raw === null) {
            return [];
        }
        const trimmed = String(raw || '').trim();
        if (!trimmed) {
            return categoryTemplates;
        }
        const selectedIndexes = new Set();
        const parts = trimmed.split(',');
        for (const part of parts) {
            const idx = Number(String(part || '').trim());
            if (!Number.isInteger(idx)) {
                continue;
            }
            const zeroBased = idx - 1;
            if (zeroBased >= 0 && zeroBased < categoryTemplates.length) {
                selectedIndexes.add(zeroBased);
            }
        }
        return categoryTemplates.filter((_, index) => selectedIndexes.has(index));
    }

    return new Promise((resolve) => {
        const categoryOptionsHtml = categoryIds.map((categoryId) => {
            const label = `${getCategoryLabel(categoryId)} (${getCategoryCount(categoryId)})`;
            const selected = categoryId === defaultCategoryId ? ' selected' : '';
            return `<option value="${escapeHtml(categoryId)}"${selected}>${escapeHtml(label)}</option>`;
        }).join('');
        const categoryHtml = `<div class="fv-starter-template-category-row"><label class="fv-starter-template-category-label" for="fv-starter-template-category-select">Category</label><select id="fv-starter-template-category-select" class="fv-starter-template-category-select">${categoryOptionsHtml}</select></div>`;
        const optionsHtml = templateList.map((entry, index) => {
            const name = String(entry.name || '').trim();
            const iconPath = String(entry.icon || '').trim() || DEFAULT_STARTER_FOLDER_ICON;
            const categories = Array.isArray(entry?.categories) ? entry.categories : [];
            const normalizedCategories = [...categories.map((value) => normalizeStarterTemplateCategory(value))];
            if (smartIndexes.has(index)) {
                normalizedCategories.push('smart');
            }
            return `<label class="fv-starter-template-option" data-fv-starter-template-categories="${escapeHtml(normalizedCategories.join(','))}"><input type="checkbox" class="fv-starter-template-checkbox" data-fv-starter-template-index="${index}" checked><img src="${escapeHtml(iconPath)}" alt="" class="fv-starter-template-option-icon"><span>${escapeHtml(name)}</span></label>`;
        }).join('');

        const applyCategoryFilter = (requestedCategoryId, resetSelection = false) => {
            const activeCategoryId = categoryIds.includes(requestedCategoryId) ? requestedCategoryId : defaultCategoryId;
            $('.fv-starter-template-category-select').val(activeCategoryId);
            let visibleCount = 0;
            $('.fv-starter-template-option').each((_, node) => {
                const categories = String($(node).attr('data-fv-starter-template-categories') || '')
                    .split(',')
                    .map((value) => normalizeStarterTemplateCategory(value))
                    .filter((value) => value !== '');
                const isVisible = categories.includes(activeCategoryId);
                $(node).toggle(isVisible);
                const checkbox = $(node).find('.fv-starter-template-checkbox');
                if (resetSelection) {
                    checkbox.prop('checked', isVisible);
                }
                if (isVisible) {
                    visibleCount += 1;
                }
            });
            $('.fv-starter-template-empty').toggle(visibleCount <= 0);
        };

        const clearCategoryBindings = () => {
            $(document).off('change.fvstartertemplatecategory', '.fv-starter-template-category-select');
        };

        swal({
            title: `Choose ${typeLabel} starter templates`,
            text: `<div class="fv-starter-template-dialog"><div class="fv-starter-template-help"><strong>Smart</strong> uses detected ${typeLabel === 'Docker' ? 'container' : 'VM'} names to pre-pick relevant folders. Pick a category, then choose what to deploy. Existing matching folder names will be skipped.</div><div class="fv-starter-template-categories">${categoryHtml}</div><div class="fv-starter-template-options">${optionsHtml}</div><div class="fv-starter-template-empty" data-fvplus-style="fv-u-xcjvns">No templates in this category.</div></div>`,
            html: true,
            type: 'info',
            showCancelButton: true,
            confirmButtonText: 'Create selected',
            cancelButtonText: 'Cancel',
            closeOnConfirm: false
        }, (confirmed) => {
            if (!confirmed) {
                clearCategoryBindings();
                resolve([]);
                return;
            }
            const selectedIndexes = $('.fv-starter-template-option:visible .fv-starter-template-checkbox:checked').map((_, node) => {
                const rawValue = Number($(node).attr('data-fv-starter-template-index'));
                return Number.isInteger(rawValue) ? rawValue : -1;
            }).get().filter((value) => value >= 0 && value < templateList.length);

            if (!selectedIndexes.length) {
                if (typeof swal.showInputError === 'function') {
                    swal.showInputError('Select at least one template.');
                }
                return false;
            }

            const selectedIndexSet = new Set(selectedIndexes);
            const selectedTemplates = templateList.filter((_, index) => selectedIndexSet.has(index));
            clearCategoryBindings();
            swal.close();
            resolve(selectedTemplates);
            return true;
        });

        $(document).off('change.fvstartertemplatecategory', '.fv-starter-template-category-select')
            .on('change.fvstartertemplatecategory', '.fv-starter-template-category-select', (event) => {
                const requestedCategoryId = normalizeStarterTemplateCategory($(event.currentTarget).val());
                applyCategoryFilter(requestedCategoryId, true);
            });
        window.setTimeout(() => {
            applyCategoryFilter(defaultCategoryId, false);
        }, 0);
    });
};

const quickCreateStarterFolder = async (type) => {
    const resolvedType = normalizeManagedType(type);
    if (!ensureRuntimeConflictActionAllowed(`Create ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder`)) {
        return;
    }
    const suggestedName = resolvedType === 'docker' ? 'New Docker Folder' : 'New VM Folder';
    const name = await promptStarterFolderName(resolvedType, suggestedName);
    if (!name) {
        return;
    }
    const folderPayload = buildStarterFolderPayload(name, DEFAULT_STARTER_FOLDER_ICON);
    try {
        await apiPostText('/plugins/folderview.plus/server/create.php', {
            type: resolvedType,
            content: JSON.stringify(folderPayload)
        });
        await refreshType(resolvedType);
        const createdFolderId = resolveFolderIdsByNames(resolvedType, [name])[0] || '';
        addActivityEntry(`${resolvedType === 'docker' ? 'Docker' : 'VM'} folder created: ${name}.`, 'success');
        showActionSummaryToast({
            title: 'Folder created',
            message: `${name} is ready.`,
            level: 'success',
            durationMs: 3600,
            type: resolvedType,
            focusFolderId: createdFolderId
        });
    } catch (error) {
        showError('Create folder failed', error);
    }
};

const quickCreateStarterTemplates = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    if (!ensureRuntimeConflictActionAllowed(`Create ${typeLabel} starter templates`)) {
        return;
    }

    const blueprints = Array.isArray(STARTER_TEMPLATE_BLUEPRINTS[resolvedType]) ? STARTER_TEMPLATE_BLUEPRINTS[resolvedType] : [];
    if (!blueprints.length) {
        return;
    }

    const selectedBlueprints = await promptStarterTemplateSelection(resolvedType, blueprints);
    if (!selectedBlueprints.length) {
        return;
    }

    try {
        const existingNames = new Set(
            Object.values(getFolderMap(resolvedType) || {}).map((folder) => String(folder?.name || '').trim().toLowerCase()).filter((name) => name !== '')
        );
        const createdNames = [];
        const creates = [];
        let skippedCount = 0;

        for (const blueprint of selectedBlueprints) {
            const folderName = String(blueprint?.name || '').trim();
            if (!folderName) {
                continue;
            }
            const normalizedName = folderName.toLowerCase();
            if (existingNames.has(normalizedName)) {
                skippedCount += 1;
                continue;
            }
            existingNames.add(normalizedName);
            const payload = buildStarterFolderPayload(folderName, String(blueprint?.icon || DEFAULT_STARTER_FOLDER_ICON));
            creates.push({ folder: payload });
            createdNames.push(folderName);
        }

        if (createdNames.length > 0) {
            await requestFolderBatchMutation(resolvedType, { deletes: [], upserts: [], creates });
            await refreshType(resolvedType);
        }

        const createdCount = createdNames.length;
        const createdFolderId = createdCount > 0 ? (resolveFolderIdsByNames(resolvedType, createdNames)[0] || '') : '';
        const messageParts = [`Created ${createdCount} starter folder${createdCount === 1 ? '' : 's'} from ${selectedBlueprints.length} selected template${selectedBlueprints.length === 1 ? '' : 's'}.`];
        if (skippedCount > 0) {
            messageParts.push(`Skipped ${skippedCount} existing.`);
        }
        const message = messageParts.join(' ');
        addActivityEntry(`${typeLabel} starter templates applied. ${message}`, createdCount > 0 ? 'success' : 'info');
        showActionSummaryToast({
            title: createdCount > 0 ? 'Starter templates created' : 'No starter templates created',
            message,
            level: createdCount > 0 ? 'success' : 'info',
            durationMs: 5000,
            type: resolvedType,
            focusFolderId: createdFolderId
        });
    } catch (error) {
        showError('Create starter templates failed', error);
    }
};

Object.assign(window, {
    DEFAULT_STARTER_FOLDER_ICON,
    STARTER_TEMPLATE_CATEGORY_META,
    normalizeStarterTemplateCategory,
    STARTER_TEMPLATE_BLUEPRINTS,
    STARTER_TEMPLATE_SMART_THRESHOLD,
    STARTER_TEMPLATE_FALLBACK_BY_TYPE,
    STARTER_TEMPLATE_MATCH_ALIASES,
    normalizeStarterTemplateMatchText,
    buildStarterTemplateHeuristicMap,
    collectStarterTemplateSmartSignals,
    resolveStarterTemplateSmartIndexes,
    buildStarterFolderPayload,
    promptStarterTemplateSelection,
    quickCreateStarterFolder,
    quickCreateStarterTemplates
});

window.FolderViewPlusStarterTemplates = Object.freeze({
    DEFAULT_STARTER_FOLDER_ICON,
    STARTER_TEMPLATE_CATEGORY_META,
    STARTER_TEMPLATE_BLUEPRINTS,
    STARTER_TEMPLATE_SMART_THRESHOLD,
    STARTER_TEMPLATE_FALLBACK_BY_TYPE,
    STARTER_TEMPLATE_MATCH_ALIASES,
    normalizeStarterTemplateCategory,
    normalizeStarterTemplateMatchText,
    buildStarterTemplateHeuristicMap,
    collectStarterTemplateSmartSignals,
    resolveStarterTemplateSmartIndexes,
    buildStarterFolderPayload,
    promptStarterTemplateSelection,
    quickCreateStarterFolder,
    quickCreateStarterTemplates
});
window.FolderViewPlusStarterTemplatesModuleLoaded = true;
