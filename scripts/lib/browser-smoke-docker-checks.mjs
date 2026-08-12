export const createDockerSmokeChecks = ({ timeoutMs, captureLiveScreenshot, sanitizeToken, scenarioLabel }) => {
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
    const screenshotPath = await captureLiveScreenshot(page, screenshotName);

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
    const screenshotPath = await captureLiveScreenshot(page, screenshotName);

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
    return { runDockerDiagnosticsSmoke, runDockerUpdateFlowSmoke, runDockerPreviewStatusSmoke };
};
