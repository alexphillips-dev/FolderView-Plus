export const createThemeMatrixSettingsChecks = ({ timeoutMs }) => {
const ensureWizardVisible = async (page) => {
    const dialog = page.locator('#fv-setup-assistant-dialog');
    if (await dialog.isVisible().catch(() => false)) {
        return;
    }
    const runWizardButton = page.locator('#fv-run-wizard');
    if (await runWizardButton.count()) {
        await runWizardButton.first().click({ timeout: timeoutMs });
    }
    await dialog.waitFor({ state: 'visible', timeout: timeoutMs });
};

const runSettingsSurfaceChecks = async (page, { label, browserName, mobile, zoom }) => {
    const report = await page.evaluate((context) => {
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

        const errors = [];
        const root = document.querySelector('#fv-settings-root');
        const topbar = document.querySelector('#fv-settings-topbar');
        const dockerSection = document.querySelector('h2[data-fv-section="docker"]');
        const vmSection = document.querySelector('h2[data-fv-section="vms"]');
        const dockerTable = document.querySelector('tbody#docker');
        const vmTable = document.querySelector('tbody#vms');
        const dockerRuntimeTable = document.querySelector('tbody#docker_view');
        const vmRuntimeTable = document.querySelector('tbody#vm_view');
        const basicButton = document.querySelector('#fv-settings-topbar .fv-mode-btn[data-mode="basic"]');
        const advancedButton = document.querySelector('#fv-settings-topbar .fv-mode-btn[data-mode="advanced"]');
        const advancedHeading = document.querySelector('h2[data-fv-advanced="1"]');

        if (!isVisible(root)) {
            errors.push('Settings root is not visible.');
        }
        if (!isVisible(topbar)) {
            errors.push('Settings topbar is not visible.');
        }
        if (!isVisible(dockerSection)) {
            errors.push('Docker section heading is not visible.');
        }
        if (!isVisible(vmSection)) {
            errors.push('VM section heading is not visible.');
        }
        if (!dockerTable) {
            errors.push('Docker table body (#docker) is missing.');
        }
        if (!vmTable) {
            errors.push('VM table body (#vms) is missing.');
        }
        if (dockerRuntimeTable && !isVisible(dockerRuntimeTable)) {
            errors.push('Dashboard Docker runtime table body (#docker_view) is present but not visible.');
        }
        if (vmRuntimeTable && !isVisible(vmRuntimeTable)) {
            errors.push('Dashboard VM runtime table body (#vm_view) is present but not visible.');
        }
        if (!isVisible(basicButton)) {
            errors.push('Basic mode button is not visible.');
        }
        if (!isVisible(advancedButton)) {
            errors.push('Advanced mode button is not visible.');
        }
        if (!advancedHeading) {
            errors.push('At least one advanced section heading is missing.');
        }
        if (root && root.scrollWidth > (root.clientWidth + 2) && context.mobile === false) {
            errors.push('Settings root has unexpected desktop horizontal overflow.');
        }

        return { errors };
    }, { mobile, zoom });

    if (Array.isArray(report?.errors) && report.errors.length > 0) {
        throw new Error(`[${label}] ${browserName} ${mobile ? 'mobile' : 'desktop'} zoom=${zoom}: ${report.errors.join(' | ')}`);
    }
};

const runScenarioChecks = async (page, { label, browserName, mobile, zoom }) => {
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
            return value <= 0.03928
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
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

        const dialog = document.querySelector('#fv-setup-assistant-dialog');
        if (!dialog || !isVisible(dialog)) {
            return { errors: ['Wizard dialog is not visible.'] };
        }

        const errors = [];
        const focusShell = dialog.querySelector('.fv-setup-assistant-shell');
        if (!focusShell || String(focusShell.getAttribute('data-fv-focus-mode') || '') !== '1') {
            errors.push('Wizard focus mode is not enabled by default.');
        }
        if (dialog.querySelector('#fv-setup-focus-mode')) {
            errors.push('Wizard focus mode toggle should not be rendered.');
        }
        if (dialog.querySelector('#fv-setup-contrast-mode')) {
            errors.push('Wizard contrast mode selector should not be rendered.');
        }

        const fallbackBg = parseColor(window.getComputedStyle(dialog).backgroundColor) || { r: 10, g: 14, b: 20, a: 1 };
        const resolveBackground = (element) => {
            let current = element;
            let bg = fallbackBg;
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

        const verifyContrast = (selector, minRatio, description) => {
            const elements = Array.from(dialog.querySelectorAll(selector)).filter((element) => isVisible(element));
            if (!elements.length) {
                errors.push(`Missing required wizard element: ${description} (${selector})`);
                return;
            }
            const sample = elements[0];
            const fg = parseColor(window.getComputedStyle(sample).color);
            if (!fg) {
                errors.push(`Could not parse text color for ${description}`);
                return;
            }
            const bg = resolveBackground(sample);
            const ratio = contrast({ ...fg, a: 1 }, bg);
            if (ratio < minRatio) {
                errors.push(`${description} contrast too low (${ratio.toFixed(2)} < ${minRatio})`);
            }
        };

        verifyContrast('.fv-setup-assistant-head h4', 4.5, 'Wizard title');
        verifyContrast('.fv-setup-muted', 4.0, 'Wizard helper text');
        verifyContrast('.fv-setup-route-help', 4.0, 'Route helper text');
        verifyContrast('.fv-setup-profile-help', 4.0, 'Profile helper text');
        verifyContrast('.fv-setup-step-list li', 4.0, 'Step list labels');
        verifyContrast('.fv-setup-chip', 3.5, 'Summary chips');
        verifyContrast('.fv-setup-inline-guidance', 4.0, 'Inline guidance text');

        const disabledControls = Array.from(dialog.querySelectorAll('button:disabled, input:disabled, select:disabled'))
            .filter((element) => isVisible(element))
            .slice(0, 8);
        for (const control of disabledControls) {
            const fg = parseColor(window.getComputedStyle(control).color);
            if (!fg) {
                continue;
            }
            const bg = resolveBackground(control);
            const ratio = contrast({ ...fg, a: 1 }, bg);
            if (ratio < 3.0) {
                const controlName = control.id ? `#${control.id}` : control.tagName.toLowerCase();
                errors.push(`Disabled control contrast too low (${controlName}, ratio ${ratio.toFixed(2)})`);
            }
        }

        const closeButton = dialog.querySelector('#fv-setup-close');
        if (closeButton) {
            closeButton.focus();
            const focusStyle = window.getComputedStyle(closeButton);
            const outlineVisible = (
                focusStyle.outlineStyle !== 'none'
                && Number.parseFloat(focusStyle.outlineWidth || '0') >= 1
                && String(focusStyle.outlineColor || '').toLowerCase() !== 'transparent'
            );
            const boxShadowVisible = String(focusStyle.boxShadow || '').trim() !== 'none';
            if (!outlineVisible && !boxShadowVisible) {
                errors.push('Focus-visible ring is not present for wizard close button.');
            }
        } else {
            errors.push('Wizard close button not found.');
        }

        const shell = dialog.querySelector('.fv-setup-assistant-shell');
        const body = dialog.querySelector('.fv-setup-assistant-body');
        if (dialog.scrollWidth > (dialog.clientWidth + 2)) {
            errors.push('Wizard dialog has horizontal overflow.');
        }
        if (shell && shell.scrollWidth > (shell.clientWidth + 2)) {
            errors.push('Wizard shell has horizontal overflow.');
        }
        if (body && body.scrollWidth > (body.clientWidth + 2)) {
            errors.push('Wizard body has horizontal overflow.');
        }

        const sidebar = dialog.querySelector('.fv-setup-assistant-sidebar');
        if (context.mobile === true && sidebar) {
            const sidebarRect = sidebar.getBoundingClientRect();
            const dialogRect = dialog.getBoundingClientRect();
            if (sidebarRect.width > dialogRect.width) {
                errors.push('Wizard sidebar width exceeds dialog width in mobile mode.');
            }
        }

        if (context.mobile === true) {
            const chipToggle = dialog.querySelector('.fv-setup-chip-toggle');
            if (!chipToggle) {
                errors.push('Wizard mobile chip collapse toggle was not rendered.');
            }
        }

        return { errors };
    }, { mobile, zoom });

    if (Array.isArray(report?.errors) && report.errors.length > 0) {
        throw new Error(`[${label}] ${browserName} ${mobile ? 'mobile' : 'desktop'} zoom=${zoom}: ${report.errors.join(' | ')}`);
    }
};
    return { ensureWizardVisible, runSettingsSurfaceChecks, runScenarioChecks };
};
