import fs from 'node:fs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const source = fs.readFileSync(`${plugin}/scripts/folder.js`, 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`const ${name} = `) + `const ${name} = `.length, source.indexOf(`\nconst ${next} = `)).trim().replace(/;$/, '');
export const mountSettingsEditor = async (page, baseUrl, type) => {
    const markup = fs.readFileSync(`${plugin}/Folder.page`, 'utf8').match(/<form\b[\s\S]*?<\/form>/)[0].replace(/<\?php[\s\S]*?\?>/g, '');
    await page.route(`${baseUrl}/folder-editor`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folder settings</title><link rel="stylesheet" href="/plugin/styles/theme.tokens.css"><link rel="stylesheet" href="/plugin/styles/csp.utilities.css"><link rel="stylesheet" href="/plugin/styles/folder.css"></head><body><script src="/vendor/jquery.js"></script></body></html>' }));
    await page.goto(`${baseUrl}/folder-editor`);
    await page.route('**/plugins/dynamix.docker.manager/images/question.png', route => route.fulfill({ path: `${plugin}/images/folder-icon.png` }));
    await page.evaluate(({ markup, type }) => {
        document.body.innerHTML = `<main><h1>Folder editor</h1><div class="canvas">${markup}</div></main>`;
        window.FolderViewPlusFolderEditorPageType = type;
        document.documentElement.style.fontSize = '10px';
        document.documentElement.dataset.fvplusHostTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'white' : 'black';
        document.body.style.cssText = 'background:var(--fvplus-ui-page);color:var(--fvplus-ui-text-primary);font:14px Arial,sans-serif;margin:16px';
    }, { markup, type });
    for (const name of ['folderviewplus.folder-contract', 'folder.editor.shared', 'folder.editor.schema', `folder.editor.type-${type}`, 'folder.editor.chrome', 'folder.editor.preview-runtime']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
    await page.evaluate(({ type, applyMode, serializer }) => {
        const form = document.querySelector('form');
        const schema = window.FolderViewPlusFolderEditorSchema.createModernSchema();
        Object.values(schema.SECTION_DEFAULT_VALUES).forEach(fields => Object.entries(fields).forEach(([key, value]) => {
            const field = form.elements.namedItem(key);
            if (!field) return;
            if (field.type === 'checkbox') field.checked = value === true;
            else field.value = String(value);
        }));
        const typeApi = window[type === 'docker' ? 'FolderViewPlusFolderEditorTypeDocker' : 'FolderViewPlusFolderEditorTypeVm'].createApi({});
        const api = window.FolderViewPlusFolderEditorPreviewRuntime.createApi({ window, $, type, getForm: () => form, applyTypePreviewConstraints: typeApi.applyPreviewConstraints });
        const switchSection = new Function('$', 'SECTION_META', `let editorMode, activeEditorSection = 'general'; const normalizeEditorMode = () => 'advanced'; const normalizeActiveEditorSection = value => value; const advancedSectionCollapsedState = {}; const apply = ${applyMode}; return section => { activeEditorSection = section; apply(); };`)($, schema.SECTION_META);
        const contract = window.FolderViewPlusFolderContract;
        const helpers = { ...contract, ...window.FolderViewPlusFolderEditorShared.createApi({}), ...window.FolderViewPlusFolderEditorSchema,
            $, hiddenPreviewMembers: [], getMemberMapByName: () => new Map(), normalizeParentFolderId: value => value,
            getChildFolderOrderIds: () => [], getFolderWebuiProfilesApi: () => null, normalizePreviewStatusMode: value => value,
            DEFAULT_BORDER_COLOR: contract.DEFAULT_PREVIEW_BORDER_COLOR };
        const serialize = new Function(...Object.keys(helpers), `return ${serializer};`)(...Object.values(helpers));
        window.settingsFixture = { form, schema, refresh: api.updatePreviewConstraints, switchSection, serialize: () => serialize(form) };
        $(form).on('change', ':input', api.updatePreviewConstraints);
        $('.fv-section-nav > button').on('click.settingsFixture', function () { switchSection($(this).attr('data-target')); });
        api.updatePreviewConstraints();
        window.FolderViewPlusRevealModernEditorStage?.({ force: true });
        form.classList.remove('fv-modern-editor-booting');
    }, { type, applyMode: extract('applyAdvancedMode', 'getIncludedMemberNames'), serializer: extract('buildFolderPayloadFromForm', 'buildFolderSettingsSummaryHtml') });
};
