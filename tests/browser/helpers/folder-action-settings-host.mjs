import fs from 'node:fs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
export const mountActionSettings = async page => {
    const markup = fs.readFileSync(`${plugin}/Folder.page`, 'utf8').split('<div class="templateDialogCustomAction"')[1];
    const source = fs.readFileSync(`${plugin}/scripts/folder.js`, 'utf8');
    const action = source.slice(source.indexOf('const customAction = ') + 'const customAction = '.length, source.indexOf('\n/**\n * Remove a custom action')).trim().replace(/;$/, '');
    const remove = source.slice(source.indexOf('const rCcustomAction ='), source.indexOf('\nwindow.updateIcon ='));
    const encodeStart = source.indexOf('const encodeCustomAction =');
    const encode = encodeStart < 0 ? '' : source.slice(encodeStart, source.indexOf('\nconst customAction =', encodeStart));
    const hydrateStart = source.indexOf('normalizedFolder.actions?.forEach(');
    const hydrate = source.slice(hydrateStart, source.indexOf('\n        });', hydrateStart) + '\n        });'.length);
    await page.evaluate(({ markup, action, remove, encode, hydrate }) => {
        document.body.insertAdjacentHTML('beforeend', `<div class="dialogCustomAction"></div><div class="templateDialogCustomAction"${markup}`);
        // Host-owned jQuery UI/SwitchButton assets are unavailable in the fixture.
        // Keep native inputs and record the multiselect lifecycle calls instead.
        $.i18n = key => key;
        $.fn.switchButton = function () {
            this.removeAttr('data-fvplus-style').after('<button type="button" class="switch-button">Toggle</button>');
            this.next().on('click', function () { const input = $(this).prev()[0]; input.checked = !input.checked; });
            return this;
        };
        $.fn.multiselect = function (operation) { window.actionWidgetOperations.push(operation); return this; };
        $.fn.dialog = function (options) {
            if (typeof options === 'string') return this;
            if (!this.parent().hasClass('ui-dialog')) this.wrap('<div class="ui-dialog"></div>');
            this.parent().children('.ui-dialog-buttonpane').remove();
            const buttons = $('<div class="ui-dialog-buttonpane"></div>').appendTo(this.parent());
            options.buttons.forEach(button => $('<button type="button"></button>').text(button.text).on('click', button.click).appendTo(buttons));
            return this;
        };
        window.actionWidgetOperations = [];
        const helpers = { $, type: 'docker', selectedRegex: [{ Name: 'Example' }], folderEditorShared: window.FolderViewPlusFolderEditorShared,
            surfaceT: (key, fallback, ...args) => fallback.replace(/\$(\d+)/g, (_, n) => args[Number(n) - 1]),
            escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]), isFormInitialized: false };
        const open = new Function(...Object.keys(helpers), `${encode}\nreturn ${action};`)(...Object.values(helpers));
        window.actionSettingsFixture = {
            open,
            remove: new Function('$', 'isFormInitialized', `${remove}\nreturn rCcustomAction;`)($, false),
            hydrate: new Function(...Object.keys(helpers), `${encode}\nreturn actions => { const normalizedFolder = { actions }, customActionWrapper = $('.custom-action-wrapper').empty(); ${hydrate} };`)(...Object.values(helpers))
        };
        open();
    }, { markup, action, remove, encode, hydrate });
};
