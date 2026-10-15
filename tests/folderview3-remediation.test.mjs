import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { migrationFixture, runMigrationFixture } from './helpers/folderview3-fixture.mjs';
const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const identity = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.member-identity.js');
const themes = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-profiles.js');
const copy = () => structuredClone(migrationFixture);

test('M01/M11/M12/M14/M23/M31: complete synthetic v1 migrates, persists and preserves effective settings', () => {
    const r = runMigrationFixture({ operation: 'apply' }); assert.equal(r.error, ''); assert.equal(r.applied.transaction.verified, true);
    const [docker, vm, prefs] = r.stored;
    assert.equal(docker.regex.settings.preview, 4); assert.equal(docker.regex.settings.preview_hover, true);
    assert.equal(docker.manual.settings.preview, 0); assert.equal(docker.manual.settings.preview_hover, false);
    assert.equal(docker.manual.settings.folder_update_highlight, true);
    assert.equal(docker.regex.settings.preview_overflow, 'expand_row'); assert.equal(vm.lab.settings.preview_overflow, 'scroll');
    assert.deepEqual(docker.regex.hiddenPreviewMembers, ['service-hidden']);
    assert.equal(vm.lab.memberIdentities['Synthetic VM'].uuid, '11111111-2222-3333-4444-555555555555');
    assert.equal(prefs.folderDefaults.profile.settings.context_trigger, 1);
    assert.equal(prefs.folderDefaults.profile.settings.context_graph, 4);
    assert.equal(prefs.folderDefaults.profile.settings.context_graph_time, 180);
    assert.equal(prefs.folderDefaults.profile.settings.preview_overflow, 'expand_row');
});

test('M04/M05/M06/M07/M10/M33: malformed backups reject with every original file unchanged', () => {
    const invalid = [{ fv3_export_version: 1 }, ...[null, 'damaged', [1]].map(docker => ({ ...copy(), docker })),
        ...[0, 2, true, '1', '1garbage', 1.5].map(fv3_export_version => ({ ...copy(), fv3_export_version }))];
    const wrongFolder = copy(); wrongFolder.docker.regex.containers = [{}]; invalid.push(wrongFolder);
    const badName = copy(); badName.docker.regex.name = 'x'.repeat(161); invalid.push(badName);
    const badBoolean = copy(); badBoolean.docker.manual.settings.preview_hover = 'invalid'; invalid.push(badBoolean);
    const badNumber = copy(); badNumber.docker.manual.settings.preview = 1.5; invalid.push(badNumber);
    const badId = copy(); badId.docker.manual.containerIds = { 'service-manual': 'a'.repeat(65) }; invalid.push(badId);
    const badNative = copy(); badNative.native_autostart = ['service-auto', 'service-auto 12']; invalid.push(badNative);
    const dangerous = copy(); dangerous.docker = JSON.parse('{"__proto__":{"name":"Hostile"}}'); invalid.push(dangerous);
    for (const bundle of invalid) { const r = runMigrationFixture({ bundle }); assert.ok(r.error); assert.equal(r.unchanged, true, r.error); }
    for (const raw of ['', '{', 'null', '[]']) { const r = runMigrationFixture({ raw }); assert.ok(r.error); assert.equal(r.unchanged, true); }
});

test('M03: historical verified envelope accepts absent additions and stays unmanaged', () => {
    const bundle = copy(); delete bundle.autostart; delete bundle.unraid_version; delete bundle.order_docker;
    const r = runMigrationFixture({ bundle }); assert.equal(r.error, '');
    assert.equal(r.plan.target.types.docker.prefs.dockerStartOrder.mode, 'unmanaged');
});

test('M08/M09: 300 assignments, long identity keys and action targets remain intact', () => {
    const bundle = copy(), names = Array.from({ length: 300 }, (_, i) => `member-${i}-` + 'x'.repeat(70));
    bundle.docker.manual.containers = names; bundle.docker.manual.containerImages = Object.fromEntries(names.map(n => [n, 'synthetic/image']));
    bundle.docker.manual.actions = [{ name: 'Synthetic action', type: 0, action: 2, conatiners: names }];
    const r = runMigrationFixture({ bundle, operation: 'apply' }); assert.equal(r.error, '');
    assert.deepEqual(r.stored[0].manual.containers, names); assert.equal(Object.keys(r.stored[0].manual.memberIdentities).length, 300);
    assert.deepEqual(r.stored[0].manual.actions[0].conatiners, names);
});

