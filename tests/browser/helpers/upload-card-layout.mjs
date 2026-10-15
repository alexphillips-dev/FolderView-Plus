import assert from 'node:assert/strict';

export const checkUploadCardLayout = async page => {
    const hostButtons = await page.addStyleTag({ content: '.canvas button, .canvas button[type="button"] { margin: 10px 12px 10px 0; padding: 6px 12px; }' });
    await page.evaluate(() => {
        const state = window.iconBrowserFixture;
        state.uploads = [
            { name: 'Instagram_icon_with_a_very_long_unbroken_filename.png', size: 165321, width: 1024, height: 1024 },
            { name: 'icons8-test-100.png', size: 1305, width: 100, height: 100 }
        ].map((icon, index) => ({ ...icon, url: `/plugins/folderview.plus/images/folder-icon.png?upload=${icon.name}`, updatedAt: '2026-04-14T14:35:00Z', usageCount: index === 0 ? 2 : 0 }));
    });
    await page.locator('#fv-custom-icon-refresh').click();
    await page.locator('[data-custom-icon="icons8-test-100.png"]').waitFor();
    const selected = page.locator('.fv-custom-icon-row').first();
    await selected.locator('[data-action="use"]').click();
    await selected.locator('[data-action="use"]').focus();
    const focus = await selected.evaluate(node => ({ selected: node.classList.contains('is-selected'), outline: getComputedStyle(node).outlineWidth, offset: getComputedStyle(node).outlineOffset }));
    assert.ok(focus.selected && focus.outline === '2px' && focus.offset === '-2px');
    assert.deepEqual(await page.locator('.fv-custom-icon-extra > div').allTextContents(), ['161.4 KiB | 1024x1024', '2 refs', '1.3 KiB | 100x100', 'unused']);
    await page.keyboard.press('Tab');
    const keyboard = await selected.locator('[data-action="refs"]').evaluate(button => ({ focused: document.activeElement === button, visible: button.matches(':focus-visible'), outline: getComputedStyle(button).outlineWidth }));
    assert.ok(keyboard.focused && keyboard.visible && keyboard.outline === '2px');
    const cards = await page.locator('.fv-custom-icon-row').evaluateAll(nodes => nodes.map(node => {
        const card = node.getBoundingClientRect(), image = node.querySelector('img').getBoundingClientRect();
        const name = node.querySelector('.fv-custom-icon-name'), details = node.querySelector('.fv-custom-icon-extra');
        const text = [name, ...details.children].map(element => ({ box: element.getBoundingClientRect().toJSON(), width: element.clientWidth, content: element.scrollWidth }));
        const actions = [...node.querySelectorAll('button:not([data-action="use"])')].map(button => button.getBoundingClientRect().toJSON());
        return { card: card.toJSON(), image: image.toJSON(), text, actions, name: name.title, clipped: name.scrollHeight > name.clientHeight, coarse: matchMedia('(pointer: coarse)').matches };
    }));
    assert.equal(cards.length, 2);
    assert.ok(cards[0].clipped && cards[0].name.includes('very_long_unbroken_filename'));
    for (const { card, image, text, actions, coarse } of cards) {
        assert.ok(card.width <= (coarse ? 154 : 138) && image.width === 32 && image.height === 32);
        assert.ok(text.every(({ box }) => box.left >= card.left && box.right <= card.right && box.top >= image.bottom));
        assert.ok(text.every(item => item.content <= item.width + 1) && text[2].box.top >= text[1].box.bottom - .1 && text[2].box.bottom <= actions[0].top);
        assert.ok(actions.length === 3 && actions.every(box => Math.abs(box.top - actions[0].top) < 1 && box.left >= card.left + 6 && box.right <= card.right - 6 && box.bottom <= card.bottom - 6));
        assert.ok(actions.every(box => box.width >= (coarse ? 44 : 32) && box.height >= (coarse ? 44 : 32)));
        const ordered = [...actions].sort((a, b) => a.left - b.left);
        assert.ok(ordered.slice(1).every((box, index) => box.left - ordered[index].right >= 0 && box.left - ordered[index].right <= 2.1));
        assert.ok(card.bottom - actions[0].bottom <= 12 && Math.abs((image.left + image.right - card.left - card.right) / 2) < 1);
    }
    await hostButtons.evaluate(node => node.remove());
};
