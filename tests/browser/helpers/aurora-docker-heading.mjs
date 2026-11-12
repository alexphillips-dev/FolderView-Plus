import assert from 'node:assert/strict';
import { createPageTitleHost } from './page-title-host.mjs';
import { verifyAuroraHeaderBeforeRuntime } from './aurora-docker-header-bootstrap.mjs';

export const verifyAuroraDockerHeading = async (page, baseUrl) => {
    const host = await createPageTitleHost(page);
    await page.route('**/plugins/Aurora-Theme/styles/theme.css', route => route.fulfill({ contentType: 'text/css', body: '.tp-heading{margin:1.4rem 0 2.4rem}button.tp-fv-beta{display:inline-flex}' }));
    await page.route('**/plugins/neoraid/sheets/Neoraid.css', route => route.fulfill({ contentType: 'text/css', body: 'body{--fixture-neoraid:1}' }));
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        if (new URL(location.href).searchParams.has('fixtureHeaderBoot')) return;
        const canvas = document.getElementById('docker_containers')?.closest('.canvas');
        if (!canvas) return;
        const box = document.createElement('div'); box.id = 'displaybox'; canvas.before(box); box.append(canvas);
        const makeHeading = () => {
            const heading = document.createElement('div'); heading.className = 'tp-heading';
            const text = document.createElement('div'); text.className = 'tp-heading-text';
            for (const [tag, value] of [['p', 'Applications'], ['h1', 'Docker'], ['p', 'Manage containers, review resource use, and keep services healthy.']]) {
                const node = document.createElement(tag); node.textContent = value; text.append(node);
            }
            const beta = document.createElement('button'); beta.className = 'tp-fv-beta'; beta.textContent = 'FolderView Plus support Beta'; text.append(beta);
            heading.append(text); return heading;
        };
        box.prepend(makeHeading()); window.fixtureAuroraHeading = makeHeading;
        const header = document.createElement('div'); header.id = 'header';
        const crumb = document.createElement('div'); crumb.className = 'tp-crumb';
        for (const conflict of [false, true]) {
            const beta = document.createElement('button'); beta.className = `tp-fv-beta${conflict ? ' tp-fv-conflict' : ''}`;
            beta.textContent = conflict ? 'Folder plugin conflict' : 'FolderView Plus support Beta'; crumb.append(beta);
        }
        header.append(crumb); document.body.prepend(header);
    }));
    try {
        for (const [colorScheme, viewport] of [['dark', { width: 1180, height: 720 }], ['light', { width: 390, height: 844 }]]) {
            await page.emulateMedia({ colorScheme }); await page.setViewportSize(viewport);
            await verifyAuroraHeaderBeforeRuntime(page, host.baseUrl);
            await page.goto(`${host.baseUrl}/docker`);
            await page.waitForFunction(() => document.body.hasAttribute('data-fvplus-docker-page-view'));
            const heading = page.locator('#displaybox > .tp-heading'), beta = page.locator('#header .tp-crumb > .tp-fv-beta:not(.tp-fv-conflict)');
            assert.equal(await heading.isVisible(), true, 'native heading is preserved');
            assert.equal(await beta.isVisible(), true, 'native button with the same class is preserved');
            await page.evaluate(() => {
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/plugins/Aurora-Theme/styles/theme.css'; link.id = 'fixture-aurora-theme'; document.head.append(link);
            });
            await page.waitForFunction(() => document.documentElement.classList.contains('fvplus-docker-hide-aurora-heading'));
            assert.equal(await heading.isHidden(), true, 'Aurora heading including its support chip is hidden');
            assert.equal(await beta.isHidden(), true, 'duplicate topbar beta chip is hidden');
            assert.equal(await page.locator('#header .tp-fv-conflict').isVisible(), true, 'conflict warning is retained');
            assert.equal(await page.locator('#docker_containers').isVisible(), true, 'Docker controls remain visible');
            await page.evaluate(() => { document.querySelector('#displaybox > .tp-heading').replaceWith(window.fixtureAuroraHeading()); });
            assert.equal(await heading.isHidden(), true, 'late Aurora replacement is hidden without a DOM observer');
            await page.evaluate(() => document.getElementById('fixture-aurora-theme').remove());
            await page.waitForFunction(() => !document.documentElement.classList.contains('fvplus-docker-hide-aurora-heading'));
            assert.equal(await heading.isVisible(), true, 'heading restores when Aurora is removed');
            assert.equal(await beta.isVisible(), true, 'beta chip restores with theme removal');
            await page.evaluate(() => {
                document.documentElement.classList.add('nr'); const link = document.createElement('link');
                link.rel = 'stylesheet'; link.href = '/plugins/neoraid/sheets/Neoraid.css'; document.head.append(link);
                window.dispatchEvent(new CustomEvent('folderviewplus:theme-change'));
            });
            await page.waitForFunction(() => window.FolderViewPlusFoundationModules.themeIntegration.readHostIdentity(document, window).name === 'NeoRaid');
            assert.equal(await heading.isVisible(), true, 'NeoRaid heading is preserved');
            assert.equal(await beta.isVisible(), true, 'NeoRaid support chip is preserved');
        }
    } finally { await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await host.close(); await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' }); }
};
