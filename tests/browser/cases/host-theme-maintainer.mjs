import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installHost } from '../helpers/host-theme.mjs';

const nativeHtml=fs.readFileSync(new URL('../fixtures/docker-native-lifecycle.html',import.meta.url),'utf8');
const themeTag='<script src="/fixtures/themes/maintainer-theme.js"></script>';

export const registerHostThemeMaintainerCases=({test,baseUrl})=>{
for(const order of ['before','after']) test(`Host theme maintainer contract preserves stored rows native menus and lifecycle (${order})`,async({page})=>{
    await page.route('**/fixtures/docker-native-lifecycle.html?*',route=>route.fulfill({contentType:'text/html',body:order==='before'?nativeHtml.replace('<script src="/vendor/jquery.js">',themeTag+'<script src="/vendor/jquery.js">'):nativeHtml}));
    await page.goto(`${baseUrl}/fixtures/docker-native-lifecycle.html?scenario=collapsed`,{waitUntil:'load'});
    await installHost(page,baseUrl);
    await page.evaluate(()=>document.getElementById('fixture-host-css').remove());
    if(order==='after')await page.addScriptTag({url:`${baseUrl}/fixtures/themes/maintainer-theme.js`});
    await page.waitForFunction(()=>window.fixtureMaintainerTheme?.state.owner==='folderview-plus');
    await page.evaluate(()=>{
        window.fixtureThemeOwnedNodes=[...document.querySelectorAll('.folder, .folder-storage, .folder-storage tr')].map(node=>({node,parent:node.parentElement}));
        window.fixtureThemeNativeHooks={loadlist:window.loadlist,eventControl:window.eventControl,context:window.addDockerContainerContext};
        window.fixtureMaintainerTheme.refresh();
    });
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-ui-page')==='rgb(16, 24, 39)');
    for(const [index,action] of ['stop','start','pause','resume'].entries()) {
        await page.locator('[data-fixture-trigger="true"]').click();await page.getByRole('button',{name:action,exact:true}).click();
        await page.waitForFunction(count=>window.fixtureNativeLifecycle.snapshot().finalizations.length===count,index+1);
        const state=await page.evaluate(()=>window.fixtureNativeLifecycle.snapshot());
        assert.equal(state.finalizations.at(-1).settled,true);assert.equal(state.busyIcons,0);assert.equal(state.hostReloads,0);assert.equal(state.rowPreserved,true);
        assert.equal(state.requestCount,index+1);assert.equal(state.menuOpens,index+1);
        assert.equal(await page.evaluate(()=>window.fixtureThemeOwnedNodes.every(({node,parent})=>node.isConnected&&node.parentElement===parent)),true);
    }
    const callbacks=await page.evaluate(()=>window.fixtureNativeLifecycle.snapshot().callbacks);
    assert.ok(callbacks.every(callback=>callback==='__fvplusDockerLifecycleRefresh'));
    await page.evaluate(()=>{window.fixtureMaintainerTheme.remove();window.fixtureHostBinding.runApply('maintainer-removed');});
    assert.equal(await page.evaluate(()=>{
        const hooks=window.fixtureThemeNativeHooks;
        return hooks.loadlist===window.loadlist&&hooks.eventControl===window.eventControl&&hooks.context===window.addDockerContainerContext;
    }),true,'theme installation, refresh and removal cannot replace native hooks');
    assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-fvplus-theme-name')),false);
    await page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
});
};
