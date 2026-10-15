import fs from 'node:fs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
export const mountActionSettings = async page => {
    const markup = fs.readFileSync(`${plugin}/Folder.page`, 'utf8').split('<div class="templateDialogCustomAction"')[1];
    const source = fs.readFileSync(`${plugin}/scripts/folder.js`, 'utf8');
    const action = source.slice(source.indexOf('const customAction = ') + 'const customAction = '.length, source.indexOf('\n/**\n * Remove a custom action')).trim().replace(/;$/, '');
    await page.evaluate(({ markup, action }) => {
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
            this.wrap('<div class="ui-dialog"></div>');
            const buttons = $('<div class="ui-dialog-buttonpane"></div>').appendTo(this.parent());
            options.buttons.forEach(button => $('<button type="button"></button>').text(button.text).on('click', button.click).appendTo(buttons));
            return this;
        };
        window.actionWidgetOperations = [];
        const helpers = { $, type: 'docker', selectedRegex: [{ Name: 'Example' }], folderEditorShared: window.FolderViewPlusFolderEditorShared,
            surfaceT: (key, fallback, ...args) => fallback.replace(/\$(\d+)/g, (_, n) => args[Number(n) - 1]),
            escapeHtml: value => value, isFormInitialized: false };
        const open = new Function(...Object.keys(helpers), `return ${action};`)(...Object.values(helpers));
        open();
    }, { markup, action });
};
