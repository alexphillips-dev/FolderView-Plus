import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const targetUrl = String(process.env.FVPLUS_BROWSER_SMOKE_URL || '').trim();
const dockerRuntimeUrlEnv = String(process.env.FVPLUS_BROWSER_SMOKE_DOCKER_URL || '').trim();
const vmRuntimeUrlEnv = String(process.env.FVPLUS_BROWSER_SMOKE_VM_URL || '').trim();
const targetLabel = String(process.env.FVPLUS_BROWSER_SMOKE_LABEL || '').trim();
const unraidVersionHint = String(process.env.FVPLUS_UNRAID_VERSION_HINT || '').trim();
const themeHint = String(process.env.FVPLUS_THEME_HINT || '').trim();
const requireRuntimeRows = String(process.env.FVPLUS_BROWSER_SMOKE_REQUIRE_RUNTIME_ROWS || '0').trim() === '1';
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

if (!targetUrl) {
    console.log('Skipping browser smoke checks (FVPLUS_BROWSER_SMOKE_URL not set).');
    process.exit(0);
}

const scenarioLabel = [
    targetLabel || 'unlabeled-target',
    unraidVersionHint ? `Unraid ${unraidVersionHint}` : '',
    themeHint ? `Theme ${themeHint}` : ''
].filter(Boolean).join(' | ');

const sanitizeToken = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'token';

const runtimeReports = [];

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

const tempImportPath = path.join(os.tmpdir(), `fvplus-browser-smoke-${Date.now()}.json`);
fs.writeFileSync(tempImportPath, JSON.stringify(payload, null, 2), 'utf8');
fs.mkdirSync(artifactRoot, { recursive: true });

