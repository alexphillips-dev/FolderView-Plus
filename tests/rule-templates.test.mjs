import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const templates = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.rule-templates.js');
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

test('rule templates generate existing compatible rule kinds with escaped values', () => {
    assert.deepEqual(templates.listTemplates('vm').map((entry) => entry.id), ['name-prefix', 'name-contains']);
    const rule = templates.buildTemplateRule({
        templateId: 'name-prefix',
        type: 'docker',
        folderId: 'media',
        value: 'media.+'
    });
    assert.equal(rule.kind, 'name_regex');
    assert.equal(rule.pattern, '^media\\.\\+');
    assert.equal(rule.folderId, 'media');
});

test('Docker label template parses key=value without inventing a rule kind', () => {
    const rule = templates.buildTemplateRule({
        templateId: 'label-equals',
        type: 'docker',
        folderId: 'media',
        value: 'com.example.stack=media'
    });
    assert.equal(rule.kind, 'label');
    assert.equal(rule.labelKey, 'com.example.stack');
    assert.equal(rule.labelValue, 'media');
    assert.throws(() => templates.buildTemplateRule({ templateId: 'label-equals', type: 'docker', folderId: 'media', value: 'missing-separator' }), /key=value/);
});

test('normal additions stay before the explicit final catch-all', () => {
    const catchAll = templates.buildCatchAllRule({ folderId: 'fallback', id: 'catch-all-fixed' });
    const existing = [{ id: 'first', kind: 'name_regex', pattern: '^media', folderId: 'media' }, catchAll];
    const added = { id: 'second', kind: 'name_regex', pattern: '^work', folderId: 'work' };
    assert.deepEqual(templates.insertBeforeCatchAll(existing, added).map((rule) => rule.id), ['first', 'second', 'catch-all-fixed']);
    assert.equal(templates.isExplicitCatchAll(catchAll), true);
    assert.equal(templates.isExplicitCatchAll({ ...catchAll, id: 'ordinary-rule' }), false);
});

test('template preview separates manual members from newly assigned effects', () => {
    const rule = templates.buildTemplateRule({
        templateId: 'name-prefix', type: 'docker', folderId: 'media', value: 'media-', id: 'preview'
    });
    const result = templates.previewRuleEffect({
        rule,
        rules: [],
        items: [{ Name: 'media-one' }, { Name: 'media-two' }, { Name: 'other' }],
        folders: { existing: { containers: ['media-one'] } },
        type: 'docker',
        utils
    });
    assert.deepEqual(result.matched, ['media-one', 'media-two']);
    assert.deepEqual(result.manualMembers, ['media-one']);
    assert.deepEqual(result.newlyAssigned, ['media-two']);
});
