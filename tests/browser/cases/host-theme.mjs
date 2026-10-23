import assert from 'node:assert/strict';
import { installHost, switchHost, expectAccent } from '../helpers/host-theme.mjs';
import { registerHostThemeMatrixCases } from './host-theme-matrix.mjs';
import { registerHostThemeAccessibilityCases } from './host-theme-accessibility.mjs';
import { registerHostThemeMaintainerCases } from './host-theme-maintainer.mjs';

export const registerHostThemeFixtureCases = ({ test, baseUrl }) => {
registerHostThemeMatrixCases({test,baseUrl});
registerHostThemeAccessibilityCases({test,baseUrl});
registerHostThemeMaintainerCases({test,baseUrl});
for (const [surface, route] of [['Docker', 'runtime'], ['VM', 'vm-lifecycle'], ['Dashboard', 'dashboard-layout']]) {
test(`Host theme saved customization survives theme refreshes on ${surface}`, async ({ page }) => {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'load' });
    await installHost(page, baseUrl);
    const layer = await page.addStyleTag({ content: ':root { --fvplus-theme-accent:#c084fc; --fvplus-custom-theme-accent:#c084fc; --fvplus-theme-surface-panel:#202535; --fvplus-custom-theme-surface-panel:#202535; }' });
    await page.evaluate(() => window.fixtureHostBinding.runApply('stylesheet-loaded'));
    await page.waitForFunction(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim() === 'rgb(192, 132, 252)');
    const before = await page.evaluate(() => document.querySelectorAll('tr.folder, [data-folder-id]').length);
    await page.evaluate(() => { document.documentElement.style.setProperty('--link-text-color', '#4f8bff'); window.fixtureHostBinding.runApply('refresh'); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-surface-panel').trim()), 'rgb(32, 37, 53)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim()), 'rgb(192, 132, 252)');
    await page.evaluate(() => { window.fixtureHostMode = 'safe'; window.fixtureHostBinding.runApply('recovery'); });
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim()), 'rgb(192, 132, 252)');
    await page.evaluate(() => { window.fixtureHostMode = 'auto'; window.fixtureHostBinding.runApply('restore'); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim()), 'rgb(192, 132, 252)');
    await layer.evaluate(node => node.remove());
    await page.evaluate(() => window.fixtureHostBinding.runApply('stylesheet-removed'));
    await page.waitForFunction(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim() === 'rgb(79, 139, 255)');
    assert.equal(await page.evaluate(() => document.querySelectorAll('tr.folder, [data-folder-id]').length), before);
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});
}
for (const [surface, route] of [['Docker','runtime'], ['VM','vm-lifecycle'], ['Dashboard','dashboard-layout'], ['Settings','settings'], ['editor','folder-editor']]) {
test(`Host theme CSS only palette follows native surfaces without output feedback on ${surface}`, async ({ page }) => {
    await page.goto(`${baseUrl}/${route}`, { waitUntil:'load' });
    await installHost(page, baseUrl);
    await page.evaluate(() => {
        document.getElementById('fixture-host-css').remove();
        const native=document.createElement('div'); native.id='fixture-css-native'; native.dataset.fvplusThemeNative='surface';
        native.innerHTML='<input type="button" value="Native action" data-fvplus-theme-native="button"><a href="#" data-fvplus-theme-native="link">Native link</a>';
        document.body.append(native);
        const style=document.createElement('style'); style.id='fixture-direct-theme';
        style.textContent='body { background:#111827 !important; color:#f1f5f9 !important; } #fixture-css-native {background:#1e293b; color:#f1f5f9} #fixture-css-native input {background:#1e293b; color:#f1f5f9; font:14px Arial; padding:8px 12px} #fixture-css-native a {color:#93c5fd}';
        document.head.append(style);
        // These are resolved outputs, deliberately different from the native theme inputs.
        document.documentElement.style.setProperty('--fvplus-ui-panel','#ff00ff');
        document.documentElement.style.setProperty('--fvplus-theme-accent','#00ff00');
    });
    for(let pass=0;pass<3;pass++) {
        const snapshot=await page.evaluate(()=>window.fixtureHostBinding.runApply('direct-css-theme'));
        assert.equal(snapshot.hostPaletteApplied,true);
        assert.equal(snapshot.tokens.hostPage,'rgb(17, 24, 39)');
        assert.equal(snapshot.tokens.surfacePanel,'rgb(30, 41, 59)');
        assert.equal(snapshot.tokens.textPrimary,'rgb(241, 245, 249)');
        assert.equal(snapshot.tokens.accent,'rgb(147, 197, 253)');
    }
    await page.evaluate(()=>{
        document.getElementById('fixture-direct-theme').textContent='body {background:#f8fafc !important; color:#111827 !important} #fixture-css-native {background:#fff; color:#111827} #fixture-css-native input {background:#fff; color:#111827; font:14px Arial; padding:8px 12px} #fixture-css-native a {color:#1d4ed8}';
    });
    const light=await page.evaluate(()=>window.fixtureHostBinding.runApply('direct-css-light'));
    assert.equal(light.tokens.hostPage,'rgb(248, 250, 252)');
    assert.equal(light.tokens.surfacePanel,'rgb(255, 255, 255)');
    assert.equal(light.classification,'light');
    for(const mode of ['safe','highcontrast']) {
        const recovery=await page.evaluate(mode=>{window.fixtureHostMode=mode;return window.fixtureHostBinding.runApply('recovery');},mode);
        assert.equal(recovery.hostPaletteApplied,false);
    }
    await page.evaluate(()=>{window.fixtureHostMode='auto';document.getElementById('fixture-direct-theme').remove();document.getElementById('fixture-css-native').remove();});
    const removed=await page.evaluate(()=>window.fixtureHostBinding.runApply('direct-css-removed'));
    assert.notEqual(removed.tokens.hostPage,'rgb(248, 250, 252)');
    assert.notEqual(removed.tokens.accent,'rgb(29, 78, 216)');
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});
}

