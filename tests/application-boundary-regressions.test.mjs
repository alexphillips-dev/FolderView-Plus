import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const utils = require(path.join(plugin, 'scripts/folderviewplus.utils.js'));
const loadFunction = (file, name, nextName, sandbox) => {
    const source = fs.readFileSync(path.join(plugin, 'scripts', file), 'utf8');
    const start = source.indexOf('const ' + name + ' =');
    const end = source.indexOf('const ' + nextName + ' =', start);
    assert.ok(start >= 0 && end > start);
    return vm.runInNewContext(source.slice(start, end) + '\n' + name, sandbox);
};
const rule = fields => ({ id: 'fixture', enabled: true, effect: 'include', kind: 'name_regex',
    folderId: 'dest', pattern: '^media', labelKey: '', labelValue: '', ...fields });
const t = (_key, fallback, ...params) => fallback.replace(/\$(\d+)/g, (_, index) => String(params[Number(index) - 1]));

test('wizard rule matches use the saved managed-rule compiler and Unicode semantics', () => {
    const preview = loadFunction('folderviewplus.wizard.js', 'previewSetupAssistantRuleMatches', 'previewSetupAssistantRuleOutcomesForType', {
        utils, normalizeManagedType: type => type,
        getSetupAssistantRulePreviewPool: () => ['Media-App', 'media-app', '\u{1f600}'], setupAssistantT: t
    });
    for (const [pattern, expected] of [['^media', ['media-app']], ['^.$', ['\u{1f600}']], ['^\\u{1F600}$', ['\u{1f600}']]]) {
        const result = preview('docker', pattern);
        assert.equal(result.valid, true);
        assert.deepEqual(Array.from(result.samples), expected);
        assert.equal(result.count, expected.length);
        const compiled = utils.compileRuleSet({ type: 'docker', rules: [rule({ pattern })] });
        assert.deepEqual(['Media-App', 'media-app', '\u{1f600}'].filter(name => compiled.decide(name).assignedRule), expected);
    }
    for (const pattern of ['', '[', '\\Qabc\\E']) {
        assert.equal(preview('docker', pattern).valid, false, pattern);
        assert.equal(preview('docker', pattern).count, 0, pattern);
    }
});

