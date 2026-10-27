import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installHost } from '../helpers/host-theme.mjs';

const scenarios=JSON.parse(fs.readFileSync(new URL('../fixtures/themes/general-themes.json',import.meta.url),'utf8')).scenarios;
const surfaces=[['Docker','runtime','body'],['VM','vm-lifecycle','body'],['Dashboard','dashboard-layout','body'],['Settings','settings','#fv-settings-root'],['editor','folder-editor','.folder-editor-form']];

export const registerHostThemeMatrixCases = ({test,baseUrl}) => {
for(const [surface,route,root] of surfaces) test(`Host theme matrix preserves controls customization and layout on ${surface}`,async ({page})=>{
    await page.goto(`${baseUrl}/${route}`,{waitUntil:'load'});await installHost(page,baseUrl,root);
    await page.evaluate(root=>{
        document.getElementById('fixture-host-css').remove();
        const native=document.createElement('div');native.id='fixture-native-theme-surface';native.dataset.fvplusThemeNative='surface';
        native.innerHTML='<input type="button" value="Native action" data-fvplus-theme-native="button"><a href="#" data-fvplus-theme-native="link">Native link</a>';
        document.body.append(native);
        const controls=document.createElement('div');controls.id='fixture-theme-matrix-controls';controls.className='fv-ui-modal';
        controls.innerHTML='<button type="button" class="fv-ui-button">Folder action</button><input aria-label="Theme field"><select aria-label="Theme choice"><option>Choice</option></select>';
        document.querySelector(root).append(controls);
        window.fixtureThemeClicks=0;controls.querySelector('button').addEventListener('click',()=>window.fixtureThemeClicks++);
        window.fixtureOriginalThemeNodes=[...document.querySelectorAll('tr.folder,[data-folder-id]')].map(node=>({node,parent:node.parentElement}));
    },root);
    // Load the same shared skins as the shipped pages, including minimal runtime fixtures.
    for(const name of ['ui.primitives','ui.host-buttons']) if(!await page.locator(`link[href$="/${name}.css"]`).count()) await page.addStyleTag({url:`${baseUrl}/plugin/styles/${name}.css`});
    await page.addStyleTag({url:`${baseUrl}/fixtures/themes/general-themes.css`});
    await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
    const original=await page.locator('tr.folder,[data-folder-id]').count();
    for(const scenario of scenarios) {
        await page.evaluate(scenario=>{
            document.documentElement.dataset.fixtureTheme=scenario.id;
            document.documentElement.dataset.fixtureInput=scenario.source==='computed'?'computed':'variables';
            window.dispatchEvent(new Event('folderviewplus:theme-change'));
        },scenario);
        await page.waitForFunction(expected=>document.body.dataset.fvThemeClass===expected,scenario.classification);
        await page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
        const snapshot=await page.evaluate(()=>window.fixtureHostBinding.runApply('matrix-verification'));
        await page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
        assert.equal(snapshot.hostPaletteApplied,!scenario.recovery,scenario.id);
        if(scenario.recovery) assert.equal(snapshot.appliedMode,'highcontrast');
        if(scenario.source==='computed') assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim()),'');
        const metrics=await page.locator('#fixture-theme-matrix-controls').evaluate(node=>{
            const native=getComputedStyle(document.querySelector('[data-fvplus-theme-native="button"]'));
            const own=[...node.children].map(child=>{const style=getComputedStyle(child),box=child.getBoundingClientRect();return {font:style.fontFamily,size:style.fontSize,height:box.height,width:box.width,textHeight:parseFloat(style.fontSize)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)};});
            return {native:{font:native.fontFamily,size:native.fontSize},own,width:document.documentElement.clientWidth};
        });
        if(!scenario.recovery) for(const control of metrics.own) {assert.equal(control.font,metrics.native.font,scenario.id);assert.equal(control.size,metrics.native.size,scenario.id);}
        for(const control of metrics.own) {assert.ok(control.height>=control.textHeight-1,`${surface}/${scenario.id} text clipped: ${JSON.stringify(control)}`);assert.ok(control.width<=metrics.width+1,`${surface}/${scenario.id} control overflow`);}
        const button=page.locator('#fixture-theme-matrix-controls button');
        await button.focus();assert.equal(await button.evaluate(node=>node===document.activeElement),true);
        const before=await page.evaluate(()=>window.fixtureThemeClicks);await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>window.fixtureThemeClicks),before+1);
        await button.click();assert.equal(await page.evaluate(()=>window.fixtureThemeClicks),before+2);
        assert.equal(await page.locator('tr.folder,[data-folder-id]').count(),original,'theme switch cannot recreate/reparent folders');
        assert.equal(await page.evaluate(()=>window.fixtureOriginalThemeNodes.every(({node,parent})=>node.isConnected&&node.parentElement===parent)),true);
        const violations=await page.evaluate(async()=>{
            const result=await window.axe.run(document.getElementById('fixture-theme-matrix-controls'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
            return result.violations.filter(item=>['critical','serious'].includes(item.impact)).map(item=>({id:item.id,targets:item.nodes.map(node=>node.target)}));
        });
        assert.deepEqual(violations,[],`${surface}/${scenario.id} accessibility`);
        await page.evaluate(()=>{document.documentElement.style.setProperty('--fvplus-custom-theme-accent','#7c3aed');});
        const customized=await page.evaluate(()=>window.fixtureHostBinding.runApply('matrix-customization'));
        if(!scenario.recovery) assert.equal(customized.tokens.accent,'rgb(124, 58, 237)');
        await page.evaluate(()=>{document.documentElement.style.removeProperty('--fvplus-custom-theme-accent');window.fixtureHostBinding.runApply('matrix-customization-removed');});
        if(surface==='Docker') {
            await page.click('[data-fvplus-docker-menu="view"]');await page.keyboard.press('Escape');
            assert.equal(await page.locator('[data-fvplus-docker-menu="view"]').evaluate(node=>node===document.activeElement),true);
        }
    }
    // Leave axe a settled, valid host theme instead of the intentionally invalid fixture.
    await page.evaluate(()=>{document.documentElement.dataset.fixtureTheme='dark';window.dispatchEvent(new Event('folderviewplus:theme-change'));});
    await page.waitForFunction(()=>document.body.dataset.fvThemeSource==='host'&&document.body.dataset.fvThemeClass==='dark');
    await page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
});
};