for (const [surface, route] of [['Docker','runtime'], ['VM','vm-lifecycle'], ['Dashboard','dashboard-layout'], ['Settings','settings'], ['editor','folder-editor']]) {
test(`Host theme stylesheet lifecycle refreshes without root changes on ${surface}`, async ({ page }) => {
    await page.goto(`${baseUrl}/${route}`,{waitUntil:'load'});await installHost(page,baseUrl);
    await page.route('**/fixture-theme-*.css',route=>route.fulfill({contentType:'text/css',body:
        ':root.fixture-host-dark {--background-color:#101624;--table-background-color:#18243a;--text-color:#f1f5f9;--alt-text-color:#b0c4de;--link-text-color:'+(route.request().url().includes('second')?'#93c5fd':'#c4b5fd')+'}'}));
    await page.evaluate(()=>{const link=document.createElement('link');link.id='fixture-live-theme';link.rel='stylesheet';link.href='/fixture-theme-first.css';document.head.append(link);});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(196, 181, 253)');
    await page.evaluate(()=>{document.getElementById('fixture-live-theme').href='/fixture-theme-second.css';});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(147, 197, 253)');
    await page.evaluate(()=>{document.getElementById('fixture-live-theme').disabled=true;});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(79, 139, 255)');
    await page.evaluate(()=>{const link=document.getElementById('fixture-live-theme');link.disabled=false;link.media='not all';});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(79, 139, 255)');
    await page.evaluate(()=>{document.getElementById('fixture-live-theme').media='all';});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(147, 197, 253)');
    await page.evaluate(()=>document.getElementById('fixture-live-theme').remove());
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(79, 139, 255)');
    await page.evaluate(()=>{const style=document.createElement('style');style.id='fixture-live-style';style.textContent=':root.fixture-host-dark {--link-text-color:#c4b5fd}';document.head.append(style);});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(196, 181, 253)');
    await page.evaluate(()=>{document.getElementById('fixture-live-style').textContent=':root.fixture-host-dark {--link-text-color:#93c5fd}';});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(147, 197, 253)');
    await page.evaluate(()=>{document.getElementById('fixture-live-style').sheet.insertRule(':root.fixture-host-dark {--link-text-color:#c4b5fd}',1);window.dispatchEvent(new Event('folderviewplus:theme-change'));});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-theme-accent')==='rgb(196, 181, 253)');
    await page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
    const before=await page.evaluate(()=>window.fixtureHostApplyCount);
    await page.evaluate(()=>document.fonts.dispatchEvent(new Event('loadingdone')));
    await page.waitForFunction(before=>window.fixtureHostApplyCount>before,before);
    await page.evaluate(()=>window.fixtureHostBinding.disconnect());
    const disconnected=await page.evaluate(()=>window.fixtureHostApplyCount);
    await page.evaluate(()=>{window.dispatchEvent(new Event('folderviewplus:theme-change'));document.fonts.dispatchEvent(new Event('loadingdone'));});
    await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.fixtureHostApplyCount),disconnected);
    await page.evaluate(()=>window.fixtureHostBinding.bind());
    await page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
});
}

