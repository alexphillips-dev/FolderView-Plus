import fs from 'node:fs';
import assert from 'node:assert/strict';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const markup = fs.readFileSync(`${plugin}/Folder.page`, 'utf8').match(/<dd class="fv-icon-dd">([\s\S]*?)<\/dd>/)[0];
export const mountIconBrowser = async (page, baseUrl, type = 'docker') => {
    await page.goto(`${baseUrl}/folder-editor`);
    await page.route('**/plugins/dynamix.docker.manager/images/question.png', route => route.fulfill({ path: `${plugin}/images/folder-icon.png` }));
    await page.evaluate(({ markup, type }) => {
        document.querySelectorAll('style').forEach(node => node.remove());
        document.querySelector('link[href$="/folderviewplus.css"]')?.remove();
        document.body.innerHTML = `<main><h1>Folder icon</h1><form class="folder-editor-form" id="icon-test-form" data-type="${type}"><dl><dt>Icon</dt>${markup}</dl></form></main>`;
        document.body.style.cssText = 'background:var(--fvplus-ui-page);color:var(--fvplus-ui-text-primary);font:14px Arial,sans-serif;margin:20px';
        document.documentElement.style.fontSize = '10px';
        document.documentElement.dataset.fvplusHostTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'white' : 'black';
    }, { markup, type });
    for (const style of ['ui.primitives.css', 'ui.host-buttons.css']) {
        const link = await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}` });
        await link.evaluate(node => document.head.insertBefore(node, document.querySelector('link[href$="/folder.css"]')));
    }
    for (const name of ['folderviewplus.ui', 'folderviewplus.utils-foundation', 'folder.editor.icon-browser', 'folder.editor.icons']) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
    }
    await page.evaluate(async () => {
        const defaultIcon = '/plugins/folderview.plus/images/folder-icon.png';
        const input = document.querySelector('[name="icon"]');
        input.value = defaultIcon;
        const builtin = [{ name: 'Default Folder', path: defaultIcon }, { name: 'Tools', path: `${defaultIcon}?tools` }];
        const icons = ['alpha.png', 'beta.png'].map(name => ({ name, folder: 'Example', url: `${defaultIcon}?collection=${name}`, tags: ['folder'] }));
        const state = { uploads: [], pending: false, complete: null, uploadOptions: null };
        const api = window.FolderViewPlusFolderEditorIcons.createApi({ window, document, $: window.jQuery,
            getForm: () => document.getElementById('icon-test-form'), getIconInput: () => window.jQuery(input),
            getCurrentIconValue: () => input.value, setIconInputValue: value => window.jQuery(input).val(value).trigger('input').trigger('change'),
            defaultFolderIconPath: defaultIcon, iconFallbackPath: defaultIcon,
            escapeHtml: window.FolderViewPlusFoundationModules.utilityFoundation.escapeHtml,
            sanitizeImageUrl: window.FolderViewPlusFoundationModules.utilityFoundation.sanitizeImageUrl,
            requestClient: { getJson: async (url, options) => url.endsWith('.json') ? builtin :
                options.data.action === 'list_folders' ? { ok: true, folders: [{ name: 'Example', iconCount: 2 }] } : { ok: true, icons } },
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