test('M16/M17/M18: legacy ownership is shared while native advanced-rule behavior stays unchanged', () => {
    const r = runMigrationFixture(); assert.equal(r.error, '');
    const { folders, prefs } = r.plan.target.types.docker;
    const infoByName = { 'service-manual': { Labels: {} }, 'service-label': { Labels: { 'folder.view3': 'Label' } }, 'service-auto': { Labels: {} } };
    const membership = utils.buildLegacyMembership({ folders, names: Object.keys(infoByName), infoByName, type: 'docker', rules: prefs.autoRules });
    assert.deepEqual(membership.manual, ['service-manual']); assert.deepEqual(membership.label, ['service-label']); assert.deepEqual(membership.regex, ['service-auto']);
    assert.equal(utils.getConflictReport({ type: 'docker', folders, prefs, infoByName }).conflictingItems, 0);
    const plan = utils.planFolderRuntimeAction({ type: 'docker', folderId: 'regex', folder: folders.regex, folders, infoByName, rules: prefs.autoRules, action: 'start' });
    assert.equal(plan.requestedCount, 1);
    assert.equal(utils.getAutoRuleDecision({ rules: [{ enabled: true, effect: 'include', folderId: 'native', kind: 'name_regex', pattern: 'service' }], name: 'service-manual', infoByName, type: 'docker' }).assignedRule.folderId, 'native');
    assert.deepEqual(Object.keys(utils.buildLegacyMembership({ folders: { broken: null }, names: [], infoByName: {}, type: 'docker', rules: [] })), []);
    // Runtime order filtering must not hide an actual member whose name resembles a folder placeholder.
    const prefixFolders = { ...folders, manual: { ...folders.manual, containers: ['folder-manual'] } };
    const prefixCache = utils.reconcileLegacyMatchCache({}, { folders: prefixFolders, names: [], infoByName: { 'folder-manual': { Labels: {} } }, type: 'docker', rules: [] });
    assert.deepEqual(prefixCache.manual.explicit, ['folder-manual']);
});

test('M15/M20: whitespace retains original meaning and invalid or oversized regex rejects', () => {
    const bundle = copy(); bundle.docker.regex.regex = ' ^service-$ ';
    const r = runMigrationFixture({ bundle }); assert.equal(r.error, '');
    const pattern = r.plan.target.types.docker.prefs.autoRules[0].pattern; assert.equal(pattern, bundle.docker.regex.regex);
    assert.equal(new RegExp(pattern).test('service-'), false);
    for (const pattern of ['[', 'a'.repeat(1025), '(?R)', '(?|a|b)', '\\Qservice\\E', 'a++']) { const b = copy(); b.docker.regex.regex = pattern; const r = runMigrationFixture({ bundle: b }); assert.ok(r.error); assert.equal(r.unchanged, true); }
});

test('M07/M21/M29/M30: preview is pure with missing, legacy and corrupt workspace states', () => {
    for (const request of [{ seed: false }, { workspace: { variables: {}, customCss: '.synthetic {}' } }, { corruptWorkspace: true }]) {
        const r = runMigrationFixture(request); assert.equal(r.error, ''); assert.equal(r.unchanged, true);
    }
});

test('M21/M22: independent installed reads retain a stable digest and apply', () => {
    const r = runMigrationFixture({ operation: 'installed' }); assert.equal(r.error, ''); assert.equal(r.stableDigest, true); assert.equal(r.applied.transaction.verified, true);
});

test('M24/M38: concurrent destination edits reject the reviewed migration without changing the new state', () => {
    const r = runMigrationFixture({ operation: 'stale' }); assert.match(r.error, /changed after preview/); assert.equal(r.protectedUnchanged, true); assert.equal(r.diagnosticEvents[0].details.outcome, 'stale-preview');
});

test('M29: mid-apply failure compensates folder/prefs/assets/metadata while retaining recovery evidence', () => {
    const r = runMigrationFixture({ operation: 'failure' }); assert.match(r.error, /All changed configuration was restored/); assert.equal(r.protectedUnchanged, true);
});

test('M31/M35: repeated imports do not duplicate folders or inactive profiles', () => {
    const r = runMigrationFixture({ operation: 'repeat' }); assert.equal(r.error, ''); assert.equal(r.repeatEqual, true);
});

test('M14/M28: editor re-save preserves missing VM identity and legacy ownership policy', () => {
    const r = runMigrationFixture({ operation: 'editor' }); assert.equal(r.error, '');
    assert.equal(r.stored[1].lab.memberIdentities['Synthetic VM'].uuid, '11111111-2222-3333-4444-555555555555');
    assert.equal(r.stored[1].lab.membershipPolicy, 'folderview3');
});

