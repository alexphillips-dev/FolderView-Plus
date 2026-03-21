import fs from 'node:fs/promises';
import path from 'node:path';

const matrixRaw = String(process.env.FVPLUS_THEME_MATRIX_URLS || '').trim();
const requiredLabelsRaw = String(process.env.FVPLUS_THEME_REQUIRED_LABELS || '').trim();
const timeoutMs = Number.isFinite(Number(process.env.FVPLUS_THEME_SMOKE_TIMEOUT_MS))
    ? Math.max(5000, Number(process.env.FVPLUS_THEME_SMOKE_TIMEOUT_MS))
    : 90000;
const ignoreHttpsErrors = String(process.env.FVPLUS_THEME_SMOKE_IGNORE_HTTPS || '1').trim() !== '0';
const browserNames = String(process.env.FVPLUS_THEME_SMOKE_BROWSERS || 'chromium,firefox,webkit')
    .split(/[,\s]+/)
    .map((name) => String(name || '').trim().toLowerCase())
    .filter((name, index, arr) => name !== '' && arr.indexOf(name) === index);
const zoomLevels = String(process.env.FVPLUS_THEME_SMOKE_ZOOMS || '1,1.25,1.5')
    .split(/[,\s]+/)
    .map((value) => Number(value))
    .filter((value, index, arr) => Number.isFinite(value) && value >= 1 && value <= 2 && arr.indexOf(value) === index);
const screenshotArtifactDir = path.resolve(
    String(process.env.FVPLUS_THEME_SMOKE_ARTIFACT_DIR || path.join(process.cwd(), 'tmp', 'browser-smoke-artifacts', 'theme-matrix')).trim()
);

const sanitizeSegment = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

const zoomTag = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '1';
    }
    return String(numeric).replace(/[.]+/g, '_');
};

const ensureArtifactDir = async () => {
    await fs.mkdir(screenshotArtifactDir, { recursive: true });
};

const captureScenarioScreenshot = async (page, {
    label,
    browserName,
    mobile,
    zoom,
    stage
}) => {
    await ensureArtifactDir();
    const filename = [
        sanitizeSegment(label),
        sanitizeSegment(browserName),
        mobile ? 'mobile' : 'desktop',
        `zoom-${zoomTag(zoom)}`,
        sanitizeSegment(stage)
    ].join('__') + '.png';
    const screenshotPath = path.join(screenshotArtifactDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
};

const parseMatrixEntries = (raw) => {
    const entries = [];
    const lines = raw
        .split(/[\n;,]+/)
        .map((line) => String(line || '').trim())
        .filter((line) => line !== '');
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        let label = '';
        let url = '';
        if (line.includes('=')) {
            const splitAt = line.indexOf('=');
            label = line.slice(0, splitAt).trim();
            url = line.slice(splitAt + 1).trim();
        } else if (line.includes('|')) {
            const splitAt = line.indexOf('|');
            label = line.slice(0, splitAt).trim();
            url = line.slice(splitAt + 1).trim();
        } else {
            label = `theme-${index + 1}`;
            url = line.trim();
        }
        if (!url) {
            continue;
        }
        entries.push({
            label: label || `theme-${entries.length + 1}`,
            url
        });
    }
    return entries;
};

const normalizeLabel = (value) => String(value || '').trim().toLowerCase();

if (!matrixRaw) {
    console.log('Skipping theme matrix smoke checks (FVPLUS_THEME_MATRIX_URLS not set).');
    process.exit(0);
}

const matrixEntries = parseMatrixEntries(matrixRaw);
if (!matrixEntries.length) {
    console.log('Skipping theme matrix smoke checks (no usable targets parsed from FVPLUS_THEME_MATRIX_URLS).');
    process.exit(0);
}

const requiredLabels = requiredLabelsRaw
    .split(/[,\s;]+/)
    .map((label) => normalizeLabel(label))
    .filter((label, index, source) => label !== '' && source.indexOf(label) === index);
if (requiredLabels.length > 0) {
    const seenLabels = new Set(matrixEntries.map((entry) => normalizeLabel(entry.label)));
    const missing = requiredLabels.filter((label) => !seenLabels.has(label));
    if (missing.length > 0) {
        console.error(`ERROR: Theme matrix is missing required label(s): ${missing.join(', ')}`);
        process.exit(1);
    }
}

