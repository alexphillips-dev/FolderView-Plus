import assert from 'node:assert/strict';

// Synthetic host variables exercise the interface used by Aurora v2026.10.21.2202.
// No upstream enhancer, server configuration, network request or container action runs here.
const hostCss = `
:root.fixture-host-dark, :root.fixture-host-light {
 --text: #ffffff; --orange: #ff8000; --tp-r-full: 999px;
 --button-background: var(--table-background-color);
 --hover-button-background: var(--mild-background-color);
 --input-bg-color: var(--table-background-color);
}
:root.fixture-host-dark {
 --background-color: #0a0c11; --table-background-color: #12151d;
 --mild-background-color: #161a23; --text-color: #e7eaf0;
 --alt-text-color: #8b93a5; --link-text-color: #4f8bff; --border-color: #232833;
}
:root.fixture-host-light {
 --background-color: #f5f6f8; --table-background-color: #ffffff;
 --mild-background-color: #eef0f4; --text-color: #14181f;
 --alt-text-color: #62697a; --link-text-color: #2563eb; --border-color: #e4e7ec;
}
body { background: var(--background-color); color: var(--text-color); }
button { background-color: var(--button-background); color: var(--text-color); border-color: var(--border-color); }
#open-folder-actions { color: var(--text-color) !important; }
`;

const installHost = async (page, baseUrl, root = 'body') => {
    // Native Unraid button skins remain present when an external theme is removed.
    await page.addStyleTag({ content: 'button { background-color:#242426; color:inherit; }' });
    await page.addStyleTag({ content: hostCss }).then(style => style.evaluate(node => { node.id = 'fixture-host-css'; }));
    for (const name of ['folderviewplus.theme-host', 'folderviewplus.theme-surface', 'folderviewplus.theme-resolver']) {
        const present = await page.evaluate(name => name.endsWith('host')
            ? !!window.FolderViewPlusFoundationModules?.themeHost
            : name.endsWith('surface') ? !!window.FolderViewPlusFoundationModules?.themeSurface
                : !!window.FolderViewPlusThemeResolver, name);
        if (!present) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
    }
    await page.evaluate(root => {
        document.documentElement.classList.add('fixture-host-dark');
        window.fixtureHostMode = 'auto';
        window.fixtureHostApplyCount = 0;
        window.fixtureHostBinding = window.FolderViewPlusThemeResolver.bindThemeAwareSurface({
            root, sampleRoot: 'body', getMode: () => window.fixtureHostMode,
            onApply: () => { window.fixtureHostApplyCount++; }
        });
        window.fixtureHostBinding.bind();
    }, root);
    await page.waitForFunction(() => document.body.dataset.fvThemeSource === 'host');
};

const switchHost = async (page, light) => {
    await page.evaluate(light => {
        document.documentElement.classList.toggle('fixture-host-light', light);
        document.documentElement.classList.toggle('fixture-host-dark', !light);
    }, light);
    await page.waitForFunction(light => document.body.dataset.fvThemeClass === (light ? 'light' : 'dark'), light);
};

const expectAccent = async (page, selector) => {
    await page.waitForFunction(selector => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--link-text-color)';
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.style.color = 'var(--text-color)';
        const foreground = getComputedStyle(probe).color;
        probe.remove();
        const target = document.querySelector(selector);
        return target && [color, foreground].includes(getComputedStyle(target).color);
    }, selector);
};

