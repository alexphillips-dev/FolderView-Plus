import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js', 'utf8');
const start = source.indexOf('const folderAutostart =');
const end = source.indexOf('const dropDownButton =', start);
assert.ok(start >= 0 && end > start);

for (const desired of [true, false]) {
    for (const withDetail of [false, true]) {
        test(`VM folder autostart ${desired ? 'enables' : 'disables'} members ${withDetail ? 'around native detail rows' : 'without detail rows'}`, () => {
            const first = { input: { checked: !desired }, clicks: 0 };
            const unchanged = { input: { checked: desired }, clicks: 0 };
            const last = { input: { checked: !desired }, clicks: 0 };
            const rows = withDetail ? [first, {}, unchanged, {}, last] : [first, unchanged, last];
            const jquery = value => {
                if (typeof value === 'string') {
                    assert.equal(value, 'tr.folder-123-element');
                    return rows;
                }
                return { children: () => ({ last: () => ({ children: selector => {
                    if (selector === '.autostart') return value.input ? [value.input] : [];
                    assert.equal(selector, '.switch-button-background');
                    return { click: () => { value.clicks++; value.input.checked = !value.input.checked; } };
                } }) }) };
            };
            const folderAutostart = new Function('$', source.slice(start, end) + ';return folderAutostart;')(jquery);
            folderAutostart({ target: { checked: desired, id: 'folder-123-auto' } });
            assert.deepEqual([first, unchanged, last].map(row => row.input.checked), [desired, desired, desired]);
            assert.deepEqual([first, unchanged, last].map(row => row.clicks), [1, 0, 1]);
        });
    }
}
