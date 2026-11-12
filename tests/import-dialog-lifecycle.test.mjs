import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js', 'utf8');
const getterSource = source.slice(source.indexOf('    const getImportApplyButton ='), source.indexOf('    const applyImportDialogButtonSkin ='));

const applyButtonFixture = (label, marked = true) => {
    const apply = { label, classList: { contains: name => marked && name === 'fv-import-apply-button' } };
    const cancel = { label: 'Cancel', classList: { contains: () => false } };
    const collection = elements => ({
        filter: predicate => collection(elements.filter((element, index) => predicate(index, element))),
        first: () => elements[0]
    });
    const dialog = { closest: () => ({ find: () => collection([cancel, apply]) }) };
    const $ = element => ({ text: () => element.label });
    return { apply, get: new Function('$', 'dialog', getterSource + '; return getImportApplyButton;')($, dialog) };
};

test('import safety keeps targeting the apply action after its label is localized', () => {
    for (const label of ['Import anwenden', '適用', 'تطبيق الاستيراد']) {
        const { apply, get } = applyButtonFixture(label);
        assert.equal(get(), apply);
    }
    const initial = applyButtonFixture('Apply Import', false);
    assert.equal(initial.get(), initial.apply, 'initial dialog creation still locates its English action');
    assert.equal(applyButtonFixture('Cancel', false).get(), undefined, 'an unmarked unrelated action is excluded');
});

const pickerFixture = (failure = false) => {
    const inputs = [];
    const body = {
        appendChild: input => inputs.push(input),
        removeChild: input => { const index = inputs.indexOf(input); if (index < 0) throw new Error('Already removed'); inputs.splice(index, 1); }
    };
    const document = { body, createElement: () => ({ style: {}, click() {}, remove() { if (inputs.includes(this)) body.removeChild(this); } }) };
    class FileReader {
        readAsText(file) { if (failure) this.onerror(); else { this.result = file.content; this.onload(); } }
    }
    const context = vm.createContext({ document, FileReader });
    const pickerSource = source.slice(source.indexOf('const readFileAsText ='), source.indexOf('let downloadDiagnosticsApi ='));
    vm.runInContext(pickerSource + '\nglobalThis.pick = selectJsonFile;', context);
    return { pick: context.pick, inputs };
};

test('cancelled import picker settles and removes its hidden input on every opening', async () => {
    const fixture = pickerFixture();
    for (let index = 0; index < 2; index++) {
        let settled = false;
        const pending = fixture.pick().then(value => { settled = true; return value; });
        fixture.inputs[0].oncancel?.();
        await Promise.resolve();
        assert.equal(settled, true, 'cancel must unblock wizard finally/cleanup');
        assert.equal(await pending, null);
        assert.equal(fixture.inputs.length, 0);
    }
});

test('import picker retains successful file metadata, empty change, and reader-error contracts', async () => {
    const fixture = pickerFixture();
    const pending = fixture.pick();
    await fixture.inputs[0].onchange({ target: { files: [{ name: 'synthetic.json', content: '{}', size: 2, lastModified: 4 }] } });
    assert.deepEqual(JSON.parse(JSON.stringify(await pending)), { name: 'synthetic.json', text: '{}', size: 2, lastModified: 4 });
    assert.equal(fixture.inputs.length, 0);
    const empty = fixture.pick();
    await fixture.inputs[0].onchange({ target: { files: [] } });
    assert.equal(await empty, null);
    assert.equal(fixture.inputs.length, 0);
    const failed = pickerFixture(true);
    const rejection = assert.rejects(failed.pick(), /Failed to read file/);
    await failed.inputs[0].onchange({ target: { files: [{ name: 'synthetic.json' }] } });
    await rejection;
    assert.equal(failed.inputs.length, 0);
});