const runRuntimeLayoutSmoke = async (page, { browserName, type, url }) => {
    const minGap = Number.isFinite(runtimeGapMinOverride) ? runtimeGapMinOverride : (type === 'docker' ? 6 : 4);
    const maxGap = Number.isFinite(runtimeGapMaxOverride) ? runtimeGapMaxOverride : (type === 'docker' ? 30 : 40);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(900);

    const report = await page.evaluate((context) => {
        const collectRows = (selectors) => {
            for (const selector of selectors) {
                const nodes = Array.from(document.querySelectorAll(selector));
                if (nodes.length > 0) {
                    return nodes;
                }
            }
            return [];
        };
        const toMetric = (value) => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
        const rowSelectors = context.type === 'docker'
            ? ['tbody#docker_list tr.folder', 'tbody#docker_view tr.folder', 'table#docker_containers tr.folder']
            : ['#kvm_table tr.folder', 'tbody#kvm_list tr.folder', 'tbody#kvm_view tr.folder'];

        const rows = collectRows(rowSelectors).filter((row) => row && row.offsetParent !== null);
        if (!rows.length) {
            return {
                type: context.type,
                skipped: true,
                reason: 'No folder row found for runtime layout check.'
            };
        }

        const withLabel = rows.map((row) => {
            const label = row.querySelector('.folder-appname');
            const text = String(label?.textContent || '').trim();
            return {
                row,
                label,
                text,
                textLen: text.length
            };
        });
        withLabel.sort((a, b) => a.textLen - b.textLen);
        const shortest = withLabel[0];
        const longest = withLabel[withLabel.length - 1];
        const candidates = [];
        if (shortest) {
            candidates.push(shortest);
        }
        if (longest && longest.row !== shortest?.row) {
            candidates.push(longest);
        }

        const checks = candidates.map((entry, idx) => {
            const row = entry.row;
            const appCell = row.querySelector('td.ct-name.folder-name, td.vm-name.folder-name, td.folder-name');
            const dropdown = row.querySelector('button.folder-dropdown');
            if (!appCell || !dropdown) {
                return {
                    role: idx === 0 ? 'shortest' : 'longest',
                    skipped: true,
                    reason: 'Missing app cell or dropdown element.'
                };
            }
            const appRect = appCell.getBoundingClientRect();
            const dropdownRect = dropdown.getBoundingClientRect();
            const appBoundaryGap = appRect.right - dropdownRect.right;
            let versionGap = null;
            if (context.type === 'docker') {
                const versionCell = row.querySelector('td.updatecolumn.folder-update');
                if (versionCell) {
                    const versionRect = versionCell.getBoundingClientRect();
                    versionGap = versionRect.left - dropdownRect.right;
                }
            }
            const crossesAppBoundary = appBoundaryGap < context.minGap;
            const overlapsVersion = versionGap !== null && versionGap < context.minGap;
            const excessiveVersionGap = versionGap !== null && versionGap > context.maxGap;
            return {
                role: idx === 0 ? 'shortest' : 'longest',
                skipped: false,
                folderName: entry.text || '(empty)',
                textLen: entry.textLen,
                minGap: context.minGap,
                maxGap: context.maxGap,
                appBoundaryGap: toMetric(appBoundaryGap),
                versionGap: toMetric(versionGap),
                crossesAppBoundary,
                overlapsVersion,
                excessiveVersionGap,
                pass: !crossesAppBoundary && !overlapsVersion && !excessiveVersionGap
            };
        });

        const activeChecks = checks.filter((item) => !item.skipped);
        if (!activeChecks.length) {
            return {
                type: context.type,
                skipped: true,
                reason: 'Unable to evaluate row metrics.'
            };
        }

        return {
            type: context.type,
            skipped: false,
            pass: activeChecks.every((item) => item.pass),
            checks
        };
    }, { type, minGap, maxGap });

    const screenshotName = `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-${sanitizeToken(type)}.png`;
    const screenshotPath = path.join(artifactRoot, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (report?.skipped) {
        const message = `Runtime visual check skipped for ${type} (${browserName}): ${report.reason}`;
        if (requireRuntimeRows) {
            throw new Error(`${message} [required by FVPLUS_BROWSER_SMOKE_REQUIRE_RUNTIME_ROWS=1]`);
        }
        console.warn(message);
        return {
            browserName,
            type,
            url,
            skipped: true,
            pass: false,
            reason: report.reason,
            checks: [],
            screenshotPath
        };
    }

    if (!report?.pass) {
        const failedChecks = Array.isArray(report?.checks)
            ? report.checks.filter((item) => !item.skipped && item.pass !== true)
            : [];
        throw new Error(
            `Runtime layout overlap detected for ${type} (${browserName}). `
            + `Failed rows: ${JSON.stringify(failedChecks)}. `
            + `Screenshot: ${screenshotPath}`
        );
    }

    console.log(
        `Runtime visual check passed: ${type} (${browserName}) `
        + `${JSON.stringify(report.checks || [])}`
    );
    return {
        browserName,
        type,
        url,
        skipped: false,
        pass: report?.pass === true,
        checks: Array.isArray(report?.checks) ? report.checks : [],
        screenshotPath
    };
};

const runBrowserSmoke = async (browserName, browserType) => {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: ignoreHttpsErrors });
    const page = await context.newPage();
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.locator('#fv-settings-topbar').waitFor({ state: 'visible', timeout: timeoutMs });
        await page.locator('#fv-settings-action-bar').waitFor({ state: 'visible', timeout: timeoutMs });

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
            console.log(`Runtime visual target: ${entry.type} -> ${entry.url}`);
        });
    } else {
        console.log('Runtime visual target: none (set FVPLUS_BROWSER_SMOKE_DOCKER_URL/FVPLUS_BROWSER_SMOKE_VM_URL or use settings URL auto-derivation).');
    }
    console.log(`Browser smoke artifacts directory: ${artifactRoot}`);
    await runBrowserSmoke('chromium', playwright.chromium);
    await runBrowserSmoke('firefox', playwright.firefox);
    await runBrowserSmoke('webkit', playwright.webkit);

    const reportPayload = {
        version: 1,
        generatedAt: new Date().toISOString(),
        scenarioLabel,
        reports: runtimeReports
    };
    const reportPath = path.join(artifactRoot, 'browser-smoke-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2), 'utf8');
    console.log(`Browser smoke report written: ${reportPath}`);

    if (baselineFile) {
        if (baselineMode === 'record') {
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
} finally {
    try {
        fs.unlinkSync(tempImportPath);
    } catch {
        // best effort cleanup
    }
}
