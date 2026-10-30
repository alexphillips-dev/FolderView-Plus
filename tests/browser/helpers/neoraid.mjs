import fs from 'node:fs';

const css = fs.readFileSync(new URL('../fixtures/vendor/neoraid.css', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../fixtures/vendor/neoraid.js', import.meta.url), 'utf8');
const config = mode => ({ mode, accent:'#ff8c2f', density:'comfortable', radius:'standard', font:'inter', switch:'show' });
const routeAssets = async (page, origin) => {
    const sheet = `${origin}/plugins/neoraid/sheets/Neoraid.css`, js = `${origin}/plugins/neoraid/nr.js`;
    await page.route(sheet, route => route.fulfill({contentType:'text/css',body:css}));
    await page.route(js, route => route.fulfill({contentType:'text/javascript',body:script}));
    return {sheet,js};
};
export const installNeoraid = async (page, origin) => {
    const assets = await routeAssets(page, origin);
    await page.evaluate(options => {
        document.documentElement.classList.add('Theme--black','Theme--nav-top');
        document.documentElement.style.fontSize='10px'; window.nrConfig=options;
    }, config('dark'));
    await page.addStyleTag({url:assets.sheet}); await page.addScriptTag({url:assets.js});
    await page.evaluate(() => document.fonts.ready);
};
export const mountNeoraid = async (page, url) => {
    const origin = new URL(url).origin, assets = await routeAssets(page, origin);
    const mode = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    await page.route(url, async route => {
        const response = await route.fetch();
        const header = `<style>html{font-size:10px}</style><link id="fixture-neoraid" rel="stylesheet" href="${assets.sheet}">`
            + `<script>document.documentElement.classList.add('Theme--black','Theme--nav-top');window.FolderViewPlusHostThemeName='black';window.nrConfig=${JSON.stringify(config(mode))};</script><script src="${assets.js}"></script>`;
        await route.fulfill({response,body:(await response.text()).replace('<head>',()=>'<head>'+header)});
    });
    await page.goto(url,{waitUntil:'load'});
    await page.evaluate(() => document.fonts.ready);
    return async () => {
        await page.evaluate(() => window.fixtureNeoraidBinding?.disconnect());
        await page.unroute(url); await page.unroute(assets.sheet); await page.unroute(assets.js);
    };
};
export const bindNeoraidSurface = async (page, baseUrl, root) => {
    for (const name of ['folderviewplus.theme-integration','folderviewplus.theme-host','folderviewplus.theme-resolver']) {
        const loaded = await page.evaluate(name => name.endsWith('resolver') ? !!window.FolderViewPlusThemeResolver
            : !!window.FolderViewPlusFoundationModules?.[name.endsWith('integration')?'themeIntegration':'themeHost'],name);
        if (!loaded) await page.addScriptTag({url:`${baseUrl}/plugin/scripts/${name}.js`});
    }
    await page.addStyleTag({url:`${baseUrl}/plugin/styles/ui.host-buttons.css`});
    await page.evaluate(root => {
        window.fixtureNeoraidBinding=window.FolderViewPlusThemeResolver.bindThemeAwareSurface({root,sampleRoot:'body',getMode:()=> 'auto',
            onApply:snapshot=>{window.fixtureNeoraidSnapshot=snapshot;}});
        window.fixtureNeoraidBinding.bind();
    },root);
};
