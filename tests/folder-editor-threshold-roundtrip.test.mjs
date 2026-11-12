import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(`${scripts}folder.editor.shared.js`, 'utf8'), context);
const editor = context.window.FolderViewPlusFolderEditorShared.createApi();
const source = fs.readFileSync(`${scripts}folder.js`, 'utf8');
const start = source.indexOf('const parseOptionalThresholdInput =');
const end = source.indexOf('\nconst normalizeDashboardOverflowMode', start);
const parseFormValue = vm.runInNewContext(`${source.slice(start, end)}\nparseOptionalThresholdInput;`);
const fields = ['health_warn_stopped_percent', 'health_critical_stopped_percent', 'status_warn_stopped_percent'];

for (const field of fields) {
    test(`editor preserves explicit zero for ${field} through repeated JSON load and form serialization`, () => {
        let folder = { name: 'Fixture', settings: { [field]: 0 } };
        for (let pass = 0; pass < 3; pass++) {
            const normalized = editor.normalizeFolderRecordForEditor(JSON.parse(JSON.stringify(folder)));
            assert.equal(normalized.settings[field], 0);
            const formValue = String(normalized.settings[field]);
            folder = { ...normalized, settings: { ...normalized.settings, [field]: parseFormValue(formValue) } };
            assert.equal(folder.settings[field], 0);
        }
    });
}

test('shared and form threshold parsers agree on zero, inherited, invalid and bounded values', () => {
    for (const [input, expected] of [[0, 0], ['0', 0], ['', ''], [null, ''], [undefined, ''], ['invalid', ''], [false, ''], [25, 25], [100, 100], [-2, 0], [101, 100]]) {
        assert.equal(editor.parseOptionalThresholdInput(input), expected, `shared ${String(input)}`);
        assert.equal(parseFormValue(input), expected, `form ${String(input)}`);
    }
});