test('Host theme Docker controls follow dark light and custom accents without moving folder rows', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await installHost(page, baseUrl);
    const rowCount = await page.locator('#docker_list > tr').count();
    for (const light of [false, true, false]) {
        await switchHost(page, light);
        if (!light) await page.evaluate(() => document.documentElement.style.setProperty('--link-text-color', '#b981ff'));
        await page.click('[data-fvplus-docker-action="filter-unassigned"]');
        await page.click('[data-fvplus-docker-action="filter-empty"]');
        await expectAccent(page, '[data-fvplus-docker-action="filter-empty"]');
        const button = page.locator('[data-fvplus-docker-action="filter-empty"]');
        assert.ok(await button.evaluate(node => parseFloat(getComputedStyle(node).borderRadius)) >= 999);
        assert.ok(await button.evaluate(node => node.getBoundingClientRect().height) >= 30);
        await page.click('[data-fvplus-docker-menu="view"]');
        await expectAccent(page, '[data-fvplus-docker-view="folderview"]');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-fvplus-docker-menu="view"]').evaluate(node => node === document.activeElement), true);
        await page.evaluate(() => document.documentElement.style.removeProperty('--link-text-color'));
    }
    await expectAccent(page, '[data-fvplus-docker-action="filter-empty"]');
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
    // Filters can hide rows, but a theme change must not reparent, recreate or reorder them.
    assert.equal(await page.locator('#docker_list > tr').count(), rowCount);
    assert.deepEqual(await page.locator('#docker_list > tr').evaluateAll(rows => rows.map(row => row.dataset.name || row.dataset.folderId)),
        ['media', 'plex', 'sonarr', 'updates', 'toolbox', 'empty', 'orphan']);
});

