/* Shared smart-detect scoring config for starter templates and setup assistant. */
const FVPLUS_SMART_DETECT_MATCH_THRESHOLD = 4;
const FVPLUS_SMART_DETECT_CONFIDENT_THRESHOLD = 8;
const FVPLUS_SMART_DETECT_FALLBACK_BY_TYPE = Object.freeze({
    docker: 'Utilities',
    vm: 'Utility VMs'
});
const FVPLUS_SMART_DETECT_MATCH_ALIASES = Object.freeze({
    docker: Object.freeze({
        jellyseerr: Object.freeze(['seerr', 'overseerr', 'media', 'request']),
        wizarrrr: Object.freeze(['wizarr', 'media', 'invite']),
        'nginx-proxy-manager': Object.freeze(['reverse proxy', 'proxy', 'npm']),
        cloudflared: Object.freeze(['cloudflare', 'tunnel', 'remote access']),
        homeassistant: Object.freeze(['home assistant', 'automation', 'haos']),
        haos: Object.freeze(['home assistant', 'automation']),
        'code-server': Object.freeze(['development', 'vscode', 'coder']),
        unifi: Object.freeze(['network', 'controller']),
        wg: Object.freeze(['wireguard', 'remote access'])
    }),
    vm: Object.freeze({
        pve: Object.freeze(['proxmox', 'management', 'hypervisor']),
        proxmox: Object.freeze(['pve', 'management', 'hypervisor']),
        haos: Object.freeze(['home assistant', 'automation']),
        omv: Object.freeze(['openmediavault', 'utility', 'management']),
        truenas: Object.freeze(['storage', 'server', 'management']),
        unifi: Object.freeze(['network', 'controller']),
        dc: Object.freeze(['domain controller', 'identity', 'infrastructure'])
    })
});

Object.assign(window, {
    FVPLUS_SMART_DETECT_MATCH_THRESHOLD,
    FVPLUS_SMART_DETECT_CONFIDENT_THRESHOLD,
    FVPLUS_SMART_DETECT_FALLBACK_BY_TYPE,
    FVPLUS_SMART_DETECT_MATCH_ALIASES
});

window.FolderViewPlusSmartDetectConfig = Object.freeze({
    matchThreshold: FVPLUS_SMART_DETECT_MATCH_THRESHOLD,
    confidentThreshold: FVPLUS_SMART_DETECT_CONFIDENT_THRESHOLD,
    fallbackByType: FVPLUS_SMART_DETECT_FALLBACK_BY_TYPE,
    matchAliases: FVPLUS_SMART_DETECT_MATCH_ALIASES
});
window.FolderViewPlusSmartDetectConfigModuleLoaded = true;
