import assert from 'node:assert/strict';

export const checkUploadCardLayout = async page => {
    await page.evaluate(() => {
        const state = window.iconBrowserFixture;
        state.uploads = [
            { name: 'Instagram_icon_with_a_very_long_unbroken_filename.png', size: 165321, width: 1024, height: 1024 },
            { name: 'icons8-test-100.png', size: 1305, width: 100, height: 100 }
        ].map(icon => ({ ...icon, url: `/plugins/folderview.plus/images/folder-icon.png?upload=${icon.name}`, updatedAt: '2026-04-14T14:35:00Z', usageCount: 2 }));
    });
    await page.locator('#fv-custom-icon-refresh').click();
    await page.locator('[data-custom-icon="icons8-test-100.png"]').waitFor();
    const cards = await page.locator('.fv-custom-icon-row').evaluateAll(nodes => nodes.map(node => {
        const card = node.getBoundingClientRect(), image = node.querySelector('img').getBoundingClientRect();
        const name = node.querySelector('.fv-custom-icon-name'), details = node.querySelector('.fv-custom-icon-extra');
        const text = [name, details].map(element => ({ box: element.getBoundingClientRect().toJSON(), width: element.clientWidth, content: element.scrollWidth }));
        const actions = [...node.querySelectorAll('button:not([data-action="use"])')].map(button => button.getBoundingClientRect().toJSON());
        return { card: card.toJSON(), image: image.toJSON(), text, actions, name: name.title, clipped: name.scrollWidth > name.clientWidth, coarse: matchMedia('(pointer: coarse)').matches };
    }));
    assert.equal(cards.length, 2);
    assert.ok(cards[0].clipped && cards[0].name.includes('very_long_unbroken_filename'));
    for (const { card, image, text, actions, coarse } of cards) {
        assert.ok(text.every(({ box }) => box.left >= card.left && box.right <= card.right && box.top >= image.bottom));
        assert.ok(text[1].content <= text[1].width + 1 && text[1].box.bottom <= actions[0].top);
        assert.ok(actions.length === 3 && actions.every(box => Math.abs(box.top - actions[0].top) < 1 && box.left >= card.left && box.right <= card.right && box.bottom <= card.bottom));
        assert.ok(actions.every(box => box.width >= (coarse ? 44 : 32) && box.height >= (coarse ? 44 : 32)));
        assert.ok(card.bottom - actions[0].bottom <= 12 && Math.abs((image.left + image.right - card.left - card.right) / 2) < 1);
    }
};
