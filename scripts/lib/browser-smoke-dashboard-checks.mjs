export const createDashboardSmokeChecks = ({ timeoutMs, captureLiveScreenshot, sanitizeToken, scenarioLabel }) => {
const runDashboardQuickRailSmoke = async (page, { browserName, url }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1200);

    const report = await page.evaluate(() => {
        const widgetSelectors = {
            docker: {
                rail: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="docker"] .fv-dashboard-layout-quick-rail',
                button: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="docker"] [data-fv-quick-action="layout-menu"]',
                tbody: 'tbody#docker_view'
            },
            vm: {
                rail: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="vm"] .fv-dashboard-layout-quick-rail',
                button: '.fv-dashboard-layout-inline-host[data-fv-dashboard-type="vm"] [data-fv-quick-action="layout-menu"]',
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
    const screenshotPath = await captureLiveScreenshot(page, screenshotName);

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
        const button = rail.locator('[data-fv-quick-action="layout-menu"]').first();
        if (await button.count() === 0) {
            continue;
        }
        const visitedLayouts = [];
        for (const requestedLayout of ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed']) {
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
            if (snapshot.railVisible !== true) {
                throw new Error(`Dashboard quick rail hidden while selecting ${requestedLayout} for ${type}. Screenshot: ${screenshotPath}`);
            }
            await button.click({ timeout: timeoutMs });
            const layoutSelect = page.locator(`.fv-dashboard-view-popover[data-fv-dashboard-type="${type}"] [data-fv-layout-select]`).first();
            await layoutSelect.selectOption(requestedLayout, { timeout: timeoutMs });
            await page.waitForTimeout(220);
            const appliedLayout = await page.locator(type === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view').getAttribute('data-fv-dashboard-layout');
            visitedLayouts.push(String(appliedLayout || '').trim().toLowerCase());
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
    return { runDashboardQuickRailSmoke, runDashboardAdvancedPreviewSmoke };
};
