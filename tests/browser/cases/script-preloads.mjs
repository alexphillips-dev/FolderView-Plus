import { verifySettingsPreloads, verifyDashboardPreloads } from '../helpers/script-preloads.mjs';
import { verifyDockerPreload } from '../helpers/docker-script-preload.mjs';

export const registerScriptPreloadCases = ({ test, baseUrl }) => {
    const injectedFailure = { allowedConsoleErrors: [/^console: Failed to load resource:.*503/] };
    test('Settings script downloads overlap within each stage and retry preserves execution order', async ({ page }) => {
        await verifySettingsPreloads({ page, baseUrl });
    }, injectedFailure);
    test('Docker runtime preloads during preparation while compatibility overrides and exit gate execution', async ({ page }) => {
        await verifyDockerPreload({ page, baseUrl });
    });
    test('Dashboard chart requests stay lazy and download together with ordered retryable execution', async ({ page }) => {
        await verifyDashboardPreloads({ page, baseUrl });
    }, injectedFailure);
};
