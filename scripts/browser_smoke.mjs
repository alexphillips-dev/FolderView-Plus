import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
const dashboardReports = [];
const folderEditorReports = [];
const dockerDiagnosticsReports = [];
const dockerUpdateFlowReports = [];
const dockerPreviewStatusReports = [];
const dashboardAdvancedPreviewReports = [];
const nativeOrganizerDiagnosticsReports = [];

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
            const preview = row.querySelector('.folder-preview');
            const previewWrapper = preview?.querySelector('.folder-preview-wrapper');
            const dropdownIcon = dropdown?.querySelector('i');
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
            const dropdownStyle = window.getComputedStyle(dropdown);
            const dropdownIconStyle = dropdownIcon ? window.getComputedStyle(dropdownIcon) : null;
            const chevronVisible = dropdownStyle.visibility !== 'hidden'
                && Number(dropdownStyle.opacity) > 0.01
                && (!dropdownIconStyle || (dropdownIconStyle.visibility !== 'hidden' && Number(dropdownIconStyle.opacity) > 0.01));
            let previewCenterDelta = null;
            let previewOverflowPx = null;
            if (preview && previewWrapper) {
                const previewRect = preview.getBoundingClientRect();
                const previewWrapperRect = previewWrapper.getBoundingClientRect();
                previewCenterDelta = Math.abs(
                    (previewRect.top + (previewRect.height / 2))
                    - (previewWrapperRect.top + (previewWrapperRect.height / 2))
                );
                previewOverflowPx = Math.max(0, previewWrapperRect.right - previewRect.right);
            }
            let versionGap = null;
            if (context.type === 'docker') {
                const versionCell = row.querySelector('td.updatecolumn.folder-update');
                if (versionCell) {
                    const versionRect = versionCell.getBoundingClientRect();
                    versionGap = versionRect.left - dropdownRect.right;
                }
            }
            const multirowRows = preview && preview.classList.contains('fv-preview-multirow')
                ? Array.from(preview.querySelectorAll('.folder-preview-row'))
                : [];
            const multirowOverflowPx = multirowRows.reduce((max, rowNode) => {
                const rowRect = rowNode.getBoundingClientRect();
                let localMax = max;
                rowNode.querySelectorAll('.folder-preview-wrapper, .folder-preview-divider').forEach((node) => {
                    const rect = node.getBoundingClientRect();
                    localMax = Math.max(localMax, Math.max(0, rect.right - rowRect.right));
                });
                return localMax;
            }, 0);
            const crossesAppBoundary = appBoundaryGap < context.minGap;
            const overlapsVersion = versionGap !== null && versionGap < context.minGap;
            const excessiveVersionGap = versionGap !== null && versionGap > context.maxGap;
            const misalignedCenter = previewCenterDelta !== null && previewCenterDelta > 8;
            const overflowedPreview = (previewOverflowPx !== null && previewOverflowPx > 1.5) || multirowOverflowPx > 1.5;
            return {
                role: idx === 0 ? 'shortest' : 'longest',
                skipped: false,
                folderName: entry.text || '(empty)',
                textLen: entry.textLen,
                minGap: context.minGap,
                maxGap: context.maxGap,
                appBoundaryGap: toMetric(appBoundaryGap),
                versionGap: toMetric(versionGap),
                chevronVisible,
                previewCenterDelta: toMetric(previewCenterDelta),
                previewOverflowPx: toMetric(previewOverflowPx),
                multirowOverflowPx: toMetric(multirowOverflowPx),
                crossesAppBoundary,
                overlapsVersion,
                excessiveVersionGap,
                misalignedCenter,
                overflowedPreview,
                pass: chevronVisible && !crossesAppBoundary && !overlapsVersion && !excessiveVersionGap && !misalignedCenter && !overflowedPreview
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
            `Runtime layout contract failure detected for ${type} (${browserName}). `
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

const runDockerDiagnosticsSmoke = async (page, { browserName, url }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);

    const report = await page.evaluate(async () => {
        const pageKey = 'fv.support.bundle.docker.page.v1';
        const requestKey = 'fv.support.bundle.docker.requestBundleTrace.v1';
        const traceHealthKey = 'fv.support.bundle.docker.traceHealth.v1';
        const readRecord = (storageKey) => {
            try {
                const raw = window.localStorage?.getItem(storageKey);
                return raw ? JSON.parse(raw) : null;
            } catch (_error) {
                return null;
            }
        };
        const waitForRecord = async (predicate, timeoutMs = 6000, stepMs = 100) => {
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < timeoutMs) {
                const value = predicate();
                if (value) {
                    return value;
                }
                await new Promise((resolve) => window.setTimeout(resolve, stepMs));
            }
            return null;
        };
        const rows = Array.from(document.querySelectorAll('#docker_list > tr, #docker_view > tr'))
            .filter((row) => row instanceof HTMLElement && row.offsetParent !== null);
        if (!rows.length) {
            return {
                skipped: true,
                reason: 'No visible Docker rows found for diagnostics smoke.'
            };
        }
        if (typeof window.loadlist !== 'function') {
            return {
                skipped: true,
                reason: 'window.loadlist is unavailable on the Docker page.'
            };
        }
        const currentMode = /\bdocker_listview_mode=advanced\b/i.test(String(document.cookie || ''))
            ? 'advanced'
            : 'basic';
        const nextMode = currentMode === 'advanced' ? 'basic' : 'advanced';
        const canToggleMode = typeof window.$?.cookie === 'function';
        const beforeRequestTrace = readRecord(requestKey);
        const beforeRequestCount = Number(beforeRequestTrace?.count || 0);

        window.loadlist();
        const requestTrace = await waitForRecord(() => {
            const record = readRecord(requestKey);
            if (!record || Number(record?.count || 0) < beforeRequestCount) {
                return null;
            }
            const entries = Array.isArray(record?.entries) ? record.entries : [];
            const sawLoadlist = entries.some((entry) => entry?.eventType === 'loadlist');
            const sawBuildReq = entries.some((entry) => entry?.eventType === 'buildDockerFolderReq');
            const sawListview = entries.some((entry) => entry?.eventType === 'listview');
            return sawLoadlist && sawBuildReq && sawListview ? record : null;
        });
        const pageSnapshotAfterLoadlist = await waitForRecord(() => {
            const record = readRecord(pageKey);
            return record?.currentPage === '/Docker' ? record : null;
        });

        let toggleResult = {
            supported: canToggleMode,
            toggledTo: null,
            toggleObserved: false,
            restoreObserved: false
        };
        if (canToggleMode) {
            window.$.cookie('docker_listview_mode', nextMode);
            const toggledSnapshot = await waitForRecord(() => {
                const record = readRecord(pageKey);
                return record?.listViewMode === nextMode ? record : null;
            }, 5000);
            toggleResult = {
                ...toggleResult,
                toggledTo: nextMode,
                toggleObserved: Boolean(toggledSnapshot),
                restoreObserved: false
            };
            window.$.cookie('docker_listview_mode', currentMode);
            const restoredSnapshot = await waitForRecord(() => {
                const record = readRecord(pageKey);
                return record?.listViewMode === currentMode ? record : null;
            }, 5000);
            toggleResult.restoreObserved = Boolean(restoredSnapshot);
        }

        const finalPageSnapshot = readRecord(pageKey);
        const traceHealth = readRecord(traceHealthKey);
        const finalRequestTrace = readRecord(requestKey);

        return {
            skipped: false,
            pass: Boolean(requestTrace) && Boolean(pageSnapshotAfterLoadlist)
                && (!canToggleMode || (toggleResult.toggleObserved && toggleResult.restoreObserved)),
            listViewMode: currentMode,
            visibleFolderRows: Number(finalPageSnapshot?.summary?.visibleFolderRows || 0),
            folderActionMismatchCount: Number(finalPageSnapshot?.summary?.folderActionMismatchCount || 0),
            memberActionMismatchCount: Number(finalPageSnapshot?.summary?.memberActionMismatchCount || 0),
            requestTraceAvailable: Boolean(finalRequestTrace),
            requestTraceCount: Number(finalRequestTrace?.count || 0),
            traceHealthAvailable: Boolean(traceHealth),
            requestTraceWriteSucceeded: traceHealth?.requestBundleTrace?.lastWriteSucceeded === true,
            pageSnapshotWriteSucceeded: traceHealth?.pageSnapshot?.lastWriteSucceeded === true,
            toggleResult
        };
    });

    const screenshotName = `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-docker-diagnostics.png`;
    const screenshotPath = path.join(artifactRoot, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (report?.skipped) {
        console.warn(`Docker diagnostics smoke skipped for ${browserName}: ${report.reason}`);
        return {
            browserName,
            url,
            skipped: true,
            pass: false,
            reason: report.reason,
            screenshotPath
        };
    }

    if (!report?.pass) {
        throw new Error(
            `Docker diagnostics smoke failed for ${browserName}: ${JSON.stringify(report)}. `
            + `Screenshot: ${screenshotPath}`
        );
    }

    console.log(`Docker diagnostics smoke passed: ${browserName} ${JSON.stringify(report)}`);
    return {
        browserName,
        url,
        skipped: false,
        pass: true,
        screenshotPath,
        ...report
    };
};

