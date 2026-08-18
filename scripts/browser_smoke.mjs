import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRuntimeLayoutSmoke } from './lib/browser-smoke-runtime-checks.mjs';
import { createDockerSmokeChecks } from './lib/browser-smoke-docker-checks.mjs';
import { createDashboardSmokeChecks } from './lib/browser-smoke-dashboard-checks.mjs';
import { createFolderEditorSmokeChecks } from './lib/browser-smoke-folder-editor-checks.mjs';
import { normalizeLiveSmokeDiagnosticLabel, redactLiveSmokeDiagnostic } from './lib/live-smoke-diagnostics.mjs';

const readBooleanEnv = (name, fallback = false) => {
    const raw = String(process.env[name] ?? (fallback ? '1' : '0')).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(raw);
};

const targetUrl = String(process.env.FVPLUS_BROWSER_SMOKE_URL || '').trim();
const dockerRuntimeUrlEnv = String(process.env.FVPLUS_BROWSER_SMOKE_DOCKER_URL || '').trim();
const vmRuntimeUrlEnv = String(process.env.FVPLUS_BROWSER_SMOKE_VM_URL || '').trim();
const dashboardUrlEnv = String(process.env.FVPLUS_BROWSER_SMOKE_DASHBOARD_URL || '').trim();
const targetLabel = String(process.env.FVPLUS_BROWSER_SMOKE_LABEL || '').trim();
const unraidVersionHint = String(process.env.FVPLUS_UNRAID_VERSION_HINT || '').trim();
const themeHint = String(process.env.FVPLUS_THEME_HINT || '').trim();
const smokeRequired = readBooleanEnv('FVPLUS_BROWSER_SMOKE_REQUIRED', false);
const requireRuntimeRows = readBooleanEnv('FVPLUS_BROWSER_SMOKE_REQUIRE_RUNTIME_ROWS', false);
const requireFolderEditorCoverage = readBooleanEnv('FVPLUS_BROWSER_SMOKE_REQUIRE_FOLDER_EDITOR', smokeRequired);
const runtimeGapMinOverride = Number.isFinite(Number(process.env.FVPLUS_BROWSER_SMOKE_RUNTIME_GAP_MIN))
    ? Number(process.env.FVPLUS_BROWSER_SMOKE_RUNTIME_GAP_MIN)
    : null;
const runtimeGapMaxOverride = Number.isFinite(Number(process.env.FVPLUS_BROWSER_SMOKE_RUNTIME_GAP_MAX))
    ? Number(process.env.FVPLUS_BROWSER_SMOKE_RUNTIME_GAP_MAX)
    : null;
const timeoutMs = Number.isFinite(Number(process.env.FVPLUS_BROWSER_SMOKE_TIMEOUT_MS))
    ? Math.max(5000, Number(process.env.FVPLUS_BROWSER_SMOKE_TIMEOUT_MS))
    : 45000;
const ignoreHttpsErrors = String(process.env.FVPLUS_BROWSER_SMOKE_IGNORE_HTTPS || '1').trim() !== '0';
const artifactRoot = path.resolve(
    String(process.env.FVPLUS_BROWSER_SMOKE_ARTIFACT_DIR || '').trim()
        || path.join(process.cwd(), 'tmp', 'browser-smoke-artifacts')
);
const baselineFile = String(process.env.FVPLUS_BROWSER_SMOKE_BASELINE_FILE || '').trim();
const baselineMode = String(process.env.FVPLUS_BROWSER_SMOKE_BASELINE_MODE || '').trim().toLowerCase() || 'off';
const baselineTolerancePx = Number.isFinite(Number(process.env.FVPLUS_BROWSER_SMOKE_BASELINE_TOLERANCE_PX))
    ? Math.max(0, Number(process.env.FVPLUS_BROWSER_SMOKE_BASELINE_TOLERANCE_PX))
    : 2;
const requireBaseline = String(process.env.FVPLUS_BROWSER_SMOKE_REQUIRE_BASELINE || '0').trim() === '1';
const captureLiveArtifacts = readBooleanEnv('FVPLUS_BROWSER_SMOKE_CAPTURE_LIVE_ARTIFACTS', false);
if (!targetUrl) {
    console.log('Skipping browser smoke checks (FVPLUS_BROWSER_SMOKE_URL not set).');
    process.exit(0);
}
const scenarioLabel = [
    normalizeLiveSmokeDiagnosticLabel(targetLabel),
    unraidVersionHint ? 'Unraid version configured' : '',
    themeHint ? 'Theme configured' : ''
].filter(Boolean).join(' | ');
const sensitiveTargetValues = [targetUrl, dockerRuntimeUrlEnv, vmRuntimeUrlEnv, dashboardUrlEnv];

