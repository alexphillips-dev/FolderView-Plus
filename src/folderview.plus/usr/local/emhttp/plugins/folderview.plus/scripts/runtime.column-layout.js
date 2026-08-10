(() => {
    const DEFAULT_PRESET_WIDTHS = Object.freeze({
        compact: 128,
        standard: 142,
        wide: 188
    });

    const normalizeMode = (value) => {
        const mode = String(value || '').trim().toLowerCase();
        if (mode === 'compact' || mode === 'wide') {
            return mode;
        }
        return 'standard';
    };

    const createColumnLayoutEngine = (options = {}) => {
        const minWidth = Number.isFinite(Number(options.minWidth)) ? Math.round(Number(options.minWidth)) : 118;
        const maxWidth = Number.isFinite(Number(options.maxWidth)) ? Math.round(Number(options.maxWidth)) : 1280;
        const mobileScale = Number.isFinite(Number(options.mobileScale)) ? Number(options.mobileScale) : 0.82;
        const mobileMin = Number.isFinite(Number(options.mobileMin)) ? Math.round(Number(options.mobileMin)) : 108;
        const desktopVarName = String(options.desktopVarName || '--fvplus-docker-app-column-width');
        const mobileVarName = String(options.mobileVarName || '--fvplus-docker-app-column-width-mobile');
        const presetWidths = options.presetWidths && typeof options.presetWidths === 'object'
            ? options.presetWidths
            : DEFAULT_PRESET_WIDTHS;
        const cacheKey = String(options.cacheKey || '').trim();
        const cacheSchemaVersion = Math.max(1, Number(options.cacheSchemaVersion) || 1);
        const algorithmVersion = String(options.algorithmVersion || 'content-aware-v1').trim() || 'content-aware-v1';
        const storage = options.storage || (() => {
            try {
                return window.localStorage || null;
            } catch (_error) {
                return null;
            }
        })();

        const clampWidth = (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
                return null;
            }
            const rounded = Math.round(parsed);
            return Math.max(minWidth, Math.min(maxWidth, rounded));
        };

        const resolvePresetWidth = (mode) => {
            const normalizedMode = normalizeMode(mode);
            const preset = Number(presetWidths[normalizedMode] ?? presetWidths.standard ?? DEFAULT_PRESET_WIDTHS.standard);
            return clampWidth(preset);
        };

        const resolveBootstrapWidth = ({
            baseline = null,
            estimated = null,
            cached = null,
            floor = null
        } = {}) => {
            const candidates = [baseline, estimated, cached, floor]
                .map((value) => clampWidth(value))
                .filter((value) => Number.isFinite(value));
            return candidates.length > 0
                ? Math.max(...candidates)
                : resolvePresetWidth('standard');
        };

        const readCachePayload = () => {
            if (!storage || !cacheKey) {
                return null;
            }
            try {
                const parsed = JSON.parse(storage.getItem(cacheKey) || '{}');
                if (
                    !parsed
                    || typeof parsed !== 'object'
                    || parsed.schemaVersion !== cacheSchemaVersion
                    || parsed.algorithmVersion !== algorithmVersion
                    || !parsed.widths
                    || typeof parsed.widths !== 'object'
                ) {
                    return null;
                }
                return parsed;
            } catch (_error) {
                return null;
            }
        };

        const readCachedWidth = (mode = 'standard', contentSignature = '') => {
            const cached = readCachePayload()?.widths?.[normalizeMode(mode)];
            if (!cached || typeof cached !== 'object') {
                return null;
            }
            const expectedSignature = String(contentSignature || '').trim();
            if (expectedSignature && String(cached.contentSignature || '') !== expectedSignature) {
                return null;
            }
            return clampWidth(cached.width);
        };

        const writeCachedWidth = (
            mode = 'standard',
            width = null,
            contentSignature = '',
            storageWriter = null
        ) => {
            const safeWidth = clampWidth(width);
            if (!safeWidth || !storage || !cacheKey) {
                return false;
            }
            const normalizedMode = normalizeMode(mode);
            const payload = JSON.stringify({
                schemaVersion: cacheSchemaVersion,
                algorithmVersion,
                lastMode: normalizedMode,
                widths: {
                    ...(readCachePayload()?.widths || {}),
                    [normalizedMode]: {
                        width: safeWidth,
                        contentSignature: String(contentSignature || '').trim(),
                        capturedAt: new Date().toISOString()
                    }
                }
            });
            try {
                if (storageWriter && typeof storageWriter.setItem === 'function') {
                    storageWriter.setItem(cacheKey, payload, { delayMs: 180, idle: true });
                } else {
                    storage.setItem(cacheKey, payload);
                }
                return true;
            } catch (_error) {
                return false;
            }
        };

        const hashInput = (value) => {
            const input = String(value || '');
            let hash = 2166136261;
            for (let index = 0; index < input.length; index += 1) {
                hash ^= input.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
            return `w${(hash >>> 0).toString(16).padStart(8, '0')}`;
        };

        const estimateFromFolderModels = ({
            folders = [],
            baseline = null,
            statusLabels = [],
            sampleNode = null,
            chromeWidth = 78,
            textBuffer = 12
        } = {}) => {
            const fallback = clampWidth(baseline) || resolvePresetWidth('standard');
            const entries = Array.isArray(folders)
                ? folders.filter((folder) => folder && typeof folder === 'object')
                : [];
            const measureCanvas = document.createElement('canvas');
            const ctx = measureCanvas && typeof measureCanvas.getContext === 'function'
                ? measureCanvas.getContext('2d')
                : null;
            if (!ctx || entries.length === 0) {
                return { estimatedWidth: fallback, contentSignature: '' };
            }
            const style = sampleNode ? window.getComputedStyle(sampleNode) : null;
            ctx.font = style
                ? `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`
                : '700 14px Arial, sans-serif';
            const labels = (Array.isArray(statusLabels) ? statusLabels : [])
                .map((label) => String(label || '').trim())
                .filter((label) => label !== '');
            const entityCount = (folder) => {
                const count = (value) => Array.isArray(value)
                    ? value.length
                    : (value && typeof value === 'object' ? Object.keys(value).length : 0);
                return Math.max(
                    count(folder?.containers),
                    count(folder?.children),
                    Number(folder?.status?.total) || 0
                );
            };
            const maximumCount = entries.reduce((maximum, folder) => Math.max(maximum, entityCount(folder)), 0);
            const statusSamples = labels.map((label) => `${maximumCount}/${maximumCount} ${label}`);
            let estimatedWidth = fallback;
            entries.forEach((folder) => {
                const name = String(folder.name || '').trim();
                const textWidth = Math.max(
                    name ? ctx.measureText(name).width : 0,
                    ...statusSamples.map((status) => ctx.measureText(status).width)
                );
                estimatedWidth = Math.max(
                    estimatedWidth,
                    Math.ceil(textWidth + Number(chromeWidth || 0) + Number(textBuffer || 0))
                );
            });
            const signature = [
                algorithmVersion,
                ctx.font,
                ...labels,
                ...entries
                    .map((folder) => `${String(folder.name || '').trim()}:${entityCount(folder)}`)
                    .sort((left, right) => left.localeCompare(right))
            ].join('|');
            return {
                estimatedWidth: clampWidth(estimatedWidth) || fallback,
                contentSignature: hashInput(signature)
            };
        };

        const resolveFolderBootstrap = ({
            folders = [],
            baseline = null,
            statusLabels = [],
            sampleNode = null,
            chromeWidth = 78,
            textBuffer = 12,
            mode = 'standard',
            floor = null
        } = {}) => {
            const estimate = estimateFromFolderModels({
                folders,
                baseline,
                statusLabels,
                sampleNode,
                chromeWidth,
                textBuffer
            });
            const cachedWidth = readCachedWidth(mode, estimate.contentSignature);
            const staleCacheRejected = !cachedWidth && !!readCachedWidth(mode);
            return {
                ...estimate,
                cachedWidth,
                staleCacheRejected,
                primedWidth: resolveBootstrapWidth({
                    baseline,
                    estimated: estimate.estimatedWidth,
                    cached: cachedWidth,
                    floor: staleCacheRejected ? null : floor
                })
            };
        };

        const resolveStatusLabels = (localize = null) => [
            ['started', 'started'],
            ['stopped', 'stopped'],
            ['paused', 'paused']
        ].map(([key, fallback]) => {
            try {
                const localized = typeof localize === 'function' ? String(localize(key) || '').trim() : '';
                return localized && localized !== key ? localized : fallback;
            } catch (_error) {
                return fallback;
            }
        });

        const applyCssWidthVars = (desktopWidthPx = null) => {
            const safeDesktopWidth = clampWidth(desktopWidthPx);
            if (!document.body || !document.body.style) {
                return;
            }
            if (!safeDesktopWidth) {
                document.body.style.removeProperty(desktopVarName);
                document.body.style.removeProperty(mobileVarName);
                return;
            }
            const mobileWidth = Math.max(mobileMin, Math.round(safeDesktopWidth * mobileScale));
            document.body.style.setProperty(desktopVarName, `${safeDesktopWidth}px`);
            document.body.style.setProperty(mobileVarName, `${mobileWidth}px`);
        };

        const estimateFromRows = ({
            rows = [],
            baseline = null,
            nameSelector = '.folder-appname',
            auxSelectors = [],
            indentSelector = '.folder-name-sub',
            hiddenClass = 'fv-nested-hidden',
            chromeWidth = 78,
            textBuffer = 12
        } = {}) => {
            const fallback = clampWidth(baseline);
            if (!Array.isArray(rows) || rows.length === 0) {
                return fallback;
            }
            const measureCanvas = document.createElement('canvas');
            const ctx = measureCanvas.getContext('2d');
            if (!ctx) {
                return fallback;
            }
            let maxWidth = fallback || minWidth;
            rows.forEach((row) => {
                if (!row || row.offsetParent === null) {
                    return;
                }
                if (hiddenClass && row.classList && row.classList.contains(hiddenClass)) {
                    return;
                }
                const nameNode = row.querySelector(nameSelector);
                if (!nameNode) {
                    return;
                }
                const selectors = [nameSelector].concat(Array.isArray(auxSelectors) ? auxSelectors : []);
                let maxTextWidth = 0;
                selectors.forEach((selector) => {
                    const node = selector === nameSelector ? nameNode : row.querySelector(selector);
                    if (!node) {
                        return;
                    }
                    const text = String(node.textContent || '').trim();
                    if (!text) {
                        return;
                    }
                    const style = window.getComputedStyle(node);
                    ctx.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
                    const measuredWidth = ctx.measureText(text).width;
                    if (measuredWidth > maxTextWidth) {
                        maxTextWidth = measuredWidth;
                    }
                });
                if (maxTextWidth <= 0) {
                    return;
                }
                const indentNode = indentSelector ? row.querySelector(indentSelector) : null;
                const indentStyle = indentNode ? window.getComputedStyle(indentNode) : null;
                const indentWidth = indentStyle ? Math.max(0, Math.round(parseFloat(indentStyle.paddingLeft) || 0)) : 0;
                const estimated = Math.ceil(maxTextWidth + indentWidth + Number(chromeWidth || 0) + Number(textBuffer || 0));
                if (estimated > maxWidth) {
                    maxWidth = estimated;
                }
            });
            return clampWidth(maxWidth) || fallback;
        };

        return Object.freeze({
            clampWidth,
            resolvePresetWidth,
            resolveBootstrapWidth,
            readCachedWidth,
            writeCachedWidth,
            estimateFromFolderModels,
            resolveFolderBootstrap,
            resolveStatusLabels,
            applyCssWidthVars,
            estimateFromRows
        });
    };

    window.FolderViewPlusRuntimeColumnLayout = Object.freeze({
        createColumnLayoutEngine
    });
})();
