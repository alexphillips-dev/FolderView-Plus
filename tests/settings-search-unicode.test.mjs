import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-search.js');

for (const label of ['Настройки', '设置', 'الإعدادات', '設定', '설정']) {
    test(`Settings search matches a localized section: ${label}`, () => {
        const section = { key: 'localized', title: label, heading: {}, nodes: [], advancedGroup: 'appearance' };
        const state = { mode: 'advanced', advancedTab: 'appearance', query: label, sections: [section] };
        const api = search.createApi({ window: {}, getUiState: () => state });
        assert.ok(search.tokenize(label).length > 0, 'localized text must remain a searchable query');
        assert.equal(api.evaluate().total, 1);
        assert.equal(api.evaluate().matches[0].sectionKey, 'localized');
        state.query = 'unrelated';
        assert.equal(api.evaluate().total, 0);
        state.query = '';
        assert.equal(api.evaluate().total, 0);
    });
}

test('Settings search retains accent folding, separators, case folding and token deduplication', () => {
    assert.deepEqual(search.tokenize(' RÉGLAGES / réglages — １２３ '), ['reglages', '123']);
    assert.deepEqual(search.tokenize('--- 🎉'), []);
    assert.equal(search.normalizeText('Crème brûlée'), 'creme brulee');
});
