import assert from 'node:assert/strict';

export const verifyWorkspaceControls = async page => {
    const measure = selector => page.locator(selector).evaluateAll(buttons => buttons.map(button => {
        const style = getComputedStyle(button);
        return Object.fromEntries(['minWidth','minHeight','fontSize','fontWeight','letterSpacing','textTransform','padding','borderRadius','backgroundColor','color','boxShadow'].map(key => [key,style[key]]));
    }));
    const rules = await measure('.fv-rules-redesign .bulk-source-switch button');
    const icons = await page.locator('.fv-rules-redesign :is(.fv-rules-stat-card,.fv-rule-suggestions .fv-rule-stage-head) > [data-rule-icon]:visible').evaluateAll(icons => icons.map(icon => {
        const box = icon.getBoundingClientRect(), svg = icon.querySelector('svg').getBoundingClientRect();
        return {centered:Math.abs(box.x + box.width / 2 - svg.x - svg.width / 2) < 1 && Math.abs(box.y + box.height / 2 - svg.y - svg.height / 2) < 1, size:svg.width};
    }));
    assert.equal(icons.length,5);
    assert.ok(icons.every(icon => icon.centered && icon.size >= 22), 'summary and suggestions icons must be larger and centered');
    const growth = await page.locator('#docker-rules').evaluate(body => {
        const original = body.innerHTML;
        body.insertAdjacentHTML('beforeend',original.repeat(10));
        const panel = body.closest('.fv-rules-workspace'), table = body.closest('.fv-rule-table-scroll');
        const result = {panel:panel.scrollHeight <= panel.clientHeight + 1,table:table.scrollHeight <= table.clientHeight + 1};
        body.innerHTML = original;
        return result;
    });
    assert.deepEqual(growth,{panel:true,table:true}, 'long rule lists must expand with the page');
    await page.locator('[data-fv-advanced-tab="automation"]').click();
    const bulk = await measure('.fv-bulk-workspace .bulk-source-switch button');
    assert.deepEqual(rules,bulk,'Rules tabs must exactly match Bulk Assignment computed styles');
    const bulkButton = await page.locator('.bulk-clear-filters:visible').evaluate(button => {const s=getComputedStyle(button);return {font:s.fontSize,spacing:s.letterSpacing,transform:s.textTransform};});
    await page.locator('[data-fv-advanced-tab="operations"]').click();
    assert.deepEqual(await measure('#fv-operations-source-switch button'),bulk,'Operations tabs must exactly match Bulk Assignment computed styles');
    await page.locator('[data-fv-advanced-tab="rules"]').click();
    assert.deepEqual(await page.locator('[data-fv-onclick="scanSmartRuleSuggestions(\'docker\')"]').evaluate(button => {const s=getComputedStyle(button);return {font:s.fontSize,spacing:s.letterSpacing,transform:s.textTransform};}),bulkButton,'Rules action typography must match Bulk Assignment');
};