export const registerHostThemeFixtureCases = ({ test, baseUrl }) => {
for (const [surface, route] of [['Docker', 'runtime'], ['VM', 'vm-lifecycle'], ['Dashboard', 'dashboard-layout']]) {
test(`Host theme saved customization survives theme refreshes on ${surface}`, async ({ page }) => {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'load' });
    await installHost(page, baseUrl);
    const layer = await page.addStyleTag({ content: ':root { --fvplus-theme-accent:#c084fc; --fvplus-custom-theme-accent:#c084fc; --fvplus-theme-surface-panel:#202535; --fvplus-custom-theme-surface-panel:#202535; }' });
    await page.evaluate(() => window.fixtureHostBinding.runApply('stylesheet-loaded'));
    await page.waitForFunction(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim() === 'rgb(192, 132, 252)');
    const before = await page.evaluate(() => document.querySelectorAll('tr.folder, [data-folder-id]').length);
    await page.evaluate(() => { document.documentElement.style.setProperty('--link-text-color', '#4f8bff'); window.fixtureHostBinding.runApply('refresh'); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-surface-panel').trim()), 'rgb(32, 37, 53)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim()), 'rgb(192, 132, 252)');
    await page.evaluate(() => { window.fixtureHostMode = 'safe'; window.fixtureHostBinding.runApply('recovery'); });
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim()), 'rgb(192, 132, 252)');
    await page.evaluate(() => { window.fixtureHostMode = 'auto'; window.fixtureHostBinding.runApply('restore'); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim()), 'rgb(192, 132, 252)');
    await layer.evaluate(node => node.remove());
    await page.evaluate(() => window.fixtureHostBinding.runApply('stylesheet-removed'));
    await page.waitForFunction(() => getComputedStyle(document.body).getPropertyValue('--fvplus-theme-accent').trim() === 'rgb(79, 139, 255)');
    assert.equal(await page.evaluate(() => document.querySelectorAll('tr.folder, [data-folder-id]').length), before);
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});
}
test('Host theme Docker controls follow dark light and custom accents without moving folder rows', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await installHost(page, baseUrl);
    const rowCount = await page.locator('#docker_list > tr').count();
    for (const light of [false, true, false]) {
        await switchHost(page, light);
        if (!light) await page.evaluate(() => document.documentElement.style.setProperty('--link-text-color', '#b981ff'));
        await page.click('[data-fvplus-docker-action="filter-unassigned"]');
        await page.click('[data-fvplus-docker-action="filter-empty"]');
        await expectAccent(page, '[data-fvplus-docker-action="filter-empty"]');
        const button = page.locator('[data-fvplus-docker-action="filter-empty"]');
        assert.ok(await button.evaluate(node => parseFloat(getComputedStyle(node).borderRadius)) >= 999);
        assert.ok(await button.evaluate(node => node.getBoundingClientRect().height) >= 30);
        await page.click('[data-fvplus-docker-menu="view"]');
        await expectAccent(page, '[data-fvplus-docker-view="folderview"]');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-fvplus-docker-menu="view"]').evaluate(node => node === document.activeElement), true);
        await page.evaluate(() => document.documentElement.style.removeProperty('--link-text-color'));
    }
    await expectAccent(page, '[data-fvplus-docker-action="filter-empty"]');
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
    // Filters can hide rows, but a theme change must not reparent, recreate or reorder them.
    assert.equal(await page.locator('#docker_list > tr').count(), rowCount);
    assert.deepEqual(await page.locator('#docker_list > tr').evaluateAll(rows => rows.map(row => row.dataset.name || row.dataset.folderId)),
        ['media', 'plex', 'sonarr', 'updates', 'toolbox', 'empty', 'orphan']);
});

