import path from 'node:path';
import process from 'node:process';

const split = (value) => String(value || '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);

export const readFixtureBrowserConfig = (rootDir) => ({
    artifactDir: path.resolve(
        process.env.FVPLUS_FIXTURE_BROWSER_ARTIFACT_DIR || path.join(rootDir, 'tmp', 'fixture-browser-artifacts')
    ),
    timeoutMs: Math.max(5000, Number(process.env.FVPLUS_FIXTURE_BROWSER_TIMEOUT_MS) || 20000),
    requestedBrowsers: split(process.env.FVPLUS_FIXTURE_BROWSERS || 'chromium'),
    colorSchemes: split(process.env.FVPLUS_FIXTURE_COLOR_SCHEMES || 'dark')
        .filter((value) => ['light', 'dark', 'no-preference'].includes(value)),
    viewports: split(process.env.FVPLUS_FIXTURE_VIEWPORTS || '1180x720')
        .map((value) => value.match(/^(\d{3,4})x(\d{3,4})$/))
        .filter(Boolean)
        .map((match) => ({ width: Number(match[1]), height: Number(match[2]) })),
    accessibilityEnabled: !/^(0|false|no|off)$/i.test(String(process.env.FVPLUS_FIXTURE_ACCESSIBILITY || '1'))
});
