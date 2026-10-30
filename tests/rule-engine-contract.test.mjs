import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const utils = require(path.join(plugin, 'scripts/folderviewplus.utils.js'));
const templates = require(path.join(plugin, 'scripts/folderviewplus.rule-templates.js'));
const rule = (fields = {}) => ({ id: 'fixture-rule', enabled: true, folderId: 'media', effect: 'include', kind: 'name_regex', pattern: '^media', labelKey: '', labelValue: '', ...fields });
const loadFunction = (file, name, nextName, sandbox) => {
    const source = fs.readFileSync(path.join(plugin, 'scripts', file), 'utf8');
    const start = source.indexOf('const ' + name + ' =');
    const end = source.indexOf('const ' + nextName + ' =', start);
    assert.ok(start >= 0 && end > start);
    return vm.runInNewContext(source.slice(start, end) + '\n' + name, sandbox);
};
const runPhp = (request) => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-rules-contract-'));
    try {
        fs.writeFileSync(path.join(fixtureRoot, 'request.json'), JSON.stringify(request));
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/rule-engine.php'), fixtureRoot, path.join(plugin, 'server')], { encoding: 'utf8', timeout: 30000 }));
    } finally {
        assert.equal(path.dirname(path.resolve(fixtureRoot)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(fixtureRoot).startsWith('fvplus-rules-contract-'));
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
};

test('browser and server share ordered predicate, Unicode and target contracts', () => {
    const fields = [
        {},
        { pattern: '\\u0061', name: 'a' },
        { pattern: '\\u00e4+', name: '\u00e4\u00e4' },
        { pattern: '\\uD83D\\uDE00', name: '\u{1F600}' },
        { pattern: '^\\u{61}$', name: 'a' },
        { pattern: '^\\u{61}+$', name: 'aa' },
        { pattern: '^\\p{L}+$', name: '\u00e4a' },
        { pattern: '^\\u{1F600}$', name: '\u{1F600}' },
        { pattern: '^\\\\u0061$', name: '\\u0061' },
        { pattern: '^repo\\/', name: 'repo/app' },
        { pattern: '^.$', name: '\u{1F600}' },
        { pattern: '^..$', name: '\u{1F600}' },
        { pattern: ' ', name: 'space fixture' },
        { pattern: '^[a?+]+$', name: 'a' },
        { pattern: '^[a}+]+$', name: 'a' },
        { pattern: '^\\\\A$', name: '\\A' },
        { kind: 'label', labelKey: 'stack', labelValue: 'media', pattern: '' },
        ...['label_contains', 'label_starts_with'].flatMap(kind => [
            { kind, labelKey: 'stack', labelValue: '\u00e4', label: '\u00c4 fixture' },
            { kind, labelKey: 'stack', labelValue: '\u03c3', label: '\u03c2 fixture' },
            { kind, labelKey: 'stack', labelValue: 'a.b', label: 'a.b fixture' }
        ]),
        { kind: 'image_regex', pattern: '^repo/', image: 'repo/app:latest' },
        { kind: 'compose_project_regex', pattern: '^media$' },
        { enabled: false },
        { effect: 'exclude', folderId: 'deleted' },
        { folderId: 'deleted' },
        { kind: 'label', type: 'vm', labelKey: 'stack', labelValue: '' },
        { pattern: '[' }
    ];
    const cases = fields.map(({ name = 'media-fixture', label = 'media', image = 'repo/app', type = 'docker', ...fields }) => ({
        type, name, folders: { media: {}, fallback: {} },
        rules: [rule(fields), rule({ id: 'fallback', folderId: 'fallback', pattern: '^' })],
        info: { [name]: { Labels: { stack: label, 'com.docker.compose.project': 'media' }, Image: image } }
    }));
    const server = runPhp({ cases });
    const decisionId = decision => [decision.assignedRule?.id || null, decision.blockedBy?.id || null];
    for (const [index, entry] of cases.entries()) {
        const browser = utils.getAutoRuleDecision({ ...entry, infoByName: entry.info });
        assert.deepEqual(decisionId(server[index]), decisionId(browser), JSON.stringify(fields[index]));
    }
    assert.equal(server.at(-3).assignedRule.id, 'fallback', 'an orphan include must not shadow a valid later target');
    assert.equal(server.at(-4).blockedBy.id, 'fixture-rule', 'exclude remains global when its old target disappears');
});

test('template preview evaluates the exact candidate sequence saved before catch-all', () => {
    const catchAll = templates.buildCatchAllRule({ folderId: 'fallback', id: 'catch-all-fixture' });
    const candidate = rule();
    const input = { rule: candidate, rules: [catchAll], items: [{ Name: 'media-fixture' }], folders: { media: {}, fallback: {} }, type: 'docker', utils };
    assert.deepEqual(templates.previewRuleEffect(input).newlyAssigned, ['media-fixture']);
    assert.deepEqual(templates.previewRuleEffect({ ...input, rules: [rule({ id: 'earlier' }), catchAll] }).alreadyControlled, ['media-fixture']);
    assert.deepEqual(templates.previewRuleEffect({ ...input, rules: [rule({ id: candidate.id }), catchAll] }).alreadyControlled, ['media-fixture']);
    assert.deepEqual(templates.previewRuleEffect({ ...input, folders: { media: { containers: ['media-fixture'] } } }).manualMembers, ['media-fixture']);
});

test('simulator and template preview skip orphan include targets through actual callers', () => {
    const folders = { media: { name: 'Media', containers: [] } };
    const rules = [rule({ id: 'orphan', folderId: 'deleted' }), rule()];
    const info = { 'media-fixture': { Name: 'media-fixture' } };
    const result = runPhp({ operation: 'preview-apply', type: 'vm', folders, rules, info });
    assert.equal(result.preview.rows[0].folderId, 'media');
    assert.deepEqual(templates.previewRuleEffect({ rule: rule({ id: 'new' }), rules: [rules[0]], items: Object.values(info), folders, type: 'docker', utils }).newlyAssigned, ['media-fixture']);
});

test('wizard additions preserve order and enter before explicit catch-all', async () => {
    const prefsByType = { docker: { autoRules: [templates.buildCatchAllRule({ folderId: 'fallback', id: 'catch-all-fixture' })] } };
    const apply = loadFunction('folderviewplus.wizard.js', 'applySetupAssistantRulesForType', 'buildSetupAssistantReviewNotes', {
        normalizeManagedType: type => type, setupAssistantState: { ruleBootstrap: { docker: { enabled: true, suggestions: [{ folderName: 'media', pattern: '^media' }, { folderName: 'media', pattern: '^media' }] } } },
        prefsByType, utils, ruleTemplatesModule: templates, resolveSetupAssistantFolderId: () => 'media', postPrefs: async (_, prefs) => prefs
    });
    const result = await apply('docker');
    assert.equal(result.created, 1);
    assert.equal(result.skipped, 1);
    assert.equal(utils.getAutoRuleDecision({ rules: prefsByType.docker.autoRules, name: 'media-fixture', infoByName: {}, type: 'docker' }).assignedRule.folderId, 'media');
});

test('recovery comparison detects rule content and ordering changes', () => {
    const sandbox = { utils, importT: (_, fallback, ...params) => fallback.replace(/\$(\d+)/g, (_, index) => String(params[Number(index) - 1])) };
    const compare = loadFunction('folderviewplus.import.js', 'buildBackupPrefsDiff', 'getBackupCompareActionLabels', sandbox);
    const serialize = loadFunction('folderviewplus.import.js', 'serializePrefsDiffValue', 'buildBackupPrefsDiff', sandbox);
    const first = rule(), second = rule({ id: 'second', folderId: 'other', pattern: '^other' });
    for (const next of [[first], [second, first], [{ ...first, enabled: false }, second], [{ ...first, effect: 'exclude' }, second], [{ ...first, folderId: 'other' }, second]]) {
        assert.ok(compare({ autoRules: [first, second] }, { autoRules: next }).rows.some(row => row.key === 'autoRules'));
    }
    assert.match(serialize([first], 'autoRules'), /fixture-rule/);
    assert.doesNotMatch(serialize([first], 'autoRules'), /\[object Object\]/);
    const many = Array.from({ length: 8 }, (_, index) => rule({ id: 'rule-' + index }));
    const changed = many.map((entry, index) => index === 7 ? { ...entry, enabled: false } : entry);
    assert.notEqual(serialize(many, 'autoRules'), serialize(changed, 'autoRules'));
});

test('simulator refuses missing previews and local changes during confirmation', async () => {
    for (const missing of [true, false]) {
        let signature = 'reviewed', pending, writes = 0;
        const errors = [];
        const preview = { digest: 'a'.repeat(64), clientSignature: signature, ready: true, assignments: [{}],
            rows: [{ result: 'assigned', folderId: 'media', item: 'media-fixture', apply: true }] };
        const apply = loadFunction('folderviewplus.js', 'applyRuleSimulatorAssignments', 'toggleTemplateSelection', {
            lastRulePreviewRowsByType: { docker: missing ? null : preview }, rulePreviewInputSignature: () => signature,
            surfaceT: (_, fallback) => fallback, swal: (_, callback) => { signature = 'changed'; pending = callback(true); },
            ensureRuntimeConflictActionAllowed: () => true, withAdvancedOperationLock: async (_, __, ___, callback) => callback(),
            apiPostJson: async () => { writes++; }, showError: (_, error) => errors.push(error.message)
        });
        apply('docker'); await pending;
        assert.equal(writes, 0);
        assert.match(errors[0], /preview changed/);
    }
});

test('an older or locally invalidated server preview cannot replace the reviewed plan', async () => {
    let signature = 'first', complete;
    const cache = { docker: null }, rendered = [];
    const run = loadFunction('folderviewplus.js', 'runRuleSimulator', 'applyRuleSimulatorAssignments', {
        rulePreviewInputSignature: () => signature, lastRulePreviewRowsByType: cache,
        apiGetJson: () => new Promise(resolve => { complete = resolve; }),
        renderRulePreviewRows: (_, rows) => rendered.push(rows), trackDiagnosticsEvent: async () => {},
        showError: () => {}, surfaceT: (_, fallback) => fallback
    });
    const pending = run('docker'); signature = 'changed';
    complete({ ok: true, preview: { rows: [], digest: 'a'.repeat(64) } }); await pending;
    assert.equal(rendered.length, 0);
    assert.equal(cache.docker, null);
});

test('diagnostics applies FV3 ownership instead of reporting a false effective conflict', () => {
    const result = runPhp({
        operation: 'diagnostics',
        folders: { A: { name: 'A', membershipPolicy: 'folderview3', containers: ['media-fixture'] }, B: { name: 'B', membershipPolicy: 'folderview3', containers: [] } },
        info: { 'media-fixture': { Labels: { 'folder.view3': 'B' }, info: { State: { Running: true } } } },
        rules: [rule({ folderId: 'B' })]
    });
    assert.equal(result.snapshot.folders.A.members.total, 1);
    assert.equal(result.snapshot.folders.B.members.total, 0);
    assert.equal(result.integrity.duplicateAssignments.effective.count, 0);
});

test('Command runtime scope includes an automatically populated folder through the shared resolver', () => {
    const runtimeInfo = require(path.join(plugin, 'scripts/docker.runtime.info.js'));
    const folders = { media: { name: 'Media', containers: [] } };
    let rules = [rule()];
    const info = { 'media-fixture': { id: 'fixture', info: { State: { Running: true }, Config: { Labels: {} } } } };
    const api = runtimeInfo.createApi({
        window: {}, getGlobalFolders: () => folders, getDockerRuntimeInfoMap: () => info,
        readEffectiveFolderNames: folder => utils.getEffectiveFolderMembers({
            type: 'docker', folderId: 'media', folder, folders, infoByName: info, rules
        }).members
    });
    assert.deepEqual(Object.keys(api.getScopedRuntimeContainersForFolder('media', true)), ['media-fixture']);
    assert.deepEqual(utils.planFolderRuntimeAction({ type: 'docker', folderId: 'media', folder: folders.media, folders, infoByName: info, rules: [rule()], action: 'stop' }).eligible.map(item => item.name), ['media-fixture']);
    rules = [];
    assert.deepEqual(Object.keys(api.getScopedRuntimeContainersForFolder('media', true)), []);
});

test('snapshot preserves provenance, missing references, effective overlap and distinct display ownership', () => {
    const folders = {
        first: { name: 'First', containers: ['media-fixture', 'missing'], regex: '^media' },
        second: { name: 'Second', parentId: 'first', containers: [], regex: '^media' }
    };
    const infoByName = { 'media-fixture': { id: 'stable', Labels: { 'folderview.plus': 'Second' } } };
    const rules = [rule({ folderId: 'second' })];
    const snapshot = utils.buildMembershipSnapshot({ type: 'docker', folders, rules, infoByName });
    assert.deepEqual(snapshot.byFolder.first.manualMembers, ['media-fixture', 'missing']);
    assert.deepEqual(snapshot.byFolder.first.liveMembers, ['media-fixture']);
    assert.deepEqual(snapshot.byFolder.second.reasonsByName['media-fixture'], ['regex', 'label', 'rule']);
    assert.deepEqual(snapshot.byFolder.second.displayMembers, []);
    assert.equal(snapshot.primaryOwnerByName['media-fixture'], 'first');
    assert.deepEqual(utils.getMembershipBranchMembers(snapshot, 'first'), ['media-fixture']);
    assert.deepEqual(utils.getMembershipBranchMembers(snapshot, 'first', false, 'members'), ['media-fixture', 'missing']);
    const reversed = utils.buildMembershipSnapshot({ type: 'docker', folders: { second: folders.second, first: folders.first }, rules, infoByName });
    assert.equal(reversed.primaryOwnerByName['media-fixture'], 'second');
    const excluded = utils.buildMembershipSnapshot({ type: 'docker', folders, rules: [rule({ effect: 'exclude' })], infoByName });
    assert.deepEqual(excluded.byFolder.second.reasonsByName['media-fixture'], ['regex', 'label']);
    assert.equal(snapshot.issues.length, 0);
});

test('JavaScript and PHP snapshots preserve native and mixed FV3 ownership sets', () => {
    for (const policy of ['', 'folderview3']) {
        const folders = {
            first: { name: 'First', containers: ['media-fixture', 'missing'], membershipPolicy: policy, regex: '^media' },
            second: { name: 'Second', containers: [], membershipPolicy: 'folderview3' }
        };
        const info = { 'media-fixture': { id: 'stable', Labels: { 'folder.view3': 'Second' } }, 'folder-first': { id: 'prefix' } };
        const rules = [rule({ folderId: 'second' })];
        const browser = utils.buildMembershipSnapshot({ type: 'docker', folders, rules, infoByName: info });
        const server = runPhp({ operation: 'membership', type: 'docker', folders, rules, info });
        for (const id of Object.keys(folders)) {
            assert.deepEqual([...browser.byFolder[id].members].sort(), [...server.byFolder[id].members].sort());
            assert.deepEqual(browser.byFolder[id].displayMembers, server.byFolder[id].displayMembers);
        }
        assert.equal(server.byFolder.second.members.length, 0, 'explicit ownership wins across native and migrated folders');
    }
});

test('snapshots own their data and signatures track relevant matching facts', () => {
    const input = { type: 'docker', folders: { media: { name: 'Media', containers: [] } }, rules: [rule({ kind: 'label', labelKey: 'stack', labelValue: 'media' })],
        infoByName: { 'media-fixture': { id: 'stable', Image: 'repo/app', Labels: { stack: 'media', 'net.unraid.docker.icon': 'old' }, info: { State: { Running: false } } } } };
    const snapshot = utils.buildMembershipSnapshot(input);
    const original = utils.getMembershipSignature(input);
    input.infoByName['media-fixture'].info.State.Running = true;
    input.infoByName['media-fixture'].Labels['net.unraid.docker.icon'] = 'new';
    assert.equal(utils.getMembershipSignature(input), original, 'state and unrelated presentation labels do not invalidate membership');
    input.infoByName['media-fixture'].Labels.stack = 'other';
    assert.notEqual(utils.getMembershipSignature(input), original);
    assert.deepEqual(snapshot.byFolder.media.liveMembers, ['media-fixture']);
    assert.equal(snapshot.factsByName['media-fixture'].Labels.stack, 'media');
    assert.throws(() => snapshot.byFolder.media.liveMembers.push('mutation'), TypeError);
    input.rules[0].folderId = 'other';
    assert.equal(snapshot.decisionsByName['media-fixture'].assignedRule.folderId, 'media');
});

test('one snapshot compiles each regex once rather than once per folder and item', () => {
    let constructions = 0;
    class CountedRegExp extends RegExp { constructor(...args) { super(...args); constructions++; } }
    const modules = {
        utilityFoundation: require(path.join(plugin, 'scripts/folderviewplus.utils-foundation.js')),
        utilityNormalization: require(path.join(plugin, 'scripts/folderviewplus.utils-normalization.js')),
        utilityTransfer: require(path.join(plugin, 'scripts/folderviewplus.utils-transfer.js')),
        legacyMembership: require(path.join(plugin, 'scripts/folderviewplus.membership.js'))
    };
    const root = { FolderViewPlusFoundationModules: modules };
    vm.runInNewContext(fs.readFileSync(path.join(plugin, 'scripts/folderviewplus.rules-engine.js'), 'utf8'), { globalThis: root, RegExp: CountedRegExp });
    const folders = Object.fromEntries(Array.from({ length: 6 }, (_, index) => ['f' + index, { name: 'Folder ' + index, containers: [] }]));
    const rules = Array.from({ length: 12 }, (_, index) => rule({ id: 'rule-' + index, folderId: 'f0', pattern: '^never-' + index }));
    const infoByName = Object.fromEntries(Array.from({ length: 30 }, (_, index) => ['item-' + index, {}]));
    modules.rulesEngine.buildMembershipSnapshot({ type: 'docker', folders, rules, infoByName });
    assert.equal(constructions, 12);
});

test('compatibility wrappers retain optional folder maps, name subsets and null facts', () => {
    const folder = { name: 'Media', containers: [], regex: '^item-' };
    const infoByName = { 'item-one': {}, 'item-two': {} };
    const rules = [rule({ folderId: 'other', pattern: '^item' }), rule({ pattern: '^item' })];
    const target = { type: 'docker', folderId: 'media', folder: { ...folder, regex: '' }, rules, infoByName };
    assert.deepEqual(utils.getEffectiveFolderMembers(target).members, []);
    assert.deepEqual(utils.getEffectiveFolderMembers({ ...target, folder, rules: [], names: ['item-one'] }).members, ['item-one']);
    assert.deepEqual(utils.getEffectiveFolderMembers({ ...target, folder, rules: [], names: null }).members, ['item-one', 'item-two']);
    assert.equal(utils.getAutoRuleDecision({ type: 'docker', rules: [rule({ kind: 'label', labelKey: 'stack' })], name: 'item-one', infoByName: null }).assignedRule, null);
    assert.deepEqual(utils.getEffectiveFolderMembers({ type: 'docker', folderId: 'media', folder: { containers: ['manual'] }, folders: {}, infoByName: {} }).members, ['manual']);
});

test('explicit display order changes primary ownership without changing FV3 policy precedence', () => {
    const folders = {
        1: { name: 'One', containers: ['item'], regex: '^item' },
        2: { name: 'Two', containers: [], regex: '^item' },
        migrated: { name: 'Migrated', membershipPolicy: 'folderview3', containers: ['item'] },
        orphan: { name: 'Orphan', parentId: 'missing', containers: ['item'] }
    };
    const input = { type: 'docker', folders, rules: [], infoByName: { item: {} } };
    const first = utils.buildMembershipSnapshot(input);
    const second = utils.buildMembershipSnapshot({ ...input, displayFolderIds: ['2', '1', 'migrated', 'orphan'] });
    assert.equal(first.primaryOwnerByName.item, '1');
    assert.equal(second.primaryOwnerByName.item, '2');
    assert.deepEqual(first.byFolder.migrated.members, second.byFolder.migrated.members);
    assert.deepEqual(second.byFolder.migrated.members, []);
    assert.notEqual(first.signature, second.signature);
    assert.deepEqual(utils.getMembershipBranchMembers(second, 'missing'), []);
});


test('server preview is read-only and apply materializes the reviewed manual assignment with backup', () => {
    const result = runPhp({ operation: 'preview-apply', type: 'vm', folders: { media: { name: 'Media', containers: [] } },
        rules: [rule()], info: { 'media-fixture': { uuid: 'stable' } } });
    assert.equal(result.readOnly, true);
    assert.equal(result.error, null);
    assert.equal(result.result.assignedCount, 1);
    assert.ok(result.result.backup.name);
    assert.deepEqual(result.folders.media.containers, ['media-fixture']);
});

test('server rejects stale config, inventory and matching metadata before backup or mutation', () => {
    const base = { operation: 'preview-apply', type: 'docker', folders: { media: { name: 'Media', containers: [] } },
        rules: [rule({ kind: 'label', labelKey: 'stack', labelValue: 'media' })],
        info: { 'media-fixture': { id: 'same', Labels: { stack: 'media' }, Image: 'repo/app' } } };
    for (const change of [
        { nextInfo: {} },
        { nextInfo: { 'media-fixture': { ...base.info['media-fixture'], id: 'recreated' } } },
        { nextInfo: { 'media-fixture': { ...base.info['media-fixture'], Labels: {} } } },
        { nextInfo: { 'media-fixture': { ...base.info['media-fixture'], Image: 'repo/new' } } },
        { mutateRules: [rule({ pattern: '^changed' })] },
        { mutateFolders: { media: { name: 'Renamed', containers: [] } } },
        { corrupt: true }
    ]) {
        const result = runPhp({ ...base, ...change });
        assert.equal(result.readOnly, true);
        assert.ok(result.error, JSON.stringify(change));
        assert.equal(result.failedApplyReadOnly, true, JSON.stringify(change));
        assert.equal(result.result, null);
    }
});

test('state changes and unrelated labels do not invalidate an unchanged no-op preview', () => {
    const base = { id: 'stable', Labels: { stack: 'media', icon: 'old' }, Image: 'repo/app', info: { State: { Running: false } } };
    const result = runPhp({ operation: 'preview-apply', type: 'docker', folders: { media: { name: 'Media', containers: ['media-fixture'] } },
        rules: [rule({ kind: 'label', labelKey: 'stack', labelValue: 'media' })], info: { 'media-fixture': base },
        nextInfo: { 'media-fixture': { ...base, Labels: { ...base.Labels, icon: 'new' }, info: { State: { Running: true } } } } });
    assert.equal(result.error, null);
    assert.equal(result.result.assignedCount, 0);
    assert.equal(result.result.backup, null);
});

test('accepted runtime snapshots track label/image changes and retain stable canonical Docker identities', () => {
    const runtimeInfo = require(path.join(plugin, 'scripts/docker.runtime.info.js'));
    const folders = { media: { name: 'Media', containers: [] } };
    const info = { app: { id: 'abcdef123456', Labels: { stack: 'media' }, Image: 'repo/app' } };
    const options = { type: 'docker', folders, rules: [rule({ kind: 'label', labelKey: 'stack', labelValue: 'media' })], infoByName: info };
    const cache = utils.buildFolderMatchCache(options), snapshot = utils.getMembershipSnapshotFromCache(cache);
    assert.equal(JSON.stringify(cache).includes('factsByName'), false);
    const api = runtimeInfo.createApi({ window: {}, utils, getGlobalFolders: () => folders, getDockerRuntimeInfoMap: () => info });
    api.setMembershipSnapshot(snapshot);
    assert.deepEqual(Object.keys(api.getScopedRuntimeContainersForFolder('media', true)), ['app']);
    assert.equal(api.membershipInputsChanged({ app: { ...info.app, id: 'server:abcdef1234567890', shortId: 'abcdef123456' } }), false);
    info.app.Labels = {};
    assert.equal(api.membershipInputsChanged(info), true);
    api.setMembershipSnapshot(utils.buildMembershipSnapshot(options));
    assert.deepEqual(Object.keys(api.getScopedRuntimeContainersForFolder('media', true)), []);
});

test('new or changed server rules reject invalid syntax/enums without blocking unchanged historical rules', () => {
    const base = { operation: 'validate', type: 'docker', folders: { media: {} }, current: [], next: [] };
    for (const invalid of [rule({ pattern: '[' }), rule({ pattern: '^(?<letter>a)\\g{letter}$' }), rule({ kind: 'unknown' }), rule({ effect: 'unknown' }), rule({ pattern: ['invalid'] })]) {
        assert.equal(runPhp({ ...base, next: [invalid] }), false);
        assert.equal(runPhp({ ...base, current: [invalid], next: [invalid] }), true);
        assert.equal(runPhp({ ...base, current: [invalid], next: [invalid, invalid] }), false);
    }
    assert.equal(runPhp({ ...base, next: [rule({ effect: 'exclude', folderId: 'missing' })] }), true);
    const invalid = rule({ pattern: '[' }), valid = rule({ id: 'valid' });
    const normalized = utils.normalizePrefs({ autoRules: [invalid] }).autoRules[0];
    assert.equal(runPhp({ ...base, current: [invalid, valid], next: [normalized, { ...valid, pattern: '^changed' }] }), true);

});

test('Docker startup follows shared display ownership while preserving FV3 definition policy', () => {
    const folders = { a: { name: 'A', containers: ['media-fixture'] },
        b: { name: 'B', containers: [], regex: '^media' },
        migrated: { name: 'Migrated', containers: ['media-fixture'], membershipPolicy: 'folderview3' } };
    const info = { 'media-fixture': { id: 'stable', Labels: { 'folder.view3': 'Migrated' } } }, rules = [rule({ folderId: 'b' })];
    const server = runPhp({ operation: 'startup', folders, rules, info });
    const snapshot = utils.buildMembershipSnapshot({ type: 'docker', folders: server.folders, rules, infoByName: info, displayFolderIds: server.order });
    for (const id of Object.keys(folders)) assert.deepEqual(server.members['folder-' + id], snapshot.byFolder[id].displayMembers);
});

test('lightweight Docker and Dashboard metadata refreshes replace images and removed labels', () => {
    const runtimeInfo = require(path.join(plugin, 'scripts/docker.runtime.info.js'));
    const api = runtimeInfo.createApi({ window: {}, utils, getDockerRuntimeInfoMap: () => ({}) });
    const previous = { item: { id: 'abcdef123456', image: 'repo/old', Image: 'repo/old', Labels: { stack: 'old' },
        info: { Config: { Image: 'repo/old', Labels: { stack: 'old' } }, State: { Running: true, Status: 'Up' } } } };
    const raw = { item: { id: 'abcdef123456', Image: 'repo/new', Labels: {}, state: 'running', running: true, status: 'Up' } };
    const next = api.normalizeDockerRuntimeInfoMap(raw, previous);
    assert.equal(next.item.image, 'repo/new');
    assert.deepEqual(next.item.Labels, {});
    const normalize = loadFunction('dashboard.js', 'normalizeDashboardRuntimeInfoMap', 'getDashboardRuntimeStateMeta', {});
    const dashboard = normalize('docker', raw, previous);
    assert.equal(dashboard.item.image, 'repo/new');
    assert.equal(Object.keys(dashboard.item.Labels).length, 0);
    const options = { type: 'docker', folders: { media: {} }, rules: [rule({ kind: 'image_regex', pattern: 'repo/new' })] };
    assert.deepEqual(utils.buildMembershipSnapshot({ ...options, infoByName: next }).byFolder.media.liveMembers, ['item']);
    assert.deepEqual(utils.buildMembershipSnapshot({ ...options, infoByName: dashboard }).byFolder.media.liveMembers, ['item']);
});

test('host update cells resolve short IDs without inventing membership inventory', () => {
    const saved = Object.fromEntries(['Node', 'Element', 'HTMLElement'].map(key => [key, globalThis[key]]));
    class ElementFixture {
        constructor(id = '') { this.id = id; this.dataset = {}; this.textContent = 'up-to-date'; }
        closest() { return this; }
        querySelector(selector) { return selector === 'td.updatecolumn' ? cell : null; }
    }
    const cell = new ElementFixture(), row = new ElementFixture('ct-abcdef123456');
    for (const key of Object.keys(saved)) globalThis[key] = ElementFixture;
    try {
        let runtime = { canonical: { id: 'abcdef1234567890', info: { State: { manager: 'dockerman', Updated: false } } } };
        let indexBuilds = 0;
        const grouping = require(path.join(plugin, 'scripts/docker.runtime.folder-grouping.js'));
        const api = require(path.join(plugin, 'scripts/docker.runtime.info.js')).createApi({
            window: {}, grouping: { ...grouping, buildIdentityIndex: map => { indexBuilds++; return grouping.buildIdentityIndex(map); } },
            document: { getElementById: id => id === 'ct-abcdef123456' ? row : null, querySelectorAll: () => assert.fail('Known short IDs must use direct row lookup') },
            getDockerRuntimeInfoMap: () => runtime, setDockerRuntimeInfoMap: next => { runtime = next; }
        });
        assert.equal(api.getDockerHostRowContainerName(row), 'canonical');
        assert.equal(api.readDockerHostRowUpdatedState('canonical'), true);
        assert.equal(api.applyDockerRuntimeEntryUpdatedState('abcdef123456', true), true);
        assert.deepEqual(Object.keys(runtime), ['canonical']);
        assert.equal(runtime.canonical.info.State.Updated, true);
        assert.equal(api.applyDockerRuntimeEntryUpdatedState('abcdef123456', false), true);
        assert.equal(indexBuilds, 1, 'metadata-only writes reuse the existing identity index');
        runtime = { canonical: { ...runtime.canonical, id: 'fedcba6543217890' } };
        assert.equal(api.getDockerHostRowContainerName('ct-fedcba654321'), 'canonical');
        assert.equal(indexBuilds, 2, 'a fresh authoritative map rebuilds the identity index');
        assert.equal(api.applyDockerRuntimeEntryUpdatedState('unknown', false), false);
        assert.deepEqual(Object.keys(runtime), ['canonical']);
    } finally {
        for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    }
});

test('full detail hydration preserves omitted host metadata and respects explicit source values', () => {
    const api = require(path.join(plugin, 'scripts/docker.runtime.info.js')).createApi({window:{}});
    const previous = { app: { info: {State:{Updated:true, manager:'dockerman'}, Config:{}} } };
    for (const supplied of [{}, {Updated:false}, {Updated:null}, {manager:'compose'}]) {
        const source = {app:{info:{Name:'/app', State:{Running:true, ...supplied}, Config:{}}}};
        const normalized = api.normalizeDockerRuntimeInfoMap(source, previous).app;
        assert.equal(normalized.info.Name, 'app');
        const result = normalized.info.State;
        assert.equal(result.Updated, Object.hasOwn(supplied, 'Updated') ? supplied.Updated : true);
        assert.equal(result.manager, supplied.manager || 'dockerman');
        assert.equal(result.Running, true);
        assert.equal(Object.hasOwn(source.app.info.State, 'Updated'), Object.hasOwn(supplied, 'Updated'));
    }
});

test('native row reconciliation uses normalized runtime IDs without scanning the inventory', () => {
    const infoModule = require(path.join(plugin, 'scripts/docker.runtime.info.js'));
    for (const count of [10, 100, 1000]) {
        let lookups = 0;
        const runtime = Object.fromEntries(Array.from({length:count}, (_, index) => ['app-' + index, {
            id: 'server:' + (index + 1).toString(16).padStart(12, '0') + '0'.repeat(52),
            info:{Name:'app-' + index, State:{Running:true, Updated:true}, Config:{}}
        }]));
        const rows = Object.fromEntries(Object.values(runtime).map(entry => ['ct-' + entry.id.split(':').pop().slice(0,12), {}]));
        const api = infoModule.createApi({window:{}, getDockerRuntimeInfoMap:()=>runtime});
        const find = loadFunction('docker.runtime.preview-actions.js', 'findDockerRuntimeSourceRow', 'bindDockerNestedPreviewContext', {
            doc:{getElementById:id=>{lookups++; return rows[id] || null;}},
            jq:value=>{
                assert.notEqual(typeof value, 'string', 'valid IDs must not fall back to an inventory scan');
                const wrapped = {length:value ? 1 : 0, closest:()=>wrapped, first:()=>value}; return wrapped;
            }
        });
        for (const name of Object.keys(runtime)) {
            const entry = api.buildRuntimeContainerEntry(name);
            assert.equal(entry.id.length, 12);
            assert.equal(find(entry), rows['ct-' + entry.id]);
        }
        assert.ok(lookups <= count * 3);
    }
});