const runDockerUpdateFlowSmoke = async (page, { browserName, url }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);

    const report = await page.evaluate(async () => {
        const bulkKey = 'fv.support.bundle.docker.bulkUpdateTrace.v1';
        const requestKey = 'fv.support.bundle.docker.requestBundleTrace.v1';
        const pageKey = 'fv.support.bundle.docker.page.v1';
        const readRecord = (storageKey) => {
            try {
                const raw = window.localStorage?.getItem(storageKey);
                return raw ? JSON.parse(raw) : null;
            } catch (_error) {
                return null;
            }
        };
        const waitForRecord = async (predicate, timeoutMs = 6000, stepMs = 100) => {
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < timeoutMs) {
                const value = predicate();
                if (value) {
                    return value;
                }
                await new Promise((resolve) => window.setTimeout(resolve, stepMs));
            }
            return null;
        };
        if (typeof window.updateFolder !== 'function') {
            return {
                skipped: true,
                reason: 'window.updateFolder is unavailable on the Docker page.'
            };
        }
        if (typeof window.loadlist !== 'function') {
            return {
                skipped: true,
                reason: 'window.loadlist is unavailable on the Docker page.'
            };
        }
        const updateLink = Array.from(document.querySelectorAll('#docker_list td.updatecolumn a.exec, #docker_view td.updatecolumn a.exec'))
            .find((node) => {
                const text = String(node?.closest('td.updatecolumn')?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                return /apply update/.test(text) && /updateFolder\(/.test(String(node?.getAttribute('onclick') || ''));
            });
        if (!(updateLink instanceof HTMLAnchorElement)) {
            return {
                skipped: true,
                reason: 'No folder apply update row available for synthetic update-flow smoke.'
            };
        }
        const folderRow = updateLink.closest('tr');
        const folderIdMatch = String(updateLink.getAttribute('onclick') || '').match(/updateFolder\(\s*['"]?([^,'")\s]+)['"]?/i);
        const folderId = String(folderIdMatch?.[1] || '').trim();
        if (!folderId) {
            return {
                skipped: true,
                reason: 'Unable to resolve the target folder id for synthetic update-flow smoke.'
            };
        }

        const beforeBulkTrace = readRecord(bulkKey);
        const beforeRequestTrace = readRecord(requestKey);
        const beforeBulkCount = Number(beforeBulkTrace?.count || 0);
        const beforeRequestCount = Number(beforeRequestTrace?.count || 0);
        const capturedCommands = [];
        const originalOpenDocker = window.openDocker;

        try {
            window.openDocker = function(...args) {
                capturedCommands.push(Array.isArray(args) ? args.map((entry) => String(entry ?? '')) : []);
                return undefined;
            };

            window.updateFolder(folderId);

            const bulkTrace = await waitForRecord(() => {
                const record = readRecord(bulkKey);
                if (!record || Number(record?.count || 0) < beforeBulkCount) {
                    return null;
                }
                const entries = Array.isArray(record?.entries) ? record.entries : [];
                const nextEntries = entries.slice(beforeBulkCount);
                const sawDispatch = nextEntries.some((entry) => entry?.eventType === 'updateFolderDispatch');
                const sawDialogOpened = nextEntries.some((entry) => entry?.eventType === 'dialogOpened');
                const sawReconcileWindow = nextEntries.some((entry) => entry?.eventType === 'reconcileWindowArmed');
                return sawDispatch && sawDialogOpened && sawReconcileWindow ? record : null;
            }, 6000);

            window.loadlist();

            const requestTrace = await waitForRecord(() => {
                const record = readRecord(requestKey);
                if (!record || Number(record?.count || 0) < beforeRequestCount) {
                    return null;
                }
                const entries = Array.isArray(record?.entries) ? record.entries : [];
                const nextEntries = entries.slice(beforeRequestCount);
                const sawLoadlist = nextEntries.some((entry) => entry?.eventType === 'loadlist');
                const matchingBuild = nextEntries.find((entry) =>
                    entry?.eventType === 'buildDockerFolderReq'
                    && entry?.liveUpdateStatus === true
                    && entry?.hostSyncSuspended === true
                );
                const sawListview = nextEntries.some((entry) => entry?.eventType === 'listview');
                return sawLoadlist && matchingBuild && sawListview ? { record, matchingBuild } : null;
            }, 6000);

            const pageSnapshot = await waitForRecord(() => {
                const record = readRecord(pageKey);
                return record?.currentPage === '/Docker' ? record : null;
            }, 3000);

            return {
                skipped: false,
                pass: Boolean(bulkTrace) && Boolean(requestTrace),
                folderId,
                capturedCommandCount: capturedCommands.length,
                capturedFirstCommand: capturedCommands[0]?.[0] || null,
                visibleFolderClass: String(folderRow?.className || ''),
                bulkTraceCount: Number(bulkTrace?.count || 0),
                requestTraceCount: Number(requestTrace?.record?.count || 0),
                liveUpdateStatusObserved: requestTrace?.matchingBuild?.liveUpdateStatus === true,
                hostSyncSuspendedObserved: requestTrace?.matchingBuild?.hostSyncSuspended === true,
                pageSnapshotAvailable: Boolean(pageSnapshot)
            };
        } finally {
            window.openDocker = originalOpenDocker;
        }
    });

    const screenshotName = `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-docker-update-flow.png`;
    const screenshotPath = path.join(artifactRoot, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (report?.skipped) {
        console.warn(`Docker update-flow smoke skipped for ${browserName}: ${report.reason}`);
        return {
            browserName,
            url,
            skipped: true,
            pass: false,
            reason: report.reason,
            screenshotPath
        };
    }

    if (!report?.pass) {
        throw new Error(
            `Docker update-flow smoke failed for ${browserName}: ${JSON.stringify(report)}. `
            + `Screenshot: ${screenshotPath}`
        );
    }

    console.log(`Docker update-flow smoke passed: ${browserName} ${JSON.stringify(report)}`);
    return {
        browserName,
        url,
        skipped: false,
        pass: true,
        screenshotPath,
        ...report
    };
};

const runDashboardQuickRailSmoke = async (page, { browserName, url }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);

    const report = await page.evaluate(() => {
        const widgetSelectors = {
            docker: {
                rail: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="docker"] .fv-dashboard-layout-quick-rail',
                button: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="docker"] [data-fv-quick-action="layout-cycle"]',
                tbody: 'tbody#docker_view'
            },
            vm: {
                rail: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="vm"] .fv-dashboard-layout-quick-rail',
                button: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="vm"] [data-fv-quick-action="layout-cycle"]',
                tbody: 'tbody#vm_view'
            }
        };
        const isVisible = (node) => {
            if (!node) {
                return false;
            }
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) {
                return false;
            }
            const rect = node.getBoundingClientRect();
            return rect.width > 1 && rect.height > 1;
        };
        const widgets = Object.entries(widgetSelectors).map(([type, selectors]) => {
            const rail = document.querySelector(selectors.rail);
            const button = document.querySelector(selectors.button);
            const tbody = document.querySelector(selectors.tbody);
            return {
                type,
                railVisible: isVisible(rail),
                buttonVisible: isVisible(button),
                layout: String(tbody?.getAttribute('data-fv-dashboard-layout') || '').trim().toLowerCase()
            };
        }).filter((entry) => entry.railVisible || entry.buttonVisible || entry.layout !== '');
        return {
            widgets
        };
    });

    const screenshotName = `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-dashboard.png`;
    const screenshotPath = path.join(artifactRoot, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (!Array.isArray(report?.widgets) || report.widgets.length === 0) {
        console.warn(`Dashboard quick-rail smoke skipped for ${browserName}: no dashboard widget controls detected.`);
        return {
            browserName,
            url,
            skipped: true,
            pass: false,
            widgets: [],
            screenshotPath
        };
    }

    const widgetReports = [];
    for (const widget of report.widgets) {
        const type = widget.type === 'vm' ? 'vm' : 'docker';
        const rail = page.locator(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${type}"] .fv-dashboard-layout-quick-rail`).first();
        const button = rail.locator('[data-fv-quick-action="layout-cycle"]').first();
        if (await button.count() === 0) {
            continue;
        }
        const visitedLayouts = [];
        for (let index = 0; index < 6; index += 1) {
            const snapshot = await page.evaluate((widgetType) => {
                const railNode = document.querySelector(`.fv-dashboard-layout-inline-host[data-fv-dashboard-type="${widgetType}"] .fv-dashboard-layout-quick-rail`);
                const tbody = document.querySelector(widgetType === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view');
                const isVisible = (node) => {
                    if (!node) {
                        return false;
                    }
                    const style = window.getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) {
                        return false;
                    }
                    const rect = node.getBoundingClientRect();
                    return rect.width > 1 && rect.height > 1;
                };
                return {
                    layout: String(tbody?.getAttribute('data-fv-dashboard-layout') || '').trim().toLowerCase(),
                    railVisible: isVisible(railNode)
                };
            }, type);
            visitedLayouts.push(snapshot.layout || '');
            if (snapshot.railVisible !== true) {
                throw new Error(`Dashboard quick rail hidden during ${type} layout cycling. Screenshot: ${screenshotPath}`);
            }
            await button.click({ timeout: timeoutMs });
            await page.waitForTimeout(220);
        }
        const uniqueLayouts = Array.from(new Set(visitedLayouts.filter(Boolean)));
        if (uniqueLayouts.length < 2) {
            throw new Error(`Dashboard layout cycle did not change layout for ${type}. Visited: ${JSON.stringify(visitedLayouts)}. Screenshot: ${screenshotPath}`);
        }
        if (!uniqueLayouts.includes('legacy')) {
            throw new Error(`Dashboard layout cycle did not reach legacy for ${type}. Visited: ${JSON.stringify(uniqueLayouts)}. Screenshot: ${screenshotPath}`);
        }
        widgetReports.push({
            type,
            visitedLayouts: uniqueLayouts
        });
    }

    console.log(`Dashboard quick-rail smoke passed: ${browserName} ${JSON.stringify(widgetReports)}`);
    return {
        browserName,
        url,
        skipped: false,
        pass: true,
        widgets: widgetReports,
        screenshotPath
    };
};

const runDashboardAdvancedPreviewSmoke = async (page, { browserName, url }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);
    const report = await page.evaluate(() => {
        const moduleReady = window.FolderViewPlusDashboardAdvancedPreviewModuleLoaded === true
            && window.FolderViewPlusDashboardAdvancedPreview
            && typeof window.FolderViewPlusDashboardAdvancedPreview.attachAdvancedPreview === 'function';
        const dockerMembers = Array.from(document.querySelectorAll('tbody#docker_view [id^="dashboard-docker-"], tbody#docker_view .folder-showcase-outer-docker .outer'));
        const advancedPreviewNodes = Array.from(document.querySelectorAll('.fv-dashboard-advanced-preview'));
        return {
            moduleReady,
            dockerMemberCount: dockerMembers.length,
            advancedPreviewNodeCount: advancedPreviewNodes.length,
            skipped: dockerMembers.length <= 0
        };
    });
    if (report.moduleReady !== true) {
        throw new Error(`Dashboard advanced preview module is not available for ${browserName}.`);
    }
    if (report.skipped === true) {
        console.warn(`Dashboard advanced preview smoke skipped for ${browserName}: no Docker dashboard members detected.`);
    } else {
        console.log(`Dashboard advanced preview smoke passed: ${browserName} ${JSON.stringify(report)}`);
    }
    return {
        browserName,
        url,
        pass: report.moduleReady === true,
        ...report
    };
};