test('M34/M35: presets stay inactive and unsupported appearance preferences survive as recovery data', () => {
    const r = runMigrationFixture({ operation: 'apply' }); assert.equal(r.error, '');
    const workspace = r.stored[4], preset = workspace.profiles.find(p => p.name === 'Synthetic reusable preset');
    assert.ok(preset); assert.notEqual(preset.id, workspace.activeProfileId); assert.match(preset.layers.global.customCss, /#123456/);
    const imported = workspace.profiles.find(p => p.name === 'FolderView3 imported appearance');
    assert.equal(JSON.parse(imported.legacyMetadata).user_notes, 'Synthetic recovery note');
    assert.equal(JSON.parse(themes.normalizeState(workspace).profiles.find(p => p.id === imported.id).legacyMetadata).user_notes, 'Synthetic recovery note');
    assert.ok(r.report.warnings.some(x => x.includes('recovery metadata')));
});

test('M02: complete envelopes dispatch to migration while native, maps and single folders retain scoped parsing', () => {
    assert.equal(utils.parseImportPayload(copy(), 'docker').migration, true);
    assert.equal(utils.parseImportPayload({ media: { name: 'Synthetic media', containers: [] } }, 'docker').ok, true);
    assert.equal(utils.parseImportPayload({ name: 'Synthetic media', containers: [] }, 'docker').ok, true);
    assert.equal(utils.parseImportPayload({ docker: { media: { name: 'Synthetic media', containers: [] } } }, 'docker').ok, true);
});

test('M08: collection boundaries preserve all entries; exceeding supported limits rejects before apply', () => {
    for (const length of [249, 250, 251, 5000]) {
        const bundle = copy(), names = Array.from({ length }, (_, i) => `synthetic-${i}`);
        bundle.docker.manual.containers = names; bundle.docker.manual.hidden_preview = names;
        const r = runMigrationFixture({ bundle, operation: 'apply' }); assert.equal(r.error, '');
        assert.deepEqual(r.stored[0].manual.containers, names); assert.deepEqual(r.stored[0].manual.hiddenPreviewMembers, names);
    }
    const oversized = copy(); oversized.docker.manual.containers = Array.from({ length: 5001 }, (_, i) => `synthetic-${i}`);
    const r = runMigrationFixture({ bundle: oversized, operation: 'apply' }); assert.ok(r.error); assert.equal(r.unchanged, true);
});

test('M11/M12/M13: aliases and inherited null/empty values persist while explicit false and zero survive', () => {
    for (const [source, expected] of [[0, 'default'], [1, 'expand_row'], [2, 'scroll'], ['default', 'default'], ['expand', 'expand_row'], ['scroll', 'scroll'], ['expand_row', 'expand_row']]) {
        const bundle = copy(); bundle.settings.default_overflow = String(source);
        bundle.docker.manual.settings.preview_overflow = source;
        bundle.docker.regex.settings = { preview: null, preview_hover: '', preview_update_folder: false, context_trigger: 0 };
        const r = runMigrationFixture({ bundle, operation: 'apply' }); assert.equal(r.error, '');
        assert.equal(r.stored[0].manual.settings.preview_overflow, expected);
        assert.equal(r.stored[2].folderDefaults.profile.settings.preview_overflow, expected);
        assert.equal(r.stored[0].regex.settings.preview, 4); assert.equal(r.stored[0].regex.settings.preview_hover, true);
        assert.equal(r.stored[0].regex.settings.context_trigger, 0); assert.equal(r.stored[0].regex.settings.folder_update_highlight, false);
    }
});

test('M14: imported VM identities reconcile unique renames and retain missing or ambiguous references', () => {
    const r = runMigrationFixture({ operation: 'apply' }), folders = r.stored[1];
    const uuid = folders.lab.memberIdentities['Synthetic VM'].uuid;
    const renamed = identity.reconcileFolders('vm', folders, { 'Renamed synthetic VM': { name: 'Renamed synthetic VM', uuid } });
    assert.deepEqual(renamed.folders.lab.containers, ['Renamed synthetic VM']);
    assert.equal(renamed.folders.lab.membershipPolicy, 'folderview3');
    assert.deepEqual(identity.reconcileFolders('vm', folders, {}).folders.lab.containers, ['Synthetic VM']);
    const ambiguous = identity.reconcileFolders('vm', folders, { A: { name: 'A', uuid }, B: { name: 'B', uuid } });
    assert.deepEqual(ambiguous.folders.lab.containers, ['Synthetic VM']); assert.equal(ambiguous.diagnostics.ambiguous.length, 1);
    // PHP encodes a name-keyed identity map as a JSON list when its sole key is "0".
    const numeric = copy(); numeric.vm.lab.containers = ['0']; numeric.vm.lab.containerIds = { '0': uuid };
    const saved = runMigrationFixture({ bundle: numeric, operation: 'apply' }); assert.equal(saved.error, '');
    const zero = identity.reconcileFolders('vm', saved.stored[1], { Renamed: { name: 'Renamed', uuid } });
    assert.deepEqual(zero.folders.lab.containers, ['Renamed']);
});

test('M15/M16/M17/M18/M19/M37: PHP startup and browser ownership/order equal the unchanged original evaluator', () => {
    const inventory = Object.fromEntries(['service-label', 'service-auto', 'service-manual', 'other', 'service-hidden'].map(name => [name, { Labels: name === 'service-label' ? { 'folder.view3': 'Label' } : {} }]));
    for (const reverse of [false, true]) {
        const bundle = copy(); bundle.docker.manual.containers.push('other');
        bundle.docker.second = { name: 'Second regex', regex: '^service-', containers: [], settings: {} };
        if (reverse) bundle.docker = Object.fromEntries(Object.entries(bundle.docker).reverse());
        const r = runMigrationFixture({ bundle, inventory, operation: 'apply' }); assert.equal(r.error, '');
        const actual = utils.buildLegacyMembership({ folders: r.stored[0], names: Object.keys(inventory), infoByName: inventory, type: 'docker', rules: r.stored[2].autoRules });
        for (const id of Object.keys(actual)) {
            assert.deepEqual(actual[id], r.legacyMembership[`folder-${id}`]);
            assert.deepEqual(r.membership[id], actual[id]);
            assert.deepEqual(r.startOrderContext.folderContainers[`folder-${id}`], actual[id]);
        }
        const cache = utils.reconcileLegacyMatchCache({ native: { explicit: ['native-member'] } }, { folders: r.stored[0], names: Object.keys(inventory), infoByName: inventory, type: 'docker', rules: r.stored[2].autoRules });
        assert.deepEqual(cache.native.explicit, ['native-member']); assert.deepEqual(cache.manual.explicit, ['service-manual', 'other']);
    }
});

test('M22/M24: actual installed-source edits invalidate a prior preview without destination writes', () => {
    const r = runMigrationFixture({ operation: 'installed-stale' }); assert.match(r.error, /changed after preview/); assert.equal(r.protectedUnchanged, true); assert.equal(r.diagnosticEvents[0].details.rollback, 'not-needed');
});

test('M07/M32/M33/M40: unknown data is disclosed; duplicate keys, deep and oversized inputs reject', () => {
    const bundle = copy(); bundle.future_configuration = { meaningful: true }; bundle.settings.future_option = 'yes';
    const r = runMigrationFixture({ bundle }); assert.equal(r.error, '');
    assert.ok(r.report.warnings.some(w => /Unrecognized fields/.test(w))); assert.ok(r.report.warnings.some(w => /future_option/.test(w)));
    const duplicate = JSON.stringify(copy()).replace('"fv3_export_version":1', '"fv3_export_version":1,"fv3_export_version":1');
    for (const raw of [duplicate, ' '.repeat(5242881), '{"fv3_export_version":1,"docker":' + '['.repeat(20) + '0' + ']'.repeat(20) + '}']) {
        const failed = runMigrationFixture({ raw, operation: 'apply' }); assert.ok(failed.error); assert.equal(failed.unchanged, true);
    }
});

test('M34/M35: oversize appearance layers and profile exhaustion reject without dropping existing profiles', () => {
    const bundle = copy(); bundle.css_config.custom_css = 'a'.repeat(65537);
    const tooLarge = runMigrationFixture({ bundle }); assert.ok(tooLarge.error); assert.equal(tooLarge.unchanged, true);
    const workspace = { schemaVersion: 2, activeProfileId: 'existing-0', profiles: Array.from({ length: 32 }, (_, i) => ({ id: `existing-${i}`, name: `Existing ${i}`, layers: {} })) };
    const full = runMigrationFixture({ workspace }); assert.match(full.error, /profile limit/); assert.equal(full.unchanged, true);
});
