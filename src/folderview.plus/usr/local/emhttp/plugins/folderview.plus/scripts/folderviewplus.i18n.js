(function installFolderViewPlusI18n(root) {
    'use strict';

    if (!root || root.FolderViewPlusI18n) {
        return;
    }

    const MAX_RECENT_MISSING_KEYS = 50;
    const RTL_LANGUAGES = new Set(['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'ur', 'yi']);
    const state = {
        requestedLocale: 'en',
        resolvedLocale: 'en',
        activeLocale: 'en',
        fallbackChain: ['en'],
        direction: 'ltr',
        requestedDirection: 'ltr',
        catalogVersion: 'unknown',
        namespaces: ['legacy'],
        loadedCatalogs: [],
        loadErrors: [],
        missingKeys: new Set(),
        initialized: false,
        readyAt: null
    };
    let readyResolve;
    let readyReject;
    let configured = false;
    const ready = new Promise((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
    });

    const normalizeLocale = (value) => {
        const raw = String(value || '').trim().replace(/_/g, '-');
        if (!raw) {
            return 'en';
        }
        try {
            const canonical = Intl.getCanonicalLocales(raw);
            return canonical[0] || 'en';
        } catch (_error) {
            return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(raw) ? raw : 'en';
        }
    };

    const localeDirection = (locale, configuredDirection = '') => {
        if (configuredDirection === 'rtl' || configuredDirection === 'ltr') {
            return configuredDirection;
        }
        const language = normalizeLocale(locale).split('-')[0].toLowerCase();
        return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
    };

    const setDocumentLocale = (locale, direction) => {
        const documentElement = root.document?.documentElement;
        if (!documentElement) {
            return;
        }
        documentElement.lang = normalizeLocale(locale);
        documentElement.dir = localeDirection(locale, direction);
    };

    const recordMissingKey = (key) => {
        const normalized = String(key || '').trim();
        if (!normalized) {
            return;
        }
        state.missingKeys.add(normalized);
        if (state.missingKeys.size > MAX_RECENT_MISSING_KEYS) {
            const oldest = state.missingKeys.values().next().value;
            state.missingKeys.delete(oldest);
        }
    };

    const interpolateFallback = (fallback, params) => String(fallback || '').replace(/\$(\d+)/g, (match, index) => {
        const position = Number(index) - 1;
        return position >= 0 && position < params.length ? String(params[position]) : match;
    });

    const translate = (key, fallback = '', ...params) => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) {
            return interpolateFallback(fallback, params);
        }
        let localized = '';
        try {
            if (typeof root.jQuery?.i18n === 'function') {
                localized = String(root.jQuery.i18n(normalizedKey, ...params) || '').trim();
            }
        } catch (_error) {
            localized = '';
        }
        if (!localized || localized === normalizedKey) {
            recordMissingKey(normalizedKey);
            return interpolateFallback(fallback || normalizedKey, params);
        }
        return localized;
    };

    const translateDom = (target = root.document?.body) => {
        if (!target) {
            return;
        }
        const translatableNodes = [];
        if (typeof target.matches === 'function' && target.matches('[data-i18n]')) {
            translatableNodes.push(target);
        }
        if (typeof target.querySelectorAll === 'function') {
            translatableNodes.push(...target.querySelectorAll('[data-i18n]'));
        }
        if (translatableNodes.length === 0) {
            const $target = typeof root.jQuery === 'function' ? root.jQuery(target) : null;
            if (typeof $target?.i18n === 'function') {
                $target.i18n();
            }
            return;
        }
        translatableNodes.forEach((node) => {
            const binding = String(node.getAttribute?.('data-i18n') || '').trim();
            if (!binding) {
                return;
            }
            binding.split(';').map((entry) => entry.trim()).filter(Boolean).forEach((entry) => {
                const attributeMatch = entry.match(/^\[([^\]]+)\](.+)$/);
                const targetName = attributeMatch ? String(attributeMatch[1] || '').trim() : 'text';
                const key = String(attributeMatch ? attributeMatch[2] : entry).trim();
                if (!key) {
                    return;
                }
                if (targetName === 'html') {
                    node.innerHTML = translate(key, node.innerHTML || '');
                    return;
                }
                if (targetName !== 'text') {
                    const fallback = String(node.getAttribute?.(targetName) || '');
                    node.setAttribute?.(targetName, translate(key, fallback));
                    return;
                }
                node.textContent = translate(key, node.textContent || '');
            });
        });
    };

    const formatter = (type, options = {}) => {
        const locale = state.activeLocale || state.resolvedLocale || 'en';
        try {
            return new Intl[type](locale, options);
        } catch (_error) {
            return new Intl[type]('en', options);
        }
    };

    const formatNumber = (value, options = {}) => formatter('NumberFormat', options).format(value);
    const formatDate = (value, options = {}) => formatter('DateTimeFormat', options).format(value instanceof Date ? value : new Date(value));
    const formatRelativeTime = (value, unit, options = {}) => formatter('RelativeTimeFormat', options).format(value, unit);
    const formatList = (values, options = {}) => formatter('ListFormat', options).format(Array.isArray(values) ? values : []);

    const pseudoAccentMap = Object.freeze({
        A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'Ë', F: 'Ƒ', G: 'Ĝ', H: 'Ħ', I: 'Ï', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
        N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ŧ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ŷ', Z: 'Ž',
        a: 'å', b: 'ƀ', c: 'ç', d: 'đ', e: 'ë', f: 'ƒ', g: 'ĝ', h: 'ħ', i: 'ï', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ṁ',
        n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ŧ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ŷ', z: 'ž'
    });

    const transformPseudoText = (value, transform) => String(value || '')
        .split(/(\{\{[\s\S]*?\}\}|<[^>]+>|&[A-Za-z0-9#]+;|\$\d+)/g)
        .map((part) => /^(?:\{\{|<|&|\$\d+)/.test(part) ? part : transform(part))
        .join('');

    const pseudoExpand = (value) => {
        const source = String(value || '');
        const transformed = transformPseudoText(source, (part) => part.replace(/[A-Za-z]/g, (character) => pseudoAccentMap[character] || character));
        return `[¡ ${transformed} ${transformed.slice(0, Math.ceil(transformed.length * 0.3))} !]`;
    };

    const pseudoRtl = (value) => `‮${transformPseudoText(value, (part) => part.split('').reverse().join(''))}‬`;

    const usePseudoLocale = (locale = 'en-XA') => {
        const normalized = normalizeLocale(locale);
        if (!['en-XA', 'ar-XB'].includes(normalized)) {
            throw new Error('Pseudo locale must be en-XA or ar-XB.');
        }
        const store = root.jQuery?.i18n?.messageStore?.messages;
        const english = store?.en;
        if (!english || typeof english !== 'object') {
            throw new Error('The English catalog must be loaded before enabling a pseudo locale.');
        }
        const transform = normalized === 'ar-XB' ? pseudoRtl : pseudoExpand;
        const messages = {};
        Object.entries(english).forEach(([key, value]) => {
            if (key !== '@metadata' && typeof value === 'string') {
                messages[key] = transform(value);
            }
        });
        root.jQuery.i18n.messageStore.set(normalized, messages);
        root.jQuery.i18n({ locale: normalized });
        state.activeLocale = normalized;
        state.direction = normalized === 'ar-XB' ? 'rtl' : 'ltr';
        setDocumentLocale(normalized, state.direction);
        translateDom();
        return snapshot();
    };

    const restoreLocale = () => {
        root.jQuery?.i18n?.({ locale: state.requestedLocale });
        state.activeLocale = state.requestedLocale;
        state.direction = state.requestedDirection;
        setDocumentLocale(state.requestedLocale, state.direction);
        translateDom();
        return snapshot();
    };

    const snapshot = () => ({
        requestedLocale: state.requestedLocale,
        resolvedLocale: state.resolvedLocale,
        activeLocale: state.activeLocale,
        fallbackChain: state.fallbackChain.slice(),
        direction: state.direction,
        catalogVersion: state.catalogVersion,
        namespaces: state.namespaces.slice(),
        loadedCatalogs: state.loadedCatalogs.map((entry) => ({ ...entry })),
        loadErrors: state.loadErrors.map((entry) => ({ ...entry })),
        missingKeyCount: state.missingKeys.size,
        recentMissingKeys: Array.from(state.missingKeys),
        initialized: state.initialized,
        readyAt: state.readyAt
    });

    const loadCatalog = async (asset) => {
        const locale = normalizeLocale(asset?.locale || 'en');
        const namespace = String(asset?.namespace || 'legacy').trim() || 'legacy';
        const url = String(asset?.url || '').trim();
        if (!url) {
            return;
        }
        try {
            const response = await root.fetch(url, { credentials: 'same-origin', cache: 'default' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const messages = await response.json();
            if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
                throw new Error('Catalog response is not an object.');
            }
            await root.jQuery.i18n().load(messages, locale);
            state.loadedCatalogs.push({ locale, namespace, keyCount: Object.keys(messages).filter((key) => key !== '@metadata').length });
        } catch (error) {
            state.loadErrors.push({ locale, namespace, error: String(error?.message || error || 'Catalog load failed') });
        }
    };

    const configure = async (config = {}) => {
        if (configured) {
            return ready;
        }
        configured = true;
        state.requestedLocale = normalizeLocale(config.requestedLocale || 'en');
        state.resolvedLocale = normalizeLocale(config.resolvedLocale || 'en');
        state.activeLocale = state.requestedLocale;
        state.fallbackChain = Array.isArray(config.fallbackChain)
            ? config.fallbackChain.map(normalizeLocale)
            : [state.requestedLocale, state.resolvedLocale, 'en'];
        state.direction = localeDirection(state.requestedLocale, config.direction || '');
        state.requestedDirection = state.direction;
        state.catalogVersion = String(config.catalogVersion || 'unknown');
        state.namespaces = Array.isArray(config.namespaces) ? config.namespaces.map(String) : ['legacy'];
        setDocumentLocale(state.requestedLocale, state.direction);
        try {
            if (typeof root.jQuery?.i18n !== 'function' || typeof root.fetch !== 'function') {
                throw new Error('Localization dependencies are unavailable.');
            }
            root.jQuery.i18n({ locale: state.requestedLocale, fallbackLocale: 'en' });
            const assets = Array.isArray(config.assets) ? config.assets : [];
            for (const asset of assets) {
                await loadCatalog(asset);
            }
            state.initialized = true;
            state.readyAt = new Date().toISOString();
            translateDom();
            if (typeof root.folderi18n === 'function') {
                root.folderi18n();
            }
            const EventConstructor = root.CustomEvent;
            if (typeof EventConstructor === 'function') {
                root.document?.dispatchEvent(new EventConstructor('folderviewplus:i18n-ready', { detail: snapshot() }));
            }
            readyResolve(snapshot());
        } catch (error) {
            state.loadErrors.push({ locale: state.requestedLocale, namespace: 'bootstrap', error: String(error?.message || error) });
            state.initialized = true;
            state.readyAt = new Date().toISOString();
            setDocumentLocale('en', 'ltr');
            readyReject(error);
        }
        return ready;
    };

    root.FolderViewPlusI18n = Object.freeze({
        ready,
        configure,
        t: translate,
        translate: translateDom,
        formatNumber,
        formatDate,
        formatRelativeTime,
        formatList,
        snapshot,
        usePseudoLocale,
        restoreLocale
    });
}(typeof window !== 'undefined' ? window : globalThis));