const runDockerPreviewStatusSmoke = async (page, { browserName, url }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(900);
    const report = await page.evaluate(() => {
        const previewCards = Array.from(document.querySelectorAll('.fv-docker-preview-mode-2'));
        const iconStatusNodes = Array.from(document.querySelectorAll('.fv-docker-preview-mode-2 .fv-preview-icon-status'));
        const hiddenStatusNodes = iconStatusNodes.filter((node) => {
            const style = window.getComputedStyle(node);
            return style.display === 'none' || node.classList.contains('fv-preview-status-hidden');
        });
        return {
            onlyIconPreviewCount: previewCards.length,
            iconStatusCount: iconStatusNodes.length,
            hiddenStatusCount: hiddenStatusNodes.length,
            statusCleanupHookPresent: typeof window.FolderViewPlusDockerPreviewActions?.createApi === 'function'
        };
    });
    if (report.statusCleanupHookPresent !== true) {
        throw new Error(`Docker preview action cleanup hook is unavailable for ${browserName}.`);
    }
    console.log(`Docker preview status smoke passed: ${browserName} ${JSON.stringify(report)}`);
    return {
        browserName,
        url,
        pass: true,
        ...report
    };
};

const runNativeOrganizerDiagnosticsSmoke = async (page, { browserName, settingsUrl }) => {
    await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSettingsShell(page);
    const report = await page.evaluate(async () => {
        localStorage.setItem('fv.native.organizer.status.v1', JSON.stringify({
            checkedAt: new Date().toISOString(),
            ok: false,
            skipped: true,
            reason: 'graphql_unavailable',
            source: 'detect'
        }));
        if (typeof window.runDiagnostics === 'function') {
            await window.runDiagnostics();
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        const summaryText = String(document.querySelector('#fv-diagnostics-summary')?.textContent || '');
        const organizerCard = Array.from(document.querySelectorAll('#fv-diagnostics-summary .fv-diagnostics-card'))
            .find((card) => /Native Docker Organizer/i.test(String(card.textContent || '')));
        return {
            cardPresent: /Native Docker Organizer/i.test(summaryText),
            waitingStatePresent: /waiting for the Docker page/i.test(summaryText),
            optionalStatePresent: organizerCard?.classList.contains('is-info') === true,
            checkAgainPresent: Boolean(organizerCard?.querySelector('[data-fv-diagnostics-card-action="check_native_organizer"]')),
            organizerIssueCountPresent: /related issue/i.test(String(organizerCard?.textContent || '')),
            summaryTextLength: summaryText.length
        };
    });
    if (report.cardPresent !== true) {
        throw new Error(`Native organizer diagnostics card was not rendered for ${browserName}.`);
    }
    if (report.optionalStatePresent !== true || report.checkAgainPresent !== true || report.organizerIssueCountPresent === true) {
        throw new Error(`Native organizer unavailability was not rendered as a non-issue optional state for ${browserName}.`);
    }
    console.log(`Native organizer diagnostics smoke passed: ${browserName} ${JSON.stringify(report)}`);
    return {
        browserName,
        url: settingsUrl,
        pass: true,
        ...report
    };
};

const waitForSettingsShell = async (page) => {
    await page.locator('#fv-settings-topbar').waitFor({ state: 'visible', timeout: timeoutMs });
    await page.locator('#fv-settings-search').waitFor({ state: 'visible', timeout: timeoutMs });
};

const waitForFolderEditorReady = async (page, { type, expectedMode }) => {
    await page.waitForFunction(({ expectedType, expectedMode: mode }) => {
        const pageType = String(window.FolderViewPlusFolderEditorPageType || '').trim().toLowerCase();
        const pageMode = String(window.FolderViewPlusFolderEditorPageMode || '').trim().toLowerCase();
        const resolvedMode = String(window.FolderViewPlusFolderEditorResolvedMode || '').trim().toLowerCase();
        const stage = String(window.FolderViewPlusFolderEditorRuntimeBootStage || '').trim().toLowerCase();
        const form = document.querySelector('div.canvas > form.folder-editor-form');
        if (pageType !== expectedType || pageMode !== mode || resolvedMode !== mode || !form) {
            return false;
        }
        if (mode !== 'modern') {
            return true;
        }
        return window.FolderViewPlusFolderEditorRuntimeLoaded === true
            && document.querySelector('#fvEditorChrome')
            && stage === 'runtime-ready';
    }, { expectedType: type, expectedMode }, { timeout: timeoutMs });

    return page.evaluate(() => ({
        pageType: String(window.FolderViewPlusFolderEditorPageType || '').trim().toLowerCase(),
        pageMode: String(window.FolderViewPlusFolderEditorPageMode || '').trim().toLowerCase(),
        resolvedMode: String(window.FolderViewPlusFolderEditorResolvedMode || '').trim().toLowerCase(),
        source: String(window.FolderViewPlusFolderEditorModeSource || '').trim().toLowerCase(),
        stage: String(window.FolderViewPlusFolderEditorRuntimeBootStage || '').trim().toLowerCase(),
        runtimeLoaded: window.FolderViewPlusFolderEditorRuntimeLoaded === true
    }));
};

const setFolderEditorFieldValue = async (page, fieldName, {
    value = '',
    checked = undefined
} = {}) => {
    await page.evaluate(({ fieldName: targetFieldName, value: nextValue, checked: nextChecked }) => {
        const form = document.querySelector('div.canvas > form.folder-editor-form');
        const field = form?.elements?.[targetFieldName] || form?.querySelector(`[name="${targetFieldName}"]`);
        if (!(field instanceof HTMLElement)) {
            throw new Error(`Missing folder editor field: ${targetFieldName}`);
        }
        if (field instanceof HTMLInputElement && field.type === 'checkbox') {
            field.checked = nextChecked === undefined ? Boolean(nextValue) : Boolean(nextChecked);
        } else {
            field.value = nextValue;
        }
        if (window.jQuery) {
            window.jQuery(field).trigger('input');
            window.jQuery(field).trigger('change');
        } else {
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, { fieldName, value, checked });
};

const readFoldersFromSettingsPage = async (page, type) => page.evaluate(async (expectedType) => {
    const request = window.FolderViewPlusRequest;
    if (!request || typeof request.getJson !== 'function') {
        throw new Error('FolderViewPlusRequest.getJson is unavailable on the settings page.');
    }
    const response = await request.getJson(`/plugins/folderview.plus/server/read.php?type=${encodeURIComponent(expectedType)}&nocache=1&_=${Date.now()}`);
    return response && typeof response === 'object' ? response : {};
}, type);

const deleteFolderFromSettingsPage = async (page, { type, id }) => {
    await page.evaluate(async ({ expectedType, folderId }) => {
        const request = window.FolderViewPlusRequest;
        if (!request || typeof request.postJson !== 'function') {
            throw new Error('FolderViewPlusRequest.postJson is unavailable on the settings page.');
        }
        await request.postJson('/plugins/folderview.plus/server/delete.php', {
            type: expectedType,
            id: folderId
        });
    }, { expectedType: type, folderId: id });
};

const findFolderEntriesByName = (folders, folderName) => Object.entries(folders || {})
    .filter(([, folder]) => String(folder?.name || '').trim() === folderName)
    .map(([id, folder]) => ({ id, folder }));

const cleanupSmokeFolder = async (page, { settingsUrl, type, folderName }) => {
    await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSettingsShell(page);
    const foldersBefore = await readFoldersFromSettingsPage(page, type);
    const matches = findFolderEntriesByName(foldersBefore, folderName);
    if (matches.length === 0) {
        return {
            deletedIds: [],
            remainingIds: []
        };
    }
    for (const entry of matches) {
        await deleteFolderFromSettingsPage(page, {
            type,
            id: entry.id
        });
    }
    const foldersAfter = await readFoldersFromSettingsPage(page, type);
    const remainingMatches = findFolderEntriesByName(foldersAfter, folderName);
    if (remainingMatches.length > 0) {
        throw new Error(`Smoke cleanup failed for ${folderName}; remaining ids: ${remainingMatches.map((entry) => entry.id).join(', ')}`);
    }
    return {
        deletedIds: matches.map((entry) => entry.id),
        remainingIds: []
    };
};

const openFolderEditorSection = async (page, sectionKey, mode = null) => {
    if (mode) {
        await page.locator(`.fv-editor-mode > button[data-mode="${mode}"]`).first().click({ timeout: timeoutMs });
    }
    await page.locator(`.fv-section-nav > button[data-target="${sectionKey}"]`).first().click({ timeout: timeoutMs });
    await page.waitForFunction((targetSectionKey) => {
        const shell = document.querySelector(`.fv-section-shell[data-section-shell="${targetSectionKey}"]`);
        return shell instanceof HTMLElement && window.getComputedStyle(shell).display !== 'none';
    }, sectionKey, { timeout: timeoutMs });
};

const runFolderEditorInteractionSmoke = async (page, {
    browserName,
    settingsUrl,
    type
}) => {
    const folderName = `Smoke ${type} ${browserName} ${Date.now()}`;
    const removedActionName = `Smoke action removed ${Date.now()}`;
    const savedActionName = `Smoke action saved ${Date.now()}`;
    const screenshotName = `${sanitizeToken(scenarioLabel)}-${sanitizeToken(browserName)}-${sanitizeToken(type)}-folder-editor.png`;
    const screenshotPath = path.join(artifactRoot, screenshotName);
    let cleanupDetails = {
        deletedIds: [],
        remainingIds: []
    };
    let reorderSkippedReason = '';
    let selectedMembers = [];
    let previewOrder = [];

    const addCustomAction = async (actionName) => {
        const launchLink = page.locator('.fv-section-shell[data-section-shell="actions"] .fv-custom-action-link, .fv-section-shell[data-section-shell="actions"] a.custom-action').first();
        if (await launchLink.count() === 0) {
            throw new Error('Custom action launch link is missing from the Actions section.');
        }
        await launchLink.click({ timeout: timeoutMs });
        await page.locator('.dialogCustomAction [name="action_name"]').waitFor({ state: 'visible', timeout: timeoutMs });
        await page.locator('.dialogCustomAction [name="action_name"]').fill(actionName, { timeout: timeoutMs });
        await page.locator('.ui-dialog-buttonpane button').first().click({ timeout: timeoutMs });
        await page.waitForFunction((expectedActionName) => {
            const labels = Array.from(document.querySelectorAll('.custom-action-wrapper > div > span'))
                .map((entry) => String(entry.textContent || '').trim())
                .filter(Boolean);
            return labels.some((label) => label.includes(expectedActionName));
        }, actionName, { timeout: timeoutMs });
    };

    const removeFirstCustomAction = async () => {
        const removed = await page.evaluate(() => {
            const actionRow = document.querySelector('.custom-action-wrapper > div');
            if (!(actionRow instanceof HTMLElement)) {
                return false;
            }
            const buttons = actionRow.querySelectorAll('button');
            if (buttons.length < 2) {
                return false;
            }
            buttons[1].click();
            return true;
        });
        if (!removed) {
            throw new Error('Unable to locate the custom action remove button.');
        }
        await page.waitForFunction(() => document.querySelectorAll('input[name="custom_action[]"]').length === 0, undefined, { timeout: timeoutMs });
    };

    try {
        await openFolderEditorSection(page, 'preview', 'basic');

        const initialPreviewState = await page.evaluate(() => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return {
                previewRows: String(form?.elements?.preview_rows?.value || ''),
                previewBorder: Boolean(form?.elements?.preview_border?.checked)
            };
        });

        await setFolderEditorFieldValue(page, 'name', { value: folderName });
        await setFolderEditorFieldValue(page, 'preview', { value: '1' });
        await setFolderEditorFieldValue(page, 'preview_rows', { value: '4' });
        await setFolderEditorFieldValue(page, 'preview_border', { checked: false });
        await page.waitForFunction(() => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return String(form?.elements?.preview_rows?.value || '') === '4'
                && Boolean(form?.elements?.preview_border?.checked) === false;
        }, undefined, { timeout: timeoutMs });

        await page.locator('button[data-section-action="revert"][data-section="preview"]').first().click({ timeout: timeoutMs });
        await page.waitForFunction((snapshot) => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return String(form?.elements?.preview_rows?.value || '') === snapshot.previewRows
                && Boolean(form?.elements?.preview_border?.checked) === snapshot.previewBorder;
        }, initialPreviewState, { timeout: timeoutMs });

        await setFolderEditorFieldValue(page, 'preview', { value: '1' });
        await setFolderEditorFieldValue(page, 'preview_rows', { value: '4' });
        await setFolderEditorFieldValue(page, 'preview_border', { checked: false });
        await page.locator('button[data-section-action="defaults"][data-section="preview"]').first().click({ timeout: timeoutMs });
        await page.waitForFunction(() => {
            const form = document.querySelector('div.canvas > form.folder-editor-form');
            return String(form?.elements?.preview_rows?.value || '') !== '4'
                && Boolean(form?.elements?.preview_border?.checked) === true;
        }, undefined, { timeout: timeoutMs });
        await setFolderEditorFieldValue(page, 'preview', { value: '1' });

        await openFolderEditorSection(page, 'members', 'basic');
        const memberSelection = await page.evaluate(() => {
            const $ = window.jQuery || null;
            const rows = Array.from(document.querySelectorAll('table.sortable > tbody > tr'));
            const unlockedRows = rows.filter((row) => {
                const input = row.querySelector('input.container-switch');
                return input instanceof HTMLInputElement && input.disabled !== true;
            });
            const chosenRows = unlockedRows.slice(0, 2);
            chosenRows.forEach((row) => {
                const input = row.querySelector('input.container-switch');
                if (!(input instanceof HTMLInputElement)) {
                    return;
                }
                input.checked = true;
                if ($) {
                    $(input).trigger('change');
                } else {
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            return {
                availableCount: unlockedRows.length,
                selectedNames: chosenRows.map((row) => {
                    const input = row.querySelector('input.container-switch');
                    return input instanceof HTMLInputElement ? String(input.value || '').trim() : '';
                }).filter(Boolean)
            };
        });
        selectedMembers = memberSelection.selectedNames;

        if (memberSelection.selectedNames.length >= 2) {
            await page.waitForFunction((expectedNames) => {
                const previewNames = Array.from(document.querySelectorAll('#fvLivePreviewCanvas .fv-live-member-name'))
                    .map((entry) => String(entry.textContent || '').trim())
                    .filter(Boolean)
                    .slice(0, expectedNames.length);
                return previewNames.length === expectedNames.length
                    && previewNames.every((entry, index) => entry === expectedNames[index]);
            }, memberSelection.selectedNames, { timeout: timeoutMs });

            const reorderClicked = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table.sortable > tbody > tr'));
                const selectedRows = rows.filter((row) => {
                    const input = row.querySelector('input.container-switch');
                    return input instanceof HTMLInputElement && input.checked === true && input.disabled !== true;
                });
                const secondRow = selectedRows[1];
                const moveButton = secondRow?.querySelector('.member-move[data-direction="up"]');
                if (!(moveButton instanceof HTMLElement)) {
                    return false;
                }
                moveButton.click();
                return true;
            });
            if (!reorderClicked) {
                throw new Error('Unable to trigger member reordering for the modern editor smoke.');
            }
            const expectedPreviewOrder = [memberSelection.selectedNames[1], memberSelection.selectedNames[0]];
            await page.waitForFunction((expectedNames) => {
                const previewNames = Array.from(document.querySelectorAll('#fvLivePreviewCanvas .fv-live-member-name'))
                    .map((entry) => String(entry.textContent || '').trim())
                    .filter(Boolean)
                    .slice(0, expectedNames.length);
                return previewNames.length === expectedNames.length
                    && previewNames.every((entry, index) => entry === expectedNames[index]);
            }, expectedPreviewOrder, { timeout: timeoutMs });
            previewOrder = expectedPreviewOrder;
        } else {
            reorderSkippedReason = memberSelection.availableCount === 0
                ? 'No available members were exposed by the editor.'
                : 'Only one member was available, so reorder coverage could not run.';
            previewOrder = memberSelection.selectedNames;
        }

        await openFolderEditorSection(page, 'actions', 'advanced');
        await addCustomAction(removedActionName);
        await removeFirstCustomAction();
        await addCustomAction(savedActionName);

        await page.screenshot({ path: screenshotPath, fullPage: true });

        await page.waitForFunction(() => {
            const submit = document.querySelector('.folder-btn-submit');
            return submit instanceof HTMLInputElement && submit.disabled !== true;
        }, undefined, { timeout: timeoutMs });

        const runtimeUrlPattern = type === 'vm' ? /\/VMs(?:[/?#]|$)/i : /\/Docker(?:[/?#]|$)/i;
        await Promise.all([
            page.waitForURL((url) => runtimeUrlPattern.test(url.toString()), { timeout: timeoutMs }),
            page.locator('.folder-btn-submit').first().click({ timeout: timeoutMs })
        ]);

        await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await waitForSettingsShell(page);
        const savedFolders = await readFoldersFromSettingsPage(page, type);
        const savedFolderEntry = findFolderEntriesByName(savedFolders, folderName)[0] || null;
        if (!savedFolderEntry) {
            throw new Error(`Saved smoke folder was not found after create: ${folderName}`);
        }
        const savedFolder = savedFolderEntry.folder || {};
        const savedActions = Array.isArray(savedFolder.actions) ? savedFolder.actions : [];
        if (savedActions.length !== 1 || String(savedActions[0]?.name || '').trim() !== savedActionName) {
            throw new Error(`Saved smoke folder actions mismatch: ${JSON.stringify(savedActions)}`);
        }
        const expectedSavedOrder = previewOrder.length > 0 ? previewOrder : selectedMembers;
        if (expectedSavedOrder.length > 0) {
            const savedContainers = Array.isArray(savedFolder.containers) ? savedFolder.containers.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
            const savedLeadingOrder = savedContainers.slice(0, expectedSavedOrder.length);
            if (savedLeadingOrder.length !== expectedSavedOrder.length
                || !savedLeadingOrder.every((entry, index) => entry === expectedSavedOrder[index])) {
                throw new Error(`Saved member order mismatch. expected=${JSON.stringify(expectedSavedOrder)} actual=${JSON.stringify(savedContainers)}`);
            }
        }

        cleanupDetails = await cleanupSmokeFolder(page, {
            settingsUrl,
            type,
            folderName
        });

        return {
            skipped: false,
            pass: true,
            folderName,
            selectedMembers,
            previewOrder,
            reorderSkippedReason,
            savedActionName,
            cleanupDetails,
            screenshotPath
        };
    } catch (error) {
        try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
            // best effort
        }
        try {
            cleanupDetails = await cleanupSmokeFolder(page, {
                settingsUrl,
                type,
                folderName
            });
        } catch (cleanupError) {
            throw new Error(
                `Folder editor interaction smoke failed for ${type} (${browserName}): ${error.message}. `
                + `Cleanup also failed: ${cleanupError.message}. Screenshot: ${screenshotPath}`
            );
        }
        throw new Error(
            `Folder editor interaction smoke failed for ${type} (${browserName}): ${error.message}. `
            + `Cleanup: ${JSON.stringify(cleanupDetails)}. Screenshot: ${screenshotPath}`
        );
    }
};

const runFolderEditorToggleSmoke = async (page, { browserName, settingsUrl, type }) => {
    const settingId = `#${type}-folder-editor-modern`;
    const expectedPageType = type === 'vm' ? 'vm' : 'docker';
    const editorUrlBase = resolveFolderEditorUrl(settingsUrl, expectedPageType);
    if (!editorUrlBase) {
        const message = `Folder editor mode smoke skipped for ${type} (${browserName}): could not derive folder editor URL from ${settingsUrl}`;
        if (requireFolderEditorCoverage) {
            throw new Error(`${message} [required by FVPLUS_BROWSER_SMOKE_REQUIRE_FOLDER_EDITOR=1]`);
        }
        console.warn(message);
        return {
            browserName,
            type,
            skipped: true,
            pass: false,
            reason: 'Could not derive folder editor URL.'
        };
    }

    const statesVisited = [];
    const verifyEditorMode = async (expectedMode) => {
        const editorUrl = `${editorUrlBase}${editorUrlBase.includes('?') ? '&' : '?'}smoke=${Date.now()}`;
        await page.goto(editorUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const details = await waitForFolderEditorReady(page, {
            type: expectedPageType,
            expectedMode
        });
        if (details.pageType !== expectedPageType) {
            throw new Error(`Folder editor page type mismatch for ${type} (${browserName}). Got ${JSON.stringify(details)}.`);
        }
        if (details.pageMode !== expectedMode || details.resolvedMode !== expectedMode) {
            throw new Error(`Folder editor mode mismatch for ${type} (${browserName}). Expected ${expectedMode}, got ${JSON.stringify(details)}.`);
        }
        statesVisited.push(details);
        return details;
    };

    await page.goto(settingsUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForSettingsShell(page);
    const setting = page.locator(settingId).first();
    if (await setting.count() !== 0) {
        throw new Error(`Legacy folder editor toggle should not be present for ${type} (${browserName}): ${settingId}`);
    }

    await verifyEditorMode('modern');
    const interactionReport = await runFolderEditorInteractionSmoke(page, {
        browserName,
        settingsUrl,
        type: expectedPageType
    });

    return {
        browserName,
        type,
        skipped: false,
        pass: true,
        statesVisited,
        interactionReport
    };
};

const runBrowserSmoke = async (browserName, browserType) => {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: ignoreHttpsErrors });
    const page = await context.newPage();
    page.on('dialog', (dialog) => {
        console.warn(`Browser smoke dialog accepted (${browserName}): ${dialog.type()} ${dialog.message()}`);
        void dialog.accept().catch(() => {});
    });
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await waitForSettingsShell(page);

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

        const nativeOrganizerReport = await runNativeOrganizerDiagnosticsSmoke(page, {
            browserName,
            settingsUrl: targetUrl
        });
        if (nativeOrganizerReport) {
            nativeOrganizerDiagnosticsReports.push(nativeOrganizerReport);
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
            console.log(`Runtime visual target: ${entry.type} -> ${entry.url}`);
        });
    } else {
        console.log('Runtime visual target: none (set FVPLUS_BROWSER_SMOKE_DOCKER_URL/FVPLUS_BROWSER_SMOKE_VM_URL or use settings URL auto-derivation).');
    }
    console.log(`Dashboard quick-rail target: ${dashboardUrl || 'none'}`);
    console.log(`Browser smoke artifacts directory: ${artifactRoot}`);
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
        nativeOrganizerDiagnosticsReports,
        folderEditorReports
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
