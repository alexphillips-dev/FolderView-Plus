import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const targetUrl = String(process.env.FVPLUS_BROWSER_SMOKE_URL || '').trim();
const timeoutMs = Number.isFinite(Number(process.env.FVPLUS_BROWSER_SMOKE_TIMEOUT_MS))
    ? Math.max(5000, Number(process.env.FVPLUS_BROWSER_SMOKE_TIMEOUT_MS))
    : 45000;
const ignoreHttpsErrors = String(process.env.FVPLUS_BROWSER_SMOKE_IGNORE_HTTPS || '1').trim() !== '0';

if (!targetUrl) {
    console.log('Skipping browser smoke checks (FVPLUS_BROWSER_SMOKE_URL not set).');
    process.exit(0);
}

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

        console.log(`Browser smoke passed: ${browserName}`);
    } finally {
        await context.close();
        await browser.close();
    }
};

try {
    await runBrowserSmoke('chromium', playwright.chromium);
    await runBrowserSmoke('firefox', playwright.firefox);
    await runBrowserSmoke('webkit', playwright.webkit);
} finally {
    try {
        fs.unlinkSync(tempImportPath);
    } catch {
        // best effort cleanup
    }
}
