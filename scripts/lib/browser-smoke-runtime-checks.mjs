export const createRuntimeLayoutSmoke = ({
    timeoutMs, runtimeGapMinOverride, runtimeGapMaxOverride, captureLiveScreenshot,
    sanitizeToken, scenarioLabel, requireRuntimeRows
}) => {
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
    const screenshotPath = await captureLiveScreenshot(page, screenshotName);

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
    return { runRuntimeLayoutSmoke };
};
