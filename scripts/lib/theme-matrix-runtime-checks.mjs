export const runRuntimeThemeChecks = async (page, { label, browserName, mobile, zoom, type }) => {
    const runtimeControlSelector = type === 'dashboard'
        ? 'button.fv-dashboard-expand-toggle-btn'
        : 'button.folder-dropdown';
    const collectReport = async () => page.evaluate((runtimeType) => {
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
            let bg = { r: 24, g: 24, b: 24, a: 1 };
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
        const parseWidth = (raw) => {
            const width = Number.parseFloat(String(raw || '').trim());
            return Number.isFinite(width) ? Math.max(0, width) : 0;
        };
        const button = runtimeType === 'dashboard'
            ? Array.from(document.querySelectorAll('button.fv-dashboard-expand-toggle-btn')).find((node) => isVisible(node))
            : Array.from(document.querySelectorAll('button.folder-dropdown')).find((node) => isVisible(node));
        const buttonLabel = runtimeType === 'dashboard'
            ? 'Dashboard expand toggle'
            : 'Dropdown';

        if (runtimeType === 'dashboard' && !button) {
            const rails = Array.from(document.querySelectorAll('.fv-dashboard-layout-inline-host .fv-dashboard-layout-quick-rail'))
                .filter((node) => isVisible(node));
            if (!rails.length) {
                return { skipped: true, reason: 'No visible dashboard quick rail.' };
            }
        }
        if (!button) {
            return {
                skipped: true,
                reason: runtimeType === 'dashboard'
                    ? 'No visible dashboard expand toggle.'
                    : `No visible ${runtimeType} folder dropdown.`
            };
        }
        const errors = [];
        const style = window.getComputedStyle(button);
        const fg = parseColor(style.color);
        const bg = resolveBackground(button);
        if (!fg) {
            errors.push(`Could not parse ${buttonLabel.toLowerCase()} color.`);
        } else {
            const ratio = contrast({ ...fg, a: 1 }, bg);
            if (ratio < 2.4) {
                errors.push(`${buttonLabel} contrast too low (${ratio.toFixed(2)}).`);
            }
        }
        const rect = button.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) {
            errors.push(`${buttonLabel} hit target too small (${Math.round(rect.width)}x${Math.round(rect.height)}).`);
        }
        if (runtimeType === 'dashboard') {
            const backgroundColor = parseColor(style.backgroundColor);
            if (backgroundColor && backgroundColor.a > 0.02) {
                errors.push('Dashboard expand toggle background should remain transparent.');
            }
            const borderWidths = [
                parseWidth(style.borderTopWidth),
                parseWidth(style.borderRightWidth),
                parseWidth(style.borderBottomWidth),
                parseWidth(style.borderLeftWidth)
            ];
            const borderColors = [
                parseColor(style.borderTopColor),
                parseColor(style.borderRightColor),
                parseColor(style.borderBottomColor),
                parseColor(style.borderLeftColor)
            ];
            const hasVisibleBorder = borderWidths.some((width) => width > 0.2)
                && borderColors.some((color) => color && color.a > 0.02);
            if (hasVisibleBorder) {
                errors.push('Dashboard expand toggle border should be removed.');
            }
            if (String(style.boxShadow || '').trim().toLowerCase() !== 'none') {
                errors.push('Dashboard expand toggle shadow should be removed.');
            }
        }
        return { skipped: false, errors };
    }, type);

    const initialReport = await collectReport();
    if (initialReport.skipped) {
        return initialReport;
    }

    const controls = page.locator(runtimeControlSelector).filter({ has: page.locator('i.fa') });
    const controlCount = await controls.count();
    for (let index = 0; index < controlCount; index += 1) {
        const control = controls.nth(index);
        if (!(await control.isVisible().catch(() => false))) {
            continue;
        }
        await control.hover();
        await page.waitForTimeout(90);
        const hoverReport = await collectReport();
        if (hoverReport.skipped !== true && Array.isArray(hoverReport.errors) && hoverReport.errors.length > 0) {
            throw new Error(`[${label}] ${browserName} ${mobile ? 'mobile' : 'desktop'} zoom=${zoom}: ${type} hover runtime check failed: ${hoverReport.errors.join(' | ')}`);
        }
        break;
    }

    if (Array.isArray(initialReport.errors) && initialReport.errors.length > 0) {
        throw new Error(`[${label}] ${browserName} ${mobile ? 'mobile' : 'desktop'} zoom=${zoom}: ${type} runtime check failed: ${initialReport.errors.join(' | ')}`);
    }
    return initialReport;
};
