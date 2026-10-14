import assert from 'node:assert/strict';
export const checkIconCardLayout = async (page, selector) => {
    const cards = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
        const card = node.getBoundingClientRect(), image = node.querySelector('img').getBoundingClientRect();
        const label = node.querySelector('.fv-icon-picker-item-name'), text = label.getBoundingClientRect(), style = getComputedStyle(label);
        return { card: card.toJSON(), image: image.toJSON(), text: text.toJSON(), font: parseFloat(style.fontSize), favorite: node.querySelector('.fv-third-party-icon-fav')?.getBoundingClientRect().toJSON(), touch: matchMedia('(pointer: coarse)').matches,
            contained: label.scrollWidth <= label.clientWidth + 1, clamped: label.scrollHeight > label.clientHeight + 1,
            lines: text.height / parseFloat(style.lineHeight), casing: style.textTransform, fullName: label.textContent, title: node.title };
    }));
    assert.ok(cards.length >= 3);
    assert.ok(cards.some(card => card.clamped && card.title === card.fullName && card.fullName.length > 30));
    for (const { card, image, text, font, contained, lines, casing, favorite, touch } of cards) {
        const limit = touch && favorite ? 98 : 90, x = (image.left + image.right) / 2, y = (image.top + image.bottom) / 2;
        assert.ok(card.width <= limit && card.height <= limit && card.width >= 80 && card.height >= 80);
        assert.ok(!favorite || x < favorite.left || x > favorite.right || y < favorite.top || y > favorite.bottom, 'Favorite must not cover the icon selection point');
        assert.ok(image.width === 32 && image.height === 32);
        assert.ok(Math.abs((image.left + image.right - card.left - card.right) / 2) < 1);
        assert.ok(text.left >= card.left && text.right <= card.right && text.top >= image.bottom && text.bottom <= card.bottom);
        assert.ok(contained && lines <= 2.1 && font >= 11 && casing === 'none');
    }
};
