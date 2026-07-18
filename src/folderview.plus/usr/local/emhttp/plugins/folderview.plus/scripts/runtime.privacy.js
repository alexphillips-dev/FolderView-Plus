(function fvplusRuntimePrivacyScope(window) {
    'use strict';

    const CATEGORY_CLASSES = Object.freeze({
        volumePaths: 'fvplus-sensitive-volume-path',
        imageRegistry: 'fvplus-sensitive-image-registry',
        vmDiskPaths: 'fvplus-sensitive-vm-disk-path',
        macAddresses: 'fvplus-sensitive-mac-address',
        publicIps: 'fvplus-sensitive-public-ip',
        interfaces: 'fvplus-sensitive-interface',
        externalUrls: 'fvplus-sensitive-external-url'
    });
    const ALL_CLASSES = Object.values(CATEGORY_CLASSES);
    const state = { docker: { enabled: false, prefs: {} }, vm: { enabled: false, prefs: {} } };
    let observer = null;
    let scanQueued = false;

    const isPublicIpv4 = (value) => {
        const parts = String(value || '').split('.').map(Number);
        if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
        const [a, b] = parts;
        return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
    };
    const isPublicIpv6 = (value) => {
        const normalized = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
        if (!normalized.includes(':') || normalized === '::' || normalized === '::1') return false;
        const embeddedIpv4 = normalized.match(/(?:\d{1,3}\.){3}\d{1,3}$/)?.[0];
        if (embeddedIpv4) return isPublicIpv4(embeddedIpv4);
        const firstHextet = normalized.split(':').find(Boolean);
        if (!firstHextet || !/^[0-9a-f]{1,4}$/.test(firstHextet)) return false;
        const firstValue = Number.parseInt(firstHextet, 16);
        return firstValue >= 0x2000 && firstValue <= 0x3fff && !normalized.startsWith('2001:db8:');
    };

    const categoriesForText = (text) => {
        const value = String(text || '').trim();
        if (!value) return [];
        const categories = [];
        if (/\/(?:mnt|boot|var\/lib|srv)\/[\w .@+/:=-]+/i.test(value)) categories.push('volumePaths');
        if (/(?:\.qcow2?|\.img|\.raw|\.vmdk|\.vhdx?)\b/i.test(value)) categories.push('vmDiskPaths');
        if (/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i.test(value)) categories.push('macAddresses');
        if (/\b(?:ghcr\.io|docker\.io|quay\.io|lscr\.io|registry\.[\w.-]+)\//i.test(value)) categories.push('imageRegistry');
        if (/\b(?:br\d*|bond\d*|eth\d+|en[opsx]\w+|vlan\d+|virbr\d+|wg\d+|tun\d+)\b/i.test(value)) categories.push('interfaces');
        const ipv4Matches = value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
        const ipv6Matches = value.match(/(?:\[)?(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:\])?/gi) || [];
        if (ipv4Matches.some(isPublicIpv4) || ipv6Matches.some(isPublicIpv6)) categories.push('publicIps');
        return categories;
    };

    const decorateElement = (element, categories) => {
        if (!(element instanceof Element) || element.closest('script, style, textarea, input, select, option')) return;
        const target = element.closest('span, a, code, pre, td, dd, p, div') || element;
        categories.forEach((category) => target.classList.add(CATEGORY_CLASSES[category]));
    };

    const scan = () => {
        scanQueued = false;
        document.querySelectorAll(`.${ALL_CLASSES.join(',.')}`).forEach((element) => element.classList.remove(...ALL_CLASSES));
        if (!Object.values(state).some((snapshot) => snapshot.enabled)) return;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                return parent && String(node.nodeValue || '').trim() && !parent.closest('script, style, textarea, input, select, option')
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        });
        let node;
        while ((node = walker.nextNode())) {
            const categories = categoriesForText(node.nodeValue);
            if (categories.length) decorateElement(node.parentElement, categories);
        }
        document.querySelectorAll('a[href^="http://"], a[href^="https://"]').forEach((anchor) => {
            try {
                if (new URL(anchor.href, window.location.href).host !== window.location.host) {
                    anchor.classList.add(CATEGORY_CLASSES.externalUrls);
                }
            } catch (_error) { /* Ignore malformed links. */ }
        });
    };

    const queueScan = () => {
        if (scanQueued) return;
        scanQueued = true;
        (window.requestAnimationFrame || window.setTimeout)(scan, 16);
    };

    const syncBodyClasses = () => {
        const body = document.body;
        if (!body) return;
        for (const [type, snapshot] of Object.entries(state)) {
            const prefix = `fvplus-privacy-${type}-sensitive`;
            body.classList.toggle(prefix, snapshot.enabled);
            for (const key of Object.keys(CATEGORY_CLASSES)) {
                const prefKey = {
                    volumePaths: 'privacyMaskVolumePaths', imageRegistry: 'privacyMaskImageRegistry',
                    vmDiskPaths: 'privacyMaskVmDiskPaths', macAddresses: 'privacyMaskMacAddresses',
                    publicIps: 'privacyMaskPublicIps', interfaces: 'privacyMaskInterfaces', externalUrls: 'privacyMaskExternalUrls'
                }[key];
                body.classList.toggle(`${prefix}-${key}`, snapshot.enabled && snapshot.prefs?.[prefKey] !== false);
            }
        }
        queueScan();
    };

    const apply = (type, enabled, prefs = {}) => {
        if (!Object.prototype.hasOwnProperty.call(state, type)) return;
        state[type] = { enabled: enabled === true, prefs: prefs && typeof prefs === 'object' ? prefs : {} };
        syncBodyClasses();
        if (Object.values(state).some((snapshot) => snapshot.enabled)) {
            start();
        } else if (observer) {
            observer.disconnect();
            observer = null;
        }
    };

    const start = () => {
        if (observer || !document.body || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(queueScan);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
        queueScan();
    };

    window.FolderViewPlusRuntimePrivacy = Object.freeze({ apply, scan: queueScan, categoriesForText, isPublicIpv4, isPublicIpv6 });
})(window);
