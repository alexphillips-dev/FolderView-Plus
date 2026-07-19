(function installFolderViewPlusI18n(root) {
    'use strict';

    if (!root || root.FolderViewPlusI18n) {
        return;
    }

    const MAX_RECENT_MISSING_KEYS = 50;
    const MAX_DYNAMIC_ROOTS_BEFORE_FULL_SCAN = 80;
    const AUTO_KEY_PREFIX = 'legacy.surface.';
    const AUTO_TRANSLATABLE_ATTRIBUTES = Object.freeze(['placeholder', 'aria-label', 'title']);
    const AUTO_IGNORE_SELECTOR = [
        '[data-i18n-ignore]',
        '[data-fvplus-user-content]',
        'script', 'style', 'code', 'pre', 'textarea', 'svg',
        '.appname', '.folder-appname', '.folder-appname-docker', '.folder-appname-vm',
        '.folder-name', '.preview-name', '[data-container-name]', '[data-folder-name]'
    ].join(',');
    const RTL_LANGUAGES = new Set(['ar', 'dv', 'fa', 'he', 'ku', 'ps', 'ur', 'yi']);
    const state = {
        requestedLocale: 'en',
        resolvedLocale: 'en',
        activeLocale: 'en',
        fallbackChain: ['en'],
        direction: 'ltr',
        requestedDirection: 'ltr',
        catalogVersion: 'unknown',
        catalogReport: null,
        registry: {},
        namespaces: ['legacy'],
        loadedCatalogs: [],
        loadErrors: [],
        missingKeys: new Set(),
        autoBoundMessageCount: 0,
        autoTranslatedNodeCount: 0,
        dynamicTranslationObserver: false,
        initialized: false,
        readyAt: null
    };
    let readyResolve;
    let readyReject;
    let configured = false;
    let autoPhraseIndex = new Map();
    let autoTemplateIndex = [];
    let translationObserver = null;
    let pendingTranslationRoots = new Set();
    let translationFlushQueued = false;
    const lastAutoText = new WeakMap();
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

    const normalizeAutoPhrase = (value) => String(value || '').replace(/\s+/g, ' ').trim();

    const rebuildAutoPhraseIndex = () => {
        const english = root.jQuery?.i18n?.messageStore?.messages?.en || {};
        autoPhraseIndex = new Map();
        autoTemplateIndex = [];
        Object.entries(english).forEach(([key, value]) => {
            if (!String(key).startsWith(AUTO_KEY_PREFIX) || typeof value !== 'string') return;
            const phrase = normalizeAutoPhrase(value);
            if (!phrase) return;
            if (!/\$\d+/.test(phrase)) {
                autoPhraseIndex.set(phrase, key);
                return;
            }
            let pattern = '^';
            let cursor = 0;
            const parameterOrder = [];
            const tokenRegex = /\$(\d+)/g;
            let token;
            const escapeRegex = (part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            while ((token = tokenRegex.exec(phrase)) !== null) {
                pattern += escapeRegex(phrase.slice(cursor, token.index));
                pattern += '(.+?)';
                parameterOrder.push(Number(token[1]));
                cursor = token.index + token[0].length;
            }
            pattern += `${escapeRegex(phrase.slice(cursor))}$`;
            autoTemplateIndex.push({ key, phrase, regex: new RegExp(pattern), parameterOrder });
        });
        state.autoBoundMessageCount = autoPhraseIndex.size + autoTemplateIndex.length;
    };

    const resolveAutoTranslation = (phrase) => {
        const exactKey = autoPhraseIndex.get(phrase);
        if (exactKey) return translate(exactKey, phrase);
        for (const template of autoTemplateIndex) {
            const match = phrase.match(template.regex);
            if (!match) continue;
            const parameters = [];
            template.parameterOrder.forEach((number, index) => {
                parameters[number - 1] = match[index + 1];
            });
            return translate(template.key, template.phrase, ...parameters);
        }
        return '';
    };

    const isAutoIgnored = (element) => {
        if (!element || typeof element.closest !== 'function') return false;
        return Boolean(element.closest(AUTO_IGNORE_SELECTOR));
    };

    const translateAutoTextNode = (node) => {
        const parent = node?.parentElement;
        if (!parent || isAutoIgnored(parent) || parent.hasAttribute?.('data-i18n')) return false;
        const source = String(node.nodeValue || '');
        if (lastAutoText.get(node) === source) return false;
        const phrase = normalizeAutoPhrase(source);
        const localized = resolveAutoTranslation(phrase);
        if (!localized || localized === phrase) return false;
        const leading = source.match(/^\s*/)?.[0] || '';
        const trailing = source.match(/\s*$/)?.[0] || '';
        const output = `${leading}${localized}${trailing}`;
        if (output === source) return false;
        lastAutoText.set(node, output);
        node.nodeValue = output;
        state.autoTranslatedNodeCount += 1;
        return true;
    };

    const translateAutoElementAttributes = (element) => {
        if (!element || isAutoIgnored(element)) return;
        const explicitBinding = String(element.getAttribute?.('data-i18n') || '');
        AUTO_TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
            if (explicitBinding.includes(`[${attribute}]`)) return;
            const source = String(element.getAttribute?.(attribute) || '');
            const phrase = normalizeAutoPhrase(source);
            const localized = resolveAutoTranslation(phrase);
            if (!localized || localized === source) return;
            if (element.getAttribute(attribute) === localized) return;
            element.setAttribute(attribute, localized);
            state.autoTranslatedNodeCount += 1;
        });
    };

    const translateAutoDom = (target = root.document?.body) => {
        if (!target || (autoPhraseIndex.size === 0 && autoTemplateIndex.length === 0)) return;
        const document = target.ownerDocument || root.document;
        if (!document) return;
        const visitElement = (element) => {
            translateAutoElementAttributes(element);
            Array.from(element.childNodes || []).forEach((child) => {
                if (child.nodeType === 3) translateAutoTextNode(child);
            });
        };
        if (target.nodeType === 3) {
            translateAutoTextNode(target);
            return;
        }
        if (target.nodeType === 1) visitElement(target);
        if (typeof target.querySelectorAll === 'function') {
            target.querySelectorAll('*').forEach(visitElement);
        }
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
            translateAutoDom(target);
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
                    const localized = translate(key, node.innerHTML || '');
                    if (node.innerHTML !== localized) node.innerHTML = localized;
                    return;
                }
                if (targetName !== 'text') {
                    const fallback = String(node.getAttribute?.(targetName) || '');
                    const localized = translate(key, fallback);
                    if (fallback !== localized) node.setAttribute?.(targetName, localized);
                    return;
                }
                const localized = translate(key, node.textContent || '');
                if (node.textContent !== localized) node.textContent = localized;
            });
        });
        translateAutoDom(target);
    };

    const flushPendingTranslations = () => {
        translationFlushQueued = false;
        const candidates = Array.from(pendingTranslationRoots).filter(Boolean);
        pendingTranslationRoots.clear();
        const roots = candidates.length > MAX_DYNAMIC_ROOTS_BEFORE_FULL_SCAN
            ? [root.document?.body].filter(Boolean)
            : candidates.filter((candidate, index, all) => !all.some((other, otherIndex) => (
                otherIndex !== index && other?.nodeType === 1 && typeof other.contains === 'function' && other.contains(candidate)
            )));
        roots.forEach((target) => translateDom(target));
    };

    const queueDynamicTranslation = (target) => {
        if (!target) return;
        pendingTranslationRoots.add(target.nodeType === 3 ? target.parentElement : target);
        if (translationFlushQueued) return;
        translationFlushQueued = true;
        if (typeof root.requestAnimationFrame === 'function') {
            root.requestAnimationFrame(flushPendingTranslations);
        } else {
            root.setTimeout?.(flushPendingTranslations, 0);
        }
    };

    const observeDynamicTranslations = () => {
        if (translationObserver || typeof root.MutationObserver !== 'function' || !root.document?.body) return;
        translationObserver = new root.MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData') queueDynamicTranslation(mutation.target);
                Array.from(mutation.addedNodes || []).forEach(queueDynamicTranslation);
            });
        });
        translationObserver.observe(root.document.body, { childList: true, characterData: true, subtree: true });
        state.dynamicTranslationObserver = true;
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
    const compare = (left, right, options = {}) => {
        try {
            return formatter('Collator', { sensitivity: 'base', numeric: true, ...options }).compare(String(left ?? ''), String(right ?? ''));
        } catch (_error) {
            return String(left ?? '').localeCompare(String(right ?? ''));
        }
    };

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
        rebuildAutoPhraseIndex();
        translateDom();
        return snapshot();
    };

    const restoreLocale = () => {
        root.jQuery?.i18n?.({ locale: state.requestedLocale });
        state.activeLocale = state.requestedLocale;
        state.direction = state.requestedDirection;
        setDocumentLocale(state.requestedLocale, state.direction);
        rebuildAutoPhraseIndex();
        translateDom();
        return snapshot();
    };

    const snapshot = () => {
        const localeRows = state.catalogReport?.locales && typeof state.catalogReport.locales === 'object'
            ? state.catalogReport.locales
            : {};
        const activeReport = localeRows[state.resolvedLocale]
            || localeRows[state.requestedLocale]
            || localeRows.en
            || null;
        const requestedReport = localeRows[state.requestedLocale] || null;
        return ({
        requestedLocale: state.requestedLocale,
        resolvedLocale: state.resolvedLocale,
        activeLocale: state.activeLocale,
        fallbackChain: state.fallbackChain.slice(),
        direction: state.direction,
        catalogVersion: state.catalogVersion,
        catalogSummary: state.catalogReport ? {
            sourceMessageCount: Number(state.catalogReport.sourceMessageCount) || 0,
            namespaceCount: Number(state.catalogReport.namespaceCount) || 0,
            localeCount: Object.keys(localeRows).length,
            extractionCandidateCount: Number(state.catalogReport.extraction?.candidateCount) || 0,
            autoBoundMessageCount: Number(state.catalogReport.extraction?.autoBoundMessageCount) || 0,
            largestUnextractedSurfaces: { ...(state.catalogReport.extraction?.largestSurfaces || {}) }
        } : null,
        activeLocaleReport: activeReport ? { ...activeReport } : null,
        requestedLocaleReport: requestedReport ? { ...requestedReport } : null,
        localeCoverage: Object.fromEntries(Object.entries(localeRows).map(([locale, report]) => [locale, {
            status: String(report?.status || 'placeholder'),
            reviewed: report?.reviewed === true,
            reviewedAgainstCurrentSource: report?.reviewedAgainstCurrentSource === true,
            translatedMessages: Number(report?.translatedMessages) || 0,
            totalSourceMessages: Number(report?.totalSourceMessages) || 0,
            missingMessages: Number(report?.missingMessages) || 0,
            coveragePercent: Number(report?.coveragePercent) || 0,
            potentiallyStaleMessages: Number(report?.potentiallyStaleMessages) || 0
        }])),
        namespaces: state.namespaces.slice(),
        loadedCatalogs: state.loadedCatalogs.map((entry) => ({ ...entry })),
        loadErrors: state.loadErrors.map((entry) => ({ ...entry })),
        missingKeyCount: state.missingKeys.size,
        recentMissingKeys: Array.from(state.missingKeys),
        autoBoundMessageCount: state.autoBoundMessageCount,
        autoTranslatedNodeCount: state.autoTranslatedNodeCount,
        dynamicTranslationObserver: state.dynamicTranslationObserver,
        initialized: state.initialized,
        readyAt: state.readyAt
        });
    };

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
        state.catalogReport = config.catalogReport && typeof config.catalogReport === 'object'
            ? config.catalogReport
            : null;
        state.registry = config.registry && typeof config.registry === 'object' ? config.registry : {};
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
            rebuildAutoPhraseIndex();
            state.initialized = true;
            state.readyAt = new Date().toISOString();
            translateDom();
            observeDynamicTranslations();
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
        compare,
        snapshot,
        usePseudoLocale,
        restoreLocale
    });
}(typeof window !== 'undefined' ? window : globalThis));
