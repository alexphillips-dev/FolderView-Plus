import assert from 'node:assert/strict';
import { installHost } from '../helpers/host-theme.mjs';

const surfaces=[['Docker','runtime','body'],['VM','vm-lifecycle','body'],['Dashboard','dashboard-layout','body'],['Settings','settings','#fv-settings-root'],['editor','folder-editor','.folder-editor-form']];
const mount=async(page,baseUrl,route,root)=>{
    await page.goto(`${baseUrl}/${route}`,{waitUntil:'load'});await installHost(page,baseUrl,root);
    for(const name of ['ui.primitives','ui.host-buttons']) if(!await page.locator(`link[href$="/${name}.css"]`).count())await page.addStyleTag({url:`${baseUrl}/plugin/styles/${name}.css`});
    await page.evaluate(root=>{
        const panel=document.createElement('div');panel.className='fv-ui-modal';panel.id='fixture-surface-states';
        panel.innerHTML='<p>Card text</p><button type="button" class="fv-ui-button">Normal action</button><button type="button" class="fv-ui-button is-active" aria-pressed="true">Selected action</button><button type="button" class="fv-ui-button" disabled>Disabled action</button><input type="text" aria-label="Readable input" value="Readable input"><select aria-label="Readable selection"><option>Selection</option></select>';
        document.querySelector(root).append(panel);
    },root);
    await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
};
const settle=page=>page.waitForFunction(()=>[...document.getAnimations()].every(animation=>animation.playState!=='running'));
const accessibility=async(page)=>page.evaluate(async()=>{
    const targets=[...document.querySelectorAll('#fixture-surface-states, .fvplus-docker-action-bar, .fv-mode-toggle, #fvWebuiProfilesWorkspace, .fv-dashboard-layout-quick-rail')];
    const result=await window.axe.run({include:targets},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return result.violations.filter(item=>['critical','serious'].includes(item.impact)).map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));
});

export const registerHostThemeAccessibilityCases=({test,baseUrl})=>{
for(const [surface,route,root] of surfaces) {
test(`Host theme surface contrast covers mixed normal hover selected and focus states on ${surface}`,async({page})=>{
    await mount(page,baseUrl,route,root);
    await page.evaluate(()=>{
        for(const [name,value] of Object.entries({'--table-background-color':'#ffffff','--input-bg-color':'#ffffff','--button-background':'#ffffff','--hover-button-background':'#111827','--button-text-color':'#111827'}))document.documentElement.style.setProperty(name,value);
    });
    // The native launcher is outside the plugin and retains its own safe host skin.
    await page.addStyleTag({content:'#open-folder-actions {background:#111827 !important;color:#f1f5f9 !important}'});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-ui-control-fg')==='rgb(0, 0, 0)'||document.body.style.getPropertyValue('--fvplus-ui-control-fg')==='rgb(17, 24, 39)');
    await settle(page);assert.deepEqual(await accessibility(page),[],surface+' normal/selected');
    const normal=page.locator('#fixture-surface-states button').first();await normal.hover();await settle(page);
    assert.deepEqual(await accessibility(page),[],surface+' hover');
    await normal.focus();const focus=await normal.evaluate(node=>{const s=getComputedStyle(node);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)};});
    assert.equal(focus.style,'solid');assert.ok(focus.width>=2);
    await page.locator('#fixture-surface-states input').focus();await settle(page);assert.deepEqual(await accessibility(page),[],surface+' field focus');
    const real=page.locator('.fvplus-docker-action-bar button, .fv-mode-toggle button, #fvWebuiProfilesWorkspace button, .fv-dashboard-layout-quick-rail button').first();
    if(await real.isVisible()) {
        await real.hover();await settle(page);assert.deepEqual(await accessibility(page),[],surface+' page action hover');
        await real.focus();await settle(page);assert.deepEqual(await accessibility(page),[],surface+' page action focus');
    }
    const snapshot=await page.evaluate(()=>window.fixtureHostBinding.runApply('surface-state-check'));
    assert.ok(snapshot.contrastChecks.filter(check=>check.name.startsWith('surface.')).every(check=>check.passed));
    await page.evaluate(()=>{
        document.getElementById('fixture-surface-states').remove();
        for(const name of ['--table-background-color','--input-bg-color','--button-background','--hover-button-background','--button-text-color'])document.documentElement.style.removeProperty(name);
        window.fixtureHostBinding.runApply('restore-surface-state');
    });
    await settle(page);
});
test(`Host theme OS forced colors keep borders selected disabled and keyboard focus visible on ${surface}`,async({page,browserName})=>{
    await mount(page,baseUrl,route,root);await page.emulateMedia({forcedColors:'active'});
    const supported=await page.evaluate(()=>matchMedia('(forced-colors: active)').matches);
    if(!supported){assert.equal(browserName,'webkit','Chromium and Firefox must exercise actual forced-color rendering');
        await page.evaluate(()=>{window.fixtureHostMode='highcontrast';window.fixtureHostBinding.runApply('forced-colors-unavailable');});
        await settle(page);assert.deepEqual(await accessibility(page),[]);return;
    }
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-ui-page')==='Canvas');
    await settle(page);const normal=page.locator('#fixture-surface-states button').first();await normal.focus();
    const styles=await page.locator('#fixture-surface-states').evaluate(node=>{
        const [normal,selected,disabled]=node.querySelectorAll('button');
        const sample=(color,background)=>{const probe=document.createElement('span');probe.style.cssText='color:'+color+';background-color:'+background;document.body.append(probe);const s=getComputedStyle(probe),result={color:s.color,background:s.backgroundColor};probe.remove();return result;};
        const read=element=>{const s=getComputedStyle(element);return {color:s.color,background:s.backgroundColor,border:parseFloat(s.borderTopWidth),opacity:s.opacity,outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth),adjust:s.forcedColorAdjust};};
        return {normal:read(normal),selected:read(selected),disabled:read(disabled),button:sample('ButtonText','ButtonFace'),highlight:sample('HighlightText','Highlight'),gray:sample('GrayText','ButtonFace')};
    });
    assert.equal(styles.normal.color,styles.button.color);assert.equal(styles.normal.background,styles.button.background);
    assert.equal(styles.selected.color,styles.highlight.color);assert.equal(styles.selected.background,styles.highlight.background);
    assert.equal(styles.disabled.color,styles.gray.color);assert.equal(styles.disabled.opacity,'1');
    assert.ok(styles.normal.border>=1);assert.equal(styles.normal.outline,'solid');assert.ok(styles.normal.outlineWidth>=2);assert.notEqual(styles.normal.adjust,'none');
    const selected=page.locator('#fixture-surface-states button.is-active');await selected.focus();
    const selectedFocus=await selected.evaluate(node=>{const style=getComputedStyle(node);return {color:style.outlineColor,width:parseFloat(style.outlineWidth)};});
    assert.equal(selectedFocus.color,styles.highlight.background);assert.ok(selectedFocus.width>=2);
    await page.emulateMedia({forcedColors:'none'});
    await page.waitForFunction(()=>document.body.style.getPropertyValue('--fvplus-ui-page')!=='Canvas');
    await settle(page);assert.deepEqual(await accessibility(page),[]);
});
}
};
