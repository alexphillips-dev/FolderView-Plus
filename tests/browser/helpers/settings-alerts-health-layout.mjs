import assert from 'node:assert/strict';

export const verifyAlertsColumnAlignment = async (page) => {
    const centered = await page.locator('.signals-cell').evaluate((cell) => {
        const column = cell.getBoundingClientRect();
        const group = cell.querySelector('.signals-cell-content').getBoundingClientRect();
        return Math.abs(column.x + column.width / 2 - group.x - group.width / 2) < 1;
    });
    assert.equal(centered, true, 'the whole Alerts group must be centered in its column');
};

export const verifyCompactHealthDetails = async (page) => {
    const layout = await page.locator('.fv-health-details-modal').evaluate((modal) => {
        const details = modal.querySelector('.fv-health-details');
        const score = modal.querySelector('.fv-health-details-metrics dd');
        const text = score.firstChild;
        const split = text.textContent.indexOf('/');
        const rectForText = (start, end) => { const range = document.createRange(); range.setStart(text, start); range.setEnd(text, end); return range.getBoundingClientRect(); };
        const scoreRect = rectForText(0, split);
        const totalRect = rectForText(split, text.textContent.length);
        const sections = ['summary', 'metrics', 'runtime', 'policy', 'reasons'].map((name) => modal.querySelector(`.fv-health-details-${name}`).getBoundingClientRect());
        return {
            bodySize: parseFloat(getComputedStyle(details).fontSize),
            policySize: parseFloat(getComputedStyle(modal.querySelector('.fv-health-details-policy')).fontSize),
            singleText: score.childNodes.length === 1 && text.nodeType === 3 && score.textContent === '85/100',
            scoreHeight: scoreRect.height, totalHeight: totalRect.height,
            scoreTop: scoreRect.top, totalTop: totalRect.top,
            scoreRight: scoreRect.right, totalLeft: totalRect.left,
            gaps: sections.slice(1).map((section, index) => section.top - sections[index].bottom),
            float: getComputedStyle(modal.querySelector('dt')).cssFloat,
            height: modal.getBoundingClientRect().height,
            whiteSpace: getComputedStyle(details).whiteSpace
        };
    });
    assert.ok(layout.bodySize >= 14 && layout.policySize >= 14, 'dialog copy must stay readable with a small host root font');
    assert.ok(layout.singleText && layout.scoreHeight === layout.totalHeight, 'score and /100 must be one text value at the same size');
    assert.ok(Math.abs(layout.scoreTop - layout.totalTop) < 1 && Math.abs(layout.totalLeft - layout.scoreRight) < 1, `score must read inline as 85/100: ${JSON.stringify(layout)}`);
    assert.ok(layout.gaps.every((gap) => gap >= -1 && gap <= 12), `sections must stay compact: ${layout.gaps}`);
    assert.equal(layout.float, 'none', 'host definition-list floats must not move card labels');
    assert.equal(layout.whiteSpace, 'normal', 'template indentation must not become visible spacing');
    assert.ok(layout.height <= 480, `normal health dialog must fit compactly: ${layout.height}`);
};