test('Host theme generic Docker toolbar matches native action sizing and restores its fallback', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    for (const name of ['ui.primitives', 'ui.host-buttons']) {
        const style = await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${name}.css` });
        await style.evaluate(node => document.querySelector('link[href*="styles/docker.css"]').before(node));
    }
    await page.addStyleTag({ content: 'html { font-size:10px; }' });
    await installHost(page, baseUrl);
    await page.evaluate(() => { document.getElementById('fixture-external-url').style.color = 'var(--link-text-color)'; });
    const fallback = await page.locator('.fvplus-docker-action-button').first().evaluate(node => ({
        padding: getComputedStyle(node).padding, fontSize: getComputedStyle(node).fontSize
    }));
    // A host with an arbitrary name must receive the same native sizing support.
    await page.route('**/plugins/FixtureTheme/styles/colors.css*', route => route.fulfill({
        contentType: 'text/css', body: `
            :root { --tp-font-heading:Arial,sans-serif; }
            button, input[type="button"] { padding:8px 16px; font-family:var(--tp-font-heading);
                border:1px solid var(--border-color); border-radius:var(--tp-r-full);
                font-size:1.2rem; font-weight:600; line-height:normal; letter-spacing:0; text-transform:none; }
        `
    }));
    await page.evaluate(() => {
        const link = document.createElement('link');
        link.id = 'fixture-aurora-sizing'; link.rel = 'stylesheet';
        link.href = '/plugins/FixtureTheme/styles/colors.css?v=fixture'; document.head.append(link);
        document.querySelector('.fvplus-docker-action-bar').insertAdjacentHTML('afterend',
            '<div id="fixture-native-actions"><input type="button" value="Add Container"><button type="button">Start All</button></div>');
        window.fixtureNativeActionClicks = 0;
        document.querySelectorAll('#fixture-native-actions > *').forEach(node => {
            node.addEventListener('click', () => window.fixtureNativeActionClicks++);
        });
    });
    await page.waitForFunction(() => document.getElementById('fixture-aurora-sizing').sheet);
    await page.evaluate(() => window.fixtureHostBinding.runApply('native-controls-added'));
    for (const rootSize of ['10px', '12px']) for (const light of [false, true]) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, rootSize);
        await switchHost(page, light);
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.fvplus-docker-action-button')).fontSize
            === getComputedStyle(document.querySelector('#fixture-native-actions input')).fontSize);
        await page.click('[data-fvplus-docker-action="filter-empty"]');
        const metrics = await page.evaluate(() => {
            const measure = node => {
                const style = getComputedStyle(node), box = node.getBoundingClientRect();
                return { label: node.value || node.textContent.trim(), height: box.height,
                    padding: style.padding, fontSize: style.fontSize, fontFamily: style.fontFamily };
            };
            const native = [...document.querySelectorAll('#fixture-native-actions > *')].map(measure);
            return { host: native[0], native,
                own: [...document.querySelectorAll('.fvplus-docker-action-button')].map(measure) };
        });
        for (const native of metrics.native) assert.ok(Math.abs(native.height - metrics.host.height) <= 1);
        assert.equal(metrics.own.length, 10);
        for (const button of metrics.own) {
            assert.ok(Math.abs(button.height - metrics.host.height) <= 1, `${button.label}: ${JSON.stringify(metrics)}`);
            assert.equal(button.padding, metrics.host.padding);
            assert.equal(button.fontSize, metrics.host.fontSize);
            assert.equal(button.fontFamily, metrics.host.fontFamily);
        }
    }
    await page.click('#fixture-native-actions input');
    await page.click('#fixture-native-actions button');
    assert.equal(await page.evaluate(() => window.fixtureNativeActionClicks), 2);
    await page.click('[data-fvplus-docker-menu="view"]');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-fvplus-docker-menu="view"]').evaluate(node => node === document.activeElement), true);
    const spacing = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        const collapse = box('[data-fvplus-docker-action="collapse-all"]');
        const unassigned = box('[data-fvplus-docker-action="filter-unassigned"]');
        const add = box('[data-fvplus-docker-action="add-folder"]');
        const expand = box('[data-fvplus-docker-action="expand-all"]');
        const tools = box('[data-fvplus-docker-menu="tools"]');
        const arrow = document.createElement('button');
        arrow.id = 'fixture-page-up'; arrow.textContent = '↑';
        arrow.setAttribute('aria-label', 'Scroll page up');
        Object.assign(arrow.style, { position: 'fixed', right: '12px', top: `${tools.top}px`,
            width: '44px', height: '44px', padding: '0', borderRadius: '50%', zIndex: '11000' });
        document.body.append(arrow);
        const arrowLeft = arrow.getBoundingClientRect().left;
        return { dividerVisible: getComputedStyle(document.querySelector('.fvplus-docker-action-separator')).display !== 'none',
            sameRow: Math.abs(collapse.top - unassigned.top) < 1,
            dividerGap: unassigned.left - collapse.right, buttonGap: expand.left - add.right,
            clearance: [...document.querySelectorAll('.fvplus-docker-action-secondary > button, .fvplus-docker-action-secondary > span > button')]
                .map(node => arrowLeft - node.getBoundingClientRect().right) };
    });
    if (spacing.dividerVisible && spacing.sameRow) assert.ok(spacing.dividerGap >= spacing.buttonGap + 16, JSON.stringify(spacing));
    assert.equal(spacing.clearance.length, 3);
    assert.ok(spacing.clearance.every(value => value >= 8), `page-up arrow clearance: ${JSON.stringify(spacing)}`);
    await page.click('[data-fvplus-docker-menu="tools"]');
    assert.equal(await page.locator('[data-fvplus-docker-menu="tools"]').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('#fixture-page-up').evaluate(node => node.remove());
    await page.evaluate(() => {
        document.getElementById('fixture-aurora-sizing').remove(); document.getElementById('fixture-native-actions').remove();
        document.documentElement.style.fontSize = '10px'; window.fixtureHostBinding.runApply('native-controls-removed');
    });
    assert.deepEqual(await page.locator('.fvplus-docker-action-button').first().evaluate(node => ({
        padding: getComputedStyle(node).padding, fontSize: getComputedStyle(node).fontSize
    })), fallback);
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});

for (const [route, root] of [['settings', '#fv-settings-root'], ['folder-editor', '.folder-editor-form']]) {
test(`Host theme native metrics reach ${route} buttons fields and selects`, async ({ page }) => {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'load' });
    await installHost(page, baseUrl, root);
    await page.addStyleTag({ content: '[data-fvplus-theme-native="button"] { font:600 14px/20px Georgia,serif; padding:6px 12px; border:1px solid; border-radius:10px; color:var(--text-color); background:var(--button-background); }' });
    await page.evaluate(root => {
        const native = document.createElement('input');
        native.type = 'button'; native.value = 'Native action'; native.dataset.fvplusThemeNative = 'button';
        document.body.append(native);
        const wrapper = document.createElement('div'); wrapper.id = 'fixture-host-metric-controls';
        wrapper.innerHTML = '<button type="button">Plugin action</button><input aria-label="Example text"><select aria-label="Example choice"><option>Example</option></select>';
        document.querySelector(root).append(wrapper);
        window.fixtureHostBinding.runApply('native-control-metrics');
    }, root);
    const metrics = await page.locator('#fixture-host-metric-controls').evaluate(node => ({
        own:[...node.children].map(child => ({font:getComputedStyle(child).fontFamily, size:getComputedStyle(child).fontSize})),
        native:getComputedStyle(document.querySelector('[data-fvplus-theme-native="button"]')).fontFamily
    }));
    for (const control of metrics.own) { assert.equal(control.font, metrics.native); assert.equal(control.size, '14px'); }
    await page.locator('#fixture-host-metric-controls button').focus();
    assert.equal(await page.locator('#fixture-host-metric-controls button').evaluate(node => node === document.activeElement), true);
});
}

test('Host theme Settings controls inherit host surfaces and accent through theme changes', async ({ page }) => {
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    await page.evaluate(() => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'fv-basic-add-btn'; button.textContent = 'Fixture add folder';
        document.getElementById('fv-settings-root').append(button);
    });
    await installHost(page, baseUrl, '#fv-settings-root');
    for (const light of [false, true]) {
        await switchHost(page, light);
        await page.waitForFunction(() => {
            const button = document.querySelector('.fv-basic-add-btn');
            const probe = document.createElement('span');
            probe.style.color = 'var(--text-color)'; document.body.append(probe);
            const matches = getComputedStyle(button).color === getComputedStyle(probe).color;
            probe.remove(); return matches && button.getAnimations().length === 0;
        });
        const colors = await page.locator('.fv-basic-add-btn').first().evaluate(node => {
            const probe = document.createElement('span');
            probe.style.cssText = 'color:var(--text-color);background:var(--button-background)';
            document.body.append(probe);
            const style = getComputedStyle(node), expected = getComputedStyle(probe);
            const result = { color: style.color, expectedColor: expected.color, background: style.backgroundColor, expectedBackground: expected.backgroundColor };
            probe.remove();
            return result;
        });
        assert.equal(colors.color, colors.expectedColor);
        assert.equal(colors.background, colors.expectedBackground);
    }
});

test('Host theme editor and detached action dialog keep host chrome in light and dark modes', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Add profile' }).click();
    await installHost(page, baseUrl, '.folder-editor-form');
    for (const light of [false, true]) {
        await switchHost(page, light);
        const result = await page.evaluate(() => {
            const dialog = document.createElement('div');
            dialog.className = 'fv-folder-action-dialog ui-dialog';
            document.body.append(dialog);
            const form = document.querySelector('.folder-editor-form');
            const probe = document.createElement('span');
            probe.style.cssText = 'color:var(--text-color);background:var(--background-color)';
            document.body.append(probe);
            const expected = getComputedStyle(probe);
            const result = { expectedColor: expected.color, expectedBackground: expected.backgroundColor,
                formColor: getComputedStyle(form).color, dialogColor: getComputedStyle(dialog).color,
                dialogBackground: getComputedStyle(dialog).backgroundColor };
            dialog.remove(); probe.remove();
            return result;
        });
        assert.equal(result.formColor, result.expectedColor);
        assert.equal(result.dialogColor, result.expectedColor);
        assert.equal(result.dialogBackground, result.expectedBackground);
    }
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});

test('Host theme modern CSS colors preserve explicit status colors and safety mode round trips', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await installHost(page, baseUrl);
    await page.evaluate(() => {
        const status = document.createElement('span');
        status.id = 'fixture-explicit-status';
        status.className = 'folder-state fv-folder-state-started';
        status.textContent = 'Explicit color';
        const row = document.querySelector('#docker_list > tr.folder');
        row.style.setProperty('--fvplus-folder-status-text', '#ff00aa');
        row.firstElementChild.append(status);
        document.documentElement.style.setProperty('--link-text-color', 'color(srgb 0.31 0.545 1)');
    });
    await page.waitForFunction(() => document.body.style.getPropertyValue('--fvplus-ui-accent').startsWith('rgb('));
    await page.click('[data-fvplus-docker-action="filter-empty"]');
    assert.equal(await page.locator('#fixture-explicit-status').evaluate(node => getComputedStyle(node).color), 'rgb(255, 0, 170)');
    for (const mode of ['safe', 'highcontrast', 'auto']) {
        await page.evaluate(mode => { window.fixtureHostMode = mode; window.fixtureHostBinding.queueApply('mode'); }, mode);
        await page.waitForFunction(mode => document.body.dataset.fvThemeMode === mode, mode);
        assert.equal(await page.locator('#fixture-explicit-status').evaluate(node => getComputedStyle(node).color), 'rgb(255, 0, 170)');
    }
    await page.evaluate(() => {
        document.getElementById('fixture-host-css').remove();
        document.documentElement.classList.remove('fixture-host-dark', 'fixture-host-light');
        document.documentElement.style.removeProperty('--link-text-color');
    });
    await page.waitForFunction(() => window.fixtureHostBinding.runApply('removed').hostIntegration.paletteSource === 'computed');
    assert.equal(await page.evaluate(() => window.fixtureHostBinding.runApply('removed').hostIntegration.reason), 'none');
    const before = await page.evaluate(() => window.fixtureHostApplyCount);
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => window.fixtureHostApplyCount) - before <= 1, 'theme observers must settle');
});
};
