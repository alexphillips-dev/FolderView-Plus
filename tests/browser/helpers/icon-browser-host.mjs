import fs from 'node:fs';
import assert from 'node:assert/strict';
import { checkIconPackFilters } from './icon-pack-filters.mjs';
import { checkIconCardLayout } from './icon-card-layout.mjs';
export { checkIconCardLayout };
export { checkUploadCardLayout } from './upload-card-layout.mjs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const source = fs.readFileSync(`${plugin}/Folder.page`, 'utf8');
const markup = source.match(/<dd class="fv-icon-dd">([\s\S]*?)<\/dd>/)[0];
const help = source.match(/<p data-i18n="\[html\]icon-tooltip">[\s\S]*?<\/p>/)[0];
export const mountIconBrowser = async (page, baseUrl, type = 'docker') => {
    await page.route(`${baseUrl}/folder-editor`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Icon picker</title><link rel="stylesheet" href="/plugin/styles/theme.tokens.css"><link rel="stylesheet" href="/plugin/styles/folder.css"></head><body><script src="/vendor/jquery.js"></script></body></html>' }));
    await page.goto(`${baseUrl}/folder-editor`);
    await page.route('**/plugins/dynamix.docker.manager/images/question.png', route => route.fulfill({ path: `${plugin}/images/folder-icon.png` }));
    await page.evaluate(({ markup, help, type }) => {
        document.querySelectorAll('style').forEach(node => node.remove());
        document.querySelector('link[href$="/folderviewplus.css"]')?.remove();
        document.body.innerHTML = `<main><h1>Folder icon</h1><div class="canvas"><form class="folder-editor-form" id="icon-test-form" data-type="${type}">
            <div class="basic"><dl><dt>Parent folder</dt><dd><select name="parent_folder_id" aria-label="Parent folder"><option>No parent</option></select><div class="fv-parent-picker-list">${Array.from({ length: 23 }, (_, index) => `<button type="button">Folder ${index + 1}</button>`).join('')}</div></dd></dl></div>
            <div class="basic"><dl><dt>Icon</dt>${markup}</dl><blockquote class="fv-setting-help">${help}</blockquote></div></form></div></main>`;
        document.body.style.cssText = 'background:var(--fvplus-ui-page);color:var(--fvplus-ui-text-primary);font:14px Arial,sans-serif;margin:20px';
        document.documentElement.style.fontSize = '10px';
        document.documentElement.dataset.fvplusHostTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'white' : 'black';
    }, { markup, help, type });
    for (const style of ['ui.primitives.css', 'ui.host-buttons.css']) {
        const link = await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}` });
        await link.evaluate(node => document.head.insertBefore(node, document.querySelector('link[href$="/folder.css"]')));
    }
    for (const name of ['folderviewplus.ui', 'folderviewplus.utils-foundation', 'folder.editor.chrome', 'folder.editor.help', 'folder.editor.icon-browser', 'folder.editor.icons']) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
    }
    await page.evaluate(async () => {
        const defaultIcon = '/plugins/folderview.plus/images/folder-icon.png';
        const input = document.querySelector('[name="icon"]');
        input.value = defaultIcon;
        const builtin = [{ name: 'Default Folder', path: defaultIcon }, { name: 'Tools', path: `${defaultIcon}?tools` }, { name: 'Home Automation', path: `${defaultIcon}?automation` }, { name: 'VeryLongUnbrokenIconNameThatMustStayInsideTheCard', path: `${defaultIcon}?long` }];
        const icons = ['alpha.png', 'beta.png', 'gamma.png'].map((name, index) => ({ name: index === 0 ? 'alpha_with_a_very_long_unbroken_icon_filename.png' : name, folder: index === 2 ? 'Other' : 'Example', url: `${defaultIcon}?collection=${name}`, tags: ['folder', index === 2 ? 'other' : 'alpha'] }));
        const state = { uploads: [], pending: false, complete: null, uploadOptions: null };
        const api = window.FolderViewPlusFolderEditorIcons.createApi({ window, document, $: window.jQuery,
            getForm: () => document.getElementById('icon-test-form'), getIconInput: () => window.jQuery(input),
            getCurrentIconValue: () => input.value, setIconInputValue: value => window.jQuery(input).val(value).trigger('input').trigger('change'),
            defaultFolderIconPath: defaultIcon, iconFallbackPath: defaultIcon,
            escapeHtml: window.FolderViewPlusFoundationModules.utilityFoundation.escapeHtml,
            sanitizeImageUrl: window.FolderViewPlusFoundationModules.utilityFoundation.sanitizeImageUrl,
            requestClient: { getJson: async (url, options) => url.endsWith('.json') ? builtin :
                options.data.action === 'list_folders' ? { ok: true, folders: [{ name: 'Example', iconCount: 2 }, { name: 'Other', iconCount: 1 }] } : { ok: true, icons } },
            folderIconApi: {
                requestCustomIconApi: async (action, payload) => {
                    if (action === 'delete') state.uploads = state.uploads.filter(icon => icon.name !== payload.name);
                    return { ok: true, icons: state.uploads };
                },
                uploadCustomIconFile: async (file, options) => {
                    state.uploadOptions = { dedupe: options.dedupe, replace: options.replace };
                    if (state.pending) await new Promise(resolve => { state.complete = resolve; });
                    const icon = { name: file.name, url: `${defaultIcon}?upload=${file.name}`, usageCount: 0 };
                    state.uploads.push(icon); return icon;
                }
            }
        });
        window.iconBrowserFixture = state;
        await api.bindIconPickerEvents();
    });
};
export const checkIconDialogAccessibility = async page => {
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
        return result.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }));
    });
    assert.deepEqual(violations, []);
};
export const checkIconPackTileLayout = async page => {
    await checkIconCardLayout(page, '.fv-third-party-icon-item');
    const tile = await page.locator('.fv-third-party-icon-item').first().evaluate(node => {
        const rect = node.getBoundingClientRect(), image = node.querySelector('img').getBoundingClientRect(), button = node.querySelector('[data-icon-select]'), star = node.querySelector('.fv-third-party-icon-fav'), favorite = star.getBoundingClientRect();
        return { width: rect.width, height: rect.height, centered: Math.abs((image.left + image.right) / 2 - (rect.left + rect.right) / 2), top: favorite.top - rect.top, right: rect.right - favorite.right, target: favorite.width, font: parseFloat(getComputedStyle(star.querySelector('i')).fontSize), border: getComputedStyle(button).borderTopWidth };
    });
    assert.ok(Math.abs(tile.width - tile.height) < 2 && tile.height <= 100 && tile.centered < 2);
    assert.ok(tile.top <= 4 && tile.right <= 4 && tile.target >= 32 && tile.font >= 18);
    assert.equal(tile.border, '0px');
    await checkIconPackFilters(page, checkIconDialogAccessibility);
};
