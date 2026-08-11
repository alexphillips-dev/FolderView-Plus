export const runFolderEditorThemeChecks = async (page, { label, browserName, mobile, zoom, type }) => {
    const report = await page.evaluate((context) => {
        const parseColor = (raw) => {
            const value = String(raw || '').trim().toLowerCase();
            if (!value || value === 'transparent') {
                return null;
            }
            const match = value.match(/rgba?\(([^)]+)\)/);
            if (!match) {
                return null;
            }
            const parts = match[1]
                .split(',')
                .map((part) => Number.parseFloat(part.trim()))
                .filter((number) => Number.isFinite(number));
            if (parts.length < 3) {
                return null;
            }
            return {
                r: Math.max(0, Math.min(255, parts[0])),
                g: Math.max(0, Math.min(255, parts[1])),
                b: Math.max(0, Math.min(255, parts[2])),
                a: parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1
            };
        };
        const blend = (fg, bg) => {
            const alpha = Math.max(0, Math.min(1, Number(fg?.a ?? 1)));
            return {
                r: (fg.r * alpha) + (bg.r * (1 - alpha)),
                g: (fg.g * alpha) + (bg.g * (1 - alpha)),
                b: (fg.b * alpha) + (bg.b * (1 - alpha)),
                a: 1
            };
        };
        const toLinear = (channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (color) => (
            (0.2126 * toLinear(color.r))
            + (0.7152 * toLinear(color.g))
            + (0.0722 * toLinear(color.b))
        );
        const contrast = (fg, bg) => {
            const l1 = luminance(fg);
            const l2 = luminance(bg);
            const light = Math.max(l1, l2);
            const dark = Math.min(l1, l2);
            return (light + 0.05) / (dark + 0.05);
        };
        const isVisible = (element) => {
            if (!element) {
                return false;
            }
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) {
                return false;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 1 && rect.height > 1;
        };
        const resolveBackground = (element) => {
            let current = element;
            let bg = { r: 245, g: 247, b: 250, a: 1 };
            while (current && current !== document.body) {
                const parsedBg = parseColor(window.getComputedStyle(current).backgroundColor);
                if (parsedBg && parsedBg.a > 0) {
                    bg = blend(parsedBg, bg);
                    if (parsedBg.a >= 0.98) {
                        break;
                    }
                }
                current = current.parentElement;
            }
            return { r: bg.r, g: bg.g, b: bg.b, a: 1 };
        };
        const checkContrast = (element, minRatio, description, errors) => {
            if (!isVisible(element)) {
                errors.push(`${description} is not visible.`);
                return;
            }
            const style = window.getComputedStyle(element);
            const fg = parseColor(style.color);
            if (!fg) {
                errors.push(`Could not parse text color for ${description}.`);
                return;
            }
            const bg = resolveBackground(element);
            const ratio = contrast({ ...fg, a: 1 }, bg);
            if (ratio < minRatio) {
                errors.push(`${description} contrast too low (${ratio.toFixed(2)} < ${minRatio}).`);
            }
        };

        const errors = [];
        const form = document.querySelector('.canvas form.folder-editor-form');
        const chrome = document.querySelector('#fvEditorChrome');
        const livePanel = document.querySelector('#fvLivePanel');
        const nameInput = form?.querySelector('input[name="name"]');
        const typeField = String(window.FolderViewPlusFolderEditorPageType || '').trim().toLowerCase();
        const themeClass = String(
            form?.getAttribute('data-fv-theme-class')
            || document.body?.getAttribute('data-fv-theme-class')
            || document.documentElement?.getAttribute('data-fv-theme-class')
            || ''
        ).trim().toLowerCase();
        const themeMode = String(
            form?.getAttribute('data-fv-theme-mode')
            || document.body?.getAttribute('data-fv-theme-mode')
            || document.documentElement?.getAttribute('data-fv-theme-mode')
            || ''
        ).trim().toLowerCase();

        if (typeField !== context.type) {
            errors.push(`Folder editor type mismatch (${typeField || 'missing'}).`);
        }
        if (window.FolderViewPlusThemeResolverModuleLoaded !== true) {
            errors.push('Theme resolver module did not report as loaded.');
        }
        if (!isVisible(form)) {
            errors.push('Folder editor form is not visible.');
        }
        if (!isVisible(chrome)) {
            errors.push('Folder editor chrome is not visible.');
        }
        if (!['dark', 'light', 'mixed'].includes(themeClass)) {
            errors.push(`Folder editor theme class is invalid (${themeClass || 'missing'}).`);
        }
        if (!['auto', 'host', 'safe', 'highcontrast'].includes(themeMode)) {
            errors.push(`Folder editor theme mode is invalid (${themeMode || 'missing'}).`);
        }
        if (chrome) {
            const chromeStyle = window.getComputedStyle(chrome);
            const editorBg = String(chromeStyle.getPropertyValue('--fvplus-editor-bg') || '').trim();
            const editorText = String(chromeStyle.getPropertyValue('--fvplus-editor-text-primary') || '').trim();
            if (!editorBg) {
                errors.push('Folder editor background token is missing.');
            }
            if (!editorText) {
                errors.push('Folder editor text token is missing.');
            }
        }
        if (form && form.scrollWidth > (form.clientWidth + 2)) {
            errors.push('Folder editor form has horizontal overflow.');
        }
        if (chrome && chrome.scrollWidth > (chrome.clientWidth + 2)) {
            errors.push('Folder editor chrome has horizontal overflow.');
        }
        if (livePanel && livePanel.scrollWidth > (livePanel.clientWidth + 2)) {
            errors.push('Folder live preview panel has horizontal overflow.');
        }

        checkContrast(chrome?.querySelector('.fv-editor-hero-copy > h2'), 4.5, 'Folder editor title', errors);
        checkContrast(chrome?.querySelector('.fv-editor-hero-copy > p'), 4.0, 'Folder editor summary', errors);
        checkContrast(nameInput, 4.5, 'Folder name input', errors);
        checkContrast(form?.querySelector('.fv-section-nav > button'), 3.4, 'Section nav button', errors);
        checkContrast(form?.querySelector('.fv-editor-mode > button'), 3.4, 'Mode toggle button', errors);
        if (livePanel) {
            checkContrast(livePanel.querySelector('.fv-live-preview-card-head h3, .fv-live-preview-card-head strong'), 4.0, 'Live preview heading', errors);
            checkContrast(livePanel.querySelector('.fv-live-member-name, .fv-live-folder-copy > strong'), 3.6, 'Live preview label', errors);
        }

        if (nameInput) {
            const nameInputStyle = window.getComputedStyle(nameInput);
            const inputBg = parseColor(nameInputStyle.backgroundColor);
            if (!inputBg || inputBg.a <= 0.02) {
                errors.push('Folder name input background is transparent.');
            }
        }

        return { errors };
    }, { type });

    if (Array.isArray(report?.errors) && report.errors.length > 0) {
        throw new Error(`[${label}] ${browserName} ${mobile ? 'mobile' : 'desktop'} zoom=${zoom}: ${type} folder editor check failed: ${report.errors.join(' | ')}`);
    }
};
