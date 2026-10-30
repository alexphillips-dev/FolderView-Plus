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
        const controls=[...document.querySelectorAll('[data-toolbar-type] .folder-toolbar button,[data-toolbar-type] .fv-defaults-editor-link,[data-toolbar-type] .fv-basic-sort,#fv-run-wizard')];
        const icons=controls.map(control=>{
            const icon=control.querySelector('i,svg'),rect=icon.getBoundingClientRect();
            const label=[...control.childNodes].find(node=>node.nodeType===3&&node.textContent.trim())||control.querySelector('span');
            const range=document.createRange();range.selectNodeContents(label);const bounds=range.getBoundingClientRect();
            const tm=measure(getComputedStyle(label.nodeType===3?control:label),label.textContent.trim());
            const textCenter=bounds.top+bounds.height/2+(tm.fontBoundingBoxAscent-tm.fontBoundingBoxDescent+tm.actualBoundingBoxDescent-tm.actualBoundingBoxAscent)/2;
            let iconCenter;
            if(icon.tagName.toLowerCase()==='svg'){
                const box=icon.getBBox();iconCenter=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(icon.getScreenCTM()).y;
            }else{
                const glyphStyle=getComputedStyle(icon,'::before'),outerStyle=getComputedStyle(icon),outer=measure(outerStyle,'x');
                const metrics=measure(glyphStyle,glyphStyle.content.slice(1,-1));
                const leading=(parseFloat(glyphStyle.lineHeight)-metrics.fontBoundingBoxAscent-metrics.fontBoundingBoxDescent)/2;
                const outerLeading=Number.isFinite(parseFloat(outerStyle.lineHeight))?(parseFloat(outerStyle.lineHeight)-outer.fontBoundingBoxAscent-outer.fontBoundingBoxDescent)/2:0;
                const ascent=Math.max(outer.fontBoundingBoxAscent+outerLeading,metrics.fontBoundingBoxAscent+leading);
                const descent=Math.max(outer.fontBoundingBoxDescent+outerLeading,metrics.fontBoundingBoxDescent+leading);
                iconCenter=rect.top+rect.height/2+(ascent-descent+metrics.actualBoundingBoxDescent-metrics.actualBoundingBoxAscent)/2+(parseFloat(glyphStyle.top)||0);
            }
            return {label:label.textContent.trim(),error:iconCenter-textCenter,font:getComputedStyle(icon,'::before').fontFamily,svg:icon.tagName.toLowerCase()==='svg'};
        });
        return {loaded:document.fonts.check('13px FontAwesome'),icons};
    });
    assert.equal(result.loaded,true,'the real native icon font must be loaded');
    assert.equal(result.icons.length,15,'Docker, VM and Wizard icons must all be checked');
    for(const icon of result.icons){
        if(!icon.svg)assert.equal(icon.font,'FontAwesome',icon.label);
        assert.ok(Number.isFinite(icon.error)&&Math.abs(icon.error)<=1.5,`painted icon must align with ${icon.label}: ${icon.error}px`);
    }
};
