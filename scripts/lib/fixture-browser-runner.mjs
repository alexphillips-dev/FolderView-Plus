import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const runFixtureBrowserSuite = async ({
    fixtureServer, tests, requestedBrowsers, browserTypes, timeoutMs, accessibilityEnabled,
    axeScriptPath, artifactDir, rootDir
}) => {
const slug = (value) => String(value || 'test').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    browsers: requestedBrowsers,
    tests: [],
    passed: 0,
    failed: 0
};

let exitCode = 0;
try {
    for (const browserName of requestedBrowsers) {
        const browserType = browserTypes[browserName];
        if (!browserType) {
            throw new Error(`Unsupported fixture browser: ${browserName}`);
        }
        const browser = await browserType.launch({ headless: true });
        try {
            for (const entry of tests) {
                const context = await browser.newContext({ viewport: { width: 1180, height: 720 }, colorScheme: 'dark' });
                const page = await context.newPage();
                page.setDefaultTimeout(timeoutMs);
                const browserErrors = [];
                page.on('pageerror', (error) => browserErrors.push(`pageerror: ${String(error?.stack || error)}`));
                page.on('console', (message) => {
                    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
                });
                const startedAt = Date.now();
                const result = { browser: browserName, name: entry.name, durationMs: 0, pass: false, errors: [] };
                try {
                    await entry.handler({ page, context, browserName });
                    if (accessibilityEnabled && entry.skipAccessibility !== true) {
                        await page.addScriptTag({ path: axeScriptPath });
                        const violations = await page.evaluate(async () => {
                            const result = await window.axe.run(document, {
                                runOnly: {
                                    type: 'tag',
                                    values: ['wcag2a', 'wcag2aa', 'wcag21aa']
                                },
                                resultTypes: ['violations']
                            });
                            return result.violations
                                .filter((violation) => ['critical', 'serious'].includes(String(violation.impact || '')))
                                .map((violation) => ({
                                    id: violation.id,
                                    impact: violation.impact,
                                    help: violation.help,
                                    nodes: violation.nodes.slice(0, 5).map((node) => ({
                                        target: node.target,
                                        summary: node.failureSummary,
                                        html: node.html
                                    }))
                                }));
                        });
                        assert.deepEqual(violations, [], `axe accessibility violations:\n${JSON.stringify(violations, null, 2)}`);
                    }
                    assert.deepEqual(browserErrors, [], `browser emitted errors:\n${browserErrors.join('\n')}`);
                    result.pass = true;
                    report.passed += 1;
                    console.log(`PASS [${browserName}] ${entry.name}`);
                } catch (error) {
                    exitCode = 1;
                    report.failed += 1;
                    result.errors.push(String(error?.stack || error));
                    result.errors.push(...browserErrors);
                    const screenshotPath = path.join(artifactDir, `${slug(browserName)}-${slug(entry.name)}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
                    result.screenshot = path.relative(rootDir, screenshotPath).replaceAll('\\', '/');
                    console.error(`FAIL [${browserName}] ${entry.name}`);
                    console.error(result.errors.join('\n'));
                } finally {
                    result.durationMs = Date.now() - startedAt;
                    report.tests.push(result);
                    await context.close();
                }
            }
        } finally {
            await browser.close();
        }
    }
} finally {
    await new Promise((resolve) => fixtureServer.close(resolve));
    fs.writeFileSync(path.join(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`Fixture browser suite: ${report.passed} passed, ${report.failed} failed.`);
process.exitCode = exitCode;
};
