import assert from 'node:assert/strict';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';
import { holdDockerSnapshotWithToolbar, readDockerPrivacyStyle } from '../helpers/quick-finder-toolbar.mjs';

const search = async (page, name) => {
    if (!(await page.locator('.fv-quickfinder input').isEnabled())) await page.locator('[data-finder-toggle]').click();
    await page.locator('.fv-quickfinder input').fill(name);
    await page.waitForFunction(expected => document.querySelector('.fv-quickfinder-name')?.textContent === expected, name);
};

export const registerQuickFinderControlCases = ({ test, baseUrl }) => {
    test('Quick finder hover and pointer focus keep one neutral search field border', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html`);
        await page.locator('[data-finder-toggle]').hover();
        assert.equal(await page.locator('[data-finder-toggle]').evaluate(node => getComputedStyle(node).borderTopColor), 'rgba(0, 0, 0, 0)');
        assert.equal(await page.locator('.fv-quickfinder-field').evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
        await page.locator('[data-finder-toggle]').click();
        await page.locator('.fv-quickfinder input').click();
        const field = await page.locator('.fv-quickfinder-field').evaluate(node => {
            const style = getComputedStyle(node);
            const probe = document.createElement('span'); probe.style.color = 'var(--fvplus-ui-accent)'; node.append(probe);
            const accent = getComputedStyle(probe).color; probe.remove();
            return { border: style.borderTopColor, shadow: style.boxShadow, accent };
        });
        assert.notEqual(field.border, field.accent);
        assert.equal(field.shadow, 'none');
        await page.locator('[data-finder-close]').hover();
        assert.equal(await page.locator('[data-finder-close]').evaluate(node => getComputedStyle(node).borderTopColor), 'rgba(0, 0, 0, 0)');
        await page.keyboard.press('Escape');
        await page.locator('#outside').focus();
        await page.locator('[data-finder-toggle]').press('Tab');
        await page.locator('[data-finder-toggle]').focus();
        assert.equal(await page.locator('[data-finder-toggle]').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
        assert.equal(await page.locator('.fv-quickfinder').evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
        await page.locator('.fv-quickfinder-field').evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
        assert.equal(await page.locator('.fv-quickfinder-field').evaluate(node => getComputedStyle(node).borderTopColor), await page.locator('.fv-quickfinder-field').evaluate(node => getComputedStyle(node).color));
    });

    test('Quick finder production Docker shortcuts use native running state, WebUI and shell metadata', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        host.runtime['fixture-app-0'].info.State.WebUi = 'https://example.com/fixture-webui';
        host.runtime['fixture-app-0'].info.Shell = '/bin/bash';
        const releaseSnapshot = await holdDockerSnapshotWithToolbar(page);
        const privacyStyle = () => readDockerPrivacyStyle(page);
        try {
            await page.goto(host.url, { waitUntil: 'domcontentloaded' });
            await page.locator('.fvplus-docker-runtime-privacy-menu-button').waitFor();
            assert.equal(await page.locator('[data-finder-toggle]').isVisible(), true, 'Finder must mount with Privacy while folder data is pending');
            assert.equal(await page.locator('#docker_list tr.folder').count(), 0);
            const initialPrivacy = await privacyStyle();
            assert.equal(initialPrivacy.border, '0px');
            assert.equal(initialPrivacy.background, 'rgba(0, 0, 0, 0)');
            assert.equal(initialPrivacy.color, initialPrivacy.accent);
            releaseSnapshot();
            await page.waitForFunction(() => document.querySelector('#docker_list tr.folder'));
            await page.waitForLoadState('networkidle');
            assert.deepEqual(await privacyStyle(), initialPrivacy, 'Finder hydration must not restyle sibling controls');
            await page.locator('.fvplus-docker-runtime-privacy-menu-button').hover();
            assert.deepEqual(await privacyStyle(), initialPrivacy);
            await page.locator('.fvplus-docker-runtime-privacy-menu-button').click();
            assert.equal(await page.locator('#fvplus-docker-runtime-privacy-menu').isVisible(), true);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#fvplus-docker-runtime-privacy-menu').isVisible(), false);
            await page.evaluate(() => {
                window.fixtureTerminalCalls = []; window.fixtureWebuiCalls = [];
                window.openTerminal = (...args) => window.fixtureTerminalCalls.push(args);
                document.addEventListener('click', event => {
                    const anchor = event.target.closest?.('a[target="_blank"]');
                    if (anchor) { event.preventDefault(); window.fixtureWebuiCalls.push(anchor.href); }
                });
            });
            await search(page, 'fixture-app-0');
            assert.equal(await page.locator('.fv-quickfinder-status').textContent(), 'Running');
            assert.equal(await page.locator('.fv-quickfinder-container-result > .outer.fv-docker-preview-mode-1').count(), 1);
            assert.equal(await page.locator('.fv-quickfinder-container-result .inner .appname [data-finder-select]').count(), 1);
            assert.deepEqual(await page.locator('.fv-quickfinder-container-result .inner [data-finder-action]').allTextContents(), ['', '', '']);
            assert.equal(await page.locator('.fv-quickfinder-container-result [id], .fv-quickfinder-container-result [data-fv-onerror]').count(), 0);
            assert.equal(await page.locator('[data-finder-action="webui"]').isEnabled(), true);
            assert.equal(await page.locator('[data-finder-action="console"]').isEnabled(), true);
            assert.equal(await page.locator('[data-finder-action="logs"]').isEnabled(), true);
            await page.locator('[data-finder-action="webui"]').click();
            assert.deepEqual(await page.evaluate(() => window.fixtureWebuiCalls), ['https://example.com/fixture-webui']);
            await search(page, 'fixture-app-0');
            await page.locator('[data-finder-action="console"]').click();
            await search(page, 'fixture-app-0');
            await page.locator('[data-finder-action="logs"]').click();
            assert.deepEqual(await page.evaluate(() => window.fixtureTerminalCalls), [['docker', 'fixture-app-0', '/bin/bash'], ['docker', 'fixture-app-0', '.log']]);
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
        } finally { releaseSnapshot(); await host.close(); }
    }, { skipAccessibility: true });

    test('Quick finder keeps unavailable Docker shortcuts visible and logs usable for stopped containers', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html`);
        await search(page, 'Mosquitto');
        assert.equal(await page.locator('[data-finder-action="reveal"]').count(), 0);
        const badge = await page.locator('.fv-quickfinder-status').evaluate(node => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.fillStyle = getComputedStyle(node).color;
            context.fillRect(0, 0, 1, 1);
            return { size: parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(node.parentElement).fontSize), color: Array.from(context.getImageData(0, 0, 1, 1).data) };
        });
        assert.ok(badge.size > 0.9 && badge.size < 1);
        const [red, green, blue] = badge.color;
        assert.ok(red > green + 20 && red > blue + 20);
        assert.equal(await page.locator('[data-finder-action="webui"]').isDisabled(), true);
        assert.equal(await page.locator('[data-finder-action="console"]').isDisabled(), true);
        assert.equal(await page.locator('[data-finder-action="logs"]').isEnabled(), true);
        await page.locator('[data-finder-action="logs"]').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureFinder.events.find(event => event.action === 'terminal').args), ['docker', 'Mosquitto', '.log']);
        await search(page, 'Assistant');
        await page.evaluate(() => { window.fixtureFinder.runtime.Assistant.webui = 'javascript:alert(1)'; window.fixtureFinder.refresh(); });
        assert.equal(await page.locator('[data-finder-action="webui"]').isDisabled(), true);
        assert.equal(await page.locator('[data-finder-action="console"]').isEnabled(), true);
        await page.evaluate(() => { delete window.openTerminal; window.fixtureFinder.refresh(); });
        assert.equal(await page.locator('[data-finder-action="console"]').isDisabled(), true);
        assert.equal(await page.locator('[data-finder-action="logs"]').isDisabled(), true);
        await page.locator('.fv-quickfinder-popover').evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    });
};
