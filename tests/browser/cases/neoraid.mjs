import assert from 'node:assert/strict';
import { mountNeoraid, bindNeoraidSurface, installNeoraid } from '../helpers/neoraid.mjs';
import { verifySettingsSearchAlignment, verifyBasicToolbarLayout } from './settings-search-layout.mjs';
import { exerciseDockerDetailHydration } from '../helpers/docker-detail-hydration.mjs';

export const registerNeoraidFixtureCases = ({test,baseUrl}) => {
test('NeoRaid Settings preserves warning contrast and native toolbar controls', async ({page}) => {
    await page.setViewportSize({width:1180,height:720});
    await page.emulateMedia({reducedMotion:'reduce'});
    const cleanup=await mountNeoraid(page,`${baseUrl}/settings`);
    try {
        await bindNeoraidSurface(page,baseUrl,'#fv-settings-root');
        await page.locator('#fv-plugin-update-link').evaluate(node=>{node.hidden=false;});
        await verifySettingsSearchAlignment(page); await verifyBasicToolbarLayout(page);
        const select=page.locator('[data-toolbar-type="docker"] select').first();
        await select.focus(); await select.press('End'); await select.press('Enter');
        assert.equal(await select.evaluate(node=>node===document.activeElement),true);
        const badge=page.locator('#fv-plugin-update-link'); await badge.scrollIntoViewIfNeeded();
        await page.mouse.move(0,0);
        const color=await badge.evaluate(node=>getComputedStyle(node).color);
        assert.equal(color,await badge.evaluate(node=>{
            const probe=document.createElement('span');probe.style.color='var(--fvplus-settings-chip-warning)';node.append(probe);
            const value=getComputedStyle(probe).color;probe.remove();return value;
        }));
        await badge.focus();
        await page.keyboard.press('Tab'); await badge.focus();
        assert.equal(await badge.evaluate(node=>node.matches(':focus-visible')),true);
        assert.notEqual(await badge.evaluate(node=>getComputedStyle(node).boxShadow),'none');
        await badge.evaluate(node=>node.blur());
    } finally { await cleanup(); }
});
test('NeoRaid palette identity and sanitized options follow live theme changes on every surface', async ({page}) => {
    for (const [route,root] of [['runtime','body'],['vm-lifecycle','body'],['dashboard-layout','body'],['settings','#fv-settings-root'],['folder-editor','.folder-editor-form']]) {
        const cleanup=await mountNeoraid(page,`${baseUrl}/${route}`);
        try {
            await bindNeoraidSurface(page,baseUrl,root);
            for (const mode of ['dark','light','system']) {
                await page.emulateMedia({colorScheme:'dark'});
                await page.evaluate(mode=>window.nrTheme.preview({mode,accent:mode==='system'?'#3b82f6':'#ff8c2f',density:'compact',radius:'round',font:'system',switch:'show'}),mode);
                const expected=mode==='light'?'light':'dark';
                await page.waitForFunction(expected=>window.fixtureNeoraidSnapshot?.classification===expected
                    && window.fixtureNeoraidSnapshot.hostIntegration.neoraid.density==='compact'
                    && window.fixtureNeoraidSnapshot.hostIntegration.neoraid.font==='system',expected);
                const state=await page.evaluate(()=>({
                    identity:window.FolderViewPlusFoundationModules.themeIntegration.readHostIdentity(document,window),
                    applied:window.fixtureNeoraidSnapshot.hostPaletteApplied,
                    neo:window.fixtureNeoraidSnapshot.hostIntegration.neoraid
                }));
                assert.deepEqual(state.identity,{name:'NeoRaid',source:'recognized'}); assert.equal(state.applied,true);
                assert.deepEqual(state.neo,{active:true,mode:expected,density:'compact',radius:'round',font:'system'});
            }
            await page.emulateMedia({colorScheme:'light'});
            await page.waitForFunction(()=>window.fixtureNeoraidSnapshot?.classification==='light');
            await page.evaluate(()=>document.documentElement.setAttribute('data-nr-density','comfortable'));
            await page.waitForFunction(()=>window.fixtureNeoraidSnapshot?.hostIntegration.neoraid.density==='comfortable');
            await page.evaluate(()=>{document.getElementById('fixture-neoraid').remove();document.documentElement.classList.remove('nr');});
            await page.waitForFunction(()=>window.fixtureNeoraidSnapshot?.hostIntegration.neoraid.active===false);
            assert.equal(await page.evaluate(()=>window.FolderViewPlusFoundationModules.themeIntegration.readHostIdentity(document,window).name),'Unraid Black');
        } finally { await cleanup(); }
    }
}, {skipAccessibility:true}); // Each page's native fixture has separate accessibility checks.
test('NeoRaid detail loading retains native Docker switches and accepted inventory', async ({page}) => {
    await exerciseDockerDetailHydration({page,themeInstaller:installNeoraid});
}, {skipAccessibility:true}); // Production Docker fixture supplies only the synthetic native host.
};
