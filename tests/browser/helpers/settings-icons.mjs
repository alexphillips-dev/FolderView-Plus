import assert from 'node:assert/strict';
import fs from 'node:fs';

const font=fs.readFileSync(new URL('../fixtures/vendor/font-awesome-4.7.0.woff',import.meta.url));
const css=fs.readFileSync(new URL('../fixtures/vendor/font-awesome-controls.css',import.meta.url),'utf8');
export const installSettingsIconFont = async page => {
    await page.route('**/fixture/font-awesome.woff',route=>route.fulfill({contentType:'font/woff',body:font}));
    await page.addStyleTag({content:css});
    await page.evaluate(()=>document.fonts.ready);
};

export const verifySettingsIconAlignment = async page => {
    const result=await page.evaluate(()=>{
        const ctx=document.createElement('canvas').getContext('2d');
        const measure=(style,value)=>{
            ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            return ctx.measureText(value);
        };
        const marker=()=>{const node=document.createElement('span');node.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline';return node;};
        const textBaseline=(style,text)=>{
            const probe=document.createElement('span'),baseline=marker();
            probe.style.cssText='position:fixed;left:-10000px;top:0;white-space:nowrap';
            for(const property of ['font-family','font-style','font-size','font-weight','line-height'])probe.style.setProperty(property,style.getPropertyValue(property));
            probe.append(document.createTextNode(text),baseline);document.body.append(probe);
            const range=document.createRange();range.selectNodeContents(probe.firstChild);
            const offset=baseline.getBoundingClientRect().top-range.getBoundingClientRect().top;probe.remove();return offset;
        };
        const controls=[...document.querySelectorAll('[data-toolbar-type] .folder-toolbar button,[data-toolbar-type] .fv-defaults-editor-link,[data-toolbar-type] .fv-basic-sort,#fv-run-wizard')];
        const icons=controls.map(control=>{
            const icon=control.querySelector('i,svg'),rect=icon.getBoundingClientRect();
            const label=[...control.childNodes].find(node=>node.nodeType===3&&node.textContent.trim())||control.querySelector('span');
            const range=document.createRange();range.selectNodeContents(label);const bounds=range.getBoundingClientRect();
            const textStyle=getComputedStyle(label.nodeType===3?control:label),text=label.textContent.trim(),tm=measure(textStyle,text);
            const firstLine=range.getClientRects()[0];
            const textCenter=bounds.top+(bounds.height-firstLine.height)/2+textBaseline(textStyle,text)+(tm.actualBoundingBoxDescent-tm.actualBoundingBoxAscent)/2;
            let iconCenter,geometryStable=true;
            if(icon.tagName.toLowerCase()==='svg'){
                const box=icon.getBBox();iconCenter=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(icon.getScreenCTM()).y;
            }else{
                const glyphStyle=getComputedStyle(icon,'::before');
                const metrics=measure(glyphStyle,glyphStyle.content.slice(1,-1));
                // Measure the real inline baseline; font boxes alone depend on host font metrics.
                const baseline=marker();icon.append(baseline);
                iconCenter=baseline.getBoundingClientRect().top+(metrics.actualBoundingBoxDescent-metrics.actualBoundingBoxAscent)/2+(parseFloat(glyphStyle.top)||0);
                const after=icon.getBoundingClientRect();geometryStable=after.top===rect.top&&after.height===rect.height;baseline.remove();
            }
            return {label:text,error:iconCenter-textCenter,geometryStable,font:getComputedStyle(icon,'::before').fontFamily,svg:icon.tagName.toLowerCase()==='svg'};
        });
        return {loaded:document.fonts.check('13px FontAwesome'),icons};
    });
    assert.equal(result.loaded,true,'the real native icon font must be loaded');
    assert.equal(result.icons.length,15,'Docker, VM and Wizard icons must all be checked');
    for(const icon of result.icons){
        assert.equal(icon.geometryStable,true,`baseline measurement must preserve ${icon.label} geometry`);
        if(!icon.svg)assert.equal(icon.font,'FontAwesome',icon.label);
        assert.ok(Number.isFinite(icon.error)&&Math.abs(icon.error)<=1.5,`painted icon must align with ${icon.label}: ${icon.error}px`);
    }
};