const sanitizeToken = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'token';

const runtimeReports = [];
const dashboardReports = [];
const folderEditorReports = [];
const dockerDiagnosticsReports = [];
const dockerUpdateFlowReports = [];
const dockerPreviewStatusReports = [];
const dashboardAdvancedPreviewReports = [];
const localizationReports = [];
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

const buildRuntimeReportKey = ({ browserName, type }) => `${sanitizeToken(browserName)}:${sanitizeToken(type)}`;

const normalizeCheckRoleMap = (checks) => {
    const map = {};
    for (const check of Array.isArray(checks) ? checks : []) {
        const role = String(check?.role || '').trim().toLowerCase();
        if (!role || check?.skipped === true) {
            continue;
        }
        map[role] = check;
    }
    return map;
};

const compareAgainstBaseline = (currentReports, baselinePayload = {}) => {
    const baselineReports = baselinePayload?.reports && typeof baselinePayload.reports === 'object'
        ? baselinePayload.reports
        : {};
    const failures = [];
    for (const report of currentReports) {
        const key = buildRuntimeReportKey(report);
        const baseline = baselineReports[key];
        if (!baseline || typeof baseline !== 'object') {
            if (requireBaseline) {
                failures.push({ key, reason: 'missing-baseline-entry' });
            }
            continue;
        }
        if (report.pass !== true) {
            failures.push({ key, reason: 'current-report-failed' });
            continue;
        }
        const currentByRole = normalizeCheckRoleMap(report.checks);
        const baselineByRole = normalizeCheckRoleMap(baseline.checks);
        for (const role of Object.keys(currentByRole)) {
            const currentCheck = currentByRole[role];
            const baselineCheck = baselineByRole[role];
            if (!baselineCheck) {
                if (requireBaseline) {
                    failures.push({ key, role, reason: 'missing-baseline-role' });
                }
                continue;
            }
            const currentAppGap = Number(currentCheck?.appBoundaryGap);
            const baselineAppGap = Number(baselineCheck?.appBoundaryGap);
            if (Number.isFinite(currentAppGap) && Number.isFinite(baselineAppGap)) {
                if (currentAppGap < (baselineAppGap - baselineTolerancePx)) {
                    failures.push({
                        key,
                        role,
                        reason: 'app-gap-regressed',
                        currentAppGap,
                        baselineAppGap
                    });
                }
            }
            const currentVersionGap = Number(currentCheck?.versionGap);
            const baselineVersionGap = Number(baselineCheck?.versionGap);
            if (Number.isFinite(currentVersionGap) && Number.isFinite(baselineVersionGap)) {
                if (currentVersionGap > (baselineVersionGap + baselineTolerancePx)) {
                    failures.push({
                        key,
                        role,
                        reason: 'version-gap-regressed',
                        currentVersionGap,
                        baselineVersionGap
                    });
                }
            }
        }
    }
    return failures;
};

const dockerRuntimeUrl = dockerRuntimeUrlEnv || resolveRuntimeUrl(targetUrl, 'docker');
const vmRuntimeUrl = vmRuntimeUrlEnv || resolveRuntimeUrl(targetUrl, 'vm');
const dashboardUrl = dashboardUrlEnv || resolveDashboardUrl(targetUrl);
const runtimeTargets = [
    dockerRuntimeUrl ? { type: 'docker', url: dockerRuntimeUrl } : null,
    vmRuntimeUrl ? { type: 'vm', url: vmRuntimeUrl } : null
].filter(Boolean);

let playwright;
try {
    playwright = await import('playwright');
} catch (error) {
    console.error('ERROR: playwright is required for browser smoke checks when FVPLUS_BROWSER_SMOKE_URL is set.');
    console.error('Install with: npm i -D playwright && npx playwright install chromium firefox webkit');
    throw error;
}

const payload = {
    schemaVersion: 1,
    pluginVersion: 'browser-smoke',
    exportedAt: new Date().toISOString(),
    type: 'docker',
    mode: 'full',
    folders: {
        smokeDocker: {
            name: 'Smoke Docker',
            icon: '',
            containers: [],
            settings: {},
            actions: [],
            regex: ''
        }
    }
};

const tempImportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-browser-smoke-'));
const tempImportPath = path.join(tempImportDir, 'import.json');
fs.writeFileSync(tempImportPath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
if (captureLiveArtifacts) {
    fs.mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
}
const captureLiveScreenshot = async (page, filename) => {
    if (!captureLiveArtifacts) {
        return '';
    }
    const screenshotPath = path.join(artifactRoot, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
};
const { runRuntimeLayoutSmoke } = createRuntimeLayoutSmoke({
    timeoutMs, runtimeGapMinOverride, runtimeGapMaxOverride, captureLiveScreenshot,
    sanitizeToken, scenarioLabel, requireRuntimeRows
});
const { runDockerDiagnosticsSmoke, runDockerUpdateFlowSmoke, runDockerPreviewStatusSmoke } = createDockerSmokeChecks({
    timeoutMs, captureLiveScreenshot, sanitizeToken, scenarioLabel
});
const { runDashboardQuickRailSmoke, runDashboardAdvancedPreviewSmoke } = createDashboardSmokeChecks({
    timeoutMs, captureLiveScreenshot, sanitizeToken, scenarioLabel
});
const { waitForSettingsShell, runFolderEditorToggleSmoke } = createFolderEditorSmokeChecks({
    timeoutMs, sanitizeToken, scenarioLabel, resolveFolderEditorUrl, requireFolderEditorCoverage
});

const runBrowserSmoke = async (browserName, browserType) => {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: ignoreHttpsErrors });
    const page = await context.newPage();
    page.on('dialog', (dialog) => {
        console.warn(`Browser smoke dialog accepted (${browserName}): ${dialog.type()} ${redactLiveSmokeDiagnostic(dialog.message(), sensitiveTargetValues)}`);
        void dialog.accept().catch(() => {});
    });
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await waitForSettingsShell(page);

        const localizationReport = await page.evaluate(() => {
            const api = window.FolderViewPlusI18n;
            if (!api || typeof api.usePseudoLocale !== 'function') {
                return { available: false };
            }
            const source = api.snapshot();
            const expanded = api.usePseudoLocale('en-XA');
            const expandedState = {
                lang: document.documentElement.lang,
                dir: document.documentElement.dir,
                translatedNodeCount: document.querySelectorAll('[data-i18n]').length,
                horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
            };
            const rtl = api.usePseudoLocale('ar-XB');
            const rtlState = {
                lang: document.documentElement.lang,
                dir: document.documentElement.dir,
                translatedNodeCount: document.querySelectorAll('[data-i18n]').length,
                horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
            };
            api.restoreLocale();
            return { available: true, source, expanded, rtl, expandedState, rtlState };
        });
        if (localizationReport.available) {
            if (localizationReport.expandedState.lang !== 'en-XA' || localizationReport.expandedState.dir !== 'ltr') {
                throw new Error(`Expanded pseudo-locale did not apply correctly: ${JSON.stringify(localizationReport.expandedState)}`);
            }
            if (localizationReport.rtlState.lang !== 'ar-XB' || localizationReport.rtlState.dir !== 'rtl') {
                throw new Error(`RTL pseudo-locale did not apply correctly: ${JSON.stringify(localizationReport.rtlState)}`);
            }
            await page.evaluate(() => window.FolderViewPlusI18n.usePseudoLocale('en-XA'));
            const expandedScreenshotPath = await captureLiveScreenshot(
                page,
                `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-locale-en-xa.png`
            );
            await page.evaluate(() => window.FolderViewPlusI18n.usePseudoLocale('ar-XB'));
            const rtlScreenshotPath = await captureLiveScreenshot(
                page,
                `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-locale-ar-xb.png`
            );
            await page.evaluate(() => window.FolderViewPlusI18n.restoreLocale());
            localizationReports.push({ browserName, ...localizationReport, expandedScreenshotPath, rtlScreenshotPath });
        }

        const importButton = page.getByRole('button', { name: /import/i }).first();
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: timeoutMs }),
            importButton.click({ timeout: timeoutMs })
        ]);
        await chooser.setFiles(tempImportPath);

        await page.locator('#import-preview-dialog').waitFor({ state: 'visible', timeout: timeoutMs });

        const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("CANCEL")').first();
        if (await cancelButton.count()) {
            await cancelButton.click({ timeout: timeoutMs });
        } else {
            await page.keyboard.press('Escape');
        }

        for (const runtimeTarget of runtimeTargets) {
            const runtimeReport = await runRuntimeLayoutSmoke(page, {
                browserName,
                type: runtimeTarget.type,
                url: runtimeTarget.url
            });
            if (runtimeReport) {
                runtimeReports.push(runtimeReport);
            }
        }

        const dockerRuntimeTarget = runtimeTargets.find((entry) => entry.type === 'docker');
        if (dockerRuntimeTarget) {
            const diagnosticsReport = await runDockerDiagnosticsSmoke(page, {
                browserName,
                url: dockerRuntimeTarget.url
            });
            if (diagnosticsReport) {
                dockerDiagnosticsReports.push(diagnosticsReport);
            }
            const updateFlowReport = await runDockerUpdateFlowSmoke(page, {
                browserName,
                url: dockerRuntimeTarget.url
            });
            if (updateFlowReport) {
                dockerUpdateFlowReports.push(updateFlowReport);
            }
            const previewStatusReport = await runDockerPreviewStatusSmoke(page, {
                browserName,
                url: dockerRuntimeTarget.url
            });
            if (previewStatusReport) {
                dockerPreviewStatusReports.push(previewStatusReport);
            }
        }

        if (dashboardUrl) {
            const dashboardReport = await runDashboardQuickRailSmoke(page, {
                browserName,
                url: dashboardUrl
            });
            if (dashboardReport) {
                dashboardReports.push(dashboardReport);
            }
            const advancedPreviewReport = await runDashboardAdvancedPreviewSmoke(page, {
                browserName,
                url: dashboardUrl
            });
            if (advancedPreviewReport) {
                dashboardAdvancedPreviewReports.push(advancedPreviewReport);
            }
        }

        for (const type of ['docker', 'vm']) {
            const folderEditorReport = await runFolderEditorToggleSmoke(page, {
                browserName,
                settingsUrl: targetUrl,
                type
            });
            if (folderEditorReport) {
                folderEditorReports.push(folderEditorReport);
            }
        }

        console.log(`Browser smoke passed: ${browserName} (${scenarioLabel})`);
    } finally {
        await context.close();
        await browser.close();
    }
};

