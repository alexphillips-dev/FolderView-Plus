import fs from 'node:fs/promises';
import path from 'node:path';
import { createThemeMatrixSettingsChecks } from './lib/theme-matrix-settings-checks.mjs';
import { runRuntimeThemeChecks } from './lib/theme-matrix-runtime-checks.mjs';
import { runFolderEditorThemeChecks } from './lib/theme-matrix-folder-editor-checks.mjs';

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
const captureLiveArtifacts = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.FVPLUS_THEME_SMOKE_CAPTURE_LIVE_ARTIFACTS || '').trim().toLowerCase()
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
    if (!captureLiveArtifacts) {
        return '';
    }
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

const resolveRuntimeUrl = (baseUrl, type) => {
    try {
        const parsed = new URL(baseUrl);
        const rawPath = parsed.pathname || '';
        if (/\/settings\/folderviewplus$/i.test(rawPath)) {
            parsed.pathname = type === 'docker' ? '/Docker' : '/VMs';
            return parsed.toString();
        }
        if (/\/docker$/i.test(rawPath) && type === 'vm') {
            parsed.pathname = '/VMs';
            return parsed.toString();
        }
        if (/\/vms$/i.test(rawPath) && type === 'docker') {
            parsed.pathname = '/Docker';
            return parsed.toString();
        }
    } catch (_error) {
        return '';
    }
    return '';
};

const resolveDashboardUrl = (baseUrl) => {
    try {
        const parsed = new URL(baseUrl);
        const rawPath = parsed.pathname || '';
        if (/\/settings\/folderviewplus$/i.test(rawPath) || /\/docker$/i.test(rawPath) || /\/vms$/i.test(rawPath)) {
            parsed.pathname = '/Dashboard';
            return parsed.toString();
        }
    } catch (_error) {
        return '';
    }
    return '';
};

const resolveFolderEditorUrl = (baseUrl, type) => {
    try {
        const parsed = new URL(baseUrl);
        const rawPath = parsed.pathname || '';
        if (/\/settings\/folderviewplus$/i.test(rawPath) || /\/docker$/i.test(rawPath) || /\/vms$/i.test(rawPath) || /\/dashboard$/i.test(rawPath)) {
            parsed.pathname = type === 'vm' ? '/VMs/Folder' : '/Docker/Folder';
            parsed.search = '';
            parsed.searchParams.set('type', type === 'vm' ? 'vm' : 'docker');
            parsed.searchParams.set('_', String(Date.now()));
            return parsed.toString();
        }
    } catch (_error) {
        return '';
    }
    return '';
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

const { ensureWizardVisible, runSettingsSurfaceChecks, runScenarioChecks } = createThemeMatrixSettingsChecks({ timeoutMs });

const runThemeChecks = async ({ label, url }, browserName, browserType) => {
    const dockerUrl = resolveRuntimeUrl(url, 'docker');
    const vmUrl = resolveRuntimeUrl(url, 'vm');
    const dashboardUrl = resolveDashboardUrl(url);
    const dockerEditorUrl = resolveFolderEditorUrl(url, 'docker');
    const vmEditorUrl = resolveFolderEditorUrl(url, 'vm');
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

            if (!mobile && zoom === 1) {
                const runtimeTargets = [
                    dockerUrl ? { type: 'docker', url: dockerUrl } : null,
                    vmUrl ? { type: 'vm', url: vmUrl } : null,
                    dashboardUrl ? { type: 'dashboard', url: dashboardUrl } : null
                ].filter(Boolean);
                for (const target of runtimeTargets) {
                    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
                    await page.waitForTimeout(900);
                    const runtimeReport = await runRuntimeThemeChecks(page, {
                        label,
                        browserName,
                        mobile,
                        zoom,
                        type: target.type
                    });
                    if (runtimeReport?.skipped !== true) {
                        await captureScenarioScreenshot(page, {
                            label,
                            browserName,
                            mobile,
                            zoom,
                            stage: `${target.type}-runtime`
                        });
                    }
                }

                const editorTargets = [
                    dockerEditorUrl ? { type: 'docker', url: dockerEditorUrl } : null,
                    vmEditorUrl ? { type: 'vm', url: vmEditorUrl } : null
                ].filter(Boolean);
                for (const target of editorTargets) {
                    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
                    await page.waitForTimeout(900);
                    await runFolderEditorThemeChecks(page, {
                        label,
                        browserName,
                        mobile,
                        zoom,
                        type: target.type
                    });
                    await captureScenarioScreenshot(page, {
                        label,
                        browserName,
                        mobile,
                        zoom,
                        stage: `${target.type}-editor`
                    });
                }
            }
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
