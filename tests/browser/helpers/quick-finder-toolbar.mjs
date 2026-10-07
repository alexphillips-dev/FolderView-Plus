import assert from 'node:assert/strict';

export const holdDockerSnapshotWithToolbar = async page => {
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    await page.route('**/server/runtime_snapshot.php?**', async route => { await ready; await route.fallback(); });
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        const toolbar = document.createElement('div'); toolbar.className = 'ToggleViewMode';
        toolbar.innerHTML = '<label><input type="checkbox">Basic view</label>';
        document.querySelector('.canvas').prepend(toolbar);
    }));
    return release;
};

export const readDockerPrivacyStyle = page => page.locator('.fvplus-docker-runtime-privacy-menu-button').evaluate(node => {
    const style = getComputedStyle(node);
    const probe = document.createElement('span'); probe.style.color = 'var(--fvplus-graphite-accent)'; node.append(probe);
    const accent = getComputedStyle(probe).color; probe.remove();
    return { border: style.borderTopWidth, background: style.backgroundColor, color: style.color, accent };
});

export const checkReadablePrivacyQuery = async (page, type) => {
    await page.evaluate(type => document.body.classList.add(`fvplus-privacy-${type}-runtime-mask-names`), type);
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.notEqual(await page.locator('.fv-quickfinder-name').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.notEqual(await page.locator('.fv-quickfinder-path').evaluate(node => getComputedStyle(node).filter), 'none');
    await page.locator('.fv-quickfinder input').fill('');
    await page.waitForFunction(() => !document.querySelector('.fv-quickfinder-result'));
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
    await page.locator('.fv-quickfinder input').fill('Mosquitto');
    await page.waitForFunction(() => document.querySelector('.fv-quickfinder-name')?.textContent === 'Mosquitto');
    assert.equal(await page.locator('.fv-quickfinder input').inputValue(), 'Mosquitto');
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
};