test('Host theme Aurora Docker toolbar matches native action sizing and restores its fallback', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    for (const name of ['ui.primitives', 'ui.host-buttons']) {
        const style = await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${name}.css` });
        await style.evaluate(node => document.querySelector('link[href*="styles/docker.css"]').before(node));
    }
    await page.addStyleTag({ content: 'html { font-size:10px; }' });
    await installHost(page, baseUrl);
    await page.evaluate(() => { document.getElementById('fixture-external-url').style.color = 'var(--link-text-color)'; });
    const fallback = await page.locator('.fvplus-docker-action-button').first().evaluate(node => ({
        padding: getComputedStyle(node).padding, fontSize: getComputedStyle(node).fontSize
    }));
    // Native button geometry from Aurora v2026.10.21.2202, without its Docker enhancer.
    await page.route('**/plugins/Aurora-Theme/styles/theme.css*', route => route.fulfill({
        contentType: 'text/css', body: `
            :root { --tp-font-heading:Arial,sans-serif; }
            button, input[type="button"] { padding:8px 16px; font-family:var(--tp-font-heading);
                border:1px solid var(--border-color); border-radius:var(--tp-r-full);
                font-size:1.2rem; font-weight:600; line-height:normal; letter-spacing:0; text-transform:none; }
        `
    }));
    await page.evaluate(() => {
        const link = document.createElement('link');
        link.id = 'fixture-aurora-sizing'; link.rel = 'stylesheet';
        link.href = '/plugins/Aurora-Theme/styles/theme.css?v=fixture'; document.head.append(link);
        document.querySelector('.fvplus-docker-action-bar').insertAdjacentHTML('afterend',
            '<div id="fixture-native-actions"><input type="button" value="Add Container"><button type="button">Start All</button></div>');
        window.fixtureNativeActionClicks = 0;
        document.querySelectorAll('#fixture-native-actions > *').forEach(node => {
            node.addEventListener('click', () => window.fixtureNativeActionClicks++);
        });
    });
    await page.waitForFunction(() => document.getElementById('fixture-aurora-sizing').sheet);
    for (const rootSize of ['10px', '12px']) for (const light of [false, true]) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, rootSize);
        await switchHost(page, light);
        await page.click('[data-fvplus-docker-action="filter-empty"]');
        const metrics = await page.evaluate(() => {
            const measure = node => {
                const style = getComputedStyle(node), box = node.getBoundingClientRect();
                return { label: node.value || node.textContent.trim(), height: box.height,
                    padding: style.padding, fontSize: style.fontSize, fontFamily: style.fontFamily };
            };
            const native = [...document.querySelectorAll('#fixture-native-actions > *')].map(measure);
            return { host: native[0], native,
                own: [...document.querySelectorAll('.fvplus-docker-action-button')].map(measure) };
        });
        for (const native of metrics.native) assert.ok(Math.abs(native.height - metrics.host.height) <= 1);
        assert.equal(metrics.own.length, 10);
        for (const button of metrics.own) {
            assert.ok(Math.abs(button.height - metrics.host.height) <= 1, `${button.label}: ${JSON.stringify(metrics)}`);
            assert.equal(button.padding, metrics.host.padding);
            assert.equal(button.fontSize, metrics.host.fontSize);
            assert.equal(button.fontFamily, metrics.host.fontFamily);
        }
    }
    await page.click('#fixture-native-actions input');
    await page.click('#fixture-native-actions button');
    assert.equal(await page.evaluate(() => window.fixtureNativeActionClicks), 2);
    await page.click('[data-fvplus-docker-menu="view"]');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-fvplus-docker-menu="view"]').evaluate(node => node === document.activeElement), true);
    await page.evaluate(() => {
        document.getElementById('fixture-aurora-sizing').remove(); document.documentElement.style.fontSize = '10px';
    });
    assert.deepEqual(await page.locator('.fvplus-docker-action-button').first().evaluate(node => ({
        padding: getComputedStyle(node).padding, fontSize: getComputedStyle(node).fontSize
    })), fallback);
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});

test('Host theme Settings controls inherit host surfaces and accent through theme changes', async ({ page }) => {
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    await page.evaluate(() => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'fv-basic-add-btn'; button.textContent = 'Fixture add folder';
        document.getElementById('fv-settings-root').append(button);
    });
    await installHost(page, baseUrl, '#fv-settings-root');
    for (const light of [false, true]) {
        await switchHost(page, light);
        await page.waitForFunction(() => {
            const button = document.querySelector('.fv-basic-add-btn');
            const probe = document.createElement('span');
            probe.style.color = 'var(--text-color)'; document.body.append(probe);
            const matches = getComputedStyle(button).color === getComputedStyle(probe).color;
            probe.remove(); return matches && button.getAnimations().length === 0;
        });
        const colors = await page.locator('.fv-basic-add-btn').first().evaluate(node => {
            const probe = document.createElement('span');
            probe.style.cssText = 'color:var(--text-color);background:var(--button-background)';
            document.body.append(probe);
            const style = getComputedStyle(node), expected = getComputedStyle(probe);
            const result = { color: style.color, expectedColor: expected.color, background: style.backgroundColor, expectedBackground: expected.backgroundColor };
            probe.remove();
            return result;
        });
        assert.equal(colors.color, colors.expectedColor);
        assert.equal(colors.background, colors.expectedBackground);
    }
});

test('Host theme editor and detached action dialog keep host chrome in light and dark modes', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Add profile' }).click();
    await installHost(page, baseUrl, '.folder-editor-form');
    for (const light of [false, true]) {
        await switchHost(page, light);
        const result = await page.evaluate(() => {
            const dialog = document.createElement('div');
            dialog.className = 'fv-folder-action-dialog ui-dialog';
            document.body.append(dialog);
            const form = document.querySelector('.folder-editor-form');
            const probe = document.createElement('span');
            probe.style.cssText = 'color:var(--text-color);background:var(--background-color)';
            document.body.append(probe);
            const expected = getComputedStyle(probe);
            const result = { expectedColor: expected.color, expectedBackground: expected.backgroundColor,
                formColor: getComputedStyle(form).color, dialogColor: getComputedStyle(dialog).color,
                dialogBackground: getComputedStyle(dialog).backgroundColor };
            dialog.remove(); probe.remove();
            return result;
        });
        assert.equal(result.formColor, result.expectedColor);
        assert.equal(result.dialogColor, result.expectedColor);
        assert.equal(result.dialogBackground, result.expectedBackground);
    }
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running'));
});

test('Host theme modern CSS colors preserve explicit status colors and safety mode round trips', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await installHost(page, baseUrl);
    await page.evaluate(() => {
        const status = document.createElement('span');
        status.id = 'fixture-explicit-status';
        status.className = 'folder-state fv-folder-state-started';
        status.textContent = 'Explicit color';
        const row = document.querySelector('#docker_list > tr.folder');
        row.style.setProperty('--fvplus-folder-status-text', '#ff00aa');
        row.firstElementChild.append(status);
        document.documentElement.style.setProperty('--link-text-color', 'color(srgb 0.31 0.545 1)');
    });
    await page.waitForFunction(() => document.body.style.getPropertyValue('--fvplus-ui-accent').startsWith('rgb('));
    await page.click('[data-fvplus-docker-action="filter-empty"]');
    assert.equal(await page.locator('#fixture-explicit-status').evaluate(node => getComputedStyle(node).color), 'rgb(255, 0, 170)');
    for (const mode of ['safe', 'highcontrast', 'auto']) {
        await page.evaluate(mode => { window.fixtureHostMode = mode; window.fixtureHostBinding.queueApply('mode'); }, mode);
        await page.waitForFunction(mode => document.body.dataset.fvThemeMode === mode, mode);
        assert.equal(await page.locator('#fixture-explicit-status').evaluate(node => getComputedStyle(node).color), 'rgb(255, 0, 170)');
    }
    await page.evaluate(() => {
        document.getElementById('fixture-host-css').remove();
        document.documentElement.classList.remove('fixture-host-dark', 'fixture-host-light');
        document.documentElement.style.removeProperty('--link-text-color');
    });
    await page.waitForFunction(() => document.body.dataset.fvThemeSource === 'fallback');
    assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--fvplus-ui-accent')), '');
    const before = await page.evaluate(() => window.fixtureHostApplyCount);
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => window.fixtureHostApplyCount) - before <= 1, 'theme observers must settle');
});
};
