import assert from 'node:assert/strict';

export const verifyAuroraHeaderBeforeRuntime = async (page, hostUrl) => {
    for (const theme of ['aurora', 'native', 'neoraid']) {
        let releaseRuntime, runtimeFinished;
        const gate = new Promise(resolve => { releaseRuntime = resolve; });
        const finished = new Promise(resolve => { runtimeFinished = resolve; });
        const runtimePattern = '**/plugins/folderview.plus/scripts/docker.js?*';
        await page.route(runtimePattern, async route => {
            try { await gate; await route.fulfill({ contentType: 'text/javascript', body: '' }); }
            finally { runtimeFinished(); }
        });
        const pageUrl = `${hostUrl}/docker?fixtureHeaderBoot=${theme}`;
        await page.route(pageUrl, async route => {
            const response = await route.fetch();
            const link = theme === 'aurora' ? '/plugins/Aurora-Theme/styles/theme.css'
                : theme === 'neoraid' ? '/plugins/neoraid/sheets/Neoraid.css' : '';
            const html = (await response.text()).replace('<head>', `<head>${link ? `<link rel="stylesheet" href="${link}">` : ''}`);
            await route.fulfill({ response, body: html });
        });
        try {
            await page.goto(pageUrl, { waitUntil: 'commit' });
            await page.waitForFunction(() => document.querySelector('script[data-fvplus-docker-runtime="true"]'));
            const result = await page.evaluate(async () => {
                const makeHeading = () => {
                    const heading = document.createElement('div'); heading.className = 'tp-heading';
                    heading.innerHTML = '<div class="tp-heading-text"><p>Applications</p><h1>Docker</h1><p>Manage containers</p><button class="tp-fv-beta">FolderView Plus support Beta</button></div>';
                    return heading;
                };
                const box = document.createElement('div'); box.id = 'displaybox'; box.append(makeHeading()); document.body.prepend(box);
                const header = document.createElement('div'); header.id = 'header';
                header.innerHTML = '<div class="tp-crumb"><button class="tp-fv-beta">FolderView Plus support Beta</button></div>'; document.body.prepend(header);
                const frames = [];
                for (let index = 0; index < 3; index++) {
                    if (index === 1) document.querySelector('#displaybox > .tp-heading').replaceWith(makeHeading());
                    await new Promise(requestAnimationFrame);
                    frames.push({ heading: getComputedStyle(document.querySelector('#displaybox > .tp-heading')).display,
                        beta: getComputedStyle(document.querySelector('#header .tp-fv-beta:not(.tp-fv-conflict)')).display });
                }
                return { frames, runtimeStarted: document.body.hasAttribute('data-fvplus-docker-page-view'),
                    earlyStyle: [...document.querySelectorAll('link[rel="stylesheet"]')].some(link =>
                        link.href.includes('/styles/docker.header.css') && link.media !== 'not all') };
            });
            assert.equal(result.runtimeStarted, false, 'main Docker runtime remains deliberately withheld');
            assert.equal(result.earlyStyle, true, 'header stylesheet is active independently of legacy runtime styles');
            assert.equal(result.frames.every(frame => theme === 'aurora'
                ? frame.heading === 'none' && frame.beta === 'none'
                : frame.heading !== 'none' && frame.beta !== 'none'), true, `${theme}: visibility is correct before every sampled paint`);
        } finally {
            releaseRuntime(); await finished;
            await page.waitForLoadState('load'); await page.evaluate(() => window.FolderViewPlusI18n?.ready);
            await page.unroute(pageUrl); await page.unroute(runtimePattern);
        }
    }
};