if (!browserNames.length) {
    console.error('ERROR: No browsers configured for theme matrix checks.');
    process.exit(1);
}

if (!zoomLevels.length) {
    console.error('ERROR: No zoom levels configured for theme matrix checks.');
    process.exit(1);
}

let playwright;
try {
    playwright = await import('playwright');
} catch (error) {
    console.error('ERROR: playwright is required for theme matrix smoke checks.');
    console.error('Install with: npm i -D playwright && npx playwright install chromium firefox webkit');
    throw error;
}

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
        const contrastTier = String(dialog.getAttribute('data-fv-wizard-contrast-tier') || '').trim();
        if (!['normal', 'high', 'max'].includes(contrastTier)) {
            errors.push(`Wizard contrast tier attribute is invalid (${contrastTier || 'missing'}).`);
        }
        const focusModeButton = dialog.querySelector('#fv-setup-focus-mode');
        if (!focusModeButton) {
            errors.push('Wizard focus mode toggle is missing.');
        }
        const contrastSelect = dialog.querySelector('#fv-setup-contrast-mode');
        if (!contrastSelect) {
            errors.push('Wizard contrast mode selector is missing.');
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

const runThemeChecks = async ({ label, url }, browserName, browserType) => {
    const runVariant = async ({ mobile = false, zoom = 1 }) => {
        const context = await browserType.newContext({
            ignoreHTTPSErrors: ignoreHttpsErrors,
            viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
            isMobile: mobile,
            hasTouch: mobile
        });
        const page = await context.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
            await page.locator('#fv-settings-topbar').waitFor({ state: 'visible', timeout: timeoutMs });
            const settingsScreenshotPath = await captureScenarioScreenshot(page, {
                label,
                browserName,
                mobile,
                zoom,
                stage: 'settings'
            });
            await runSettingsSurfaceChecks(page, { label, browserName, mobile, zoom });
            await ensureWizardVisible(page);
            if (zoom !== 1) {
                await page.evaluate((zoomValue) => {
                    const root = document.documentElement;
                    if (root) {
                        root.style.zoom = String(zoomValue);
                    }
                }, zoom);
                await page.waitForTimeout(80);
            }
            await runScenarioChecks(page, { label, browserName, mobile, zoom });
            const wizardScreenshotPath = await captureScenarioScreenshot(page, {
                label,
                browserName,
                mobile,
                zoom,
                stage: 'wizard'
            });
            console.log(`[${label}] PASS ${browserName} ${mobile ? 'mobile' : 'desktop'} zoom=${zoom} screenshots=${settingsScreenshotPath},${wizardScreenshotPath}`);
        } catch (error) {
            const failureScreenshotPath = await captureScenarioScreenshot(page, {
                label,
                browserName,
                mobile,
                zoom,
                stage: 'failure'
            }).catch(() => '');
            const baseMessage = String(error?.message || error || 'Theme matrix scenario failed.');
            const withScreenshot = failureScreenshotPath
                ? `${baseMessage} | screenshot=${failureScreenshotPath}`
                : baseMessage;
            throw new Error(withScreenshot);
        } finally {
            await context.close();
        }
    };

    for (const zoom of zoomLevels) {
        await runVariant({ mobile: false, zoom });
    }
    await runVariant({ mobile: true, zoom: 1 });
};

let failures = 0;
await ensureArtifactDir();
console.log(`Theme matrix screenshots directory: ${screenshotArtifactDir}`);

for (const browserName of browserNames) {
    const browserType = playwright[browserName];
    if (!browserType) {
        console.error(`WARN: Unsupported Playwright browser "${browserName}" in FVPLUS_THEME_SMOKE_BROWSERS.`);
        continue;
    }
    const browser = await browserType.launch({ headless: true });
    try {
        for (const entry of matrixEntries) {
            try {
                await runThemeChecks(entry, browserName, browser);
            } catch (error) {
                failures += 1;
                console.error(String(error?.message || error));
            }
        }
    } finally {
        await browser.close();
    }
}

if (failures > 0) {
    console.error(`ERROR: Theme matrix smoke checks failed (${failures} scenario${failures === 1 ? '' : 's'}).`);
    process.exit(1);
}

console.log('Theme matrix smoke checks passed for all configured targets.');
