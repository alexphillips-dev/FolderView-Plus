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
                const text = String(nameNode.textContent || '').trim();
                if (!text) {
                    return;
                }
                const style = window.getComputedStyle(nameNode);
                ctx.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
                const textWidth = ctx.measureText(text).width;
                const indentNode = indentSelector ? row.querySelector(indentSelector) : null;
                const indentStyle = indentNode ? window.getComputedStyle(indentNode) : null;
                const indentWidth = indentStyle ? Math.max(0, Math.round(parseFloat(indentStyle.paddingLeft) || 0)) : 0;
                const estimated = Math.ceil(textWidth + indentWidth + Number(chromeWidth || 0) + Number(textBuffer || 0));
                if (estimated > maxWidth) {
                    maxWidth = estimated;
                }
            });
            return clampWidth(maxWidth) || fallback;
        };

        return Object.freeze({
            clampWidth,
            resolvePresetWidth,
            applyCssWidthVars,
            estimateFromRows
        });
    };

    window.FolderViewPlusRuntimeColumnLayout = Object.freeze({
        createColumnLayoutEngine
    });
})();