try {
    console.log(`Running browser smoke scenario: ${scenarioLabel}`);
    if (runtimeTargets.length > 0) {
        runtimeTargets.forEach((entry) => {
            console.log(`Runtime visual target configured: ${entry.type}`);
        });
    } else {
        console.log('Runtime visual target: none (set FVPLUS_BROWSER_SMOKE_DOCKER_URL/FVPLUS_BROWSER_SMOKE_VM_URL or use settings URL auto-derivation).');
    }
    console.log(`Dashboard quick-rail target: ${dashboardUrl ? 'configured' : 'none'}`);
    console.log(`Live-system artifact capture: ${captureLiveArtifacts ? 'explicitly enabled for local use' : 'disabled'}`);
    await runBrowserSmoke('chromium', playwright.chromium);
    await runBrowserSmoke('firefox', playwright.firefox);
    await runBrowserSmoke('webkit', playwright.webkit);

    const reportPayload = {
        version: 1,
        generatedAt: new Date().toISOString(),
        scenarioLabel,
        reports: runtimeReports,
        dockerDiagnosticsReports,
        dockerUpdateFlowReports,
        dockerPreviewStatusReports,
        dashboardReports,
        dashboardAdvancedPreviewReports,
        localizationReports,
        folderEditorReports
    };
    if (captureLiveArtifacts) {
        const reportPath = path.join(artifactRoot, 'browser-smoke-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2), { encoding: 'utf8', mode: 0o600 });
        console.log(`Local browser smoke report written: ${reportPath}`);
    }

    if (baselineFile) {
        if (baselineMode === 'record') {
            if (!captureLiveArtifacts) {
                throw new Error('Recording a live-system baseline requires FVPLUS_BROWSER_SMOKE_CAPTURE_LIVE_ARTIFACTS=1.');
            }
            const baselinePayload = {
                version: 1,
                generatedAt: new Date().toISOString(),
                scenarioLabel,
                reports: Object.fromEntries(runtimeReports.map((entry) => [buildRuntimeReportKey(entry), entry]))
            };
            fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
            fs.writeFileSync(baselineFile, JSON.stringify(baselinePayload, null, 2), 'utf8');
            console.log(`Browser smoke baseline updated: ${baselineFile}`);
        } else if (baselineMode === 'enforce') {
            if (!fs.existsSync(baselineFile)) {
                if (requireBaseline) {
                    throw new Error(`Browser smoke baseline file is required but missing: ${baselineFile}`);
                }
                console.warn(`Browser smoke baseline file not found (skipping compare): ${baselineFile}`);
            } else {
                const baselinePayload = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
                const failures = compareAgainstBaseline(runtimeReports, baselinePayload);
                if (failures.length > 0) {
                    throw new Error(`Browser smoke baseline regression: ${JSON.stringify(failures)}`);
                }
                console.log(`Browser smoke baseline compare passed: ${baselineFile}`);
            }
        }
    }
} catch (error) {
    console.error(`ERROR: Browser smoke checks failed: ${redactLiveSmokeDiagnostic(error, sensitiveTargetValues)}`);
    process.exitCode = 1;
} finally {
    try {
        fs.rmSync(tempImportDir, { recursive: true, force: true });
    } catch {
        // best effort cleanup
    }
}
