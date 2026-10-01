import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyAlertsColumnAlignment, verifyCompactHealthDetails } from '../helpers/settings-alerts-health-layout.mjs';

const settingsSource = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', 'utf8');
const start = settingsSource.indexOf('            const updateButtonHtml = updateCount > 0');
const end = settingsSource.indexOf('        } else {', start);
const rowSource = settingsSource.slice(start, end);

export const registerSettingsAlertsHealthCase = ({ test, baseUrl }) => {
    test('Settings alerts center icons, hide update-free buttons and show readable health details', async ({ page }) => {
        assert.ok(start > 0 && end > start);
        await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.row-details.js` });
        await page.addStyleTag({ content: '.sweet-alert { position: fixed; text-align: center; } .sweet-alert p { text-align: center; } button { letter-spacing: 2px; } button i { margin-right: 5px; } .fa-heartbeat::before { content: "♥"; } .fa-exclamation-circle::before { content: "!"; } .sa-button-container { margin-top: 14px; }' });
        await page.addStyleTag({ content: 'html { font-size: 10px; } .sweet-alert p { white-space: pre-line; } .sweet-alert dt { float: right; text-align: right; } .sweet-alert dd { float: left; margin-left: 40px; flex-direction: column; } .sweet-alert small { display: block; } .signals-cell { width: 240px; }' });
        await page.evaluate((source) => {
            const theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
            document.body.dataset.fvThemeClass = theme;
            document.querySelector('#fv-settings-root').dataset.fvThemeClass = theme;
            const build = new Function('input', `const { updateCount, updateClass, updateIcon, dockerUpdatesOnlyFilter, updateTitle, type, id, safeNameText, healthStatus, healthFilterActive, healthTitle, escapeHtml } = input; let typeSpecificColumns; ${source}; return typeSpecificColumns;`);
            const host = document.createElement('div');
            host.className = 'folder-table';
            document.querySelector('#fv-settings-root').prepend(host);
            window.fixtureAlerts = (updateCount) => {
                host.innerHTML = `<table><tbody><tr>${build({ updateCount, updateClass: 'is-warning', updateIcon: 'fa-exclamation-circle', dockerUpdatesOnlyFilter: false, updateTitle: 'Updates available', type: 'docker', id: 'test', safeNameText: 'Test', healthStatus: { className: 'is-ok', text: 'Healthy', filterSeverity: 'good' }, healthFilterActive: false, healthTitle: 'Healthy', escapeHtml: (value) => String(value) })}</tr></tbody></table>`;
            };
            window.fixtureHealth = (severity, long = false) => {
                document.querySelector('.fv-health-details-modal')?.remove();
                window.FolderViewPlusRowDetails.createApi({
                    getFolderMap: () => ({ test: { name: long ? 'Long folder name '.repeat(10) : 'Audiobooks' } }),
                    getEffectiveMemberSnapshot: () => ({ test: { members: ['a', 'b'] } }),
                    getItemRuntimeStateKind: () => 'started',
                    evaluateDockerFolderHealth: () => ({ text: severity === 'good' ? 'Healthy' : severity === 'warn' ? 'Warning' : 'Critical', severity, score: 85, policy: { profile: 'balanced', updatesMode: 'maintenance', allStoppedMode: 'critical', warnThreshold: 60, warnSource: 'global-warn', criticalThreshold: 90, criticalSource: 'global-critical' }, reasons: Array.from({ length: long ? 18 : 1 }, () => ({ label: 'Runtime', message: 'No health issues detected.' })) }),
                    swal: (options) => {
                        const modal = document.createElement('div');
                        modal.className = `sweet-alert ${options.customClass}`;
                        const title = document.createElement('h2'); title.textContent = options.title;
                        const body = document.createElement('p'); body.innerHTML = options.text;
                        const footer = document.createElement('div'); footer.className = 'sa-button-container';
                        footer.innerHTML = '<button type="button">Filter</button><button type="button">Close</button>';
                        modal.append(title, body, footer); document.body.append(modal);
                    }
                }).showFolderHealthBreakdown('docker', 'test');
            };
        }, rowSource);
        for (const count of [0, 1, 10, 0]) {
            await page.evaluate((value) => window.fixtureAlerts(value), count);
            assert.equal(await page.locator('.signals-cell .updates-chip').count(), count > 0 ? 1 : 0);
            assert.equal(await page.locator('.signals-cell .health-breakdown-btn').count(), 1);
            await verifyAlertsColumnAlignment(page);
            const geometry = await page.locator('.signals-cell button:has(> i)').evaluateAll((buttons) => buttons.map((button) => {
                const rect = button.getBoundingClientRect(); const icon = button.querySelector('i').getBoundingClientRect();
                return { x: Math.abs(rect.x + rect.width / 2 - icon.x - icon.width / 2), y: Math.abs(rect.y + rect.height / 2 - icon.y - icon.height / 2) };
            }));
            for (const icon of geometry) { assert.ok(icon.x < 1); assert.ok(icon.y < 1); }
        }
        for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 720 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.evaluate(() => window.fixtureHealth('good'));
            await verifyCompactHealthDetails(page);
            const tones = [];
            for (const severity of ['good', 'warn', 'critical']) {
                await page.evaluate((value) => window.fixtureHealth(value, true), severity);
                const layout = await page.locator('.fv-health-details-modal').evaluate((modal) => {
                    const box = modal.getBoundingClientRect(); const body = modal.querySelector('p'); const footer = modal.querySelector('.sa-button-container').getBoundingClientRect();
                    return { x: box.x, right: box.right, bottom: box.bottom, viewport: innerWidth, align: getComputedStyle(body).textAlign, scrolls: body.scrollHeight > body.clientHeight, footer: footer.bottom, tone: getComputedStyle(modal.querySelector('.fv-health-details-status')).color };
                });
                assert.ok(layout.x >= 0 && layout.right <= layout.viewport);
                assert.ok(layout.bottom <= 720 && layout.footer <= 720);
                assert.equal(layout.align, 'start');
                assert.equal(layout.scrolls, true);
                tones.push(layout.tone);
                await page.locator('.fv-health-details-modal button').last().focus();
                assert.equal(await page.locator('.fv-health-details-modal button').last().evaluate((el) => document.activeElement === el), true);
            }
            assert.equal(new Set(tones).size, 3, 'health severities must have distinct colors');
            await page.evaluate(() => { document.documentElement.dir = 'rtl'; window.fixtureHealth('good'); });
            assert.equal(await page.locator('.fv-health-details').evaluate((el) => getComputedStyle(el).direction), 'rtl');
            const rtlBox = await page.locator('.fv-health-details-modal').boundingBox();
            assert.ok(rtlBox.x >= 0 && rtlBox.x + rtlBox.width <= width, 'RTL dialog must fit the viewport');
        }
        await page.screenshot({ path: 'tmp/fixture-browser-artifacts/settings-health-details.png' });
    }, { skipAccessibility: true });
};
