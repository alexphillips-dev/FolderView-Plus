
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

export const installHost = async (page, baseUrl, root = 'body') => {
    // Native Unraid button skins remain present when an external theme is removed.
    await page.addStyleTag({ content: 'button { background-color:#242426; color:inherit; }' });
    await page.addStyleTag({ content: hostCss }).then(style => style.evaluate(node => { node.id = 'fixture-host-css'; }));
    for (const name of ['folderviewplus.theme-integration', 'folderviewplus.theme-host', 'folderviewplus.theme-resolver']) {
        const present = await page.evaluate(name => name.endsWith('resolver') ? !!window.FolderViewPlusThemeResolver
            : !!window.FolderViewPlusFoundationModules?.[name.endsWith('integration') ? 'themeIntegration' : 'themeHost'], name);
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

export const switchHost = async (page, light) => {
    await page.evaluate(light => {
        document.documentElement.classList.toggle('fixture-host-light', light);
        document.documentElement.classList.toggle('fixture-host-dark', !light);
    }, light);
    await page.waitForFunction(light => document.body.dataset.fvThemeClass === (light ? 'light' : 'dark'), light);
};

export const expectAccent = async (page, selector) => {
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
