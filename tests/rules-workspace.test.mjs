import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const plugin = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const {normalizeBuilderRule, describeCondition, reorderRules} = require(plugin + 'folderviewplus.rules-workspace.js');
const {ruleMatchesItem} = require(plugin + 'folderviewplus.utils-rules.js');
const draft = (kind, pattern, type = 'docker') => normalizeBuilderRule({type, folderId:'folder', effect:'include', kind, pattern});

test('literal operators use the assignment matcher for every supported field and VM names', () => {
    const literal = 'app.[x]+$\\';
    for (const type of ['docker', 'vm']) for (const field of type === 'docker' ? ['name', 'image', 'compose_project'] : ['name']) {
        for (const operator of ['contains', 'starts_with', 'ends_with', 'exact']) {
            const rule = draft(`${field}_${operator}`, literal, type);
            const matches = input => {
                const infos = {sample:{Image:input, Labels:{'com.docker.compose.project':input}}};
                return ruleMatchesItem(rule, field === 'name' ? input : 'sample', infos, type);
            };
            assert.equal(matches(literal), true);
            assert.equal(matches('prefix-' + literal), ['contains', 'ends_with'].includes(operator));
            assert.equal(matches(literal + '-suffix'), ['contains', 'starts_with'].includes(operator));
            assert.equal(matches('app-x'), false);
            const description = describeCondition(rule);
            assert.deepEqual(description, {field, operator, value:literal, labelKey:'', regex:false});
            assert.equal(draft(`${field}_${operator}`, '', type).pattern, '', 'empty values must not compile into a valid anchored pattern');
        }
    }
});

test('existing raw regex and label rules retain their matching contracts when edited', () => {
    for (const pattern of ['^media-(arr|db)$', '.*', '[invalid', '^a\\$b$', '^abc\\\\$', 'a\\$']) {
        const rule = draft('name_regex', pattern);
        const decoded = describeCondition(rule);
        const restored = normalizeBuilderRule({type:'docker', folderId:'folder', effect:'include',
            kind:`name_${decoded.regex ? 'regex' : decoded.operator}`, pattern:decoded.value});
        assert.equal(restored.pattern, rule.pattern);
    }
    const infos = {sample:{Labels:{project:'Media-stack'}}};
    for (const [kind, labelValue, expected] of [['label','',true], ['label','Media-stack',true],
        ['label','media-stack',false], ['label_contains','STACK',true], ['label_starts_with','media',true], ['label_contains','',false]]) {
        const rule = normalizeBuilderRule({type:'docker', folderId:'folder', effect:'exclude', kind, labelKey:'project', labelValue});
        assert.equal(ruleMatchesItem(rule,'sample',infos,'docker'), expected);
        assert.equal(ruleMatchesItem(rule,'sample',infos,'vm'), false);
        const decoded = describeCondition(rule);
        const restored = normalizeBuilderRule({type:'docker', folderId:'folder', effect:'exclude', kind,
            labelKey:decoded.labelKey, labelValue:decoded.value});
        assert.deepEqual(restored, rule);
    }
});

test('rule reorder is immutable and supports both insertion sides without inventing IDs', () => {
    const rules = ['a','b','c','d'].map(id=>Object.freeze({id}));
    Object.freeze(rules);
    assert.deepEqual(reorderRules(rules,'a','c',true).map(rule=>rule.id), ['b','c','a','d']);
    assert.deepEqual(reorderRules(rules,'d','b').map(rule=>rule.id), ['a','d','b','c']);
    assert.equal(reorderRules(rules,'a','a'), null);
    assert.equal(reorderRules(rules,'missing','b'), null);
    assert.equal(reorderRules(rules,'a','missing'), null);
    assert.deepEqual(rules.map(rule=>rule.id), ['a','b','c','d']);
});