test('rule tester overrides canonical image, compose and label facts for existing and synthetic names', () => {
    for (const existing of [true, false]) {
        for (const fields of [{ kind: 'image_regex', pattern: '^typed/image$' },
            { kind: 'compose_project_regex', pattern: '^typed-project$' },
            { kind: 'label', pattern: '', labelKey: 'stack', labelValue: 'typed-stack' }]) {
            const original = { image: 'old/image', Image: 'old/image', Labels: { stack: 'old-stack', 'com.docker.compose.project': 'old-project' },
                info: { Config: { Image: 'nested/image', Labels: { stack: 'nested-stack', 'com.docker.compose.project': 'nested-project' } } } };
            const before = JSON.stringify(original);
            const inputs = { '#docker-rule-test-name': 'fixture', '#docker-rule-test-label-key': 'stack',
                '#docker-rule-test-label-value': 'typed-stack', '#docker-rule-test-image': 'typed/image', '#docker-rule-test-compose': 'typed-project' };
            let message;
            const run = loadFunction('folderviewplus.js', 'testAutoRule', 'filterBulkItems', {
                utils, prefsByType: { docker: { autoRules: [rule(fields)] } }, infoByType: { docker: existing ? { fixture: original } : {} },
                getFolderMap: () => ({ dest: { name: 'Destination' } }), updateRuleValidationHint: () => true,
                ruleDescription: entry => entry.id, folderNameForId: () => 'Destination',
                $: selector => ({ val: () => inputs[selector], text: value => { message = value; } })
            });
            run('docker');
            assert.match(message, /priority #1 sends this item to Destination/, JSON.stringify({ existing, fields }));
            assert.equal(JSON.stringify(original), before, 'testing must not alter the accepted runtime inventory');
        }
    }
});

test('deletion confirmations escape persisted folder markup and cancellation performs no mutation', async () => {
    const name = '<img src=x onerror="throw new Error(1)"> & folder';
    for (const entrypoint of ['settings', 'vm']) {
        let dialog, confirm, mutations = 0, refreshes = 0;
        const sandbox = { escapeHtml: utils.escapeHtml, swal: (options, callback) => { dialog = options; confirm = callback; },
            normalizeManagedType: type => type, ensureRuntimeConflictActionAllowed: () => true, getFolderMap: () => ({ fixture: { name } }),
            ensureVmFolderUnlocked: () => true, globalFolders: { fixture: { name } },
            $: Object.assign(() => ({ show: () => {} }), { i18n: key => key }),
            pluginRequestClient: { postJson: async () => { mutations++; } }, setTimeout: () => { refreshes++; }, loadlist: () => {} };
        const run = entrypoint === 'settings'
            ? loadFunction('folderviewplus.js', 'clearType', 'updatePrefsPartial', sandbox)
            : loadFunction('vm.js', 'rmFolder', 'EDITOR_PREFILL_STORAGE_KEY', sandbox);
        if (entrypoint === 'settings') run('docker', 'fixture'); else run('fixture');
        assert.equal(dialog.html, true);
        assert.doesNotMatch(dialog.text, /<img|<script/i);
        assert.ok(dialog.text.includes('&lt;img'));
        assert.ok(dialog.text.includes('&amp; folder'));
        await confirm(false);
        assert.equal(mutations, 0);
        assert.equal(refreshes, entrypoint === 'vm' ? 1 : 0);
    }
});

test('Unicode rule goldens assert expected matches independently in browser and PHP', () => {
    const vectors = [
        ['\\u00e4+', '\u00e4\u00e4', true], ['\\u00e4+', 'aa', false],
        ['\\uD83D\\uDE00', '\u{1f600}', true], ['^\\u{1F600}$', '\u{1f600}', true],
        ['^.$', '\u{1f600}', true], ['^..$', '\u{1f600}', false], ['^\\p{L}+$', '\u00e4a', true],
        ['^\\p{L}+$', '\u{1f600}', false]
    ];
    const cases = vectors.map(([pattern, name]) => ({ type: 'docker', name, folders: { dest: {} }, rules: [rule({ pattern })], info: { [name]: {} } }));
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-rule-goldens-'));
    try {
        fs.writeFileSync(path.join(fixtureRoot, 'request.json'), JSON.stringify({ cases }));
        const server = JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/rule-engine.php'), fixtureRoot, path.join(plugin, 'server')],
            { encoding: 'utf8', timeout: 30000 }));
        for (const [index, entry] of cases.entries()) {
            const expected = vectors[index][2];
            const browser = utils.getAutoRuleDecision({ ...entry, infoByName: entry.info });
            assert.equal(Boolean(browser.assignedRule), expected, 'browser ' + JSON.stringify(vectors[index]));
            assert.equal(Boolean(server[index].assignedRule), expected, 'PHP ' + JSON.stringify(vectors[index]));
        }
    } finally {
        assert.equal(path.dirname(path.resolve(fixtureRoot)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(fixtureRoot).startsWith('fvplus-rule-goldens-'));
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('wizard review and persistence reject invalid managed predicates before posting preferences', async () => {
    const suggestions = [
        { folderName: 'Destination', pattern: '[' },
        { folderName: 'Destination', pattern: '\\Qabc\\E' },
        { folderName: 'Destination', pattern: '' },
        { folderName: 'Destination', pattern: '^media' }
    ];
    const prefsByType = { docker: { autoRules: [] } };
    const posted = [];
    const sandbox = { utils, normalizeManagedType: type => type,
        setupAssistantState: { ruleBootstrap: { docker: { enabled: true, suggestions } } },
        prefsByType, resolveSetupAssistantFolderId: () => 'dest',
        ruleTemplatesModule: require(path.join(plugin, 'scripts/folderviewplus.rule-templates.js')),
        postPrefs: async (_type, value) => { posted.push(value); return value; } };
    const outcomes = loadFunction('folderviewplus.wizard.js', 'previewSetupAssistantRuleOutcomesForType', 'getWizardReviewApi', sandbox);
    assert.equal(outcomes('docker').creatable, 1);
    assert.equal(outcomes('docker').invalidPattern, 3);
    const apply = loadFunction('folderviewplus.wizard.js', 'applySetupAssistantRulesForType', 'buildSetupAssistantReviewNotes', sandbox);
    const result = await apply('docker');
    assert.equal(result.created, 1);
    assert.equal(result.skipped, 3);
    assert.equal(posted.length, 1);
    assert.equal(posted[0].autoRules.length, 1);
    assert.equal(posted[0].autoRules[0].pattern, '^media');
    assert.equal(utils.compileRuleSet({ type: 'docker', rules: posted[0].autoRules, folders: { dest: {} } }).issues.length, 0);
    sandbox.setupAssistantState.ruleBootstrap.docker.suggestions = suggestions.slice(0, 3);
    const invalidOnly = await apply('docker');
    assert.equal(invalidOnly.created, 0);
    assert.equal(invalidOnly.skipped, 3);
    assert.equal(posted.length, 1, 'an entirely invalid suggestion set must not trigger persistence');
});
